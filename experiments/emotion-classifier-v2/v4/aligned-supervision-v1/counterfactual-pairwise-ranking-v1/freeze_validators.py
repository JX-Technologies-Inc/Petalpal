#!/usr/bin/env python3
"""Schema-check all three complete blind outputs and freeze them together."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VALID = {"A_STRONGER", "B_STRONGER", "TIE_UNCLEAR"}
AGENTS = ("astra", "sol", "luna")


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise ValueError(f"{path.name}:{line_number}: {error}") from error
    return rows


def main() -> None:
    blind = load_jsonl(ROOT / "blind-input.jsonl")
    expected_ids = [row["pairId"] for row in blind]
    checks = {}
    for agent in AGENTS:
        rows = load_jsonl(ROOT / f"{agent}-output.jsonl")
        problems = []
        if len(rows) != len(expected_ids):
            problems.append(f"row_count={len(rows)} expected={len(expected_ids)}")
        ids = [row.get("pairId") for row in rows]
        if ids != expected_ids:
            problems.append("pair_ids_or_order_mismatch")
        if len(set(ids)) != len(ids):
            problems.append("duplicate_pair_ids")
        for index, row in enumerate(rows, start=1):
            if set(row) != {"pairId", "judgment"}:
                problems.append(f"row_{index}_fields")
            if row.get("judgment") not in VALID:
                problems.append(f"row_{index}_judgment")
        checks[agent] = {
            "complete": len(rows) == len(expected_ids),
            "schemaValid": not problems,
            "semanticOutputFrozen": not problems,
            "problems": problems,
        }

    artifact = {
        "ASTRA_FROZEN": checks["astra"]["semanticOutputFrozen"],
        "SOL_FROZEN": checks["sol"]["semanticOutputFrozen"],
        "LUNA_FROZEN": checks["luna"]["semanticOutputFrozen"],
        "outputsFrozenBeforeConsensus": all(item["semanticOutputFrozen"] for item in checks.values()),
        "checks": checks,
    }
    (ROOT / "validator-freeze.json").write_text(
        json.dumps(artifact, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(artifact, indent=2))
    if not artifact["outputsFrozenBeforeConsensus"]:
        raise SystemExit("validator freeze failed")


if __name__ == "__main__":
    main()
