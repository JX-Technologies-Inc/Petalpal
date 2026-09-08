#!/usr/bin/env python3
"""Read-only global threshold sweep on a JSONL dev set."""

import argparse
import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from fine_tune import PetalPalDataset, label_positions


THRESHOLDS = (0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50)


def scores(targets, probabilities, threshold):
    truth = targets.bool()
    predicted = probabilities >= threshold
    tp = (predicted & truth).sum(0).float()
    fp = (predicted & ~truth).sum(0).float()
    fn = (~predicted & truth).sum(0).float()
    precision = tp / (tp + fp).clamp_min(1)
    recall = tp / (tp + fn).clamp_min(1)
    f1 = 2 * precision * recall / (precision + recall).clamp_min(1e-12)
    micro_p = tp.sum() / (tp.sum() + fp.sum()).clamp_min(1)
    micro_r = tp.sum() / (tp.sum() + fn.sum()).clamp_min(1)
    micro_f1 = 2 * micro_p * micro_r / (micro_p + micro_r).clamp_min(1e-12)
    return {"macro_f1": f1.mean().item(), "micro_f1": micro_f1.item()}


@torch.no_grad()
def evaluate(checkpoint, dev, batch_size):
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    positions = label_positions(model)
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device).eval()
    loader = DataLoader(PetalPalDataset(dev, tokenizer), batch_size=batch_size)
    targets, probabilities = [], []
    for batch in loader:
        targets.append(batch.pop("labels"))
        logits = model(**{key: value.to(device) for key, value in batch.items()}).logits[:, positions]
        probabilities.append(torch.sigmoid(logits).cpu())
    truth, probs = torch.cat(targets), torch.cat(probabilities)
    return {str(t): scores(truth, probs, t) for t in THRESHOLDS}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", type=Path, required=True)
    parser.add_argument("--checkpoints", type=Path, nargs="+", required=True)
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()
    print(json.dumps({str(p): evaluate(p, args.dev, args.batch_size) for p in args.checkpoints}, indent=2))


if __name__ == "__main__":
    main()
