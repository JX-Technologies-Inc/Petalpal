#!/usr/bin/env python3
"""Run the sole frozen nnPU candidate, freeze it, then evaluate once."""

from __future__ import annotations

import importlib.util
import json
import math
import random
import time
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
EVAL_HELPERS = ALIGNED / "three-state-partial-supervision-v1/run_candidate.py"
TRAIN = HERE / "pu-train.jsonl"
OUTPUT = HERE / "candidate"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def positions(model, labels: list[str]) -> list[int]:
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    return [next(index for index, value in id2label.items() if value == label) for label in labels]


def build_batches(rows: list[dict[str, Any]], labels: list[str], positive_size: int, unlabeled_size: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    batches = []
    all_indices = list(range(len(rows)))
    for label_index, label in enumerate(labels):
        positive = [index for index, row in enumerate(rows) if label in row["positiveLabels"]]
        unlabeled = [index for index in all_indices if index not in set(positive)]
        rng.shuffle(unlabeled)
        for start in range(0, len(unlabeled), unlabeled_size):
            u_indices = unlabeled[start:start + unlabeled_size]
            p_indices = [rng.choice(positive) for _ in range(positive_size)]
            batches.append({
                "label": label,
                "labelIndex": label_index,
                "positiveIndices": p_indices,
                "unlabeledIndices": u_indices,
            })
    rng.shuffle(batches)
    return batches


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    audit = json.loads((HERE / "data-audit.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_TRAINING" or audit["status"] != "PASS":
        raise ValueError("Frozen protocol or data gate missing")

    labels = protocol["labels"]
    training = protocol["training"]
    prior = float(protocol["objective"]["classPrior"]["valuePerLabel"])
    seed = int(training["seed"])
    rows = read_jsonl(TRAIN)
    if len(rows) != protocol["data"]["expectedEvents"]:
        raise ValueError("Frozen PU row count mismatch")
    if any(row["unconfirmedCellSemantics"] != "UNLABELED_NOT_NEGATIVE" for row in rows):
        raise ValueError("An unconfirmed cell lost PU semantics")
    if any(row["labelStatus"] != protocol["data"]["labelStatus"] for row in rows):
        raise ValueError("Unexpected label status")

    torch.set_num_threads(4)
    torch.manual_seed(seed)
    random.seed(seed)
    np.random.seed(seed)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    product_positions = positions(model, labels)
    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable_names = []
    for name, parameter in model.named_parameters():
        if name.startswith("classifier.") or ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_names.append(name)
    if not any(name.startswith("classifier.") for name in trainable_names):
        raise ValueError("Classifier was not made trainable")
    if not all(any(f".encoder.layer.{layer}." in name for name in trainable_names) for layer in (10, 11)):
        raise ValueError("Frozen encoder-layer policy was not realized")
    model.to(device)

    batches = build_batches(
        rows,
        labels,
        int(training["positiveCellsPerBatch"]),
        int(training["unlabeledCellsPerBatch"]),
        seed,
    )
    expected_unlabeled_visits = protocol["data"]["expectedUnlabeledCells"]
    observed_unlabeled_visits = sum(len(batch["unlabeledIndices"]) for batch in batches)
    if observed_unlabeled_visits != expected_unlabeled_visits:
        raise ValueError("Epoch does not cover every unlabeled cell exactly once")

    trainable_parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    optimizer = torch.optim.AdamW(
        trainable_parameters,
        lr=float(training["learningRate"]),
        weight_decay=float(training["weightDecay"]),
    )
    warmup = math.ceil(0.1 * len(batches))
    scheduler = get_linear_schedule_with_warmup(optimizer, warmup, len(batches))
    texts = [str(row["text"]) for row in rows]

    started = time.time()
    model.train()
    loss_total = 0.0
    positive_risk_total = 0.0
    negative_risk_raw_total = 0.0
    negative_risk_clamped_total = 0.0
    clamp_count = 0
    label_steps = Counter()
    for step, batch in enumerate(batches, start=1):
        p_indices = batch["positiveIndices"]
        u_indices = batch["unlabeledIndices"]
        combined = p_indices + u_indices
        encoded = tokenizer(
            [texts[index] for index in combined],
            padding=True,
            truncation=True,
            max_length=int(training["maxLength"]),
            return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits
        target_position = product_positions[batch["labelIndex"]]
        target_logits = logits[:, target_position]
        positive_logits = target_logits[:len(p_indices)]
        unlabeled_logits = target_logits[len(p_indices):]

        positive_risk = prior * F.softplus(-positive_logits).mean()
        negative_risk_raw = F.softplus(unlabeled_logits).mean() - prior * F.softplus(positive_logits).mean()
        negative_risk = torch.clamp(negative_risk_raw, min=0.0)
        loss = positive_risk + negative_risk
        loss.backward()
        torch.nn.utils.clip_grad_norm_(trainable_parameters, float(training["gradientClipNorm"]))
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)

        loss_total += float(loss.detach().cpu())
        positive_risk_total += float(positive_risk.detach().cpu())
        negative_risk_raw_total += float(negative_risk_raw.detach().cpu())
        negative_risk_clamped_total += float(negative_risk.detach().cpu())
        clamp_count += int(float(negative_risk_raw.detach().cpu()) < 0.0)
        label_steps[batch["label"]] += 1
        if step == 1 or step % 10 == 0 or step == len(batches):
            print(json.dumps({
                "event": "train",
                "step": step,
                "steps": len(batches),
                "label": batch["label"],
                "unlabeledCells": len(u_indices),
                "loss": float(loss.detach().cpu()),
            }), flush=True)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    training_summary = {
        "status": "CHECKPOINT_FROZEN_BEFORE_EVALUATION",
        "objective": protocol["objective"],
        "events": len(rows),
        "positiveCells": audit["positiveCells"],
        "unlabeledCells": audit["unlabeledCells"],
        "optimizerSteps": len(batches),
        "unlabeledCellVisits": observed_unlabeled_visits,
        "positiveDraws": sum(len(batch["positiveIndices"]) for batch in batches),
        "labelSteps": {label: label_steps[label] for label in labels},
        "meanLoss": loss_total / len(batches),
        "meanPositiveRisk": positive_risk_total / len(batches),
        "meanRawNegativeRisk": negative_risk_raw_total / len(batches),
        "meanClampedNegativeRisk": negative_risk_clamped_total / len(batches),
        "negativeRiskClampSteps": clamp_count,
        "trainableParameters": sum(parameter.numel() for parameter in trainable_parameters),
        "totalParameters": sum(parameter.numel() for parameter in model.parameters()),
        "elapsedSeconds": time.time() - started,
        "device": str(device),
        "negativeTargetsCreated": 0,
        "evaluationArtifactsOpenedDuringTraining": False,
    }
    (OUTPUT / "training-summary.json").write_text(json.dumps(training_summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"event": "checkpoint_frozen", **training_summary}, indent=2), flush=True)

    # The candidate checkpoint is frozen. Only after this line are the existing
    # evaluation helpers and COSO/RTN artifacts loaded.
    helpers = load_module("pu_v1_eval_helpers", EVAL_HELPERS)
    canonical = helpers.canonical
    rtn_eval = helpers.rtn_eval

    model.eval()
    dev = read_jsonl(DEV)
    incumbent_dev21 = np.load(INCUMBENT_DEV)
    candidate_dev21 = helpers.to_canonical21(
        helpers.infer(model, tokenizer, [str(row["journal"]) for row in dev], product_positions, device)
    )
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev21)
    incumbent_coso = helpers.labeled_report(dev, incumbent_dev21)
    candidate_coso = helpers.labeled_report(dev, candidate_dev21)

    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    candidate_rtn21 = helpers.to_canonical21(
        helpers.infer(model, tokenizer, [str(row["text"]) for row in reference], product_positions, device)
    )
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn21)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_rtn_outputs = canonical.report(fake, candidate_rtn21, protocol["inference"]["threshold"])["outputs"]
    rtn = helpers.rtn_comparison([set(output) & set(labels) for output in candidate_rtn_outputs])

    coso_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in labels if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    incumbent_resolved = rtn["incumbent"]["resolved"]
    candidate_resolved = rtn["candidate"]["resolved"]
    incumbent_high = rtn["incumbent"]["highConsensus"]
    candidate_high = rtn["candidate"]["highConsensus"]
    rtn_deltas = {
        label: candidate_resolved["allPerLabelCounts"][label]["f1"] - incumbent_resolved["allPerLabelCounts"][label]["f1"]
        for label in labels if incumbent_resolved["allPerLabelCounts"][label]["support"] >= 5
    }
    distribution_error = sum(
        abs(candidate_resolved["incumbentCountDistribution"][str(size)] - candidate_resolved["consensusCountDistribution"][str(size)])
        for size in range(3)
    )
    criteria = protocol["successCriteria"]
    gates = {
        "rtnResolvedMicroF1": candidate_resolved["micro"]["f1"] >= criteria["rtnResolvedMicroF1Minimum"],
        "rtnResolvedMacroF1": candidate_resolved["macroAll18"]["f1"] >= criteria["rtnResolvedMacroF1Minimum"],
        "rtnResolvedExact": candidate_resolved["exactSetAgreement"]["percent"] >= criteria["rtnResolvedExactSetMinimumPercent"],
        "rtnResolvedPrecision": candidate_resolved["micro"]["precision"] >= criteria["rtnResolvedPrecisionMinimum"],
        "rtnResolvedRecall": candidate_resolved["micro"]["recall"] >= criteria["rtnResolvedRecallMinimum"],
        "rtnResolvedFP": candidate_resolved["falsePositives"] <= criteria["rtnResolvedFalsePositiveMaximum"],
        "rtnResolvedFN": candidate_resolved["falseNegatives"] <= criteria["rtnResolvedFalseNegativeMaximum"],
        "rtnResolvedDistribution": distribution_error <= criteria["rtnResolvedDistributionErrorMaximum"],
        "rtnHighMicroF1": candidate_high["micro"]["f1"] >= criteria["rtnHighMicroF1Minimum"],
        "rtnHighExact": candidate_high["exactSetAgreement"]["percent"] >= criteria["rtnHighExactSetMinimumPercent"],
        "rtnBroadPerLabelImprovement": sum(delta >= 0.02 for delta in rtn_deltas.values()) >= criteria["minimumSupportedLabelsImprovingBy002"],
        "rtnNoCatastrophicLabelRegression": min(rtn_deltas.values()) >= -criteria["maximumSupportedLabelRtnRegression"],
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= criteria["cosoMicroF1Minimum"],
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= criteria["cosoMacroF1Minimum"],
        "cosoExactSet": candidate_coso["exactSet"] >= incumbent_coso["exactSet"] - criteria["cosoExactSetMaximumDrop"],
        "cosoFP": candidate_coso["falsePositives"] <= criteria["cosoFalsePositiveMaximum"],
        "cosoFN": candidate_coso["falseNegatives"] <= criteria["cosoFalseNegativeMaximum"],
        "cosoSupportedLabels": min(coso_deltas.values()) >= -criteria["maximumSupportedLabelCosoRegression"],
        "outputIntegrity": all(len(output) <= protocol["inference"]["maxOutputs"] and set(output) <= set(labels) for output in candidate_rtn_outputs),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "classifierActuallyImproved": retained,
        "currentIncumbentChanged": False,
        "training": training_summary,
        "coso149": {
            "incumbent": incumbent_coso,
            "candidate": candidate_coso,
            "supportedPerLabelF1Delta": coso_deltas,
        },
        "rtn300": rtn,
        "rtnResolvedCandidateDistributionError": distribution_error,
        "rtnResolvedSupportedPerLabelF1Delta": rtn_deltas,
        "gates": gates,
        "humanReviewPerformed": False,
        "RTNTrainingUse": False,
        "COSOTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "promotionStatement": "No production promotion; RTN is model-consensus research evidence and synthetic labels remain weak pseudo-labels.",
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "event": "evaluation_complete",
        "decision": result["decision"],
        "coso": {"incumbent": incumbent_coso, "candidate": candidate_coso},
        "rtnResolved": {"incumbent": incumbent_resolved, "candidate": candidate_resolved},
        "rtnHigh": {"incumbent": incumbent_high, "candidate": candidate_high},
        "rtnResolvedSupportedPerLabelF1Delta": rtn_deltas,
        "cosoSupportedPerLabelF1Delta": coso_deltas,
        "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
