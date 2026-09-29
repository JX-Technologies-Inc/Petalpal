#!/usr/bin/env python3
"""Freeze the existing validated positive-only prototype pool."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
PROTOCOL = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
LABELS = PROTOCOL["labels"]


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def main() -> None:
    rows = []
    source_counts = Counter()

    pu_rows = read_jsonl(ALIGNED / "positive-unlabeled-learning-v1/pu-train.jsonl")
    for row in pu_rows:
        labels = list(row["positiveLabels"])
        if not labels:
            continue
        rows.append({
            "rowId": f"three-state/{row['rowId']}",
            "text": row["text"],
            "positiveLabels": labels,
            "source": "three-state-v1-v3-frozen-positive-consensus",
            "labelStatus": PROTOCOL["data"]["labelStatus"],
        })
        source_counts["three-state-v1-v3-frozen-positive-consensus"] += 1

    synthetic_rows = read_jsonl(ALIGNED / "synthetic-semantic-v2/weak-train.jsonl")
    for row in synthetic_rows:
        labels = list(row["weakLabels"])
        if not labels:
            continue
        rows.append({
            "rowId": f"synthetic-semantic-v2/{row['rowId']}",
            "text": row["text"],
            "positiveLabels": labels,
            "source": "synthetic-semantic-v2-frozen-positive-consensus",
            "labelStatus": PROTOCOL["data"]["labelStatus"],
        })
        source_counts["synthetic-semantic-v2-frozen-positive-consensus"] += 1

    support = Counter(label for row in rows for label in row["positiveLabels"])
    cardinality = Counter(len(row["positiveLabels"]) for row in rows)
    normalized = [normalize(row["text"]) for row in rows]
    invalid_labels = sorted({label for row in rows for label in row["positiveLabels"] if label not in LABELS})
    checks = {
        "exactEventCount": len(rows) == PROTOCOL["data"]["expectedEvents"],
        "exactMembershipCount": sum(support.values()) == PROTOCOL["data"]["expectedLabelMemberships"],
        "exactSingleLabelEventCount": cardinality[1] == PROTOCOL["data"]["expectedSingleLabelEvents"],
        "exactMultiLabelEventCount": cardinality[2] == PROTOCOL["data"]["expectedMultiLabelEvents"],
        "onlyOneOrTwoLabels": set(cardinality) <= {1, 2},
        "minimumSupportPerLabel": min(support.values()) >= PROTOCOL["data"]["minimumPositiveSupportPerLabel"],
        "allLabelsCovered": set(support) == set(LABELS),
        "noInvalidLabels": not invalid_labels,
        "noNormalizedExactDuplicates": len(normalized) == len(set(normalized)),
        "allEventsAtMost300Chars": all(len(row["text"]) <= 300 for row in rows),
        "noReferenceOrEvalSources": all("reference" not in row["source"] and "coso" not in row["source"] and "rtn" not in row["source"] for row in rows),
    }
    audit = {
        "status": "PASS" if all(checks.values()) else "FAIL",
        "events": len(rows),
        "labelMemberships": sum(support.values()),
        "singleLabelEvents": cardinality[1],
        "multiLabelEvents": cardinality[2],
        "positiveSupportByLabel": {label: support[label] for label in LABELS},
        "sourceEventCounts": dict(source_counts),
        "checks": checks,
        "newAgentValidationUsed": False,
        "negativeTargetsCreated": 0,
        "repulsivePairsCreated": 0,
        "RTNOrCOSOUsed": False,
    }
    with (HERE / "prototype-train.jsonl").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    (HERE / "data-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))
    if audit["status"] != "PASS":
        raise SystemExit("prototype data freeze failed")


if __name__ == "__main__":
    main()
