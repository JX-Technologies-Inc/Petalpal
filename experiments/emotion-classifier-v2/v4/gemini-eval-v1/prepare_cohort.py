#!/usr/bin/env python3
import hashlib, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
P = HERE.parent / "independent-human-v1"
OUT = HERE / "blind-cohort.jsonl"
MANIFEST = HERE / "cohort-manifest.json"
N = 300
SALT = "petalpal-gemini-eval-v1-20260908"

def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

def sha_bytes(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if OUT.exists() or MANIFEST.exists():
    raise SystemExit("refusing to replace existing cohort or manifest")

candidates = rows(P / "candidate-train.jsonl")
pilot_ids = {r["id"] for r in rows(P / "pilot-blind.jsonl")}
eligible = [r for r in candidates if r["id"] not in pilot_ids]
assert len(candidates) == 769 and len(pilot_ids) == 320 and len(eligible) == 449
assert len({r["sourceGroupId"] for r in eligible}) == len(eligible)

ranked = sorted(eligible, key=lambda r: hashlib.sha256(f'{SALT}:{r["id"]}'.encode()).hexdigest())
selected, reserved = ranked[:N], ranked[N:]
blind = [{
    "id": r["id"],
    "journal": r["journal"],
    "sourceType": r["sourceType"],
    "sourceGroupId": r["sourceGroupId"],
    "provenance": r["provenance"],
    "evaluationRole": "LOCKED_BLIND_EVALUATION"
} for r in selected]
OUT.write_text("".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in blind))

manifest = {
    "status": "COHORT_LOCKED_BEFORE_ANNOTATION_AND_CANDIDATE_INFERENCE",
    "referenceNameRequired": "human-written, Gemini-annotated / Gemini-adjudicated evaluation",
    "selection": {
        "source": "CoSoWELL v1 yesterday narratives already acquired and provenance-audited",
        "candidatePartition": "candidate-train only; excludes all 320 pilot-selected authors",
        "rule": f"first {N} by SHA256({SALT}:id)",
        "emotionBlind": True,
        "candidatePredictionBlind": True,
        "selected": len(selected),
        "reservedForDevelopmentNotEvaluation": len(reserved)
    },
    "isolation": {
        "oneNarrativePerAuthor": True,
        "sourceGroupUniqueWithinEvaluation": True,
        "disjointFromPilotSelection": not ({r["id"] for r in selected} & pilot_ids),
        "limitations": "Same CoSoWELL source/domain as prior pilot and historical 367, but entirely new authors and texts. Older North-American/pandemic-era cohort; not population representative."
    },
    "hashes": {
        "protocolSha256": sha_bytes(HERE / "protocol.json"),
        "blindCohortSha256": sha_bytes(OUT),
        "candidateTrainInputSha256": sha_bytes(P / "candidate-train.jsonl"),
        "pilotBlindInputSha256": sha_bytes(P / "pilot-blind.jsonl")
    },
    "candidateInferencePerformed": False
}
MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
