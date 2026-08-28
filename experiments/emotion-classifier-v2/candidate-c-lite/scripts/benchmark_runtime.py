#!/usr/bin/env python3
"""Consistent clean-process single-text CPU benchmark for all candidates."""

from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import statistics
import time
from pathlib import Path

import numpy as np
import psutil


LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]


def test_texts(goemotions_dir: Path, count: int) -> list[str]:
    all_labels = [line.strip() for line in (goemotions_dir / "emotions.txt").read_text().splitlines()]
    texts = []
    with (goemotions_dir / "test.tsv").open(encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle, delimiter="\t"):
            if any(all_labels[int(index)] in LABELS for index in row[1].split(",")):
                texts.append(row[0])
                if len(texts) == count: break
    return texts


def benchmark(call, texts):
    for text in texts[:10]: call(text)
    timings = []
    for text in texts:
        started = time.perf_counter_ns(); call(text)
        timings.append((time.perf_counter_ns() - started) / 1_000_000)
    return round(statistics.median(timings), 4), round(float(np.percentile(timings, 95)), 4)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime", choices=["tfidf", "pytorch", "onnx-fp32", "onnx-int8"], required=True)
    parser.add_argument("--goemotions-dir", type=Path, required=True)
    parser.add_argument("--v2-dir", type=Path, required=True)
    parser.add_argument("--samples", type=int, default=200)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    process = psutil.Process(os.getpid()); rss_baseline = process.memory_info().rss
    texts = test_texts(args.goemotions_dir, args.samples)

    if args.runtime == "tfidf":
        import joblib
        bundle = joblib.load(args.v2_dir / "artifacts" / "tfidf-ovr-logreg.joblib")
        call = lambda text: bundle["classifier"].predict_proba(bundle["vectorizer"].transform([text]))
        artifact = args.v2_dir / "artifacts" / "tfidf-ovr-logreg.joblib"
    elif args.runtime == "pytorch":
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        torch.set_num_threads(1)
        checkpoint = args.v2_dir / "candidate-c" / "artifacts" / "checkpoint"
        tokenizer = AutoTokenizer.from_pretrained(checkpoint)
        model = AutoModelForSequenceClassification.from_pretrained(checkpoint).eval()
        @torch.inference_mode()
        def call(text):
            encoded = tokenizer(text, truncation=True, max_length=128, return_tensors="pt")
            return model(**encoded).logits
        artifact = checkpoint / "model.safetensors"
    else:
        import onnxruntime as ort
        from transformers import AutoTokenizer
        options = ort.SessionOptions(); options.intra_op_num_threads = 1; options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        tokenizer = AutoTokenizer.from_pretrained(args.v2_dir / "candidate-c-lite" / "artifacts" / "tokenizer")
        filename = "model-fp32.onnx" if args.runtime == "onnx-fp32" else "model-int8.onnx"
        artifact = args.v2_dir / "candidate-c-lite" / "artifacts" / filename
        session = ort.InferenceSession(str(artifact), sess_options=options, providers=["CPUExecutionProvider"])
        def call(text):
            encoded = tokenizer(text, truncation=True, max_length=128, return_tensors="np")
            return session.run(["logits"], {"input_ids": encoded["input_ids"].astype(np.int64),
                                             "attention_mask": encoded["attention_mask"].astype(np.int64)})

    rss_loaded = process.memory_info().rss
    median, p95 = benchmark(call, texts)
    rss_after = process.memory_info().rss
    result = {
        "runtime": args.runtime, "samples": len(texts), "median_ms": median, "p95_ms": p95,
        "artifact_bytes": artifact.stat().st_size, "artifact_megabytes": round(artifact.stat().st_size / 1_048_576, 4),
        "rss_baseline_mb": round(rss_baseline / 1_048_576, 2),
        "rss_loaded_mb": round(rss_loaded / 1_048_576, 2),
        "rss_after_inference_mb": round(rss_after / 1_048_576, 2),
        "incremental_rss_after_inference_mb": round((rss_after - rss_baseline) / 1_048_576, 2),
        "platform": platform.platform(), "thread_count": 1,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
