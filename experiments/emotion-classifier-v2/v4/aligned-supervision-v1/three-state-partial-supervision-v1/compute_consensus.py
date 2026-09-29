#!/usr/bin/env python3
"""Aggregate frozen independent three-state cell judgments and apply frozen gates."""

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


def included(cell: str, policy: str) -> bool:
    if policy == "HIGH_ONLY":
        return cell in {"HIGH_POSITIVE", "HIGH_NEGATIVE"}
    return cell in {"HIGH_POSITIVE", "MEDIUM_POSITIVE", "HIGH_NEGATIVE", "MEDIUM_NEGATIVE"}


def stats_for(consensus: list[dict[str, Any]], generated: list[dict[str, Any]], policy: str) -> dict[str, Any]:
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
        "policy": policy,
        "perLabel": per_label,
        "positiveCells": sum(value["positive"] for value in per_label.values()),
        "negativeCells": sum(value["negative"] for value in per_label.values()),
        "maskedCells": sum(value["masked"] for value in per_label.values()),
        "positiveCardinality": {str(key): cardinality[key] for key in sorted(cardinality)},
        "singlePositiveEvents": cardinality[1],
        "twoPositiveEvents": cardinality[2],
        "zeroPositiveEvents": cardinality[0],
        "moreThanTwoPositiveEvents": sum(value for key, value in cardinality.items() if key > 2),
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

    consensus = []
    tier_counts = Counter()
    direct_conflicts = 0
    per_label_direct = Counter()
    for index, source in enumerate(generated):
        cells = {}
        votes = {}
        for label in LABELS:
            values = [rows[index]["judgments"][label] for rows in agents]
            votes[label] = values
            cells[label] = tier(values)
            tier_counts[cells[label]] += 1
            if "POSITIVE" in values and "NEGATIVE" in values:
                direct_conflicts += 1
                per_label_direct[label] += 1
        consensus.append({"rowId": source["rowId"], "cells": cells, "agentVotes": votes})

    high = stats_for(consensus, generated, "HIGH_ONLY")
    combined = stats_for(consensus, generated, "HIGH_PLUS_MEDIUM_EQUAL_WEIGHT")
    gates = protocol["qualityGates"]
    high_policy_eligible = (
        all(value["positive"] >= gates["minCombinedPositiveCellsPerLabel"] and value["negative"] >= gates["minCombinedNegativeCellsPerLabel"] for value in high["perLabel"].values())
        and high["twoPositiveRowsWithBoth"] >= gates["minTwoPositiveRowsWithBothCombinedPositive"]
        and high["zeroPositiveRowsWithAnyPositive"] <= gates["maxZeroPositiveRowsWithAnyCombinedPositive"]
    )
    chosen = high if high_policy_eligible else combined

    fidelity = {}
    global_pos_hit = global_pos_n = global_neg_hit = global_neg_n = 0
    for label in LABELS:
        intended_pos = [i for i, row in enumerate(generated) if label in row["intendedPositive"]]
        intended_neg = [i for i, row in enumerate(generated) if label in row["intendedNegative"]]
        pos_hit = sum(included(consensus[i]["cells"][label], chosen["policy"]) and consensus[i]["cells"][label].endswith("POSITIVE") for i in intended_pos)
        neg_hit = sum(included(consensus[i]["cells"][label], chosen["policy"]) and consensus[i]["cells"][label].endswith("NEGATIVE") for i in intended_neg)
        unclear = sum(consensus[i]["cells"][label] == "UNCERTAIN" for i in range(len(generated)))
        fidelity[label] = {
            "intendedPositive": len(intended_pos), "validatedPositive": chosen["perLabel"][label]["positive"],
            "intendedPositiveValidatedPositive": pos_hit, "positiveFidelity": pos_hit / len(intended_pos),
            "intendedNegative": len(intended_neg), "validatedNegative": chosen["perLabel"][label]["negative"],
            "intendedNegativeValidatedNegative": neg_hit, "negativeFidelity": neg_hit / len(intended_neg),
            "directPolarityConflictRate": per_label_direct[label] / len(generated),
            "unclearRate": unclear / len(generated),
        }
        global_pos_hit += pos_hit
        global_pos_n += len(intended_pos)
        global_neg_hit += neg_hit
        global_neg_n += len(intended_neg)

    total_cells = len(generated) * len(LABELS)
    checks = {
        "exactRows": len(generated) == gates["exactRows"] == generation["rows"],
        "maxCharacters": generation["characters"]["max"] <= gates["maxCharacters"],
        "productFit": len(generation["productFitFailures"]) == gates["productFitFailures"],
        "exactDuplicates": generation["exactDuplicates"] == gates["exactDuplicates"],
        "normalizedDuplicates": generation["normalizedDuplicates"] == gates["normalizedDuplicates"],
        "nearDuplicates": len(generation["nearDuplicatePairs"]) == gates["nearDuplicatePairs"],
        "templateLeakage": generation["maxRepeatedOpeningFourWordType"] <= gates["maxRepeatedOpeningFourWordType"],
        "perLabelPositiveCoverage": all(value["positive"] >= gates["minCombinedPositiveCellsPerLabel"] for value in chosen["perLabel"].values()),
        "perLabelNegativeCoverage": all(value["negative"] >= gates["minCombinedNegativeCellsPerLabel"] for value in chosen["perLabel"].values()),
        "highPositiveAgreement": tier_counts["HIGH_POSITIVE"] >= gates["minHighPositiveCellsTotal"],
        "highNegativeAgreement": tier_counts["HIGH_NEGATIVE"] >= gates["minHighNegativeCellsTotal"],
        "directConflictRate": direct_conflicts / total_cells <= gates["maxDirectPolarityConflictRateAllCells"],
        "multiLabelCoverage": chosen["twoPositiveRowsWithBoth"] >= gates["minTwoPositiveRowsWithBothCombinedPositive"],
        "zeroPositiveRestraint": chosen["zeroPositiveRowsWithAnyPositive"] <= gates["maxZeroPositiveRowsWithAnyCombinedPositive"],
        "globalPositiveFidelity": global_pos_hit / global_pos_n >= gates["minGlobalPositiveFidelity"],
        "globalNegativeFidelity": global_neg_hit / global_neg_n >= gates["minGlobalNegativeFidelity"],
        "perLabelPositiveFidelity": all(value["positiveFidelity"] >= gates["minPerLabelPositiveFidelity"] for value in fidelity.values()),
        "perLabelNegativeFidelity": all(value["negativeFidelity"] >= gates["minPerLabelNegativeFidelity"] for value in fidelity.values()),
    }
    passed = all(checks.values())
    with (HERE / "consensus.jsonl").open("w", encoding="utf-8") as handle:
        for row in consensus:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "FREEZE_TRAINING_PROTOCOL" if passed else "DO_NOT_TRAIN",
        "inclusionPolicy": chosen["policy"],
        "highOnlyEligible": high_policy_eligible,
        "totalCells": total_cells,
        "tierCounts": {key: tier_counts[key] for key in ["HIGH_POSITIVE", "MEDIUM_POSITIVE", "HIGH_NEGATIVE", "MEDIUM_NEGATIVE", "UNCERTAIN"]},
        "directPolarityConflicts": direct_conflicts,
        "directPolarityConflictRate": direct_conflicts / total_cells,
        "highOnlyStats": high,
        "combinedStats": combined,
        "chosenStats": chosen,
        "chosenPercentages": {
            "positive": chosen["positiveCells"] / total_cells,
            "negative": chosen["negativeCells"] / total_cells,
            "masked": chosen["maskedCells"] / total_cells,
        },
        "generatorFidelity": fidelity,
        "globalGeneratorFidelity": {"positive": global_pos_hit / global_pos_n, "negative": global_neg_hit / global_neg_n},
        "checks": checks,
        "agentsFrozenBeforeAggregation": True,
        "humanReviewPerformed": False,
        "fourthAdjudicatorUsed": False,
        "RTNOpened": False,
        "COSOPerRowUsed": False,
    }
    (HERE / "supervision-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
