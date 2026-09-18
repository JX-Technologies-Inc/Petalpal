#!/usr/bin/env python3
"""Aggregate incumbent error/support profile with the canonical selector."""

import importlib.util
import json
from collections import Counter
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
DEVELOPMENT = ALIGNED / "dev.jsonl"
PROBABILITIES = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"

spec = importlib.util.spec_from_file_location(
    "canonical_experiment", ALIGNED.parents[1] / "v4/auto-v1/experiment.py"
)
canonical = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(canonical)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def profile(rows: list[dict[str, object]], probabilities: np.ndarray) -> dict[str, object]:
    report = canonical.report(rows, probabilities, 0.35)
    truth = [set(row["modelLabels"]) & set(canonical.PRODUCT) for row in rows]
    predicted = [set(output) & set(canonical.PRODUCT) for output in report["outputs"]]
    per_label = {}
    for label in canonical.PRODUCT:
        tp = sum(label in expected and label in output for expected, output in zip(truth, predicted))
        fp = sum(label not in expected and label in output for expected, output in zip(truth, predicted))
        fn = sum(label in expected and label not in output for expected, output in zip(truth, predicted))
        support = tp + fn
        per_label[label] = {
            "support": support,
            "predicted": tp + fp,
            "truePositive": tp,
            "falsePositive": fp,
            "falseNegative": fn,
            "precision": tp / (tp + fp) if tp + fp else 0.0,
            "recall": tp / support if support else 0.0,
        }

    count_matrix = {
        str(gold_count): {str(predicted_count): 0 for predicted_count in range(3)}
        for gold_count in range(3)
    }
    outside_matrix = 0
    for expected, output in zip(truth, predicted):
        if len(expected) <= 2:
            count_matrix[str(len(expected))][str(len(output))] += 1
        else:
            outside_matrix += 1

    return {
        "rows": len(rows),
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "goldLabelCountDistribution": dict(sorted(Counter(map(len, truth)).items())),
        "predictedLabelCountDistribution": report["product"]["outputCountDistribution"],
        "goldByPredictedCountMatrix": count_matrix,
        "goldRowsOverTwoLabels": outside_matrix,
        "totalFalsePositives": sum(value["falsePositive"] for value in per_label.values()),
        "totalFalseNegatives": sum(value["falseNegative"] for value in per_label.values()),
        "perLabel": per_label,
        "labelsRankedByFalsePositive": sorted(
            (
                {"label": label, **values}
                for label, values in per_label.items()
            ),
            key=lambda item: (-item["falsePositive"], item["label"]),
        ),
        "labelsRankedByFalseNegative": sorted(
            (
                {"label": label, **values}
                for label, values in per_label.items()
            ),
            key=lambda item: (-item["falseNegative"], item["label"]),
        ),
    }


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_ANALYSIS"
    rows = read_jsonl(DEVELOPMENT)
    probabilities = np.load(PROBABILITIES)
    assert len(rows) == 149 and probabilities.shape == (149, 21)

    all_profile = profile(rows, probabilities)
    assert abs(all_profile["micro"]["f1"] - 0.528052805280528) < 1e-12
    short_indices = [index for index, row in enumerate(rows) if len(str(row["journal"])) <= 300]
    short_profile = profile([rows[index] for index in short_indices], probabilities[short_indices])

    supported = [
        item for item in all_profile["labelsRankedByFalsePositive"] if item["support"] >= 3
    ]
    short_supported = [
        label for label, values in short_profile["perLabel"].items() if values["support"] >= 3
    ]
    result = {
        "status": "PASS",
        "trainingPerformed": False,
        "humanReviewPerformed": False,
        "incumbentChanged": False,
        "incumbent": "goemotions-targeted-v1/experiment/epoch-1-checkpoint",
        "incumbentRights": "UNRESOLVED_UNDERLYING_GOEMOTIONS_REDDIT_TEXT",
        "dataRole": protocol["dataRole"],
        "all149": all_profile,
        "atMost300": short_profile,
        "aggregateFindings": {
            "labelsWithSupportUnder3All149": [
                label for label, values in all_profile["perLabel"].items() if values["support"] < 3
            ],
            "labelsWithSupportAtLeast3All149": len(supported),
            "labelsWithSupportAtLeast3AtMost300": short_supported,
            "topFalsePositiveContributorsAll149": [
                {"label": item["label"], "falsePositive": item["falsePositive"]}
                for item in all_profile["labelsRankedByFalsePositive"][:5]
            ],
            "topFalseNegativeContributorsAll149": [
                {"label": item["label"], "falseNegative": item["falseNegative"]}
                for item in all_profile["labelsRankedByFalseNegative"][:5]
            ],
        },
        "conclusion": {
            "shortSliceAdequateForPerLabelModelSelection": len(short_supported) >= 9,
            "modelQualityInterventionIdentified": False,
            "reason": "The aggregate profile locates historical errors, but only a small subset of labels has even three positive rows in the 19-row short slice. Using these counts to choose/tune a model would optimize the same sparse historical diagnostic rather than establish short-event quality.",
            "promotionImpact": "NONE",
        },
    }
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"],
        "all149": {
            "microF1": all_profile["micro"]["f1"],
            "falsePositives": all_profile["totalFalsePositives"],
            "falseNegatives": all_profile["totalFalseNegatives"],
            "countMatrix": all_profile["goldByPredictedCountMatrix"],
        },
        "aggregateFindings": result["aggregateFindings"],
        "shortConclusion": result["conclusion"],
    }, indent=2))


if __name__ == "__main__":
    main()
