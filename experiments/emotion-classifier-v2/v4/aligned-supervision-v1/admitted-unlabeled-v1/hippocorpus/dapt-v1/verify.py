#!/usr/bin/env python3
"""Reload and verify the retained midpoint research checkpoint and corpus invariants."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
REPAIR = HERE / "midpoint-repair"
spec = importlib.util.spec_from_file_location("dapt_v1", HERE / "run.py")
dapt = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(dapt)


def main() -> None:
    torch.set_num_threads(4)
    summary = json.loads((REPAIR / "summary.json").read_text())
    assert summary["decision"] == "RETAIN_RESEARCH_CANDIDATE"
    corpus_audit = json.loads((dapt.HIPPO / "prepared" / "audit.json").read_text())
    train = dapt.read_jsonl(dapt.HIPPO / "prepared" / "train.jsonl")
    validation = dapt.read_jsonl(dapt.HIPPO / "prepared" / "validation.jsonl")
    assert corpus_audit["admissionClass"] == "ADMIT_UNLABELED"
    assert len(train) == 2637 and len(validation) == 139
    assert all(len(row["text"]) <= 300 and row["labelStatus"] == "UNLABELED" for row in train + validation)
    assert {row["sourceGroupId"] for row in train}.isdisjoint({row["sourceGroupId"] for row in validation})

    tokenizer = AutoTokenizer.from_pretrained(REPAIR / "research-checkpoint", local_files_only=True)
    incumbent = AutoModelForSequenceClassification.from_pretrained(dapt.CHECKPOINT, local_files_only=True)
    candidate = AutoModelForSequenceClassification.from_pretrained(REPAIR / "research-checkpoint", local_files_only=True)
    assert all(
        torch.equal(left, right)
        for left, right in zip(incumbent.classifier.state_dict().values(), candidate.classifier.state_dict().values())
    )
    development = dapt.read_jsonl(dapt.FROZEN_DEVELOPMENT)
    incumbent_probabilities = dapt.classifier_probabilities(incumbent, tokenizer, development)
    candidate_probabilities = dapt.classifier_probabilities(candidate, tokenizer, development)
    np.save(REPAIR / "incumbent-development-probabilities.npy", incumbent_probabilities)
    np.save(REPAIR / "candidate-development-probabilities.npy", candidate_probabilities)
    before = dapt.weak_metrics(development, incumbent_probabilities)
    after = dapt.weak_metrics(development, candidate_probabilities)
    expected = summary["frozenDevelopmentDiagnostic"]
    assert abs(before["micro"]["f1"] - expected["before"]["micro"]["f1"]) < 1e-12
    assert abs(after["micro"]["f1"] - expected["after"]["micro"]["f1"]) < 1e-12
    assert before["outputCountDistribution"] == expected["before"]["outputCountDistribution"]
    assert after["outputCountDistribution"] == expected["after"]["outputCountDistribution"]
    assert before["falsePositives"] == expected["before"]["falsePositives"]
    assert after["falsePositives"] == expected["after"]["falsePositives"]
    report = {
        "status": "PASS",
        "checkpointReloaded": True,
        "classifierHeadUnchanged": True,
        "developmentProbabilitiesSaved": True,
        "developmentMetricsExactMatch": True,
        "corpusRows": {"train": len(train), "validation": len(validation)},
        "allCorpusRowsAtMost300Characters": True,
        "sourceGroupsDisjoint": True,
        "frozenEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    (REPAIR / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
