#!/usr/bin/env python3
"""Isolated Render benchmark service for the existing Candidate C-Lite INT8 model."""

from __future__ import annotations

import argparse
import concurrent.futures
import fcntl
import hashlib
import json
import os
import platform
import statistics
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import onnxruntime as ort
import psutil
from tokenizers import Tokenizer


PROCESS = psutil.Process(os.getpid())
PROCESS_CREATE_TIME = PROCESS.create_time()
PYTHON_READY_WALL_TIME = time.time()
PYTHON_READY_MONOTONIC = time.perf_counter()
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "disappointment", "disapproval", "disgust",
    "excitement", "fear", "gratitude", "joy", "love", "neutral", "optimism",
    "remorse", "sadness", "surprise",
]
FIXED_TEXTS = [
    "I had such a wonderful day and I feel genuinely happy about what happened.",
    "I am grateful that my friend stayed with me when I needed support.",
    "Everything went wrong today and I feel angry, exhausted, and disappointed.",
    "I am proud of finishing the project, but nervous about what happens next.",
    "I cannot tell how I feel about the conversation; it was confusing and unexpected.",
    "My family surprised me with dinner, and I felt loved and deeply appreciated.",
    "I made a mistake that hurt someone I care about, and I wish I could undo it.",
    "Walking home in the quiet rain helped me slow down after a difficult afternoon.",
    "The meeting sounded positive at first, although I am still unsure whether the plan will work.",
    (
        "Today was complicated. I received encouraging news in the morning, then had an argument "
        "with someone close to me. I am thankful for the opportunity, disappointed by the conflict, "
        "and uncertain about how to repair things tomorrow."
    ),
]
FIXED_TEXTS_SHA256 = hashlib.sha256("\n".join(FIXED_TEXTS).encode()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def bytes_to_mib(value: int | float | None) -> float | None:
    return None if value is None else round(float(value) / 1_048_576, 2)


def rss_mib() -> float:
    return bytes_to_mib(PROCESS.memory_info().rss) or 0.0


def read_text(path: str) -> str | None:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def linux_distribution() -> dict:
    values = {}
    for line in (read_text("/etc/os-release") or "").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"')
    return {"name": values.get("NAME"), "version": values.get("VERSION_ID"),
            "pretty_name": values.get("PRETTY_NAME")}


def cpu_details() -> tuple[str | None, list[str]]:
    text = read_text("/proc/cpuinfo") or ""
    model = None
    flags = []
    for line in text.splitlines():
        key, _, value = line.partition(":")
        if key.strip() in {"model name", "Hardware", "Processor"} and value.strip() and not model:
            model = value.strip()
        if key.strip() in {"flags", "Features"} and value.strip() and not flags:
            flags = value.strip().split()
    relevant = [flag for flag in [
        "sse4_1", "sse4_2", "avx", "avx2", "avx512f", "avx512_vnni",
        "vnni", "fma", "neon", "asimd", "dotprod", "i8mm",
    ] if flag in flags]
    return model or platform.processor() or None, relevant


def cgroup_memory_limit_bytes() -> int | None:
    for path in ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]:
        value = read_text(path)
        if value and value.strip() != "max":
            try:
                limit = int(value.strip())
                if 0 < limit < (1 << 60):
                    return limit
            except ValueError:
                pass
    return None


def environment_snapshot() -> dict:
    memory = psutil.virtual_memory()
    cpu_model, instructions = cpu_details()
    limit = cgroup_memory_limit_bytes()
    render_keys = [
        "RENDER", "RENDER_SERVICE_ID", "RENDER_SERVICE_NAME", "RENDER_SERVICE_TYPE",
        "RENDER_INSTANCE_ID", "RENDER_EXTERNAL_HOSTNAME", "RENDER_GIT_COMMIT",
    ]
    render = {key: os.environ[key] for key in render_keys if os.environ.get(key)}
    return {
        "capturedAt": utc_now(),
        "os": platform.system(),
        "platform": platform.platform(),
        "linuxDistribution": linux_distribution(),
        "architecture": platform.machine(),
        "cpuModel": cpu_model,
        "logicalCpuCount": psutil.cpu_count(logical=True),
        "physicalCpuCount": psutil.cpu_count(logical=False),
        "relevantCpuInstructions": instructions,
        "hostTotalRamMiB": bytes_to_mib(memory.total),
        "hostAvailableRamMiB": bytes_to_mib(memory.available),
        "cgroupMemoryLimitMiB": bytes_to_mib(limit),
        "pythonVersion": platform.python_version(),
        "onnxRuntimeVersion": ort.__version__,
        "renderEnvironment": render,
        "renderTier": os.environ.get("RENDER_INSTANCE_TYPE") or "NOT_EXPOSED_BY_ENVIRONMENT",
        "notes": [
            "Render service tier is reported only when exposed by an environment variable.",
            "CPU instruction flags are best-effort and read from /proc/cpuinfo when available.",
        ],
    }


class PeakMemorySampler:
    def __init__(self, interval_seconds: float = 0.005):
        self.interval_seconds = interval_seconds
        self.peak_mib = rss_mib()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        while not self._stop.wait(self.interval_seconds):
            self.peak_mib = max(self.peak_mib, rss_mib())

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *_):
        self._stop.set()
        self._thread.join(timeout=1)
        self.peak_mib = max(self.peak_mib, rss_mib())


class CandidateCLiteBenchmark:
    def __init__(self, model_path: Path, tokenizer_path: Path, thresholds_path: Path,
                 metrics_path: Path, requests_per_concurrency: int):
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path
        self.thresholds_path = thresholds_path
        self.metrics_path = metrics_path
        self.requests_per_concurrency = max(8, requests_per_concurrency)
        self._run_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self.status = "STARTING"
        self.result = None
        self.error = None
        self.startup = {}

        self.environment = environment_snapshot()
        self.startup["baselineRssMiB"] = rss_mib()
        self.startup["processStartToPythonReadyMs"] = round(
            max(0.0, PYTHON_READY_WALL_TIME - PROCESS_CREATE_TIME) * 1000, 3
        )

        tokenizer_started = time.perf_counter()
        self.tokenizer = Tokenizer.from_file(str(tokenizer_path / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=128)
        self.tokenizer.enable_padding(pad_id=1, pad_token="<pad>")
        self.startup["tokenizerLoadMs"] = round((time.perf_counter() - tokenizer_started) * 1000, 3)
        self.startup["tokenizerRssMiB"] = rss_mib()

        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = int(os.environ.get("ORT_INTRA_OP_THREADS", "1"))
        session_options.inter_op_num_threads = int(os.environ.get("ORT_INTER_OP_THREADS", "1"))
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        session_started = time.perf_counter()
        self.session = ort.InferenceSession(
            str(model_path), sess_options=session_options, providers=["CPUExecutionProvider"]
        )
        self.startup["onnxSessionLoadMs"] = round((time.perf_counter() - session_started) * 1000, 3)
        self.startup["idleModelRssMiB"] = rss_mib()

        thresholds = json.loads(thresholds_path.read_text(encoding="utf-8"))
        self.thresholds = np.array([thresholds[label]["threshold"] for label in LABELS], dtype=np.float32)
        candidate_metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        self.garden_mapping = candidate_metrics["garden_mapping"]

        with PeakMemorySampler() as first_memory:
            first_started = time.perf_counter_ns()
            self._infer(FIXED_TEXTS[0])
            self.startup["firstInferenceMs"] = round(
                (time.perf_counter_ns() - first_started) / 1_000_000, 4
            )
        self.startup["firstInferencePeakRssMiB"] = first_memory.peak_mib
        self.startup["applicationObservedStartupMs"] = round(
            max(0.0, time.time() - PROCESS_CREATE_TIME) * 1000, 3
        )
        self.startup["serviceReadyRssMiB"] = rss_mib()
        self.startup["coldStartScope"] = (
            "Application-observed process creation through first completed inference; "
            "does not include Render scheduling, image pull, or container provisioning."
        )
        self.status = "READY"

    def _encode(self, text: str) -> dict[str, np.ndarray]:
        encoded = self.tokenizer.encode(text)
        return {
            "input_ids": np.asarray([encoded.ids], dtype=np.int64),
            "attention_mask": np.asarray([encoded.attention_mask], dtype=np.int64),
        }

    def _infer(self, text: str) -> np.ndarray:
        logits = self.session.run(["logits"], self._encode(text))[0][0]
        probabilities = 1.0 / (1.0 + np.exp(-logits))
        return probabilities

    def _concurrency_benchmark(self, concurrency: int) -> dict:
        latencies = []
        errors = []
        oom = False

        def execute(index: int):
            started = time.perf_counter_ns()
            try:
                self._infer(FIXED_TEXTS[index % len(FIXED_TEXTS)])
                return (time.perf_counter_ns() - started) / 1_000_000, None
            except MemoryError as error:
                return None, f"MemoryError: {error}"
            except Exception as error:  # benchmark must report rather than hide runtime failures
                return None, f"{type(error).__name__}: {error}"

        with PeakMemorySampler() as memory:
            wall_started = time.perf_counter()
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                    for latency, error in executor.map(execute, range(self.requests_per_concurrency)):
                        if error:
                            errors.append(error)
                            oom = oom or error.startswith("MemoryError")
                        else:
                            latencies.append(latency)
            except MemoryError as error:
                oom = True
                errors.append(f"MemoryError: {error}")
            elapsed = time.perf_counter() - wall_started

        completed = len(latencies)
        return {
            "concurrency": concurrency,
            "requested": self.requests_per_concurrency,
            "completed": completed,
            "errors": len(errors),
            "errorRate": round(len(errors) / self.requests_per_concurrency, 6),
            "oomObserved": oom,
            "medianMs": round(float(statistics.median(latencies)), 4) if latencies else None,
            "p95Ms": round(float(np.percentile(latencies, 95)), 4) if latencies else None,
            "meanMs": round(float(statistics.mean(latencies)), 4) if latencies else None,
            "throughputRequestsPerSecond": round(completed / elapsed, 4) if elapsed else None,
            "wallTimeSeconds": round(elapsed, 4),
            "peakRssMiB": memory.peak_mib,
            "sampleErrors": errors[:3],
        }

    def run(self) -> dict:
        if not self._run_lock.acquire(blocking=False):
            raise RuntimeError("A complete benchmark is already running in this process")
        with self._state_lock:
            self.status = "RUNNING"
            self.error = None
        try:
            with PeakMemorySampler() as warmup_memory:
                for index in range(10):
                    self._infer(FIXED_TEXTS[index % len(FIXED_TEXTS)])
            concurrency = [self._concurrency_benchmark(level) for level in [1, 2, 4]]
            maximum_rss = max(
                [self.startup["baselineRssMiB"], self.startup["tokenizerRssMiB"],
                 self.startup["idleModelRssMiB"], self.startup["firstInferencePeakRssMiB"],
                 warmup_memory.peak_mib] + [item["peakRssMiB"] for item in concurrency]
            )
            memory_limit = self.environment["cgroupMemoryLimitMiB"]
            result = {
                "schemaVersion": 1,
                "completedAt": utc_now(),
                "model": {
                    "name": "Candidate C-Lite ONNX INT8",
                    "path": str(self.model_path),
                    "bytes": self.model_path.stat().st_size,
                    "mebibytes": round(self.model_path.stat().st_size / 1_048_576, 4),
                    "sha256": hashlib.sha256(self.model_path.read_bytes()).hexdigest(),
                },
                "fixedInputs": {"count": len(FIXED_TEXTS), "sha256": FIXED_TEXTS_SHA256},
                "environment": self.environment,
                "startup": self.startup,
                "warmup": {"iterations": 10, "peakRssMiB": warmup_memory.peak_mib},
                "concurrency": concurrency,
                "memory": {
                    "baselineRssMiB": self.startup["baselineRssMiB"],
                    "afterTokenizerRssMiB": self.startup["tokenizerRssMiB"],
                    "idleModelRssMiB": self.startup["idleModelRssMiB"],
                    "firstInferencePeakRssMiB": self.startup["firstInferencePeakRssMiB"],
                    "warmupPeakRssMiB": warmup_memory.peak_mib,
                    "maximumObservedRssMiB": maximum_rss,
                    "cgroupMemoryLimitMiB": memory_limit,
                    "maximumRssPercentOfLimit": round(maximum_rss / memory_limit * 100, 2)
                    if memory_limit else None,
                    "oomObserved": any(item["oomObserved"] for item in concurrency),
                    "note": "A platform OOM kill cannot be recorded inside a process that the OS terminates.",
                },
            }
            with self._state_lock:
                self.result = result
                self.status = "COMPLETE"
            return result
        except Exception as error:
            with self._state_lock:
                self.error = f"{type(error).__name__}: {error}"
                self.status = "FAILED"
            raise
        finally:
            self._run_lock.release()

    def snapshot(self) -> dict:
        with self._state_lock:
            return {"status": self.status, "error": self.error, "startup": self.startup,
                    "environment": self.environment, "result": self.result}


def write_json(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def acquire_single_instance_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("w")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        raise RuntimeError("Another complete Candidate C-Lite benchmark process is already running") from error
    handle.write(str(os.getpid())); handle.flush()
    return handle


def handler_for(benchmark: CandidateCLiteBenchmark, output_path: Path):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, payload: dict):
            body = json.dumps(payload, indent=2).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                self._json(200, {"ok": True, "status": benchmark.status})
            elif self.path in {"/", "/results"}:
                self._json(200, benchmark.snapshot())
            else:
                self._json(404, {"error": "Not found"})

        def do_POST(self):
            if self.path != "/benchmark":
                return self._json(404, {"error": "Not found"})
            if benchmark.status == "RUNNING":
                return self._json(409, {"error": "Benchmark already running"})

            def background_run():
                try:
                    result = benchmark.run()
                    write_json(output_path, result)
                    print(json.dumps({"event": "benchmark_complete", "result": result}), flush=True)
                except Exception as error:
                    print(json.dumps({"event": "benchmark_failed", "error": str(error)}), flush=True)

            threading.Thread(target=background_run, daemon=True).start()
            self._json(202, {"status": "STARTED", "results": "/results"})

        def log_message(self, fmt, *args):
            print(json.dumps({"event": "http", "message": fmt % args}), flush=True)

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-once", action="store_true")
    parser.add_argument("--output", type=Path, default=Path(os.environ.get("BENCHMARK_OUTPUT", "/tmp/render-benchmark-results.json")))
    args = parser.parse_args()
    root = Path(os.environ.get("BENCHMARK_ROOT", Path(__file__).resolve().parents[1]))
    lock_handle = acquire_single_instance_lock(Path(os.environ.get("BENCHMARK_LOCK", "/tmp/petalpal-c-lite-benchmark.lock")))
    benchmark = CandidateCLiteBenchmark(
        model_path=Path(os.environ.get("MODEL_PATH", root / "artifacts" / "model-int8.onnx")),
        tokenizer_path=Path(os.environ.get("TOKENIZER_PATH", root / "artifacts" / "tokenizer")),
        thresholds_path=Path(os.environ.get("THRESHOLDS_PATH", root / "thresholds.json")),
        metrics_path=Path(os.environ.get("METRICS_PATH", root / "metrics.json")),
        requests_per_concurrency=int(os.environ.get("BENCHMARK_REQUESTS_PER_CONCURRENCY", "100")),
    )
    print(json.dumps({"event": "service_ready", "snapshot": benchmark.snapshot()}), flush=True)
    if args.run_once:
        result = benchmark.run(); write_json(args.output, result)
        print(json.dumps(result, indent=2), flush=True)
        return

    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "10000"))), handler_for(benchmark, args.output))
    if os.environ.get("RUN_BENCHMARK_ON_STARTUP", "true").lower() == "true":
        def auto_run():
            try:
                result = benchmark.run(); write_json(args.output, result)
                print(json.dumps({"event": "benchmark_complete", "result": result}), flush=True)
            except Exception as error:
                print(json.dumps({"event": "benchmark_failed", "error": str(error)}), flush=True)
        threading.Thread(target=auto_run, daemon=True).start()
    server.serve_forever()
    _ = lock_handle


if __name__ == "__main__":
    main()
