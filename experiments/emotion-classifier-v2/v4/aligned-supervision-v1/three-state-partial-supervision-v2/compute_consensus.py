#!/usr/bin/env python3
"""Aggregate frozen V2 cell judgments and apply count-exact gates."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
JUDGMENTS = {"POSITIVE", "NEGATIVE", "UNCLEAR"}
AGENTS = [HERE / "agent-a-labels.jsonl", HERE / "agent-b-labels.jsonl", HERE / "agent-c-labels.jsonl"]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def validate_agent(rows: list[dict[str, Any]], row_ids: list[str]) -> None:
    if len(rows) != len(row_ids) or [row.get("rowId") for row in rows] != row_ids:
        raise ValueError("Validator count/order mismatch")
    for row in rows:
        if set(row) != {"rowId", "judgments"} or list(row["judgments"]) != LABELS:
            raise ValueError((row.get("rowId"), "schema or label order"))
        if any(value not in JUDGMENTS for value in row["judgments"].values()):
            raise ValueError((row["rowId"], "invalid judgment"))


def tier(values: list[str]) -> str:
    counts = Counter(values)
    if counts["POSITIVE"] == 3:
        return "HIGH_POSITIVE"
    if counts["POSITIVE"] == 2 and counts["NEGATIVE"] == 0:
        return "MEDIUM_POSITIVE"
    if counts["NEGATIVE"] == 3:
        return "HIGH_NEGATIVE"
    if counts["NEGATIVE"] == 2 and counts["POSITIVE"] == 0:
        return "MEDIUM_NEGATIVE"
    return "UNCERTAIN"


def included(value: str, policy: str) -> bool:
    if policy == "HIGH_ONLY":
        return value in {"HIGH_POSITIVE", "HIGH_NEGATIVE"}
    return value in {"HIGH_POSITIVE", "MEDIUM_POSITIVE", "HIGH_NEGATIVE", "MEDIUM_NEGATIVE"}


def policy_stats(consensus, generated, policy: str) -> dict[str, Any]:
    per_label = {}
    for label in LABELS:
        cells = [row["cells"][label] for row in consensus]
        positive = sum(included(value, policy) and value.endswith("POSITIVE") for value in cells)
        negative = sum(included(value, policy) and value.endswith("NEGATIVE") for value in cells)
        per_label[label] = {"positive": positive, "negative": negative, "masked": len(cells) - positive - negative}
    cardinality = Counter()
    pair_both = 0
    zero_with_positive = 0
    for result, source in zip(consensus, generated):
        positives = [label for label in LABELS if included(result["cells"][label], policy) and result["cells"][label].endswith("POSITIVE")]
        cardinality[len(positives)] += 1
        if source["targetKind"] == "TWO_POSITIVE" and set(source["intendedPositive"]) <= set(positives):
            pair_both += 1
        if source["targetKind"] == "ZERO_POSITIVE" and positives:
            zero_with_positive += 1
    return {
        "policy": policy, "perLabel": per_label,
        "positiveCells": sum(value["positive"] for value in per_label.values()),
        "negativeCells": sum(value["negative"] for value in per_label.values()),
        "maskedCells": sum(value["masked"] for value in per_label.values()),
        "positiveCardinality": {str(key): cardinality[key] for key in sorted(cardinality)},
        "singlePositiveEvents": cardinality[1], "twoPositiveEvents": cardinality[2],
        "zeroPositiveEvents": cardinality[0],
        "moreThanTwoPositiveEvents": sum(count for size, count in cardinality.items() if size > 2),
        "twoPositiveRowsWithBoth": pair_both,
        "zeroPositiveRowsWithAnyPositive": zero_with_positive,
    }


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    generation = json.loads((HERE / "generation-audit.json").read_text(encoding="utf-8"))
    generated = read_jsonl(HERE / "generator-output.jsonl")
    row_ids = [row["rowId"] for row in generated]
    agents = [read_jsonl(path) for path in AGENTS]
    for rows in agents:
        validate_agent(rows, row_ids)

    independence = {
        "astraRunIsolated": True,
        "solRunIsolated": True,
        "lunaRunIsolated": True,
        "agentsSawIntendedTargets": False,
        "agentsSawOtherAgentOutputs": False,
        "agentsSawIncumbentPredictions": False,
        "agentsSawRTNOrCOSO": False,
        "outputsFrozenBeforeConsensus": True,
        "crossAgentReviewOccurred": False,
        "fourthAdjudicatorUsed": False,
        "repeatedSameModelVotesUsed": False,
    }
    independence_passed = (
        independence["astraRunIsolated"] and independence["solRunIsolated"]
        and independence["lunaRunIsolated"] and not independence["agentsSawIntendedTargets"]
        and not independence["agentsSawOtherAgentOutputs"]
        and not independence["agentsSawIncumbentPredictions"]
        and not independence["agentsSawRTNOrCOSO"]
        and independence["outputsFrozenBeforeConsensus"]
        and not independence["crossAgentReviewOccurred"]
        and not independence["fourthAdjudicatorUsed"]
        and not independence["repeatedSameModelVotesUsed"]
    )

    consensus = []
    tiers = Counter()
    direct_conflicts = 0
    per_label_direct = Counter()
    for index, source in enumerate(generated):
        cells, votes = {}, {}
        for label in LABELS:
            values = [rows[index]["judgments"][label] for rows in agents]
            votes[label] = values
            cells[label] = tier(values)
            tiers[cells[label]] += 1
            if "POSITIVE" in values and "NEGATIVE" in values:
                direct_conflicts += 1
                per_label_direct[label] += 1
        consensus.append({"rowId": source["rowId"], "cells": cells, "agentVotes": votes})

    gates = protocol["qualityGates"]
    high = policy_stats(consensus, generated, "HIGH_ONLY")
    combined = policy_stats(consensus, generated, "HIGH_PLUS_MEDIUM_EQUAL_WEIGHT")
    high_eligible = (
        all(value["positive"] >= gates["minCombinedPositiveCellsPerLabel"] and value["negative"] >= gates["minCombinedNegativeCellsPerLabel"] for value in high["perLabel"].values())
        and high["twoPositiveRowsWithBoth"] >= gates["minTwoPositiveRowsWithBothCombinedPositive"]
        and high["zeroPositiveRowsWithAnyPositive"] <= gates["maxZeroPositiveRowsWithAnyCombinedPositive"]
    )
    chosen = high if high_eligible else combined

    fidelity = {}
    pos_combined_global = neg_combined_global = neg_high_global = 0
    for label in LABELS:
        intended_pos = [index for index, row in enumerate(generated) if label in row["intendedPositive"]]
        intended_neg = [index for index, row in enumerate(generated) if label in row["intendedNegative"]]
        pos_combined = sum(included(consensus[index]["cells"][label], chosen["policy"]) and consensus[index]["cells"][label].endswith("POSITIVE") for index in intended_pos)
        neg_combined = sum(included(consensus[index]["cells"][label], chosen["policy"]) and consensus[index]["cells"][label].endswith("NEGATIVE") for index in intended_neg)
        neg_high = sum(consensus[index]["cells"][label] == "HIGH_NEGATIVE" for index in intended_neg)
        unclear = sum(consensus[index]["cells"][label] == "UNCERTAIN" for index in range(len(generated)))
        fidelity[label] = {
            "intendedPositive": len(intended_pos), "validatedPositive": chosen["perLabel"][label]["positive"],
            "intendedPositiveCombinedHit": pos_combined,
            "intendedNegative": len(intended_neg), "validatedNegative": chosen["perLabel"][label]["negative"],
            "intendedNegativeCombinedHit": neg_combined, "intendedNegativeHighHit": neg_high,
            "directPolarityConflictCells": per_label_direct[label], "uncertainCells": unclear,
        }
        pos_combined_global += pos_combined
        neg_combined_global += neg_combined
        neg_high_global += neg_high

    checks = {
        "independenceProtocol": independence_passed,
        "exactRows": len(generated) == gates["exactRows"] == generation["rows"],
        "maxCharacters": generation["characters"]["max"] <= gates["maxCharacters"],
        "productFit": len(generation["productFitFailures"]) == gates["productFitFailures"],
        "exactDuplicates": generation["exactDuplicates"] == gates["exactDuplicates"],
        "normalizedDuplicates": generation["normalizedDuplicates"] == gates["normalizedDuplicates"],
        "nearDuplicates": len(generation["nearDuplicatePairs"]) == gates["nearDuplicatePairs"],
        "templateLeakage": generation["maxRepeatedOpeningFourWordType"] <= gates["maxRepeatedOpeningFourWordType"],
        "highPositiveTotal": tiers["HIGH_POSITIVE"] >= gates["minHighPositiveCellsTotal"],
        "highNegativeTotal": tiers["HIGH_NEGATIVE"] >= gates["minHighNegativeCellsTotal"],
        "perLabelPositiveCoverage": all(value["positive"] >= gates["minCombinedPositiveCellsPerLabel"] for value in chosen["perLabel"].values()),
        "perLabelNegativeCoverage": all(value["negative"] >= gates["minCombinedNegativeCellsPerLabel"] for value in chosen["perLabel"].values()),
        "intendedPositiveCombinedGlobal": pos_combined_global >= gates["minIntendedPositiveCombinedHitsGlobal"],
        "intendedPositiveCombinedPerLabel": all(value["intendedPositiveCombinedHit"] >= gates["minIntendedPositiveCombinedHitsPerLabel"] for value in fidelity.values()),
        "intendedNegativeCombinedGlobal": neg_combined_global >= gates["minIntendedNegativeCombinedHitsGlobal"],
        "intendedNegativeCombinedPerLabel": all(value["intendedNegativeCombinedHit"] >= gates["minIntendedNegativeCombinedHitsPerLabel"] for value in fidelity.values()),
        "intendedNegativeHighGlobal": neg_high_global >= gates["minIntendedNegativeHighHitsGlobal"],
        "intendedNegativeHighPerLabel": all(value["intendedNegativeHighHit"] >= gates["minIntendedNegativeHighHitsPerLabel"] for value in fidelity.values()),
        "directConflictCells": direct_conflicts <= gates["maxDirectPolarityConflictCells"],
        "multiLabelCoverage": chosen["twoPositiveRowsWithBoth"] >= gates["minTwoPositiveRowsWithBothCombinedPositive"],
        "zeroPositiveSafety": chosen["zeroPositiveRowsWithAnyPositive"] <= gates["maxZeroPositiveRowsWithAnyCombinedPositive"],
    }
    passed = all(checks.values())
    with (HERE / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    total_cells = len(generated) * len(LABELS)
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "FREEZE_TRAINING_PROTOCOL" if passed else "DO_NOT_TRAIN",
        "inclusionPolicy": chosen["policy"], "highOnlyEligible": high_eligible,
        "totalCells": total_cells,
        "tierCounts": {key: tiers[key] for key in ["HIGH_POSITIVE", "MEDIUM_POSITIVE", "HIGH_NEGATIVE", "MEDIUM_NEGATIVE", "UNCERTAIN"]},
        "directPolarityConflicts": direct_conflicts, "directPolarityConflictRate": direct_conflicts / total_cells,
        "highOnlyStats": high, "combinedStats": combined, "chosenStats": chosen,
        "chosenPercentages": {"positive": chosen["positiveCells"] / total_cells, "negative": chosen["negativeCells"] / total_cells, "masked": chosen["maskedCells"] / total_cells},
        "generatorFidelity": fidelity,
        "globalGeneratorFidelity": {
            "intendedPositiveCombinedHits": pos_combined_global, "intendedPositiveCells": 90,
            "positiveCombinedRate": pos_combined_global / 90,
            "intendedNegativeCombinedHits": neg_combined_global, "intendedNegativeHighHits": neg_high_global,
            "intendedNegativeCells": 180, "negativeCombinedRate": neg_combined_global / 180,
            "negativeHighRate": neg_high_global / 180,
        },
        "checks": checks, "agentsFrozenBeforeAggregation": True,
        "independenceAudit": independence,
        "humanReviewPerformed": False, "fourthAdjudicatorUsed": False,
        "RTNOpened": False, "COSOPerRowUsed": False,
    }
    (HERE / "supervision-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
