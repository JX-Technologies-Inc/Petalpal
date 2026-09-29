#!/usr/bin/env python3
"""Run the single frozen Target-First v1 candidate without Final Test access."""

from __future__ import annotations

import hashlib
import json
import math
import random
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import precision_recall_fscore_support
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
REPO = next(parent for parent in HERE.parents if (parent / "lib/secondary-emotion-selector.js").exists())
EMOTION_ROOT = REPO / "experiments/emotion-classifier-v2"
ACCEPTED = HERE / "accepted"
PLAN = HERE / "official-training-v1/frozen-plan.json"
OUTPUT = HERE / "official-training-v1/run"
CHECKPOINT = EMOTION_ROOT / "v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint"

PRODUCT_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
MODEL_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
P0_PAIRS = [
    ("sadness", "caring"), ("caring", "love"), ("joy", "optimism"),
    ("joy", "excitement"), ("caring", "gratitude"), ("joy", "love"),
    ("fear", "annoyance"),
]
EXPECTED = {
    "train.jsonl": (270, "5dd96ae522c36f5ed907c3b41b1e0728db03aa3ecb37771c2918ef9751d444dd", "TRAIN"),
    "dev.jsonl": (315, "beef087a052bbebbd089561a2194fc7bc7ffc84b675a7a159a0c3abc818b2bbb", "DEV"),
}
SEED = 56
THRESHOLD = 0.35
MAX_LENGTH = 512
BATCH_SIZE = 16
LEARNING_RATE = 1e-6
WEIGHT_DECAY = 0.01
MAX_GRAD_NORM = 1.0
LAMBDA_RANK = 1.0 / 18.0


def read_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_product_labels() -> list[str]:
    config = (REPO / "lib/flower-variant-config.js").resolve().as_uri()
    program = f'''import {{ SECONDARY_EMOTION_LABELS, EXCLUDED_SECONDARY_EMOTIONS }} from {json.dumps(config)};
const excluded = new Set(EXCLUDED_SECONDARY_EMOTIONS);
console.log(JSON.stringify(SECONDARY_EMOTION_LABELS.filter(label => !excluded.has(label))));'''
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", program],
        text=True, capture_output=True, check=True,
    )
    return json.loads(completed.stdout)


def validate_rows(name: str, rows: list[dict], expected_split: str) -> list[str]:
    errors: list[str] = []
    required = {
        "rowId", "targetHash", "attemptId", "eventText", "split", "scenarioFamilyId",
        "supervision", "boundaryPairs", "p0Coverage", "primaryGardenMood",
        "annotationProvenance", "annotationMethod", "qa",
    }
    for index, row in enumerate(rows, start=1):
        prefix = f"{name}:{index}"
        if set(row) != required:
            errors.append(f"{prefix}: accepted schema keys differ")
        if row.get("split") != expected_split:
            errors.append(f"{prefix}: split mismatch")
        if not isinstance(row.get("eventText"), str) or not row["eventText"].strip():
            errors.append(f"{prefix}: empty Event")
        if len(row.get("eventText", "")) > 300:
            errors.append(f"{prefix}: Event exceeds 300 Unicode characters")
        if row.get("primaryGardenMood", "missing") is not None:
            errors.append(f"{prefix}: Primary must be null")
        if row.get("annotationProvenance") != "SYNTHETIC_WEAK_SUPERVISION":
            errors.append(f"{prefix}: provenance mismatch")
        if row.get("annotationMethod") != "SEMANTIC_TARGET_THEN_GENERATE":
            errors.append(f"{prefix}: annotation method mismatch")
        if row.get("qa") != {"decision": "PASS", "mayEditSupervision": False, "mayEditEvent": False}:
            errors.append(f"{prefix}: QA linkage mismatch")
        supervision = row.get("supervision", {})
        if set(supervision) != {"selected", "plausibleNotSelected", "notApplicable"}:
            errors.append(f"{prefix}: supervision schema mismatch")
            continue
        parts = [set(supervision[key]) for key in ("selected", "plausibleNotSelected", "notApplicable")]
        if len(parts[0]) > 2 or any(parts[a] & parts[b] for a in range(3) for b in range(a)):
            errors.append(f"{prefix}: invalid supervision partition")
        if set().union(*parts) != set(PRODUCT_LABELS):
            errors.append(f"{prefix}: supervision does not cover Product-18")
        expected_pairs = {(s, p) for s in supervision["selected"] for p in supervision["plausibleNotSelected"]}
        actual_pairs = {(p["selectedLabel"], p["plausibleLabel"]) for p in row.get("boundaryPairs", [])}
        if expected_pairs != actual_pairs:
            errors.append(f"{prefix}: boundary-pair linkage mismatch")
    return errors


def readiness_audit(model) -> tuple[dict, list[dict], list[dict]]:
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    if plan.get("status") != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Official plan was not frozen before training")
    datasets: dict[str, list[dict]] = {}
    errors: list[str] = []
    hashes: dict[str, str] = {}
    for name, (count, digest, split) in EXPECTED.items():
        path = ACCEPTED / name
        hashes[name] = sha256(path)
        rows = read_rows(path)
        datasets[name] = rows
        if len(rows) != count:
            errors.append(f"{name}: expected {count} rows, found {len(rows)}")
        if hashes[name] != digest:
            errors.append(f"{name}: artifact changed after freeze")
        errors.extend(validate_rows(name, rows, split))

    train, dev = datasets["train.jsonl"], datasets["dev.jsonl"]
    for field in ("rowId", "attemptId", "scenarioFamilyId", "eventText"):
        left = {row[field] for row in train}
        right = {row[field] for row in dev}
        if len(left) != len(train) or len(right) != len(dev) or left & right:
            errors.append(f"Train/Dev {field} uniqueness or isolation failure")

    dev_support = Counter(label for row in dev for label in row["supervision"]["selected"])
    unsupported = [label for label in PRODUCT_LABELS if dev_support[label] < 15]
    if unsupported:
        errors.append(f"Dev selected-label support below 15: {unsupported}")
    direction_support = Counter(
        (selected, plausible)
        for row in dev
        for selected in row["supervision"]["selected"]
        for plausible in row["supervision"]["plausibleNotSelected"]
    )
    low_directions = [
        f"{a}>{b}" for a, b in P0_PAIRS for a, b in ((a, b), (b, a))
        if direction_support[(a, b)] < 8
    ]
    if low_directions:
        errors.append(f"Dev P0 direction support below 8: {low_directions}")
    if not any(not row["supervision"]["selected"] for row in dev):
        errors.append("Dev has no true-empty rows")

    model_id2label = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    missing = [label for label in MODEL_LABELS if label not in model_id2label.values()]
    if model.config.num_labels != 28 or missing:
        errors.append(f"Base checkpoint label mapping incompatible: missing={missing}")
    canonical = canonical_product_labels()
    if canonical != PRODUCT_LABELS:
        errors.append("Product-18 label order differs from canonical application order")

    audit = {
        "status": "PASS" if not errors else "BLOCKED",
        "errors": errors,
        "trainRows": len(train),
        "devRows": len(dev),
        "hashes": hashes,
        "productLabels": PRODUCT_LABELS,
        "devSelectedSupport": {label: dev_support[label] for label in PRODUCT_LABELS},
        "devP0DirectionSupport": {
            f"{a}>{b}": direction_support[(a, b)]
            for pair in P0_PAIRS for a, b in (pair, pair[::-1])
        },
        "trueEmptyDevRows": sum(not row["supervision"]["selected"] for row in dev),
        "acceptedLinkageScope": "accepted-row target/attempt identifiers, PASS QA marker, supervision partition, and boundary Cartesian product",
        "upstreamAuthoritativeGates": {
            "splitIsolation": "PASS",
            "provenanceLinkage": "PASS",
            "validatorIntegrity": "PASS"
        },
    }
    return audit, train, dev


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(True)


def positions(model, labels: list[str]) -> list[int]:
    id2label = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    return [next(index for index, value in id2label.items() if value == label) for label in labels]


class SelectiveDataset(Dataset):
    def __init__(self, rows: list[dict], tokenizer):
        self.rows = rows
        self.encodings = tokenizer(
            [row["eventText"] for row in rows], truncation=True, max_length=MAX_LENGTH,
        )

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict:
        supervision = self.rows[index]["supervision"]
        selected = [PRODUCT_LABELS.index(label) for label in supervision["selected"]]
        plausible = [PRODUCT_LABELS.index(label) for label in supervision["plausibleNotSelected"]]
        targets = [float(label in supervision["selected"]) for label in PRODUCT_LABELS]
        mask = [float(label not in supervision["plausibleNotSelected"]) for label in PRODUCT_LABELS]
        return {
            "encoding": {key: values[index] for key, values in self.encodings.items()},
            "targets": targets,
            "mask": mask,
            "selected": selected,
            "plausible": plausible,
        }


def collate(tokenizer):
    def function(items: list[dict]) -> dict:
        encoded = tokenizer.pad([item["encoding"] for item in items], padding=True, return_tensors="pt")
        return {
            "encoded": encoded,
            "targets": torch.tensor([item["targets"] for item in items], dtype=torch.float32),
            "mask": torch.tensor([item["mask"] for item in items], dtype=torch.float32),
            "selected": [item["selected"] for item in items],
            "plausible": [item["plausible"] for item in items],
        }
    return function


def configure_trainable(model) -> dict:
    for parameter in model.parameters():
        parameter.requires_grad = False
    for name, parameter in model.named_parameters():
        if name.startswith("classifier.") or name.startswith("roberta.encoder.layer.10.") or name.startswith("roberta.encoder.layer.11."):
            parameter.requires_grad = True
    names = [name for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not names or any(
        not (name.startswith("classifier.") or name.startswith("roberta.encoder.layer.10.") or name.startswith("roberta.encoder.layer.11."))
        for name in names
    ):
        raise AssertionError("Trainable parameter freeze policy failed")
    return {
        "parameterTensors": len(names),
        "parameters": sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad),
        "scope": ["classifier", "roberta.encoder.layer.10", "roberta.encoder.layer.11"],
    }


def make_optimizer(model):
    return torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY,
    )


def row_loss(logits: torch.Tensor, batch: dict) -> tuple[torch.Tensor, float, float]:
    targets = batch["targets"].to(logits.device)
    mask = batch["mask"].to(logits.device)
    cell_loss = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
    bce_rows = (cell_loss * mask).sum(dim=1) / mask.sum(dim=1)
    rank_rows = []
    for row_logits, selected, plausible in zip(logits, batch["selected"], batch["plausible"]):
        if selected and plausible:
            selected_logits = row_logits[torch.tensor(selected, device=logits.device)]
            plausible_logits = row_logits[torch.tensor(plausible, device=logits.device)]
            rank_rows.append(F.softplus(plausible_logits[:, None] - selected_logits[None, :]).mean())
        else:
            rank_rows.append(row_logits.sum() * 0.0)
    rank_rows_tensor = torch.stack(rank_rows)
    loss = (bce_rows + LAMBDA_RANK * rank_rows_tensor).mean()
    return loss, float(bce_rows.mean().detach()), float(rank_rows_tensor.mean().detach())


@torch.inference_mode()
def infer(model, loader, model_positions: list[int], device: torch.device) -> np.ndarray:
    model.eval()
    outputs = []
    for batch in loader:
        encoded = {key: value.to(device) for key, value in batch["encoded"].items()}
        logits = model(**encoded).logits[:, model_positions]
        outputs.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(outputs)


def select_outputs(probabilities: np.ndarray, rows: list[dict]) -> list[list[str]]:
    annotations = [
        {
            "id": row["rowId"], "primaryGardenMood": None,
            "expected": row["supervision"]["selected"], "acceptable": [],
            "clearlyWrong": [], "redundant": [],
            "preferNone": not row["supervision"]["selected"],
            "min": int(bool(row["supervision"]["selected"])),
            "max": len(row["supervision"]["selected"]),
        }
        for row in rows
    ]
    payload = [
        {
            "primaryGardenMood": annotation["primaryGardenMood"],
            "candidates": [
                {"label": label, "score": float(probability[index])}
                for index, label in enumerate(MODEL_LABELS)
                if probability[index] >= THRESHOLD
            ],
        }
        for probability, annotation in zip(probabilities, annotations)
    ]
    selector = (REPO / "lib/secondary-emotion-selector.js").resolve().as_uri()
    program = f'''import {{ selectFlowerSecondaryEmotions }} from {json.dumps(selector)};
const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
const rows = JSON.parse(chunks.join(""));
console.log(JSON.stringify(rows.map(row => selectFlowerSecondaryEmotions(row).map(item => item.label))));'''
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", program], input=json.dumps(payload),
        text=True, capture_output=True, check=True,
    )
    return json.loads(completed.stdout)


def metric_report(truth: np.ndarray, predicted: np.ndarray) -> dict:
    result = {}
    for average in ("macro", "micro"):
        precision, recall, f1, _ = precision_recall_fscore_support(
            truth, predicted, average=average, zero_division=0,
        )
        result[average] = {"precision": float(precision), "recall": float(recall), "f1": float(f1)}
    precision, recall, f1, support = precision_recall_fscore_support(
        truth, predicted, average=None, zero_division=0,
    )
    result["perLabel"] = {
        label: {
            "precision": float(precision[index]), "recall": float(recall[index]),
            "f1": float(f1[index]), "support": int(support[index]),
        }
        for index, label in enumerate(PRODUCT_LABELS)
    }
    return result


def evaluate(rows: list[dict], probabilities: np.ndarray) -> dict:
    outputs = select_outputs(probabilities, rows)
    truth = np.asarray([
        [int(label in row["supervision"]["selected"]) for label in PRODUCT_LABELS]
        for row in rows
    ], dtype=np.int8)
    predicted = np.asarray([
        [int(label in output) for label in PRODUCT_LABELS] for output in outputs
    ], dtype=np.int8)
    tp = int((truth & predicted).sum())
    fp = int(((1 - truth) & predicted).sum())
    fn = int((truth & (1 - predicted)).sum())
    empty_truth = truth.sum(axis=1) == 0
    empty_pred = predicted.sum(axis=1) == 0
    exact = np.all(truth == predicted, axis=1)
    plausible_fp = not_applicable_fp = 0
    for row, output in zip(rows, outputs):
        selected = set(row["supervision"]["selected"])
        plausible = set(row["supervision"]["plausibleNotSelected"])
        not_applicable = set(row["supervision"]["notApplicable"])
        plausible_fp += len((set(output) - selected) & plausible)
        not_applicable_fp += len((set(output) - selected) & not_applicable)

    product_indices = [MODEL_LABELS.index(label) for label in PRODUCT_LABELS]
    product_scores = probabilities[:, product_indices]
    direction: dict[str, dict] = {}
    pair_rows_all_ranked = []
    for row_index, (row, output) in enumerate(zip(rows, outputs)):
        selected = row["supervision"]["selected"]
        plausible = row["supervision"]["plausibleNotSelected"]
        if selected and plausible:
            pair_rows_all_ranked.append(all(
                product_scores[row_index, PRODUCT_LABELS.index(s)] > product_scores[row_index, PRODUCT_LABELS.index(p)]
                for s in selected for p in plausible
            ))
        for s in selected:
            for p in plausible:
                if (s, p) not in [direction_pair for pair in P0_PAIRS for direction_pair in (pair, pair[::-1])]:
                    continue
                key = f"{s}>{p}"
                record = direction.setdefault(key, {"support": 0, "selectionHits": 0, "rankingHits": 0})
                record["support"] += 1
                record["selectionHits"] += int(s in output and p not in output)
                record["rankingHits"] += int(
                    product_scores[row_index, PRODUCT_LABELS.index(s)] > product_scores[row_index, PRODUCT_LABELS.index(p)]
                )
    ordered_directions = [direction_pair for pair in P0_PAIRS for direction_pair in (pair, pair[::-1])]
    for s, p in ordered_directions:
        key = f"{s}>{p}"
        record = direction.setdefault(key, {"support": 0, "selectionHits": 0, "rankingHits": 0})
        support = record["support"]
        record["selectionAccuracy"] = record["selectionHits"] / support if support else None
        record["rawRankingAccuracy"] = record["rankingHits"] / support if support else None
        record["supported"] = support >= 8
    pair_summary = {}
    for first, second in P0_PAIRS:
        forward, reverse = direction[f"{first}>{second}"], direction[f"{second}>{first}"]
        pair_summary[f"{first}|{second}"] = {
            "selectionAccuracy": (forward["selectionAccuracy"] + reverse["selectionAccuracy"]) / 2,
            "rawRankingAccuracy": (forward["rawRankingAccuracy"] + reverse["rawRankingAccuracy"]) / 2,
        }
    metrics = metric_report(truth, predicted)
    return {
        "threshold": THRESHOLD,
        "maxOutputLabels": 2,
        "metrics": metrics,
        "counts": {"tp": tp, "fp": fp, "fn": fn},
        "exactSetAccuracy": float(exact.mean()),
        "outputCardinality": {str(i): int((predicted.sum(axis=1) == i).sum()) for i in (0, 1, 2)},
        "meanLabelsPerRow": float(predicted.sum(axis=1).mean()),
        "referenceMeanLabelsPerRow": float(truth.sum(axis=1).mean()),
        "emptyOutputRate": float(empty_pred.mean()),
        "correctAbstentionRate": float((empty_pred & empty_truth).sum() / empty_truth.sum()),
        "unwantedAbstentionCount": int((empty_pred & ~empty_truth).sum()),
        "falsePositiveState": {"plausibleNotSelected": plausible_fp, "notApplicable": not_applicable_fp},
        "p0": {
            "directions": direction,
            "pairs": pair_summary,
            "macroDirectionalSelectionAccuracy": float(np.mean([direction[f"{s}>{p}"]["selectionAccuracy"] for s, p in ordered_directions])),
            "macroRawRankingAccuracy": float(np.mean([direction[f"{s}>{p}"]["rawRankingAccuracy"] for s, p in ordered_directions])),
            "allSelectedAboveAllPlausibleRate": float(np.mean(pair_rows_all_ranked)),
            "pairBearingRows": len(pair_rows_all_ranked),
        },
        "outputs": outputs,
    }


def decide(incumbent: dict, candidate: dict, rows: int) -> dict:
    im, cm = incumbent["metrics"], candidate["metrics"]
    supported = [label for label in PRODUCT_LABELS if im["perLabel"][label]["support"] >= 15]
    label_deltas = {
        label: cm["perLabel"][label]["f1"] - im["perLabel"][label]["f1"]
        for label in supported
    }
    incumbent_supported_macro = float(np.mean([im["perLabel"][label]["f1"] for label in supported]))
    candidate_supported_macro = float(np.mean([cm["perLabel"][label]["f1"] for label in supported]))
    pair_deltas = {
        pair: candidate["p0"]["pairs"][pair]["selectionAccuracy"] - incumbent["p0"]["pairs"][pair]["selectionAccuracy"]
        for pair in incumbent["p0"]["pairs"]
    }
    reduced_fp_fn = (
        candidate["counts"]["fp"] < incumbent["counts"]["fp"]
        and candidate["counts"]["fn"] < incumbent["counts"]["fn"]
    )
    cardinality_within = (
        abs(candidate["meanLabelsPerRow"] - candidate["referenceMeanLabelsPerRow"]) <= 0.15
        and abs(candidate["meanLabelsPerRow"] - incumbent["meanLabelsPerRow"]) <= 0.15
    )
    checks = {
        "macroF1": cm["macro"]["f1"] >= im["macro"]["f1"] + 0.020,
        "microPreservation": cm["micro"]["f1"] >= im["micro"]["f1"] - 0.005,
        "falsePositiveControl": candidate["counts"]["fp"] <= incumbent["counts"]["fp"] + max(3, math.ceil(0.01 * rows)),
        "exactSet": candidate["exactSetAccuracy"] >= incumbent["exactSetAccuracy"],
        "abstentionBehavior": (
            candidate["unwantedAbstentionCount"] <= incumbent["unwantedAbstentionCount"]
            and candidate["emptyOutputRate"] <= incumbent["emptyOutputRate"] + 0.030
            and candidate["correctAbstentionRate"] >= incumbent["correctAbstentionRate"] - 0.020
        ),
        "supportedLabelGuard": (
            all(delta >= -0.050 for delta in label_deltas.values())
            and sum(delta < -0.020 for delta in label_deltas.values()) <= 2
            and candidate_supported_macro >= incumbent_supported_macro
        ),
        "p0BoundaryImprovement": (
            candidate["p0"]["macroDirectionalSelectionAccuracy"] >= incumbent["p0"]["macroDirectionalSelectionAccuracy"] + 0.080
            and sum(delta > 0 for delta in pair_deltas.values()) >= 5
            and all(delta >= -0.050 for delta in pair_deltas.values())
        ),
        "rankingMechanism": candidate["p0"]["macroRawRankingAccuracy"] >= incumbent["p0"]["macroRawRankingAccuracy"] + 0.050,
        "cardinality": cardinality_within or reduced_fp_fn,
    }
    return {
        "status": "PASS_DEV" if all(checks.values()) else "REJECT_DEV",
        "checks": checks,
        "supportedLabels": supported,
        "supportedLabelMacroF1": {"incumbent": incumbent_supported_macro, "candidate": candidate_supported_macro},
        "supportedLabelF1Deltas": label_deltas,
        "p0PairSelectionDeltas": pair_deltas,
    }


def main() -> None:
    if OUTPUT.exists():
        raise ValueError(f"Refusing to overwrite official run: {OUTPUT}")
    torch.set_num_threads(4)
    set_seed(SEED)
    tokenizer = AutoTokenizer.from_pretrained(CHECKPOINT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(CHECKPOINT, local_files_only=True)
    audit, train_rows, dev_rows = readiness_audit(model)
    if audit["status"] != "PASS":
        print(json.dumps({"readiness": audit}, indent=2))
        raise SystemExit(2)

    OUTPUT.mkdir(parents=True)
    (OUTPUT / "readiness-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device)
    product_positions = positions(model, PRODUCT_LABELS)
    model_positions = positions(model, MODEL_LABELS)
    trainable = configure_trainable(model)
    train_data = SelectiveDataset(train_rows, tokenizer)
    dev_data = SelectiveDataset(dev_rows, tokenizer)
    generator = torch.Generator().manual_seed(SEED)
    train_loader = DataLoader(
        train_data, batch_size=BATCH_SIZE, shuffle=True, generator=generator,
        collate_fn=collate(tokenizer), num_workers=0,
    )
    dev_loader = DataLoader(
        dev_data, batch_size=BATCH_SIZE, shuffle=False,
        collate_fn=collate(tokenizer), num_workers=0,
    )

    start = time.time()
    incumbent_probabilities = infer(model, dev_loader, model_positions, device)
    np.save(OUTPUT / "incumbent-dev-probabilities.npy", incumbent_probabilities)
    incumbent = evaluate(dev_rows, incumbent_probabilities)
    print(json.dumps({
        "event": "incumbent_evaluated", "macroF1": incumbent["metrics"]["macro"]["f1"],
        "microF1": incumbent["metrics"]["micro"]["f1"], "elapsedSeconds": time.time() - start,
    }), flush=True)

    optimizer = make_optimizer(model)
    model.train()
    total_loss = total_bce = total_rank = 0.0
    processed = 0
    for batch_index, batch in enumerate(train_loader, start=1):
        optimizer.zero_grad(set_to_none=True)
        encoded = {key: value.to(device) for key, value in batch["encoded"].items()}
        logits = model(**encoded).logits[:, product_positions]
        loss, bce, rank = row_loss(logits, batch)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            [parameter for parameter in model.parameters() if parameter.requires_grad], MAX_GRAD_NORM,
        )
        optimizer.step()
        count = len(batch["selected"])
        total_loss += float(loss.detach()) * count
        total_bce += bce * count
        total_rank += rank * count
        processed += count
        print(json.dumps({
            "event": "train", "batch": batch_index, "batches": len(train_loader),
            "rows": processed, "loss": float(loss.detach()), "elapsedSeconds": time.time() - start,
        }), flush=True)

    checkpoint_dir = OUTPUT / "final-checkpoint"
    model.save_pretrained(checkpoint_dir)
    tokenizer.save_pretrained(checkpoint_dir)
    candidate_probabilities = infer(model, dev_loader, model_positions, device)
    np.save(OUTPUT / "candidate-dev-probabilities.npy", candidate_probabilities)
    candidate = evaluate(dev_rows, candidate_probabilities)
    decision = decide(incumbent, candidate, len(dev_rows))
    summary = {
        "status": "COMPLETE",
        "finalStatus": decision["status"],
        "recommendation": "KEEP_CANDIDATE" if decision["status"] == "PASS_DEV" else "REJECT_CANDIDATE",
        "readiness": audit,
        "finalAccessed": False,
        "model": {
            "baseCheckpoint": str(CHECKPOINT), "device": str(device),
            "trainable": trainable, "finalCheckpoint": str(checkpoint_dir),
        },
        "frozenConfig": json.loads(PLAN.read_text(encoding="utf-8")),
        "training": {
            "rows": processed, "epochs": 1,
            "meanLoss": total_loss / processed, "meanMaskedBce": total_bce / processed,
            "meanUnweightedRankingLoss": total_rank / processed,
            "elapsedSeconds": time.time() - start,
        },
        "incumbent": incumbent,
        "candidate": candidate,
        "comparison": {
            "macroF1Delta": candidate["metrics"]["macro"]["f1"] - incumbent["metrics"]["macro"]["f1"],
            "microF1Delta": candidate["metrics"]["micro"]["f1"] - incumbent["metrics"]["micro"]["f1"],
            "p0SelectionMacroDelta": candidate["p0"]["macroDirectionalSelectionAccuracy"] - incumbent["p0"]["macroDirectionalSelectionAccuracy"],
            "p0RawRankingMacroDelta": candidate["p0"]["macroRawRankingAccuracy"] - incumbent["p0"]["macroRawRankingAccuracy"],
        },
        "devDecision": decision,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "event": "complete", "status": summary["finalStatus"],
        "recommendation": summary["recommendation"],
        "candidateMacroF1": candidate["metrics"]["macro"]["f1"],
        "candidateMicroF1": candidate["metrics"]["micro"]["f1"],
        "elapsedSeconds": summary["training"]["elapsedSeconds"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
