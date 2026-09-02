#!/usr/bin/env python3
"""Fine-tune the 28-output GoEmotions checkpoint on PetalPal's selected 21 labels."""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset, Subset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
FROZEN_MARKER = "petalpal-in-domain-v1"


def guard_training_path(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if FROZEN_MARKER in resolved.name.lower() or "evaluation" in {part.lower() for part in resolved.parts}:
        raise ValueError(f"Frozen evaluation data is forbidden in training: {resolved}")
    return resolved


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def label_positions(model) -> list[int]:
    id2label = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    missing = [label for label in LABELS if label not in id2label.values()]
    if missing:
        raise ValueError(f"Checkpoint is missing PetalPal labels: {missing}")
    return [next(index for index, label in id2label.items() if label == wanted) for wanted in LABELS]


class PetalPalDataset(Dataset):
    def __init__(self, path: Path, tokenizer, max_length: int = 128):
        self.path = guard_training_path(path)
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.rows = [json.loads(line) for line in self.path.open() if line.strip()]
        for row in self.rows:
            labels = row.get("modelLabels")
            if not isinstance(row.get("journal"), str) or not row["journal"].strip():
                raise ValueError(f"Invalid journal in {self.path}: {row.get('id')}")
            if not isinstance(labels, list) or not set(labels) <= set(LABELS):
                raise ValueError(f"Invalid labels in {self.path}: {row.get('id')}")
            if not isinstance(row.get("preferNoSecondaryEmotion"), bool):
                raise ValueError(f"Invalid abstention target in {self.path}: {row.get('id')}")

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        row = self.rows[index]
        encoded = self.tokenizer(
            row["journal"], padding="max_length", truncation=True,
            max_length=self.max_length, return_tensors="pt",
        )
        targets = torch.zeros(len(LABELS), dtype=torch.float32)
        for label in row["modelLabels"]:
            targets[LABELS.index(label)] = 1
        return {key: value.squeeze(0) for key, value in encoded.items()} | {"labels": targets}


def metrics(targets: torch.Tensor, probabilities: torch.Tensor) -> dict:
    predicted = probabilities >= 0.5
    truth = targets.bool()
    tp = (predicted & truth).sum(0).float()
    fp = (predicted & ~truth).sum(0).float()
    fn = (~predicted & truth).sum(0).float()
    precision = tp / (tp + fp).clamp_min(1)
    recall = tp / (tp + fn).clamp_min(1)
    f1 = 2 * precision * recall / (precision + recall).clamp_min(1e-12)
    micro_p = tp.sum() / (tp.sum() + fp.sum()).clamp_min(1)
    micro_r = tp.sum() / (tp.sum() + fn.sum()).clamp_min(1)
    micro_f1 = 2 * micro_p * micro_r / (micro_p + micro_r).clamp_min(1e-12)
    return {
        "macro_precision": precision.mean().item(), "macro_recall": recall.mean().item(),
        "macro_f1": f1.mean().item(), "micro_precision": micro_p.item(),
        "micro_recall": micro_r.item(), "micro_f1": micro_f1.item(),
        "per_label": {label: {"precision": precision[i].item(), "recall": recall[i].item(),
                              "f1": f1[i].item(), "support": int(truth[:, i].sum())}
                      for i, label in enumerate(LABELS)},
    }


@torch.no_grad()
def evaluate(model, loader, positions, loss_fn, device, max_batches=None) -> dict:
    model.eval()
    losses, targets, probabilities = [], [], []
    for batch_index, batch in enumerate(loader):
        labels = batch.pop("labels").to(device)
        logits = model(**{key: value.to(device) for key, value in batch.items()}).logits[:, positions]
        losses.append(loss_fn(logits, labels).item())
        targets.append(labels.cpu())
        probabilities.append(torch.sigmoid(logits).cpu())
        if max_batches and batch_index + 1 >= max_batches:
            break
    return {"loss": sum(losses) / len(losses), **metrics(torch.cat(targets), torch.cat(probabilities))}


def train(args) -> dict:
    set_seed(args.seed)
    checkpoint = args.checkpoint.resolve()
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    positions = label_positions(model)
    if model.config.num_labels != 28 or len(positions) != 21:
        raise ValueError("Expected a 28-output checkpoint with a 21-label PetalPal projection")

    train_data = PetalPalDataset(args.train, tokenizer, args.max_length)
    dev_data = PetalPalDataset(args.dev, tokenizer, args.max_length)
    generator = torch.Generator().manual_seed(args.seed)
    if args.smoke_test:
        train_data, dev_data = Subset(train_data, range(1)), Subset(dev_data, range(1))
        try:
            guard_training_path(root := args.train.resolve().parents[1] / "evaluation/petalpal-in-domain-v1.jsonl")
            raise AssertionError(f"Frozen-set guard did not reject {root}")
        except ValueError:
            pass
    train_loader = DataLoader(train_data, batch_size=1 if args.smoke_test else args.batch_size,
                              shuffle=True, generator=generator)
    dev_loader = DataLoader(dev_data, batch_size=1 if args.smoke_test else args.batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    updates_per_epoch = math.ceil(len(train_loader) / args.gradient_accumulation)
    total_updates = max(1, (1 if args.smoke_test else args.epochs) * updates_per_epoch)
    scheduler = get_linear_schedule_with_warmup(
        optimizer, math.ceil(total_updates * args.warmup_ratio), total_updates,
    )
    loss_fn = torch.nn.BCEWithLogitsLoss()
    output = args.output.resolve()
    best_path = output / "best-checkpoint"
    output.mkdir(parents=True, exist_ok=True)
    best_macro_f1, stale, history = -1.0, 0, []

    epochs = 1 if args.smoke_test else args.epochs
    for epoch in range(epochs):
        model.train(); optimizer.zero_grad(); running_loss = 0.0
        for batch_index, batch in enumerate(train_loader):
            labels = batch.pop("labels").to(device)
            logits = model(**{key: value.to(device) for key, value in batch.items()}).logits
            selected = logits[:, positions]
            if selected.shape[-1] != len(LABELS):
                raise AssertionError(f"Expected 21 selected logits, got {selected.shape}")
            loss = loss_fn(selected, labels) / args.gradient_accumulation
            loss.backward(); running_loss += loss.item() * args.gradient_accumulation
            if (batch_index + 1) % args.gradient_accumulation == 0 or batch_index + 1 == len(train_loader):
                optimizer.step(); scheduler.step(); optimizer.zero_grad()
            if args.smoke_test:
                break

        dev = evaluate(model, dev_loader, positions, loss_fn, device, max_batches=1 if args.smoke_test else None)
        record = {"epoch": epoch + 1, "train_loss": running_loss, "dev": dev}
        history.append(record)
        with (output / "training-metrics.jsonl").open("a") as handle:
            handle.write(json.dumps(record) + "\n")
        if dev["macro_f1"] > best_macro_f1:
            best_macro_f1, stale = dev["macro_f1"], 0
            if not args.smoke_test:
                model.save_pretrained(best_path); tokenizer.save_pretrained(best_path)
        else:
            stale += 1
            if stale >= args.patience:
                break

    summary = {
        "status": "SMOKE_TEST_PASSED" if args.smoke_test else "TRAINING_COMPLETE",
        "checkpoint": str(checkpoint), "bestCheckpoint": str(best_path),
        "labels": LABELS, "selectedLogitPositions": positions,
        "frozenEvaluationUsed": False, "frozenGuardPassed": True,
        "forwardBackwardPassed": True, "devEvaluationPassed": True,
        "bestDevMacroF1": best_macro_f1,
        "epochsCompleted": len(history),
    }
    (output / ("smoke-result.json" if args.smoke_test else "training-summary.json")).write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=Path, default=root / "tuning-data-v1/train.jsonl")
    parser.add_argument("--dev", type=Path, default=root / "tuning-data-v1/dev.jsonl")
    parser.add_argument("--checkpoint", type=Path, default=root / "candidate-c/artifacts/checkpoint")
    parser.add_argument("--output", type=Path, default=root / "candidate-c-lite/fine-tuned")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--gradient-accumulation", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--warmup-ratio", type=float, default=0.1)
    parser.add_argument("--patience", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()
    guard_training_path(args.train); guard_training_path(args.dev)
    print(json.dumps(train(args), indent=2))


if __name__ == "__main__":
    main()
