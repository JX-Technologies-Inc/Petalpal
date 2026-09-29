#!/usr/bin/env python3
"""Freeze existing high-confidence positive cells as P; everything else is U."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
PROTOCOL = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
LABELS = PROTOCOL["labels"]
POSITIVE_TIERS = set(PROTOCOL["data"]["positiveTiers"])


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def main() -> None:
    rows = []
    source_stats = {}
    for source in PROTOCOL["data"]["sources"]:
        source_dir = ALIGNED / source
        blind = read_jsonl(source_dir / "blind-input.jsonl")
        consensus = read_jsonl(source_dir / "consensus.jsonl")
        text_by_id = {row["rowId"]: row["text"] for row in blind}
        if [row["rowId"] for row in blind] != [row["rowId"] for row in consensus]:
            raise ValueError(f"row order mismatch in {source}")
        positive_count = 0
        for row in consensus:
            positives = [label for label in LABELS if row["cells"][label] in POSITIVE_TIERS]
            positive_count += len(positives)
            rows.append({
                "rowId": f"{source}/{row['rowId']}",
                "text": text_by_id[row["rowId"]],
                "positiveLabels": positives,
                "labelStatus": PROTOCOL["data"]["labelStatus"],
                "unconfirmedCellSemantics": "UNLABELED_NOT_NEGATIVE",
            })
        source_stats[source] = {"events": len(consensus), "positiveCells": positive_count}

    positive_by_label = Counter(label for row in rows for label in row["positiveLabels"])
    positive_cells = sum(positive_by_label.values())
    total_cells = len(rows) * len(LABELS)
    unlabeled_cells = total_cells - positive_cells
    normalized = [normalize(row["text"]) for row in rows]
    exact_duplicates = len(normalized) - len(set(normalized))
    checks = {
        "exactEventCount": len(rows) == PROTOCOL["data"]["expectedEvents"],
        "exactPositiveCellCount": positive_cells == PROTOCOL["data"]["expectedPositiveCells"],
        "exactUnlabeledCellCount": unlabeled_cells == PROTOCOL["data"]["expectedUnlabeledCells"],
        "minimumPositiveCellsPerLabel": min(positive_by_label.values()) >= PROTOCOL["data"]["minimumPositiveCellsPerLabel"],
        "allLabelsCovered": set(positive_by_label) == set(LABELS),
        "noCrossSourceExactDuplicates": exact_duplicates == 0,
        "allUnconfirmedCellsRemainUnlabeled": all(row["unconfirmedCellSemantics"] == "UNLABELED_NOT_NEGATIVE" for row in rows),
        "noReferenceOrEvalSources": all("reference" not in source and "coso" not in source and "rtn" not in source for source in PROTOCOL["data"]["sources"]),
    }
    audit = {
        "status": "PASS" if all(checks.values()) else "FAIL",
        "events": len(rows),
        "totalCells": total_cells,
        "positiveCells": positive_cells,
        "unlabeledCells": unlabeled_cells,
        "positiveByLabel": {label: positive_by_label[label] for label in LABELS},
        "sourceStats": source_stats,
        "normalizedExactDuplicates": exact_duplicates,
        "checks": checks,
        "negativeTargetsCreated": 0,
        "neutralGoldTargetsCreated": 0,
        "humanGoldCreated": False,
        "RTNOrCOSOUsed": False,
    }
    with (HERE / "pu-train.jsonl").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    (HERE / "data-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))
    if audit["status"] != "PASS":
        raise SystemExit("PU data freeze failed")


if __name__ == "__main__":
    main()
