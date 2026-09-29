#!/usr/bin/env python3
"""Run frozen Candidate V5 with a one-logit positive ranking margin."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import torch
import torch.nn.functional as F


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"
V2_PLAN = HERE / "candidate-v2/frozen-plan.json"
V5_PLAN = HERE / "candidate-v5/frozen-plan.json"
MARGIN = 1.0


def verify_only_ranking_formula_changed() -> dict:
    v2 = json.loads(V2_PLAN.read_text(encoding="utf-8"))
    v5 = json.loads(V5_PLAN.read_text(encoding="utf-8"))
    checks = {
        "trainArtifact": v5["trainArtifact"] == v2["trainArtifact"],
        "devArtifact": v5["devArtifact"] == v2["devArtifact"],
        "baseCheckpoint": v5["baseCheckpoint"] == v2["baseCheckpoint"],
        "seed": v5["seed"] == v2["seed"],
        "training": v5["training"] == v2["training"],
        "thresholdSelection": v5["thresholdSelection"] == v2["thresholdSelection"],
        "selectionMetric": v5["selectionMetric"] == v2["selectionMetric"],
        "stoppingAndSelectionRule": v5["stoppingAndSelectionRule"] == v2["stoppingAndSelectionRule"],
    }
    v2_loss = dict(v2["loss"])
    v5_loss = dict(v5["loss"])
    v2_ranking = v2_loss.pop("ranking")
    v5_ranking = v5_loss.pop("ranking")
    margin = v5_loss.pop("rankingMargin")
    checks["lossExceptRankingFormula"] = v5_loss == v2_loss
    checks["rankingChangedAsDeclared"] = (
        v2_ranking == "mean softplus(z_plausible - z_selected) over the within-row Cartesian product"
        and v5_ranking == "mean softplus(1.0 + z_plausible - z_selected) over the within-row Cartesian product"
        and margin == MARGIN
    )
    if not all(checks.values()):
        raise ValueError(f"Candidate V5 differs materially from V2 beyond ranking formula: {checks}")
    return {"status": "PASS", "checks": checks}


def positive_margin_row_loss(common, logits: torch.Tensor, batch: dict) -> tuple[torch.Tensor, float, float]:
    targets = batch["targets"].to(logits.device)
    mask = batch["mask"].to(logits.device)
    cell_loss = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
    bce_rows = (cell_loss * mask).sum(dim=1) / mask.sum(dim=1)
    rank_rows = []
    for row_logits, selected, plausible in zip(logits, batch["selected"], batch["plausible"]):
        if selected and plausible:
            selected_logits = row_logits[torch.tensor(selected, device=logits.device)]
            plausible_logits = row_logits[torch.tensor(plausible, device=logits.device)]
            rank_rows.append(F.softplus(MARGIN + plausible_logits[:, None] - selected_logits[None, :]).mean())
        else:
            rank_rows.append(row_logits.sum() * 0.0)
    rank_rows_tensor = torch.stack(rank_rows)
    loss = (bce_rows + common.LAMBDA_RANK * rank_rows_tensor).mean()
    return loss, float(bce_rows.mean().detach()), float(rank_rows_tensor.mean().detach())


def main() -> None:
    verification = verify_only_ranking_formula_changed()
    plan = json.loads(V5_PLAN.read_text(encoding="utf-8"))
    if plan["status"] != "FROZEN_BEFORE_TRAINING":
        raise ValueError("Candidate V5 plan was not frozen before training")
    print(json.dumps({"event": "v5_plan_verified", **verification}), flush=True)

    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v5", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = V5_PLAN
    module.OUTPUT = HERE / "candidate-v5/run"
    module.LAMBDA_RANK = 15.0 / 92.0
    module.row_loss = lambda logits, batch: positive_margin_row_loss(module, logits, batch)
    module.main()


if __name__ == "__main__":
    main()
