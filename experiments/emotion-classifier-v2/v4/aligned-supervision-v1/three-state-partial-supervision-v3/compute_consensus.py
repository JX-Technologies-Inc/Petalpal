#!/usr/bin/env python3
"""Aggregate frozen V3 judgments with fixed HIGH+MEDIUM policy and integer gates."""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
V2_UTILITY = HERE.parent / "three-state-partial-supervision-v2/compute_consensus.py"
spec = importlib.util.spec_from_file_location("three_state_v2_consensus_utility", V2_UTILITY)
utility = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(utility)
LABELS = utility.LABELS
AGENTS = [HERE / "agent-a-labels.jsonl", HERE / "agent-b-labels.jsonl", HERE / "agent-c-labels.jsonl"]


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    generation = json.loads((HERE / "generation-audit.json").read_text(encoding="utf-8"))
    generated = utility.read_jsonl(HERE / "generator-output.jsonl")
    row_ids = [row["rowId"] for row in generated]
    agents = [utility.read_jsonl(path) for path in AGENTS]
    for rows in agents:
        utility.validate_agent(rows, row_ids)

    independence = {
        "astraRunIsolated": True, "solRunIsolated": True, "lunaRunIsolated": True,
        "agentsSawIntendedTargets": False, "agentsSawOtherAgentOutputs": False,
        "agentsSawIncumbentPredictions": False, "agentsSawRTNOrCOSO": False,
        "outputsFrozenBeforeConsensus": True, "crossAgentReviewOccurred": False,
        "fourthAdjudicatorUsed": False, "repeatedSameModelVotesUsed": False,
    }
    independence_passed = (
        independence["astraRunIsolated"] and independence["solRunIsolated"] and independence["lunaRunIsolated"]
        and not independence["agentsSawIntendedTargets"] and not independence["agentsSawOtherAgentOutputs"]
        and not independence["agentsSawIncumbentPredictions"] and not independence["agentsSawRTNOrCOSO"]
        and independence["outputsFrozenBeforeConsensus"] and not independence["crossAgentReviewOccurred"]
        and not independence["fourthAdjudicatorUsed"] and not independence["repeatedSameModelVotesUsed"]
    )

    consensus, tiers = [], Counter()
    direct_conflicts = 0
    per_label_direct = Counter()
    for index, source in enumerate(generated):
        cells, votes = {}, {}
        for label in LABELS:
            values = [rows[index]["judgments"][label] for rows in agents]
            votes[label] = values
            cells[label] = utility.tier(values)
            tiers[cells[label]] += 1
            if "POSITIVE" in values and "NEGATIVE" in values:
                direct_conflicts += 1
                per_label_direct[label] += 1
        consensus.append({"rowId": source["rowId"], "cells": cells, "agentVotes": votes})

    chosen = utility.policy_stats(consensus, generated, "HIGH_PLUS_MEDIUM_EQUAL_WEIGHT")
    gates = protocol["qualityGates"]
    fidelity = {}
    pos_hits_global = neg_hits_global = neg_high_global = 0
    for label in LABELS:
        intended_pos = [i for i, row in enumerate(generated) if label in row["intendedPositive"]]
        intended_neg = [i for i, row in enumerate(generated) if label in row["intendedNegative"]]
        pos_hits = sum(consensus[i]["cells"][label] in {"HIGH_POSITIVE", "MEDIUM_POSITIVE"} for i in intended_pos)
        neg_hits = sum(consensus[i]["cells"][label] in {"HIGH_NEGATIVE", "MEDIUM_NEGATIVE"} for i in intended_neg)
        neg_high = sum(consensus[i]["cells"][label] == "HIGH_NEGATIVE" for i in intended_neg)
        fidelity[label] = {
            "intendedPositive": len(intended_pos), "validatedPositive": chosen["perLabel"][label]["positive"],
            "intendedPositiveCombinedHit": pos_hits,
            "intendedNegative": len(intended_neg), "validatedNegative": chosen["perLabel"][label]["negative"],
            "intendedNegativeCombinedHit": neg_hits, "intendedNegativeHighHit": neg_high,
            "directPolarityConflictCells": per_label_direct[label],
            "uncertainCells": sum(consensus[i]["cells"][label] == "UNCERTAIN" for i in range(len(generated))),
        }
        pos_hits_global += pos_hits
        neg_hits_global += neg_hits
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
        "intendedPositiveCombinedGlobal": pos_hits_global >= gates["minIntendedPositiveCombinedHitsGlobal"],
        "intendedPositiveCombinedPerLabel": all(value["intendedPositiveCombinedHit"] >= gates["minIntendedPositiveCombinedHitsPerLabel"] for value in fidelity.values()),
        "intendedNegativeCombinedGlobal": neg_hits_global >= gates["minIntendedNegativeCombinedHitsGlobal"],
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
        "inclusionPolicy": protocol["inclusionPolicy"], "totalCells": total_cells,
        "tierCounts": {key: tiers[key] for key in ["HIGH_POSITIVE", "MEDIUM_POSITIVE", "HIGH_NEGATIVE", "MEDIUM_NEGATIVE", "UNCERTAIN"]},
        "directPolarityConflicts": direct_conflicts, "directPolarityConflictRate": direct_conflicts / total_cells,
        "chosenStats": chosen,
        "chosenPercentages": {"positive": chosen["positiveCells"] / total_cells, "negative": chosen["negativeCells"] / total_cells, "masked": chosen["maskedCells"] / total_cells},
        "generatorFidelity": fidelity,
        "globalGeneratorFidelity": {
            "intendedPositiveCombinedHits": pos_hits_global, "intendedPositiveCells": 108,
            "positiveCombinedRate": pos_hits_global / 108,
            "intendedNegativeCombinedHits": neg_hits_global, "intendedNegativeHighHits": neg_high_global,
            "intendedNegativeCells": 324, "negativeCombinedRate": neg_hits_global / 324,
            "negativeHighRate": neg_high_global / 324,
        },
        "agentStats": {
            name: dict(Counter(value for row in rows for value in row["judgments"].values()))
            for name, rows in zip(["astra", "sol", "luna"], agents)
        },
        "checks": checks, "independenceAudit": independence,
        "agentsFrozenBeforeAggregation": True, "humanReviewPerformed": False,
        "RTNOpened": False, "COSOPerRowUsed": False,
    }
    (HERE / "supervision-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
