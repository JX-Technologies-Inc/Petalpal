#!/usr/bin/env python3
"""Run the single locked selective-consensus research candidate."""

import importlib.util
import json
import math
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
WEAK_TRAIN = HERE / "weak-train.jsonl"
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV_PROBS = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
HIPPO_TRAIN = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl"
HIPPO_VALIDATION = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl"
UNEXPECTED_TRAIN = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/train.jsonl"
UNEXPECTED_VALIDATION = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl"
OUTPUT = HERE / "candidate"
EPOCHS = 1
LEARNING_RATE = 2e-6
BATCH_SIZE = 8
ACCUMULATION = 2
MAX_LENGTH = 512
SEED = 44

spec = importlib.util.spec_from_file_location(
    "canonical_experiment", ALIGNED.parents[1] / "v4/auto-v1/experiment.py"
)
canonical = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(canonical)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


class WeakDataset(Dataset):
    def __init__(self, rows: list[dict[str, object]], tokenizer, label_positions: dict[str, int]):
        self.rows = rows
        self.encoded = tokenizer(
            [str(row["text"]) for row in rows], truncation=True, max_length=MAX_LENGTH
        )
        self.targets = []
        self.masks = []
        for row in rows:
            positive = set(row["weakLabels"])
            negative = set(row["strongNegativeLabels"])
            targets = [0.0] * len(canonical.LABELS)
            masks = [0.0] * len(canonical.LABELS)
            for label in positive:
                targets[label_positions[label]] = 1.0
                masks[label_positions[label]] = 1.0
            for label in negative:
                masks[label_positions[label]] = 1.0
            self.targets.append(targets)
            self.masks.append(masks)

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, object]:
        return {
            **{key: value[index] for key, value in self.encoded.items()},
            "targets": self.targets[index],
            "mask": self.masks[index],
        }


def collate(tokenizer):
    def make_batch(rows: list[dict[str, object]]) -> dict[str, torch.Tensor]:
        targets = torch.tensor([row["targets"] for row in rows], dtype=torch.float32)
        masks = torch.tensor([row["mask"] for row in rows], dtype=torch.float32)
        encoded = tokenizer.pad(
            [{key: value for key, value in row.items() if key not in {"targets", "mask"}} for row in rows],
            padding=True,
            return_tensors="pt",
        )
        return {**encoded, "targets": targets, "mask": masks}

    return make_batch


def model_positions(model) -> tuple[list[int], dict[str, int]]:
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    return positions, {label: index for index, label in enumerate(canonical.LABELS)}


@torch.inference_mode()
def infer(model, tokenizer, texts: list[str], positions: list[int], device: torch.device) -> np.ndarray:
    model.eval()
    outputs = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start : start + 32],
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        outputs.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(outputs)


def report_with_errors(rows: list[dict[str, object]], probabilities: np.ndarray) -> dict[str, object]:
    report = canonical.report(rows, probabilities, 0.35)
    truth = [set(row["modelLabels"]) & set(canonical.PRODUCT) for row in rows]
    predicted = [set(output) & set(canonical.PRODUCT) for output in report["outputs"]]
    false_positives = sum(len(output - expected) for output, expected in zip(predicted, truth))
    false_negatives = sum(len(expected - output) for output, expected in zip(predicted, truth))
    return {
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "outputCountDistribution": report["product"]["outputCountDistribution"],
        "falsePositives": false_positives,
        "falseNegatives": false_negatives,
        "outputs": report["outputs"],
    }


def unlabeled_comparison(
    rows: list[dict[str, object]], incumbent: np.ndarray, candidate: np.ndarray
) -> dict[str, object]:
    fake_rows = [{"id": row["id"], "modelLabels": []} for row in rows]
    incumbent_report = canonical.report(fake_rows, incumbent, 0.35)
    candidate_report = canonical.report(fake_rows, candidate, 0.35)
    incumbent_outputs = incumbent_report["outputs"]
    candidate_outputs = candidate_report["outputs"]
    incumbent_counts = incumbent_report["product"]["outputCountDistribution"]
    candidate_counts = candidate_report["product"]["outputCountDistribution"]
    distribution_deltas = {
        key: (candidate_counts[key] - incumbent_counts[key]) / len(rows) for key in ("0", "1", "2")
    }
    return {
        "rows": len(rows),
        "exactOutputAgreement": sum(
            left == right for left, right in zip(incumbent_outputs, candidate_outputs)
        )
        / len(rows),
        "incumbentOutputCountDistribution": incumbent_counts,
        "candidateOutputCountDistribution": candidate_counts,
        "distributionDeltaFraction": distribution_deltas,
        "candidatePerLabelPredicted": dict(
            sorted(Counter(label for output in candidate_outputs for label in output).items())
        ),
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite candidate: {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text())
    audit = json.loads((HERE / "feasibility-audit.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_FEASIBILITY_INFERENCE"
    assert audit["status"] == "PASS" and audit["decision"] == "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE"
    weak_rows = read_jsonl(WEAK_TRAIN)
    assert len(weak_rows) == audit["eligibility"]["rows"] == 2416
    assert all(
        row["labelStatus"] == "WEAK_PSEUDO_NOT_HUMAN_GOLD" and len(str(row["text"])) <= 300
        for row in weak_rows
    )

    hippo_train_groups = {row["sourceGroupId"] for row in read_jsonl(HIPPO_TRAIN)}
    hippo_validation = read_jsonl(HIPPO_VALIDATION)
    unexpected_train_groups = {row["sourceGroupId"] for row in read_jsonl(UNEXPECTED_TRAIN)}
    unexpected_validation = read_jsonl(UNEXPECTED_VALIDATION)
    assert hippo_train_groups.isdisjoint({row["sourceGroupId"] for row in hippo_validation})
    assert unexpected_train_groups.isdisjoint({row["sourceGroupId"] for row in unexpected_validation})

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    positions, label_positions = model_positions(model)

    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable_names = []
    for name, parameter in model.named_parameters():
        if name.startswith("classifier.") or ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_names.append(name)
    assert any(name.startswith("classifier.") for name in trainable_names)
    assert any(".encoder.layer.10." in name for name in trainable_names)
    assert any(".encoder.layer.11." in name for name in trainable_names)
    model.to(device)

    dataset = WeakDataset(weak_rows, tokenizer, label_positions)
    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        generator=torch.Generator().manual_seed(SEED),
        collate_fn=collate(tokenizer),
    )
    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=LEARNING_RATE,
        weight_decay=0.01,
    )
    update_steps = math.ceil(len(loader) / ACCUMULATION) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=math.ceil(0.1 * update_steps), num_training_steps=update_steps
    )

    started = time.time()
    model.train()
    optimizer.zero_grad(set_to_none=True)
    loss_sum = 0.0
    supervised_cells = 0.0
    for batch_index, batch in enumerate(loader):
        targets = batch.pop("targets").to(device)
        mask = batch.pop("mask").to(device)
        logits = model(**{key: value.to(device) for key, value in batch.items()}).logits[:, positions]
        raw = torch.nn.functional.binary_cross_entropy_with_logits(logits, targets, reduction="none")
        loss = (raw * mask).sum() / mask.sum().clamp_min(1.0)
        (loss / ACCUMULATION).backward()
        loss_sum += float((raw * mask).sum().detach().cpu())
        supervised_cells += float(mask.sum().detach().cpu())
        if (batch_index + 1) % ACCUMULATION == 0 or batch_index + 1 == len(loader):
            torch.nn.utils.clip_grad_norm_(
                [parameter for parameter in model.parameters() if parameter.requires_grad], 1.0
            )
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
        if (batch_index + 1) % 50 == 0:
            print(
                json.dumps(
                    {
                        "event": "train",
                        "batch": batch_index + 1,
                        "batches": len(loader),
                        "elapsedSeconds": time.time() - started,
                    }
                ),
                flush=True,
            )

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")

    development = read_jsonl(DEV)
    incumbent_dev = np.load(INCUMBENT_DEV_PROBS)
    candidate_dev = infer(model, tokenizer, [str(row["journal"]) for row in development], positions, device)
    np.save(OUTPUT / "development-probabilities.npy", candidate_dev)
    incumbent_all = report_with_errors(development, incumbent_dev)
    candidate_all = report_with_errors(development, candidate_dev)
    short_indices = [index for index, row in enumerate(development) if len(str(row["journal"])) <= 300]
    incumbent_short = report_with_errors(
        [development[index] for index in short_indices], incumbent_dev[short_indices]
    )
    candidate_short = report_with_errors(
        [development[index] for index in short_indices], candidate_dev[short_indices]
    )

    validation_results = {}
    for name, rows in (("hippocorpus", hippo_validation), ("unexpectedEvents", unexpected_validation)):
        texts = [str(row["text"]) for row in rows]
        incumbent_model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
        incumbent_positions, _ = model_positions(incumbent_model)
        incumbent_model.to(device)
        incumbent_probabilities = infer(
            incumbent_model, tokenizer, texts, incumbent_positions, device
        )
        del incumbent_model
        candidate_probabilities = infer(model, tokenizer, texts, positions, device)
        np.save(OUTPUT / f"{name}-incumbent-probabilities.npy", incumbent_probabilities)
        np.save(OUTPUT / f"{name}-candidate-probabilities.npy", candidate_probabilities)
        validation_results[name] = unlabeled_comparison(
            rows, incumbent_probabilities, candidate_probabilities
        )

    supported_regressions = {
        label: candidate_all["perLabel"][label]["f1"] - incumbent_all["perLabel"][label]["f1"]
        for label in canonical.PRODUCT
        if incumbent_all["perLabel"][label]["support"] >= 3
    }
    guards = {
        "developmentMicroF1": candidate_all["micro"]["f1"] >= incumbent_all["micro"]["f1"],
        "developmentFalsePositives": candidate_all["falsePositives"] <= 58,
        "developmentFalseNegatives": candidate_all["falseNegatives"] <= 85,
        "supportedLabelRegression": min(supported_regressions.values()) >= -0.05,
        "shortFalsePositives": candidate_short["falsePositives"] <= 5,
        "shortMicroF1": candidate_short["micro"]["f1"] >= incumbent_short["micro"]["f1"] - 0.02,
        "validationAgreement": all(
            result["exactOutputAgreement"] >= 0.85 for result in validation_results.values()
        ),
        "validationDistribution": all(
            abs(delta) <= 0.08
            for result in validation_results.values()
            for delta in result["distributionDeltaFraction"].values()
        ),
    }
    retained = all(guards.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "promotionStatus": "INCONCLUSIVE",
        "researchOnly": True,
        "training": {
            "rows": len(weak_rows),
            "labelStatus": "WEAK_PSEUDO_NOT_HUMAN_GOLD",
            "epochs": EPOCHS,
            "learningRate": LEARNING_RATE,
            "batchSize": BATCH_SIZE,
            "gradientAccumulation": ACCUMULATION,
            "maxLength": MAX_LENGTH,
            "trainableParameters": sum(
                parameter.numel() for parameter in model.parameters() if parameter.requires_grad
            ),
            "totalParameters": sum(parameter.numel() for parameter in model.parameters()),
            "meanMaskedBce": loss_sum / supervised_cells,
            "elapsedSeconds": time.time() - started,
        },
        "development": {
            "role": "HISTORICAL_DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_PROMOTION_GOLD",
            "incumbent": {key: value for key, value in incumbent_all.items() if key != "outputs"},
            "candidate": {key: value for key, value in candidate_all.items() if key != "outputs"},
            "supportedPerLabelF1Delta": supported_regressions,
            "shortAtMost300": {
                "rows": len(short_indices),
                "incumbent": {key: value for key, value in incumbent_short.items() if key != "outputs"},
                "candidate": {key: value for key, value in candidate_short.items() if key != "outputs"},
            },
        },
        "untouchedUntilCandidateUnlabeledValidation": validation_results,
        "guards": guards,
        "credibleProductQualityImprovementProven": False,
        "incumbentChanged": False,
        "frozenFinalEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "decision": result["decision"],
                "promotionStatus": result["promotionStatus"],
                "training": result["training"],
                "development": {
                    "incumbentMicro": incumbent_all["micro"],
                    "candidateMicro": candidate_all["micro"],
                    "incumbentFPFN": [incumbent_all["falsePositives"], incumbent_all["falseNegatives"]],
                    "candidateFPFN": [candidate_all["falsePositives"], candidate_all["falseNegatives"]],
                    "incumbentOutputCounts": incumbent_all["outputCountDistribution"],
                    "candidateOutputCounts": candidate_all["outputCountDistribution"],
                },
                "validation": validation_results,
                "guards": guards,
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
