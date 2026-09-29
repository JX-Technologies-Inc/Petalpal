#!/usr/bin/env python3
"""Run frozen Candidate V7 with the classifier and encoder layer 11 trainable."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"
V2_PLAN = HERE / "candidate-v2/frozen-plan.json"
V7_PLAN = HERE / "candidate-v7/frozen-plan.json"


def verify_only_trainable_scope_changed() -> dict:
    v2 = json.loads(V2_PLAN.read_text(encoding="utf-8"))
    v7 = json.loads(V7_PLAN.read_text(encoding="utf-8"))
    checks = {
        key: v7[key] == v2[key]
        for key in (
            "trainArtifact", "devArtifact", "finalPolicy", "baseCheckpoint", "seed",
            "loss", "thresholdSelection", "selectionMetric", "stoppingAndSelectionRule",
        )
    }
    v2_training = dict(v2["training"])
    v7_training = dict(v7["training"])
    v2_scope = v2_training.pop("trainableParameters")
    v7_scope = v7_training.pop("trainableParameters")
    checks["trainingExceptScope"] = v7_training == v2_training
    checks["scopeChangedAsDeclared"] = (
        v2_scope == "classifier and encoder layers 10-11 only"
        and v7_scope == "classifier and encoder layer 11 only"
    )
    if not all(checks.values()):
        raise ValueError(f"Candidate V7 differs from V2 beyond trainable scope: {checks}")
    return {"status": "PASS", "checks": checks}


def configure_classifier_and_layer_11(model) -> dict:
    allowed = ("classifier.", "roberta.encoder.layer.11.")
    for name, parameter in model.named_parameters():
        parameter.requires_grad = name.startswith(allowed)
    names = [name for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not any(name.startswith("classifier.") for name in names) or not any(
        name.startswith("roberta.encoder.layer.11.") for name in names
    ) or any(not name.startswith(allowed) for name in names):
        raise AssertionError("Candidate V7 trainable parameter scope failed")
    return {
        "parameterTensors": len(names),
        "parameters": sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad),
        "scope": ["classifier", "roberta.encoder.layer.11"],
    }


def main() -> None:
    verification = verify_only_trainable_scope_changed()
    plan = json.loads(V7_PLAN.read_text(encoding="utf-8"))
    if plan["status"] != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Candidate V7 plan was not frozen before training")
    print(json.dumps({"event": "v7_plan_verified", **verification}), flush=True)

    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v7", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = V7_PLAN
    module.OUTPUT = HERE / "candidate-v7/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.configure_trainable = configure_classifier_and_layer_11
    module.main()


if __name__ == "__main__":
    main()
