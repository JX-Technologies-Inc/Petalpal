#!/usr/bin/env python3
"""Evaluate an existing GoEmotions Transformer without touching production or Candidate A."""

from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import psutil
import torch
import transformers
from sklearn.metrics import f1_score, precision_recall_fscore_support, precision_score, recall_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer


LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]

# Copied exactly from Candidate A. Model labels and product mapping stay separate.
GARDEN_MAPPING = {
    "admiration": "Gentle Bloom", "amusement": "Sunny Bloom",
    "anger": "Fire Bloom", "annoyance": "Fire Bloom",
    "approval": "Gentle Bloom", "caring": "Gentle Bloom",
    "curiosity": "Wonder Bloom", "disappointment": "Healing Bloom",
    "disapproval": "Fire Bloom", "disgust": "Fire Bloom",
    "excitement": "Sunny Bloom", "fear": "Fire Bloom",
    "gratitude": "Gentle Bloom", "joy": "Sunny Bloom",
    "love": "Gentle Bloom", "optimism": "Sunny Bloom",
    "remorse": "Healing Bloom", "sadness": "Quiet Bloom",
}
GARDEN_MOODS = [
    "Sunny Bloom", "Gentle Bloom", "Quiet Bloom", "Healing Bloom",
    "Fire Bloom", "Wonder Bloom", "Drifting Bloom", "Peaceful Bloom",
]
UNMAPPED_LABELS = ["confusion", "surprise", "neutral"]


def read_labels(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def read_split(path: Path, all_labels: list[str]) -> tuple[list[str], np.ndarray]:
    texts, selected_rows = [], []
    with path.open(encoding="utf-8", newline="") as handle:
        for row_number, row in enumerate(csv.reader(handle, delimiter="\t"), start=1):
            if len(row) < 2:
                raise ValueError(f"Invalid row {row_number} in {path}")
            source = [all_labels[int(index)] for index in row[1].split(",")]
            selected = [label for label in source if label in LABELS]
            if selected:
                texts.append(row[0])
                selected_rows.append(selected)
    positions = {label: index for index, label in enumerate(LABELS)}
    matrix = np.zeros((len(texts), len(LABELS)), dtype=np.int8)
    for row_index, labels in enumerate(selected_rows):
        for label in labels:
            matrix[row_index, positions[label]] = 1
    return texts, matrix


def model_label_positions(model) -> list[int]:
    id2label = {int(key): str(value).lower() for key, value in model.config.id2label.items()}
    missing = [label for label in LABELS if label not in id2label.values()]
    if missing:
        raise ValueError(f"Checkpoint is missing PetalPal labels: {missing}; id2label={id2label}")
    return [next(index for index, label in id2label.items() if label == wanted) for wanted in LABELS]


@torch.inference_mode()
def predict_probabilities(model, tokenizer, texts: list[str], positions: list[int], batch_size: int) -> np.ndarray:
    rows = []
    for start in range(0, len(texts), batch_size):
        encoded = tokenizer(
            texts[start:start + batch_size], padding=True, truncation=True,
            max_length=128, return_tensors="pt",
        )
        logits = model(**encoded).logits
        rows.append(torch.sigmoid(logits)[:, positions].cpu().numpy())
    return np.concatenate(rows, axis=0)


def best_thresholds(y_true: np.ndarray, probabilities: np.ndarray) -> tuple[np.ndarray, dict]:
    candidates = np.arange(0.05, 0.951, 0.01)
    thresholds = np.zeros(len(LABELS), dtype=float)
    details = {}
    for index, label in enumerate(LABELS):
        scores = [(f1_score(y_true[:, index], probabilities[:, index] >= threshold, zero_division=0), threshold)
                  for threshold in candidates]
        best_f1 = max(score for score, _ in scores)
        best_threshold = max(threshold for score, threshold in scores if abs(score - best_f1) < 1e-12)
        thresholds[index] = best_threshold
        details[label] = {"threshold": round(float(best_threshold), 4), "dev_f1": round(float(best_f1), 6)}
    return thresholds, details


def per_label_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> list[dict]:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, average=None, zero_division=0
    )
    return [{
        "label": label, "precision": round(float(precision[index]), 6),
        "recall": round(float(recall[index]), 6), "f1": round(float(f1[index]), 6),
        "support": int(support[index]),
    } for index, label in enumerate(LABELS)]


def garden_matrix(labels: np.ndarray) -> np.ndarray:
    result = np.zeros((labels.shape[0], len(GARDEN_MOODS)), dtype=np.int8)
    mood_positions = {mood: index for index, mood in enumerate(GARDEN_MOODS)}
    for label_index, label in enumerate(LABELS):
        mood = GARDEN_MAPPING.get(label)
        if mood:
            result[:, mood_positions[mood]] |= labels[:, label_index]
    return result


def garden_evaluation(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    true_garden, pred_garden = garden_matrix(y_true), garden_matrix(y_pred)
    evaluable = true_garden.sum(axis=1) > 0
    true_eval, pred_eval = true_garden[evaluable], pred_garden[evaluable]
    precision, recall, f1, support = precision_recall_fscore_support(
        true_eval, pred_eval, average=None, zero_division=0
    )
    return {
        "mapping": GARDEN_MAPPING, "unmapped_labels": UNMAPPED_LABELS,
        "evaluable_test_samples": int(evaluable.sum()),
        "macro_f1_over_all_8_moods": round(float(f1_score(true_eval, pred_eval, average="macro", zero_division=0)), 6),
        "macro_f1_over_supported_moods": round(float(np.mean([value for value, count in zip(f1, support) if count > 0])), 6),
        "micro_f1": round(float(f1_score(true_eval, pred_eval, average="micro", zero_division=0)), 6),
        "per_mood": {mood: {"precision": round(float(precision[i]), 6),
                            "recall": round(float(recall[i]), 6), "f1": round(float(f1[i]), 6),
                            "support": int(support[i])} for i, mood in enumerate(GARDEN_MOODS)},
    }


@torch.inference_mode()
def latency_benchmark(model, tokenizer, texts: list[str], positions: list[int], samples: int) -> dict:
    sample = texts[:min(samples, len(texts))]
    for text in sample[:10]:
        predict_probabilities(model, tokenizer, [text], positions, 1)
    timings = []
    for text in sample:
        started = time.perf_counter_ns()
        predict_probabilities(model, tokenizer, [text], positions, 1)
        timings.append((time.perf_counter_ns() - started) / 1_000_000)
    return {
        "single_text_samples": len(timings),
        "single_text_median_ms": round(float(statistics.median(timings)), 4),
        "single_text_p95_ms": round(float(np.percentile(timings, 95)), 4),
        "platform": platform.platform(), "torch_threads": torch.get_num_threads(),
    }


def directory_bytes(path: Path) -> int:
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


def write_comparison(path: Path, baseline: dict, candidate: dict) -> None:
    rows = [
        ("Macro-F1", baseline["test"]["macro_f1"], candidate["test"]["macro_f1"]),
        ("Micro-F1", baseline["test"]["micro_f1"], candidate["test"]["micro_f1"]),
        ("Garden Mood micro-F1", baseline["garden_mood_evaluation"]["micro_f1"], candidate["garden_mood_evaluation"]["micro_f1"]),
        ("CPU median latency ms", baseline["latency"]["single_text_median_ms"], candidate["latency"]["single_text_median_ms"]),
        ("CPU p95 latency ms", baseline["latency"]["single_text_p95_ms"], candidate["latency"]["single_text_p95_ms"]),
        ("Model size MB", baseline["model"]["artifact_megabytes"], candidate["model"]["artifact_megabytes"]),
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "candidate_a", "candidate_c", "difference"])
        for metric, a, c in rows:
            writer.writerow([metric, a, c, round(c - a, 6)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--goemotions-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--baseline-metrics", type=Path, required=True)
    parser.add_argument("--checkpoint", default="SamLowe/roberta-base-go_emotions")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--latency-samples", type=int, default=200)
    args = parser.parse_args()

    output = args.output_dir.resolve()
    artifact = output / "artifacts" / "checkpoint"
    output.mkdir(parents=True, exist_ok=True)
    process = psutil.Process(os.getpid())
    rss_before = process.memory_info().rss
    torch.set_num_threads(1)

    all_labels = read_labels(args.goemotions_dir / "emotions.txt")
    dev_texts, y_dev = read_split(args.goemotions_dir / "dev.tsv", all_labels)
    test_texts, y_test = read_split(args.goemotions_dir / "test.tsv", all_labels)

    tokenizer = AutoTokenizer.from_pretrained(args.checkpoint)
    model = AutoModelForSequenceClassification.from_pretrained(args.checkpoint)
    model.eval()
    positions = model_label_positions(model)
    rss_loaded = process.memory_info().rss

    dev_probabilities = predict_probabilities(model, tokenizer, dev_texts, positions, args.batch_size)
    thresholds, threshold_details = best_thresholds(y_dev, dev_probabilities)
    test_probabilities = predict_probabilities(model, tokenizer, test_texts, positions, args.batch_size)
    y_pred = (test_probabilities >= thresholds.reshape(1, -1)).astype(np.int8)
    rows = per_label_metrics(y_test, y_pred)

    artifact.mkdir(parents=True, exist_ok=True)
    tokenizer.save_pretrained(artifact)
    model.save_pretrained(artifact, safe_serialization=True)
    artifact_bytes = directory_bytes(artifact)
    latency = latency_benchmark(model, tokenizer, test_texts, positions, args.latency_samples)
    rss_after = process.memory_info().rss

    with (output / "per-label-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    (output / "thresholds.json").write_text(json.dumps(threshold_details, indent=2) + "\n", encoding="utf-8")

    metrics = {
        "experiment": "PetalPal Emotion Classifier V2 Candidate C pretrained GoEmotions Transformer",
        "production_modified": False, "checkpoint": args.checkpoint,
        "training_labels": LABELS, "garden_mapping": GARDEN_MAPPING,
        "official_test_dataset_shared_with_candidate_a": True,
        "threshold_selection": "Per-label best F1 on official dev split; test remains held out",
        "model": {
            "type": model.__class__.__name__, "artifact": "artifacts/checkpoint",
            "artifact_bytes": artifact_bytes, "artifact_megabytes": round(artifact_bytes / 1_048_576, 4),
            "transformers": transformers.__version__, "torch": torch.__version__, "python": sys.version,
        },
        "test": {
            "samples": len(test_texts),
            "macro_precision": round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 6),
            "macro_recall": round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 6),
            "macro_f1": round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 6),
            "micro_precision": round(float(precision_score(y_test, y_pred, average="micro", zero_division=0)), 6),
            "micro_recall": round(float(recall_score(y_test, y_pred, average="micro", zero_division=0)), 6),
            "micro_f1": round(float(f1_score(y_test, y_pred, average="micro", zero_division=0)), 6),
        },
        "latency": latency,
        "memory": {
            "rss_before_model_mb": round(rss_before / 1_048_576, 2),
            "rss_after_load_mb": round(rss_loaded / 1_048_576, 2),
            "rss_after_benchmark_mb": round(rss_after / 1_048_576, 2),
            "approx_model_load_delta_mb": round((rss_loaded - rss_before) / 1_048_576, 2),
        },
        "garden_mood_evaluation": garden_evaluation(y_test, y_pred),
    }
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    baseline = json.loads(args.baseline_metrics.read_text(encoding="utf-8"))
    write_comparison(output / "candidate-a-vs-c.csv", baseline, metrics)
    print(json.dumps({"checkpoint": args.checkpoint, "macro_f1": metrics["test"]["macro_f1"],
                      "micro_f1": metrics["test"]["micro_f1"], "artifact_mb": metrics["model"]["artifact_megabytes"],
                      "median_ms": latency["single_text_median_ms"], "p95_ms": latency["single_text_p95_ms"]}, indent=2))


if __name__ == "__main__":
    main()
