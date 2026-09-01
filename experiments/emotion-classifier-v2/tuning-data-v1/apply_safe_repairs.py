#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REDUNDANT = {
    "SUNNY_BLOOM": ["joy"], "GENTLE_BLOOM": ["caring"],
    "QUIET_BLOOM": ["sadness"], "HEALING_BLOOM": [],
    "FIRE_BLOOM": ["anger"], "WONDER_BLOOM": ["curiosity"],
    "DRIFTING_BLOOM": ["confusion"], "PEACEFUL_BLOOM": [],
}
rows = [json.loads(line) for line in (ROOT / "state/remaining-slots.jsonl").open()]
repairable = [row for row in rows if row["review"].get("issues") == ["PRIMARY_REDUNDANCY_METADATA_INCORRECT"]]
with (ROOT / "state/deterministic-repairs-1.jsonl").open("w") as samples, \
     (ROOT / "state/reviewed-deterministic-repairs-1.jsonl").open("w") as reviews:
    for row in repairable:
        sample = row["sample"]
        sample["primaryRedundantEmotions"] = REDUNDANT[sample["primaryGardenMood"]]
        sample["workflowStatus"] = "validation_fixed"
        sample.setdefault("validationFixes", []).append("PRIMARY_REDUNDANCY_METADATA")
        samples.write(json.dumps(sample, ensure_ascii=False) + "\n")
        reviews.write(json.dumps({
            "id": sample["id"], "decision": "ACCEPT", "confidence": "DETERMINISTIC",
            "issues": [], "reviewerProvenance": {"reviewerSystem": "local-validator", "reviewerRole": "SAFE_AUTOFIX", "reviewerPromptVersion": None},
            "workflowStatus": "validation_passed", "fixedFromReviewerIssues": ["PRIMARY_REDUNDANCY_METADATA_INCORRECT"]
        }) + "\n")
assert len(repairable) == 33
print(len(repairable))
