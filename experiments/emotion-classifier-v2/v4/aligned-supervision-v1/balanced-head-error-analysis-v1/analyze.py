#!/usr/bin/env python3
"""Deterministic COSO-only error analysis for incumbent versus balanced head."""

from __future__ import annotations

import csv
import importlib.util
import itertools
import json
from collections import Counter
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
DEV = ALIGNED / "dev.jsonl"
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
BALANCED = ALIGNED / "decoupled-balanced-head-v1/candidate/coso-candidate-probabilities.npy"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module("canonical_experiment", V4 / "auto-v1/experiment.py")
PRODUCT = list(canonical.PRODUCT)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def safe_div(left: int, right: int) -> float:
    return left / right if right else 0.0


def metric(tp: int, fp: int, fn: int) -> dict[str, float | int]:
    precision = safe_div(tp, tp + fp)
    recall = safe_div(tp, tp + fn)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall, "f1": f1}


def per_label(truth, outputs):
    result = {}
    for label in PRODUCT:
        tp = sum(label in expected and label in predicted for expected, predicted in zip(truth, outputs))
        fp = sum(label not in expected and label in predicted for expected, predicted in zip(truth, outputs))
        fn = sum(label in expected and label not in predicted for expected, predicted in zip(truth, outputs))
        result[label] = metric(tp, fp, fn)
    return result


def overall(truth, outputs, indices=None):
    selected = range(len(truth)) if indices is None else indices
    tp = sum(len(truth[index] & outputs[index]) for index in selected)
    fp = sum(len(outputs[index] - truth[index]) for index in selected)
    fn = sum(len(truth[index] - outputs[index]) for index in selected)
    result = metric(tp, fp, fn)
    result["rows"] = len(list(selected)) if indices is not None else len(truth)
    return result


def cardinality_matrix(truth, outputs):
    return {
        f"gold{gold}_pred{predicted}": sum(
            len(expected) == gold and len(output) == predicted for expected, output in zip(truth, outputs)
        )
        for gold in range(3) for predicted in range(3)
    }


def count_distribution(outputs):
    return {str(size): sum(len(output) == size for output in outputs) for size in range(3)}


def confidence_bin(score: float) -> str:
    if score >= 0.70:
        return ">=0.70"
    if score >= 0.50:
        return "0.50-0.70"
    return "0.35-0.50"


def main() -> None:
    for output in (HERE / "analysis.json", HERE / "per-label.csv", HERE / "examples.jsonl"):
        if output.exists():
            raise FileExistsError(f"Refusing to overwrite {output}")
    rows = read_jsonl(DEV)
    incumbent_probs = np.load(INCUMBENT)
    balanced_probs = np.load(BALANCED)
    if len(rows) != 149 or incumbent_probs.shape != (149, 21) or balanced_probs.shape != (149, 21):
        raise ValueError("Unexpected frozen development artifact shape")
    truth = [set(row["modelLabels"]) & set(PRODUCT) for row in rows]
    incumbent = [set(labels) & set(PRODUCT) for labels in canonical.report(rows, incumbent_probs, 0.35)["outputs"]]
    balanced = [set(labels) & set(PRODUCT) for labels in canonical.report(rows, balanced_probs, 0.35)["outputs"]]
    positions = {label: canonical.LABELS.index(label) for label in PRODUCT}

    incumbent_label = per_label(truth, incumbent)
    balanced_label = per_label(truth, balanced)
    label_rows = []
    for label in PRODUCT:
        left = incumbent_label[label]
        right = balanced_label[label]
        label_rows.append({
            "label": label,
            **{f"incumbent_{key}": value for key, value in left.items()},
            **{f"balanced_{key}": value for key, value in right.items()},
            "delta_tp": right["tp"] - left["tp"],
            "delta_fp": right["fp"] - left["fp"],
            "delta_fn": right["fn"] - left["fn"],
            "delta_precision": right["precision"] - left["precision"],
            "delta_recall": right["recall"] - left["recall"],
            "delta_f1": right["f1"] - left["f1"],
        })

    fp_attribution = Counter()
    added_fp_attribution = Counter()
    substitutions = Counter()
    extra_with_true = Counter()
    incumbent_pairs = Counter()
    balanced_pairs = Counter()
    added_fp_by_label = Counter()
    removed_fp_by_label = Counter()
    recovered_by_label = Counter()
    lost_tp_by_label = Counter()
    fp_confidence = Counter()
    added_fp_confidence = Counter()
    examples = []

    for index, (row, expected, old, new) in enumerate(zip(rows, truth, incumbent, balanced)):
        for pair in itertools.combinations(sorted(old), 2):
            incumbent_pairs[pair] += 1
        for pair in itertools.combinations(sorted(new), 2):
            balanced_pairs[pair] += 1
        for label in new - expected:
            score = float(balanced_probs[index, positions[label]])
            fp_confidence[confidence_bin(score)] += 1
            if not expected:
                fp_attribution["gold_empty"] += 1
            elif new & expected:
                fp_attribution["extra_alongside_true_positive"] += 1
            else:
                fp_attribution["pure_label_confusion_no_true_positive"] += 1
            for missing in expected - new:
                substitutions[(label, missing)] += 1
            for correct in expected & new:
                extra_with_true[(label, correct)] += 1
            examples.append({
                "kind": "balanced_false_positive",
                "rowId": row["id"],
                "label": label,
                "score": score,
                "incumbentScore": float(incumbent_probs[index, positions[label]]),
                "alreadyPredictedByIncumbent": label in old,
                "goldLabels": sorted(expected),
                "balancedOutputs": sorted(new),
                "characterLength": len(row["journal"]),
                "text": row["journal"],
            })
        for label in (new - old) - expected:
            added_fp_by_label[label] += 1
            score = float(balanced_probs[index, positions[label]])
            added_fp_confidence[confidence_bin(score)] += 1
            added_fp_attribution["gold_empty" if not expected else "gold_nonempty"] += 1
        for label in (old - new) - expected:
            removed_fp_by_label[label] += 1
        for label in (expected - old) & new:
            recovered_by_label[label] += 1
            examples.append({
                "kind": "recovered_false_negative",
                "rowId": row["id"],
                "label": label,
                "score": float(balanced_probs[index, positions[label]]),
                "incumbentScore": float(incumbent_probs[index, positions[label]]),
                "goldLabels": sorted(expected),
                "incumbentOutputs": sorted(old),
                "balancedOutputs": sorted(new),
                "characterLength": len(row["journal"]),
                "text": row["journal"],
            })
        for label in (expected & old) - new:
            lost_tp_by_label[label] += 1

    short = [index for index, row in enumerate(rows) if len(row["journal"]) <= 300]
    long = [index for index, row in enumerate(rows) if len(row["journal"]) > 300]
    added_fp_indices = {
        index
        for index, (expected, old, new) in enumerate(zip(truth, incumbent, balanced))
        if (new - old) - expected
    }
    added_fp_event_count = sum(len((new - old) - expected) for expected, old, new in zip(truth, incumbent, balanced))
    added_fp_short = sum(
        len((balanced[index] - incumbent[index]) - truth[index]) for index in short
    )

    pair_rows = []
    for pair in sorted(set(incumbent_pairs) | set(balanced_pairs)):
        pair_rows.append({
            "labels": list(pair),
            "incumbentCount": incumbent_pairs[pair],
            "balancedCount": balanced_pairs[pair],
            "delta": balanced_pairs[pair] - incumbent_pairs[pair],
        })
    result = {
        "status": "COMPLETE_COSO_DEVELOPMENT_ONLY",
        "RTNGranularInspection": False,
        "rows": len(rows),
        "shortRowsAtMost300Chars": len(short),
        "goldCardinality": count_distribution(truth),
        "incumbent": {
            "overall": overall(truth, incumbent),
            "cardinality": count_distribution(incumbent),
            "goldPredictedCardinalityMatrix": cardinality_matrix(truth, incumbent),
            "shortSlice": overall(truth, incumbent, short),
            "longSlice": overall(truth, incumbent, long),
        },
        "balanced": {
            "overall": overall(truth, balanced),
            "cardinality": count_distribution(balanced),
            "goldPredictedCardinalityMatrix": cardinality_matrix(truth, balanced),
            "shortSlice": overall(truth, balanced, short),
            "longSlice": overall(truth, balanced, long),
        },
        "perLabel": label_rows,
        "balancedFalsePositiveAttribution": dict(fp_attribution),
        "balancedFalsePositiveConfidenceBins": dict(fp_confidence),
        "addedFalsePositiveAttribution": dict(added_fp_attribution),
        "addedFalsePositiveConfidenceBins": dict(added_fp_confidence),
        "addedFalsePositiveEvents": added_fp_event_count,
        "addedFalsePositiveRows": len(added_fp_indices),
        "addedFalsePositiveEventsAtMost300Chars": added_fp_short,
        "addedFalsePositiveByLabel": dict(added_fp_by_label),
        "removedFalsePositiveByLabel": dict(removed_fp_by_label),
        "recoveredFalseNegativeByLabel": dict(recovered_by_label),
        "lostTruePositiveByLabel": dict(lost_tp_by_label),
        "topSubstitutionPairs": [
            {"predicted": predicted, "missedGold": missed, "count": count}
            for (predicted, missed), count in substitutions.most_common()
        ],
        "topExtraLabelAlongsideCorrectPairs": [
            {"extraPredicted": extra, "correctGold": correct, "count": count}
            for (extra, correct), count in extra_with_true.most_common()
        ],
        "coPredictionPairs": sorted(pair_rows, key=lambda row: (-row["balancedCount"], row["labels"])),
        "interpretationGuard": "COSO is development evidence; 130/149 rows exceed the <=300-character product target. RTN rows were not inspected.",
    }
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    with (HERE / "per-label.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(label_rows[0]))
        writer.writeheader()
        writer.writerows(label_rows)
    ranked_examples = sorted(
        examples,
        key=lambda row: (
            0 if row["kind"] == "balanced_false_positive" else 1,
            -row["score"], row["rowId"], row["label"],
        ),
    )
    with (HERE / "examples.jsonl").open("w", encoding="utf-8") as handle:
        for row in ranked_examples:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps({
        "incumbent": result["incumbent"],
        "balanced": result["balanced"],
        "balancedFalsePositiveAttribution": result["balancedFalsePositiveAttribution"],
        "addedFalsePositiveEvents": added_fp_event_count,
        "addedFalsePositiveEventsAtMost300Chars": added_fp_short,
        "addedFalsePositiveByLabel": result["addedFalsePositiveByLabel"],
        "recoveredFalseNegativeByLabel": result["recoveredFalseNegativeByLabel"],
        "topSubstitutionPairs": result["topSubstitutionPairs"][:10],
    }, indent=2))


if __name__ == "__main__":
    main()
