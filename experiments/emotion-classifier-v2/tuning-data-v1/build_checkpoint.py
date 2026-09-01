#!/usr/bin/env python3
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ROUNDS = [
    ("generator-a/raw.jsonl", "reviews/reviewer-c-on-a/reviewed.jsonl", 1),
    ("generator-a/regenerated-1.jsonl", "reviews/reviewer-c-on-a/reviewed-regenerated-1.jsonl", 2),
    ("generator-a/regenerated-2.jsonl", "reviews/reviewer-c-on-a/reviewed-regenerated-2.jsonl", 3),
    ("generator-b/raw.jsonl", "reviews/reviewer-a-on-b/reviewed.jsonl", 1),
    ("generator-b/regenerated-1.jsonl", "reviews/reviewer-a-on-b/reviewed-regenerated-1.jsonl", 2),
    ("generator-b/regenerated-2.jsonl", "reviews/reviewer-d-on-b/reviewed-regenerated-2.jsonl", 3),
    ("generator-c/raw.jsonl", "reviews/reviewer-b-on-c/reviewed.jsonl", 1),
    ("generator-c/regenerated-1.jsonl", "reviews/reviewer-b-on-c/reviewed-regenerated-1.jsonl", 2),
    ("generator-c/regenerated-2.jsonl", "reviews/reviewer-a-on-c/reviewed-regenerated-2.jsonl", 3),
    ("state/regenerated-3.jsonl", "state/reviewed-regenerated-3.jsonl", 4),
    ("state/regenerated-4.jsonl", "state/reviewed-regenerated-4.jsonl", 5),
    ("state/deterministic-repairs-1.jsonl", "state/reviewed-deterministic-repairs-1.jsonl", 0),
    ("state/regenerated-5.jsonl", "state/reviewed-regenerated-5.jsonl", 6),
    ("state/final-qc-invalid-slots.jsonl", "state/reviewed-final-qc-invalid-slots.jsonl", 0),
    ("state/final-qc-regenerated-1.jsonl", "state/reviewed-final-qc-regenerated-1.jsonl", 7),
    ("state/final-qc-regenerated-2.jsonl", "state/reviewed-final-qc-regenerated-2.jsonl", 8),
    ("state/final-qc-regenerated-3.jsonl", "state/reviewed-final-qc-regenerated-3.jsonl", 9),
]

def read_jsonl(path):
    return [json.loads(line) for line in path.open() if line.strip()]

accepted = {}
latest_rejected = {}
reject_reasons = Counter()
reviewer_passes = reviewer_failures = regenerated = 0
for sample_name, review_name, attempt in ROUNDS:
    sample_path, review_path = ROOT / sample_name, ROOT / review_name
    samples = {row["id"]: row for row in read_jsonl(sample_path)}
    reviews = read_jsonl(review_path)
    assert len(samples) == len(reviews) and {row["id"] for row in reviews} == set(samples)
    if attempt > 1:
        regenerated += len(samples)
    for review in reviews:
        if review["decision"] == "ACCEPT":
            accepted[review["id"]] = {"sample": samples[review["id"]], "review": review,
                                      "sampleFile": sample_name, "reviewFile": review_name}
            latest_rejected.pop(review["id"], None)
            reviewer_passes += 1
        else:
            accepted.pop(review["id"], None)
            latest_rejected[review["id"]] = {"sample": samples[review["id"]], "review": review,
                                             "sampleFile": sample_name, "reviewFile": review_name}
            reviewer_failures += 1
            reject_reasons.update(review.get("issues") or ["UNSPECIFIED"])

all_ids = set()
for sample_name, _, attempt in ROUNDS:
    if attempt == 1:
        all_ids.update(row["id"] for row in read_jsonl(ROOT / sample_name))
assert len(all_ids) == 2400
remaining = sorted(all_ids - set(accepted))
assert set(remaining) == set(latest_rejected)

state = ROOT / "state"
state.mkdir(exist_ok=True)
with (state / "accepted-current.jsonl").open("w") as handle:
    for sample_id in sorted(accepted):
        handle.write(json.dumps(accepted[sample_id], ensure_ascii=False) + "\n")
with (state / "remaining-slots.jsonl").open("w") as handle:
    for sample_id in remaining:
        handle.write(json.dumps(latest_rejected[sample_id], ensure_ascii=False) + "\n")
checkpoint = {
    "datasetVersion": "petalpal-in-domain-tuning-v1",
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "target": 2400,
    "accepted": len(accepted),
    "remaining": len(remaining),
    "reviewerPassesCumulative": reviewer_passes,
    "reviewerFailuresCumulative": reviewer_failures,
    "rejectedCumulative": reviewer_failures,
    "regeneratedCumulative": regenerated,
    "quarantinedCumulative": 0,
    "validationFailuresCumulative": 0,
    "dominantRejectReasons": reject_reasons.most_common(),
    "acceptedStateFile": "state/accepted-current.jsonl",
    "remainingStateFile": "state/remaining-slots.jsonl",
}
(state / "checkpoint.json").write_text(json.dumps(checkpoint, indent=2) + "\n")
with (state / "progress-log.jsonl").open("a") as handle:
    handle.write(json.dumps(checkpoint) + "\n")
print(json.dumps(checkpoint, indent=2))
