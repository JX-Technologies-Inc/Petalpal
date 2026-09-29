#!/usr/bin/env python3
"""Freeze V3 sparse cell targets and the sole masked-BCE protocol."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def main() -> None:
    audit = json.loads((HERE / "supervision-audit.json").read_text(encoding="utf-8"))
    if audit["status"] != "PASS" or audit["decision"] != "FREEZE_TRAINING_PROTOCOL":
        raise ValueError("Supervision gate did not authorize training")
    generated = read_jsonl(HERE / "generator-output.jsonl")
    consensus = read_jsonl(HERE / "consensus.jsonl")
    if [row["rowId"] for row in generated] != [row["rowId"] for row in consensus]:
        raise ValueError("Generated and consensus rows do not align")
    weak = []
    for source, result in zip(generated, consensus):
        cell_targets = {}
        for label in LABELS:
            status = result["cells"][label]
            if status in {"HIGH_POSITIVE", "MEDIUM_POSITIVE"}:
                cell_targets[label] = 1
            elif status in {"HIGH_NEGATIVE", "MEDIUM_NEGATIVE"}:
                cell_targets[label] = 0
        weak.append({
            "rowId": source["rowId"], "text": source["text"], "cellTargets": cell_targets,
            "inclusionPolicy": "HIGH_PLUS_MEDIUM_EQUAL_WEIGHT",
            "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        })
    supervised = sum(len(row["cellTargets"]) for row in weak)
    if supervised != audit["chosenStats"]["positiveCells"] + audit["chosenStats"]["negativeCells"]:
        raise ValueError("Frozen cell count mismatch")
    with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
        for row in weak:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    protocol = {
        "status": "LOCKED_AFTER_SUPERVISION_GATE_AND_BEFORE_TRAINING",
        "rows": len(weak), "labels": LABELS, "inclusionPolicy": "HIGH_PLUS_MEDIUM_EQUAL_WEIGHT",
        "positiveCells": audit["chosenStats"]["positiveCells"],
        "negativeCells": audit["chosenStats"]["negativeCells"],
        "maskedCells": audit["chosenStats"]["maskedCells"],
        "loss": "BCE over boolean-indexed supervised cells only; masked cells remain null and never enter BCE",
        "initialCheckpoint": "goemotions-targeted-v1/experiment/epoch-1-checkpoint",
        "trainableLayers": "classifier plus encoder layers 10 and 11",
        "learningRate": 1e-6, "epochs": 1, "seed": 52, "batchSize": 16,
        "weightDecay": 0.01, "maxLength": 512, "threshold": 0.35, "maxLabels": 2,
        "evaluator": "canonical COSO evaluator plus frozen RTN-300 RESOLVED/HIGH evaluator",
        "successCriteria": {
            "rtnResolvedMicroF1Minimum": 0.3313265306,
            "rtnResolvedMacroF1Minimum": 0.3184,
            "rtnResolvedExactSetMinimumPercent": 50.4098360656,
            "rtnResolvedPrecisionMinimum": 0.3342,
            "rtnResolvedRecallMinimum": 0.2857,
            "rtnResolvedFalsePositiveMaximum": 64,
            "rtnResolvedFalseNegativeMaximum": 85,
            "rtnResolvedDistributionErrorMaximum": 54,
            "rtnHighMicroF1Minimum": 0.3678,
            "rtnHighExactSetMinimumPercent": 55.6603773585,
            "minimumSupportedLabelsImprovingBy002": 2,
            "maximumSupportedLabelRtnRegression": 0.10,
            "cosoMicroF1Minimum": 0.5230528053,
            "cosoMacroF1Minimum": 0.3401786297,
            "cosoExactSetMaximumDrop": 0.01,
            "cosoFalsePositiveMaximum": 60,
            "cosoFalseNegativeMaximum": 87,
            "maximumSupportedLabelCosoRegression": 0.05
        },
        "runs": 1, "rescueAllowed": False, "RTNOpened": False, "COSOPerRowUsed": False,
    }
    (HERE / "training-protocol.json").write_text(json.dumps(protocol, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(protocol, indent=2))


if __name__ == "__main__":
    main()
