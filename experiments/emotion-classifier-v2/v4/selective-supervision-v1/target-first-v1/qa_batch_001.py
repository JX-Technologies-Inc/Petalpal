#!/usr/bin/env python3
"""Independent target-visible semantic QA for generation batch 001."""

from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
TARGETS = WORK / "targets.jsonl"
ATTEMPTS = WORK / "generation-attempts.jsonl"
QA = WORK / "qa-results.jsonl"
CHECKPOINT = WORK / "checkpoint.json"
REVIEWED_AT = "2026-09-22T10:31:00Z"

REJECTS = {
    "TFV1-TRAIN-00011": ["PLAUSIBLE_UNSUPPORTED"],
    "TFV1-TRAIN-00014": ["PLAUSIBLE_UNSUPPORTED"],
}


def atomic_write(path, text):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def main():
    if QA.exists():
        raise SystemExit("Refusing to overwrite QA results")
    targets = {r["targetId"]: r for r in map(json.loads, TARGETS.read_text(encoding="utf-8").splitlines())}
    attempts = [json.loads(line) for line in ATTEMPTS.read_text(encoding="utf-8").splitlines()]
    checkpoint = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    if checkpoint["nextStage"] != "SEMANTIC_QA_BATCH_001" or len(attempts) != 28:
        raise ValueError("batch 001 QA checkpoint mismatch")

    results = []
    for attempt in attempts:
        target = targets[attempt["targetId"]]
        if attempt["targetHash"] != target["targetHash"]:
            raise ValueError(f"target hash mismatch: {attempt['targetId']}")
        flags = REJECTS.get(attempt["targetId"], [])
        passed = not flags
        results.append({
            "recordType": "QA_RESULT",
            "protocolVersion": "target-first-selective-data-v1",
            "targetId": attempt["targetId"],
            "targetHash": attempt["targetHash"],
            "attemptId": attempt["attemptId"],
            "reviewedAt": REVIEWED_AT,
            "qaRole": "INDEPENDENT_TARGET_VISIBLE_VERIFIER",
            "decision": "PASS" if passed else "REJECT",
            "flags": flags,
            "selectedSupported": "YES",
            "plausibleSupportedAndSecondary": "YES" if passed else "NO",
            "notApplicableUnsupported": "YES",
            "selectionNaturalAndNonRedundant": "YES",
            "eventNaturalAndWithinLength": "YES",
            "mayEditTarget": False,
            "mayEditEvent": False,
        })

    atomic_write(QA, "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in results))
    rejected = sorted(REJECTS)
    checkpoint.update({
        "qaPass": 26,
        "qaReject": 2,
        "qaFlag": 0,
        "accepted": {"TRAIN": 26, "DEV": 0, "FINAL_TEST": 0},
        "nextStage": "REGENERATE_REJECTED_BATCH_001",
        "firstUnfinishedTargetId": rejected[0],
        "remainingFrozenTargetIds": rejected,
    })
    atomic_write(CHECKPOINT, json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
