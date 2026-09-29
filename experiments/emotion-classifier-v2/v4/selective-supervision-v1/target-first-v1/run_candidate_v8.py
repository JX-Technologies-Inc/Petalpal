#!/usr/bin/env python3
"""Run frozen Candidate V8 with a lower encoder learning rate."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import torch


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"
V2_PLAN = HERE / "candidate-v2/frozen-plan.json"
V2_SUMMARY = HERE / "candidate-v2/run/summary.json"
V8_PLAN = HERE / "candidate-v8/frozen-plan.json"
CLASSIFIER_LR = 1e-6
ENCODER_LR = 1e-7


def verify_only_encoder_lr_changed(runtime_checkpoint: Path) -> dict:
    v2 = json.loads(V2_PLAN.read_text(encoding="utf-8"))
    v8 = json.loads(V8_PLAN.read_text(encoding="utf-8"))
    v2_run = json.loads(V2_SUMMARY.read_text(encoding="utf-8"))
    checks = {
        key: v8[key] == v2[key]
        for key in (
            "trainArtifact", "devArtifact", "finalPolicy", "seed", "loss",
            "thresholdSelection", "selectionMetric", "stoppingAndSelectionRule",
        )
    }
    checks["baseCheckpointMatchesV2Runtime"] = (
        (V8_PLAN.parent / v8["baseCheckpoint"]).resolve() == runtime_checkpoint.resolve()
        and Path(v2_run["model"]["baseCheckpoint"]).resolve() == runtime_checkpoint.resolve()
    )
    v2_training = dict(v2["training"])
    v8_training = dict(v8["training"])
    encoder_lr = v8_training.pop("encoderLearningRate")
    checks["trainingExceptEncoderLr"] = v8_training == v2_training
    checks["learningRatesAsDeclared"] = (
        v8_training["learningRate"] == CLASSIFIER_LR
        and encoder_lr == ENCODER_LR
    )
    if not all(checks.values()):
        raise ValueError(f"Candidate V8 differs from V2 beyond encoder LR: {checks}")
    return {"status": "PASS", "checks": checks}


def make_differential_optimizer(model):
    encoder_prefixes = ("roberta.encoder.layer.10.", "roberta.encoder.layer.11.")
    encoder = [parameter for name, parameter in model.named_parameters() if name.startswith(encoder_prefixes) and parameter.requires_grad]
    classifier = [parameter for name, parameter in model.named_parameters() if name.startswith("classifier.") and parameter.requires_grad]
    selected = {id(parameter) for parameter in encoder + classifier}
    active = {id(parameter) for parameter in model.parameters() if parameter.requires_grad}
    if not encoder or not classifier or selected != active or len(selected) != len(encoder) + len(classifier):
        raise AssertionError("V8 optimizer groups do not exactly cover classifier and encoder layers 10-11")
    return torch.optim.AdamW(
        [
            {"params": encoder, "lr": ENCODER_LR},
            {"params": classifier, "lr": CLASSIFIER_LR},
        ],
        lr=CLASSIFIER_LR,
        weight_decay=0.01,
    )


def main() -> None:
    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v8", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    plan = json.loads(V8_PLAN.read_text(encoding="utf-8"))
    if plan["status"] != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Candidate V8 plan was not frozen before training")
    verification = verify_only_encoder_lr_changed(module.CHECKPOINT)
    print(json.dumps({"event": "v8_plan_verified", **verification}), flush=True)
    module.PLAN = V8_PLAN
    module.OUTPUT = HERE / "candidate-v8/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.make_optimizer = make_differential_optimizer
    module.main()


if __name__ == "__main__":
    main()
