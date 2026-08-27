#!/usr/bin/env python3
"""Find same-test cases fixed or regressed by MiniLM versus TF-IDF."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import joblib
import numpy as np
from sentence_transformers import SentenceTransformer

ROOT_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(ROOT_SCRIPTS))
from train_evaluate import LABELS, apply_thresholds, read_labels, read_split  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--goemotions-dir", type=Path, required=True)
parser.add_argument("--tfidf-artifact", type=Path, required=True)
parser.add_argument("--minilm-artifact", type=Path, required=True)
parser.add_argument("--encoder", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()

all_labels = read_labels(args.goemotions_dir / "emotions.txt")
texts, y_true, _ = read_split(args.goemotions_dir / "test.tsv", all_labels)
tfidf = joblib.load(args.tfidf_artifact)
mini = joblib.load(args.minilm_artifact)
encoder = SentenceTransformer(str(args.encoder), device="cpu")

tfidf_prob = tfidf["classifier"].predict_proba(tfidf["vectorizer"].transform(texts))
mini_embeddings = encoder.encode(
    texts, batch_size=256, convert_to_numpy=True, normalize_embeddings=True,
    device="cpu", show_progress_bar=True,
)
mini_prob = mini["classifier"].predict_proba(mini_embeddings)
tfidf_pred = apply_thresholds(tfidf_prob, np.asarray(tfidf["thresholds"]))
mini_pred = apply_thresholds(mini_prob, np.asarray(mini["thresholds"]))

rows = []
for index, label in enumerate(LABELS):
    fixed = np.where((tfidf_pred[:, index] != y_true[:, index]) & (mini_pred[:, index] == y_true[:, index]))[0]
    regressed = np.where((tfidf_pred[:, index] == y_true[:, index]) & (mini_pred[:, index] != y_true[:, index]))[0]
    for outcome, indices in [("fixed_by_minilm", fixed), ("regressed_in_minilm", regressed)]:
        for row in indices[:10]:
            rows.append({
                "label": label,
                "outcome": outcome,
                "truth": int(y_true[row, index]),
                "tfidf_prediction": int(tfidf_pred[row, index]),
                "minilm_prediction": int(mini_pred[row, index]),
                "tfidf_score": round(float(tfidf_prob[row, index]), 6),
                "minilm_score": round(float(mini_prob[row, index]), 6),
                "text": texts[row].replace("\n", " "),
            })

with args.output.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
