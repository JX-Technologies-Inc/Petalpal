#!/usr/bin/env python3
"""Train and evaluate the isolated PetalPal Emotion Classifier V2 TF-IDF baseline."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import statistics
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import sklearn
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    f1_score,
    precision_recall_fscore_support,
    precision_score,
    recall_score,
)
from sklearn.multiclass import OneVsRestClassifier


LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]

# Product mapping is deliberately separate from model labels. No forced mapping exists
# for confusion, surprise, or neutral. Drifting and Peaceful need future direct data.
GARDEN_MAPPING = {
    "admiration": "Gentle Bloom",
    "amusement": "Sunny Bloom",
    "anger": "Fire Bloom",
    "annoyance": "Fire Bloom",
    "approval": "Gentle Bloom",
    "caring": "Gentle Bloom",
    "curiosity": "Wonder Bloom",
    "disappointment": "Healing Bloom",
    "disapproval": "Fire Bloom",
    "disgust": "Fire Bloom",
    "excitement": "Sunny Bloom",
    "fear": "Fire Bloom",
    "gratitude": "Gentle Bloom",
    "joy": "Sunny Bloom",
    "love": "Gentle Bloom",
    "optimism": "Sunny Bloom",
    "remorse": "Healing Bloom",
    "sadness": "Quiet Bloom",
}
GARDEN_MOODS = [
    "Sunny Bloom", "Gentle Bloom", "Quiet Bloom", "Healing Bloom",
    "Fire Bloom", "Wonder Bloom", "Drifting Bloom", "Peaceful Bloom",
]
UNMAPPED_LABELS = ["confusion", "surprise", "neutral"]


def read_labels(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def read_split(path: Path, all_labels: list[str]) -> tuple[list[str], np.ndarray, list[list[str]]]:
    texts: list[str] = []
    label_lists: list[list[str]] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row_number, row in enumerate(csv.reader(handle, delimiter="\t"), start=1):
            if len(row) < 2:
                raise ValueError(f"Invalid row {row_number} in {path}")
            source_labels = [all_labels[int(index)] for index in row[1].split(",")]
            selected = [label for label in source_labels if label in LABELS]
            if not selected:
                continue
            texts.append(row[0])
            label_lists.append(selected)
    matrix = np.zeros((len(texts), len(LABELS)), dtype=np.int8)
    positions = {label: index for index, label in enumerate(LABELS)}
    for row_index, labels in enumerate(label_lists):
        for label in labels:
            matrix[row_index, positions[label]] = 1
    return texts, matrix, label_lists


def split_counts(matrix: np.ndarray) -> dict[str, int]:
    return {label: int(matrix[:, index].sum()) for index, label in enumerate(LABELS)}


def best_thresholds(y_true: np.ndarray, probabilities: np.ndarray) -> tuple[np.ndarray, dict[str, dict]]:
    candidates = np.arange(0.05, 0.951, 0.01)
    thresholds = np.zeros(len(LABELS), dtype=float)
    details: dict[str, dict] = {}
    for index, label in enumerate(LABELS):
        scored = []
        for threshold in candidates:
            predicted = probabilities[:, index] >= threshold
            score = f1_score(y_true[:, index], predicted, zero_division=0)
            scored.append((score, threshold))
        best_score = max(score for score, _ in scored)
        # Prefer the highest threshold within the best-F1 tie to reduce false positives.
        best = max(threshold for score, threshold in scored if abs(score - best_score) < 1e-12)
        thresholds[index] = best
        details[label] = {"threshold": round(float(best), 4), "dev_f1": round(float(best_score), 6)}
    return thresholds, details


def apply_thresholds(probabilities: np.ndarray, thresholds: np.ndarray) -> np.ndarray:
    return (probabilities >= thresholds.reshape(1, -1)).astype(np.int8)


def metrics_for_labels(y_true: np.ndarray, y_pred: np.ndarray, counts: dict[str, dict]) -> list[dict]:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, average=None, zero_division=0
    )
    rows = []
    for index, label in enumerate(LABELS):
        rows.append({
            "label": label,
            "train_count": counts[label]["train"],
            "dev_count": counts[label]["dev"],
            "test_count": counts[label]["test"],
            "precision": round(float(precision[index]), 6),
            "recall": round(float(recall[index]), 6),
            "f1": round(float(f1[index]), 6),
            "support": int(support[index]),
        })
    return rows


def garden_matrix(label_matrix: np.ndarray) -> np.ndarray:
    result = np.zeros((label_matrix.shape[0], len(GARDEN_MOODS)), dtype=np.int8)
    mood_positions = {mood: index for index, mood in enumerate(GARDEN_MOODS)}
    for label_index, label in enumerate(LABELS):
        mood = GARDEN_MAPPING.get(label)
        if mood:
            result[:, mood_positions[mood]] |= label_matrix[:, label_index]
    return result


def garden_evaluation(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    true_garden = garden_matrix(y_true)
    pred_garden = garden_matrix(y_pred)
    evaluable = true_garden.sum(axis=1) > 0
    true_eval = true_garden[evaluable]
    pred_eval = pred_garden[evaluable]
    precision, recall, f1, support = precision_recall_fscore_support(
        true_eval, pred_eval, average=None, zero_division=0
    )
    per_mood = {}
    for index, mood in enumerate(GARDEN_MOODS):
        per_mood[mood] = {
            "precision": round(float(precision[index]), 6),
            "recall": round(float(recall[index]), 6),
            "f1": round(float(f1[index]), 6),
            "support": int(support[index]),
        }
    return {
        "mapping": GARDEN_MAPPING,
        "unmapped_labels": UNMAPPED_LABELS,
        "evaluable_test_samples": int(evaluable.sum()),
        "excluded_unmapped_only_test_samples": int((~evaluable).sum()),
        "macro_f1_over_all_8_moods": round(float(f1_score(true_eval, pred_eval, average="macro", zero_division=0)), 6),
        "macro_f1_over_supported_moods": round(float(np.mean([value for value, count in zip(f1, support) if count > 0])), 6),
        "micro_f1": round(float(f1_score(true_eval, pred_eval, average="micro", zero_division=0)), 6),
        "per_mood": per_mood,
        "note": "Drifting Bloom and Peaceful Bloom have no direct Phase 1 labels; zero support is reported rather than inventing supervision.",
    }


def write_error_analysis(path: Path, texts: list[str], y_true: np.ndarray, y_pred: np.ndarray, probabilities: np.ndarray) -> None:
    rows = []
    for index, label in enumerate(LABELS):
        false_positive = np.where((y_true[:, index] == 0) & (y_pred[:, index] == 1))[0]
        false_negative = np.where((y_true[:, index] == 1) & (y_pred[:, index] == 0))[0]
        for kind, indices, reverse in [
            ("false_positive", false_positive, True),
            ("false_negative", false_negative, False),
        ]:
            ordered = sorted(indices, key=lambda row: probabilities[row, index], reverse=reverse)[:5]
            for row in ordered:
                true_labels = [LABELS[i] for i in np.flatnonzero(y_true[row])]
                predicted_labels = [LABELS[i] for i in np.flatnonzero(y_pred[row])]
                rows.append({
                    "label": label,
                    "error_type": kind,
                    "score": round(float(probabilities[row, index]), 6),
                    "true_labels": "|".join(true_labels),
                    "predicted_labels": "|".join(predicted_labels),
                    "text": texts[row].replace("\n", " "),
                })
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["label", "error_type", "score", "true_labels", "predicted_labels", "text"])
        writer.writeheader()
        writer.writerows(rows)


def latency_benchmark(vectorizer, classifier, texts: list[str]) -> dict:
    sample = texts[: min(1000, len(texts))]
    for text in sample[:20]:
        classifier.predict_proba(vectorizer.transform([text]))
    timings = []
    for text in sample:
        started = time.perf_counter_ns()
        classifier.predict_proba(vectorizer.transform([text]))
        timings.append((time.perf_counter_ns() - started) / 1_000_000)
    batch_started = time.perf_counter_ns()
    classifier.predict_proba(vectorizer.transform(sample))
    batch_total = (time.perf_counter_ns() - batch_started) / 1_000_000
    return {
        "single_text_samples": len(timings),
        "single_text_mean_ms": round(float(statistics.mean(timings)), 4),
        "single_text_median_ms": round(float(statistics.median(timings)), 4),
        "single_text_p95_ms": round(float(np.percentile(timings, 95)), 4),
        "batch_total_ms": round(float(batch_total), 4),
        "batch_per_text_ms": round(float(batch_total / len(sample)), 4),
        "platform": platform.platform(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--goemotions-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    output = args.output_dir.resolve()
    artifacts = output / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)

    all_labels = read_labels(args.goemotions_dir / "emotions.txt")
    data = {}
    for split in ["train", "dev", "test"]:
        data[split] = read_split(args.goemotions_dir / f"{split}.tsv", all_labels)

    train_texts, y_train, _ = data["train"]
    dev_texts, y_dev, _ = data["dev"]
    test_texts, y_test, _ = data["test"]
    counts_by_split = {split: split_counts(data[split][1]) for split in data}
    counts = {
        label: {split: counts_by_split[split][label] for split in ["train", "dev", "test"]}
        for label in LABELS
    }

    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.98,
        max_features=100_000,
        sublinear_tf=True,
        dtype=np.float32,
    )
    x_train = vectorizer.fit_transform(train_texts)
    x_dev = vectorizer.transform(dev_texts)
    x_test = vectorizer.transform(test_texts)

    classifier = OneVsRestClassifier(
        LogisticRegression(
            solver="liblinear",
            class_weight="balanced",
            max_iter=1000,
            random_state=20260827,
        ),
        # Single-process execution is reproducible and works in restricted CI/sandbox hosts.
        n_jobs=1,
    )
    train_started = time.perf_counter()
    classifier.fit(csr_matrix(x_train), y_train)
    training_seconds = time.perf_counter() - train_started

    dev_probabilities = classifier.predict_proba(x_dev)
    thresholds, threshold_details = best_thresholds(y_dev, dev_probabilities)
    test_probabilities = classifier.predict_proba(x_test)
    y_test_pred = apply_thresholds(test_probabilities, thresholds)
    per_label = metrics_for_labels(y_test, y_test_pred, counts)

    bundle_path = artifacts / "tfidf-ovr-logreg.joblib"
    joblib.dump({
        "vectorizer": vectorizer,
        "classifier": classifier,
        "labels": LABELS,
        "thresholds": thresholds.tolist(),
        "garden_mapping": GARDEN_MAPPING,
        "unmapped_labels": UNMAPPED_LABELS,
    }, bundle_path, compress=3)

    with (output / "per-label-metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(per_label[0]))
        writer.writeheader()
        writer.writerows(per_label)
    (output / "thresholds.json").write_text(json.dumps(threshold_details, indent=2) + "\n", encoding="utf-8")
    write_error_analysis(output / "error-analysis.csv", test_texts, y_test, y_test_pred, test_probabilities)

    ranked = sorted(per_label, key=lambda row: row["f1"], reverse=True)
    metrics = {
        "experiment": "PetalPal Emotion Classifier V2 Phase 1 TF-IDF baseline",
        "production_modified": False,
        "training_labels": LABELS,
        "excluded_labels": ["desire", "embarrassment", "grief", "nervousness", "pride", "realization", "relief"],
        "explicitly_not_added": ["loneliness", "anxiety", "frustration", "numbness", "peace", "calm", "tired", "stressed"],
        "data_source": "Official GoEmotions TSV files only",
        "official_splits_preserved": True,
        "split_sample_counts_after_label_filter": {split: len(data[split][0]) for split in data},
        "per_label_counts": counts,
        "model": {
            "type": "TF-IDF + One-vs-Rest Logistic Regression",
            "tfidf_features": int(len(vectorizer.vocabulary_)),
            "training_seconds": round(float(training_seconds), 4),
            "artifact": str(bundle_path.relative_to(output)),
            "artifact_bytes": bundle_path.stat().st_size,
            "artifact_megabytes": round(bundle_path.stat().st_size / 1_048_576, 4),
            "python": sys.version,
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
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
        "latency": latency_benchmark(vectorizer, classifier, test_texts),
        "garden_mood_evaluation": garden_evaluation(y_test, y_test_pred),
        "dataset_checksums": {
            name: hashlib.sha256((args.goemotions_dir / name).read_bytes()).hexdigest()
            for name in ["train.tsv", "dev.tsv", "test.tsv", "emotions.txt"]
        },
    }
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "macro_f1": metrics["test"]["macro_f1"],
        "micro_f1": metrics["test"]["micro_f1"],
        "artifact_megabytes": metrics["model"]["artifact_megabytes"],
        "training_seconds": metrics["model"]["training_seconds"],
        "garden_micro_f1": metrics["garden_mood_evaluation"]["micro_f1"],
    }, indent=2))


if __name__ == "__main__":
    main()
