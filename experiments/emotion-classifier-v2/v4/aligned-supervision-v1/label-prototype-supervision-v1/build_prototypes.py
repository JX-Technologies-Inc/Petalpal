#!/usr/bin/env python3
"""Build and freeze one incumbent-derived positive centroid per Product label."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
TRAIN = HERE / "prototype-train.jsonl"
PROTOTYPES = HERE / "frozen-prototypes.npy"
REPORT = HERE / "prototype-construction.json"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


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


def diagnostic(representations: torch.Tensor, prototypes: torch.Tensor, rows: list[dict], labels: list[str]) -> dict:
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
    if PROTOTYPES.exists() or REPORT.exists():
        raise FileExistsError("Refusing to overwrite frozen prototype artifacts")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    audit = json.loads((HERE / "data-audit.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_DATA_FREEZE_AND_TRAINING" or audit["status"] != "PASS":
        raise ValueError("Protocol or data gate is not frozen")
    rows = read_jsonl(TRAIN)
    labels = protocol["labels"]
    label_index = {label: index for index, label in enumerate(labels)}

    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True).to(device)
    representations = embed(model, tokenizer, [row["text"] for row in rows], device, protocol["training"]["maxLength"])

    sums = torch.zeros((len(labels), representations.shape[1]), dtype=representations.dtype)
    counts = torch.zeros(len(labels), dtype=torch.long)
    for row_index, row in enumerate(rows):
        for label in row["positiveLabels"]:
            index = label_index[label]
            sums[index] += representations[row_index]
            counts[index] += 1
    if torch.any(counts == 0):
        raise ValueError("A Product label has no positive representation")
    prototypes = F.normalize(sums / counts[:, None], dim=-1)
    np.save(PROTOTYPES, prototypes.numpy())
    result = {
        "status": "FROZEN_BEFORE_TRAINING",
        "events": len(rows),
        "labelMemberships": int(counts.sum()),
        "representationDimensions": representations.shape[1],
        "supportByLabel": {label: int(counts[label_index[label]]) for label in labels},
        "construction": protocol["prototype"]["construction"],
        "prototypeTrainability": protocol["prototype"]["prototypeTrainability"],
        "baselinePositiveGeometry": diagnostic(representations, prototypes, rows, labels),
        "RTNOrCOSOUsed": False,
    }
    REPORT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
