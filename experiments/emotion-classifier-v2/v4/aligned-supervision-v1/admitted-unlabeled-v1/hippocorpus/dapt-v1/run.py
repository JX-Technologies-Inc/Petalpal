#!/usr/bin/env python3
"""Bounded Hippocorpus masked-language-model domain adaptation experiment."""

import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoModelForMaskedLM,
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    get_linear_schedule_with_warmup,
)


HERE = Path(__file__).resolve().parent
HIPPO = HERE.parent
ALIGNED = HERE.parents[2]
EMOTION_ROOT = HERE.parents[4]
CHECKPOINT = EMOTION_ROOT / "candidate-c" / "artifacts" / "checkpoint"
FROZEN_DEVELOPMENT = ALIGNED / "dev.jsonl"
OUTPUT = HERE / "experiment"

SEED = 44
MAX_LENGTH = 96
BATCH_SIZE = 8
ACCUMULATION = 4
EPOCHS = 1
LEARNING_RATE = 2e-5
MASK_PROBABILITY = 0.15
THRESHOLD = 0.35

PRODUCT_21 = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
PRODUCT_18 = [label for label in PRODUCT_21 if label not in {"approval", "disapproval", "neutral"}]


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


class TextDataset(Dataset):
    def __init__(self, rows: list[dict], tokenizer):
        self.encodings = tokenizer(
            [row["text"] for row in rows],
            truncation=True,
            max_length=MAX_LENGTH,
            add_special_tokens=True,
        )

    def __len__(self) -> int:
        return len(self.encodings["input_ids"])

    def __getitem__(self, index: int) -> dict:
        return {key: value[index] for key, value in self.encodings.items()}


@torch.inference_mode()
def evaluate_mlm(model, loader, seed: int) -> float:
    torch.manual_seed(seed)
    model.eval()
    total_loss = 0.0
    total_examples = 0
    for batch in loader:
        batch_size = batch["input_ids"].shape[0]
        loss = model(**batch).loss
        total_loss += loss.item() * batch_size
        total_examples += batch_size
    return total_loss / total_examples


@torch.inference_mode()
def classifier_probabilities(model, tokenizer, rows: list[dict]) -> np.ndarray:
    texts = [row["journal"] for row in rows]
    model.eval()
    chunks = []
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in PRODUCT_18]
    for start in range(0, len(texts), 8):
        encoded = tokenizer(
            texts[start : start + 8],
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        chunks.append(torch.sigmoid(model(**encoded).logits[:, positions]).cpu().numpy())
    return np.concatenate(chunks)


def select_top2(probabilities: np.ndarray) -> np.ndarray:
    prediction = np.zeros_like(probabilities, dtype=np.int8)
    for row_index, row in enumerate(probabilities):
        eligible = [index for index in np.argsort(-row) if row[index] >= THRESHOLD][:2]
        prediction[row_index, eligible] = 1
    return prediction


def weak_metrics(rows: list[dict], probabilities: np.ndarray) -> dict:
    truth = np.array([[label in row["modelLabels"] for label in PRODUCT_18] for row in rows], dtype=np.int8)
    prediction = select_top2(probabilities)
    true_positive = (truth & prediction).sum(axis=0)
    false_positive = ((1 - truth) & prediction).sum(axis=0)
    false_negative = (truth & (1 - prediction)).sum(axis=0)
    precision = np.divide(true_positive, true_positive + false_positive, out=np.zeros(18), where=true_positive + false_positive > 0)
    recall = np.divide(true_positive, true_positive + false_negative, out=np.zeros(18), where=true_positive + false_negative > 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros(18), where=precision + recall > 0)
    tp = int(true_positive.sum())
    fp = int(false_positive.sum())
    fn = int(false_negative.sum())
    micro_precision = tp / (tp + fp) if tp + fp else 0.0
    micro_recall = tp / (tp + fn) if tp + fn else 0.0
    micro_f1 = 2 * micro_precision * micro_recall / (micro_precision + micro_recall) if micro_precision + micro_recall else 0.0
    supported = truth.sum(axis=0) > 0
    per_label = {}
    for index, label in enumerate(PRODUCT_18):
        per_label[label] = {
            "support": int(truth[:, index].sum()),
            "predicted": int(prediction[:, index].sum()),
            "truePositive": int(true_positive[index]),
            "falsePositive": int(false_positive[index]),
            "falseNegative": int(false_negative[index]),
            "precision": float(precision[index]),
            "recall": float(recall[index]),
            "f1": float(f1[index]),
        }
    output_counts = prediction.sum(axis=1)
    row_false_positives = ((1 - truth) & prediction).sum(axis=1)
    total_negatives = int((1 - truth).sum())
    return {
        "status": "HISTORICAL_DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_GOLD",
        "rows": len(rows),
        "threshold": THRESHOLD,
        "topK": 2,
        "micro": {"precision": micro_precision, "recall": micro_recall, "f1": micro_f1},
        "macroF1SupportedLabels": float(f1[supported].mean()),
        "outputCountDistribution": {str(count): int((output_counts == count).sum()) for count in (0, 1, 2)},
        "falsePositives": {
            "count": int(false_positive.sum()),
            "perRow": float(false_positive.sum() / len(rows)),
            "negativeDecisionRate": float(false_positive.sum() / total_negatives),
            "rowsWithAtLeastOne": int((row_false_positives > 0).sum()),
        },
        "perLabel": per_label,
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite existing experiment: {OUTPUT}")
    OUTPUT.mkdir()
    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    random.seed(SEED)

    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED"
    assert protocol["admissionClass"] == "ADMIT_UNLABELED"

    train_rows = read_jsonl(HIPPO / "prepared" / "train.jsonl")
    validation_rows = read_jsonl(HIPPO / "prepared" / "validation.jsonl")
    assert {row["sourceGroupId"] for row in train_rows}.isdisjoint(
        {row["sourceGroupId"] for row in validation_rows}
    )
    assert all(row["labelStatus"] == "UNLABELED" and "modelLabels" not in row for row in train_rows + validation_rows)
    assert all(len(row["text"]) <= 300 for row in train_rows + validation_rows)

    tokenizer = AutoTokenizer.from_pretrained(CHECKPOINT, local_files_only=True)
    mlm = AutoModelForMaskedLM.from_pretrained("FacebookAI/roberta-base", local_files_only=True)
    original_classifier = AutoModelForSequenceClassification.from_pretrained(CHECKPOINT, local_files_only=True)
    mlm.roberta.load_state_dict(original_classifier.roberta.state_dict(), strict=True)

    mlm.requires_grad_(False)
    for layer in mlm.roberta.encoder.layer[-2:]:
        layer.requires_grad_(True)
    mlm.lm_head.dense.requires_grad_(True)
    mlm.lm_head.layer_norm.requires_grad_(True)
    mlm.lm_head.bias.requires_grad_(True)
    trainable_parameters = sum(parameter.numel() for parameter in mlm.parameters() if parameter.requires_grad)

    collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=True,
        mlm_probability=MASK_PROBABILITY,
        return_tensors="pt",
    )
    train_loader = DataLoader(
        TextDataset(train_rows, tokenizer),
        batch_size=BATCH_SIZE,
        shuffle=True,
        generator=torch.Generator().manual_seed(SEED),
        collate_fn=collator,
    )
    validation_loader = DataLoader(
        TextDataset(validation_rows, tokenizer),
        batch_size=BATCH_SIZE,
        shuffle=False,
        collate_fn=collator,
    )

    baseline_loss = evaluate_mlm(mlm, validation_loader, SEED + 100)
    optimizer = torch.optim.AdamW(
        [parameter for parameter in mlm.parameters() if parameter.requires_grad],
        lr=LEARNING_RATE,
        weight_decay=0.01,
    )
    update_steps = math.ceil(len(train_loader) / ACCUMULATION) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, math.ceil(update_steps * 0.1), update_steps)
    started = time.time()
    training_loss = 0.0
    examples_seen = 0
    mlm.train()
    optimizer.zero_grad(set_to_none=True)
    for batch_index, batch in enumerate(train_loader):
        raw_loss = mlm(**batch).loss
        (raw_loss / ACCUMULATION).backward()
        batch_examples = batch["input_ids"].shape[0]
        training_loss += raw_loss.item() * batch_examples
        examples_seen += batch_examples
        if (batch_index + 1) % ACCUMULATION == 0 or batch_index + 1 == len(train_loader):
            torch.nn.utils.clip_grad_norm_((parameter for parameter in mlm.parameters() if parameter.requires_grad), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
        if (batch_index + 1) % 25 == 0:
            print(json.dumps({"event": "train", "batch": batch_index + 1, "batches": len(train_loader), "elapsedSeconds": time.time() - started}), flush=True)

    adapted_loss = evaluate_mlm(mlm, validation_loader, SEED + 100)
    adapted_classifier = AutoModelForSequenceClassification.from_pretrained(CHECKPOINT, local_files_only=True)
    adapted_classifier.roberta.load_state_dict(mlm.roberta.state_dict(), strict=True)
    adapted_classifier.save_pretrained(OUTPUT / "adapted-classifier-checkpoint")
    tokenizer.save_pretrained(OUTPUT / "adapted-classifier-checkpoint")

    diagnostic_rows = read_jsonl(FROZEN_DEVELOPMENT)
    assert len(diagnostic_rows) == 149
    original_probabilities = classifier_probabilities(original_classifier, tokenizer, diagnostic_rows)
    adapted_probabilities = classifier_probabilities(adapted_classifier, tokenizer, diagnostic_rows)
    original_metrics = weak_metrics(diagnostic_rows, original_probabilities)
    adapted_metrics = weak_metrics(diagnostic_rows, adapted_probabilities)
    original_selection = select_top2(original_probabilities)
    adapted_selection = select_top2(adapted_probabilities)
    retention_drop = original_metrics["micro"]["f1"] - adapted_metrics["micro"]["f1"]
    per_label_f1_delta = {
        label: adapted_metrics["perLabel"][label]["f1"] - original_metrics["perLabel"][label]["f1"]
        for label in PRODUCT_18
    }
    supported_deltas = {
        label: delta
        for label, delta in per_label_f1_delta.items()
        if original_metrics["perLabel"][label]["support"] >= 3
    }
    worst_supported_label = min(supported_deltas, key=supported_deltas.get)
    false_positive_increase_per_row = (
        adapted_metrics["falsePositives"]["perRow"] - original_metrics["falsePositives"]["perRow"]
    )
    catastrophic_forgetting = (
        retention_drop > 0.02
        or supported_deltas[worst_supported_label] < -0.10
        or false_positive_increase_per_row > 0.05
    )
    decision = "RETAIN_RESEARCH_CANDIDATE" if adapted_loss < baseline_loss and not catastrophic_forgetting else "REJECT_RESEARCH_CANDIDATE"
    summary = {
        "status": "COMPLETE",
        "decision": decision,
        "decisionScope": "research continuation only; not model promotion",
        "device": "cpu",
        "trainRows": len(train_rows),
        "validationRows": len(validation_rows),
        "trainableParameters": trainable_parameters,
        "totalParameters": sum(parameter.numel() for parameter in mlm.parameters()),
        "trainingLoss": training_loss / examples_seen,
        "heldOutMlm": {
            "baselineLoss": baseline_loss,
            "adaptedLoss": adapted_loss,
            "absoluteChange": adapted_loss - baseline_loss,
            "relativeChange": adapted_loss / baseline_loss - 1,
        },
        "frozenDevelopmentDiagnostic": {
            "goldStatus": "NOT_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD",
            "independentEvaluation": False,
            "before": original_metrics,
            "after": adapted_metrics,
            "microF1Drop": retention_drop,
            "perLabelF1Delta": per_label_f1_delta,
            "worstSupportedLabel": {
                "label": worst_supported_label,
                "f1Delta": supported_deltas[worst_supported_label],
                "minimumSupport": 3,
            },
            "falsePositiveIncreasePerRow": false_positive_increase_per_row,
            "catastrophicForgetting": catastrophic_forgetting,
            "meanAbsoluteProbabilityChange": float(np.abs(adapted_probabilities - original_probabilities).mean()),
            "exactTop2SelectionAgreement": float(np.all(original_selection == adapted_selection, axis=1).mean()),
        },
        "promotionConclusion": "INCONCLUSIVE_NO_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD",
        "frozenEvaluationOpened": False,
        "humanReviewPerformed": False,
        "elapsedSeconds": time.time() - started,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
