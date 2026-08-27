#!/usr/bin/env python3
"""Train and evaluate frozen MiniLM embeddings + OVR logistic regression."""

from __future__ import annotations

import argparse
import csv
import gc
import json
import os
import platform
import resource
import statistics
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import psutil
import sklearn
import torch
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.multiclass import OneVsRestClassifier


ROOT_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(ROOT_SCRIPTS))
from train_evaluate import (  # noqa: E402
    GARDEN_MAPPING,
    LABELS,
    UNMAPPED_LABELS,
    apply_thresholds,
    best_thresholds,
    garden_evaluation,
    metrics_for_labels,
    read_labels,
    read_split,
    split_counts,
    write_error_analysis,
)


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def directory_size(path: Path) -> int:
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


def rss_mb() -> float:
    return psutil.Process().memory_info().rss / 1_048_576


def peak_rss_mb() -> float:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS reports bytes; Linux reports KiB.
    return value / 1_048_576 if platform.system() == "Darwin" else value / 1024


def encode(model: SentenceTransformer, texts: list[str]) -> np.ndarray:
    return model.encode(
        texts,
        batch_size=256,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
        device="cpu",
    ).astype(np.float32, copy=False)


def benchmark(model, classifier, texts: list[str]) -> dict:
    sample = texts[: min(300, len(texts))]
    for text in sample[:20]:
        embedding = model.encode([text], convert_to_numpy=True, normalize_embeddings=True, device="cpu", show_progress_bar=False)
        classifier.predict_proba(embedding)
    timings = []
    for text in sample:
        started = time.perf_counter_ns()
        embedding = model.encode([text], convert_to_numpy=True, normalize_embeddings=True, device="cpu", show_progress_bar=False)
        classifier.predict_proba(embedding)
        timings.append((time.perf_counter_ns() - started) / 1_000_000)
    batch_sample = texts[: min(1000, len(texts))]
    started = time.perf_counter_ns()
    embeddings = model.encode(
        batch_sample, batch_size=256, convert_to_numpy=True,
        normalize_embeddings=True, device="cpu", show_progress_bar=False,
    )
    classifier.predict_proba(embeddings)
    batch_ms = (time.perf_counter_ns() - started) / 1_000_000
    return {
        "single_text_samples": len(timings),
        "single_text_mean_ms": round(float(statistics.mean(timings)), 4),
        "single_text_median_ms": round(float(statistics.median(timings)), 4),
        "single_text_p95_ms": round(float(np.percentile(timings, 95)), 4),
        "batch_samples": len(batch_sample),
        "batch_total_ms": round(float(batch_ms), 4),
        "batch_per_text_ms": round(float(batch_ms / len(batch_sample)), 4),
    }


def comparison_rows(tfidf_dir: Path, mini_metrics: dict, mini_per_label: list[dict]) -> tuple[list[dict], dict]:
    tfidf_metrics = json.loads((tfidf_dir / "metrics.json").read_text(encoding="utf-8"))
    with (tfidf_dir / "per-label-metrics.csv").open(encoding="utf-8") as handle:
        tfidf_per_label = {row["label"]: row for row in csv.DictReader(handle)}
    mini_by_label = {row["label"]: row for row in mini_per_label}
    rows = []
    for label in LABELS:
        old = float(tfidf_per_label[label]["f1"])
        new = float(mini_by_label[label]["f1"])
        rows.append({"label": label, "tfidf_f1": round(old, 6), "minilm_f1": round(new, 6), "difference": round(new - old, 6)})
    summary = {
        "macro_f1": {
            "tfidf": tfidf_metrics["test"]["macro_f1"],
            "minilm": mini_metrics["test"]["macro_f1"],
            "difference": round(mini_metrics["test"]["macro_f1"] - tfidf_metrics["test"]["macro_f1"], 6),
        },
        "micro_f1": {
            "tfidf": tfidf_metrics["test"]["micro_f1"],
            "minilm": mini_metrics["test"]["micro_f1"],
            "difference": round(mini_metrics["test"]["micro_f1"] - tfidf_metrics["test"]["micro_f1"], 6),
        },
        "garden_micro_f1": {
            "tfidf": tfidf_metrics["garden_mood_evaluation"]["micro_f1"],
            "minilm": mini_metrics["garden_mood_evaluation"]["micro_f1"],
            "difference": round(mini_metrics["garden_mood_evaluation"]["micro_f1"] - tfidf_metrics["garden_mood_evaluation"]["micro_f1"], 6),
        },
        "latency_median_ms": {
            "tfidf": tfidf_metrics["latency"]["single_text_median_ms"],
            "minilm": mini_metrics["latency"]["single_text_median_ms"],
            "difference": round(mini_metrics["latency"]["single_text_median_ms"] - tfidf_metrics["latency"]["single_text_median_ms"], 4),
        },
        "latency_p95_ms": {
            "tfidf": tfidf_metrics["latency"]["single_text_p95_ms"],
            "minilm": mini_metrics["latency"]["single_text_p95_ms"],
            "difference": round(mini_metrics["latency"]["single_text_p95_ms"] - tfidf_metrics["latency"]["single_text_p95_ms"], 4),
        },
        "artifact_megabytes": {
            "tfidf": tfidf_metrics["model"]["artifact_megabytes"],
            "minilm": mini_metrics["model"]["artifact_megabytes"],
            "difference": round(mini_metrics["model"]["artifact_megabytes"] - tfidf_metrics["model"]["artifact_megabytes"], 4),
        },
        "training_seconds": {
            "tfidf": tfidf_metrics["model"]["training_seconds"],
            "minilm": mini_metrics["model"]["pipeline_training_seconds"],
            "difference": round(mini_metrics["model"]["pipeline_training_seconds"] - tfidf_metrics["model"]["training_seconds"], 4),
        },
        "per_label": rows,
    }
    return rows, summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--goemotions-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--tfidf-dir", type=Path, required=True)
    args = parser.parse_args()
    output = args.output_dir.resolve()
    artifacts = output / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    baseline_rss = rss_mb()

    all_labels = read_labels(args.goemotions_dir / "emotions.txt")
    data = {split: read_split(args.goemotions_dir / f"{split}.tsv", all_labels) for split in ["train", "dev", "test"]}
    train_texts, y_train, _ = data["train"]
    dev_texts, y_dev, _ = data["dev"]
    test_texts, y_test, _ = data["test"]
    counts_by_split = {split: split_counts(data[split][1]) for split in data}
    counts = {label: {split: counts_by_split[split][label] for split in ["train", "dev", "test"]} for label in LABELS}

    load_started = time.perf_counter()
    encoder = SentenceTransformer(MODEL_NAME, device="cpu")
    encoder.max_seq_length = 256
    model_load_seconds = time.perf_counter() - load_started
    model_loaded_rss = rss_mb()

    pipeline_started = time.perf_counter()
    started = time.perf_counter()
    x_train = encode(encoder, train_texts)
    train_embedding_seconds = time.perf_counter() - started
    started = time.perf_counter()
    x_dev = encode(encoder, dev_texts)
    dev_embedding_seconds = time.perf_counter() - started
    started = time.perf_counter()
    x_test = encode(encoder, test_texts)
    test_embedding_seconds = time.perf_counter() - started

    classifier = OneVsRestClassifier(
        LogisticRegression(
            solver="liblinear", class_weight="balanced", max_iter=1000,
            random_state=20260827,
        ),
        n_jobs=1,
    )
    started = time.perf_counter()
    classifier.fit(x_train, y_train)
    classifier_training_seconds = time.perf_counter() - started
    pipeline_training_seconds = time.perf_counter() - pipeline_started

    dev_probabilities = classifier.predict_proba(x_dev)
    thresholds, threshold_details = best_thresholds(y_dev, dev_probabilities)
    test_probabilities = classifier.predict_proba(x_test)
    y_test_pred = apply_thresholds(test_probabilities, thresholds)
    per_label = metrics_for_labels(y_test, y_test_pred, counts)

    encoder_dir = artifacts / "all-MiniLM-L6-v2"
    encoder.save_pretrained(str(encoder_dir))
    classifier_path = artifacts / "ovr-logreg.joblib"
    joblib.dump({
        "classifier": classifier,
        "labels": LABELS,
        "thresholds": thresholds.tolist(),
        "garden_mapping": GARDEN_MAPPING,
        "unmapped_labels": UNMAPPED_LABELS,
        "encoder_model": "all-MiniLM-L6-v2",
        "max_seq_length": 256,
    }, classifier_path, compress=3)
    artifact_bytes = directory_size(artifacts)

    with (output / "per-label-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(per_label[0]))
        writer.writeheader()
        writer.writerows(per_label)
    (output / "thresholds.json").write_text(json.dumps(threshold_details, indent=2) + "\n", encoding="utf-8")
    write_error_analysis(output / "error-analysis.csv", test_texts, y_test, y_test_pred, test_probabilities)

    del x_train, x_dev, x_test, dev_probabilities, test_probabilities
    gc.collect()
    latency = benchmark(encoder, classifier, test_texts)
    ranked = sorted(per_label, key=lambda row: row["f1"], reverse=True)
    metrics = {
        "experiment": "PetalPal Emotion Classifier V2 Candidate B",
        "production_modified": False,
        "training_labels": LABELS,
        "data_source": "Official GoEmotions TSV files only",
        "legacy_petalpal_data_used": False,
        "official_splits_preserved": True,
        "split_sample_counts_after_label_filter": {split: len(data[split][0]) for split in data},
        "per_label_counts": counts,
        "model": {
            "type": "Frozen all-MiniLM-L6-v2 embeddings + One-vs-Rest Logistic Regression",
            "encoder": MODEL_NAME,
            "embedding_dimensions": 384,
            "max_seq_length": 256,
            "model_load_seconds": round(model_load_seconds, 4),
            "train_embedding_seconds": round(train_embedding_seconds, 4),
            "dev_embedding_seconds": round(dev_embedding_seconds, 4),
            "test_embedding_seconds": round(test_embedding_seconds, 4),
            "classifier_training_seconds": round(classifier_training_seconds, 4),
            "pipeline_training_seconds": round(pipeline_training_seconds, 4),
            "artifact_bytes": artifact_bytes,
            "artifact_megabytes": round(artifact_bytes / 1_048_576, 4),
            "python": sys.version,
            "torch": torch.__version__,
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
        },
        "memory": {
            "baseline_process_rss_mb": round(baseline_rss, 4),
            "after_encoder_load_rss_mb": round(model_loaded_rss, 4),
            "encoder_incremental_rss_mb": round(model_loaded_rss - baseline_rss, 4),
            "final_process_rss_mb": round(rss_mb(), 4),
            "peak_training_process_rss_mb": round(peak_rss_mb(), 4),
            "measurement_note": "Process RSS includes Python, PyTorch, tokenizer, encoder, classifier, and experiment runtime.",
        },
        "test": {
            "macro_precision": round(float(precision_score(y_test, y_test_pred, average="macro", zero_division=0)), 6),
            "macro_recall": round(float(recall_score(y_test, y_test_pred, average="macro", zero_division=0)), 6),
            "macro_f1": round(float(f1_score(y_test, y_test_pred, average="macro", zero_division=0)), 6),
            "micro_precision": round(float(precision_score(y_test, y_test_pred, average="micro", zero_division=0)), 6),
            "micro_recall": round(float(recall_score(y_test, y_test_pred, average="micro", zero_division=0)), 6),
            "micro_f1": round(float(f1_score(y_test, y_test_pred, average="micro", zero_division=0)), 6),
            "easiest_labels_by_f1": [{"label": row["label"], "f1": row["f1"]} for row in ranked[:5]],
            "hardest_labels_by_f1": [{"label": row["label"], "f1": row["f1"]} for row in ranked[-5:]],
        },
        "latency": latency,
        "garden_mood_evaluation": garden_evaluation(y_test, y_test_pred),
    }
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    label_comparison, comparison = comparison_rows(args.tfidf_dir.resolve(), metrics, per_label)
    with (output / "tfidf-vs-minilm-per-label.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["label", "tfidf_f1", "minilm_f1", "difference"])
        writer.writeheader()
        writer.writerows(label_comparison)
    (output / "tfidf-vs-minilm.json").write_text(json.dumps(comparison, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: comparison[key] for key in ["macro_f1", "micro_f1", "garden_micro_f1", "latency_median_ms", "artifact_megabytes"]}, indent=2))


if __name__ == "__main__":
    main()
