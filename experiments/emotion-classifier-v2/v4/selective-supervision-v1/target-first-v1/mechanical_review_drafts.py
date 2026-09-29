#!/usr/bin/env python3
"""Recheck batches 004-007 mechanically; preserve target, Event, QA and accepted files."""
from __future__ import annotations

import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from draft_batch import CLUSTER, LABELS, P0_DIRECTIONS, canonical_hash, cosine, grams, normalize

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
FIRST, LAST = 73, 232
NEW_IDS = {f"TFV1-TRAIN-{i:05d}" for i in range(FIRST, LAST + 1)}
REPORT = WORK / "draft-mechanical-validation-004-007.json"
CHECKPOINT = WORK / "checkpoint.json"

def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]

def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def atomic(path: Path, value: str):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(value, encoding="utf-8")
    os.replace(temp, path)

def pair_records(values):
    groups = defaultdict(list)
    for row in values:
        groups[row["eventText"]].append(row["targetId"])
    return [ids for ids in groups.values() if len(ids) > 1 and any(x in NEW_IDS for x in ids)]

def main():
    protected = [ROOT / "accepted/train.jsonl", ROOT / "accepted/dev.jsonl",
                 ROOT / "accepted/final-test.locked.jsonl", WORK / "qa-results.jsonl",
                 WORK / "independent-qa-verification.json"]
    before = {str(path.relative_to(ROOT)): sha(path) for path in protected}
    checkpoint = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    targets = read_jsonl(WORK / "targets.jsonl")
    attempts = read_jsonl(WORK / "generation-attempts.jsonl")
    qa = read_jsonl(WORK / "qa-results.jsonl")
    accepted = read_jsonl(ROOT / "accepted/train.jsonl")
    issues = []
    if len(targets) != 232 or len(attempts) != 232 or len(qa) != 66 or len(accepted) != 45:
        issues.append("authoritative row counts differ from checkpoint")
    if checkpoint.get("accepted") != {"TRAIN": 45, "DEV": 0, "FINAL_TEST": 0}:
        issues.append("accepted split counts differ from checkpoint")
    if checkpoint.get("nextUnbuiltTargetId") != "TFV1-TRAIN-00233" or checkpoint.get("nextAttemptOrdinal") != 233:
        issues.append("next target/attempt ID differs from checkpoint")
    if checkpoint.get("newDraftsAwaitingIndependentQA") != 160 or checkpoint.get("deterministicRejectedNewDrafts") != 0:
        issues.append("draft/reject checkpoint counts differ")
    expected_ids = [f"TFV1-TRAIN-{i:05d}" for i in range(1, 233)]
    target_ids = [row["targetId"] for row in targets]
    attempt_ids = [row["targetId"] for row in attempts]
    if target_ids != expected_ids:
        issues.append("target IDs are not continuous and ordered")
    if attempt_ids != expected_ids:
        issues.append("attempt target IDs are not continuous and ordered")
    if len(set(target_ids)) != len(target_ids) or len(set(attempt_ids)) != len(attempt_ids):
        issues.append("target/attempt ID collision")
    if [row["attemptId"] for row in attempts] != [f"TFV1-ATT-{i:07d}" for i in range(1, 233)]:
        issues.append("attempt IDs are not continuous and ordered")
    target_by_id = {row["targetId"]: row for row in targets}
    new_targets = targets[FIRST-1:LAST]
    new_attempts = attempts[FIRST-1:LAST]
    schema_failures, length_failures, partition_failures, hash_failures = [], [], [], []
    for target, attempt in zip(new_targets, new_attempts):
        tid = target["targetId"]
        if target.get("recordType") != "TARGET" or attempt.get("recordType") != "GENERATION_ATTEMPT":
            schema_failures.append(tid)
        if canonical_hash(target) != target.get("targetHash") or target.get("targetHash") != attempt.get("targetHash"):
            hash_failures.append(tid)
        supervision = target.get("supervision", {})
        selected = supervision.get("selected", [])
        plausible = supervision.get("plausibleNotSelected", [])
        other = supervision.get("notApplicable", [])
        parts = [set(selected), set(plausible), set(other)]
        if (set.union(*parts) != set(LABELS) or any(parts[i] & parts[j] for i in range(3) for j in range(i))
                or len(selected) > 2 or len({CLUSTER.get(x) for x in selected}) != len(selected)
                or (not selected and plausible)):
            partition_failures.append(tid)
        expected_pairs = {(s,p) for s in selected for p in plausible}
        actual_pairs = {(p["selectedLabel"],p["plausibleLabel"]) for p in target.get("boundaryPairs", [])}
        if expected_pairs != actual_pairs:
            partition_failures.append(tid)
        text = attempt.get("eventText", "")
        if not (isinstance(text, str) and 1 <= len(text) <= 300 and len(text) == attempt.get("unicodeCharacterCount")):
            length_failures.append(tid)
        if not text.isascii() or not re.search(r"[A-Za-z]", text):
            schema_failures.append(tid)
        if target.get("annotationProvenance") != "SYNTHETIC_WEAK_SUPERVISION" or target.get("legacyRowContentUsed") is not False:
            schema_failures.append(tid)
        if target.get("split") != "TRAIN" or target.get("primaryGardenMood", "missing") is not None:
            schema_failures.append(tid)
        declaration = attempt.get("sourceDeclaration", {})
        if declaration.get("createdFromScratch") is not True or any(declaration.get(k) is not False for k in ("legacyRowContentUsed", "rightsPendingTextUsed", "protectedContentUsed", "incumbentOrErrorDataUsed", "modelVotesUsed")):
            schema_failures.append(tid)
        if target.get("createdAt", "") >= attempt.get("generatedAt", ""):
            schema_failures.append(tid)
    exact = pair_records(attempts)
    normalized_groups = defaultdict(list)
    for row in attempts:
        normalized_groups[normalize(row["eventText"])].append(row["targetId"])
    normalized = [ids for ids in normalized_groups.values() if len(ids) > 1 and any(x in NEW_IDS for x in ids)]
    vectors = [(row["targetId"], grams(row["eventText"])) for row in attempts]
    near_pairs = []
    for i, (id_a, vector_a) in enumerate(vectors):
        for id_b, vector_b in vectors[:i]:
            if id_a not in NEW_IDS and id_b not in NEW_IDS:
                continue
            score = cosine(vector_a, vector_b)
            if score >= 0.80:
                near_pairs.append({"ids": [id_b, id_a], "cosine": round(score, 4)})
    family_groups = defaultdict(list)
    skeleton_groups = defaultdict(list)
    opening_groups = defaultdict(list)
    prompt_groups = defaultdict(list)
    for target in targets:
        tid = target["targetId"]
        family_groups[target["scenarioFamilyId"]].append(tid)
        keys = ["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"]
        skeleton = normalize(" | ".join(target["scenarioPlan"][key] for key in keys))
        skeleton_groups[skeleton].append(tid)
    for row in attempts:
        if row["targetId"] in NEW_IDS:
            tokens = re.findall(r"[a-z]+", normalize(row["eventText"]))
            opening_groups[" ".join(tokens[:6])].append(row["targetId"])
            prompt_groups[row["promptVersion"]].append(row["targetId"])
    family_collisions = {k:v for k,v in family_groups.items() if len(v)>1 and any(x in NEW_IDS for x in v)}
    skeleton_collisions = [v for v in skeleton_groups.values() if len(v)>1 and any(x in NEW_IDS for x in v)]
    opening_concentration = {k:v for k,v in opening_groups.items() if len(v)>=3}
    # Existing workflow's normalized character 3-5 gram mechanism above
    # catches near duplicate prose. These scenario/opening counts are
    # concentration flags only, never semantic duplicate judgments.
    manifests = []
    for batch in range(4,8):
        manifest = json.loads((WORK / f"batch-{batch:03d}-manifest.json").read_text())
        expected = [f"TFV1-TRAIN-{i:05d}" for i in range(73 + 40*(batch-4), 113 + 40*(batch-4))]
        if (manifest.get("phase") != "DRAFTS_PERSISTED_AWAITING_INDEPENDENT_QA"
                or manifest.get("targetIds") != expected or manifest.get("draftIds") != expected
                or manifest.get("deterministicRejectIds") != []):
            issues.append(f"batch {batch:03d} manifest mismatch")
        if any(manifest["targetHashes"].get(tid) != target_by_id[tid]["targetHash"] for tid in expected):
            issues.append(f"batch {batch:03d} hash mismatch")
        manifests.append({"batch": f"{batch:03d}", "count": len(expected), "first": expected[0], "last": expected[-1]})
    selected = Counter(x for row in new_targets for x in row["supervision"]["selected"])
    plausible = Counter(x for row in new_targets for x in row["supervision"]["plausibleNotSelected"])
    cardinality = Counter(len(row["supervision"]["selected"]) for row in new_targets)
    directional = Counter((p["selectedLabel"], p["plausibleLabel"]) for row in new_targets for p in row["boundaryPairs"] if (p["selectedLabel"], p["plausibleLabel"]) in P0_DIRECTIONS)
    p0_modes = Counter((p["pair"], p["mode"]) for row in new_targets for p in row["p0Coverage"])
    tags = Counter(tag for row in new_targets for tag in row["coverageTags"])
    if schema_failures or length_failures or partition_failures or hash_failures or exact or normalized or family_collisions or skeleton_collisions:
        issues.append("one or more mechanical failure categories are nonempty")
    after = {str(path.relative_to(ROOT)): sha(path) for path in protected}
    if before != after:
        issues.append("protected accepted/QA artifact changed during review")
    report = {
        "protocolVersion": "target-first-selective-data-v1",
        "reviewType": "DETERMINISTIC_MECHANICAL_ONLY",
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if not issues else "FAIL",
        "draftsInspected": len(new_attempts),
        "idRange": ["TFV1-TRAIN-00073", "TFV1-TRAIN-00232"],
        "schemaFailures": sorted(set(schema_failures)),
        "lengthFailures": sorted(set(length_failures)),
        "partitionFailures": sorted(set(partition_failures)),
        "targetHashFailures": sorted(set(hash_failures)),
        "exactDuplicateGroups": exact,
        "normalizedDuplicateGroups": normalized,
        "nearDuplicateThreshold": 0.80,
        "nearDuplicateMechanism": "normalized character 3-5 gram cosine from draft_batch.py",
        "nearDuplicateCandidates": near_pairs,
        "scenarioFamilyCollisions": family_collisions,
        "scenarioSkeletonCollisions": skeleton_collisions,
        "openingConcentrationThreeOrMore": opening_concentration,
        "promptVersionCounts": {k:len(v) for k,v in prompt_groups.items()},
        "batches": manifests,
        "coverage": {
            "selectedCardinality": {str(k):cardinality[k] for k in (0,1,2)},
            "selectedSupport": {label:selected[label] for label in LABELS},
            "plausibleSupport": {label:plausible[label] for label in LABELS},
            "p0Directions": {f"{a}>{b}":directional[(a,b)] for a,b in sorted(P0_DIRECTIONS)},
            "p0Modes": {f"{pair}:{mode}":count for (pair,mode),count in sorted(p0_modes.items())},
            "coverageTags": dict(sorted(tags.items())),
        },
        "officialAcceptedUnchanged": {"TRAIN":len(accepted),"DEV":0,"FINAL_TEST":0},
        "independentQaResultsUnchanged": len(qa),
        "protectedArtifactSha256": after,
        "checkpoint": {"nextStage":checkpoint["nextStage"],
                        "nextTargetId":checkpoint["nextUnbuiltTargetId"],
                        "nextAttemptOrdinal":checkpoint["nextAttemptOrdinal"],
                        "draftsAwaitingIndependentQA":checkpoint["newDraftsAwaitingIndependentQA"]},
        "issues":issues,
        "semanticQaPerformed":False,
    }
    atomic(REPORT, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if not issues:
        checkpoint["draftMechanicalReview"] = {"status":"PASS","report":"draft-mechanical-validation-004-007.json","drafts":160,"reviewedAt":report["reviewedAt"]}
        checkpoint["nextStage"] = "AWAIT_INDEPENDENT_ASTRA_QA_00073_00232"
        checkpoint["firstUnfinishedTargetId"] = "TFV1-TRAIN-00073"
        checkpoint["nextUnbuiltTargetId"] = "TFV1-TRAIN-00233"
        checkpoint["readyForIndependentQA"] = True
        atomic(CHECKPOINT, json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status":report["status"],"drafts":160,"nearCandidates":len(near_pairs),
                      "scenarioCollisions":len(family_collisions)+len(skeleton_collisions),
                      "issues":issues,"nextTargetId":"TFV1-TRAIN-00233"},ensure_ascii=False))

if __name__ == "__main__":
    main()
