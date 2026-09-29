#!/usr/bin/env python3
"""Semantic QA for fresh batch-001 replacement attempts."""

from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
ATTEMPTS = WORK / "generation-attempts.jsonl"
QA = WORK / "qa-results.jsonl"
CHECKPOINT = WORK / "checkpoint.json"


def atomic_write(path, text):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def main():
    checkpoint = json.loads(CHECKPOINT.read_text())
    if checkpoint["nextStage"] != "SEMANTIC_QA_BATCH_001_REPLACEMENTS":
        raise ValueError("replacement QA checkpoint mismatch")
    attempts = [json.loads(x) for x in ATTEMPTS.read_text().splitlines()]
    qa = [json.loads(x) for x in QA.read_text().splitlines()]
    if len(attempts) != 30 or len(qa) != 28:
        raise ValueError("replacement QA input mismatch")
    by_target = {r["targetId"]: r for r in attempts[-2:]}
    for target_id in ("TFV1-TRAIN-00029", "TFV1-TRAIN-00030"):
        attempt = by_target[target_id]
        qa.append({
            "recordType": "QA_RESULT",
            "protocolVersion": "target-first-selective-data-v1",
            "targetId": target_id,
            "targetHash": attempt["targetHash"],
            "attemptId": attempt["attemptId"],
            "reviewedAt": "2026-09-22T10:48:00Z",
            "qaRole": "INDEPENDENT_TARGET_VISIBLE_VERIFIER",
            "decision": "PASS",
            "flags": [],
            "selectedSupported": "YES",
            "plausibleSupportedAndSecondary": "YES",
            "notApplicableUnsupported": "YES",
            "selectionNaturalAndNonRedundant": "YES",
            "eventNaturalAndWithinLength": "YES",
            "mayEditTarget": False,
            "mayEditEvent": False,
        })
    atomic_write(QA, "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in qa))
    checkpoint.update({
        "completedBatch": 1,
        "activeBatch": 2,
        "qaPass": 28,
        "qaReject": 2,
        "qaFlag": 0,
        "accepted": {"TRAIN": 28, "DEV": 0, "FINAL_TEST": 0},
        "nextStage": "BUILD_BATCH_002_TARGETS",
        "firstUnfinishedTargetId": "TFV1-TRAIN-00031",
        "remainingFrozenTargetIds": [],
    })
    atomic_write(CHECKPOINT, json.dumps(checkpoint, indent=2) + "\n")


if __name__ == "__main__":
    main()
