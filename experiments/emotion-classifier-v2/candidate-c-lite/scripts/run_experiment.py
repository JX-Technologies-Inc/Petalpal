#!/usr/bin/env python3
"""Export/evaluate Candidate C as ONNX FP32 and dynamically quantized INT8."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import transformers
from onnxruntime.quantization import QuantType, quantize_dynamic
from sklearn.metrics import f1_score, precision_recall_fscore_support, precision_score, recall_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer


LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
GARDEN_MAPPING = {
    "admiration": "Gentle Bloom", "amusement": "Sunny Bloom", "anger": "Fire Bloom",
    "annoyance": "Fire Bloom", "approval": "Gentle Bloom", "caring": "Gentle Bloom",
    "curiosity": "Wonder Bloom", "disappointment": "Healing Bloom",
    "disapproval": "Fire Bloom", "disgust": "Fire Bloom", "excitement": "Sunny Bloom",
    "fear": "Fire Bloom", "gratitude": "Gentle Bloom", "joy": "Sunny Bloom",
    "love": "Gentle Bloom", "optimism": "Sunny Bloom", "remorse": "Healing Bloom",
    "sadness": "Quiet Bloom",
}
GARDEN_MOODS = [
    "Sunny Bloom", "Gentle Bloom", "Quiet Bloom", "Healing Bloom",
    "Fire Bloom", "Wonder Bloom", "Drifting Bloom", "Peaceful Bloom",
]


class LogitsOnly(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        return self.model(input_ids=input_ids, attention_mask=attention_mask).logits


def read_labels(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def read_test(path: Path, all_labels: list[str]) -> tuple[list[str], np.ndarray]:
    texts, rows = [], []
    with path.open(encoding="utf-8", newline="") as handle:
        for line in csv.reader(handle, delimiter="\t"):
            source = [all_labels[int(index)] for index in line[1].split(",")]
            selected = [label for label in source if label in LABELS]
            if selected:
                texts.append(line[0]); rows.append(selected)
    positions = {label: index for index, label in enumerate(LABELS)}
    matrix = np.zeros((len(texts), len(LABELS)), dtype=np.int8)
    for row_index, labels in enumerate(rows):
        for label in labels:
            matrix[row_index, positions[label]] = 1
    return texts, matrix


def checkpoint_positions(model) -> list[int]:
    labels = {int(index): label.lower() for index, label in model.config.id2label.items()}
    return [next(index for index, value in labels.items() if value == label) for label in LABELS]


@torch.inference_mode()
def pytorch_probabilities(model, tokenizer, texts, positions, batch_size):
    output = []
    for start in range(0, len(texts), batch_size):
        encoded = tokenizer(texts[start:start + batch_size], padding=True, truncation=True,
                            max_length=128, return_tensors="pt")
        logits = model(**encoded).logits[:, positions]
        output.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(output)


def make_session(path: Path) -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    return ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])


def onnx_probabilities(session, tokenizer, texts, positions, batch_size):
    output = []
    for start in range(0, len(texts), batch_size):
        encoded = tokenizer(texts[start:start + batch_size], padding=True, truncation=True,
                            max_length=128, return_tensors="np")
        logits = session.run(["logits"], {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64),
        })[0][:, positions]
        output.append(1.0 / (1.0 + np.exp(-logits)))
    return np.concatenate(output)


def metric_bundle(y_true, probabilities, thresholds):
    predicted = (probabilities >= thresholds.reshape(1, -1)).astype(np.int8)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, predicted, average=None, zero_division=0
    )
    per_label = [{"label": label, "precision": round(float(precision[index]), 6),
                  "recall": round(float(recall[index]), 6), "f1": round(float(f1[index]), 6),
                  "support": int(support[index])} for index, label in enumerate(LABELS)]
    return predicted, per_label, {
        "macro_precision": round(float(precision_score(y_true, predicted, average="macro", zero_division=0)), 6),
        "macro_recall": round(float(recall_score(y_true, predicted, average="macro", zero_division=0)), 6),
        "macro_f1": round(float(f1_score(y_true, predicted, average="macro", zero_division=0)), 6),
        "micro_precision": round(float(precision_score(y_true, predicted, average="micro", zero_division=0)), 6),
        "micro_recall": round(float(recall_score(y_true, predicted, average="micro", zero_division=0)), 6),
        "micro_f1": round(float(f1_score(y_true, predicted, average="micro", zero_division=0)), 6),
    }


def garden_matrix(labels):
    result = np.zeros((labels.shape[0], len(GARDEN_MOODS)), dtype=np.int8)
    moods = {mood: index for index, mood in enumerate(GARDEN_MOODS)}
    for label_index, label in enumerate(LABELS):
        if label in GARDEN_MAPPING:
            result[:, moods[GARDEN_MAPPING[label]]] |= labels[:, label_index]
    return result


def garden_metrics(y_true, y_pred):
    truth, prediction = garden_matrix(y_true), garden_matrix(y_pred)
    evaluable = truth.sum(axis=1) > 0
    truth, prediction = truth[evaluable], prediction[evaluable]
    _, _, f1, support = precision_recall_fscore_support(truth, prediction, average=None, zero_division=0)
    return {
        "micro_f1": round(float(f1_score(truth, prediction, average="micro", zero_division=0)), 6),
        "macro_f1_over_all_8_moods": round(float(f1_score(truth, prediction, average="macro", zero_division=0)), 6),
        "macro_f1_over_supported_moods": round(float(np.mean([value for value, count in zip(f1, support) if count > 0])), 6),
    }


def export_onnx(model, tokenizer, destination):
    encoded = tokenizer("PetalPal ONNX export sample", return_tensors="pt")
    wrapper = LogitsOnly(model).eval()
    torch.onnx.export(
        wrapper, (encoded["input_ids"], encoded["attention_mask"]), destination,
        input_names=["input_ids", "attention_mask"], output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "sequence"},
                      "attention_mask": {0: "batch", 1: "sequence"},
                      "logits": {0: "batch"}},
        opset_version=17, do_constant_folding=True, dynamo=False,
    )
    onnx.checker.check_model(onnx.load(str(destination), load_external_data=False), full_check=True)


def write_per_label(path, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--goemotions-dir", type=Path, required=True)
    parser.add_argument("--candidate-c-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    output = args.output_dir.resolve(); artifacts = output / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    fp32_path, int8_path = artifacts / "model-fp32.onnx", artifacts / "model-int8.onnx"
    checkpoint = args.candidate_c_dir / "artifacts" / "checkpoint"
    tokenizer = AutoTokenizer.from_pretrained(checkpoint)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint).eval()
    positions = checkpoint_positions(model)
    torch.set_num_threads(1)

    if not fp32_path.exists():
        export_onnx(model, tokenizer, fp32_path)
    if not int8_path.exists():
        quantize_dynamic(str(fp32_path), str(int8_path), weight_type=QuantType.QInt8,
                         per_channel=True, reduce_range=False)
    onnx.checker.check_model(onnx.load(str(fp32_path), load_external_data=False), full_check=True)
    onnx.checker.check_model(onnx.load(str(int8_path), load_external_data=False), full_check=True)
    tokenizer.save_pretrained(artifacts / "tokenizer")

    all_labels = read_labels(args.goemotions_dir / "emotions.txt")
    texts, y_test = read_test(args.goemotions_dir / "test.tsv", all_labels)
    threshold_data = json.loads((args.candidate_c_dir / "thresholds.json").read_text())
    thresholds = np.array([threshold_data[label]["threshold"] for label in LABELS])

    probabilities = {
        "pytorch_fp32": pytorch_probabilities(model, tokenizer, texts, positions, args.batch_size),
        "onnx_fp32": onnx_probabilities(make_session(fp32_path), tokenizer, texts, positions, args.batch_size),
        "onnx_int8": onnx_probabilities(make_session(int8_path), tokenizer, texts, positions, args.batch_size),
    }
    results, predictions = {}, {}
    for name, scores in probabilities.items():
        predicted, rows, aggregate = metric_bundle(y_test, scores, thresholds)
        predictions[name] = predicted
        results[name] = {**aggregate, "garden": garden_metrics(y_test, predicted)}
        write_per_label(output / f"per-label-{name.replace('_', '-')}.csv", rows)

    reference_scores, reference_predictions = probabilities["pytorch_fp32"], predictions["pytorch_fp32"]
    verification = {}
    for name in ["onnx_fp32", "onnx_int8"]:
        verification[name] = {
            "max_absolute_probability_difference": round(float(np.max(np.abs(probabilities[name] - reference_scores))), 8),
            "mean_absolute_probability_difference": round(float(np.mean(np.abs(probabilities[name] - reference_scores))), 8),
            "binary_decision_disagreement_rate": round(float(np.mean(predictions[name] != reference_predictions)), 8),
            "sample_any_label_disagreement_rate": round(float(np.mean(np.any(predictions[name] != reference_predictions, axis=1))), 8),
        }

    metrics = {
        "experiment": "Candidate C-Lite ONNX Runtime dynamic INT8",
        "production_modified": False,
        "checkpoint": "SamLowe/roberta-base-go_emotions",
        "test_samples": len(texts), "labels": LABELS, "garden_mapping": GARDEN_MAPPING,
        "thresholds_reused_from_candidate_c": True,
        "dataset_checksums": {
            name: hashlib.sha256((args.goemotions_dir / name).read_bytes()).hexdigest()
            for name in ["train.tsv", "dev.tsv", "test.tsv", "emotions.txt"]
        },
        "software": {"onnx": onnx.__version__, "onnxruntime": ort.__version__,
                     "torch": torch.__version__, "transformers": transformers.__version__},
        "results": results, "prediction_verification": verification,
        "artifacts": {
            "onnx_fp32_bytes": fp32_path.stat().st_size,
            "onnx_fp32_megabytes": round(fp32_path.stat().st_size / 1_048_576, 4),
            "onnx_int8_bytes": int8_path.stat().st_size,
            "onnx_int8_megabytes": round(int8_path.stat().st_size / 1_048_576, 4),
            "size_reduction_percent": round((1 - int8_path.stat().st_size / fp32_path.stat().st_size) * 100, 4),
        },
    }
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(args.candidate_c_dir / "thresholds.json", output / "thresholds.json")
    print(json.dumps({"results": results, "artifacts": metrics["artifacts"],
                      "verification": verification}, indent=2))


if __name__ == "__main__":
    main()
