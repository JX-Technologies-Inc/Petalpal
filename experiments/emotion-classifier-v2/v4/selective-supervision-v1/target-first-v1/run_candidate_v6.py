#!/usr/bin/env python3
"""Run frozen Candidate V6 as a classifier-only adaptation experiment."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"
V2_PLAN = HERE / "candidate-v2/frozen-plan.json"
V6_PLAN = HERE / "candidate-v6/frozen-plan.json"


def verify_only_trainable_scope_changed() -> dict:
    v2 = json.loads(V2_PLAN.read_text(encoding="utf-8"))
    v6 = json.loads(V6_PLAN.read_text(encoding="utf-8"))
    checks = {
        "trainArtifact": v6["trainArtifact"] == v2["trainArtifact"],
        "devArtifact": v6["devArtifact"] == v2["devArtifact"],
        "baseCheckpoint": v6["baseCheckpoint"] == v2["baseCheckpoint"],
        "seed": v6["seed"] == v2["seed"],
        "loss": v6["loss"] == v2["loss"],
        "thresholdSelection": v6["thresholdSelection"] == v2["thresholdSelection"],
        "selectionMetric": v6["selectionMetric"] == v2["selectionMetric"],
        "stoppingAndSelectionRule": v6["stoppingAndSelectionRule"] == v2["stoppingAndSelectionRule"],
    }
    v2_training = dict(v2["training"])
    v6_training = dict(v6["training"])
    v2_scope = v2_training.pop("trainableParameters")
    v6_scope = v6_training.pop("trainableParameters")
    checks["trainingExceptScope"] = v6_training == v2_training
    checks["scopeChangedAsDeclared"] = (
        v2_scope == "classifier and encoder layers 10-11 only"
        and v6_scope == "classifier only"
    )
    if not all(checks.values()):
        raise ValueError(f"Candidate V6 differs materially from V2 beyond trainable scope: {checks}")
    return {"status": "PASS", "checks": checks}


def configure_classifier_only(model) -> dict:
    for parameter in model.parameters():
        parameter.requires_grad = False
    for name, parameter in model.named_parameters():
        if name.startswith("classifier."):
            parameter.requires_grad = True
    names = [name for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not names or any(not name.startswith("classifier.") for name in names):
        raise AssertionError("Candidate V6 classifier-only freeze policy failed")
    return {
        "parameterTensors": len(names),
        "parameters": sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad),
        "scope": ["classifier"],
    }


def main() -> None:
    verification = verify_only_trainable_scope_changed()
    plan = json.loads(V6_PLAN.read_text(encoding="utf-8"))
    if plan["status"] != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Candidate V6 plan was not frozen before training")
    print(json.dumps({"event": "v6_plan_verified", **verification}), flush=True)

    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v6", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = V6_PLAN
    module.OUTPUT = HERE / "candidate-v6/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.configure_trainable = configure_classifier_only
    module.main()


if __name__ == "__main__":
    main()
