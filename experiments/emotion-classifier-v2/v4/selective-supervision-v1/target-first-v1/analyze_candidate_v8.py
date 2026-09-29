#!/usr/bin/env python3
"""Bounded Train/Dev-only V8 diagnostics. Never opens Final."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from safetensors import safe_open
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

import run_official_training as common


HERE = Path(__file__).resolve().parent
RUNS = {name: HERE / f"candidate-{name}/run" for name in ("v2", "v6", "v7", "v8")}
P0_DIRECTIONS = [direction for pair in common.P0_PAIRS for direction in (pair, pair[::-1])]


def logit(probabilities: np.ndarray) -> np.ndarray:
    values = np.clip(probabilities.astype(np.float64), 1e-7, 1 - 1e-7)
    return np.log(values) - np.log1p(-values)


def p0_events(rows: list[dict], probabilities: np.ndarray) -> list[dict]:
    values = logit(probabilities)
    events = []
    for index, row in enumerate(rows):
        selected = row["supervision"]["selected"]
        plausible = row["supervision"]["plausibleNotSelected"]
        for s in selected:
            for p in plausible:
                if (s, p) in P0_DIRECTIONS:
                    margin = values[index, common.MODEL_LABELS.index(s)] - values[index, common.MODEL_LABELS.index(p)]
                    events.append({"rowId": row["rowId"], "direction": f"{s}>{p}", "margin": float(margin), "correct": bool(margin > 0)})
    return events


def p0_report(rows: list[dict], probabilities: np.ndarray) -> dict:
    events = p0_events(rows, probabilities)
    directions = {}
    for selected, plausible in P0_DIRECTIONS:
        key = f"{selected}>{plausible}"
        subset = [event for event in events if event["direction"] == key]
        directions[key] = {
            "support": len(subset),
            "rawOrdering": sum(event["correct"] for event in subset) / len(subset),
            "meanMargin": float(np.mean([event["margin"] for event in subset])),
        }
    return {
        "p0Events": len(events),
        "rawOrderingMacro": float(np.mean([direction["rawOrdering"] for direction in directions.values()])),
        "meanMargin": float(np.mean([event["margin"] for event in events])),
        "directions": directions,
    }


def all_pair_margin(rows: list[dict], probabilities: np.ndarray) -> dict:
    values = logit(probabilities)
    margins = []
    rows_all_correct = []
    for index, row in enumerate(rows):
        selected = row["supervision"]["selected"]
        plausible = row["supervision"]["plausibleNotSelected"]
        if selected and plausible:
            pair_margins = [
                values[index, common.MODEL_LABELS.index(s)] - values[index, common.MODEL_LABELS.index(p)]
                for s in selected for p in plausible
            ]
            margins.extend(pair_margins)
            rows_all_correct.append(all(margin > 0 for margin in pair_margins))
    return {
        "pairBearingRows": len(rows_all_correct),
        "meanMargin": float(np.mean(margins)),
        "allSelectedAbovePlausibleRate": float(np.mean(rows_all_correct)),
    }


def state_shift(rows: list[dict], source: np.ndarray, destination: np.ndarray) -> dict:
    change = logit(destination) - logit(source)
    result = {}
    for state in ("selected", "plausibleNotSelected", "notApplicable"):
        values = [
            change[row_index, common.MODEL_LABELS.index(label)]
            for row_index, row in enumerate(rows)
            for label in row["supervision"][state]
        ]
        result[state] = {"cells": len(values), "meanLogitDelta": float(np.mean(values))}
    return result


def p0_flips(rows: list[dict], reference: np.ndarray, candidate: np.ndarray) -> dict:
    left = p0_events(rows, reference)
    right = p0_events(rows, candidate)
    if [(event["rowId"], event["direction"]) for event in left] != [(event["rowId"], event["direction"]) for event in right]:
        raise AssertionError("P0 event alignment changed")
    return {
        "goodToBad": sum(a["correct"] and not b["correct"] for a, b in zip(left, right)),
        "badToGood": sum(not a["correct"] and b["correct"] for a, b in zip(left, right)),
        "meanP0MarginDelta": float(np.mean([b["margin"] - a["margin"] for a, b in zip(left, right)])),
    }


def displacement(candidate: Path) -> dict:
    source = common.CHECKPOINT / "model.safetensors"
    target = candidate / "model.safetensors"
    report = {}
    with safe_open(source, framework="pt", device="cpu") as base, safe_open(target, framework="pt", device="cpu") as tuned:
        for layer in (10, 11):
            keys = [key for key in base.keys() if key.startswith(f"roberta.encoder.layer.{layer}.")]
            squared = 0.0
            base_squared = 0.0
            for key in keys:
                a = base.get_tensor(key).to(torch.float64)
                b = tuned.get_tensor(key).to(torch.float64)
                squared += float(((b - a) ** 2).sum())
                base_squared += float((a ** 2).sum())
            report[f"layer{layer}"] = {
                "parameterTensors": len(keys),
                "l2": squared ** 0.5,
                "relativeL2": (squared / base_squared) ** 0.5,
            }
    return report


@torch.inference_mode()
def train_probabilities(checkpoint: Path, rows: list[dict]) -> np.ndarray:
    tokenizer = AutoTokenizer.from_pretrained(common.CHECKPOINT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    loader = DataLoader(
        common.SelectiveDataset(rows, tokenizer), batch_size=common.BATCH_SIZE,
        shuffle=False, collate_fn=common.collate(tokenizer), num_workers=0,
    )
    result = common.infer(model, loader, common.positions(model, common.MODEL_LABELS), torch.device("cpu"))
    del model
    return result


def main() -> None:
    torch.set_num_threads(4)
    train_rows = common.read_rows(common.ACCEPTED / "train.jsonl")
    dev_rows = common.read_rows(common.ACCEPTED / "dev.jsonl")
    if len(train_rows) != 270 or len(dev_rows) != 315:
        raise AssertionError("Train/Dev counts changed")
    dev = {"incumbent": np.load(RUNS["v8"] / "incumbent-dev-probabilities.npy")}
    for name, directory in RUNS.items():
        dev[name] = np.load(directory / "candidate-dev-probabilities.npy")
    if any(values.shape != (315, len(common.MODEL_LABELS)) for values in dev.values()):
        raise AssertionError("Dev probability shape mismatch")
    train = {
        "incumbent": train_probabilities(common.CHECKPOINT, train_rows),
        "v2": train_probabilities(RUNS["v2"] / "final-checkpoint", train_rows),
        "v8": train_probabilities(RUNS["v8"] / "final-checkpoint", train_rows),
    }
    summaries = {name: json.loads((directory / "summary.json").read_text()) for name, directory in RUNS.items()}
    summaries["incumbent"] = summaries["v8"]
    report = {
        "scope": "Train 270 and locked Dev 315 only; Final unopened",
        "encoderDisplacementFromBase": {
            name: displacement(RUNS[name] / "final-checkpoint") for name in ("v2", "v8")
        },
        "train": {
            name: {"p0": p0_report(train_rows, values), "allPairs": all_pair_margin(train_rows, values)}
            for name, values in train.items()
        },
        "dev": {
            name: {
                "p0": p0_report(dev_rows, values),
                "allPairs": all_pair_margin(dev_rows, values),
                "macroF1": summaries[name]["incumbent" if name == "incumbent" else "candidate"]["metrics"]["macro"]["f1"],
                "microF1": summaries[name]["incumbent" if name == "incumbent" else "candidate"]["metrics"]["micro"]["f1"],
                "falsePositives": summaries[name]["incumbent" if name == "incumbent" else "candidate"]["counts"]["fp"],
                "directionalSelectionMacro": summaries[name]["incumbent" if name == "incumbent" else "candidate"]["p0"]["macroDirectionalSelectionAccuracy"],
            }
            for name, values in dev.items()
        },
        "devLogitShifts": {
            f"v8Vs{name}": state_shift(dev_rows, values, dev["v8"])
            for name, values in dev.items() if name != "v8"
        },
        "devP0Flips": {
            f"v8Vs{name}": p0_flips(dev_rows, values, dev["v8"])
            for name, values in dev.items() if name != "v8"
        },
    }
    path = RUNS["v8"] / "diagnostics.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"diagnostics": str(path), "status": "COMPLETE", "finalAccessed": False}), flush=True)


if __name__ == "__main__":
    main()
