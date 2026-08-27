#!/usr/bin/env python3
"""Measure clean-process RSS for either frozen experiment artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import psutil


def rss_mb() -> float:
    return psutil.Process().memory_info().rss / 1_048_576


parser = argparse.ArgumentParser()
parser.add_argument("--kind", choices=["tfidf", "minilm"], required=True)
parser.add_argument("--artifact", type=Path, required=True)
parser.add_argument("--encoder", type=Path)
args = parser.parse_args()
baseline = rss_mb()

import joblib  # noqa: E402

if args.kind == "tfidf":
    bundle = joblib.load(args.artifact)
    loaded = rss_mb()
    features = bundle["vectorizer"].transform(["I feel grateful but slightly worried today."])
    bundle["classifier"].predict_proba(features)
else:
    from sentence_transformers import SentenceTransformer  # noqa: E402

    encoder = SentenceTransformer(str(args.encoder), device="cpu")
    bundle = joblib.load(args.artifact)
    loaded = rss_mb()
    features = encoder.encode(
        ["I feel grateful but slightly worried today."],
        convert_to_numpy=True,
        normalize_embeddings=True,
        device="cpu",
        show_progress_bar=False,
    )
    bundle["classifier"].predict_proba(features)

after_inference = rss_mb()
print(json.dumps({
    "kind": args.kind,
    "baseline_rss_mb": round(baseline, 4),
    "loaded_rss_mb": round(loaded, 4),
    "after_inference_rss_mb": round(after_inference, 4),
    "incremental_loaded_rss_mb": round(loaded - baseline, 4),
    "incremental_after_inference_rss_mb": round(after_inference - baseline, 4),
}, indent=2))
