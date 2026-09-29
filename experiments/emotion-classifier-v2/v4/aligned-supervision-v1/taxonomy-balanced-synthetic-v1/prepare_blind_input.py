#!/usr/bin/env python3
"""Validate generator output mechanically and strip targets for blind validators."""

import json
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]


def read(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def main() -> None:
    plan = read(HERE / "target-plan.jsonl")
    generated = read(HERE / "generator-output.jsonl")
    if len(plan) != 532 or len(generated) != 532:
        raise ValueError("Expected exactly 532 plan and generated rows")
    seen = set()
    lengths = []
    counts = Counter()
    for expected, row in zip(plan, generated):
        if set(row) != {"rowId", "targetLabels", "text"}:
            raise ValueError(f"{row.get('rowId')}: invalid keys")
        if row["rowId"] != expected["rowId"] or row["targetLabels"] != expected["targetLabels"]:
            raise ValueError(f"{row.get('rowId')}: target plan mismatch")
        text = str(row["text"]).strip()
        if not 30 <= len(text) <= 260 or text.lower() in seen:
            raise ValueError(f"{row['rowId']}: length or duplicate failure")
        seen.add(text.lower())
        lengths.append(len(text))
        counts.update(row["targetLabels"] or ["<EMPTY>"])
    with (HERE / "blind-input.jsonl").open("w", encoding="utf-8") as handle:
        for row in generated:
            handle.write(json.dumps({"rowId": row["rowId"], "text": row["text"]}, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {"status": "PASS", "rows": len(generated), "targetCounts": dict(counts), "minChars": min(lengths), "maxChars": max(lengths), "duplicates": 0, "humanReview": False}
    (HERE / "generation-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
