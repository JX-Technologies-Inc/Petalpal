#!/usr/bin/env python3
"""Freeze exact-set consensus and apply the predeclared training gate."""

from __future__ import annotations

import json
import math
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


def validate(name: str, rows: list[dict[str, Any]], expected: list[str]) -> int:
    order_fixes = 0
    if len(rows) != len(expected) or [row.get("rowId") for row in rows] != expected:
        raise ValueError(f"{name}: row count/order mismatch")
    for row in rows:
        if set(row) != {"rowId", "labels", "uncertainty"}:
            raise ValueError(f"{name}:{row.get('rowId')}: invalid keys")
        labels = row["labels"]
        if not isinstance(labels, list) or len(labels) > 2 or len(labels) != len(set(labels)):
            raise ValueError(f"{name}:{row['rowId']}: invalid label cardinality")
        if any(label not in ORDER for label in labels):
            raise ValueError(f"{name}:{row['rowId']}: invalid label")
        canonical = sorted(labels, key=ORDER.get)
        if labels != canonical:
            row["labels"] = canonical
            order_fixes += 1
        if row["uncertainty"] not in UNCERTAINTY:
            raise ValueError(f"{name}:{row['rowId']}: invalid uncertainty")
    return order_fixes


def tier_stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
    support = Counter(label for row in rows for label in (row["consensusLabels"] or []))
    nonempty = sum(bool(row["consensusLabels"]) for row in rows)
    assignments = sum(support.values())
    return {
        "rows": len(rows),
        "nonEmptyRows": nonempty,
        "emptyRows": len(rows) - nonempty,
        "emptyRate": (len(rows) - nonempty) / len(rows) if rows else 1.0,
        "cardinality": {str(size): sum(len(row["consensusLabels"] or []) == size for row in rows) for size in range(3)},
        "perLabelSupport": {label: support[label] for label in LABELS},
        "distinctLabels": sum(support[label] > 0 for label in LABELS),
        "labelsWithSupportAtLeast5": sum(support[label] >= 5 for label in LABELS),
        "maxLabelShare": max(support.values(), default=0) / assignments if assignments else 1.0,
    }


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_PRODUCT_AUDIT_OR_AGENT_LABELING":
        raise ValueError("Protocol was not locked")
    pool = read_jsonl(HERE / "frozen-pool.jsonl")
    expected = [str(row["rowId"]) for row in pool]
    agents = {name: read_jsonl(path) for name, path in AGENTS.items()}
    order_fixes = {name: validate(name, rows, expected) for name, rows in agents.items()}

    agent_stats = {}
    for name, rows in agents.items():
        support = Counter(label for row in rows for label in row["labels"])
        cardinality = Counter(len(row["labels"]) for row in rows)
        agent_stats[name] = {
            "model": protocol["blindAgents"][name],
            "perLabelFrequency": {label: support[label] for label in LABELS},
            "emptyLabelRows": cardinality[0],
            "emptyLabelRate": cardinality[0] / len(rows),
            "cardinality": {str(size): cardinality[size] for size in range(3)},
            "meanLabelsPerRow": sum(size * cardinality[size] for size in range(3)) / len(rows),
            "uncertainty": dict(Counter(row["uncertainty"] for row in rows)),
        }

    consensus = []
    pairwise = Counter()
    status_counts = Counter()
    for index, source in enumerate(pool):
        outputs = {name: tuple(agents[name][index]["labels"]) for name in AGENTS}
        for left, right in (("agent-a", "agent-b"), ("agent-a", "agent-c"), ("agent-b", "agent-c")):
            if outputs[left] == outputs[right]:
                pairwise[f"{left}__{right}"] += 1
        counts = Counter(outputs.values())
        labels, votes = counts.most_common(1)[0]
        if votes == 3:
            status, final = "HIGH_CONSENSUS", list(labels)
        elif votes == 2:
            status, final = "MEDIUM_CONSENSUS", list(labels)
        else:
            status, final = "UNRESOLVED", None
        status_counts[status] += 1
        consensus.append({
            "rowId": source["rowId"],
            "consensusStatus": status,
            "consensusLabels": final,
            "agentLabels": {name: list(value) for name, value in outputs.items()},
            "agentUncertainty": {name: agents[name][index]["uncertainty"] for name in AGENTS},
        })

    high = [row for row in consensus if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved = [row for row in consensus if row["consensusStatus"] != "UNRESOLVED"]
    high_stats = tier_stats(high)
    resolved_stats = tier_stats(resolved)
    high_checks = {
        "rows": high_stats["rows"] >= 300,
        "nonEmpty": high_stats["nonEmptyRows"] >= 200,
        "distinctLabels": high_stats["distinctLabels"] >= 10,
        "labelsWithSupport5": high_stats["labelsWithSupportAtLeast5"] >= 8,
        "maxLabelShare": high_stats["maxLabelShare"] <= 0.35,
        "emptyRate": high_stats["emptyRate"] <= 0.50,
    }
    resolved_checks = {
        "rows": resolved_stats["rows"] >= 500,
        "nonEmpty": resolved_stats["nonEmptyRows"] >= 250,
        "distinctLabels": resolved_stats["distinctLabels"] >= 12,
        "labelsWithSupport5": resolved_stats["labelsWithSupportAtLeast5"] >= 10,
        "maxLabelShare": resolved_stats["maxLabelShare"] <= 0.35,
        "emptyRate": resolved_stats["emptyRate"] <= 0.50,
        "twoLabelRows": resolved_stats["cardinality"]["2"] >= 15,
    }
    if all(high_checks.values()):
        mode, selected_tier = "HIGH_ONLY", high
    elif all(resolved_checks.values()):
        mode, selected_tier = "HIGH_AND_MEDIUM", resolved
    else:
        mode, selected_tier = "DO_NOT_TRAIN", []

    pool_by_id = {row["rowId"]: row for row in pool}
    weak = []
    if selected_tier:
        nonempty = [row for row in selected_tier if row["consensusLabels"]]
        empty = sorted((row for row in selected_tier if not row["consensusLabels"]), key=lambda row: row["rowId"])
        empty_limit = math.floor(len(nonempty) * 0.35 / 0.65)
        selected = nonempty + empty[:empty_limit]
        selected_ids = {row["rowId"] for row in selected}
        consensus_by_id = {row["rowId"]: row for row in selected_tier}
        for source in pool:
            if source["rowId"] not in selected_ids:
                continue
            result = consensus_by_id[source["rowId"]]
            weak.append({
                "rowId": source["rowId"],
                "text": source["text"],
                "weakLabels": result["consensusLabels"],
                "consensusStatus": result["consensusStatus"],
                "labelStatus": "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD",
            })

    with (HERE / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    if weak:
        with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
            for row in weak:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

    weak_cardinality = Counter(len(row["weakLabels"]) for row in weak)
    audit = {
        "status": "PASS" if weak else "FAIL",
        "decision": "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE" if weak else "DO_NOT_TRAIN",
        "selectedConsensusTier": mode,
        "rowCount": len(pool),
        "agreement": {key: status_counts[key] for key in ("HIGH_CONSENSUS", "MEDIUM_CONSENSUS", "UNRESOLVED")},
        "pairwiseExactSetAgreement": dict(pairwise),
        "mechanicalCanonicalOrderFixes": order_fixes,
        "agentStats": agent_stats,
        "mostConservativeByEmptyRate": max(agent_stats, key=lambda name: agent_stats[name]["emptyLabelRate"]),
        "mostConservativeByMeanLabelCount": min(agent_stats, key=lambda name: agent_stats[name]["meanLabelsPerRow"]),
        "conservatismConclusion": "MIXED: agent-c has the highest empty rate; agent-a has the lowest mean label count and almost never emits two labels. No one agent is uniformly most conservative.",
        "highConsensus": high_stats,
        "resolvedConsensus": resolved_stats,
        "highOnlyGate": high_checks,
        "resolvedGate": resolved_checks,
        "weakTrainingRows": len(weak),
        "weakTrainingCardinality": {str(size): weak_cardinality[size] for size in range(3)},
        "weakTrainingPerLabelSupport": {label: sum(label in row["weakLabels"] for row in weak) for label in LABELS},
        "humanReviewPerformed": False,
        "fourthModelUsed": False,
        "RTNUsed": False,
        "incumbentPredictionsUsed": False,
        "labelStatus": "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        "hashOrManifestAdded": False,
    }
    (HERE / "feasibility-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
