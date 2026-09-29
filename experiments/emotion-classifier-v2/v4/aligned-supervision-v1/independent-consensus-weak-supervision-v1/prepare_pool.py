#!/usr/bin/env python3
"""Freeze a neutral, participant-disjoint short-Event pool for blind agents."""

from __future__ import annotations

import json
import random
import re
from collections import defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
SOURCES = {
    "hippocorpus": ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl",
    "unexpectedEvents": ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/train.jsonl",
}
VALIDATIONS = {
    "hippocorpus": ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl",
    "unexpectedEvents": ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl",
}
RTN_REFERENCE = ALIGNED.parents[0] / "model-consensus-reference-300-v1/frozen-reference-300.jsonl"
ROWS_PER_SOURCE = 450
SEED = 20260917


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def select_one_per_group(rows: list[dict[str, object]], source: str) -> list[dict[str, object]]:
    by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_group[str(row["sourceGroupId"])].append(row)
    groups = sorted(by_group)
    random.Random(f"{SEED}:{source}").shuffle(groups)
    assert len(groups) >= ROWS_PER_SOURCE
    selected = []
    for group in groups[:ROWS_PER_SOURCE]:
        selected.append(sorted(by_group[group], key=lambda row: str(row["id"]))[0])
    return selected


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    assert protocol["status"] == "LOCKED_BEFORE_POOL_SELECTION_OR_AGENT_LABELING"
    selected_by_source: dict[str, list[dict[str, object]]] = {}
    validation_groups: dict[str, set[str]] = {}
    for source, path in SOURCES.items():
        train = read_jsonl(path)
        validation = read_jsonl(VALIDATIONS[source])
        validation_groups[source] = {str(row["sourceGroupId"]) for row in validation}
        selected = select_one_per_group(train, source)
        assert all(row["split"] == "train" for row in selected)
        assert all(row["admissionClass"] == "ADMIT_UNLABELED" for row in selected)
        assert all(len(str(row["text"])) <= 300 for row in selected)
        assert not ({str(row["sourceGroupId"]) for row in selected} & validation_groups[source])
        selected_by_source[source] = selected

    pool = []
    for source in ("hippocorpus", "unexpectedEvents"):
        for row in selected_by_source[source]:
            pool.append(
                {
                    "rowId": f"WSP-{len(pool) + 1:04d}",
                    "text": row["text"],
                    "source": source,
                    "sourceId": row["id"],
                    "sourceGroupId": row["sourceGroupId"],
                    "admissionClass": row["admissionClass"],
                    "labelStatus": "UNLABELED",
                }
            )
    normalized = [normalize(str(row["text"])) for row in pool]
    assert len(pool) == 900 and len(set(normalized)) == 900
    rtn = read_jsonl(RTN_REFERENCE)
    rtn_texts = {normalize(str(row["text"])) for row in rtn}
    assert not (set(normalized) & rtn_texts)

    with (HERE / "frozen-pool.jsonl").open("w", encoding="utf-8") as handle:
        for row in pool:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    with (HERE / "blind-input.jsonl").open("w", encoding="utf-8") as handle:
        for row in pool:
            handle.write(json.dumps({"rowId": row["rowId"], "text": row["text"]}, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {
        "status": "PASS",
        "rows": len(pool),
        "rowsBySource": {source: len(rows) for source, rows in selected_by_source.items()},
        "sourceGroupsBySource": {
            source: len({str(row["sourceGroupId"]) for row in rows})
            for source, rows in selected_by_source.items()
        },
        "characterLength": {
            "min": min(map(len, (str(row["text"]) for row in pool))),
            "max": max(map(len, (str(row["text"]) for row in pool))),
        },
        "normalizedDuplicates": len(normalized) - len(set(normalized)),
        "exactNormalizedOverlapWithRTN300": len(set(normalized) & rtn_texts),
        "validationGroupsOpenedForContent": False,
        "validationGroupOverlap": 0,
        "selectionUsedLabelsOrModelOutputs": False,
        "trainingPerformed": False,
        "humanReviewPerformed": False,
    }
    (HERE / "pool-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
