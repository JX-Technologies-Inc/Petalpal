#!/usr/bin/env python3
"""Evaluate four frozen analytical head conditions after training-side freeze."""

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
FREEZE_PATH = HERE / "reference-analysis-freeze.json"
PROTOCOL_PATH = HERE / "protocol.json"
PARAMETERS_PATH = HERE / "decomposition-parameters.npz"
OUTPUT_PATH = HERE / "reference-analysis.json"
SCORES_PATH = HERE / "analytical-condition-scores.npz"
COSO_PATH = ALIGNED / "dev.jsonl"
RTN_TEXT_PATH = V4 / "model-consensus-reference-300-v1/frozen-reference-300.jsonl"
RTN_CONSENSUS_PATH = V4 / "model-consensus-reference-300-v1/consensus.jsonl"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def positions(model: Any, labels: list[str]) -> list[int]:
    mapping = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    result = []
    for label in labels:
        matches = [index for index, value in mapping.items() if value == label]
        if len(matches) != 1:
            raise ValueError(f"Expected one checkpoint column for {label}, found {len(matches)}")
        result.append(matches[0])
    return result


@torch.inference_mode()
def extract_features(model: Any, tokenizer: Any, texts: list[str]) -> np.ndarray:
    model.eval().to(torch.device("cpu"))
    output = []
    for start in range(0, len(texts), 32):
        batch = texts[start:start + 32]
        encoded = tokenizer(batch, padding=True, truncation=True, max_length=512, return_tensors="pt")
        hidden = model.roberta(**encoded).last_hidden_state[:, 0, :]
        output.append(torch.tanh(model.classifier.dense(hidden)).cpu().numpy().astype(np.float64))
    return np.concatenate(output)


def condition_logits(features: np.ndarray, model: Any, protocol: dict[str, Any], parameters: Any) -> dict[str, np.ndarray]:
    canonical = protocol["canonicalLabelOrder"]
    labels = protocol["labels"]
    canonical_positions = positions(model, canonical)
    product_in_canonical = [canonical.index(label) for label in labels]
    all_weight = model.classifier.out_proj.weight.detach().cpu().numpy().astype(np.float64)
    all_bias = model.classifier.out_proj.bias.detach().cpu().numpy().astype(np.float64)
    baseline21 = features @ all_weight[canonical_positions].T + all_bias[canonical_positions]
    mu = parameters["mu"]
    wi, bi = parameters["incumbent_weight"], parameters["incumbent_bias"]
    wb, bb = parameters["balanced_weight"], parameters["balanced_bias"]
    alpha, direction, mean_delta = parameters["alpha"], parameters["direction"], parameters["mean_delta"]
    incumbent = features @ wi.T + bi
    centered = features - mu
    scale = incumbent + centered @ ((alpha - 1)[:, None] * wi).T + mean_delta
    direction_only = incumbent + centered @ direction.T
    balanced = features @ wb.T + bb
    reconstruction = scale + direction_only - incumbent
    max_error = float(np.max(np.abs(reconstruction - balanced)))
    if max_error > 1e-10:
        raise ValueError(f"Analytical conditions do not reconstruct Balanced logits: {max_error}")
    product = {
        "incumbent": incumbent,
        "scale_only": scale,
        "direction_only": direction_only,
        "balanced_head": balanced,
    }
    result = {}
    for condition, values in product.items():
        logits21 = baseline21.copy()
        logits21[:, product_in_canonical] = values
        result[condition] = logits21
    return result


def select(logits21: np.ndarray, protocol: dict[str, Any]) -> list[set[str]]:
    canonical = protocol["canonicalLabelOrder"]
    product = set(protocol["labels"])
    threshold = math.log(protocol["selector"]["threshold"] / (1 - protocol["selector"]["threshold"]))
    cluster_by_label = {
        label: cluster
        for cluster, members in protocol["selector"]["clusters"].items()
        for label in members
    }
    outputs = []
    for row in logits21:
        candidates = [
            (index, canonical[index], float(row[index]))
            for index in range(len(canonical))
            if canonical[index] in product and row[index] >= threshold
        ]
        candidates.sort(key=lambda item: (-item[2], item[0]))
        selected: list[str] = []
        used: set[str] = set()
        for _, label, _ in candidates:
            cluster = cluster_by_label.get(label, label)
            if cluster in used:
                continue
            selected.append(label)
            used.add(cluster)
            if len(selected) == protocol["selector"]["maxOutputs"]:
                break
        outputs.append(set(selected))
    return outputs


def average_precision(truth: np.ndarray, scores: np.ndarray) -> float | None:
    positives = int(truth.sum())
    if not positives:
        return None
    order = np.argsort(-scores, kind="stable")
    ranked = truth[order].astype(np.int64)
    positive_ranks = np.flatnonzero(ranked == 1)
    return float(np.mean(np.cumsum(ranked)[positive_ranks] / (positive_ranks + 1)))


def condition_metrics(
    truth_sets: list[set[str]],
    outputs: list[set[str]],
    truth_array: np.ndarray,
    product_scores: np.ndarray,
    labels: list[str],
    stable: list[int],
) -> dict[str, Any]:
    tp = sum(len(expected & predicted) for expected, predicted in zip(truth_sets, outputs))
    fp = sum(len(predicted - expected) for expected, predicted in zip(truth_sets, outputs))
    fn = sum(len(expected - predicted) for expected, predicted in zip(truth_sets, outputs))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    micro = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    per_label = {}
    label_f1 = []
    for index, label in enumerate(labels):
        label_tp = sum(label in expected and label in predicted for expected, predicted in zip(truth_sets, outputs))
        label_fp = sum(label not in expected and label in predicted for expected, predicted in zip(truth_sets, outputs))
        label_fn = sum(label in expected and label not in predicted for expected, predicted in zip(truth_sets, outputs))
        label_precision = label_tp / (label_tp + label_fp) if label_tp + label_fp else 0.0
        label_recall = label_tp / (label_tp + label_fn) if label_tp + label_fn else 0.0
        label_score = 2 * label_precision * label_recall / (label_precision + label_recall) if label_precision + label_recall else 0.0
        label_f1.append(label_score)
        per_label[label] = {
            "support": int(truth_array[:, index].sum()),
            "tp": label_tp,
            "fp": label_fp,
            "fn": label_fn,
            "precision": label_precision,
            "recall": label_recall,
            "f1": label_score,
            "ap": average_precision(truth_array[:, index], product_scores[:, index]),
            "stableForMacroAP": index in stable,
        }
    macro_ap = float(np.mean([per_label[labels[index]]["ap"] for index in stable]))
    return {
        "microF1": micro,
        "macroF1All18": float(np.mean(label_f1)),
        "precision": precision,
        "recall": recall,
        "exactSet": sum(expected == predicted for expected, predicted in zip(truth_sets, outputs)) / len(outputs),
        "truePositives": tp,
        "falsePositives": fp,
        "falseNegatives": fn,
        "supportedLabelMacroAP": macro_ap,
        "outputCountDistribution": {str(size): sum(len(output) == size for output in outputs) for size in range(3)},
        "perLabel": per_label,
    }


def bootstrap(
    truth: np.ndarray,
    predicted: dict[str, np.ndarray],
    scores: dict[str, np.ndarray],
    stable: list[int],
    groups: list[str],
    replicates: int,
    seed: int,
) -> dict[str, Any]:
    unique = list(dict.fromkeys(groups))
    group_array = np.asarray(groups)
    members = {group: np.flatnonzero(group_array == group) for group in unique}
    rng = np.random.default_rng(seed)
    values = {
        condition: {metric: [] for metric in ["microF1Delta", "macroAPDelta", "truePositiveDelta", "falsePositiveDelta"]}
        for condition in predicted if condition != "incumbent"
    }

    def basic(indices: np.ndarray, condition: str) -> tuple[float, float, int, int]:
        y = truth[indices]
        p = predicted[condition][indices]
        tp = int(np.logical_and(y, p).sum())
        fp = int(np.logical_and(~y, p).sum())
        fn = int(np.logical_and(y, ~p).sum())
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        micro = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        aps = [average_precision(y[:, label], scores[condition][indices, label]) for label in stable]
        macro_ap = float(np.mean([value for value in aps if value is not None]))
        return micro, macro_ap, tp, fp

    for _ in range(replicates):
        chosen = rng.choice(unique, size=len(unique), replace=True)
        indices = np.concatenate([members[str(group)] for group in chosen])
        incumbent = basic(indices, "incumbent")
        for condition in values:
            current = basic(indices, condition)
            for metric, value in zip(values[condition], [current[0] - incumbent[0], current[1] - incumbent[1], current[2] - incumbent[2], current[3] - incumbent[3]]):
                values[condition][metric].append(value)
    result = {}
    for condition, metrics in values.items():
        result[condition] = {}
        for metric, samples in metrics.items():
            array = np.asarray(samples, dtype=np.float64)
            result[condition][metric] = {
                "point": None,
                "interval95": [float(np.quantile(array, 0.025)), float(np.quantile(array, 0.975))],
            }
    return result


def retained_fraction(value: float, incumbent: float, balanced: float) -> float | None:
    gain = balanced - incumbent
    return (value - incumbent) / gain if gain > 0 else None


def reference_report(
    name: str,
    truth_sets: list[set[str]],
    groups: list[str],
    logits: dict[str, np.ndarray],
    protocol: dict[str, Any],
    seed_offset: int,
) -> dict[str, Any]:
    labels, canonical = protocol["labels"], protocol["canonicalLabelOrder"]
    positions18 = [canonical.index(label) for label in labels]
    truth = np.asarray([[label in expected for label in labels] for expected in truth_sets], dtype=bool)
    support = truth.sum(axis=0)
    stable = [index for index, count in enumerate(support) if count >= 5 and len(truth) - count >= 5]
    outputs = {condition: select(values, protocol) for condition, values in logits.items()}
    predicted = {
        condition: np.asarray([[label in row for label in labels] for row in condition_outputs], dtype=bool)
        for condition, condition_outputs in outputs.items()
    }
    scores = {condition: values[:, positions18] for condition, values in logits.items()}
    metrics = {
        condition: condition_metrics(truth_sets, outputs[condition], truth, scores[condition], labels, stable)
        for condition in logits
    }
    uncertainty = bootstrap(
        truth,
        predicted,
        scores,
        stable,
        groups,
        protocol["referenceAnalysis"]["bootstrap"]["replicates"],
        protocol["referenceAnalysis"]["bootstrap"]["seed"] + seed_offset,
    )
    for condition in uncertainty:
        uncertainty[condition]["microF1Delta"]["point"] = metrics[condition]["microF1"] - metrics["incumbent"]["microF1"]
        uncertainty[condition]["macroAPDelta"]["point"] = metrics[condition]["supportedLabelMacroAP"] - metrics["incumbent"]["supportedLabelMacroAP"]
        uncertainty[condition]["truePositiveDelta"]["point"] = metrics[condition]["truePositives"] - metrics["incumbent"]["truePositives"]
        uncertainty[condition]["falsePositiveDelta"]["point"] = metrics[condition]["falsePositives"] - metrics["incumbent"]["falsePositives"]
    fractions = {}
    for condition in ["scale_only", "direction_only"]:
        fractions[condition] = {
            "microF1GainRetained": retained_fraction(metrics[condition]["microF1"], metrics["incumbent"]["microF1"], metrics["balanced_head"]["microF1"]),
            "truePositiveGainRetained": retained_fraction(float(metrics[condition]["truePositives"]), float(metrics["incumbent"]["truePositives"]), float(metrics["balanced_head"]["truePositives"])),
            "extraFalsePositiveReduction": 1 - (metrics[condition]["falsePositives"] - metrics["incumbent"]["falsePositives"]) / (metrics["balanced_head"]["falsePositives"] - metrics["incumbent"]["falsePositives"]),
        }
    important = {}
    for label in protocol["referenceAnalysis"]["importantLabels"]:
        important[label] = {condition: metrics[condition]["perLabel"][label] for condition in metrics}
    return {
        "name": name,
        "rows": len(truth),
        "sourceGroups": len(set(groups)),
        "stableLabels": [labels[index] for index in stable],
        "metrics": metrics,
        "pairedBootstrapVsIncumbent": uncertainty,
        "gainRetention": fractions,
        "importantPerLabel": important,
    }


def main() -> None:
    for path in (OUTPUT_PATH, SCORES_PATH):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite frozen artifact: {path}")
    freeze = json.loads(FREEZE_PATH.read_text(encoding="utf-8"))
    if freeze["status"] != "FROZEN_BEFORE_COSO_RTN":
        raise ValueError("Training-side decomposition is not frozen")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    parameters = np.load(PARAMETERS_PATH)
    incumbent_path = Path(freeze["checkpoints"]["incumbent"])
    tokenizer = AutoTokenizer.from_pretrained(incumbent_path, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(incumbent_path, local_files_only=True).eval()

    coso = read_jsonl(COSO_PATH)
    rtn_text = read_jsonl(RTN_TEXT_PATH)
    rtn_consensus = read_jsonl(RTN_CONSENSUS_PATH)
    if [row["rowId"] for row in rtn_text] != [row["rowId"] for row in rtn_consensus]:
        raise ValueError("RTN row alignment failed")
    resolved = [index for index, row in enumerate(rtn_consensus) if row["consensusStatus"] != "UNRESOLVED"]
    texts = [str(row["journal"]) for row in coso] + [str(rtn_text[index]["text"]) for index in resolved]
    features = extract_features(model, tokenizer, texts)
    all_logits = condition_logits(features, model, protocol, parameters)
    boundary = len(coso)
    coso_logits = {condition: values[:boundary] for condition, values in all_logits.items()}
    rtn_logits = {condition: values[boundary:] for condition, values in all_logits.items()}
    np.savez_compressed(
        SCORES_PATH,
        **{f"coso__{condition}": values for condition, values in coso_logits.items()},
        **{f"rtn_resolved__{condition}": values for condition, values in rtn_logits.items()},
    )
    reports = {
        "coso": reference_report(
            "COSO historical model-labeled development diagnostic",
            [set(row["modelLabels"]) for row in coso],
            [str(row.get("sourceGroupId") or row["id"]) for row in coso],
            coso_logits,
            protocol,
            0,
        ),
        "rtnResolved": reference_report(
            "RTN model-consensus short-Event research diagnostic — resolved subset",
            [set(rtn_consensus[index]["consensusLabels"]) for index in resolved],
            [str(rtn_text[index].get("sourceGroup") or rtn_text[index]["rowId"]) for index in resolved],
            rtn_logits,
            protocol,
            10000,
        ),
    }

    supported_by_reference = {}
    not_supported_by_reference = {}
    for reference, report in reports.items():
        metrics = report["metrics"]
        direction = report["gainRetention"]["direction_only"]
        scale = report["gainRetention"]["scale_only"]
        intervals = report["pairedBootstrapVsIncumbent"]["direction_only"]
        robust_gain = intervals["microF1Delta"]["interval95"][0] > 0 or intervals["macroAPDelta"]["interval95"][0] > 0
        supported_by_reference[reference] = (
            metrics["direction_only"]["microF1"] > metrics["incumbent"]["microF1"]
            and metrics["direction_only"]["supportedLabelMacroAP"] > metrics["incumbent"]["supportedLabelMacroAP"]
            and direction["microF1GainRetained"] is not None and direction["microF1GainRetained"] >= 0.50
            and direction["truePositiveGainRetained"] is not None and direction["truePositiveGainRetained"] >= 0.50
            and direction["extraFalsePositiveReduction"] >= 0.50
            and robust_gain
        )
        not_supported_by_reference[reference] = (
            scale["microF1GainRetained"] is not None and scale["microF1GainRetained"] >= 0.80
            and scale["truePositiveGainRetained"] is not None and scale["truePositiveGainRetained"] >= 0.80
            and (
                direction["microF1GainRetained"] is not None and direction["microF1GainRetained"] < 0.25
                or direction["truePositiveGainRetained"] is not None and direction["truePositiveGainRetained"] < 0.25
            )
            and metrics["direction_only"]["supportedLabelMacroAP"] <= metrics["incumbent"]["supportedLabelMacroAP"]
        )
    if all(supported_by_reference.values()):
        outcome = "SUPPORTED"
    elif all(not_supported_by_reference.values()):
        outcome = "NOT_SUPPORTED"
    else:
        outcome = "INCONCLUSIVE"
    output = {
        "status": "COMPLETE_FROZEN_BALANCED_HEAD_PARAMETER_DECOMPOSITION",
        "reports": reports,
        "headDirectionGate": {
            "supportedByReference": supported_by_reference,
            "notSupportedByReference": not_supported_by_reference,
            "outcome": outcome,
        },
        "trainingOccurred": False,
        "checkpointSaved": False,
        "thresholdOrSelectorChanged": False,
        "incumbentChanged": False,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH), "outcome": outcome}, indent=2))


if __name__ == "__main__":
    main()
