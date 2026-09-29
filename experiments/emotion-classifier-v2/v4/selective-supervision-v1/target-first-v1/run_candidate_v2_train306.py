#!/usr/bin/env python3
"""Run Candidate V2 with only the accepted Train artifact expanded to 306 rows."""

from __future__ import annotations

import importlib.util
from pathlib import Path


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"


def main() -> None:
    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v2_train306", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = HERE / "candidate-v2-train306/frozen-plan.json"
    module.OUTPUT = HERE / "candidate-v2-train306/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.EXPECTED["train.jsonl"] = (
        306,
        "da57b4ab7a6b8a7b672ee301d9b0d884e69e5512325a6d797623592ecd202b14",
        "TRAIN",
    )
    module.main()


if __name__ == "__main__":
    main()
