#!/usr/bin/env python3
"""Run frozen Candidate V2 as a one-variable ranking-strength experiment."""

from __future__ import annotations

import importlib.util
from pathlib import Path


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"


def main() -> None:
    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v2", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = HERE / "candidate-v2/frozen-plan.json"
    module.OUTPUT = HERE / "candidate-v2/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.main()


if __name__ == "__main__":
    main()
