#!/usr/bin/env python3
"""Compute blind V2 consensus and the frozen generator-quality gate."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
AGENTS = {name: HERE / f"agent-{suffix}-labels.jsonl" for name, suffix in (("agent-a", "a"), ("agent-b", "b"), ("agent-c", "c"))}
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
ORDER = {label: index for index, label in enumerate(LABELS)}
TARGETS = ["amusement", "annoyance", "caring", "confusion", "disappointment", "gratitude", "joy", "love", "surprise"]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def validate(rows: list[dict[str, Any]], expected: list[str]) -> int:
    if len(rows) != len(expected) or [row.get("rowId") for row in rows] != expected:
        raise ValueError("Validator count/order mismatch")
    fixes = 0
    for row in rows:
        if set(row) != {"rowId", "labels", "uncertainty"} or row["uncertainty"] not in {"LOW", "MEDIUM", "HIGH"}:
            raise ValueError((row.get("rowId"), "schema"))
        labels = row["labels"]
        if not isinstance(labels, list) or len(labels) > 2 or len(labels) != len(set(labels)) or any(label not in ORDER for label in labels):
            raise ValueError((row["rowId"], "labels"))
        canonical = sorted(labels, key=ORDER.get)
        if canonical != labels:
            row["labels"] = canonical
            fixes += 1
    return fixes


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    generated = read_jsonl(HERE / "generator-output.jsonl")
    expected = [row["rowId"] for row in generated]
    agents = {name: read_jsonl(path) for name, path in AGENTS.items()}
    order_fixes = {name: validate(rows, expected) for name, rows in agents.items()}

    pairwise = Counter()
    consensus = []
    status = Counter()
    for index, source in enumerate(generated):
        outputs = {name: tuple(rows[index]["labels"]) for name, rows in agents.items()}
        for left, right in (("agent-a", "agent-b"), ("agent-a", "agent-c"), ("agent-b", "agent-c")):
            if outputs[left] == outputs[right]:
                pairwise[f"{left}__{right}"] += 1
        counts = Counter(outputs.values())
        labels, votes = counts.most_common(1)[0]
        if votes == 3:
            tier, final = "HIGH_CONSENSUS", list(labels)
        elif votes == 2:
            tier, final = "MEDIUM_CONSENSUS", list(labels)
        else:
            tier, final = "UNRESOLVED", None
        status[tier] += 1
        consensus.append({
            "rowId": source["rowId"], "consensusStatus": tier, "consensusLabels": final,
            "agentLabels": {name: list(value) for name, value in outputs.items()},
            "agentUncertainty": {name: agents[name][index]["uncertainty"] for name in agents},
        })

    joined = [{**source, **{k: result[k] for k in ("consensusStatus", "consensusLabels")}} for source, result in zip(generated, consensus)]
    resolved = [row for row in joined if row["consensusLabels"] is not None]
    high = [row for row in joined if row["consensusStatus"] == "HIGH_CONSENSUS"]
    support = Counter(label for row in resolved for label in row["consensusLabels"])
    cardinality = Counter(len(row["consensusLabels"]) for row in resolved)
    total_assignments = sum(support.values())

    single_stats = {}
    single_checks = {}
    for label in TARGETS:
        rows = [row for row in joined if row["targetKind"] == "SINGLE_LABEL" and row["intendedLabels"] == [label]]
        label_resolved = [row for row in rows if row["consensusLabels"] is not None]
        stats = {
            "intended": len(rows),
            "high": sum(row["consensusStatus"] == "HIGH_CONSENSUS" for row in rows),
            "resolved": len(label_resolved),
            "exactTarget": sum(row["consensusLabels"] == [label] for row in rows),
            "targetIncluded": sum(row["consensusLabels"] is not None and label in row["consensusLabels"] for row in rows),
            "emptyConsensus": sum(row["consensusLabels"] == [] for row in rows),
            "unresolved": sum(row["consensusLabels"] is None for row in rows),
            "substitutes": dict(Counter(other for row in label_resolved if label not in row["consensusLabels"] for other in row["consensusLabels"])),
            "coLabels": dict(Counter(other for row in label_resolved if label in row["consensusLabels"] for other in row["consensusLabels"] if other != label)),
        }
        checks = {
            "intended12": stats["intended"] == 12,
            "resolved10": stats["resolved"] >= 10,
            "exact8": stats["exactTarget"] >= 8,
            "included9": stats["targetIncluded"] >= 9,
            "emptyAtMost2": stats["emptyConsensus"] <= 2,
        }
        single_stats[label] = stats
        single_checks[label] = checks

    pair_rows = [row for row in joined if row["targetKind"] == "TWO_LABEL"]
    pair_resolved = [row for row in pair_rows if row["consensusLabels"] is not None]
    pair_stats = {
        "intended": len(pair_rows),
        "resolved": len(pair_resolved),
        "exactPair": sum(row["consensusLabels"] == row["intendedLabels"] for row in pair_rows),
        "bothIncluded": sum(row["consensusLabels"] is not None and set(row["intendedLabels"]) <= set(row["consensusLabels"]) for row in pair_rows),
        "resolvedTwoLabel": sum(row["consensusLabels"] is not None and len(row["consensusLabels"]) == 2 for row in pair_rows),
        "unresolved": sum(row["consensusLabels"] is None for row in pair_rows),
        "byPair": {},
    }
    for key in sorted({"+".join(row["intendedLabels"]) for row in pair_rows}):
        rows = [row for row in pair_rows if "+".join(row["intendedLabels"]) == key]
        pair_stats["byPair"][key] = {
            "rows": len(rows),
            "exact": sum(row["consensusLabels"] == row["intendedLabels"] for row in rows),
            "bothIncluded": sum(row["consensusLabels"] is not None and set(row["intendedLabels"]) <= set(row["consensusLabels"]) for row in rows),
            "resolved": sum(row["consensusLabels"] is not None for row in rows),
        }

    empty_rows = [row for row in joined if row["targetKind"] == "EMPTY_CONTRAST"]
    empty_stats = {
        "intended": len(empty_rows),
        "resolved": sum(row["consensusLabels"] is not None for row in empty_rows),
        "exactEmpty": sum(row["consensusLabels"] == [] for row in empty_rows),
        "unresolved": sum(row["consensusLabels"] is None for row in empty_rows),
    }
    generation = json.loads((HERE / "generation-audit.json").read_text(encoding="utf-8"))
    mechanical = all(not generation[key] for key in ("exactDuplicates", "normalizedDuplicates", "nearDuplicatePairs", "repeatedClauseTypes", "repeatedFiveWordSuffixTypes", "transitionOccurrences", "productFitFailures")) and generation["rows"] == 156
    pairwise_rates = {key: value / len(joined) for key, value in pairwise.items()}
    checks = {
        "mechanical": mechanical,
        "highAtLeast60": len(high) >= 60,
        "resolvedAtLeast130": len(resolved) >= 130,
        "unresolvedAtMost26": status["UNRESOLVED"] <= 26,
        "pairwiseAtLeast045": all(value >= 0.45 for value in pairwise_rates.values()),
        "allSingleLabelGates": all(all(value.values()) for value in single_checks.values()),
        "targetSupportAtLeast8": all(support[label] >= 8 for label in TARGETS),
        "noDominantLabel": max(support.values(), default=0) / total_assignments <= 0.25 if total_assignments else False,
        "pairResolved24": pair_stats["resolved"] >= 24,
        "pairExact18": pair_stats["exactPair"] >= 18,
        "pairBothIncluded21": pair_stats["bothIncluded"] >= 21,
        "pairTwoLabel18": pair_stats["resolvedTwoLabel"] >= 18,
        "eachPairExact3": all(value["exact"] >= 3 for value in pair_stats["byPair"].values()),
        "emptyResolved15": empty_stats["resolved"] >= 15,
        "emptyExact12": empty_stats["exactEmpty"] >= 12,
    }
    passed = all(checks.values())
    for name, rows in agents.items():
        pass
    agent_stats = {}
    for name, rows in agents.items():
        counts = Counter(label for row in rows for label in row["labels"])
        cards = Counter(len(row["labels"]) for row in rows)
        agent_stats[name] = {
            "perLabel": {label: counts[label] for label in LABELS},
            "cardinality": {str(size): cards[size] for size in range(3)},
            "emptyRate": cards[0] / len(rows),
            "meanLabels": sum(len(row["labels"]) for row in rows) / len(rows),
        }

    with (HERE / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "FREEZE_TRAINING_PROTOCOL" if passed else "DO_NOT_TRAIN",
        "agreement": {key: status[key] for key in ("HIGH_CONSENSUS", "MEDIUM_CONSENSUS", "UNRESOLVED")},
        "resolvedCardinality": {str(size): cardinality[size] for size in range(3)},
        "pairwiseExactSetAgreement": dict(pairwise),
        "pairwiseExactSetAgreementRate": pairwise_rates,
        "mechanicalCanonicalOrderFixes": order_fixes,
        "perLabelConsensusSupport": {label: support[label] for label in LABELS},
        "singleLabelFidelity": single_stats,
        "singleLabelChecks": single_checks,
        "multiLabelFidelity": pair_stats,
        "emptyContrast": empty_stats,
        "agentStats": agent_stats,
        "checks": checks,
        "humanReviewPerformed": False,
        "fourthModelUsed": False,
        "RTNOpened": False,
        "COSOPerRowUsed": False,
        "hashOrManifestAdded": False,
    }
    (HERE / "generator-quality-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
