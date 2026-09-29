#!/usr/bin/env python3
"""Freeze the V1 counterfactual pair cohort and produce the blind payload."""

from __future__ import annotations

import json
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

from pair_specs import CASES, DEFINITIONS


ROOT = Path(__file__).resolve().parent
SEED = 53
LABELS = list(DEFINITIONS)
OPTIONS = ["A_STRONGER", "B_STRONGER", "TIE_UNCLEAR"]


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def tokens(text: str) -> set[str]:
    return set(norm(text).split())


def jaccard(left: str, right: str) -> float:
    a, b = tokens(left), tokens(right)
    return len(a & b) / len(a | b) if a or b else 1.0


def main() -> None:
    assert set(CASES) == set(LABELS)
    assert all(len(CASES[label]) == 8 for label in LABELS)

    rng = random.Random(SEED)
    staged = []
    for label in LABELS:
        a_stronger_indices = set(rng.sample(range(8), 4))
        for case_index, (strong, weak) in enumerate(CASES[label], start=1):
            if case_index - 1 in a_stronger_indices:
                event_a, event_b, intended = strong, weak, "A_STRONGER"
            else:
                event_a, event_b, intended = weak, strong, "B_STRONGER"
            staged.append({
                "targetLabel": label,
                "sourceCase": case_index,
                "eventA": event_a,
                "eventB": event_b,
                "intendedDirection": intended,
            })
    rng.shuffle(staged)

    records = []
    for index, row in enumerate(staged, start=1):
        records.append({"pairId": f"CPV1-{index:03d}", **row})

    all_events = []
    for row in records:
        all_events.extend([(row["pairId"], "A", row["eventA"]), (row["pairId"], "B", row["eventB"])])

    exact_event_counts = Counter(norm(text) for _, _, text in all_events)
    exact_event_duplicates = sum(count - 1 for count in exact_event_counts.values() if count > 1)
    exact_pair_counts = Counter(
        tuple(sorted((norm(row["eventA"]), norm(row["eventB"])))) for row in records
    )
    exact_pair_duplicates = sum(count - 1 for count in exact_pair_counts.values() if count > 1)

    near_duplicates = []
    for left_index, (left_id, left_side, left_text) in enumerate(all_events):
        for right_id, right_side, right_text in all_events[left_index + 1:]:
            if left_id == right_id:
                continue
            score = jaccard(left_text, right_text)
            if score >= 0.78:
                near_duplicates.append({
                    "left": f"{left_id}-{left_side}",
                    "right": f"{right_id}-{right_side}",
                    "tokenJaccard": round(score, 4),
                })

    product_fit_failures = []
    for pair_id, side, text in all_events:
        failures = []
        if not text or len(text) > 300:
            failures.append("length")
        if "\n" in text:
            failures.append("multiline")
        if re.search(r"\bI (?:feel|felt|am feeling) (?:very )?(?:" + "|".join(LABELS) + r")\b", text, re.I):
            failures.append("explicit_label_leakage")
        if failures:
            product_fit_failures.append({"event": f"{pair_id}-{side}", "failures": failures})

    by_label = defaultdict(Counter)
    direction = Counter()
    for row in records:
        by_label[row["targetLabel"]]["pairs"] += 1
        by_label[row["targetLabel"]][row["intendedDirection"]] += 1
        direction[row["intendedDirection"]] += 1

    audit = {
        "status": "PASS" if (
            len(records) == 144
            and all(by_label[label]["pairs"] == 8 for label in LABELS)
            and direction == Counter({"A_STRONGER": 72, "B_STRONGER": 72})
            and exact_event_duplicates == 0
            and exact_pair_duplicates == 0
            and not near_duplicates
            and not product_fit_failures
        ) else "FAIL",
        "totalPairs": len(records),
        "totalEvents": len(all_events),
        "directionBalance": dict(direction),
        "perLabel": {label: dict(by_label[label]) for label in LABELS},
        "maxEventChars": max(len(text) for _, _, text in all_events),
        "exactEventDuplicates": exact_event_duplicates,
        "exactPairDuplicates": exact_pair_duplicates,
        "crossPairNearDuplicates": near_duplicates,
        "productFitFailures": product_fit_failures,
        "pairOrderRandomizedWithFrozenSeed": SEED,
    }

    with (ROOT / "hidden-pairs.jsonl").open("w", encoding="utf-8") as handle:
        for row in records:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    with (ROOT / "blind-input.jsonl").open("w", encoding="utf-8") as handle:
        for row in records:
            blind = {
                "pairId": row["pairId"],
                "targetLabel": row["targetLabel"],
                "targetDefinition": DEFINITIONS[row["targetLabel"]],
                "eventA": row["eventA"],
                "eventB": row["eventB"],
                "decisionOptions": OPTIONS,
            }
            handle.write(json.dumps(blind, ensure_ascii=False) + "\n")

    (ROOT / "generation-audit.json").write_text(
        json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(audit, indent=2, ensure_ascii=False))
    if audit["status"] != "PASS":
        raise SystemExit("generation audit failed")


if __name__ == "__main__":
    main()
