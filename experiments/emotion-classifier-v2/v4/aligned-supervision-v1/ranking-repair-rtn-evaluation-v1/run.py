#!/usr/bin/env python3
"""Canonical one-time evaluation of the pre-existing repaired ranking checkpoint."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
CANDIDATE = ALIGNED / "coso-selective-ranking-v1/repair-v2/valid-run/checkpoint"
DEV = ALIGNED / "dev.jsonl"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
OUTPUT = HERE / "evaluation"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module("canonical_experiment", V4 / "auto-v1/experiment.py")
rtn_eval = load_module(
    "rtn_evaluator", REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analyze.py"
)
PRODUCT = list(canonical.PRODUCT)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


@torch.inference_mode()
def infer(model, tokenizer, texts: list[str], device) -> np.ndarray:
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    batches = []
    model.eval()
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start:start + 32], padding=True, truncation=True,
            max_length=512, return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        batches.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(batches)


def labeled_report(rows, probabilities):
    report = canonical.report(rows, probabilities, 0.35)
    truth = [set(row["modelLabels"]) & set(PRODUCT) for row in rows]
    predicted = [set(labels) & set(PRODUCT) for labels in report["outputs"]]
    return {
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "exactSet": sum(left == right for left, right in zip(truth, predicted)) / len(rows),
        "falsePositives": sum(len(output - expected) for output, expected in zip(predicted, truth)),
        "falseNegatives": sum(len(expected - output) for output, expected in zip(predicted, truth)),
        "outputCountDistribution": report["product"]["outputCountDistribution"],
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_CANONICAL_INFERENCE":
        raise ValueError("Protocol is not locked")

    dev = read_jsonl(DEV)
    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    consensus = read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    if len(dev) != 149 or len(reference) != 300 or len(consensus) != 300:
        raise ValueError("Unexpected frozen evaluation size")
    if [row["rowId"] for row in reference] != [row["rowId"] for row in consensus]:
        raise ValueError("RTN rows do not align")

    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(CANDIDATE, local_files_only=True)
    model, loading = AutoModelForSequenceClassification.from_pretrained(
        CANDIDATE, local_files_only=True, output_loading_info=True
    )
    if loading["missing_keys"] or loading["unexpected_keys"] or loading["mismatched_keys"]:
        raise ValueError(f"Candidate load mismatch: {loading}")
    model.to(device)

    candidate_dev = infer(model, tokenizer, [str(row["journal"]) for row in dev], device)
    candidate_rtn = infer(model, tokenizer, [str(row["text"]) for row in reference], device)
    incumbent_coso = labeled_report(dev, np.load(INCUMBENT_DEV))
    candidate_coso = labeled_report(dev, candidate_dev)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_sets = [
        set(labels) & set(PRODUCT)
        for labels in canonical.report(fake, candidate_rtn, 0.35)["outputs"]
    ]
    baseline = json.loads(
        (REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analysis.json").read_text(encoding="utf-8")
    )
    high = [index for index, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved = [index for index, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]

    def evaluate(indices):
        return rtn_eval.evaluate(
            [set(consensus[index]["consensusLabels"]) for index in indices],
            [candidate_sets[index] for index in indices],
        )

    rtn = {
        "incumbent": {"highConsensus": baseline["highConsensus"], "resolved": baseline["resolved"]},
        "candidate": {"highConsensus": evaluate(high), "resolved": evaluate(resolved)},
        "referenceRole": "MODEL_GENERATED_WEAK_PSEUDO_REFERENCE_NOT_HUMAN_GOLD",
    }
    supported_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in PRODUCT if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    cr = rtn["candidate"]["resolved"]
    ch = rtn["candidate"]["highConsensus"]
    distribution_error = sum(
        abs(cr["incumbentCountDistribution"][str(size)] - cr["consensusCountDistribution"][str(size)])
        for size in range(3)
    )
    gates = {
        "rtnResolvedMicroF1": cr["micro"]["f1"] >= 0.3313265306,
        "rtnResolvedMacroF1": cr["macroAll18"]["f1"] >= 0.3184047525,
        "rtnResolvedExact": cr["exactSetAgreement"]["percent"] >= 50.41,
        "rtnResolvedFP": cr["falsePositives"] <= 64,
        "rtnResolvedFN": cr["falseNegatives"] <= 85,
        "rtnResolvedDistribution": distribution_error <= 54,
        "rtnHighMicroF1": ch["micro"]["f1"] >= 0.3678160920,
        "rtnHighExact": ch["exactSetAgreement"]["percent"] >= 55.66,
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= 0.5180528053,
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= 0.3351786297,
        "cosoFP": candidate_coso["falsePositives"] <= 60,
        "cosoFN": candidate_coso["falseNegatives"] <= 87,
        "cosoSupportedLabels": min(supported_deltas.values()) >= -0.08,
        "outputIntegrity": all(len(labels) <= 2 and labels <= set(PRODUCT) for labels in candidate_sets),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "currentIncumbentChanged": False,
        "candidateTrainingWasPreExisting": True,
        "canonicalEvaluationFirstRun": True,
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn,
        "rtnResolvedCandidateDistributionError": distribution_error,
        "gates": gates,
        "RTNTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "rights": "HISTORICAL_UNRESOLVED_RESEARCH_LINEAGE_ONLY",
        "credibleProductQualityPromotionProven": False,
    }
    OUTPUT.mkdir()
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn)
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"], "coso": {"incumbent": incumbent_coso, "candidate": candidate_coso},
        "rtnResolved": {"incumbent": rtn["incumbent"]["resolved"], "candidate": cr},
        "rtnHigh": {"incumbent": rtn["incumbent"]["highConsensus"], "candidate": ch},
        "distributionError": distribution_error, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
