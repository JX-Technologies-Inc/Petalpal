#!/usr/bin/env python3
"""Train/Dev-only audit of BCE and relational-gradient interaction."""

from __future__ import annotations

import importlib.util
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
COMMON_PATH = HERE / "run_official_training.py"
OUTPUT = HERE / "candidate-v5/objective-conflict-audit.json"
V2_CHECKPOINT = HERE / "candidate-v2/run/final-checkpoint"
CHECKPOINTS = {
    "V1": HERE / "official-training-v1/run/final-checkpoint",
    "V2": V2_CHECKPOINT,
    "V3": HERE / "candidate-v3/run/final-checkpoint",
    "V4": HERE / "candidate-v4/run/final-checkpoint",
}
P0 = [
    ("sadness", "caring"), ("caring", "love"), ("joy", "optimism"),
    ("joy", "excitement"), ("caring", "gratitude"), ("joy", "love"),
    ("fear", "annoyance"),
]


def load_common():
    spec = importlib.util.spec_from_file_location("target_first_audit_common", COMMON_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def flattened(grads: list[torch.Tensor]) -> torch.Tensor:
    return torch.cat([gradient.reshape(-1) for gradient in grads])


def cosine(left: torch.Tensor, right: torch.Tensor) -> float:
    denominator = left.norm() * right.norm()
    return float(torch.dot(left, right) / denominator) if denominator else 0.0


def component_losses(common, logits: torch.Tensor, batch: dict) -> tuple[torch.Tensor, torch.Tensor]:
    targets = batch["targets"].to(logits.device)
    mask = batch["mask"].to(logits.device)
    cells = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
    bce = ((cells * mask).sum(dim=1) / mask.sum(dim=1)).mean()
    ranking = []
    for row_logits, selected, plausible in zip(logits, batch["selected"], batch["plausible"]):
        if selected and plausible:
            selected_logits = row_logits[torch.tensor(selected, device=logits.device)]
            plausible_logits = row_logits[torch.tensor(plausible, device=logits.device)]
            ranking.append(F.softplus(plausible_logits[:, None] - selected_logits[None, :]).mean())
        else:
            ranking.append(row_logits.sum() * 0.0)
    return bce, torch.stack(ranking).mean()


def parameter_gradients(loss: torch.Tensor, parameters: list[torch.nn.Parameter], retain_graph: bool) -> list[torch.Tensor]:
    gradients = torch.autograd.grad(loss, parameters, retain_graph=retain_graph, allow_unused=True)
    return [gradient.detach() if gradient is not None else torch.zeros_like(parameter) for gradient, parameter in zip(gradients, parameters)]


def gradient_audit(common, checkpoint: Path, rows: list[dict], tokenizer) -> dict:
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    model.eval()
    common.configure_trainable(model)
    positions = common.positions(model, common.PRODUCT_LABELS)
    pair_rows = [row for row in rows if row["supervision"]["plausibleNotSelected"]]
    loader = DataLoader(
        common.SelectiveDataset(pair_rows, tokenizer), batch_size=16, shuffle=False,
        collate_fn=common.collate(tokenizer), num_workers=0,
    )
    parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    bce_total = torch.zeros((), dtype=torch.float32)
    rank_total = torch.zeros((), dtype=torch.float32)
    logit_bce_total = torch.zeros(len(common.PRODUCT_LABELS))
    logit_rank_total = torch.zeros(len(common.PRODUCT_LABELS))
    batch_cosines = []
    for batch in loader:
        logits = model(**batch["encoded"]).logits[:, positions]
        bce, rank = component_losses(common, logits, batch)
        weight = len(batch["selected"]) / len(pair_rows)
        bce_total = bce_total + bce * weight
        rank_total = rank_total + rank * weight

        gb = flattened(parameter_gradients(bce, parameters, retain_graph=True))
        gr = flattened(parameter_gradients(rank, parameters, retain_graph=True))
        batch_cosines.append(cosine(gb, gr))

        glb = torch.autograd.grad(bce, logits, retain_graph=True)[0]
        glr = torch.autograd.grad(rank, logits, retain_graph=True)[0]
        logit_bce_total += glb.detach().sum(dim=0) * weight
        logit_rank_total += glr.detach().sum(dim=0) * weight

    gb = flattened(parameter_gradients(bce_total, parameters, retain_graph=True))
    gr = flattened(parameter_gradients(rank_total, parameters, retain_graph=False))
    lambda_rank = 15.0 / 92.0
    label_gradient = {
        label: {
            "bce": float(logit_bce_total[index]),
            "ranking": float(logit_rank_total[index]),
            "weightedRanking": float(lambda_rank * logit_rank_total[index]),
            "combined": float(logit_bce_total[index] + lambda_rank * logit_rank_total[index]),
        }
        for index, label in enumerate(common.PRODUCT_LABELS)
    }
    return {
        "checkpoint": str(checkpoint),
        "pairRows": len(pair_rows),
        "bceLoss": float(bce_total.detach()),
        "rankingLoss": float(rank_total.detach()),
        "parameterGradients": {
            "bceNorm": float(gb.norm()),
            "rankingNormUnweighted": float(gr.norm()),
            "rankingNormWeighted": float(lambda_rank * gr.norm()),
            "weightedRankingOverBce": float(lambda_rank * gr.norm() / gb.norm()),
            "cosine": cosine(gb, gr),
            "batchCosines": batch_cosines,
            "negativeBatchCosines": sum(value < 0 for value in batch_cosines),
        },
        "classifierLogitGradients": {
            "cosine": cosine(logit_bce_total, logit_rank_total),
            "byLabel": label_gradient,
        },
    }


@torch.inference_mode()
def probabilities(common, checkpoint: Path, rows: list[dict], tokenizer) -> np.ndarray:
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    model.eval()
    positions = common.positions(model, common.MODEL_LABELS)
    loader = DataLoader(
        common.SelectiveDataset(rows, tokenizer), batch_size=16, shuffle=False,
        collate_fn=common.collate(tokenizer), num_workers=0,
    )
    return common.infer(model, loader, positions, torch.device("cpu"))


def logit(probability: np.ndarray) -> np.ndarray:
    clipped = np.clip(probability, 1e-7, 1 - 1e-7)
    return np.log(clipped / (1 - clipped))


def margin_report(common, rows: list[dict], values: np.ndarray) -> dict:
    model_index = {label: common.MODEL_LABELS.index(label) for label in common.PRODUCT_LABELS}
    directions = {}
    all_margins = []
    for first, second in P0:
        for selected, plausible in ((first, second), (second, first)):
            margins = [
                float(values[index, model_index[selected]] - values[index, model_index[plausible]])
                for index, row in enumerate(rows)
                if selected in row["supervision"]["selected"]
                and plausible in row["supervision"]["plausibleNotSelected"]
            ]
            all_margins.extend(margins)
            directions[f"{selected}>{plausible}"] = {
                "support": len(margins),
                "mean": float(np.mean(margins)),
                "median": float(np.median(margins)),
                "positiveRate": float(np.mean(np.asarray(margins) > 0)),
                "belowPositiveMargin1Rate": float(np.mean(np.asarray(margins) < 1.0)),
            }
    return {
        "directions": directions,
        "macroPositiveRate": float(np.mean([record["positiveRate"] for record in directions.values()])),
        "meanMargin": float(np.mean(all_margins)),
        "medianMargin": float(np.median(all_margins)),
        "belowPositiveMargin1Rate": float(np.mean(np.asarray(all_margins) < 1.0)),
    }


def bias_report(common) -> dict:
    base = AutoModelForSequenceClassification.from_pretrained(common.CHECKPOINT, local_files_only=True)
    positions = common.positions(base, common.PRODUCT_LABELS)
    base_bias = base.classifier.out_proj.bias.detach().cpu().numpy()[positions]
    result = {}
    for name, checkpoint in CHECKPOINTS.items():
        model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
        current = model.classifier.out_proj.bias.detach().cpu().numpy()[positions]
        result[name] = {
            label: float(current[index] - base_bias[index])
            for index, label in enumerate(common.PRODUCT_LABELS)
        }
    return result


def main() -> None:
    torch.set_num_threads(4)
    torch.manual_seed(56)
    common = load_common()
    train = common.read_rows(common.ACCEPTED / "train.jsonl")
    dev = common.read_rows(common.ACCEPTED / "dev.jsonl")
    tokenizer = AutoTokenizer.from_pretrained(common.CHECKPOINT, local_files_only=True)
    selected = Counter(label for row in train for label in row["supervision"]["selected"])
    plausible = Counter(label for row in train for label in row["supervision"]["plausibleNotSelected"])
    frequency = {
        label: {
            "selectedRows": selected[label], "plausibleRows": plausible[label],
            "selectedMinusPlausible": selected[label] - plausible[label],
            "plausiblePerSelected": plausible[label] / selected[label] if selected[label] else None,
        }
        for label in common.PRODUCT_LABELS
    }

    base_train = probabilities(common, common.CHECKPOINT, train, tokenizer)
    v2_train = probabilities(common, V2_CHECKPOINT, train, tokenizer)
    base_dev = np.load(HERE / "candidate-v2/run/incumbent-dev-probabilities.npy")
    v2_dev = np.load(HERE / "candidate-v2/run/candidate-dev-probabilities.npy")
    base_train_logits, v2_train_logits = logit(base_train), logit(v2_train)
    base_dev_logits, v2_dev_logits = logit(base_dev), logit(v2_dev)

    report = {
        "status": "COMPLETE",
        "scope": "Train 270 and locked Dev 315 only; Final unopened",
        "finalAccessed": False,
        "trainLabelRoles": frequency,
        "gradientAudit": {
            "base": gradient_audit(common, common.CHECKPOINT, train, tokenizer),
            "V2": gradient_audit(common, V2_CHECKPOINT, train, tokenizer),
        },
        "classifierBiasDeltaFromBase": bias_report(common),
        "margins": {
            "trainBase": margin_report(common, train, base_train_logits),
            "trainV2": margin_report(common, train, v2_train_logits),
            "devBase": margin_report(common, dev, base_dev_logits),
            "devV2": margin_report(common, dev, v2_dev_logits),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
