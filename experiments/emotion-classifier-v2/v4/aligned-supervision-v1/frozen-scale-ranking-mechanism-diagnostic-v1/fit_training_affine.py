#!/usr/bin/env python3
"""Fit and validate frozen affine score maps without opening reference diagnostics."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
PROTOCOL_PATH = HERE / "protocol.json"
SCORES_PATH = HERE / "training-side-scores.npz"
PARAMETERS_PATH = HERE / "affine-parameters.json"
VALIDATION_PATH = HERE / "training-validation-report.json"
FREEZE_PATH = HERE / "mechanism-freeze.json"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def resolve(relative: str) -> Path:
    return (HERE / relative).resolve()


def label_positions(model: Any, labels: list[str]) -> list[int]:
    id2label = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
    positions = []
    for label in labels:
        matches = [index for index, value in id2label.items() if value == label]
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
            encoded = tokenizer(batch, padding=True, truncation=True, max_length=128, return_tensors="pt")
            logits = model(**encoded).logits[:, positions].cpu().numpy()
            output[start:start + len(batch)] = logits
    del model, tokenizer
    return output


def select(logits: np.ndarray, labels: list[str], protocol: dict[str, Any]) -> list[tuple[str, ...]]:
    threshold_logit = math.log(protocol["selector"]["threshold"] / (1 - protocol["selector"]["threshold"]))
    cluster_by_label = {
        label: cluster
        for cluster, members in protocol["selector"]["clusters"].items()
        for label in members
    }
    outputs: list[tuple[str, ...]] = []
    for row in logits:
        candidates = [
            (index, label, float(row[index]))
            for index, label in enumerate(labels)
            if row[index] >= threshold_logit
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
        outputs.append(tuple(selected))
    return outputs


def change_events(candidate: list[tuple[str, ...]], incumbent: list[tuple[str, ...]]) -> list[set[tuple[str, str]]]:
    rows = []
    for cand, inc in zip(candidate, incumbent):
        cand_set, inc_set = set(cand), set(inc)
        rows.append({("add", label) for label in cand_set - inc_set} | {("remove", label) for label in inc_set - cand_set})
    return rows


def event_metrics(actual: list[set[tuple[str, str]]], predicted: list[set[tuple[str, str]]], weights: np.ndarray | None = None) -> dict[str, float | int]:
    if weights is None:
        weights = np.ones(len(actual), dtype=np.int64)
    true_positive = predicted_total = actual_total = 0
    for weight, truth, guess in zip(weights, actual, predicted):
        true_positive += int(weight) * len(truth & guess)
        predicted_total += int(weight) * len(guess)
        actual_total += int(weight) * len(truth)
    precision = true_positive / predicted_total if predicted_total else (1.0 if actual_total == 0 else 0.0)
    recall = true_positive / actual_total if actual_total else (1.0 if predicted_total == 0 else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "matchedEvents": true_positive,
        "predictedEvents": predicted_total,
        "actualEvents": actual_total,
    }


def aggregate_explained(delta: np.ndarray, predicted: np.ndarray, weights: np.ndarray | None = None) -> float | None:
    if weights is None:
        weights = np.ones(delta.shape[0], dtype=np.float64)
    weights = weights.astype(np.float64)
    total_weight = weights.sum()
    if total_weight == 0:
        return None
    means = (delta * weights[:, None]).sum(axis=0) / total_weight
    sse = (((delta - predicted) ** 2) * weights[:, None]).sum()
    sst = (((delta - means) ** 2) * weights[:, None]).sum()
    return float(1 - sse / sst) if sst > 0 else None


def per_label_explained(delta: np.ndarray, predicted: np.ndarray) -> list[float | None]:
    values: list[float | None] = []
    for index in range(delta.shape[1]):
        target = delta[:, index]
        sse = float(np.square(target - predicted[:, index]).sum())
        sst = float(np.square(target - target.mean()).sum())
        values.append(1 - sse / sst if sst > 0 else None)
    return values


def group_bootstrap_weights(groups: list[str], replicates: int, seed: int) -> list[np.ndarray]:
    unique = list(dict.fromkeys(groups))
    member_indices = {group: np.flatnonzero(np.asarray(groups) == group) for group in unique}
    rng = np.random.default_rng(seed)
    outputs = []
    for _ in range(replicates):
        chosen = rng.choice(unique, size=len(unique), replace=True)
        counts: dict[str, int] = {}
        for group in chosen:
            counts[str(group)] = counts.get(str(group), 0) + 1
        weights = np.zeros(len(groups), dtype=np.int64)
        for group, count in counts.items():
            weights[member_indices[group]] = count
        outputs.append(weights)
    return outputs


def interval(values: list[float | None]) -> list[float] | None:
    finite = np.asarray([value for value in values if value is not None and np.isfinite(value)], dtype=np.float64)
    if not len(finite):
        return None
    return [float(np.quantile(finite, 0.025)), float(np.quantile(finite, 0.975))]


def main() -> None:
    for path in (SCORES_PATH, PARAMETERS_PATH, VALIDATION_PATH, FREEZE_PATH):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite frozen diagnostic artifact: {path}")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_REFERENCE_ANALYSIS":
        raise ValueError("Protocol is not locked")
    labels = protocol["labels"]
    model_paths = {name: resolve(path) for name, path in protocol["models"].items()}
    for name, path in model_paths.items():
        if not path.is_dir():
            raise FileNotFoundError(f"Missing frozen checkpoint {name}: {path}")

    rng = random.Random(protocol["fit"]["seed"])
    partitions: dict[str, dict[str, Any]] = {}
    for source, paths in protocol["trainingSideSources"].items():
        train = read_jsonl(resolve(paths["train"]))
        validation = read_jsonl(resolve(paths["validation"]))
        sample_size = protocol["fit"]["samplePerTrainingSource"]
        sampled_indices = sorted(rng.sample(range(len(train)), sample_size))
        partitions[f"{source}_fit"] = {
            "rows": [train[index] for index in sampled_indices],
            "source": source,
            "split": "fit",
        }
        partitions[f"{source}_validation"] = {
            "rows": validation,
            "source": source,
            "split": "validation",
        }

    ordered_keys = list(partitions)
    all_texts = [row["text"] for key in ordered_keys for row in partitions[key]["rows"]]
    offsets: dict[str, tuple[int, int]] = {}
    cursor = 0
    for key in ordered_keys:
        size = len(partitions[key]["rows"])
        offsets[key] = (cursor, cursor + size)
        cursor += size

    arrays: dict[str, np.ndarray] = {}
    for model_name, checkpoint in model_paths.items():
        logits = predict_logits(all_texts, checkpoint, labels)
        for key, (start, end) in offsets.items():
            arrays[f"{key}__{model_name}"] = logits[start:end]
    for key, partition in partitions.items():
        arrays[f"{key}__ids"] = np.asarray([row["id"] for row in partition["rows"]])
        arrays[f"{key}__groups"] = np.asarray([row["sourceGroupId"] for row in partition["rows"]])
    np.savez_compressed(SCORES_PATH, **arrays)

    incumbent_fit = np.concatenate([
        arrays[f"{source}_fit__incumbent"] for source in protocol["trainingSideSources"]
    ])
    parameters: dict[str, Any] = {
        "status": "FROZEN_FROM_TRAINING_SIDE_ONLY",
        "labels": labels,
        "fitRowsPerSource": protocol["fit"]["samplePerTrainingSource"],
        "candidates": {},
    }
    for candidate in [name for name in model_paths if name != "incumbent"]:
        candidate_fit = np.concatenate([
            arrays[f"{source}_fit__{candidate}"] for source in protocol["trainingSideSources"]
        ])
        candidate_parameters = {}
        for label_index, label in enumerate(labels):
            x = incumbent_fit[:, label_index]
            y = candidate_fit[:, label_index]
            centered = x - x.mean()
            denominator = float(np.dot(centered, centered))
            a = float(np.dot(centered, y - y.mean()) / denominator) if denominator else 0.0
            b = float(y.mean() - a * x.mean())
            candidate_parameters[label] = {"a": a, "b": b}
        parameters["candidates"][candidate] = candidate_parameters
    PARAMETERS_PATH.write_text(json.dumps(parameters, indent=2) + "\n", encoding="utf-8")

    validation_report: dict[str, Any] = {
        "status": "OUT_OF_FIT_VALIDATION_COMPLETE",
        "definition": protocol["explainedVariation"],
        "candidates": {},
    }
    for candidate in parameters["candidates"]:
        validation_report["candidates"][candidate] = {}
        a = np.asarray([parameters["candidates"][candidate][label]["a"] for label in labels])
        b = np.asarray([parameters["candidates"][candidate][label]["b"] for label in labels])
        for source in protocol["trainingSideSources"]:
            incumbent = arrays[f"{source}_validation__incumbent"]
            actual_candidate = arrays[f"{source}_validation__{candidate}"]
            predicted_candidate = incumbent * a + b
            delta = actual_candidate - incumbent
            predicted_delta = predicted_candidate - incumbent
            actual_events = change_events(select(actual_candidate, labels, protocol), select(incumbent, labels, protocol))
            predicted_events = change_events(select(predicted_candidate, labels, protocol), select(incumbent, labels, protocol))
            event_report = event_metrics(actual_events, predicted_events)
            per_label_r2 = per_label_explained(delta, predicted_delta)
            groups = arrays[f"{source}_validation__groups"].tolist()
            bootstrap_weights = group_bootstrap_weights(
                groups,
                protocol["validationUncertainty"]["replicates"],
                protocol["validationUncertainty"]["seed"] + len(validation_report["candidates"]) * 100 + len(source),
            )
            r2_bootstrap = [aggregate_explained(delta, predicted_delta, weights) for weights in bootstrap_weights]
            f1_bootstrap = [float(event_metrics(actual_events, predicted_events, weights)["f1"]) for weights in bootstrap_weights]
            validation_report["candidates"][candidate][source] = {
                "rows": len(incumbent),
                "sourceGroups": len(set(groups)),
                "aggregateExplainedVariation": aggregate_explained(delta, predicted_delta),
                "aggregateExplainedVariation95Interval": interval(r2_bootstrap),
                "macroPerLabelExplainedVariation": float(np.mean([value for value in per_label_r2 if value is not None])),
                "perLabelExplainedVariation": dict(zip(labels, per_label_r2)),
                "outputChangeReproduction": event_report,
                "outputChangeF1_95Interval": interval(f1_bootstrap),
            }
    VALIDATION_PATH.write_text(json.dumps(validation_report, indent=2) + "\n", encoding="utf-8")

    freeze = {
        "status": "MECHANISM_PARAMETERS_FROZEN_BEFORE_RTN_COSO",
        "protocol": str(PROTOCOL_PATH.resolve()),
        "parameters": str(PARAMETERS_PATH.resolve()),
        "trainingValidation": str(VALIDATION_PATH.resolve()),
        "scores": str(SCORES_PATH.resolve()),
        "checkpoints": {name: str(path) for name, path in model_paths.items()},
        "labels": labels,
        "scoreTransform": protocol["referenceAnalysis"]["scaleReset"],
        "support": protocol["referenceAnalysis"]["support"],
        "bootstrap": protocol["referenceAnalysis"]["bootstrap"],
        "averagePrecision": protocol["referenceAnalysis"]["averagePrecision"],
        "selectorAttribution": protocol["referenceAnalysis"]["selectorAttribution"],
    }
    FREEZE_PATH.write_text(json.dumps(freeze, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "parameters": str(PARAMETERS_PATH),
        "validation": str(VALIDATION_PATH),
        "freeze": str(FREEZE_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
