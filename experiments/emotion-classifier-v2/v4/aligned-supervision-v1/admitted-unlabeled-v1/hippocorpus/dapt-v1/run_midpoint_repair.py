#!/usr/bin/env python3
"""One-shot midpoint repair for the rejected Hippocorpus DAPT encoder."""

import importlib.util
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForMaskedLM, AutoModelForSequenceClassification, AutoTokenizer, DataCollatorForLanguageModeling


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "midpoint-repair"
ADAPTED = HERE / "experiment" / "adapted-classifier-checkpoint"
ALPHA = 0.5

spec = importlib.util.spec_from_file_location("dapt_v1", HERE / "run.py")
dapt = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(dapt)


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite existing repair: {OUTPUT}")
    OUTPUT.mkdir()
    torch.set_num_threads(4)
    torch.manual_seed(dapt.SEED)
    np.random.seed(dapt.SEED)

    protocol = json.loads((HERE / "midpoint-repair-protocol.json").read_text())
    assert protocol["status"] == "LOCKED" and protocol["alphaAdapted"] == ALPHA
    rejected = json.loads((HERE / "experiment" / "summary.json").read_text())
    assert rejected["decision"] == "REJECT_RESEARCH_CANDIDATE"

    tokenizer = AutoTokenizer.from_pretrained(dapt.CHECKPOINT, local_files_only=True)
    incumbent = AutoModelForSequenceClassification.from_pretrained(dapt.CHECKPOINT, local_files_only=True)
    adapted = AutoModelForSequenceClassification.from_pretrained(ADAPTED, local_files_only=True)
    midpoint = AutoModelForSequenceClassification.from_pretrained(dapt.CHECKPOINT, local_files_only=True)
    with torch.no_grad():
        for midpoint_parameter, adapted_parameter in zip(midpoint.roberta.parameters(), adapted.roberta.parameters()):
            midpoint_parameter.lerp_(adapted_parameter, ALPHA)

    validation_rows = dapt.read_jsonl(dapt.HIPPO / "prepared" / "validation.jsonl")
    assert all(len(row["text"]) <= 300 for row in validation_rows)
    collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=True,
        mlm_probability=dapt.MASK_PROBABILITY,
        return_tensors="pt",
    )
    validation_loader = DataLoader(
        dapt.TextDataset(validation_rows, tokenizer),
        batch_size=dapt.BATCH_SIZE,
        shuffle=False,
        collate_fn=collator,
    )
    mlm = AutoModelForMaskedLM.from_pretrained("FacebookAI/roberta-base", local_files_only=True)
    mlm.roberta.load_state_dict(midpoint.roberta.state_dict(), strict=True)
    midpoint_mlm_loss = dapt.evaluate_mlm(mlm, validation_loader, dapt.SEED + 100)

    development_rows = dapt.read_jsonl(dapt.FROZEN_DEVELOPMENT)
    assert len(development_rows) == 149
    incumbent_probabilities = dapt.classifier_probabilities(incumbent, tokenizer, development_rows)
    midpoint_probabilities = dapt.classifier_probabilities(midpoint, tokenizer, development_rows)
    before = dapt.weak_metrics(development_rows, incumbent_probabilities)
    after = dapt.weak_metrics(development_rows, midpoint_probabilities)
    micro_f1_drop = before["micro"]["f1"] - after["micro"]["f1"]
    per_label_f1_delta = {
        label: after["perLabel"][label]["f1"] - before["perLabel"][label]["f1"]
        for label in dapt.PRODUCT_18
    }
    supported_deltas = {
        label: delta for label, delta in per_label_f1_delta.items() if before["perLabel"][label]["support"] >= 3
    }
    worst_supported_label = min(supported_deltas, key=supported_deltas.get)
    false_positive_increase = after["falsePositives"]["perRow"] - before["falsePositives"]["perRow"]
    catastrophic_forgetting = (
        micro_f1_drop > 0.02
        or supported_deltas[worst_supported_label] < -0.10
        or false_positive_increase > 0.05
    )
    baseline_mlm_loss = rejected["heldOutMlm"]["baselineLoss"]
    decision = (
        "RETAIN_RESEARCH_CANDIDATE"
        if midpoint_mlm_loss < baseline_mlm_loss and not catastrophic_forgetting
        else "REJECT_RESEARCH_CANDIDATE"
    )
    if decision == "RETAIN_RESEARCH_CANDIDATE":
        midpoint.save_pretrained(OUTPUT / "research-checkpoint")
        tokenizer.save_pretrained(OUTPUT / "research-checkpoint")

    summary = {
        "status": "COMPLETE",
        "decision": decision,
        "decisionScope": "research continuation only; not model promotion or production clearance",
        "alphaAdapted": ALPHA,
        "lineageRights": "UNRESOLVED_UNDERLYING_GOEMOTIONS_REDDIT_TEXT",
        "heldOutMlm": {
            "incumbentLoss": baseline_mlm_loss,
            "rejectedFullDaptLoss": rejected["heldOutMlm"]["adaptedLoss"],
            "midpointLoss": midpoint_mlm_loss,
            "relativeChangeVsIncumbent": midpoint_mlm_loss / baseline_mlm_loss - 1,
        },
        "frozenDevelopmentDiagnostic": {
            "goldStatus": "NOT_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD",
            "before": before,
            "after": after,
            "microF1Drop": micro_f1_drop,
            "perLabelF1Delta": per_label_f1_delta,
            "worstSupportedLabel": {
                "label": worst_supported_label,
                "f1Delta": supported_deltas[worst_supported_label],
                "minimumSupport": 3,
            },
            "falsePositiveIncreasePerRow": false_positive_increase,
            "catastrophicForgetting": catastrophic_forgetting,
            "meanAbsoluteProbabilityChange": float(np.abs(midpoint_probabilities - incumbent_probabilities).mean()),
            "exactTop2SelectionAgreement": float(
                np.all(dapt.select_top2(midpoint_probabilities) == dapt.select_top2(incumbent_probabilities), axis=1).mean()
            ),
        },
        "promotionConclusion": "INCONCLUSIVE_NO_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD",
        "frozenEvaluationOpened": False,
        "humanReviewPerformed": False,
        "elapsedSeconds": time.time() - started,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


started = time.time()
if __name__ == "__main__":
    main()
