#!/usr/bin/env python3
"""Quantify short-Event mismatch without training or changing model selection."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1" / "experiment" / "epoch-1-checkpoint"
INCUMBENT_PROBABILITIES = ALIGNED / "goemotions-targeted-v1" / "experiment" / "epoch-1-probabilities.npy"
DEVELOPMENT = ALIGNED / "dev.jsonl"
HIPPOCAMPUS = ALIGNED / "admitted-unlabeled-v1" / "hippocorpus" / "prepared" / "validation.jsonl"
OUTPUT = HERE / "analysis.json"

spec = importlib.util.spec_from_file_location("canonical_experiment", ALIGNED.parents[1] / "v4" / "auto-v1" / "experiment.py")
canonical = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(canonical)


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def percentile(values: list[int], fraction: float) -> int:
    values = sorted(values)
    return values[round((len(values) - 1) * fraction)]


def canonical_metrics(rows: list[dict], probabilities: np.ndarray) -> dict:
    report = canonical.report(rows, probabilities, 0.35)
    truth = [set(row["modelLabels"]) & set(canonical.PRODUCT) for row in rows]
    predicted = [set(output) & set(canonical.PRODUCT) for output in report["outputs"]]
    false_positives = [len(output - expected) for output, expected in zip(predicted, truth)]
    return {
        "status": "HISTORICAL_DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_GOLD",
        "rows": len(rows),
        "threshold": 0.35,
        "topK": 2,
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "outputCountDistribution": report["product"]["outputCountDistribution"],
        "falsePositives": {
            "count": sum(false_positives),
            "perRow": sum(false_positives) / len(rows),
            "rowsWithAtLeastOne": sum(value > 0 for value in false_positives),
        },
    }


def unlabeled_behavior(probabilities: np.ndarray, row_ids: list[str]) -> dict:
    fake_rows = [{"id": row_id, "modelLabels": []} for row_id in row_ids]
    report = canonical.report(fake_rows, probabilities, 0.35)
    outputs = report["outputs"]
    product_positions = [canonical.LABELS.index(label) for label in canonical.PRODUCT]
    return {
        "goldStatus": "UNLABELED_NO_CORRECTNESS_METRICS",
        "rows": int(len(probabilities)),
        "threshold": 0.35,
        "topK": 2,
        "outputCountDistribution": report["product"]["outputCountDistribution"],
        "perLabelPredicted": {
            label: sum(label in output for output in outputs) for label in canonical.PRODUCT
        },
        "meanProbability": {
            label: float(probabilities[:, canonical.LABELS.index(label)].mean()) for label in canonical.PRODUCT
        },
        "meanMaximumProductProbability": float(probabilities[:, product_positions].max(axis=1).mean()),
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite existing analysis: {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED" and protocol["training"] is False
    torch.set_num_threads(4)

    development = read_jsonl(DEVELOPMENT)
    saved21 = np.load(INCUMBENT_PROBABILITIES)
    assert len(development) == 149 and saved21.shape == (149, 21)
    character_lengths = [len(row["journal"]) for row in development]

    bucket_indices = {
        "atMost300": [index for index, length in enumerate(character_lengths) if length <= 300],
        "301To500": [index for index, length in enumerate(character_lengths) if 300 < length <= 500],
        "over500": [index for index, length in enumerate(character_lengths) if length > 500],
    }
    bucket_metrics = {}
    for name, indices in bucket_indices.items():
        rows = [development[index] for index in indices]
        bucket_metrics[name] = canonical_metrics(rows, saved21[indices])

    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    dev_token_lengths = [len(ids) for ids in tokenizer([row["journal"] for row in development], add_special_tokens=True)["input_ids"]]

    hippocorpus = read_jsonl(HIPPOCAMPUS)
    assert len(hippocorpus) == 139
    assert all(len(row["text"]) <= 300 and row["labelStatus"] == "UNLABELED" for row in hippocorpus)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    hippo_probabilities = []
    model.eval()
    with torch.inference_mode():
        for start in range(0, len(hippocorpus), 16):
            encoded = tokenizer(
                [row["text"] for row in hippocorpus[start : start + 16]],
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            )
            hippo_probabilities.append(torch.sigmoid(model(**encoded).logits[:, positions]).cpu().numpy())
    hippo_probabilities = np.concatenate(hippo_probabilities)
    np.save(HERE / "hippocorpus-incumbent-probabilities.npy", hippo_probabilities)

    all_metrics = canonical_metrics(development, saved21)
    assert abs(all_metrics["micro"]["f1"] - 0.528052805280528) < 1e-12
    short = bucket_metrics["atMost300"]
    long_indices = [index for index in range(len(development)) if index not in set(bucket_indices["atMost300"])]
    long = canonical_metrics(
        [row for index, row in enumerate(development) if index not in set(bucket_indices["atMost300"])],
        saved21[long_indices],
    )
    result = {
        "status": "PASS",
        "trainingPerformed": False,
        "incumbentChanged": False,
        "incumbent": "goemotions-targeted-v1/experiment/epoch-1-checkpoint",
        "incumbentRights": "UNRESOLVED_UNDERLYING_GOEMOTIONS_REDDIT_TEXT",
        "development": {
            "goldStatus": "HISTORICAL_DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD",
            "rows": len(development),
            "characterLength": {
                "median": percentile(character_lengths, 0.5),
                "p75": percentile(character_lengths, 0.75),
                "p90": percentile(character_lengths, 0.9),
                "max": max(character_lengths),
                "atMost300Rows": len(bucket_indices["atMost300"]),
                "atMost300Percentage": 100 * len(bucket_indices["atMost300"]) / len(development),
                "over300Rows": len(development) - len(bucket_indices["atMost300"]),
                "over300Percentage": 100 * (len(development) - len(bucket_indices["atMost300"])) / len(development),
            },
            "tokenLengthAtRuntimeSafetyLimit": {
                "median": percentile(dev_token_lengths, 0.5),
                "p90": percentile(dev_token_lengths, 0.9),
                "max": max(dev_token_lengths),
                "over512Rows": sum(length > 512 for length in dev_token_lengths),
            },
            "all": all_metrics,
            "buckets": bucket_metrics,
            "shortVsOver300": {
                "shortRows": len(bucket_indices["atMost300"]),
                "over300Rows": len(development) - len(bucket_indices["atMost300"]),
                "microF1DifferenceShortMinusLong": short["micro"]["f1"] - long["micro"]["f1"],
                "falsePositivesPerRowDifferenceShortMinusLong": short["falsePositives"]["perRow"] - long["falsePositives"]["perRow"],
                "short": short,
                "over300": long,
            },
        },
        "hippocorpusValidation": {
            "rightsStatus": "ADMIT_UNLABELED",
            "independentFromIncumbentTraining": True,
            "characterLimit": 300,
            "behavior": unlabeled_behavior(hippo_probabilities, [row["id"] for row in hippocorpus]),
        },
        "conclusion": {
            "domainMismatchMaterial": len(bucket_indices["atMost300"]) / len(development) < 0.5,
            "credibleShortEventQualityConclusionAvailable": False,
            "reason": "Only 19 historical development rows are within the production character target; Hippocorpus supplies independent short Event text but no emotion gold.",
            "promotionImpact": "NONE",
        },
        "frozenFinalEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({
        "status": result["status"],
        "characterLength": result["development"]["characterLength"],
        "shortVsOver300": {
            "microF1Difference": result["development"]["shortVsOver300"]["microF1DifferenceShortMinusLong"],
            "falsePositivesPerRowDifference": result["development"]["shortVsOver300"]["falsePositivesPerRowDifferenceShortMinusLong"],
        },
        "hippocorpusBehavior": result["hippocorpusValidation"]["behavior"],
        "conclusion": result["conclusion"],
    }, indent=2))


if __name__ == "__main__":
    main()
