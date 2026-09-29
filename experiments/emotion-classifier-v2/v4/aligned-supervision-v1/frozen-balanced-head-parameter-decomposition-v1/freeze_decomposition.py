#!/usr/bin/env python3
"""Freeze Balanced Head geometric decomposition using admitted training-side text only."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
PROTOCOL_PATH = HERE / "protocol.json"
PARAMETERS_PATH = HERE / "decomposition-parameters.npz"
SUMMARY_PATH = HERE / "decomposition-summary.json"
FREEZE_PATH = HERE / "reference-analysis-freeze.json"


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
def feature_mean(model: Any, tokenizer: Any, texts: list[str], batch_size: int, max_length: int) -> np.ndarray:
    total = torch.zeros(model.config.hidden_size, dtype=torch.float64)
    count = 0
    model.eval().to(torch.device("cpu"))
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        encoded = tokenizer(batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt")
        hidden = model.roberta(**encoded).last_hidden_state[:, 0, :]
        features = torch.tanh(model.classifier.dense(hidden))
        total += features.to(torch.float64).sum(dim=0)
        count += len(batch)
    return (total / count).numpy()


def assert_only_product_head_changed(incumbent: Any, balanced: Any, product_positions: list[int]) -> None:
    incumbent_state = incumbent.state_dict()
    balanced_state = balanced.state_dict()
    if incumbent_state.keys() != balanced_state.keys():
        raise ValueError("Checkpoint tensor-key mismatch")
    product = set(product_positions)
    for name in incumbent_state:
        left, right = incumbent_state[name], balanced_state[name]
        if name == "classifier.out_proj.weight":
            unchanged = [index for index in range(left.shape[0]) if index not in product]
            if not torch.equal(left[unchanged], right[unchanged]):
                raise ValueError("Balanced checkpoint changed a non-Product out_proj weight row")
        elif name == "classifier.out_proj.bias":
            unchanged = [index for index in range(left.shape[0]) if index not in product]
            if not torch.equal(left[unchanged], right[unchanged]):
                raise ValueError("Balanced checkpoint changed a non-Product out_proj bias")
        elif not torch.equal(left, right):
            raise ValueError(f"Balanced checkpoint changed tensor outside out_proj: {name}")


def main() -> None:
    for path in (PARAMETERS_PATH, SUMMARY_PATH, FREEZE_PATH):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite frozen artifact: {path}")
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_FEATURE_MEAN_OR_REFERENCE_ANALYSIS":
        raise ValueError("Protocol is not locked")

    incumbent_path = resolve(protocol["checkpoints"]["incumbent"])
    balanced_path = resolve(protocol["checkpoints"]["balancedHead"])
    tokenizer = AutoTokenizer.from_pretrained(incumbent_path, local_files_only=True)
    incumbent = AutoModelForSequenceClassification.from_pretrained(incumbent_path, local_files_only=True).eval()
    balanced = AutoModelForSequenceClassification.from_pretrained(balanced_path, local_files_only=True).eval()
    product_positions = positions(incumbent, protocol["labels"])
    if product_positions != positions(balanced, protocol["labels"]):
        raise ValueError("Product label-column mapping differs between checkpoints")
    assert_only_product_head_changed(incumbent, balanced, product_positions)

    source_means = {}
    source_rows = {}
    for source, relative in protocol["featureMeanSources"].items():
        rows = read_jsonl(resolve(relative))
        source_rows[source] = len(rows)
        source_means[source] = feature_mean(
            incumbent,
            tokenizer,
            [str(row["text"]) for row in rows],
            protocol["featureMean"]["batchSize"],
            protocol["featureMean"]["maxLength"],
        )
    mu = np.mean(np.stack(list(source_means.values())), axis=0)

    wi = incumbent.classifier.out_proj.weight.detach().cpu().numpy()[product_positions].astype(np.float64)
    bi = incumbent.classifier.out_proj.bias.detach().cpu().numpy()[product_positions].astype(np.float64)
    wb = balanced.classifier.out_proj.weight.detach().cpu().numpy()[product_positions].astype(np.float64)
    bb = balanced.classifier.out_proj.bias.detach().cpu().numpy()[product_positions].astype(np.float64)
    alpha = np.sum(wb * wi, axis=1) / np.sum(wi * wi, axis=1)
    direction = wb - alpha[:, None] * wi
    mean_delta = (wb - wi) @ mu + (bb - bi)
    along_mean_delta = (alpha - 1) * (wi @ mu)
    direction_mean_carried_by_full = direction @ mu
    bias_delta = bb - bi
    orthogonality = np.sum(direction * wi, axis=1)
    cosine = np.sum(wb * wi, axis=1) / (np.linalg.norm(wb, axis=1) * np.linalg.norm(wi, axis=1))
    angle_degrees = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
    if float(np.max(np.abs(orthogonality))) > 1e-10:
        raise ValueError(f"Direction residual is not orthogonal enough: {np.max(np.abs(orthogonality))}")
    if not np.allclose(mean_delta, along_mean_delta + direction_mean_carried_by_full + bias_delta, atol=1e-10):
        raise ValueError("Mean-delta decomposition does not close")

    np.savez_compressed(
        PARAMETERS_PATH,
        mu=mu,
        incumbent_weight=wi,
        incumbent_bias=bi,
        balanced_weight=wb,
        balanced_bias=bb,
        alpha=alpha,
        direction=direction,
        mean_delta=mean_delta,
    )
    per_label = {}
    for index, label in enumerate(protocol["labels"]):
        per_label[label] = {
            "alpha": float(alpha[index]),
            "incumbentWeightNorm": float(np.linalg.norm(wi[index])),
            "balancedWeightNorm": float(np.linalg.norm(wb[index])),
            "directionNorm": float(np.linalg.norm(direction[index])),
            "weightCosine": float(cosine[index]),
            "rotationAngleDegrees": float(angle_degrees[index]),
            "meanLogitDelta": float(mean_delta[index]),
            "alongIncumbentMeanDelta": float(along_mean_delta[index]),
            "directionMeanCarriedByFull": float(direction_mean_carried_by_full[index]),
            "biasDelta": float(bias_delta[index]),
            "orthogonalityDot": float(orthogonality[index]),
        }
    summary = {
        "status": "FROZEN_TRAINING_SIDE_DECOMPOSITION",
        "sourceRows": source_rows,
        "sourceBalance": protocol["featureMean"]["sourceBalance"],
        "featureDimension": int(mu.shape[0]),
        "checkpointIntegrity": "PASS_ONLY_PRODUCT18_OUT_PROJ_ROWS_AND_BIASES_DIFFER",
        "maxAbsoluteOrthogonalityDot": float(np.max(np.abs(orthogonality))),
        "perLabel": per_label,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    freeze = {
        "status": "FROZEN_BEFORE_COSO_RTN",
        "protocol": str(PROTOCOL_PATH.resolve()),
        "parameters": str(PARAMETERS_PATH.resolve()),
        "summary": str(SUMMARY_PATH.resolve()),
        "checkpoints": {"incumbent": str(incumbent_path), "balancedHead": str(balanced_path)},
        "labels": protocol["labels"],
        "conditions": ["incumbent", "scale_only", "direction_only", "balanced_head"],
        "formula": protocol["decomposition"],
        "selector": protocol["selector"],
        "referenceAnalysis": protocol["referenceAnalysis"],
        "interpretationGate": protocol["interpretationGate"],
    }
    FREEZE_PATH.write_text(json.dumps(freeze, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": str(SUMMARY_PATH), "freeze": str(FREEZE_PATH)}, indent=2))


if __name__ == "__main__":
    main()
