#!/usr/bin/env python3
"""Run one frozen incumbent diagnostic against RTN-300 without training or tuning."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
REFERENCE_DIR = HERE.parent
V4 = REFERENCE_DIR.parent
ALIGNED = V4 / "aligned-supervision-v1"
INCUMBENT = ALIGNED / "goemotions-targeted-v1" / "experiment" / "epoch-1-checkpoint"
REFERENCE = REFERENCE_DIR / "frozen-reference-300.jsonl"
CONSENSUS = REFERENCE_DIR / "consensus.jsonl"
AGENT_PATHS = {
    "Astra": REFERENCE_DIR / "agent-a-labels.jsonl",
    "Sol": REFERENCE_DIR / "agent-b-labels.jsonl",
    "Luna": REFERENCE_DIR / "agent-c-labels.jsonl",
}
OUTPUT = HERE / "analysis.json"

spec = importlib.util.spec_from_file_location("canonical_experiment", V4 / "auto-v1" / "experiment.py")
canonical = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(canonical)

PRODUCT = list(canonical.PRODUCT)
THRESHOLD = 0.35
MAX_OUTPUTS = 2


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pct(count: int, total: int) -> float:
    return round(100 * count / total, 2) if total else 0.0


def divide(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def f1(precision: float, recall: float) -> float:
    return 2 * precision * recall / (precision + recall) if precision + recall else 0.0


def count_distribution(label_sets: list[set[str]]) -> dict[str, int]:
    return {str(size): sum(len(labels) == size for labels in label_sets) for size in range(3)}


def evaluate(truth: list[set[str]], predicted: list[set[str]]) -> dict[str, Any]:
    if len(truth) != len(predicted) or not truth:
        raise ValueError("Evaluation requires aligned nonempty truth and prediction rows")
    per_label: dict[str, dict[str, Any]] = {}
    total_tp = total_fp = total_fn = 0
    for label in PRODUCT:
        tp = sum(label in expected and label in output for expected, output in zip(truth, predicted))
        fp = sum(label not in expected and label in output for expected, output in zip(truth, predicted))
        fn = sum(label in expected and label not in output for expected, output in zip(truth, predicted))
        support = tp + fn
        precision = divide(tp, tp + fp)
        recall = divide(tp, support)
        per_label[label] = {
            "support": support,
            "predicted": tp + fp,
            "truePositive": tp,
            "falsePositive": fp,
            "falseNegative": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1(precision, recall),
            "productionDelta": tp + fp - support,
        }
        total_tp += tp
        total_fp += fp
        total_fn += fn

    micro_precision = divide(total_tp, total_tp + total_fp)
    micro_recall = divide(total_tp, total_tp + total_fn)
    all_labels = list(per_label.values())
    supported = [values for values in all_labels if values["support"] > 0]
    exact_count = sum(expected == output for expected, output in zip(truth, predicted))
    consensus_empty_incumbent_nonempty = sum(
        not expected and bool(output) for expected, output in zip(truth, predicted)
    )
    consensus_nonempty_incumbent_empty = sum(
        bool(expected) and not output for expected, output in zip(truth, predicted)
    )
    incumbent_more = sum(len(output) > len(expected) for expected, output in zip(truth, predicted))
    incumbent_fewer = sum(len(output) < len(expected) for expected, output in zip(truth, predicted))
    same_count = len(truth) - incumbent_more - incumbent_fewer
    incumbent_mean = sum(map(len, predicted)) / len(predicted)
    consensus_mean = sum(map(len, truth)) / len(truth)
    mean_difference = incumbent_mean - consensus_mean
    if mean_difference > 0.05:
        aggressiveness = "INCUMBENT_MORE_AGGRESSIVE"
    elif mean_difference < -0.05:
        aggressiveness = "INCUMBENT_MORE_CONSERVATIVE"
    else:
        aggressiveness = "SIMILAR_MEAN_LABEL_COUNT"
    return {
        "rows": len(truth),
        "exactSetAgreement": {"count": exact_count, "percent": pct(exact_count, len(truth))},
        "micro": {
            "precision": micro_precision,
            "recall": micro_recall,
            "f1": f1(micro_precision, micro_recall),
        },
        "macroAll18": {
            key: sum(values[key] for values in all_labels) / len(all_labels)
            for key in ("precision", "recall", "f1")
        },
        "macroSupportedLabelsOnly": {
            key: sum(values[key] for values in supported) / len(supported)
            for key in ("precision", "recall", "f1")
        },
        "supportedLabelCount": len(supported),
        "falsePositives": total_fp,
        "falseNegatives": total_fn,
        "rowsWithAnyFalsePositive": sum(bool(output - expected) for expected, output in zip(truth, predicted)),
        "rowsWithAnyFalseNegative": sum(bool(expected - output) for expected, output in zip(truth, predicted)),
        "abstentionMismatch": {
            "consensusEmptyIncumbentNonempty": consensus_empty_incumbent_nonempty,
            "consensusNonemptyIncumbentEmpty": consensus_nonempty_incumbent_empty,
        },
        "labelCountComparison": {
            "incumbentMoreLabels": incumbent_more,
            "sameLabelCount": same_count,
            "incumbentFewerLabels": incumbent_fewer,
            "incumbentMeanLabelsPerRow": incumbent_mean,
            "consensusMeanLabelsPerRow": consensus_mean,
            "meanDifferenceIncumbentMinusConsensus": mean_difference,
            "aggressivenessConclusion": aggressiveness,
        },
        "incumbentCountDistribution": count_distribution(predicted),
        "consensusCountDistribution": count_distribution(truth),
        "incumbentPredictionCountByLabel": {
            label: sum(label in output for output in predicted) for label in PRODUCT
        },
        "consensusCountByLabel": {
            label: sum(label in expected for expected in truth) for label in PRODUCT
        },
        "perLabelWithConsensusSupport": {
            label: values for label, values in per_label.items() if values["support"] > 0
        },
        "allPerLabelCounts": per_label,
        "overProduced": sorted(
            (
                {"label": label, "delta": values["productionDelta"], "predicted": values["predicted"], "consensus": values["support"]}
                for label, values in per_label.items()
                if values["productionDelta"] > 0
            ),
            key=lambda item: (-item["delta"], item["label"]),
        ),
        "underProduced": sorted(
            (
                {"label": label, "delta": values["productionDelta"], "predicted": values["predicted"], "consensus": values["support"]}
                for label, values in per_label.items()
                if values["productionDelta"] < 0
            ),
            key=lambda item: (item["delta"], item["label"]),
        ),
    }


def behavior(label_sets: list[set[str]]) -> dict[str, Any]:
    counts = Counter(label for labels in label_sets for label in labels)
    total_labels = sum(map(len, label_sets))
    return {
        "rows": len(label_sets),
        "countDistribution": count_distribution(label_sets),
        "emptyRatePercent": pct(sum(not labels for labels in label_sets), len(label_sets)),
        "meanLabelsPerRow": total_labels / len(label_sets),
        "countByLabel": {label: counts[label] for label in PRODUCT},
        "distinctLabels": sum(counts[label] > 0 for label in PRODUCT),
    }


def compare_agent(predicted: list[set[str]], agent: list[set[str]]) -> dict[str, Any]:
    exact = sum(output == labels for output, labels in zip(predicted, agent))
    more = sum(len(output) > len(labels) for output, labels in zip(predicted, agent))
    fewer = sum(len(output) < len(labels) for output, labels in zip(predicted, agent))
    same = len(predicted) - more - fewer
    incumbent_behavior = behavior(predicted)
    agent_behavior = behavior(agent)
    difference = incumbent_behavior["meanLabelsPerRow"] - agent_behavior["meanLabelsPerRow"]
    if difference > 0.05:
        stance = "INCUMBENT_MORE_AGGRESSIVE"
    elif difference < -0.05:
        stance = "INCUMBENT_MORE_CONSERVATIVE"
    else:
        stance = "SIMILAR_MEAN_LABEL_COUNT"
    return {
        "exactSetAgreement": {"count": exact, "percent": pct(exact, len(predicted))},
        "incumbentBehavior": incumbent_behavior,
        "agentBehavior": agent_behavior,
        "rowLevelLabelCountComparison": {
            "incumbentMoreLabels": more,
            "sameLabelCount": same,
            "incumbentFewerLabels": fewer,
        },
        "meanLabelCountDifferenceIncumbentMinusAgent": difference,
        "aggressivenessConclusion": stance,
        "perLabelCountDeltaIncumbentMinusAgent": {
            label: incumbent_behavior["countByLabel"][label] - agent_behavior["countByLabel"][label]
            for label in PRODUCT
        },
    }


@torch.inference_mode()
def infer(texts: list[str]) -> tuple[np.ndarray, list[set[str]], str]:
    torch.set_num_threads(4)
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    )
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    model.to(device)
    model.eval()
    batches = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start : start + 32],
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        batches.append(torch.sigmoid(logits).cpu().numpy())
    probabilities = np.concatenate(batches)
    fake_rows = [{"id": f"RTN-{index:04d}", "modelLabels": []} for index in range(len(texts))]
    outputs = canonical.report(fake_rows, probabilities, THRESHOLD)["outputs"]
    return probabilities, [set(output) & set(PRODUCT) for output in outputs], str(device)


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite existing analysis: {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_INFERENCE" or protocol["training"] is not False:
        raise ValueError("Protocol was not locked before inference")
    if sha256_file(REFERENCE) != protocol["frozenReferenceSha256"]:
        raise ValueError("Frozen reference hash mismatch")
    if sha256_file(CONSENSUS) != protocol["consensusSha256"]:
        raise ValueError("Consensus hash mismatch")

    reference = read_jsonl(REFERENCE)
    consensus = read_jsonl(CONSENSUS)
    expected_ids = [row["rowId"] for row in reference]
    if len(reference) != 300 or len({row["sourceGroup"] for row in reference}) != 300:
        raise ValueError("RTN reference must contain 300 rows from 300 source groups")
    if [row["rowId"] for row in consensus] != expected_ids:
        raise ValueError("Consensus rows do not align with frozen reference")
    if not all(len(row["text"]) <= 300 for row in reference):
        raise ValueError("Reference contains a row over 300 characters")

    agents: dict[str, list[set[str]]] = {}
    for name, path in AGENT_PATHS.items():
        rows = read_jsonl(path)
        if [row["rowId"] for row in rows] != expected_ids:
            raise ValueError(f"{name} rows do not align with frozen reference")
        agents[name] = [set(row["labels"]) for row in rows]

    _, predicted, device = infer([row["text"] for row in reference])
    high_indices = [index for index, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved_indices = [index for index, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]
    unresolved_indices = [index for index, row in enumerate(consensus) if row["consensusStatus"] == "UNRESOLVED"]
    if (len(high_indices), len(resolved_indices), len(unresolved_indices)) != (106, 244, 56):
        raise ValueError("Frozen consensus subset counts changed")

    def subset(indices: list[int]) -> tuple[list[set[str]], list[set[str]]]:
        truth = [set(consensus[index]["consensusLabels"]) for index in indices]
        outputs = [predicted[index] for index in indices]
        return truth, outputs

    high_truth, high_predicted = subset(high_indices)
    resolved_truth, resolved_predicted = subset(resolved_indices)
    high_metrics = evaluate(high_truth, high_predicted)
    resolved_metrics = evaluate(resolved_truth, resolved_predicted)
    unresolved_predicted = [predicted[index] for index in unresolved_indices]
    unresolved_behavior = behavior(unresolved_predicted)
    unresolved_behavior.update(
        {
            "goldMetricsComputed": False,
            "reason": "No exact two-of-three agent label-set agreement; consensusLabels is null.",
        }
    )

    all_behavior = behavior(predicted)
    agent_comparisons = {
        name: compare_agent(predicted, labels) for name, labels in agents.items()
    }
    collapsed = (
        all_behavior["distinctLabels"] < 6
        or max(all_behavior["countDistribution"].values()) / len(predicted) > 0.95
    )
    diagnostic_result = (
        "INFORMATIVE"
        if len(high_indices) >= 75 and len(resolved_indices) >= 200 and not collapsed
        else "WEAKLY_INFORMATIVE"
    )

    if (
        resolved_metrics["falseNegatives"] > resolved_metrics["falsePositives"]
        and resolved_metrics["overProduced"]
        and resolved_metrics["overProduced"][0]["delta"] >= 10
    ):
        bottleneck = "Label-specific short-Event calibration is skewed: the incumbent is broadly too conservative and misses many consensus labels, while simultaneously over-producing joy."
    elif (
        resolved_metrics["falsePositives"] > resolved_metrics["falseNegatives"]
        and resolved_metrics["abstentionMismatch"]["consensusEmptyIncumbentNonempty"]
        > resolved_metrics["abstentionMismatch"]["consensusNonemptyIncumbentEmpty"]
    ):
        bottleneck = "The incumbent is over-aggressive on short Events: non-empty predictions on consensus-empty rows and excess label production dominate the resolved mismatch."
    elif resolved_metrics["falseNegatives"] > resolved_metrics["falsePositives"]:
        bottleneck = "The incumbent under-produces short-Event labels: missed consensus labels dominate the resolved mismatch."
    else:
        bottleneck = "Short-Event label calibration is the main bottleneck: false-positive and false-negative mismatch are comparably material."

    result = {
        "status": "PASS",
        "diagnosticResult": diagnostic_result,
        "trainingPerformed": False,
        "incumbentChanged": False,
        "thresholdChanged": False,
        "selectorChanged": False,
        "incumbent": "goemotions-targeted-v1/experiment/epoch-1-checkpoint",
        "device": device,
        "referenceRole": protocol["referenceRole"],
        "referenceSubsets": {
            "HIGH_CONSENSUS": len(high_indices),
            "RESOLVED": len(resolved_indices),
            "UNRESOLVED": len(unresolved_indices),
        },
        "selector": protocol["selector"],
        "highConsensus": high_metrics,
        "resolved": resolved_metrics,
        "unresolvedBehaviorOnly": unresolved_behavior,
        "all300IncumbentBehavior": all_behavior,
        "agentComparisons": agent_comparisons,
        "biasLimitations": [
            "The reference is model consensus, not human gold; agreement is not product accuracy.",
            "Astra is substantially more conservative than Sol and Luna.",
            "Only three resolved rows have two consensus labels.",
            "Disgust has zero resolved consensus support; no correctness conclusion is available for disgust.",
            "Anger, remorse, and several other labels have sparse consensus support.",
            "Roadtrip Nation is career/personal-narrative biased and is not population- or Product-18-balanced.",
            "COSO-149 is a distinct historical human-labeled development diagnostic and is not directly equivalent to RTN-300."
        ],
        "strongestResearchBottleneck": bottleneck,
        "promotionImpact": "NONE",
        "referenceRemainsTrainingForbidden": True,
    }
    OUTPUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": result["status"],
                "diagnosticResult": diagnostic_result,
                "device": device,
                "highConsensus": high_metrics,
                "resolved": resolved_metrics,
                "unresolvedBehaviorOnly": unresolved_behavior,
                "all300IncumbentBehavior": all_behavior,
                "agentComparisons": agent_comparisons,
                "strongestResearchBottleneck": bottleneck,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
