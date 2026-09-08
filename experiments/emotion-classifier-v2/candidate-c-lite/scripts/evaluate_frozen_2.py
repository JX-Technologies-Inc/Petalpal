#!/usr/bin/env python3
"""One-time final evaluation for the locked Frozen-2 JSONL."""

import argparse
import json
from pathlib import Path

import numpy as np

import evaluate_frozen_100 as evaluation


PRIMARY_MAP = {
    "joy": "SUNNY_BLOOM", "love": "GENTLE_BLOOM", "caring": "GENTLE_BLOOM",
    "sadness": "QUIET_BLOOM", "remorse": "QUIET_BLOOM", "disappointment": "QUIET_BLOOM",
    "fear": "HEALING_BLOOM", "anger": "FIRE_BLOOM", "annoyance": "FIRE_BLOOM",
    "surprise": "WONDER_BLOOM", "curiosity": "WONDER_BLOOM", "excitement": "WONDER_BLOOM",
    "confusion": "DRIFTING_BLOOM", "disgust": "DRIFTING_BLOOM",
    "neutral": "PEACEFUL_BLOOM", "optimism": "SUNNY_BLOOM",
    "gratitude": "SUNNY_BLOOM", "admiration": "SUNNY_BLOOM", "amusement": "SUNNY_BLOOM",
}


def read_locked(path):
    rows = [json.loads(line) for line in path.open() if line.strip()]
    if len(rows) != 100 or any(row.get("frozenStatus") != "FROZEN_2_LOCKED" for row in rows):
        raise ValueError("Expected exactly 100 FROZEN_2_LOCKED rows")
    texts, annotations = [], []
    for row in rows:
        final_primary = row.get("userFinalPrimaryEmotion") or row["proposedPrimaryEmotion"]
        final_secondary = row.get("userFinalSecondaryEmotions") or row["proposedSecondaryEmotions"]
        expected = [label for label in final_secondary if label in evaluation.VARIANT_LABELS]
        texts.append(row["journal"])
        annotations.append({
            "id": row["id"], "primaryGardenMood": PRIMARY_MAP[final_primary],
            "expected": expected, "acceptable": [], "clearlyWrong": [],
            "preferNone": not expected, "redundant": [final_primary] if final_primary in evaluation.VARIANT_LABELS else [],
            "min": len(expected), "max": len(expected),
        })
    return texts, annotations


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--frozen", type=Path, required=True)
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()
    evaluation.THRESHOLD = args.threshold
    texts, annotations = read_locked(args.frozen)
    probabilities = evaluation.predict(texts, args.checkpoint, args.batch_size)
    outputs = evaluation.select_variants(probabilities, annotations, Path(__file__).resolve().parents[2])
    truth = np.asarray([[int(label in row["expected"]) for label in evaluation.VARIANT_LABELS] for row in annotations])
    predicted = np.asarray([[int(label in output) for label in evaluation.VARIANT_LABELS] for output in outputs])
    print(json.dumps({
        "evaluation": "Frozen-2 one-time final evaluation", "checkpoint": str(args.checkpoint),
        "examples": len(texts), "threshold": args.threshold,
        "classificationMetrics": evaluation.metric_report(truth, predicted),
        "productMetrics": evaluation.product_report(annotations, outputs),
    }, indent=2))


if __name__ == "__main__":
    main()
