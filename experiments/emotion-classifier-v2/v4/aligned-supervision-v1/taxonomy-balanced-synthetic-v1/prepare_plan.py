#!/usr/bin/env python3
"""Freeze an equal-budget Product-18 generation plan before any text exists."""

import json
import random
from pathlib import Path


HERE = Path(__file__).resolve().parent
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    assert protocol["status"] == "LOCKED_BEFORE_GENERATION"
    targets = [[label] for label in LABELS for _ in range(24)] + [[] for _ in range(100)]
    random.Random(20260917).shuffle(targets)
    with (HERE / "target-plan.jsonl").open("w", encoding="utf-8") as handle:
        for index, labels in enumerate(targets, 1):
            handle.write(json.dumps({"rowId": f"TBS-{index:04d}", "targetLabels": labels}, separators=(",", ":")) + "\n")
    print(json.dumps({"rows": len(targets), "perLabel": 24, "empty": 100, "status": "FROZEN"}))


if __name__ == "__main__":
    main()
