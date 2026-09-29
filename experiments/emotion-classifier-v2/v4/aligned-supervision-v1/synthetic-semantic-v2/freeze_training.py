#!/usr/bin/env python3
"""Freeze all resolved V2 consensus rows for the one bounded experiment."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def main() -> None:
    audit = json.loads((HERE / "generator-quality-audit.json").read_text(encoding="utf-8"))
    if audit["status"] != "PASS" or audit["decision"] != "FREEZE_TRAINING_PROTOCOL":
        raise ValueError("Generator-quality gate did not authorize protocol freezing")
    generated = read_jsonl(HERE / "generator-output.jsonl")
    consensus = read_jsonl(HERE / "consensus.jsonl")
    if [row["rowId"] for row in generated] != [row["rowId"] for row in consensus]:
        raise ValueError("Generated and consensus rows do not align")
    weak = []
    for source, result in zip(generated, consensus):
        if result["consensusStatus"] == "UNRESOLVED":
            continue
        weak.append({
            "rowId": source["rowId"],
            "text": source["text"],
            "weakLabels": result["consensusLabels"],
            "consensusStatus": result["consensusStatus"],
            "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        })
    if len(weak) != 155 or sum(len(row["weakLabels"]) == 2 for row in weak) != 34:
        raise ValueError("Unexpected frozen training cardinality")
    with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
        for row in weak:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({
        "rows": len(weak),
        "high": sum(row["consensusStatus"] == "HIGH_CONSENSUS" for row in weak),
        "medium": sum(row["consensusStatus"] == "MEDIUM_CONSENSUS" for row in weak),
        "cardinality": {str(size): sum(len(row["weakLabels"]) == size for row in weak) for size in range(3)},
        "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
    }, indent=2))


if __name__ == "__main__":
    main()
