#!/usr/bin/env python3
"""Train and evaluate the one locked taxonomy-balanced synthetic candidate."""

import importlib.util
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
OUTPUT = HERE / "candidate"
BASE_PATH = ALIGNED / "independent-consensus-weak-supervision-v1/run_candidate.py"
SEED = 47
LR = 1e-6
BATCH = 16


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


base = load_module("independent_consensus_runner", BASE_PATH)


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    audit = json.loads((HERE / "feasibility-audit.json").read_text(encoding="utf-8"))
    weak = base.read_jsonl(HERE / "weak-train.jsonl")
    if protocol["status"] != "LOCKED_BEFORE_GENERATION":
        raise ValueError("Protocol not frozen")
    if audit["status"] != "PASS" or audit["decision"] != "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE":
        raise ValueError("Feasibility did not authorize training")
    if len(weak) != 288 or len(weak) != audit["selectedTrainingRows"]:
        raise ValueError("Expected exactly 288 frozen training rows")
    if not all(row["labelStatus"] == "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD" for row in weak):
        raise ValueError("Invalid label status")

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    product_positions = base.positions(model, base.PRODUCT)
    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable_names = []
    for name, parameter in model.named_parameters():
        if name.startswith("classifier.") or ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_names.append(name)
    if not any(name.startswith("classifier.") for name in trainable_names):
        raise ValueError("Classifier not trainable")
    if not all(any(f".encoder.layer.{layer}." in name for name in trainable_names) for layer in (10, 11)):
        raise ValueError("Top encoder layers not trainable")
    model.to(device)
    loader = DataLoader(
        base.WeakDataset(weak, tokenizer), batch_size=BATCH, shuffle=True,
        generator=torch.Generator().manual_seed(SEED), collate_fn=base.collate(tokenizer),
    )
    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=LR, weight_decay=0.01,
    )
    scheduler = get_linear_schedule_with_warmup(optimizer, math.ceil(0.1 * len(loader)), len(loader))
    started = time.time()
    model.train()
    total_loss = 0.0
    total_rows = 0
    for batch in loader:
        targets = batch.pop("targets").to(device)
        logits = model(**{key: value.to(device) for key, value in batch.items()}).logits[:, product_positions]
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            [parameter for parameter in model.parameters() if parameter.requires_grad], 1.0
        )
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        total_loss += float(loss.detach().cpu()) * len(targets)
        total_rows += len(targets)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")

    dev = base.read_jsonl(DEV)
    incumbent_dev21 = np.load(INCUMBENT_DEV)
    candidate_dev18 = base.infer(model, tokenizer, [str(row["journal"]) for row in dev], product_positions, device)
    candidate_dev21 = base.to_canonical21(candidate_dev18)
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev21)
    incumbent_coso = base.labeled_report(dev, incumbent_dev21)
    candidate_coso = base.labeled_report(dev, candidate_dev21)

    reference = base.read_jsonl(base.REFERENCE_DIR / "frozen-reference-300.jsonl")
    candidate_rtn18 = base.infer(model, tokenizer, [str(row["text"]) for row in reference], product_positions, device)
    candidate_rtn21 = base.to_canonical21(candidate_rtn18)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn21)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_outputs = base.canonical.report(fake, candidate_rtn21, 0.35)["outputs"]
    rtn = base.rtn_comparison([set(labels) & set(base.PRODUCT) for labels in candidate_outputs])

    supported_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in base.PRODUCT if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    incumbent_resolved = rtn["incumbent"]["resolved"]
    candidate_resolved = rtn["candidate"]["resolved"]
    incumbent_high = rtn["incumbent"]["highConsensus"]
    candidate_high = rtn["candidate"]["highConsensus"]
    distribution_error = sum(
        abs(candidate_resolved["incumbentCountDistribution"][str(size)] - candidate_resolved["consensusCountDistribution"][str(size)])
        for size in range(3)
    )
    gates = {
        "rtnResolvedMicroF1": candidate_resolved["micro"]["f1"] >= 0.3313265306,
        "rtnResolvedExact": candidate_resolved["exactSetAgreement"]["percent"] >= 50.41,
        "rtnResolvedPrecision": candidate_resolved["micro"]["precision"] >= 0.3341666667,
        "rtnResolvedRecall": candidate_resolved["micro"]["recall"] >= 0.2857142857,
        "rtnResolvedFP": candidate_resolved["falsePositives"] <= 64,
        "rtnResolvedFN": candidate_resolved["falseNegatives"] <= 85,
        "rtnResolvedDistribution": distribution_error <= 54,
        "rtnHighMicroF1": candidate_high["micro"]["f1"] >= 0.3678160920,
        "rtnHighExact": candidate_high["exactSetAgreement"]["percent"] >= 55.66,
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= 0.5180528053,
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= 0.3351786297,
        "cosoFP": candidate_coso["falsePositives"] <= 60,
        "cosoFN": candidate_coso["falseNegatives"] <= 87,
        "cosoSupportedLabels": min(supported_deltas.values()) >= -0.08,
        "outputIntegrity": all(len(labels) <= 2 and set(labels) <= set(base.PRODUCT) for labels in candidate_outputs),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "researchEvidenceImproved": retained,
        "credibleProductQualityPromotionProven": False,
        "currentIncumbentChanged": False,
        "training": {
            "rows": len(weak), "nonEmptyRows": sum(bool(row["weakLabels"]) for row in weak),
            "emptyRows": sum(not row["weakLabels"] for row in weak), "perLabelRows": 12,
            "epochs": 1, "learningRate": LR, "batchSize": BATCH, "seed": SEED,
            "loss": "standard unweighted Product-18 BCEWithLogitsLoss",
            "meanTrainLoss": total_loss / total_rows,
            "trainableParameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
            "totalParameters": sum(p.numel() for p in model.parameters()),
            "elapsedSeconds": time.time() - started,
            "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        },
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn,
        "rtnResolvedCandidateDistributionError": distribution_error,
        "correlationWarning": "Generator/validators share model families with the RTN panel; RTN is correlated research evidence, not independent validation.",
        "gates": gates,
        "humanReview": False,
        "RTNTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "promotionStatement": "No production promotion; candidate and evaluation evidence are research-only.",
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"], "training": result["training"],
        "coso": {"incumbent": {k: incumbent_coso[k] for k in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
                 "candidate": {k: candidate_coso[k] for k in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")}},
        "rtnResolved": {"incumbent": {k: incumbent_resolved[k] for k in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
                        "candidate": {k: candidate_resolved[k] for k in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")}},
        "rtnHigh": {"incumbent": {k: incumbent_high[k] for k in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
                    "candidate": {k: candidate_high[k] for k in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")}},
        "distributionError": distribution_error, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
