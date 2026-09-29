#!/usr/bin/env python3
"""Apply one training-prior-only analytical correction to the balanced head."""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
SOURCE = ALIGNED / "decoupled-balanced-head-v1/candidate/checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
TRAIN = ALIGNED / "train.jsonl"
REPLAY = ALIGNED / "public-source-shortlist-20260910/goemotions-targeted-tranche.jsonl"
DEV = ALIGNED / "dev.jsonl"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
OUTPUT = HERE / "candidate"
SEED = 44


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


crt = load_module("decoupled_balanced_head_run", ALIGNED / "decoupled-balanced-head-v1/run.py")
canonical = crt.canonical
rtn_eval = crt.rtn_eval
PRODUCT = list(crt.PRODUCT)


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_BIAS_CORRECTION_OR_INFERENCE":
        raise ValueError("Protocol is not locked")
    aligned = crt.read_jsonl(TRAIN)
    replay = crt.read_jsonl(REPLAY)
    train = aligned + replay
    dev = crt.read_jsonl(DEV)
    if (len(aligned), len(replay), len(train), len(dev)) != (841, 204, 1045, 149):
        raise ValueError("Unexpected frozen row counts")

    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(SOURCE, local_files_only=True)
    model, loading = AutoModelForSequenceClassification.from_pretrained(
        SOURCE, local_files_only=True, output_loading_info=True
    )
    if loading["missing_keys"] or loading["unexpected_keys"] or loading["mismatched_keys"]:
        raise ValueError(f"Source load mismatch: {loading}")
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    product_positions = [next(index for index, label in id2label.items() if label == target) for target in PRODUCT]
    canonical_positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]

    labels = torch.tensor(
        [[float(label in set(row["modelLabels"])) for label in PRODUCT] for row in train],
        dtype=torch.float64,
    )
    positive_counts = Counter(label for row in train for label in set(row["modelLabels"]) if label in PRODUCT)
    empty_count = sum(not (set(row["modelLabels"]) & set(PRODUCT)) for row in train)
    weights = []
    for row in train:
        positives = set(row["modelLabels"]) & set(PRODUCT)
        weights.append(max(1.0 / positive_counts[label] for label in positives) if positives else 1.0 / empty_count)
    sampled_indices = torch.multinomial(
        torch.tensor(weights, dtype=torch.float64), len(train), replacement=True,
        generator=torch.Generator().manual_seed(SEED),
    )
    original_prior = labels.mean(0)
    sampled_prior = labels[sampled_indices].mean(0)
    correction = torch.logit(original_prior.clamp(1e-6, 1 - 1e-6)) - torch.logit(sampled_prior.clamp(1e-6, 1 - 1e-6))
    with torch.no_grad():
        index = torch.tensor(product_positions)
        updated = model.classifier.out_proj.bias[index] + correction.to(model.classifier.out_proj.bias.dtype)
        model.classifier.out_proj.bias.index_copy_(0, index, updated)
    model.to(device)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    candidate_dev = crt.infer(model, tokenizer, [str(row["journal"]) for row in dev], canonical_positions, device)
    reference = crt.read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    consensus = crt.read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    candidate_rtn = crt.infer(model, tokenizer, [str(row["text"]) for row in reference], canonical_positions, device)
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn)

    incumbent_coso = crt.labeled_report(dev, np.load(INCUMBENT_DEV))
    candidate_coso = crt.labeled_report(dev, candidate_dev)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_sets = [set(labels) & set(PRODUCT) for labels in canonical.report(fake, candidate_rtn, 0.35)["outputs"]]
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
        "status": "COMPLETE", "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "currentIncumbentChanged": False,
        "correction": {
            label: {
                "originalPrior": float(original_prior[index]),
                "sampledPrior": float(sampled_prior[index]),
                "biasDelta": float(correction[index]),
            }
            for index, label in enumerate(PRODUCT)
        },
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn, "rtnResolvedCandidateDistributionError": distribution_error,
        "gates": gates, "RTNTrainingUse": False, "thresholdOrSelectorChanged": False,
        "postHocEvaluationFittedCalibration": False,
        "rights": "HISTORICAL_UNRESOLVED_RESEARCH_LINEAGE_ONLY",
        "credibleProductQualityPromotionProven": False,
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"],
        "coso": {
            "incumbent": {key: incumbent_coso[key] for key in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
            "candidate": {key: candidate_coso[key] for key in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
        },
        "rtnResolved": {
            "incumbent": {key: rtn["incumbent"]["resolved"][key] for key in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
            "candidate": {key: cr[key] for key in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
        },
        "rtnHigh": {
            "incumbent": {key: rtn["incumbent"]["highConsensus"][key] for key in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
            "candidate": {key: ch[key] for key in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
        },
        "distributionError": distribution_error, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
