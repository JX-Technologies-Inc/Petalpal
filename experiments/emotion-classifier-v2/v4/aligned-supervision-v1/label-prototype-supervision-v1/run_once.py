#!/usr/bin/env python3
"""Run the sole frozen positive-prototype candidate, then evaluate once."""

from __future__ import annotations

import importlib.util
import json
import math
import random
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
EVAL_HELPERS = ALIGNED / "three-state-partial-supervision-v1/run_candidate.py"
TRAIN = HERE / "prototype-train.jsonl"
PROTOTYPES = HERE / "frozen-prototypes.npy"
PROTOTYPE_REPORT = HERE / "prototype-construction.json"
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


@torch.inference_mode()
def embed(model, tokenizer, texts: list[str], device, max_length: int) -> torch.Tensor:
    model.eval()
    chunks = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start:start + 32], padding=True, truncation=True,
            max_length=max_length, return_tensors="pt",
        )
        hidden = model.roberta(**{key: value.to(device) for key, value in encoded.items()}).last_hidden_state[:, 0, :]
        chunks.append(F.normalize(hidden, dim=-1).cpu())
    return torch.cat(chunks)


def geometry(representations: torch.Tensor, prototypes: torch.Tensor, rows: list[dict], labels: list[str]) -> dict:
    label_index = {label: index for index, label in enumerate(labels)}
    values = []
    per_label = {label: [] for label in labels}
    single, multi = [], []
    for row_index, row in enumerate(rows):
        for label in row["positiveLabels"]:
            value = float(torch.dot(representations[row_index], prototypes[label_index[label]]))
            values.append(value)
            per_label[label].append(value)
            (multi if len(row["positiveLabels"]) == 2 else single).append(value)
    return {
        "membershipMeanCosine": sum(values) / len(values),
        "singleLabelMembershipMeanCosine": sum(single) / len(single),
        "multiLabelMembershipMeanCosine": sum(multi) / len(multi),
        "perLabelMeanCosine": {label: sum(per_label[label]) / len(per_label[label]) for label in labels},
        "membershipCount": len(values),
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    audit = json.loads((HERE / "data-audit.json").read_text(encoding="utf-8"))
    prototype_report = json.loads(PROTOTYPE_REPORT.read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_DATA_FREEZE_AND_TRAINING" or audit["status"] != "PASS":
        raise ValueError("Frozen protocol or data gate missing")
    if prototype_report["status"] != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Prototypes were not frozen before training")

    labels = protocol["labels"]
    training = protocol["training"]
    rows = read_jsonl(TRAIN)
    prototypes_cpu = torch.tensor(np.load(PROTOTYPES), dtype=torch.float32)
    if tuple(prototypes_cpu.shape) != (len(labels), prototype_report["representationDimensions"]):
        raise ValueError("Frozen prototype shape mismatch")

    seed = int(training["seed"])
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
        if ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_names.append(name)
    if not all(any(f".encoder.layer.{layer}." in name for name in trainable_names) for layer in (10, 11)):
        raise ValueError("Frozen encoder-layer policy was not realized")
    if any(name.startswith("classifier.") for name, parameter in model.named_parameters() if parameter.requires_grad):
        raise ValueError("Classifier must remain frozen")
    model.to(device)
    prototypes = prototypes_cpu.to(device)

    dataset_indices = list(range(len(rows)))
    loader = DataLoader(
        dataset_indices,
        batch_size=int(training["batchSizeEvents"]),
        shuffle=True,
        generator=torch.Generator().manual_seed(seed),
    )
    steps = len(loader) * int(training["epochs"])
    trainable_parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    optimizer = torch.optim.AdamW(
        trainable_parameters,
        lr=float(training["learningRate"]),
        weight_decay=float(training["weightDecay"]),
    )
    scheduler = get_linear_schedule_with_warmup(optimizer, math.ceil(0.1 * steps), steps)
    label_index = {label: index for index, label in enumerate(labels)}
    prototype_weight = float(protocol["baseLossPolicy"]["prototypeWeight"])

    started = time.time()
    total_loss_sum = 0.0
    bce_loss_sum = 0.0
    prototype_loss_sum = 0.0
    membership_visits = 0
    step = 0
    model.train()
    for epoch in range(int(training["epochs"])):
        for batch_indices_tensor in loader:
            batch_indices = [int(index) for index in batch_indices_tensor]
            batch_rows = [rows[index] for index in batch_indices]
            encoded = tokenizer(
                [row["text"] for row in batch_rows], padding=True, truncation=True,
                max_length=int(training["maxLength"]), return_tensors="pt",
            )
            sequence = model.roberta(**{key: value.to(device) for key, value in encoded.items()}).last_hidden_state
            cls = sequence[:, 0, :]
            normalized_cls = F.normalize(cls, dim=-1)
            logits = model.classifier(sequence)

            membership_events = []
            membership_labels = []
            for event_index, row in enumerate(batch_rows):
                for label in row["positiveLabels"]:
                    membership_events.append(event_index)
                    membership_labels.append(label_index[label])
            event_tensor = torch.tensor(membership_events, dtype=torch.long, device=device)
            label_tensor = torch.tensor(membership_labels, dtype=torch.long, device=device)
            logit_position_tensor = torch.tensor(
                [product_positions[index] for index in membership_labels], dtype=torch.long, device=device
            )
            positive_logits = logits[event_tensor, logit_position_tensor]
            positive_bce = F.softplus(-positive_logits).mean()
            positive_cosines = (normalized_cls[event_tensor] * prototypes[label_tensor]).sum(dim=-1)
            prototype_loss = (1.0 - positive_cosines).mean()
            loss = positive_bce + prototype_weight * prototype_loss

            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable_parameters, float(training["gradientClipNorm"]))
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)

            step += 1
            membership_visits += len(membership_events)
            total_loss_sum += float(loss.detach().cpu())
            bce_loss_sum += float(positive_bce.detach().cpu())
            prototype_loss_sum += float(prototype_loss.detach().cpu())
            if step == 1 or step % 10 == 0 or step == steps:
                print(json.dumps({
                    "event": "train", "step": step, "steps": steps,
                    "epoch": epoch + 1, "memberships": len(membership_events),
                    "loss": float(loss.detach().cpu()),
                    "positiveBCE": float(positive_bce.detach().cpu()),
                    "prototypeLoss": float(prototype_loss.detach().cpu()),
                }), flush=True)

    after_representations = embed(model, tokenizer, [row["text"] for row in rows], device, int(training["maxLength"]))
    after_geometry = geometry(after_representations, prototypes_cpu, rows, labels)
    before_geometry = prototype_report["baselinePositiveGeometry"]
    geometry_delta = {
        "membershipMeanCosine": after_geometry["membershipMeanCosine"] - before_geometry["membershipMeanCosine"],
        "singleLabelMembershipMeanCosine": after_geometry["singleLabelMembershipMeanCosine"] - before_geometry["singleLabelMembershipMeanCosine"],
        "multiLabelMembershipMeanCosine": after_geometry["multiLabelMembershipMeanCosine"] - before_geometry["multiLabelMembershipMeanCosine"],
        "perLabelMeanCosine": {
            label: after_geometry["perLabelMeanCosine"][label] - before_geometry["perLabelMeanCosine"][label]
            for label in labels
        },
    }

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    training_summary = {
        "status": "CHECKPOINT_FROZEN_BEFORE_EVALUATION",
        "objective": {
            "positiveClassificationLoss": protocol["baseLossPolicy"]["classificationLoss"],
            "prototypeLoss": protocol["prototype"]["attractionLoss"],
            "prototypeWeight": prototype_weight,
            "repulsionLoss": "none",
        },
        "events": len(rows),
        "labelMemberships": audit["labelMemberships"],
        "multiLabelEvents": audit["multiLabelEvents"],
        "optimizerSteps": step,
        "membershipVisits": membership_visits,
        "meanTotalLoss": total_loss_sum / step,
        "meanPositiveBCE": bce_loss_sum / step,
        "meanPrototypeLoss": prototype_loss_sum / step,
        "geometryBefore": before_geometry,
        "geometryAfter": after_geometry,
        "geometryDelta": geometry_delta,
        "trainableParameters": sum(parameter.numel() for parameter in trainable_parameters),
        "totalParameters": sum(parameter.numel() for parameter in model.parameters()),
        "elapsedSeconds": time.time() - started,
        "device": str(device),
        "negativeTargetsCreated": 0,
        "repulsivePairsCreated": 0,
        "classifierTrainable": False,
        "evaluationArtifactsOpenedDuringTraining": False,
    }
    (OUTPUT / "training-summary.json").write_text(json.dumps(training_summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"event": "checkpoint_frozen", **training_summary}, indent=2), flush=True)

    # Candidate checkpoint is frozen. Only now load evaluation helpers and data.
    helpers = load_module("prototype_v1_eval_helpers", EVAL_HELPERS)
    canonical = helpers.canonical
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
        "newAgentValidationUsed": False,
        "RTNTrainingUse": False,
        "COSOTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "promotionStatement": "No production promotion; RTN is model-consensus research evidence and synthetic labels remain weak pseudo-labels.",
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "event": "evaluation_complete", "decision": result["decision"],
        "geometryDelta": geometry_delta,
        "coso": {"incumbent": incumbent_coso, "candidate": candidate_coso},
        "rtnResolved": {"incumbent": incumbent_resolved, "candidate": candidate_resolved},
        "rtnHigh": {"incumbent": incumbent_high, "candidate": candidate_high},
        "rtnResolvedSupportedPerLabelF1Delta": rtn_deltas,
        "cosoSupportedPerLabelF1Delta": coso_deltas,
        "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
