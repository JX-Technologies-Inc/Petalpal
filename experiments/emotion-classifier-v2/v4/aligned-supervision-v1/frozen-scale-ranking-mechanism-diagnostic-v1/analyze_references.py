#!/usr/bin/env python3
"""Analyze frozen references only after the training-side mechanism freeze exists."""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
FREEZE_PATH = HERE / "mechanism-freeze.json"
PROTOCOL_PATH = HERE / "protocol.json"
PARAMETERS_PATH = HERE / "affine-parameters.json"
VALIDATION_PATH = HERE / "training-validation-report.json"
OUTPUT_PATH = HERE / "reference-analysis.json"
SCORES_PATH = HERE / "reference-scores.npz"
COSO_PATH = ALIGNED / "dev.jsonl"
RTN_TEXT_PATH = V4 / "model-consensus-reference-300-v1/frozen-reference-300.jsonl"
RTN_CONSENSUS_PATH = V4 / "model-consensus-reference-300-v1/consensus.jsonl"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def label_positions(model: Any, labels: list[str]) -> list[int]:
    mapping = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    positions = []
    for label in labels:
        matches = [index for index, value in mapping.items() if value == label]
        if len(matches) != 1:
            raise ValueError(f"Checkpoint label mapping for {label!r} has {len(matches)} matches")
        positions.append(matches[0])
    if model.config.num_labels != 28:
        raise ValueError(f"Expected frozen 28-logit checkpoint, found {model.config.num_labels}")
    return positions


def predict_logits(texts: list[str], checkpoint: Path, labels: list[str]) -> np.ndarray:
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True).eval()
    positions = label_positions(model, labels)
    model.to(torch.device("cpu"))
    output = np.empty((len(texts), len(labels)), dtype=np.float64)
    with torch.inference_mode():
        for start in range(0, len(texts), 32):
            batch = texts[start:start + 32]
            encoded = tokenizer(batch, padding=True, truncation=True, max_length=512, return_tensors="pt")
            logits = model(**encoded).logits[:, positions].cpu().numpy()
            output[start:start + len(batch)] = logits
    del model, tokenizer
    return output


def selector_stages(logits21: np.ndarray, protocol: dict[str, Any]) -> list[dict[str, Any]]:
    canonical = protocol["canonicalLabelOrder"]
    product = set(protocol["labels"])
    excluded = set(protocol["selector"]["excluded"])
    threshold_logit = math.log(protocol["selector"]["threshold"] / (1 - protocol["selector"]["threshold"]))
    cluster_by_label = {
        label: cluster
        for cluster, members in protocol["selector"]["clusters"].items()
        for label in members
    }
    results = []
    for row in logits21:
        threshold_all = {canonical[index] for index, value in enumerate(row) if value >= threshold_logit}
        ranked = [
            (index, canonical[index], float(row[index]))
            for index in range(len(canonical))
            if canonical[index] in product and canonical[index] not in excluded and row[index] >= threshold_logit
        ]
        ranked.sort(key=lambda item: (-item[2], item[0]))
        threshold_product = {label for _, label, _ in ranked}
        cluster_order: list[str] = []
        used: set[str] = set()
        for _, label, _ in ranked:
            cluster = cluster_by_label.get(label, label)
            if cluster in used:
                continue
            used.add(cluster)
            cluster_order.append(label)
        final = tuple(cluster_order[:protocol["selector"]["maxOutputs"]])
        tied_pairs = []
        for left in range(len(ranked)):
            for right in range(left + 1, len(ranked)):
                if ranked[left][2] == ranked[right][2]:
                    tied_pairs.append([ranked[left][1], ranked[right][1]])
        results.append({
            "thresholdAll": threshold_all,
            "thresholdProduct": threshold_product,
            "clusterSurvivors": set(cluster_order),
            "clusterOrder": tuple(cluster_order),
            "final": final,
            "productFiltered": threshold_all - threshold_product,
            "clusterFiltered": threshold_product - set(cluster_order),
            "max2Filtered": set(cluster_order) - set(final),
            "tiedPairs": tied_pairs,
        })
    return results


def selector_summary(stages: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "rows": len(stages),
        "thresholdPassingCanonical21Memberships": sum(len(row["thresholdAll"]) for row in stages),
        "product18FilteredMemberships": sum(len(row["productFiltered"]) for row in stages),
        "clusterFilteredMemberships": sum(len(row["clusterFiltered"]) for row in stages),
        "max2FilteredMemberships": sum(len(row["max2Filtered"]) for row in stages),
        "rowsWithExactThresholdedScoreTie": sum(bool(row["tiedPairs"]) for row in stages),
    }


def change_attribution(candidate: list[dict[str, Any]], incumbent: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {
        direction: {stage: 0 for stage in ["thresholdCrossing", "product18Filtering", "clusterConstraint", "max2Truncation", "tieBreaking", "unclassified"]}
        for direction in ["additions", "removals"]
    }
    examples = 0
    for cand, inc in zip(candidate, incumbent):
        cand_final, inc_final = set(cand["final"]), set(inc["final"])
        events = [("additions", label) for label in cand_final - inc_final]
        events += [("removals", label) for label in inc_final - cand_final]
        examples += bool(events)
        for direction, label in events:
            if (label in cand["thresholdProduct"]) != (label in inc["thresholdProduct"]):
                stage = "thresholdCrossing"
            elif (label in cand["clusterSurvivors"]) != (label in inc["clusterSurvivors"]):
                stage = "clusterConstraint"
            elif (label in cand_final) != (label in inc_final):
                stage = "max2Truncation"
            else:
                stage = "unclassified"
            if stage in {"clusterConstraint", "max2Truncation"} and (cand["tiedPairs"] or inc["tiedPairs"]):
                tied_labels = {value for pair in cand["tiedPairs"] + inc["tiedPairs"] for value in pair}
                if label in tied_labels:
                    stage = "tieBreaking"
            counts[direction][stage] += 1
    counts["rowsWithAnyFinalOutputChange"] = examples
    counts["totalAdditions"] = sum(counts["additions"].values())
    counts["totalRemovals"] = sum(counts["removals"].values())
    return counts


def average_precision(truth: np.ndarray, scores: np.ndarray) -> float | None:
    positives = int(truth.sum())
    if positives == 0:
        return None
    order = np.argsort(-scores, kind="stable")
    ranked = truth[order].astype(np.int64)
    return float((np.cumsum(ranked)[ranked == 1] / (np.flatnonzero(ranked == 1) + 1)).sum() / positives)


def ap_report(truth: np.ndarray, score_by_model: dict[str, np.ndarray], labels: list[str]) -> dict[str, Any]:
    rows = len(truth)
    supports = truth.sum(axis=0).astype(int)
    stable = [index for index, support in enumerate(supports) if support >= 5 and rows - support >= 5]
    per_label: dict[str, Any] = {}
    for index, label in enumerate(labels):
        values = {model: average_precision(truth[:, index], scores[:, index]) for model, scores in score_by_model.items()}
        per_label[label] = {
            "positives": int(supports[index]),
            "negatives": int(rows - supports[index]),
            "stable": index in stable,
            "ap": values,
            "deltaVsIncumbent": {
                model: (value - values["incumbent"] if value is not None and values["incumbent"] is not None else None)
                for model, value in values.items() if model != "incumbent"
            },
        }
    macro = {
        model: float(np.mean([per_label[labels[index]]["ap"][model] for index in stable]))
        for model in score_by_model
    } if stable else {model: None for model in score_by_model}
    return {
        "rows": rows,
        "stableLabelCount": len(stable),
        "stableLabels": [labels[index] for index in stable],
        "supportSufficientForGate": len(stable) >= 8,
        "supportedLabelMacroAP": macro,
        "perLabel": per_label,
    }


def bootstrap_ap_deltas(
    truth: np.ndarray,
    score_by_model: dict[str, np.ndarray],
    labels: list[str],
    stable_labels: list[str],
    groups: list[str],
    replicates: int,
    seed: int,
) -> dict[str, Any]:
    stable = [labels.index(label) for label in stable_labels]
    unique = list(dict.fromkeys(groups))
    members = {group: np.flatnonzero(np.asarray(groups) == group) for group in unique}
    rng = np.random.default_rng(seed)
    deltas = {model: [] for model in score_by_model if model != "incumbent"}
    for _ in range(replicates):
        chosen = rng.choice(unique, size=len(unique), replace=True)
        indices = np.concatenate([members[str(group)] for group in chosen])
        incumbent_values = [average_precision(truth[indices, label], score_by_model["incumbent"][indices, label]) for label in stable]
        for model in deltas:
            candidate_values = [average_precision(truth[indices, label], score_by_model[model][indices, label]) for label in stable]
            paired = [candidate - incumbent for candidate, incumbent in zip(candidate_values, incumbent_values) if candidate is not None and incumbent is not None]
            deltas[model].append(float(np.mean(paired)) if paired else float("nan"))
    report = {}
    for model, values in deltas.items():
        finite = np.asarray([value for value in values if np.isfinite(value)], dtype=np.float64)
        report[model] = {
            "replicates": int(len(finite)),
            "delta95Interval": [float(np.quantile(finite, 0.025)), float(np.quantile(finite, 0.975))],
        }
    return report


def prediction_metrics(truth: list[set[str]], stages: list[dict[str, Any]], labels: list[str]) -> dict[str, Any]:
    outputs = [set(row["final"]) for row in stages]
    tp = sum(len(expected & predicted) for expected, predicted in zip(truth, outputs))
    fp = sum(len(predicted - expected) for expected, predicted in zip(truth, outputs))
    fn = sum(len(expected - predicted) for expected, predicted in zip(truth, outputs))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    micro_f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    per_label_f1 = []
    for label in labels:
        label_tp = sum(label in expected and label in predicted for expected, predicted in zip(truth, outputs))
        label_fp = sum(label not in expected and label in predicted for expected, predicted in zip(truth, outputs))
        label_fn = sum(label in expected and label not in predicted for expected, predicted in zip(truth, outputs))
        denominator = 2 * label_tp + label_fp + label_fn
        per_label_f1.append(2 * label_tp / denominator if denominator else 0.0)
    return {
        "microF1": micro_f1,
        "macroF1All18": float(np.mean(per_label_f1)),
        "exactSet": sum(expected == predicted for expected, predicted in zip(truth, outputs)) / len(truth),
        "falsePositives": fp,
        "falseNegatives": fn,
        "outputCountDistribution": dict(sorted(Counter(len(output) for output in outputs).items())),
    }


def extra_change_truth(candidate: list[dict[str, Any]], incumbent: list[dict[str, Any]], truth: list[set[str]]) -> dict[str, int]:
    result = {"extraTruePositives": 0, "extraFalsePositives": 0, "removedTruePositives": 0, "removedFalsePositives": 0}
    for cand, inc, expected in zip(candidate, incumbent, truth):
        additions = set(cand["final"]) - set(inc["final"])
        removals = set(inc["final"]) - set(cand["final"])
        result["extraTruePositives"] += len(additions & expected)
        result["extraFalsePositives"] += len(additions - expected)
        result["removedTruePositives"] += len(removals & expected)
        result["removedFalsePositives"] += len(removals - expected)
    return result


def representability(truth: list[set[str]], protocol: dict[str, Any]) -> dict[str, int]:
    product = set(protocol["labels"])
    cluster_by_label = {
        label: cluster
        for cluster, members in protocol["selector"]["clusters"].items()
        for label in members
    }
    reason_counts = Counter()
    not_representable = 0
    for expected in truth:
        reasons = []
        if expected - product:
            reasons.append("outsideProduct18")
        if len(expected) > protocol["selector"]["maxOutputs"]:
            reasons.append("moreThanTwoTargets")
        clusters = [cluster_by_label.get(label, label) for label in expected if label in product]
        if len(clusters) != len(set(clusters)):
            reasons.append("sameClusterConflict")
        if reasons:
            not_representable += 1
            reason_counts.update(reasons)
    return {
        "rows": len(truth),
        "notRepresentableRows": not_representable,
        "representableRows": len(truth) - not_representable,
        **{reason: reason_counts[reason] for reason in ["outsideProduct18", "moreThanTwoTargets", "sameClusterConflict"]},
    }


def build_reference_report(
    name: str,
    truth: list[set[str]],
    groups: list[str],
    model_logits21: dict[str, np.ndarray],
    reset_logits21: dict[str, np.ndarray],
    protocol: dict[str, Any],
    seed_offset: int,
) -> dict[str, Any]:
    labels = protocol["labels"]
    canonical = protocol["canonicalLabelOrder"]
    product_positions = [canonical.index(label) for label in labels]
    score_by_model = {model: logits[:, product_positions] for model, logits in model_logits21.items()}
    ap = ap_report(np.asarray([[label in expected for label in labels] for expected in truth], dtype=bool), score_by_model, labels)
    bootstrap = bootstrap_ap_deltas(
        np.asarray([[label in expected for label in labels] for expected in truth], dtype=bool),
        score_by_model,
        labels,
        ap["stableLabels"],
        groups,
        protocol["referenceAnalysis"]["bootstrap"]["replicates"],
        protocol["referenceAnalysis"]["bootstrap"]["seed"] + seed_offset,
    ) if ap["stableLabels"] else {}
    stages = {model: selector_stages(logits, protocol) for model, logits in model_logits21.items()}
    reset_stages = {model: selector_stages(logits, protocol) for model, logits in reset_logits21.items()}
    incumbent = stages["incumbent"]
    candidates = [model for model in stages if model != "incumbent"]
    return {
        "name": name,
        "rows": len(truth),
        "sourceGroups": len(set(groups)),
        "averagePrecision": ap,
        "pairedBootstrapMacroAPDelta": bootstrap,
        "predictionMetrics": {model: prediction_metrics(truth, value, labels) for model, value in stages.items()},
        "selectorStageSummary": {model: selector_summary(value) for model, value in stages.items()},
        "candidateVsIncumbentAttribution": {model: change_attribution(stages[model], incumbent) for model in candidates},
        "scaleReset": {
            model: {
                "actualVsIncumbentChanges": extra_change_truth(stages[model], incumbent, truth),
                "resetVsIncumbentChanges": extra_change_truth(reset_stages[model], incumbent, truth),
                "actualOutputMembershipDisagreements": sum(len(set(left["final"]) ^ set(right["final"])) for left, right in zip(stages[model], incumbent)),
                "resetOutputMembershipDisagreements": sum(len(set(left["final"]) ^ set(right["final"])) for left, right in zip(reset_stages[model], incumbent)),
                "resetExactAgreementWithIncumbent": sum(set(left["final"]) == set(right["final"]) for left, right in zip(reset_stages[model], incumbent)) / len(incumbent),
                "resetPredictionMetrics": prediction_metrics(truth, reset_stages[model], labels),
            }
            for model in candidates
        },
        "referenceRepresentability": representability(truth, protocol),
    }


def main() -> None:
    for path in (OUTPUT_PATH, SCORES_PATH):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite frozen diagnostic artifact: {path}")
    freeze = json.loads(FREEZE_PATH.read_text(encoding="utf-8"))
    if freeze["status"] != "MECHANISM_PARAMETERS_FROZEN_BEFORE_RTN_COSO":
        raise ValueError("Training-side mechanism parameters were not frozen before reference access")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    parameters = json.loads(PARAMETERS_PATH.read_text(encoding="utf-8"))
    validation = json.loads(VALIDATION_PATH.read_text(encoding="utf-8"))

    coso_rows = read_jsonl(COSO_PATH)
    rtn_text_rows = read_jsonl(RTN_TEXT_PATH)
    rtn_consensus_rows = read_jsonl(RTN_CONSENSUS_PATH)
    if [row["rowId"] for row in rtn_text_rows] != [row["rowId"] for row in rtn_consensus_rows]:
        raise ValueError("RTN text and consensus row alignment failed")
    resolved = [index for index, row in enumerate(rtn_consensus_rows) if row["consensusStatus"] != "UNRESOLVED"]
    reference_rows = {
        "coso": coso_rows,
        "rtn_resolved": [rtn_text_rows[index] for index in resolved],
    }
    texts = [row["journal"] for row in coso_rows] + [rtn_text_rows[index]["text"] for index in resolved]
    boundary = len(coso_rows)
    model_paths = {name: Path(path) for name, path in freeze["checkpoints"].items()}
    logits_by_reference: dict[str, dict[str, np.ndarray]] = {"coso": {}, "rtn_resolved": {}}
    score_arrays: dict[str, np.ndarray] = {}
    for model, checkpoint in model_paths.items():
        logits = predict_logits(texts, checkpoint, protocol["canonicalLabelOrder"])
        logits_by_reference["coso"][model] = logits[:boundary]
        logits_by_reference["rtn_resolved"][model] = logits[boundary:]
        score_arrays[f"coso__{model}"] = logits[:boundary]
        score_arrays[f"rtn_resolved__{model}"] = logits[boundary:]
    np.savez_compressed(SCORES_PATH, **score_arrays)

    reset_by_reference: dict[str, dict[str, np.ndarray]] = {"coso": {}, "rtn_resolved": {}}
    canonical = protocol["canonicalLabelOrder"]
    product_positions = [canonical.index(label) for label in protocol["labels"]]
    for reference in reset_by_reference:
        reset_by_reference[reference]["incumbent"] = logits_by_reference[reference]["incumbent"].copy()
        for candidate in parameters["candidates"]:
            a = np.asarray([parameters["candidates"][candidate][label]["a"] for label in protocol["labels"]])
            b = np.asarray([parameters["candidates"][candidate][label]["b"] for label in protocol["labels"]])
            if np.any(a <= 0.05):
                raise ValueError(f"Scale reset unsupported for {candidate}: a <= 0.05")
            reset = logits_by_reference[reference][candidate].copy()
            reset[:, product_positions] = (reset[:, product_positions] - b) / a
            reset_by_reference[reference][candidate] = reset

    coso_truth = [set(row["modelLabels"]) for row in coso_rows]
    rtn_truth = [set(rtn_consensus_rows[index]["consensusLabels"]) for index in resolved]
    coso_groups = [str(row.get("sourceGroupId") or row["id"]) for row in coso_rows]
    rtn_groups = [str(rtn_text_rows[index].get("sourceGroup") or rtn_text_rows[index]["rowId"]) for index in resolved]
    reports = {
        "coso": build_reference_report("COSO historical model-labeled development diagnostic", coso_truth, coso_groups, logits_by_reference["coso"], reset_by_reference["coso"], protocol, 0),
        "rtnResolved": build_reference_report("RTN model-consensus short-Event research diagnostic — resolved subset", rtn_truth, rtn_groups, logits_by_reference["rtn_resolved"], reset_by_reference["rtn_resolved"], protocol, 10000),
    }

    gate_candidates = ["pu_v1", "prototype_v1"]
    supported_parts = {}
    falsified_a = {}
    falsified_b = {}
    for candidate in gate_candidates:
        source_results = validation["candidates"][candidate]
        affine_supported = all(value["aggregateExplainedVariation"] >= 0.80 for value in source_results.values())
        change_supported = all(value["outputChangeReproduction"]["f1"] >= 0.80 for value in source_results.values())
        ap_supported = all(
            reports[reference]["averagePrecision"]["supportSufficientForGate"]
            and reports[reference]["pairedBootstrapMacroAPDelta"][candidate]["delta95Interval"][1] < 0.02
            for reference in ["coso", "rtnResolved"]
        )
        supported_parts[candidate] = {"affine": affine_supported, "outputChange": change_supported, "macroAP": ap_supported}
        falsified_a[candidate] = all(
            value["aggregateExplainedVariation"] < 0.50 and value["outputChangeReproduction"]["f1"] < 0.50
            for value in source_results.values()
        )
        falsified_b[candidate] = all(
            reports[reference]["averagePrecision"]["supportSufficientForGate"]
            and reports[reference]["averagePrecision"]["supportedLabelMacroAP"][candidate]
                - reports[reference]["averagePrecision"]["supportedLabelMacroAP"]["incumbent"] >= 0.02
            and reports[reference]["pairedBootstrapMacroAPDelta"][candidate]["delta95Interval"][0] > 0
            for reference in ["coso", "rtnResolved"]
        )
    if all(all(parts.values()) for parts in supported_parts.values()):
        outcome = "RETAIN_FOR_RESEARCH — SCALE-DRIFT EXPLANATION SUPPORTED"
    elif any(falsified_a.values()) or any(falsified_b.values()):
        outcome = "REJECT — SCALE-DRIFT EXPLANATION FALSIFIED"
    else:
        outcome = "INCONCLUSIVE"

    output = {
        "status": "COMPLETE_FROZEN_MODEL_DIAGNOSTIC",
        "referenceTerminology": {
            "coso": "historical model-labeled development diagnostic; human-written text but Product-18 targets are model-derived, not human gold",
            "rtnResolved": "model-consensus short-Event research diagnostic; not independent Product-18 human gold",
        },
        "cosoAnnotationAudit": {
            "rows": len(coso_rows),
            "humanGoldTrue": sum(bool(row.get("annotation", {}).get("humanGold")) for row in coso_rows),
            "methods": dict(sorted(Counter(row.get("annotation", {}).get("method", "missing") for row in coso_rows).items())),
        },
        "reports": reports,
        "mechanismGate": {
            "supportedParts": supported_parts,
            "falsifiedA": falsified_a,
            "falsifiedB": falsified_b,
            "outcome": outcome,
        },
        "trainingOccurred": False,
        "thresholdOrSelectorChanged": False,
        "incumbentChanged": False,
        "candidateCreated": False,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH), "outcome": outcome}, indent=2))


if __name__ == "__main__":
    main()
