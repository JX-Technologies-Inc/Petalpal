#!/usr/bin/env python3
"""Evaluate one fixed intersection selector without training."""

import importlib.util
import json
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
RESTORATION = ALIGNED / "domain-restoration-v1/experiment/epoch-1-checkpoint"
DEV = ALIGNED / "dev.jsonl"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
RESTORATION_DEV = ALIGNED / "domain-restoration-v1/experiment/epoch-1-probabilities.npy"
HIPPO_VALIDATION = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl"
UNEXPECTED_VALIDATION = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl"

spec = importlib.util.spec_from_file_location(
    "shared_run", ALIGNED / "selective-consensus-distillation-v1/run.py"
)
shared = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(shared)
canonical = shared.canonical


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def canonical_outputs(rows: list[dict[str, object]], probabilities: np.ndarray) -> list[list[str]]:
    return canonical.report(rows, probabilities, 0.35)["outputs"]


def intersect_outputs(left: list[list[str]], right: list[list[str]]) -> list[list[str]]:
    return [[label for label in first if label in set(second)] for first, second in zip(left, right)]


def metrics(rows: list[dict[str, object]], outputs: list[list[str]]) -> dict[str, object]:
    truth = [set(row["modelLabels"]) & set(canonical.PRODUCT) for row in rows]
    predicted = [set(output) & set(canonical.PRODUCT) for output in outputs]
    per_label = {}
    total_tp = total_fp = total_fn = 0
    for label in canonical.PRODUCT:
        tp = sum(label in expected and label in output for expected, output in zip(truth, predicted))
        fp = sum(label not in expected and label in output for expected, output in zip(truth, predicted))
        fn = sum(label in expected and label not in output for expected, output in zip(truth, predicted))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_label[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": tp + fn,
            "falsePositive": fp,
            "falseNegative": fn,
        }
        total_tp += tp
        total_fp += fp
        total_fn += fn
    precision = total_tp / (total_tp + total_fp) if total_tp + total_fp else 0.0
    recall = total_tp / (total_tp + total_fn) if total_tp + total_fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    macro = {
        key: sum(values[key] for values in per_label.values()) / len(per_label)
        for key in ("precision", "recall", "f1")
    }
    return {
        "rows": len(rows),
        "micro": {"precision": precision, "recall": recall, "f1": f1},
        "macro": macro,
        "falsePositives": total_fp,
        "falseNegatives": total_fn,
        "outputCountDistribution": {
            str(count): sum(len(output) == count for output in outputs) for count in range(3)
        },
        "perLabel": per_label,
    }


def unlabeled_behavior(incumbent: list[list[str]], candidate: list[list[str]]) -> dict[str, object]:
    rows = len(incumbent)
    incumbent_counts = {str(count): sum(len(output) == count for output in incumbent) for count in range(3)}
    candidate_counts = {str(count): sum(len(output) == count for output in candidate) for count in range(3)}
    return {
        "rows": rows,
        "exactOutputAgreement": sum(left == right for left, right in zip(incumbent, candidate)) / rows,
        "incumbentOutputCountDistribution": incumbent_counts,
        "candidateOutputCountDistribution": candidate_counts,
        "distributionDeltaFraction": {
            key: (candidate_counts[key] - incumbent_counts[key]) / rows for key in ("0", "1", "2")
        },
        "candidatePerLabelPredicted": dict(
            sorted(Counter(label for output in candidate for label in output).items())
        ),
    }


def infer_outputs(checkpoint: Path, rows: list[dict[str, object]], device: torch.device) -> tuple[np.ndarray, list[list[str]]]:
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    positions, _ = shared.model_positions(model)
    model.to(device)
    probabilities = shared.infer(
        model, tokenizer, [str(row["text"]) for row in rows], positions, device
    )
    fake = [{"id": row["id"], "modelLabels": []} for row in rows]
    return probabilities, canonical_outputs(fake, probabilities)


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_ANALYSIS"
    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

    development = read_jsonl(DEV)
    incumbent_dev = np.load(INCUMBENT_DEV)
    restoration_dev = np.load(RESTORATION_DEV)
    incumbent_outputs = canonical_outputs(development, incumbent_dev)
    restoration_outputs = canonical_outputs(development, restoration_dev)
    candidate_outputs = intersect_outputs(incumbent_outputs, restoration_outputs)
    incumbent_metrics = metrics(development, incumbent_outputs)
    restoration_metrics = metrics(development, restoration_outputs)
    candidate_metrics = metrics(development, candidate_outputs)
    assert abs(incumbent_metrics["micro"]["f1"] - 0.528052805280528) < 1e-12

    short_indices = [index for index, row in enumerate(development) if len(str(row["journal"])) <= 300]
    short_rows = [development[index] for index in short_indices]
    incumbent_short = metrics(short_rows, [incumbent_outputs[index] for index in short_indices])
    candidate_short = metrics(short_rows, [candidate_outputs[index] for index in short_indices])

    validation = {}
    for name, path in (("hippocorpus", HIPPO_VALIDATION), ("unexpectedEvents", UNEXPECTED_VALIDATION)):
        rows = read_jsonl(path)
        incumbent_probabilities, first = infer_outputs(INCUMBENT, rows, device)
        restoration_probabilities, second = infer_outputs(RESTORATION, rows, device)
        candidate = intersect_outputs(first, second)
        np.save(HERE / f"{name}-incumbent-probabilities.npy", incumbent_probabilities)
        np.save(HERE / f"{name}-restoration-probabilities.npy", restoration_probabilities)
        validation[name] = unlabeled_behavior(first, candidate)

    supported_deltas = {
        label: candidate_metrics["perLabel"][label]["f1"]
        - incumbent_metrics["perLabel"][label]["f1"]
        for label in canonical.PRODUCT
        if incumbent_metrics["perLabel"][label]["support"] >= 3
    }
    guards = {
        "developmentMicroF1": candidate_metrics["micro"]["f1"]
        >= incumbent_metrics["micro"]["f1"],
        "developmentPrecision": candidate_metrics["micro"]["precision"]
        >= incumbent_metrics["micro"]["precision"],
        "developmentFalsePositives": candidate_metrics["falsePositives"] <= 53,
        "developmentFalseNegatives": candidate_metrics["falseNegatives"] <= 90,
        "supportedLabelRegression": min(supported_deltas.values()) >= -0.05,
        "shortMicroF1": candidate_short["micro"]["f1"] >= incumbent_short["micro"]["f1"] - 0.02,
        "shortFalsePositives": candidate_short["falsePositives"] <= 5,
        "validationAgreement": all(
            result["exactOutputAgreement"] >= 0.85 for result in validation.values()
        ),
        "validationDistribution": all(
            abs(delta) <= 0.08
            for result in validation.values()
            for delta in result["distributionDeltaFraction"].values()
        ),
    }
    retained = all(guards.values())
    result = {
        "status": "PASS",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "promotionStatus": "INCONCLUSIVE",
        "trainingPerformed": False,
        "selector": "fixed intersection of canonical incumbent and domain-restoration outputs",
        "development": {
            "incumbent": incumbent_metrics,
            "domainRestoration": restoration_metrics,
            "candidate": candidate_metrics,
            "supportedPerLabelF1Delta": supported_deltas,
            "shortAtMost300": {
                "incumbent": incumbent_short,
                "candidate": candidate_short,
            },
        },
        "unlabeledValidation": validation,
        "guards": guards,
        "incumbentChanged": False,
        "credibleProductQualityImprovementProven": False,
        "frozenFinalEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"],
        "development": {
            "incumbent": incumbent_metrics,
            "candidate": candidate_metrics,
            "shortIncumbent": incumbent_short,
            "shortCandidate": candidate_short,
        },
        "unlabeledValidation": validation,
        "guards": guards,
    }, indent=2))


if __name__ == "__main__":
    main()
