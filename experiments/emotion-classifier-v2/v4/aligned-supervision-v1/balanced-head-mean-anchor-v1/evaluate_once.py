#!/usr/bin/env python3
"""Evaluate the frozen mean-anchor checkpoint once after training is complete."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
PROTOCOL_PATH = HERE / "protocol.json"
TRAINING_RESULT_PATH = HERE / "training-result.json"
ANCHOR_DIAGNOSTIC_PATH = HERE / "anchor-diagnostic.json"
CANDIDATE_CHECKPOINT = HERE / "candidate/checkpoint"
RESULT_PATH = HERE / "evaluation-result.json"
COSO_PROBABILITIES = HERE / "candidate/coso-probabilities.npy"
RTN_PROBABILITIES = HERE / "candidate/rtn-probabilities.npy"
INCUMBENT_DEV_PROBABILITIES = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
HISTORICAL_DIR = ALIGNED / "decoupled-balanced-head-v1/candidate"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module("canonical_mean_anchor", V4 / "auto-v1/experiment.py")
rtn_evaluator = load_module(
    "rtn_mean_anchor", REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analyze.py",
)


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
def infer(model: Any, tokenizer: Any, texts: list[str], label_positions: list[int], device: torch.device) -> np.ndarray:
    model.eval()
    output = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start:start + 32], padding=True, truncation=True,
            max_length=512, return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, label_positions]
        output.append(torch.sigmoid(logits).cpu().numpy())
    result = np.concatenate(output)
    if not np.isfinite(result).all():
        raise ValueError("Non-finite candidate probability")
    return result


def labeled_report(rows: list[dict[str, Any]], probabilities21: np.ndarray, product: list[str]) -> dict[str, Any]:
    report = canonical.report(rows, probabilities21, 0.35)
    truth = [set(row["modelLabels"]) & set(product) for row in rows]
    predicted = [set(output) & set(product) for output in report["outputs"]]
    true_positives = sum(len(expected & output) for expected, output in zip(truth, predicted))
    return {
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "truePositives": true_positives,
        "falsePositives": sum(len(output - expected) for expected, output in zip(truth, predicted)),
        "falseNegatives": sum(len(expected - output) for expected, output in zip(truth, predicted)),
        "exactSetCount": sum(expected == output for expected, output in zip(truth, predicted)),
        "exactSet": sum(expected == output for expected, output in zip(truth, predicted)) / len(rows),
        "outputCountDistribution": {str(size): sum(len(output) == size for output in predicted) for size in range(3)},
        "outputsValid": all(len(output) <= 2 and output <= set(product) for output in predicted),
    }


def rtn_report(
    consensus: list[dict[str, Any]],
    probabilities21: np.ndarray,
    product: list[str],
    indices: list[int],
) -> dict[str, Any]:
    fake = [{"id": row["rowId"], "modelLabels": []} for row in consensus]
    candidate_sets = [set(output) & set(product) for output in canonical.report(fake, probabilities21, 0.35)["outputs"]]
    report = rtn_evaluator.evaluate(
        [set(consensus[index]["consensusLabels"]) for index in indices],
        [candidate_sets[index] for index in indices],
    )
    report["exactSetCount"] = round(report["exactSetAgreement"]["count"])
    report["truePositives"] = sum(
        len(set(consensus[index]["consensusLabels"]) & candidate_sets[index]) for index in indices
    )
    report["outputsValid"] = all(len(candidate_sets[index]) <= 2 and candidate_sets[index] <= set(product) for index in indices)
    return report


def supported_regressions(
    incumbent_per_label: dict[str, Any],
    candidate_per_label: dict[str, Any],
    minimum_support: int,
    maximum_decline: float,
) -> dict[str, Any]:
    deltas = {
        label: candidate_per_label[label]["f1"] - values["f1"]
        for label, values in incumbent_per_label.items()
        if values["support"] >= minimum_support
    }
    failures = {label: value for label, value in deltas.items() if value < -maximum_decline}
    return {"deltas": deltas, "failures": failures, "pass": not failures}


def main() -> None:
    if RESULT_PATH.exists() or COSO_PROBABILITIES.exists() or RTN_PROBABILITIES.exists():
        raise FileExistsError("Refusing to overwrite the one-time evaluation")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    training = json.loads(TRAINING_RESULT_PATH.read_text(encoding="utf-8"))
    anchor = json.loads(ANCHOR_DIAGNOSTIC_PATH.read_text(encoding="utf-8"))
    if training["status"] != "TRAINING_COMPLETE_CHECKPOINT_FROZEN_BEFORE_REFERENCE_EVALUATION":
        raise ValueError("Candidate was not fully frozen before evaluation")
    if not CANDIDATE_CHECKPOINT.is_dir():
        raise FileNotFoundError("Frozen candidate checkpoint is missing")

    product = protocol["labels"]
    model = AutoModelForSequenceClassification.from_pretrained(CANDIDATE_CHECKPOINT, local_files_only=True)
    tokenizer = AutoTokenizer.from_pretrained(CANDIDATE_CHECKPOINT, local_files_only=True)
    canonical_positions = positions(model, list(canonical.LABELS))
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device)

    dev = read_jsonl(DEV)
    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    consensus = read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    if len(dev) != 149 or len(reference) != 300 or len(consensus) != 300:
        raise ValueError("Reference row count mismatch")
    if [row["rowId"] for row in reference] != [row["rowId"] for row in consensus]:
        raise ValueError("RTN row alignment mismatch")
    candidate_coso_probabilities = infer(model, tokenizer, [str(row["journal"]) for row in dev], canonical_positions, device)
    candidate_rtn_probabilities = infer(model, tokenizer, [str(row["text"]) for row in reference], canonical_positions, device)
    np.save(COSO_PROBABILITIES, candidate_coso_probabilities)
    np.save(RTN_PROBABILITIES, candidate_rtn_probabilities)

    incumbent_coso = labeled_report(dev, np.load(INCUMBENT_DEV_PROBABILITIES), product)
    historical_coso = labeled_report(dev, np.load(HISTORICAL_DIR / "coso-candidate-probabilities.npy"), product)
    candidate_coso = labeled_report(dev, candidate_coso_probabilities, product)
    baseline_rtn = json.loads(
        (REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analysis.json").read_text(encoding="utf-8")
    )
    high_indices = [index for index, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved_indices = [index for index, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]
    incumbent_resolved = baseline_rtn["resolved"]
    incumbent_high = baseline_rtn["highConsensus"]
    historical_probabilities = np.load(HISTORICAL_DIR / "rtn-candidate-probabilities.npy")
    historical_resolved = rtn_report(consensus, historical_probabilities, product, resolved_indices)
    historical_high = rtn_report(consensus, historical_probabilities, product, high_indices)
    candidate_resolved = rtn_report(consensus, candidate_rtn_probabilities, product, resolved_indices)
    candidate_high = rtn_report(consensus, candidate_rtn_probabilities, product, high_indices)

    # Normalize baseline fields needed by the frozen gate.
    incumbent_resolved["exactSetCount"] = round(incumbent_resolved["exactSetAgreement"]["count"])
    incumbent_resolved["truePositives"] = 119 - incumbent_resolved["falseNegatives"]
    incumbent_resolved["outputsValid"] = True
    incumbent_high["exactSetCount"] = round(incumbent_high["exactSetAgreement"]["count"])
    incumbent_high["truePositives"] = sum(
        incumbent_high["allPerLabelCounts"][label]["truePositive"] for label in product
    )
    incumbent_high["outputsValid"] = True

    minimum_support = protocol["qualityGate"]["supportedLabelMinimumSupport"]
    maximum_decline = protocol["qualityGate"]["supportedLabelMaximumF1DeclineVsIncumbent"]
    coso_regressions = supported_regressions(
        incumbent_coso["perLabel"], candidate_coso["perLabel"], minimum_support, maximum_decline,
    )
    rtn_regressions = supported_regressions(
        incumbent_resolved["allPerLabelCounts"], candidate_resolved["allPerLabelCounts"], minimum_support, maximum_decline,
    )
    coso_gate = protocol["qualityGate"]["coso"]
    rtn_gate = protocol["qualityGate"]["rtnResolved"]
    gates = {
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= coso_gate["microF1Minimum"],
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= coso_gate["macroF1Minimum"],
        "cosoTruePositives": candidate_coso["truePositives"] >= coso_gate["truePositiveMinimum"],
        "cosoFalseNegatives": candidate_coso["falseNegatives"] <= coso_gate["falseNegativeMaximum"],
        "cosoFalsePositives": candidate_coso["falsePositives"] <= coso_gate["falsePositiveMaximum"],
        "cosoExactSet": candidate_coso["exactSetCount"] >= coso_gate["exactSetCountMinimum"],
        "cosoSupportedLabels": coso_regressions["pass"],
        "rtnResolvedMicroF1": candidate_resolved["micro"]["f1"] >= rtn_gate["microF1Minimum"],
        "rtnResolvedMacroF1": candidate_resolved["macroAll18"]["f1"] >= rtn_gate["macroF1Minimum"],
        "rtnResolvedTruePositives": candidate_resolved["truePositives"] >= rtn_gate["truePositiveMinimum"],
        "rtnResolvedFalseNegatives": candidate_resolved["falseNegatives"] <= rtn_gate["falseNegativeMaximum"],
        "rtnResolvedFalsePositives": candidate_resolved["falsePositives"] <= rtn_gate["falsePositiveMaximum"],
        "rtnResolvedExactSet": candidate_resolved["exactSetCount"] >= rtn_gate["exactSetCountMinimum"],
        "rtnResolvedSupportedLabels": rtn_regressions["pass"],
        "finiteAndValidOutputs": bool(
            np.isfinite(candidate_coso_probabilities).all()
            and np.isfinite(candidate_rtn_probabilities).all()
            and candidate_coso["outputsValid"]
            and candidate_resolved["outputsValid"]
            and candidate_high["outputsValid"]
        ),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE_VALID_SINGLE_RUN",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "classifierActuallyImprovedUnderFrozenGate": retained,
        "currentIncumbentChanged": False,
        "referenceTerminology": {
            "coso": "HISTORICAL_MODEL_LABELED_DEVELOPMENT_DIAGNOSTIC_NOT_HUMAN_GOLD",
            "rtn": "MODEL_CONSENSUS_RESEARCH_REFERENCE_NOT_HUMAN_GOLD",
        },
        "training": training,
        "mechanism": anchor,
        "coso149": {
            "incumbent": incumbent_coso,
            "historicalBalanced": historical_coso,
            "candidate": candidate_coso,
            "supportedLabelComparison": coso_regressions,
        },
        "rtn300": {
            "incumbent": {"resolved": incumbent_resolved, "high": incumbent_high},
            "historicalBalanced": {"resolved": historical_resolved, "high": historical_high},
            "candidate": {"resolved": candidate_resolved, "high": candidate_high},
            "supportedLabelComparisonResolved": rtn_regressions,
            "unresolvedRowsExcludedFromNegativeGold": len(consensus) - len(resolved_indices),
        },
        "gates": gates,
        "thresholdOrSelectorChanged": False,
        "rescueRun": False,
        "shouldTrainAnotherVariant": False,
    }
    RESULT_PATH.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"],
        "MEAN_CONTROL_MECHANISM_EFFECTIVE": anchor["MEAN_CONTROL_MECHANISM_EFFECTIVE"],
        "coso": {
            "micro": candidate_coso["micro"], "macro": candidate_coso["macro"],
            "tp": candidate_coso["truePositives"], "fp": candidate_coso["falsePositives"],
            "fn": candidate_coso["falseNegatives"], "exact": candidate_coso["exactSetCount"],
        },
        "rtnResolved": {
            "micro": candidate_resolved["micro"], "macro": candidate_resolved["macroAll18"],
            "tp": candidate_resolved["truePositives"], "fp": candidate_resolved["falsePositives"],
            "fn": candidate_resolved["falseNegatives"], "exact": candidate_resolved["exactSetCount"],
        },
        "failedGates": [name for name, passed in gates.items() if not passed],
    }, indent=2))


if __name__ == "__main__":
    main()
