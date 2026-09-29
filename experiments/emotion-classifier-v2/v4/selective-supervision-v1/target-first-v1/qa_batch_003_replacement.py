#!/usr/bin/env python3
"""Record QA rejection: amusement was evidenced for crew, not the author."""
import json
import os
from pathlib import Path

WORK = Path(__file__).resolve().parent / "work"

def write(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(value, encoding="utf-8")
    os.replace(temp, path)

def main():
    checkpoint_path = WORK / "checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text())
    attempt = [json.loads(line) for line in (WORK / "generation-attempts.jsonl").read_text().splitlines()][-1]
    qa_path = WORK / "qa-results.jsonl"
    qa = [json.loads(line) for line in qa_path.read_text().splitlines()]
    if checkpoint["nextStage"] != "SEMANTIC_QA_BATCH_003_REPLACEMENT" or len(qa) != 70:
        raise ValueError("unexpected QA continuation")
    qa.append({"recordType": "QA_RESULT", "protocolVersion": "target-first-selective-data-v1",
               "targetId": attempt["targetId"], "targetHash": attempt["targetHash"],
               "attemptId": attempt["attemptId"], "reviewedAt": "2026-09-22T12:35:00Z",
               "qaRole": "INDEPENDENT_TARGET_VISIBLE_VERIFIER", "decision": "REJECT",
               "flags": ["SELECTED_UNSUPPORTED"], "selectedSupported": "NO",
               "plausibleSupportedAndSecondary": "NOT_APPLICABLE", "notApplicableUnsupported": "YES",
               "selectionNaturalAndNonRedundant": "NO", "eventNaturalAndWithinLength": "YES",
               "mayEditTarget": False, "mayEditEvent": False})
    write(qa_path, "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in qa))
    checkpoint.update({"qaReject": 6, "nextStage": "BUILD_BATCH_003_FINAL_REPLACEMENT_TARGET",
                       "firstUnfinishedTargetId": "TFV1-TRAIN-00072", "remainingFrozenTargetIds": []})
    write(checkpoint_path, json.dumps(checkpoint, indent=2) + "\n")

if __name__ == "__main__":
    main()
