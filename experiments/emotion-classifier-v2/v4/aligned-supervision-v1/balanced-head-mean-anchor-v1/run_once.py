#!/usr/bin/env python3
"""Run the sole frozen Balanced Head mean-anchor training experiment."""

from __future__ import annotations

import json
import math
import random
import time
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset, WeightedRandomSampler
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
PROTOCOL_PATH = HERE / "protocol.json"
OUTPUT = HERE / "candidate"
TRAINING_RESULT = HERE / "training-result.json"
TRAJECTORY = HERE / "loss-trajectory.jsonl"
ANCHOR_DIAGNOSTIC = HERE / "anchor-diagnostic.json"
ANCHOR_MEANS = HERE / "frozen-anchor-means.npz"
ANCHOR_FREEZE = HERE / "anchor-freeze.json"


def resolve(relative: str) -> Path:
    return (HERE / relative).resolve()


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
def extract_features(model: Any, tokenizer: Any, texts: list[str], device: torch.device, batch_size: int, max_length: int) -> torch.Tensor:
    model.eval()
    output = []
    for start in range(0, len(texts), batch_size):
        encoded = tokenizer(
            texts[start:start + batch_size], padding=True, truncation=True,
            max_length=max_length, return_tensors="pt",
        )
        hidden = model.roberta(**{key: value.to(device) for key, value in encoded.items()}).last_hidden_state[:, 0, :]
        output.append(torch.tanh(model.classifier.dense(hidden)).cpu())
    return torch.cat(output)


def source_mean(features: torch.Tensor) -> torch.Tensor:
    return features.to(torch.float64).sum(dim=0) / len(features)


def canonical_outputs(
    features: torch.Tensor,
    model: Any,
    product_positions: list[int],
    candidate_weight: torch.Tensor,
    candidate_bias: torch.Tensor,
    labels: list[str],
    threshold: float,
) -> list[set[str]]:
    clusters = {
        "UPBEAT": {"joy", "amusement", "excitement", "optimism"},
        "WARM_SOCIAL": {"gratitude", "love", "caring", "admiration"},
        "REFLECTIVE": {"sadness", "disappointment", "remorse"},
        "THREAT_INTENSITY": {"anger", "annoyance", "fear", "disgust"},
        "EXPLORATION": {"curiosity", "confusion", "surprise"},
    }
    cluster_by_label = {label: cluster for cluster, members in clusters.items() for label in members}
    logits = features @ candidate_weight.detach().cpu().T + candidate_bias.detach().cpu()
    scores = torch.sigmoid(logits).numpy()
    result = []
    for row in scores:
        candidates = [(index, labels[index], float(row[index])) for index in range(len(labels)) if row[index] >= threshold]
        candidates.sort(key=lambda item: (-item[2], item[0]))
        selected: set[str] = set()
        used: set[str] = set()
        for _, label, _ in candidates:
            cluster = cluster_by_label[label]
            if cluster in used:
                continue
            selected.add(label)
            used.add(cluster)
            if len(selected) == 2:
                break
        result.append(selected)
    return result


def parameter_diagnostics(
    labels: list[str],
    source_names: list[str],
    source_means: torch.Tensor,
    incumbent_weight: torch.Tensor,
    incumbent_bias: torch.Tensor,
    weight: torch.Tensor,
    bias: torch.Tensor,
) -> dict[str, Any]:
    with torch.no_grad():
        drift = source_means @ (weight - incumbent_weight).T + (bias - incumbent_bias)[None, :]
        positive = torch.relu(drift)
        cosine = torch.nn.functional.cosine_similarity(weight, incumbent_weight, dim=1)
        angles = torch.rad2deg(torch.acos(torch.clamp(cosine, -1.0, 1.0)))
        per_label = {}
        for index, label in enumerate(labels):
            values = [float(drift[source, index].cpu()) for source in range(len(source_names))]
            positives = [max(0.0, value) for value in values]
            negatives = [value for value in values if value < 0]
            per_label[label] = {
                "sourceDrift": dict(zip(source_names, values)),
                "mixedDrift50_50": float(np.mean(values)),
                "positiveDriftRms": float(math.sqrt(np.mean([value * value for value in positives]))),
                "maximumPositiveDrift": max(positives),
                "negativeDrifts": negatives,
                "weightCosineVsIncumbent": float(cosine[index].cpu()),
                "rotationAngleDegrees": float(angles[index].cpu()),
                "weightNormChange": float((weight[index].norm() - incumbent_weight[index].norm()).cpu()),
                "biasChange": float((bias[index] - incumbent_bias[index]).cpu()),
            }
        source_summary = {}
        for source, name in enumerate(source_names):
            row = drift[source]
            row_positive = torch.relu(row)
            negative = row[row < 0]
            source_summary[name] = {
                "positiveDriftRms": float(torch.sqrt(torch.mean(row_positive.square())).cpu()),
                "maximumPositiveDrift": float(row_positive.max().cpu()),
                "positiveLabelCount": int((row > 0).sum().cpu()),
                "negativeLabelCount": int((row < 0).sum().cpu()),
                "meanNegativeDrift": float(negative.mean().cpu()) if len(negative) else 0.0,
                "minimumDrift": float(row.min().cpu()),
            }
        return {
            "positiveDriftRms": float(torch.sqrt(torch.mean(positive.square())).cpu()),
            "maximumPositiveDrift": float(positive.max().cpu()),
            "sourceSummary": source_summary,
            "perLabel": per_label,
        }


def output_changes(before: list[set[str]], after: list[set[str]]) -> dict[str, Any]:
    return {
        "rowsChanged": sum(left != right for left, right in zip(before, after)),
        "membershipsAdded": sum(len(right - left) for left, right in zip(before, after)),
        "membershipsRemoved": sum(len(left - right) for left, right in zip(before, after)),
        "beforeCountDistribution": {str(size): sum(len(row) == size for row in before) for size in range(3)},
        "afterCountDistribution": {str(size): sum(len(row) == size for row in after) for size in range(3)},
    }


def main() -> None:
    if OUTPUT.exists() or any(path.exists() for path in (
        TRAINING_RESULT, TRAJECTORY, ANCHOR_DIAGNOSTIC, ANCHOR_MEANS, ANCHOR_FREEZE,
    )):
        raise FileExistsError("Refusing to overwrite an existing one-run artifact")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_FEATURE_EXTRACTION_OR_TRAINING":
        raise ValueError("Frozen protocol is missing")
    labels = protocol["labels"]
    supervised = []
    for specification in protocol["supervisedData"]:
        rows = read_jsonl(resolve(specification["path"]))
        if len(rows) != specification["rows"]:
            raise ValueError(f"Supervised row-count mismatch for {specification['path']}")
        supervised.extend(rows)
    if len(supervised) != 1045:
        raise ValueError("Combined supervised row-count mismatch")
    anchor_rows = {}
    for specification in protocol["anchorData"]:
        rows = read_jsonl(resolve(specification["path"]))
        if len(rows) != specification["rows"]:
            raise ValueError(f"Anchor row-count mismatch for {specification['name']}")
        if any(len(str(row["text"])) > 300 for row in rows):
            raise ValueError(f"Anchor text exceeds 300 characters in {specification['name']}")
        anchor_rows[specification["name"]] = rows

    seed = protocol["sampling"]["seed"]
    torch.manual_seed(seed)
    random.seed(seed)
    np.random.seed(seed)
    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    incumbent_path = resolve(protocol["initialization"])
    historical_path = resolve(protocol["historicalBalancedCheckpoint"])
    tokenizer = AutoTokenizer.from_pretrained(incumbent_path, local_files_only=True)
    model, loading = AutoModelForSequenceClassification.from_pretrained(
        incumbent_path, local_files_only=True, output_loading_info=True,
    )
    if loading["missing_keys"] or loading["unexpected_keys"] or loading["mismatched_keys"]:
        raise ValueError(f"Incumbent load mismatch: {loading}")
    historical = AutoModelForSequenceClassification.from_pretrained(historical_path, local_files_only=True).eval()
    product_positions = positions(model, labels)
    if product_positions != positions(historical, labels):
        raise ValueError("Historical Balanced label mapping mismatch")
    model.eval().to(device)

    started = time.time()
    supervised_features = extract_features(
        model, tokenizer, [str(row["journal"]) for row in supervised], device,
        protocol["feature"]["batchSize"], protocol["feature"]["maxLength"],
    )
    anchor_features = {
        name: extract_features(
            model, tokenizer, [str(row["text"]) for row in rows], device,
            protocol["feature"]["batchSize"], protocol["feature"]["maxLength"],
        )
        for name, rows in anchor_rows.items()
    }
    source_names = list(anchor_features)
    source_means_cpu = torch.stack([source_mean(anchor_features[name]) for name in source_names])
    source_means = source_means_cpu.to(device=device, dtype=torch.float32)

    targets = torch.tensor(
        [[float(label in set(row["modelLabels"])) for label in labels] for row in supervised],
        dtype=torch.float32,
    )
    positive_counts = Counter(label for row in supervised for label in set(row["modelLabels"]) if label in set(labels))
    empty_count = sum(not (set(row["modelLabels"]) & set(labels)) for row in supervised)
    row_weights = []
    for row in supervised:
        positives = set(row["modelLabels"]) & set(labels)
        row_weights.append(max(1.0 / positive_counts[label] for label in positives) if positives else 1.0 / empty_count)
    sampler = WeightedRandomSampler(
        row_weights,
        num_samples=protocol["sampling"]["draws"],
        replacement=True,
        generator=torch.Generator().manual_seed(seed),
    )
    loader = DataLoader(TensorDataset(supervised_features, targets), batch_size=32, sampler=sampler)

    head = torch.nn.Linear(supervised_features.shape[1], len(labels)).to(device)
    incumbent_weight = model.classifier.out_proj.weight[product_positions].detach().clone()
    incumbent_bias = model.classifier.out_proj.bias[product_positions].detach().clone()
    with torch.no_grad():
        head.weight.copy_(incumbent_weight)
        head.bias.copy_(incumbent_bias)
    if sum(parameter.numel() for parameter in head.parameters() if parameter.requires_grad) != 13842:
        raise ValueError("Trainable parameter count is not 13,842")
    incumbent_mean_logits = source_means @ incumbent_weight.T + incumbent_bias[None, :]
    initial_drift = source_means @ (head.weight - incumbent_weight).T + (head.bias - incumbent_bias)[None, :]
    if float(initial_drift.abs().max().detach().cpu()) > 1e-7:
        raise ValueError("Mean-anchor initialization invariant failed")
    incumbent_mean_logits_fp64 = (
        source_means_cpu @ incumbent_weight.detach().cpu().to(torch.float64).T
        + incumbent_bias.detach().cpu().to(torch.float64)[None, :]
    )
    np.savez_compressed(
        ANCHOR_MEANS,
        source_names=np.asarray(source_names),
        source_means=source_means_cpu.numpy(),
        incumbent_mean_logits=incumbent_mean_logits_fp64.numpy(),
    )
    ANCHOR_FREEZE.write_text(json.dumps({
        "status": "FROZEN_BEFORE_TRAINING",
        "sourceRows": {name: len(rows) for name, rows in anchor_rows.items()},
        "sourceWeights": {spec["name"]: spec["sourceWeight"] for spec in protocol["anchorData"]},
        "featureDimension": int(source_means_cpu.shape[1]),
        "meanAccumulation": "FP64",
        "initialMaximumAbsoluteDrift": float(initial_drift.abs().max().detach().cpu()),
        "labels": labels,
    }, indent=2) + "\n", encoding="utf-8")

    before_diagnostic = parameter_diagnostics(
        labels, source_names, source_means, incumbent_weight, incumbent_bias, head.weight, head.bias,
    )
    optimizer = torch.optim.AdamW(
        head.parameters(), lr=0.001, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.0,
    )
    trajectory = []
    rows_seen = 0
    head.train()
    for update, (batch_features, batch_targets) in enumerate(loader, start=1):
        batch_features, batch_targets = batch_features.to(device), batch_targets.to(device)
        bce = torch.nn.functional.binary_cross_entropy_with_logits(head(batch_features), batch_targets)
        current_mean_logits = source_means @ head.weight.T + head.bias[None, :]
        drift = current_mean_logits - incumbent_mean_logits
        raw_anchor = torch.mean(torch.relu(drift).square())
        weighted_anchor = protocol["loss"]["lambda"] * raw_anchor
        total = bce + weighted_anchor
        total.backward()
        gradient_norm = torch.nn.utils.clip_grad_norm_(head.parameters(), 1.0)
        if not torch.isfinite(gradient_norm) or not torch.isfinite(total):
            raise ValueError("Non-finite training value")
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
        rows_seen += len(batch_targets)
        trajectory.append({
            "update": update,
            "batchRows": len(batch_targets),
            "bceLoss": float(bce.detach().cpu()),
            "rawAnchorLoss": float(raw_anchor.detach().cpu()),
            "weightedAnchorLoss": float(weighted_anchor.detach().cpu()),
            "totalLoss": float(total.detach().cpu()),
            "gradientNormBeforeClip": float(gradient_norm.detach().cpu()),
        })
    if len(trajectory) != 33 or trajectory[-1]["batchRows"] != 21 or rows_seen != 1045:
        raise ValueError("Frozen update-count or final-batch invariant failed")

    head.eval()
    after_diagnostic = parameter_diagnostics(
        labels, source_names, source_means, incumbent_weight, incumbent_bias, head.weight, head.bias,
    )
    historical_weight = historical.classifier.out_proj.weight[product_positions].detach().to(device)
    historical_bias = historical.classifier.out_proj.bias[product_positions].detach().to(device)
    historical_diagnostic = parameter_diagnostics(
        labels, source_names, source_means, incumbent_weight, incumbent_bias, historical_weight, historical_bias,
    )
    mechanism_effective = after_diagnostic["positiveDriftRms"] <= 0.5 * historical_diagnostic["positiveDriftRms"]
    final_raw_anchor = after_diagnostic["positiveDriftRms"] ** 2
    final_weighted_anchor = protocol["loss"]["lambda"] * final_raw_anchor

    threshold_logit = math.log(0.35 / 0.65)
    crossings = {}
    canonical_changes = {}
    for name, features in anchor_features.items():
        incumbent_logits = features @ incumbent_weight.cpu().T + incumbent_bias.cpu()
        candidate_logits = features @ head.weight.detach().cpu().T + head.bias.detach().cpu()
        incumbent_membership = incumbent_logits >= threshold_logit
        candidate_membership = candidate_logits >= threshold_logit
        crossings[name] = {
            "added": int(torch.logical_and(candidate_membership, ~incumbent_membership).sum()),
            "removed": int(torch.logical_and(incumbent_membership, ~candidate_membership).sum()),
            "perLabel": {
                label: {
                    "added": int(torch.logical_and(candidate_membership[:, index], ~incumbent_membership[:, index]).sum()),
                    "removed": int(torch.logical_and(incumbent_membership[:, index], ~candidate_membership[:, index]).sum()),
                }
                for index, label in enumerate(labels)
            },
        }
        before_outputs = canonical_outputs(
            features, model, product_positions, incumbent_weight.cpu(), incumbent_bias.cpu(), labels, 0.35,
        )
        after_outputs = canonical_outputs(
            features, model, product_positions, head.weight.detach().cpu(), head.bias.detach().cpu(), labels, 0.35,
        )
        canonical_changes[name] = output_changes(before_outputs, after_outputs)

    with torch.no_grad():
        product_index = torch.tensor(product_positions, device=device)
        model.classifier.out_proj.weight.index_copy_(0, product_index, head.weight)
        model.classifier.out_proj.bias.index_copy_(0, product_index, head.bias)
    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    trajectory_text = "".join(json.dumps(row) + "\n" for row in trajectory)
    TRAJECTORY.write_text(trajectory_text, encoding="utf-8")
    anchor_diagnostic = {
        "status": "COMPLETE_FROZEN_BEFORE_REFERENCE_EVALUATION",
        "before": before_diagnostic,
        "candidate": after_diagnostic,
        "historicalBalanced": historical_diagnostic,
        "positiveDriftRmsRatioVsHistorical": after_diagnostic["positiveDriftRms"] / historical_diagnostic["positiveDriftRms"],
        "MEAN_CONTROL_MECHANISM_EFFECTIVE": mechanism_effective,
        "thresholdCrossingsVsIncumbent": crossings,
        "canonicalOutputChangesVsIncumbent": canonical_changes,
    }
    ANCHOR_DIAGNOSTIC.write_text(json.dumps(anchor_diagnostic, indent=2) + "\n", encoding="utf-8")
    result = {
        "status": "TRAINING_COMPLETE_CHECKPOINT_FROZEN_BEFORE_REFERENCE_EVALUATION",
        "researchRole": protocol["researchRole"],
        "checkpoint": str((OUTPUT / "checkpoint").resolve()),
        "initialization": str(incumbent_path),
        "device": str(device),
        "trainableParameters": 13842,
        "frozenParameters": "encoder, classifier.dense, tokenizer, label mapping, and all non-Product output rows",
        "supervisedRows": len(supervised),
        "positiveCounts": {label: positive_counts[label] for label in labels},
        "emptyRows": empty_count,
        "anchorRows": {name: len(rows) for name, rows in anchor_rows.items()},
        "anchorSourceWeights": {spec["name"]: spec["sourceWeight"] for spec in protocol["anchorData"]},
        "lambda": protocol["loss"]["lambda"],
        "updatesCompleted": len(trajectory),
        "sampledRowsSeen": rows_seen,
        "finalBatchRows": trajectory[-1]["batchRows"],
        "finalBceLoss": trajectory[-1]["bceLoss"],
        "finalRawAnchorLoss": final_raw_anchor,
        "finalWeightedAnchorLoss": final_weighted_anchor,
        "lastUpdatePreStepRawAnchorLoss": trajectory[-1]["rawAnchorLoss"],
        "lastUpdatePreStepWeightedAnchorLoss": trajectory[-1]["weightedAnchorLoss"],
        "finalTotalLoss": trajectory[-1]["totalLoss"],
        "elapsedSeconds": time.time() - started,
        "referenceRowsAccessed": False,
        "incumbentChanged": False,
        "rescueRun": False,
    }
    TRAINING_RESULT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"],
        "updates": result["updatesCompleted"],
        "finalBceLoss": result["finalBceLoss"],
        "finalRawAnchorLoss": result["finalRawAnchorLoss"],
        "positiveDriftRmsRatioVsHistorical": anchor_diagnostic["positiveDriftRmsRatioVsHistorical"],
        "MEAN_CONTROL_MECHANISM_EFFECTIVE": mechanism_effective,
    }, indent=2))


if __name__ == "__main__":
    main()
