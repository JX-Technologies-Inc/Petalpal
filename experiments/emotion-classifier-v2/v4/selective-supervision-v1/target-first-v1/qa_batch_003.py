#!/usr/bin/env python3
"""Persist a separate target-visible QA pass for batch 003."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
# Event 58 supports amusement, but the momentary surprise is not independently
# central enough to occupy the second output slot. The frozen target is rejected.
REJECTS = {"TFV1-TRAIN-00058": ["SELECTED_NOT_CENTRAL"]}

def write(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(value, encoding="utf-8")
    os.replace(temp, path)

def main():
    checkpoint_path = WORK / "checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text())
    attempts = [json.loads(line) for line in (WORK / "generation-attempts.jsonl").read_text().splitlines()]
    qa_path = WORK / "qa-results.jsonl"
    qa = [json.loads(line) for line in qa_path.read_text().splitlines()]
    if checkpoint["nextStage"] != "SEMANTIC_QA_BATCH_003" or len(attempts) != 70 or len(qa) != 50:
        raise ValueError("unexpected batch 003 QA checkpoint")
    for attempt in attempts[50:]:
        flags = REJECTS.get(attempt["targetId"], [])
        passed = not flags
        qa.append({
            "recordType": "QA_RESULT", "protocolVersion": "target-first-selective-data-v1",
            "targetId": attempt["targetId"], "targetHash": attempt["targetHash"],
            "attemptId": attempt["attemptId"], "reviewedAt": "2026-09-22T12:25:00Z",
            "qaRole": "INDEPENDENT_TARGET_VISIBLE_VERIFIER", "decision": "PASS" if passed else "REJECT",
            "flags": flags, "selectedSupported": "YES",
            "plausibleSupportedAndSecondary": "NOT_APPLICABLE",
            "notApplicableUnsupported": "YES",
            "selectionNaturalAndNonRedundant": "YES" if passed else "NO",
            "eventNaturalAndWithinLength": "YES", "mayEditTarget": False, "mayEditEvent": False,
        })
    write(qa_path, "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in qa))
    checkpoint.update({"qaPass": 65, "qaReject": 5, "qaFlag": 0,
                       "accepted": {"TRAIN": 65, "DEV": 0, "FINAL_TEST": 0},
                       "nextStage": "REGENERATE_REJECTED_BATCH_003",
                       "firstUnfinishedTargetId": "TFV1-TRAIN-00058",
                       "remainingFrozenTargetIds": ["TFV1-TRAIN-00058"]})
    write(checkpoint_path, json.dumps(checkpoint, indent=2) + "\n")

if __name__ == "__main__":
    main()
