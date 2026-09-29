#!/usr/bin/env python3
"""Run frozen Candidate V3 as a two-epoch optimization-time experiment."""

from __future__ import annotations

import importlib.util
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
V1_RUNNER = HERE / "run_official_training.py"
PLAN = HERE / "candidate-v3/frozen-plan.json"
OUTPUT = HERE / "candidate-v3/run"
EPOCHS = 2


def load_common():
    spec = importlib.util.spec_from_file_location("target_first_v1_runner_reused_for_v3", V1_RUNNER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.PLAN = PLAN
    module.OUTPUT = OUTPUT
    module.LAMBDA_RANK = 15.0 / 92.0
    return module


def main() -> None:
    common = load_common()
    if OUTPUT.exists():
        raise ValueError(f"Refusing to overwrite Candidate V3 run: {OUTPUT}")
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    if plan["status"] != "FROZEN_BEFORE_TRAINING" or plan["training"]["epochs"] != EPOCHS:
        raise ValueError("Candidate V3 plan is not frozen for exactly two epochs")

    torch.set_num_threads(4)
    common.set_seed(common.SEED)
    tokenizer = AutoTokenizer.from_pretrained(common.CHECKPOINT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(common.CHECKPOINT, local_files_only=True)
    audit, train_rows, dev_rows = common.readiness_audit(model)
    if audit["status"] != "PASS":
        print(json.dumps({"readiness": audit}, indent=2))
        raise SystemExit(2)

    OUTPUT.mkdir(parents=True)
    (OUTPUT / "readiness-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device)
    product_positions = common.positions(model, common.PRODUCT_LABELS)
    model_positions = common.positions(model, common.MODEL_LABELS)
    trainable = common.configure_trainable(model)
    train_data = common.SelectiveDataset(train_rows, tokenizer)
    dev_data = common.SelectiveDataset(dev_rows, tokenizer)
    generator = torch.Generator().manual_seed(common.SEED)
    train_loader = DataLoader(
        train_data, batch_size=common.BATCH_SIZE, shuffle=True, generator=generator,
        collate_fn=common.collate(tokenizer), num_workers=0,
    )
    dev_loader = DataLoader(
        dev_data, batch_size=common.BATCH_SIZE, shuffle=False,
        collate_fn=common.collate(tokenizer), num_workers=0,
    )

    start = time.time()
    incumbent_probabilities = common.infer(model, dev_loader, model_positions, device)
    np.save(OUTPUT / "incumbent-dev-probabilities.npy", incumbent_probabilities)
    incumbent = common.evaluate(dev_rows, incumbent_probabilities)
    print(json.dumps({
        "event": "incumbent_evaluated", "macroF1": incumbent["metrics"]["macro"]["f1"],
        "microF1": incumbent["metrics"]["micro"]["f1"], "elapsedSeconds": time.time() - start,
    }), flush=True)

    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=common.LEARNING_RATE, weight_decay=common.WEIGHT_DECAY,
    )
    epochs = []
    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = total_bce = total_rank = 0.0
        processed = 0
        for batch_index, batch in enumerate(train_loader, start=1):
            optimizer.zero_grad(set_to_none=True)
            encoded = {key: value.to(device) for key, value in batch["encoded"].items()}
            logits = model(**encoded).logits[:, product_positions]
            loss, bce, rank = common.row_loss(logits, batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                [parameter for parameter in model.parameters() if parameter.requires_grad],
                common.MAX_GRAD_NORM,
            )
            optimizer.step()
            count = len(batch["selected"])
            total_loss += float(loss.detach()) * count
            total_bce += bce * count
            total_rank += rank * count
            processed += count
            print(json.dumps({
                "event": "train", "epoch": epoch, "batch": batch_index,
                "batches": len(train_loader), "rows": processed,
                "loss": float(loss.detach()), "elapsedSeconds": time.time() - start,
            }), flush=True)

        probabilities = common.infer(model, dev_loader, model_positions, device)
        np.save(OUTPUT / f"epoch-{epoch}-dev-probabilities.npy", probabilities)
        metrics = common.evaluate(dev_rows, probabilities)
        record = {
            "epoch": epoch,
            "trainRows": processed,
            "meanLoss": total_loss / processed,
            "meanMaskedBce": total_bce / processed,
            "meanUnweightedRankingLoss": total_rank / processed,
            "metrics": metrics,
            "elapsedSeconds": time.time() - start,
        }
        epochs.append(record)
        print(json.dumps({
            "event": "epoch_complete", "epoch": epoch,
            "macroF1": metrics["metrics"]["macro"]["f1"],
            "microF1": metrics["metrics"]["micro"]["f1"],
            "p0Directional": metrics["p0"]["macroDirectionalSelectionAccuracy"],
            "p0Raw": metrics["p0"]["macroRawRankingAccuracy"],
            "elapsedSeconds": time.time() - start,
        }), flush=True)

    checkpoint_dir = OUTPUT / "final-checkpoint"
    model.save_pretrained(checkpoint_dir)
    tokenizer.save_pretrained(checkpoint_dir)
    candidate = epochs[-1]["metrics"]
    decision = common.decide(incumbent, candidate, len(dev_rows))
    summary = {
        "status": "COMPLETE",
        "finalStatus": decision["status"],
        "recommendation": "KEEP_CANDIDATE" if decision["status"] == "PASS_DEV" else "REJECT_CANDIDATE",
        "readiness": audit,
        "finalAccessed": False,
        "model": {
            "baseCheckpoint": str(common.CHECKPOINT), "device": str(device),
            "trainable": trainable, "finalCheckpoint": str(checkpoint_dir),
        },
        "frozenConfig": plan,
        "incumbent": incumbent,
        "epochs": epochs,
        "candidate": candidate,
        "comparison": {
            "macroF1Delta": candidate["metrics"]["macro"]["f1"] - incumbent["metrics"]["macro"]["f1"],
            "microF1Delta": candidate["metrics"]["micro"]["f1"] - incumbent["metrics"]["micro"]["f1"],
            "p0SelectionMacroDelta": candidate["p0"]["macroDirectionalSelectionAccuracy"] - incumbent["p0"]["macroDirectionalSelectionAccuracy"],
            "p0RawRankingMacroDelta": candidate["p0"]["macroRawRankingAccuracy"] - incumbent["p0"]["macroRawRankingAccuracy"],
        },
        "devDecision": decision,
        "elapsedSeconds": time.time() - start,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "event": "complete", "status": summary["finalStatus"],
        "recommendation": summary["recommendation"],
        "candidateMacroF1": candidate["metrics"]["macro"]["f1"],
        "candidateMicroF1": candidate["metrics"]["micro"]["f1"],
        "elapsedSeconds": summary["elapsedSeconds"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
