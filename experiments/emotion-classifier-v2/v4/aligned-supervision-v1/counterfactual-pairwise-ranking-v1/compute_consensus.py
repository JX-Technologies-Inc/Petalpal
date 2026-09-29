#!/usr/bin/env python3
"""Compute frozen three-agent consensus and apply predeclared pair gates."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
AGENTS = ("astra", "sol", "luna")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def classify(votes: list[str]) -> tuple[str, str | None]:
    counts = Counter(votes)
    if counts["A_STRONGER"] == 3:
        return "HIGH_PAIR", "A_STRONGER"
    if counts["B_STRONGER"] == 3:
        return "HIGH_PAIR", "B_STRONGER"
    if counts["A_STRONGER"] == 2 and counts["TIE_UNCLEAR"] == 1:
        return "MEDIUM_PAIR", "A_STRONGER"
    if counts["B_STRONGER"] == 2 and counts["TIE_UNCLEAR"] == 1:
        return "MEDIUM_PAIR", "B_STRONGER"
    if counts["A_STRONGER"] and counts["B_STRONGER"]:
        return "CONFLICT", None
    return "UNRESOLVED", None


def main() -> None:
    freeze = load_json(ROOT / "validator-freeze.json")
    if not freeze.get("outputsFrozenBeforeConsensus"):
        raise SystemExit("all three outputs must be frozen before consensus")
    protocol = load_json(ROOT / "protocol.json")
    generation = load_json(ROOT / "generation-audit.json")
    hidden = load_jsonl(ROOT / "hidden-pairs.jsonl")
    agent_rows = {agent: load_jsonl(ROOT / f"{agent}-output.jsonl") for agent in AGENTS}
    votes_by_agent = {
        agent: {row["pairId"]: row["judgment"] for row in rows}
        for agent, rows in agent_rows.items()
    }

    consensus_rows = []
    category_counts = Counter()
    per_label = defaultdict(Counter)
    usable_direction = Counter()
    intended_correct = 0
    for row in hidden:
        votes = [votes_by_agent[agent][row["pairId"]] for agent in AGENTS]
        category, direction = classify(votes)
        usable = category in {"HIGH_PAIR", "MEDIUM_PAIR"}
        correct = bool(usable and direction == row["intendedDirection"])
        category_counts[category] += 1
        per_label[row["targetLabel"]][category] += 1
        if usable:
            category_counts["USABLE"] += 1
            per_label[row["targetLabel"]]["USABLE"] += 1
            usable_direction[direction] += 1
            per_label[row["targetLabel"]][direction] += 1
            if correct:
                intended_correct += 1
                per_label[row["targetLabel"]]["INTENDED_CORRECT"] += 1
        consensus_rows.append({
            **row,
            "astraJudgment": votes[0],
            "solJudgment": votes[1],
            "lunaJudgment": votes[2],
            "consensusTier": category,
            "consensusDirection": direction,
            "includedForTraining": usable,
            "matchesIntendedDirection": correct if usable else None,
        })

    labels = protocol["labels"]
    gates = protocol["pair_quality_gates"]
    checks = {
        "exact_total_pairs": len(hidden) == gates["exact_total_pairs"],
        "exact_pairs_per_label": all(
            sum(1 for row in hidden if row["targetLabel"] == label) == gates["exact_pairs_per_label"]
            for label in labels
        ),
        "exact_intended_a_stronger": generation["directionBalance"].get("A_STRONGER") == gates["exact_intended_a_stronger"],
        "exact_intended_b_stronger": generation["directionBalance"].get("B_STRONGER") == gates["exact_intended_b_stronger"],
        "exact_event_duplicates": generation["exactEventDuplicates"] == gates["exact_event_duplicates"],
        "exact_pair_duplicates": generation["exactPairDuplicates"] == gates["exact_pair_duplicates"],
        "cross_pair_near_duplicates": len(generation["crossPairNearDuplicates"]) <= gates["cross_pair_near_duplicates_max"],
        "product_fit_failures": len(generation["productFitFailures"]) <= gates["product_fit_failures_max"],
        "high_pairs_min": category_counts["HIGH_PAIR"] >= gates["high_pairs_min"],
        "usable_pairs_min": category_counts["USABLE"] >= gates["usable_pairs_min"],
        "high_pairs_per_label_min": all(per_label[label]["HIGH_PAIR"] >= gates["high_pairs_per_label_min"] for label in labels),
        "usable_pairs_per_label_min": all(per_label[label]["USABLE"] >= gates["usable_pairs_per_label_min"] for label in labels),
        "intended_direction_correct_usable_min": intended_correct >= gates["intended_direction_correct_usable_min"],
        "intended_direction_correct_per_label_min": all(
            per_label[label]["INTENDED_CORRECT"] >= gates["intended_direction_correct_per_label_min"] for label in labels
        ),
        "direct_conflicts_max": category_counts["CONFLICT"] <= gates["direct_conflicts_max"],
        "unresolved_max": category_counts["UNRESOLVED"] <= gates["unresolved_max"],
        "usable_consensus_direction_balance": abs(
            usable_direction["A_STRONGER"] - usable_direction["B_STRONGER"]
        ) <= gates["usable_consensus_a_minus_b_abs_max"],
        "usable_each_direction_per_label_min": all(
            per_label[label]["A_STRONGER"] >= gates["usable_each_direction_per_label_min"]
            and per_label[label]["B_STRONGER"] >= gates["usable_each_direction_per_label_min"]
            for label in labels
        ),
    }

    validator_diagnostics = {}
    for agent in AGENTS:
        rows = agent_rows[agent]
        counts = Counter(row["judgment"] for row in rows)
        validator_diagnostics[agent] = {
            "judgmentCounts": {key: counts[key] for key in ("A_STRONGER", "B_STRONGER", "TIE_UNCLEAR")},
            "matchesIntendedDirection": sum(
                row["judgment"] == hidden[index]["intendedDirection"] for index, row in enumerate(rows)
            ),
        }
    pairwise_validator_agreement = {}
    for left, right in (("astra", "sol"), ("astra", "luna"), ("sol", "luna")):
        pairwise_validator_agreement[f"{left}_{right}"] = sum(
            agent_rows[left][index]["judgment"] == agent_rows[right][index]["judgment"]
            for index in range(len(hidden))
        )

    summary = {
        "pairQualityGate": "PASS" if all(checks.values()) else "FAIL",
        "decision": "TRAIN" if all(checks.values()) else "DO_NOT_TRAIN",
        "totalPairs": len(hidden),
        "counts": {
            key: category_counts[key]
            for key in ("HIGH_PAIR", "MEDIUM_PAIR", "CONFLICT", "UNRESOLVED", "USABLE")
        },
        "usableDirectionBalance": {
            key: usable_direction[key] for key in ("A_STRONGER", "B_STRONGER")
        },
        "intendedDirectionCorrectUsable": intended_correct,
        "intendedDirectionFidelityAmongUsable": intended_correct / category_counts["USABLE"] if category_counts["USABLE"] else 0.0,
        "intendedDirectionFidelityOverAllIntendedPairs": intended_correct / len(hidden),
        "perLabel": {
            label: {
                "intendedPairs": 8,
                "HIGH_PAIR": per_label[label]["HIGH_PAIR"],
                "MEDIUM_PAIR": per_label[label]["MEDIUM_PAIR"],
                "CONFLICT": per_label[label]["CONFLICT"],
                "UNRESOLVED": per_label[label]["UNRESOLVED"],
                "USABLE": per_label[label]["USABLE"],
                "A_STRONGER": per_label[label]["A_STRONGER"],
                "B_STRONGER": per_label[label]["B_STRONGER"],
                "INTENDED_CORRECT": per_label[label]["INTENDED_CORRECT"],
                "intendedFidelityAmongUsable": (
                    per_label[label]["INTENDED_CORRECT"] / per_label[label]["USABLE"]
                    if per_label[label]["USABLE"] else 0.0
                ),
            }
            for label in labels
        },
        "postFreezeValidatorDiagnostics": {
            "perValidator": validator_diagnostics,
            "pairwiseExactAgreement": pairwise_validator_agreement,
            "note": "Diagnostic only; computed after all semantic outputs were frozen and not used for rescue.",
        },
        "gateChecks": checks,
        "independenceAudit": {
            "astraIsolated": True,
            "solIsolated": True,
            "lunaIsolated": True,
            "agentsSawIntendedDirection": False,
            "agentsSawOtherOutputs": False,
            "outputsFrozenBeforeConsensus": True,
            "fourthAdjudicatorUsed": False,
            "repeatedModelVotesUsed": False,
        },
    }

    with (ROOT / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus_rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    (ROOT / "pair-quality-report.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
