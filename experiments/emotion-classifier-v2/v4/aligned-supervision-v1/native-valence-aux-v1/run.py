#!/usr/bin/env python3
"""Run one fixed native-valence auxiliary encoder adaptation."""

import importlib.util
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV_PROBS = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
HIPPO_VALIDATION = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl"
UNEXPECTED_VALIDATION = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl"
OUTPUT = HERE / "candidate"
LABELS = ["neg", "neither", "pos"]
LABEL_TO_ID = {label: index for index, label in enumerate(LABELS)}
EPOCHS = 1
LEARNING_RATE = 2e-6
BATCH_SIZE = 16
MAX_LENGTH = 512
SEED = 44

spec = importlib.util.spec_from_file_location(
    "consensus_run", ALIGNED / "selective-consensus-distillation-v1/run.py"
)
shared = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(shared)
canonical = shared.canonical


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


class ValenceDataset(Dataset):
    def __init__(self, rows: list[dict[str, object]], tokenizer):
        self.rows = rows
        self.encoded = tokenizer(
            [str(row["text"]) for row in rows], truncation=True, max_length=MAX_LENGTH
        )

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, object]:
        return {
            **{key: value[index] for key, value in self.encoded.items()},
            "valenceLabel": LABEL_TO_ID[str(self.rows[index]["nativeValence"])],
        }


def collate(tokenizer):
    def make_batch(rows: list[dict[str, object]]) -> dict[str, torch.Tensor]:
        labels = torch.tensor([row["valenceLabel"] for row in rows], dtype=torch.long)
        encoded = tokenizer.pad(
            [{key: value for key, value in row.items() if key != "valenceLabel"} for row in rows],
            padding=True,
            return_tensors="pt",
        )
        return {**encoded, "valenceLabels": labels}

    return make_batch


class ValenceHead(torch.nn.Module):
    def __init__(self, hidden_size: int):
        super().__init__()
        self.dropout = torch.nn.Dropout(0.1)
        self.output = torch.nn.Linear(hidden_size, len(LABELS))

    def forward(self, hidden: torch.Tensor) -> torch.Tensor:
        return self.output(self.dropout(hidden))


@torch.inference_mode()
def predict_valence(model, head, loader, device: torch.device) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    head.eval()
    predictions = []
    expected = []
    for batch in loader:
        expected.extend(batch.pop("valenceLabels").numpy().tolist())
        hidden = model.roberta(**{key: value.to(device) for key, value in batch.items()}).last_hidden_state[:, 0]
        predictions.extend(head(hidden).argmax(dim=1).cpu().numpy().tolist())
    return np.asarray(expected), np.asarray(predictions)


def classification_metrics(expected: np.ndarray, predicted: np.ndarray) -> dict[str, object]:
    per_label = {}
    f1_values = []
    for index, label in enumerate(LABELS):
        tp = int(((expected == index) & (predicted == index)).sum())
        fp = int(((expected != index) & (predicted == index)).sum())
        fn = int(((expected == index) & (predicted != index)).sum())
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        f1_values.append(f1)
        per_label[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": int((expected == index).sum()),
        }
    return {
        "accuracy": float((expected == predicted).mean()),
        "macroF1": sum(f1_values) / len(f1_values),
        "perLabel": per_label,
        "predictionCounts": {
            label: int((predicted == index).sum()) for index, label in enumerate(LABELS)
        },
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite candidate: {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text())
    audit = json.loads((HERE / "data-audit.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_DATA_PREPARATION"
    assert audit["status"] == "PASS" and audit["decision"] == "TRAIN_ONE_FIXED_AUXILIARY_CANDIDATE"
    train = read_jsonl(HERE / "valence-train.jsonl")
    validation = read_jsonl(HERE / "valence-validation.jsonl")
    assert len(train) == 7714 and len(validation) == 406
    assert {row["sourceGroupId"] for row in train}.isdisjoint(
        {row["sourceGroupId"] for row in validation}
    )
    assert all(
        row["labelStatus"] == "NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD"
        and len(str(row["text"])) <= 300
        for row in train + validation
    )

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    positions, _ = shared.model_positions(model)
    original_classifier = {
        name: tensor.detach().cpu().clone() for name, tensor in model.classifier.state_dict().items()
    }

    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable_encoder = []
    for name, parameter in model.named_parameters():
        if ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_encoder.append(parameter)
    assert trainable_encoder
    assert not any(parameter.requires_grad for parameter in model.classifier.parameters())
    valence_head = ValenceHead(model.config.hidden_size)
    model.to(device)
    valence_head.to(device)

    train_loader = DataLoader(
        ValenceDataset(train, tokenizer),
        batch_size=BATCH_SIZE,
        shuffle=True,
        generator=torch.Generator().manual_seed(SEED),
        collate_fn=collate(tokenizer),
    )
    validation_loader = DataLoader(
        ValenceDataset(validation, tokenizer),
        batch_size=32,
        shuffle=False,
        collate_fn=collate(tokenizer),
    )
    counts = np.asarray([sum(row["nativeValence"] == label for row in train) for label in LABELS])
    class_weights = np.sqrt(len(train) / (len(LABELS) * counts))
    weights = torch.tensor(class_weights, dtype=torch.float32, device=device)
    optimizer = torch.optim.AdamW(
        trainable_encoder + list(valence_head.parameters()), lr=LEARNING_RATE, weight_decay=0.01
    )
    steps = len(train_loader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=math.ceil(0.1 * steps), num_training_steps=steps
    )

    started = time.time()
    model.train()
    valence_head.train()
    loss_total = 0.0
    examples = 0
    for batch_index, batch in enumerate(train_loader):
        expected = batch.pop("valenceLabels").to(device)
        hidden = model.roberta(
            **{key: value.to(device) for key, value in batch.items()}
        ).last_hidden_state[:, 0]
        logits = valence_head(hidden)
        loss = torch.nn.functional.cross_entropy(logits, expected, weight=weights)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(trainable_encoder + list(valence_head.parameters()), 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        loss_total += float(loss.detach().cpu()) * len(expected)
        examples += len(expected)
        if (batch_index + 1) % 100 == 0:
            print(
                json.dumps(
                    {
                        "event": "train",
                        "batch": batch_index + 1,
                        "batches": len(train_loader),
                        "elapsedSeconds": time.time() - started,
                    }
                ),
                flush=True,
            )

    classifier_unchanged = all(
        torch.equal(original_classifier[name], tensor.detach().cpu())
        for name, tensor in model.classifier.state_dict().items()
    )
    assert classifier_unchanged
    valence_expected, valence_predicted = predict_valence(
        model, valence_head, validation_loader, device
    )
    valence_metrics = classification_metrics(valence_expected, valence_predicted)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    torch.save(valence_head.state_dict(), OUTPUT / "discarded-valence-head.pt")

    development = read_jsonl(DEV)
    incumbent_dev = np.load(INCUMBENT_DEV_PROBS)
    candidate_dev = shared.infer(
        model, tokenizer, [str(row["journal"]) for row in development], positions, device
    )
    np.save(OUTPUT / "development-probabilities.npy", candidate_dev)
    incumbent_all = shared.report_with_errors(development, incumbent_dev)
    candidate_all = shared.report_with_errors(development, candidate_dev)
    short_indices = [index for index, row in enumerate(development) if len(str(row["journal"])) <= 300]
    incumbent_short = shared.report_with_errors(
        [development[index] for index in short_indices], incumbent_dev[short_indices]
    )
    candidate_short = shared.report_with_errors(
        [development[index] for index in short_indices], candidate_dev[short_indices]
    )

    validation_results = {}
    for name, rows in (
        ("hippocorpus", read_jsonl(HIPPO_VALIDATION)),
        ("unexpectedEvents", read_jsonl(UNEXPECTED_VALIDATION)),
    ):
        texts = [str(row["text"]) for row in rows]
        incumbent_model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
        incumbent_positions, _ = shared.model_positions(incumbent_model)
        incumbent_model.to(device)
        incumbent_probabilities = shared.infer(
            incumbent_model, tokenizer, texts, incumbent_positions, device
        )
        del incumbent_model
        candidate_probabilities = shared.infer(model, tokenizer, texts, positions, device)
        np.save(OUTPUT / f"{name}-incumbent-probabilities.npy", incumbent_probabilities)
        np.save(OUTPUT / f"{name}-candidate-probabilities.npy", candidate_probabilities)
        validation_results[name] = shared.unlabeled_comparison(
            rows, incumbent_probabilities, candidate_probabilities
        )

    supported_regressions = {
        label: candidate_all["perLabel"][label]["f1"] - incumbent_all["perLabel"][label]["f1"]
        for label in canonical.PRODUCT
        if incumbent_all["perLabel"][label]["support"] >= 3
    }
    guards = {
        "auxiliaryValenceMacroF1": valence_metrics["macroF1"] >= 0.65,
        "classifierIntegrity": classifier_unchanged,
        "developmentMicroF1": candidate_all["micro"]["f1"] >= incumbent_all["micro"]["f1"],
        "developmentFalsePositives": candidate_all["falsePositives"] <= 58,
        "developmentFalseNegatives": candidate_all["falseNegatives"] <= 85,
        "supportedLabelRegression": min(supported_regressions.values()) >= -0.05,
        "shortFalsePositives": candidate_short["falsePositives"] <= 5,
        "shortMicroF1": candidate_short["micro"]["f1"] >= incumbent_short["micro"]["f1"] - 0.02,
        "hippocorpusAgreement": validation_results["hippocorpus"]["exactOutputAgreement"] >= 0.85,
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
        "data": {
            "trainRows": len(train),
            "validationRows": len(validation),
            "labelStatus": "NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD",
            "product18MappingPerformed": False,
        },
        "training": {
            "epochs": EPOCHS,
            "learningRate": LEARNING_RATE,
            "batchSize": BATCH_SIZE,
            "maxLength": MAX_LENGTH,
            "classWeights": dict(zip(LABELS, class_weights.tolist())),
            "meanTrainLoss": loss_total / examples,
            "trainableEncoderParameters": sum(parameter.numel() for parameter in trainable_encoder),
            "totalModelParameters": sum(parameter.numel() for parameter in model.parameters()),
            "elapsedSeconds": time.time() - started,
        },
        "auxiliaryValenceValidation": valence_metrics,
        "classifierHeadByteIdentical": classifier_unchanged,
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
        "unlabeledValidation": validation_results,
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
                "auxiliaryValenceValidation": valence_metrics,
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
