#!/usr/bin/env python3
"""Validate frozen blind outputs and build the one locked weak-training set."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
AGENTS = {
    "agent-a": HERE / "agent-a-labels.jsonl",
    "agent-b": HERE / "agent-b-labels.jsonl",
    "agent-c": HERE / "agent-c-labels.jsonl",
}
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
ORDER = {label: index for index, label in enumerate(LABELS)}
UNCERTAINTY = {"LOW", "MEDIUM", "HIGH"}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def validate(name: str, rows: list[dict[str, Any]], expected: list[str]) -> None:
    if len(rows) != len(expected) or [row.get("rowId") for row in rows] != expected:
        raise ValueError(f"{name}: row count/order mismatch")
    for row in rows:
        if set(row) != {"rowId", "labels", "uncertainty"}:
            raise ValueError(f"{name}:{row.get('rowId')}: invalid keys")
        labels = row["labels"]
        if not isinstance(labels, list) or len(labels) > 2 or len(labels) != len(set(labels)):
            raise ValueError(f"{name}:{row['rowId']}: invalid label cardinality")
        if any(label not in ORDER for label in labels) or labels != sorted(labels, key=ORDER.get):
            raise ValueError(f"{name}:{row['rowId']}: invalid label/order")
        if row["uncertainty"] not in UNCERTAINTY:
            raise ValueError(f"{name}:{row['rowId']}: invalid uncertainty")


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    pool = read_jsonl(HERE / "frozen-pool.jsonl")
    expected = [str(row["rowId"]) for row in pool]
    if protocol["status"] != "LOCKED_BEFORE_POOL_SELECTION_OR_AGENT_LABELING" or len(expected) != 900:
        raise ValueError("Protocol/pool is not frozen as expected")
    agent_rows = {name: read_jsonl(path) for name, path in AGENTS.items()}
    for name, rows in agent_rows.items():
        validate(name, rows, expected)

    consensus_rows = []
    status_counts: Counter[str] = Counter()
    support: Counter[str] = Counter()
    resolved_by_source: Counter[str] = Counter()
    nonempty_by_source: Counter[str] = Counter()
    pairwise = Counter()
    for index, source_row in enumerate(pool):
        outputs = {
            name: tuple(agent_rows[name][index]["labels"])
            for name in ("agent-a", "agent-b", "agent-c")
        }
        if outputs["agent-a"] == outputs["agent-b"]:
            pairwise["agent-a__agent-b"] += 1
        if outputs["agent-a"] == outputs["agent-c"]:
            pairwise["agent-a__agent-c"] += 1
        if outputs["agent-b"] == outputs["agent-c"]:
            pairwise["agent-b__agent-c"] += 1
        counts = Counter(outputs.values())
        top, count = counts.most_common(1)[0]
        if count == 3:
            status, labels = "HIGH_CONSENSUS", list(top)
        elif count == 2:
            status, labels = "MEDIUM_CONSENSUS", list(top)
        else:
            status, labels = "UNRESOLVED", None
        source = str(source_row["source"])
        status_counts[status] += 1
        if labels is not None:
            support.update(labels)
            resolved_by_source[source] += 1
            nonempty_by_source[source] += int(bool(labels))
        consensus_rows.append(
            {
                "rowId": source_row["rowId"],
                "consensusStatus": status,
                "consensusLabels": labels,
                "agentLabels": {name: list(value) for name, value in outputs.items()},
                "agentUncertainty": {
                    name: agent_rows[name][index]["uncertainty"] for name in outputs
                },
            }
        )

    resolved = [row for row in consensus_rows if row["consensusLabels"] is not None]
    nonempty = [row for row in resolved if row["consensusLabels"]]
    empty = [row for row in resolved if not row["consensusLabels"]]
    selected_empty = []
    pool_by_id = {row["rowId"]: row for row in pool}
    for source in ("hippocorpus", "unexpectedEvents"):
        positive_count = sum(pool_by_id[row["rowId"]]["source"] == source for row in nonempty)
        candidates = sorted(
            (row for row in empty if pool_by_id[row["rowId"]]["source"] == source),
            key=lambda row: row["rowId"],
        )
        selected_empty.extend(candidates[:positive_count])
    selected_ids = {row["rowId"] for row in nonempty + selected_empty}
    weak_rows = []
    consensus_by_id = {row["rowId"]: row for row in consensus_rows}
    for source_row in pool:
        if source_row["rowId"] not in selected_ids:
            continue
        labels = consensus_by_id[source_row["rowId"]]["consensusLabels"]
        weak_rows.append(
            {
                "rowId": source_row["rowId"],
                "text": source_row["text"],
                "source": source_row["source"],
                "sourceGroupId": source_row["sourceGroupId"],
                "weakLabels": labels,
                "labelStatus": "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD",
            }
        )

    criteria = protocol["feasibilityGate"]
    checks = {
        "resolvedRows": len(resolved) >= criteria["resolvedRowsAtLeast"],
        "resolvedRowsPerSource": all(
            resolved_by_source[source] >= criteria["resolvedRowsPerSourceAtLeast"]
            for source in ("hippocorpus", "unexpectedEvents")
        ),
        "resolvedNonEmptyRows": len(nonempty) >= criteria["resolvedNonEmptyRowsAtLeast"],
        "distinctConsensusLabels": sum(support[label] > 0 for label in LABELS)
        >= criteria["distinctConsensusLabelsAtLeast"],
        "labelsWithAtLeast10Positives": sum(support[label] >= 10 for label in LABELS)
        >= criteria["labelsWithAtLeast10PositivesAtLeast"],
    }
    passed = all(checks.values())
    with (HERE / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus_rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    if passed:
        with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
            for row in weak_rows:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE" if passed else "DO_NOT_TRAIN",
        "rowCount": len(pool),
        "agreement": dict(status_counts),
        "pairwiseExactSetAgreement": dict(pairwise),
        "resolvedBySource": dict(resolved_by_source),
        "resolvedNonEmptyRows": len(nonempty),
        "resolvedEmptyRows": len(empty),
        "consensusPositiveCounts": {label: support[label] for label in LABELS},
        "distinctConsensusLabels": sum(support[label] > 0 for label in LABELS),
        "labelsWithAtLeast10Positives": sum(support[label] >= 10 for label in LABELS),
        "weakTrainingRows": len(weak_rows) if passed else 0,
        "weakTrainingNonEmptyRows": len(nonempty) if passed else 0,
        "weakTrainingEmptyRows": len(selected_empty) if passed else 0,
        "checks": checks,
        "humanReviewPerformed": False,
        "fourthModelUsed": False,
        "RTNUsed": False,
        "incumbentPredictionsUsed": False,
        "labelStatus": "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD",
    }
    (HERE / "feasibility-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
