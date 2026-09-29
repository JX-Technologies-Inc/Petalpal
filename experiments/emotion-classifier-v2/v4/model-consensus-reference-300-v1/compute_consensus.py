#!/usr/bin/env python3
"""Validate three frozen blind label files and compute exact-set consensus."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
BLIND_PATH = HERE / "blind-input.jsonl"
FROZEN_PATH = HERE / "frozen-reference-300.jsonl"
SELECTION_AUDIT_PATH = HERE / "selection-audit.json"
AGENT_PATHS = {
    "agent-a": HERE / "agent-a-labels.jsonl",
    "agent-b": HERE / "agent-b-labels.jsonl",
    "agent-c": HERE / "agent-c-labels.jsonl",
}
CONSENSUS_PATH = HERE / "consensus.jsonl"
SUMMARY_PATH = HERE / "summary.json"

LABELS = [
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "caring",
    "confusion",
    "curiosity",
    "disappointment",
    "disgust",
    "excitement",
    "fear",
    "gratitude",
    "joy",
    "love",
    "optimism",
    "remorse",
    "sadness",
    "surprise",
]
LABEL_ORDER = {label: index for index, label in enumerate(LABELS)}
UNCERTAINTY = {"LOW", "MEDIUM", "HIGH"}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise ValueError(f"{path.name}:{line_number}: invalid JSON") from error
    return rows


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_agent(
    name: str, rows: list[dict[str, Any]], expected_ids: list[str]
) -> list[dict[str, Any]]:
    if len(rows) != len(expected_ids):
        raise ValueError(f"{name}: expected {len(expected_ids)} rows, found {len(rows)}")
    if [row.get("rowId") for row in rows] != expected_ids:
        raise ValueError(f"{name}: row IDs or order do not match the frozen blind input")
    for row in rows:
        if set(row) != {"rowId", "labels", "uncertainty"}:
            raise ValueError(f"{name}:{row.get('rowId')}: keys do not match contract")
        labels = row["labels"]
        if not isinstance(labels, list) or not 0 <= len(labels) <= 2:
            raise ValueError(f"{name}:{row['rowId']}: labels must contain zero to two items")
        if len(set(labels)) != len(labels) or any(label not in LABEL_ORDER for label in labels):
            raise ValueError(f"{name}:{row['rowId']}: invalid or duplicate Product-18 label")
        if labels != sorted(labels, key=LABEL_ORDER.get):
            raise ValueError(f"{name}:{row['rowId']}: labels are not in canonical order")
        if row["uncertainty"] not in UNCERTAINTY:
            raise ValueError(f"{name}:{row['rowId']}: invalid uncertainty")
    return rows


def pct(count: int, total: int) -> float:
    return round(100 * count / total, 2) if total else 0.0


def agent_diagnostic(rows: list[dict[str, Any]]) -> dict[str, Any]:
    label_counts = Counter(label for row in rows for label in row["labels"])
    set_sizes = Counter(len(row["labels"]) for row in rows)
    uncertainty = Counter(row["uncertainty"] for row in rows)
    total_mentions = sum(label_counts.values())
    top_label, top_count = (label_counts.most_common(1)[0] if label_counts else (None, 0))
    return {
        "labelMentions": {label: label_counts[label] for label in LABELS},
        "distinctLabelsUsed": sum(count > 0 for count in label_counts.values()),
        "setSizeDistribution": {str(size): set_sizes[size] for size in range(3)},
        "emptyRatePct": pct(set_sizes[0], len(rows)),
        "meanLabelsPerRow": round(total_mentions / len(rows), 4),
        "topLabel": top_label,
        "topLabelShareOfMentionsPct": pct(top_count, total_mentions),
        "uncertainty": {level: uncertainty[level] for level in ["LOW", "MEDIUM", "HIGH"]},
    }


def bias_flags(agent_stats: dict[str, dict[str, Any]]) -> list[str]:
    flags: list[str] = []
    empty_rates = [stats["emptyRatePct"] for stats in agent_stats.values()]
    if max(empty_rates) - min(empty_rates) > 20:
        flags.append("AGENT_EMPTY_RATE_SPREAD_GT_20PP")
    for agent, stats in agent_stats.items():
        if stats["emptyRatePct"] > 85:
            flags.append(f"{agent.upper()}_EMPTY_RATE_GT_85PCT")
        if stats["distinctLabelsUsed"] < 6:
            flags.append(f"{agent.upper()}_DISTINCT_LABELS_LT_6")
        if stats["topLabelShareOfMentionsPct"] > 60:
            flags.append(f"{agent.upper()}_TOP_LABEL_SHARE_GT_60PCT")
        if stats["uncertainty"]["HIGH"] > 240:
            flags.append(f"{agent.upper()}_HIGH_UNCERTAINTY_GT_80PCT")
        if stats["uncertainty"]["LOW"] > 285:
            flags.append(f"{agent.upper()}_LOW_UNCERTAINTY_GT_95PCT")
    for label in LABELS:
        if all(stats["labelMentions"][label] == 0 for stats in agent_stats.values()):
            flags.append(f"PANEL_ZERO_SUPPORT_{label.upper()}")
    return flags


def main() -> None:
    blind = read_jsonl(BLIND_PATH)
    frozen = read_jsonl(FROZEN_PATH)
    selection_audit = json.loads(SELECTION_AUDIT_PATH.read_text(encoding="utf-8"))
    expected_ids = [row["rowId"] for row in blind]
    if len(expected_ids) != 300 or len(set(expected_ids)) != 300:
        raise ValueError("Frozen blind input must have exactly 300 unique row IDs")
    if [row["rowId"] for row in frozen] != expected_ids:
        raise ValueError("Frozen reference IDs do not match the blind input")

    agent_rows = {
        name: validate_agent(name, read_jsonl(path), expected_ids)
        for name, path in AGENT_PATHS.items()
    }
    output: list[dict[str, Any]] = []
    status_counts: Counter[str] = Counter()
    vote_support: Counter[str] = Counter()
    consensus_support: Counter[str] = Counter()
    resolved_set_sizes: Counter[int] = Counter()
    pairwise = {"agent-a__agent-b": 0, "agent-a__agent-c": 0, "agent-b__agent-c": 0}

    for index, row_id in enumerate(expected_ids):
        sets = {
            name: tuple(agent_rows[name][index]["labels"])
            for name in ["agent-a", "agent-b", "agent-c"]
        }
        for labels in sets.values():
            vote_support.update(labels)
        if sets["agent-a"] == sets["agent-b"]:
            pairwise["agent-a__agent-b"] += 1
        if sets["agent-a"] == sets["agent-c"]:
            pairwise["agent-a__agent-c"] += 1
        if sets["agent-b"] == sets["agent-c"]:
            pairwise["agent-b__agent-c"] += 1

        counts = Counter(sets.values())
        top_set, top_count = counts.most_common(1)[0]
        if top_count == 3:
            status = "HIGH_CONSENSUS"
            consensus_labels: list[str] | None = list(top_set)
        elif top_count == 2:
            status = "MEDIUM_CONSENSUS"
            consensus_labels = list(top_set)
        else:
            status = "UNRESOLVED"
            consensus_labels = None
        status_counts[status] += 1
        if consensus_labels is not None:
            consensus_support.update(consensus_labels)
            resolved_set_sizes[len(consensus_labels)] += 1

        per_label_votes = Counter(label for labels in sets.values() for label in labels)
        output.append(
            {
                "rowId": row_id,
                "consensusStatus": status,
                "consensusLabels": consensus_labels,
                "agentLabels": {name: list(labels) for name, labels in sets.items()},
                "agentUncertainty": {
                    name: agent_rows[name][index]["uncertainty"] for name in sets
                },
                "perLabelVotes": {
                    label: per_label_votes[label] for label in LABELS if per_label_votes[label]
                },
            }
        )

    with CONSENSUS_PATH.open("w", encoding="utf-8") as handle:
        for row in output:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    agent_stats = {name: agent_diagnostic(rows) for name, rows in agent_rows.items()}
    flags = bias_flags(agent_stats)
    summary = {
        "referenceName": "MODEL_CONSENSUS_REFERENCE_300",
        "status": "PASS",
        "referenceCreated": True,
        "humanGold": False,
        "referenceType": "MODEL_GENERATED_WEAK_PSEUDO_REFERENCE",
        "safeForFutureResearchDiagnostics": True,
        "source": "Roadtrip Nation personal narratives (Saldias & Roy, 2020)",
        "rightsAdmission": "ADMIT_UNLABELED_REFERENCE_ONLY_CC_BY_4_0",
        "rowCount": 300,
        "sourceGroupCount": 300,
        "sourceComposition": {
            "datasetRows": {"Roadtrip Nation personal narratives": 300},
            "originalPartition": dict(Counter(row["sourcePartition"] for row in frozen)),
            "sourceNarratorGenderMetadata": dict(
                Counter(row["narratorsGender"] for row in frozen)
            ),
        },
        "characterLength": selection_audit["characterLength"],
        "agreement": {
            "highConsensus3of3": {
                "count": status_counts["HIGH_CONSENSUS"],
                "percent": pct(status_counts["HIGH_CONSENSUS"], 300),
            },
            "mediumConsensus2of3": {
                "count": status_counts["MEDIUM_CONSENSUS"],
                "percent": pct(status_counts["MEDIUM_CONSENSUS"], 300),
            },
            "unresolved": {
                "count": status_counts["UNRESOLVED"],
                "percent": pct(status_counts["UNRESOLVED"], 300),
            },
            "pairwiseExactSetAgreement": {
                pair: {"count": count, "percent": pct(count, 300)}
                for pair, count in pairwise.items()
            },
        },
        "perLabelAgentVoteSupport": {label: vote_support[label] for label in LABELS},
        "perLabelResolvedConsensusSupport": {
            label: consensus_support[label] for label in LABELS
        },
        "resolvedConsensusLabelCountDistribution": {
            str(size): resolved_set_sizes[size] for size in range(3)
        },
        "agentDiagnostics": agent_stats,
        "suspiciousAgentBiasOrCollapseFlags": flags,
        "models": {
            "agent-a": "gpt-6-astra / medium",
            "agent-b": "gpt-5.6-sol / medium",
            "agent-c": "gpt-5.6-luna / medium",
        },
        "hashes": {
            "blindInputSha256": sha256_file(BLIND_PATH),
            "agentALabelsSha256": sha256_file(AGENT_PATHS["agent-a"]),
            "agentBLabelsSha256": sha256_file(AGENT_PATHS["agent-b"]),
            "agentCLabelsSha256": sha256_file(AGENT_PATHS["agent-c"]),
            "consensusSha256": sha256_file(CONSENSUS_PATH),
        },
        "trainingPerformed": False,
        "incumbentModified": False,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
