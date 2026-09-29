#!/usr/bin/env python3
"""Run V3 through the reused masked-loss and canonical evaluation utility."""

from __future__ import annotations

import importlib.util
from pathlib import Path


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE.parent / "three-state-partial-supervision-v1/run_candidate.py"


def main() -> None:
    spec = importlib.util.spec_from_file_location("three_state_v1_runner_reused_for_v3", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.HERE = HERE
    module.WEAK = HERE / "weak-train.jsonl"
    module.OUTPUT = HERE / "candidate"
    module.SEED = 52
    module.main()


if __name__ == "__main__":
    main()
