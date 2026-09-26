#!/usr/bin/env python3
"""Reuse the Candidate C-Lite ONNX path for the frozen targeted checkpoint."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import statistics
import sys
import threading
import time
from pathlib import Path


MAX_LENGTH = 512
BATCH_SIZE = 2
CANONICAL_21 = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
PRODUCT_18 = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
EXPECTED_RAW_28 = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral",
]
REFERENCE = {
    "macro_f1": 0.3665010477,
    "micro_f1": 0.5566343042,
    "precision": 0.5972222222,
    "recall": 0.5212121212,
    "exact_set_correct": 55,
}


def read_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_existing_onnx_path():
    source = Path(__file__).with_name("run_experiment.py")
    spec = importlib.util.spec_from_file_location("candidate_c_lite_onnx", source)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def load_evaluator(repo_root: Path):
    evaluator_dir = (
        repo_root / "experiments/emotion-classifier-v2/v4/aligned-supervision-v1"
        / "canonical-direct-top2-v1"
    )
    sys.path.insert(0, str(evaluator_dir))
    import evaluator
    assert evaluator.LABELS == PRODUCT_18
    assert evaluator.THRESHOLD == 0.35
    return evaluator


def label_orders(model) -> tuple[list[int], list[int]]:
    raw = [model.config.id2label[index] for index in range(model.config.num_labels)]
    assert raw == EXPECTED_RAW_28
    canonical_indices = [raw.index(label) for label in CANONICAL_21]
    product_indices = [CANONICAL_21.index(label) for label in PRODUCT_18]
    assert canonical_indices == [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 27, 20, 24, 25, 26]
    assert product_indices == [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20]
    return canonical_indices, product_indices


def encoded_batches(tokenizer, texts: list[str]):
    encoded = tokenizer(texts, truncation=True, max_length=MAX_LENGTH)
    for start in range(0, len(texts), BATCH_SIZE):
        yield tokenizer.pad(
            [
                {key: values[index] for key, values in encoded.items()}
                for index in range(start, min(start + BATCH_SIZE, len(texts)))
            ],
            padding=True,
            return_tensors="pt",
        )


def infer_both(model, session, tokenizer, texts: list[str]):
    import numpy as np
    import torch

    torch_rows, onnx_rows = [], []
    with torch.inference_mode():
        for batch in encoded_batches(tokenizer, texts):
            torch_rows.append(model(**batch).logits.cpu().numpy())
            onnx_rows.append(session.run(["logits"], {
                "input_ids": batch["input_ids"].cpu().numpy().astype(np.int64),
                "attention_mask": batch["attention_mask"].cpu().numpy().astype(np.int64),
            })[0])
    return np.concatenate(torch_rows), np.concatenate(onnx_rows)


def sigmoid(values):
    import numpy as np
    return 1.0 / (1.0 + np.exp(-values))


def project(raw_logits, canonical_indices: list[int], product_indices: list[int]):
    canonical_probabilities = sigmoid(raw_logits[:, canonical_indices])
    return canonical_probabilities, canonical_probabilities[:, product_indices]


def predictions(evaluator, probabilities):
    return [evaluator.select(dict(zip(PRODUCT_18, row)), PRODUCT_18) for row in probabilities]


def metric_bundle(evaluator, rows: list[dict], predicted: list[list[str]]) -> dict:
    import numpy as np

    truth = np.array([[int(label in row["modelLabels"]) for label in PRODUCT_18] for row in rows])
    output = np.array([[int(label in labels) for label in PRODUCT_18] for labels in predicted])
    metrics = evaluator.metric_report(truth, output)
    exact = sum(set(row["modelLabels"]) == set(labels) for row, labels in zip(rows, predicted))
    return {
        "macro_f1": metrics["macro"]["f1"],
        "micro_f1": metrics["micro"]["f1"],
        "precision": metrics["micro"]["precision"],
        "recall": metrics["micro"]["recall"],
        "exact_set_correct": exact,
        "exact_set_accuracy": exact / len(rows),
    }


def differences(left, right) -> dict:
    import numpy as np

    delta = np.abs(left - right)
    return {"max_absolute_difference": float(delta.max()), "mean_absolute_difference": float(delta.mean())}


def metric_deltas(left: dict, right: dict) -> dict:
    return {
        key: right[key] - left[key]
        for key in ["macro_f1", "micro_f1", "precision", "recall", "exact_set_correct", "exact_set_accuracy"]
    }


def runtime_checks(session, tokenizer, canonical_indices, product_indices, evaluator) -> dict:
    import numpy as np

    def run(text: str):
        batch = tokenizer(
            text,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="np",
        )
        raw = session.run(["logits"], {
            "input_ids": batch["input_ids"].astype(np.int64),
            "attention_mask": batch["attention_mask"].astype(np.int64),
        })[0]
        _, product = project(raw, canonical_indices, product_indices)
        return batch, raw, product, predictions(evaluator, product)[0]

    long_text = "joyful reflection " * 2000
    untruncated_length = len(tokenizer(long_text, truncation=False)["input_ids"])
    cases = {}
    for name, text in [("empty", ""), ("very_short", "Hi."), ("long", long_text)]:
        batch, raw, product, labels = run(text)
        cases[name] = {
            "input_tokens": int(batch["input_ids"].shape[1]),
            "raw_output_shape": list(raw.shape),
            "product_output_shape": list(product.shape),
            "labels": labels,
            "max_two_labels": len(labels) <= 2,
            "product_labels_only": all(label in PRODUCT_18 for label in labels),
        }
    repeated = [run("A short deterministic reflection.")[1] for _ in range(5)]
    deterministic = all(np.array_equal(repeated[0], item) for item in repeated[1:])
    return {
        "max_length": MAX_LENGTH,
        "long_untruncated_tokens": untruncated_length,
        "long_truncated_to_512": cases["long"]["input_tokens"] == MAX_LENGTH and untruncated_length > MAX_LENGTH,
        "cases": cases,
        "repeated_inference_runs": len(repeated),
        "repeated_raw_logits_exactly_equal": deterministic,
        "pass": (
            cases["long"]["input_tokens"] == MAX_LENGTH
            and untruncated_length > MAX_LENGTH
            and deterministic
            and all(case["product_output_shape"] == [1, 18] for case in cases.values())
            and all(case["max_two_labels"] and case["product_labels_only"] for case in cases.values())
        ),
    }


def validate(args, quantized: bool) -> None:
    import numpy as np
    import onnx
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    repo_root = args.repo_root.resolve()
    output_dir = args.output_dir.resolve()
    artifacts = output_dir / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    checkpoint = args.checkpoint.resolve()
    dev_path = args.dev.resolve()
    fp32_path = artifacts / "model-fp32.onnx"
    model_path = artifacts / ("model-int8.onnx" if quantized else "model-fp32.onnx")
    report_path = output_dir / ("validation-int8.json" if quantized else "validation-fp32.json")

    existing = load_existing_onnx_path()
    evaluator = load_evaluator(repo_root)
    torch.set_num_threads(1)
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True).eval()
    assert model.config.num_labels == 28
    canonical_indices, product_indices = label_orders(model)

    if not quantized:
        if not fp32_path.exists():
            existing.export_onnx(model, tokenizer, fp32_path, max_length=MAX_LENGTH)
        tokenizer.save_pretrained(artifacts / "tokenizer")
    else:
        fp32_report = json.loads((output_dir / "validation-fp32.json").read_text(encoding="utf-8"))
        assert fp32_report["status"] == "PASS", "FP32 parity must pass before INT8 quantization"
        if not model_path.exists():
            from onnxruntime.quantization import QuantType, quantize_dynamic
            quantize_dynamic(
                str(fp32_path), str(model_path), weight_type=QuantType.QInt8,
                per_channel=True, reduce_range=False,
            )

    onnx_model = onnx.load(str(model_path), load_external_data=False)
    onnx.checker.check_model(onnx_model, full_check=True)
    session = existing.make_session(model_path)
    inputs = {item.name: item.shape for item in session.get_inputs()}
    outputs = {item.name: item.shape for item in session.get_outputs()}
    assert inputs == {"input_ids": ["batch", "sequence"], "attention_mask": ["batch", "sequence"]}
    assert outputs == {"logits": ["batch", 28]}

    rows = read_rows(dev_path)
    assert len(rows) == 149
    texts = [row["journal"] for row in rows]
    torch_raw, onnx_raw = infer_both(model, session, tokenizer, texts)
    assert torch_raw.shape == onnx_raw.shape == (149, 28)
    torch_canonical, torch_product = project(torch_raw, canonical_indices, product_indices)
    onnx_canonical, onnx_product = project(onnx_raw, canonical_indices, product_indices)
    assert torch_canonical.shape == onnx_canonical.shape == (149, 21)
    assert torch_product.shape == onnx_product.shape == (149, 18)

    torch_predictions = predictions(evaluator, torch_product)
    onnx_predictions = predictions(evaluator, onnx_product)
    match_count = sum(left == right for left, right in zip(torch_predictions, onnx_predictions))
    torch_metrics = metric_bundle(evaluator, rows, torch_predictions)
    onnx_metrics = metric_bundle(evaluator, rows, onnx_predictions)

    saved_canonical = np.load(args.reference_probabilities)
    assert saved_canonical.shape == (149, 21)
    saved_product = saved_canonical[:, product_indices]
    saved_predictions = predictions(evaluator, saved_product)
    saved_match_count = sum(left == right for left, right in zip(torch_predictions, saved_predictions))
    saved_metrics = metric_bundle(evaluator, rows, saved_predictions)

    checks = runtime_checks(session, tokenizer, canonical_indices, product_indices, evaluator)
    standard_pass = (
        match_count == 149
        and saved_match_count == 149
        and metric_deltas(torch_metrics, onnx_metrics) == {
            "macro_f1": 0.0, "micro_f1": 0.0, "precision": 0.0, "recall": 0.0,
            "exact_set_correct": 0, "exact_set_accuracy": 0.0,
        }
        and round(torch_metrics["macro_f1"], 10) == REFERENCE["macro_f1"]
        and round(torch_metrics["micro_f1"], 10) == REFERENCE["micro_f1"]
        and round(torch_metrics["precision"], 10) == REFERENCE["precision"]
        and round(torch_metrics["recall"], 10) == REFERENCE["recall"]
        and torch_metrics["exact_set_correct"] == REFERENCE["exact_set_correct"]
        and checks["pass"]
    )
    report = {
        "status": "PASS" if standard_pass else "FAIL",
        "runtime": "onnx-int8" if quantized else "onnx-fp32",
        "checkpoint_unchanged": True,
        "training_performed": False,
        "max_length": MAX_LENGTH,
        "batch_size": BATCH_SIZE,
        "threshold": evaluator.THRESHOLD,
        "mapping": {"raw_heads": 28, "canonical_labels": 21, "product_labels": 18},
        "onnx_graph": {
            "checker": "PASS",
            "inputs": inputs,
            "outputs": outputs,
            "raw_classifier_heads_preserved": outputs == {"logits": ["batch", 28]},
        },
        "tokenizer_preprocessing": {
            "source": str(checkpoint),
            "same_encoded_batches_for_pytorch_and_onnx": True,
            "truncation": True,
            "max_length": MAX_LENGTH,
        },
        "numerical_parity": {
            "raw_logits": differences(torch_raw, onnx_raw),
            "canonical_21_probabilities": differences(torch_canonical, onnx_canonical),
            "product_18_probabilities": differences(torch_product, onnx_product),
        },
        "prediction_parity": {
            "pytorch_vs_onnx_match_count": match_count,
            "rows": len(rows),
            "pytorch_vs_saved_reference_match_count": saved_match_count,
        },
        "metrics": {
            "reference": REFERENCE,
            "pytorch": torch_metrics,
            "onnx": onnx_metrics,
            "saved_reference": saved_metrics,
            "onnx_minus_pytorch": metric_deltas(torch_metrics, onnx_metrics),
        },
        "runtime_validation": checks,
        "artifact": {"path": str(model_path), "bytes": model_path.stat().st_size, "mib": model_path.stat().st_size / 1_048_576},
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["status"] != "PASS" and not quantized:
        raise SystemExit(1)


class RssMonitor:
    def __init__(self, process):
        self.process = process
        self.peak = process.memory_info().rss
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._sample, daemon=True)

    def _sample(self):
        while not self.stop_event.wait(0.005):
            self.peak = max(self.peak, self.process.memory_info().rss)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.stop_event.set()
        self.thread.join()
        self.peak = max(self.peak, self.process.memory_info().rss)


def benchmark(args) -> None:
    import numpy as np
    import psutil

    process = psutil.Process(os.getpid())
    baseline_rss = process.memory_info().rss
    rows = read_rows(args.dev.resolve())
    assert len(rows) == 149
    texts = [row["journal"] for row in rows]
    artifact = args.checkpoint.resolve() / "model.safetensors"

    with RssMonitor(process) as monitor:
        load_started = time.perf_counter()
        if args.runtime == "pytorch":
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            torch.set_num_threads(1)
            tokenizer = AutoTokenizer.from_pretrained(args.checkpoint.resolve(), local_files_only=True)
            model = AutoModelForSequenceClassification.from_pretrained(args.checkpoint.resolve(), local_files_only=True).eval()
            canonical_indices, product_indices = label_orders(model)

            def run_all():
                raw_rows = []
                with torch.inference_mode():
                    for batch in encoded_batches(tokenizer, texts):
                        raw_rows.append(model(**batch).logits.cpu().numpy())
                raw = np.concatenate(raw_rows)
                return project(raw, canonical_indices, product_indices)[1]
        else:
            import onnxruntime as ort
            from transformers import AutoConfig, AutoTokenizer
            tokenizer = AutoTokenizer.from_pretrained(args.tokenizer.resolve(), local_files_only=True)
            config = AutoConfig.from_pretrained(args.checkpoint.resolve(), local_files_only=True)
            raw_order = [config.id2label[index] for index in range(config.num_labels)]
            assert raw_order == EXPECTED_RAW_28
            canonical_indices = [raw_order.index(label) for label in CANONICAL_21]
            product_indices = [CANONICAL_21.index(label) for label in PRODUCT_18]
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            artifact = args.onnx.resolve()
            session = ort.InferenceSession(str(artifact), sess_options=options, providers=["CPUExecutionProvider"])

            def run_all():
                raw_rows = []
                for batch in encoded_batches(tokenizer, texts):
                    raw_rows.append(session.run(["logits"], {
                        "input_ids": batch["input_ids"].cpu().numpy().astype(np.int64),
                        "attention_mask": batch["attention_mask"].cpu().numpy().astype(np.int64),
                    })[0])
                raw = np.concatenate(raw_rows)
                return project(raw, canonical_indices, product_indices)[1]

        load_seconds = time.perf_counter() - load_started
        rss_after_load = process.memory_info().rss
        # One single-input warm-up, outside the measured 149-row pass.
        warm_texts = texts
        texts = texts[:1]
        warm = run_all()
        assert warm.shape == (1, 18)
        texts = warm_texts
        started = time.perf_counter()
        output = run_all()
        latency_seconds = time.perf_counter() - started
        assert output.shape == (149, 18)
        rss_after_inference = process.memory_info().rss

    mib = 1_048_576
    peak_rss = max(monitor.peak, rss_after_load, rss_after_inference)
    result = {
        "runtime": args.runtime,
        "max_length": MAX_LENGTH,
        "batch_size": BATCH_SIZE,
        "threads": 1,
        "samples": len(rows),
        "artifact": {"path": str(artifact), "bytes": artifact.stat().st_size, "mib": artifact.stat().st_size / mib},
        "load_time_seconds": load_seconds,
        "latency_149_seconds": latency_seconds,
        "ms_per_sample": latency_seconds * 1000 / len(rows),
        "samples_per_second": len(rows) / latency_seconds,
        "rss_baseline_mib": baseline_rss / mib,
        "rss_after_load_mib": rss_after_load / mib,
        "rss_after_inference_mib": rss_after_inference / mib,
        "peak_rss_mib": peak_rss / mib,
        "incremental_peak_rss_mib": (peak_rss - baseline_rss) / mib,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


def parse_args():
    repo_root = Path(__file__).resolve().parents[4]
    aligned = repo_root / "experiments/emotion-classifier-v2/v4/aligned-supervision-v1"
    targeted = aligned / "goemotions-targeted-v1"
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    for name in ["validate-fp32", "validate-int8"]:
        command = subparsers.add_parser(name)
        command.add_argument("--repo-root", type=Path, default=repo_root)
        command.add_argument("--checkpoint", type=Path, default=targeted / "experiment/epoch-1-checkpoint")
        command.add_argument("--dev", type=Path, default=aligned / "dev.jsonl")
        command.add_argument("--reference-probabilities", type=Path, default=targeted / "experiment/epoch-1-probabilities.npy")
        command.add_argument("--output-dir", type=Path, default=targeted / "onnx-cpu")

    command = subparsers.add_parser("benchmark")
    command.add_argument("--runtime", choices=["pytorch", "onnx-fp32", "onnx-int8"], required=True)
    command.add_argument("--checkpoint", type=Path, default=targeted / "experiment/epoch-1-checkpoint")
    command.add_argument("--dev", type=Path, default=aligned / "dev.jsonl")
    command.add_argument("--onnx", type=Path)
    command.add_argument("--tokenizer", type=Path, default=targeted / "onnx-cpu/artifacts/tokenizer")
    command.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    if args.command == "validate-fp32":
        validate(args, quantized=False)
    elif args.command == "validate-int8":
        validate(args, quantized=True)
    else:
        if args.runtime != "pytorch" and args.onnx is None:
            raise SystemExit("--onnx is required for ONNX benchmarks")
        benchmark(args)


if __name__ == "__main__":
    main()
