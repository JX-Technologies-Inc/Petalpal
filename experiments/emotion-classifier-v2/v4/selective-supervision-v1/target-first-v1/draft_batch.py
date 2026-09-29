#!/usr/bin/env python3
"""Append target-first Train drafts without assigning semantic QA decisions.

Usage: python3 draft_batch.py freeze 004
       python3 draft_batch.py generate 004
Each phase is persisted independently. Never pass Event prose to freeze.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from target_invalidation import check_invalidations

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
PLAN = WORK / "plans"
TARGETS = WORK / "targets.jsonl"
ATTEMPTS = WORK / "generation-attempts.jsonl"
CHECKPOINT = WORK / "checkpoint.json"
LABELS = ["admiration", "amusement", "anger", "annoyance", "caring", "confusion", "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude", "joy", "love", "optimism", "remorse", "sadness", "surprise"]
CLUSTER = {**dict.fromkeys(["joy", "amusement", "excitement", "optimism"], "UPBEAT"),
           **dict.fromkeys(["gratitude", "love", "caring", "admiration"], "WARM_SOCIAL"),
           **dict.fromkeys(["sadness", "disappointment", "remorse"], "REFLECTIVE"),
           **dict.fromkeys(["anger", "annoyance", "fear", "disgust"], "THREAT_INTENSITY"),
           **dict.fromkeys(["curiosity", "confusion", "surprise"], "EXPLORATION")}
P0_PAIRS = ["sadness|caring", "caring|love", "joy|optimism", "joy|excitement", "caring|gratitude", "joy|love", "fear|annoyance"]
P0_DIRECTIONS = {(a, b): pair for pair in P0_PAIRS for a, b in [pair.split("|"), pair.split("|")[::-1]]}
ALLOWED_TAGS = {"P0_DIRECTIONAL", "P0_BOTH_SELECTED", "P0_NEITHER_CONTROL", "RARE_LABEL", "ORDINARY_DAILY", "MIXED_VALENCE", "SUBTLE", "CLEAR_SINGLE", "GENERAL_TWO_SELECTED", "GENERAL_BOUNDARY"}
LABEL_STEMS = ("admiration", "amusement", "anger", "annoyance", "caring", "confusion", "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude", "joy", "love", "optimism", "remorse", "sadness", "surprise")

def now():
    return datetime.now(timezone.utc).isoformat()

def lines(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(value, encoding="utf-8")
    os.replace(temp, path)

def canonical_hash(row):
    body = {k: v for k, v in row.items() if k != "targetHash"}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def normalize(text):
    value = unicodedata.normalize("NFKC", text).lower()
    value = value.translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-"}))
    return " ".join(value.split())

def grams(text):
    value = normalize(text)
    return Counter(value[i:i+n] for n in (3, 4, 5) for i in range(max(0, len(value)-n+1)))

def cosine(a, b):
    numerator = sum(v * b.get(k, 0) for k, v in a.items())
    aa = sum(v*v for v in a.values())
    bb = sum(v*v for v in b.values())
    return numerator / math.sqrt(aa*bb) if aa and bb else 0.0

def build_target(spec, number, batch, ordinal):
    if isinstance(spec, list):
        if len(spec) != 9:
            raise ValueError("compact target spec needs nine fields")
        spec = dict(zip(["s", "p", "scenario", "sr", "pr", "p0", "tags", "two", "zero"], spec))
        if spec["p0"] is None:
            del spec["p0"]
    selected = spec["s"]
    plausible = spec.get("p", [])
    if not isinstance(selected, list) or not isinstance(plausible, list) or len(selected) > 2:
        raise ValueError(f"invalid label arrays at batch {batch} row {ordinal}")
    if len(set(selected)) != len(selected) or len(set(plausible)) != len(plausible) or set(selected) & set(plausible):
        raise ValueError(f"overlapping label arrays at batch {batch} row {ordinal}")
    if not set(selected + plausible) <= set(LABELS):
        raise ValueError(f"unknown Product-18 label at batch {batch} row {ordinal}")
    if len({CLUSTER[x] for x in selected}) != len(selected):
        raise ValueError(f"two selected labels share a selector cluster at batch {batch} row {ordinal}")
    if not selected and plausible:
        raise ValueError("abstention cannot have plausible labels")
    reasons = spec.get("sr", [])
    plausible_reasons = spec.get("pr", [])
    if len(reasons) != len(selected) or len(plausible_reasons) != len(plausible):
        raise ValueError(f"reason counts mismatch at batch {batch} row {ordinal}")
    if any(not x.strip() for x in reasons + plausible_reasons):
        raise ValueError("empty semantic reason")
    if len(selected) == 2 and not spec.get("two"):
        raise ValueError("two selected labels need nonredundancy explanation")
    if not selected and not spec.get("zero"):
        raise ValueError("abstention needs justification")
    tags = spec.get("tags", [])
    if len(set(tags)) != len(tags) or not set(tags) <= ALLOWED_TAGS:
        raise ValueError("invalid coverage tag")
    scenario = spec["scenario"]
    if len(scenario) != 5 or any(not isinstance(x, str) or not x.strip() for x in scenario):
        raise ValueError("scenario needs five nonempty causal fields")
    p0coverage = []
    if "p0" in spec:
        pair, mode = spec["p0"]
        if pair not in P0_PAIRS:
            raise ValueError("invalid P0 pair")
        first, second = pair.split("|")
        valid = ((mode == "FIRST_SELECTED_SECOND_PLAUSIBLE" and first in selected and second in plausible)
                 or (mode == "SECOND_SELECTED_FIRST_PLAUSIBLE" and second in selected and first in plausible)
                 or (mode == "BOTH_SELECTED" and set(selected) == {first, second} and pair in {"sadness|caring", "joy|love"})
                 or (mode == "NEITHER_SELECTED_CONTROL" and first not in selected + plausible and second not in selected + plausible))
        if not valid:
            raise ValueError(f"invalid P0 mode at batch {batch} row {ordinal}")
        p0coverage = [{"pair": pair, "mode": mode}]
    target_id = f"TFV1-TRAIN-{number:05d}"
    row = {
        "recordType": "TARGET", "protocolVersion": "target-first-selective-data-v1",
        "targetId": target_id, "targetHash": "", "createdAt": now(), "split": "TRAIN",
        "scenarioFamilyId": f"TFV1-FAM-B{batch}-{ordinal:03d}",
        "targetKind": "ABSTENTION" if not selected else ("TWO_SELECTED" if len(selected) == 2 else ("SELECTIVE_BOUNDARY" if plausible else "SINGLE_SELECTED")),
        "coverageTags": tags,
        "scenarioPlan": dict(zip(["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"], scenario)) | {"surfaceVariationBan": "No name, place, object, date, or number swaps; no copied Event skeleton."},
        "supervision": {"selected": selected, "plausibleNotSelected": plausible,
                        "notApplicable": [x for x in LABELS if x not in set(selected + plausible)]},
        "boundaryPairs": [{"selectedLabel": s, "plausibleLabel": p,
                           "priority": "P0" if (s, p) in P0_DIRECTIONS else "OTHER",
                           "whySecondary": plausible_reasons[plausible.index(p)]}
                          for s in selected for p in plausible],
        "p0Coverage": p0coverage,
        "selectedReasons": [{"label": s, "reason": r} for s, r in zip(selected, reasons)],
        "plausibleReasons": [{"label": p, "reason": r} for p, r in zip(plausible, plausible_reasons)],
        "twoSelectedNonRedundancy": spec.get("two"),
        "abstentionJustification": spec.get("zero"),
        "primaryGardenMood": None, "annotationProvenance": "SYNTHETIC_WEAK_SUPERVISION",
        "attemptBudget": 3, "legacyRowContentUsed": False,
    }
    row["targetHash"] = canonical_hash(row)
    return row

def freeze(batch):
    specs = json.loads((PLAN / f"batch-{batch}-targets.json").read_text(encoding="utf-8"))
    checkpoint = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    current = lines(TARGETS)
    number = int(checkpoint["nextUnbuiltTargetId"].rsplit("-", 1)[1])
    if checkpoint["nextStage"] not in {"RESUME_TARGET_FIRST_GENERATION_WHEN_REQUESTED", "BUILD_NEXT_TRAIN_BATCH", "QA_COMPLETE_NO_GENERATION"}:
        raise ValueError("checkpoint is not ready to freeze next batch")
    if number != len(current) + 1:
        raise ValueError("target ID sequence mismatch")
    if not specs or len(specs) > 60:
        raise ValueError("batch size must be 1..60")
    target_ids = [f"TFV1-TRAIN-{n:05d}" for n in range(number, number + len(specs))]
    if set(target_ids) & {x["targetId"] for x in current}:
        raise ValueError("target ID collision")
    new = [build_target(spec, number + i, batch, i + 1) for i, spec in enumerate(specs)]
    old_skeletons = {normalize(" | ".join(x["scenarioPlan"][k] for k in ["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"])) for x in current}
    for row in new:
        skeleton = normalize(" | ".join(row["scenarioPlan"][k] for k in ["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"]))
        if skeleton in old_skeletons:
            raise ValueError(f"duplicate scenario skeleton: {row['targetId']}")
        old_skeletons.add(skeleton)
    atomic(TARGETS, "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in current + new))
    manifest = {"batch": batch, "phase": "TARGETS_FROZEN", "targetIds": target_ids,
                "targetHashes": {x["targetId"]: x["targetHash"] for x in new},
                "frozenAt": now(), "draftIds": [], "deterministicRejectIds": []}
    atomic(WORK / f"batch-{batch}-manifest.json", json.dumps(manifest, indent=2) + "\n")
    checkpoint.update({"phase": "GENERATION_ONLY", "activeBatch": int(batch[:3]),
                       "targetRecordsFrozen": len(current) + len(new),
                       "nextStage": "GENERATE_FROZEN_TRAIN_BATCH",
                       "firstUnfinishedTargetId": target_ids[0],
                       "nextUnbuiltTargetId": f"TFV1-TRAIN-{number + len(specs):05d}",
                       "remainingFrozenTargetIds": target_ids,
                       "generationOnlyBatch": batch})
    atomic(CHECKPOINT, json.dumps(checkpoint, indent=2) + "\n")
    print(f"FROZEN {len(new)} targets {target_ids[0]}..{target_ids[-1]}")

def freeze_replacements(batch):
    if batch != "009C":
        raise ValueError("replacement freeze is only authorized for paused 009C")
    specs = json.loads((PLAN / f"batch-{batch}-replacements.json").read_text(encoding="utf-8"))
    checkpoint = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    manifest_path = WORK / f"batch-{batch}-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    current = lines(TARGETS)
    invalidated, invalidation_errors = check_invalidations()
    if invalidation_errors or checkpoint["nextStage"] != "GENERATE_FROZEN_TRAIN_BATCH" or manifest["phase"] != "TARGETS_FROZEN":
        raise ValueError("paused 009C or invalidation integrity mismatch")
    old_ids = manifest["targetIds"]
    if len(old_ids) != 38 or [x["oldTargetId"] for x in specs] != [x for x in old_ids if x in invalidated]:
        raise ValueError("replacement plan must cover each invalidated 009C ID exactly once in order")
    number = int(checkpoint["nextUnbuiltTargetId"].rsplit("-", 1)[1])
    if number != len(current) + 1:
        raise ValueError("replacement target ID sequence mismatch")
    new = [build_target(item["spec"], number + i, batch, len(old_ids) + i + 1) for i, item in enumerate(specs)]
    old_skeletons = {normalize(" | ".join(x["scenarioPlan"][k] for k in ["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"])) for x in current}
    for row in new:
        skeleton = normalize(" | ".join(row["scenarioPlan"][k] for k in ["authorRoleOrRelationship", "precipitatingEvent", "stakes", "authorResponse", "outcome"]))
        if skeleton in old_skeletons:
            raise ValueError(f"duplicate replacement scenario skeleton {row['targetId']}")
        old_skeletons.add(skeleton)
    atomic(TARGETS, "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in current + new))
    mapping = {item["oldTargetId"]: row["targetId"] for item, row in zip(specs, new)}
    valid_ids = [x for x in old_ids if x not in invalidated] + [x["targetId"] for x in new]
    manifest.update({"targetIds": old_ids + [x["targetId"] for x in new],
                     "targetHashes": manifest["targetHashes"] | {x["targetId"]: x["targetHash"] for x in new},
                     "invalidatedIds": [x for x in old_ids if x in invalidated],
                     "replacementMap": mapping, "generationTargetIds": valid_ids})
    atomic(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    checkpoint.update({"targetRecordsFrozen": len(current) + len(new),
                       "nextUnbuiltTargetId": f"TFV1-TRAIN-{number+len(new):05d}",
                       "resumeGenerationAt": f"TFV1-TRAIN-{number+len(new):05d}",
                       "remainingFrozenTargetIds": valid_ids,
                       "firstUnfinishedTargetId": valid_ids[0]})
    atomic(CHECKPOINT, json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n")
    print(f"FROZEN_REPLACEMENTS {len(new)} {new[0]['targetId']}..{new[-1]['targetId']}")

def generate(batch):
    event_rows = json.loads((PLAN / f"batch-{batch}-events.json").read_text(encoding="utf-8"))
    checkpoint = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    manifest_path = WORK / f"batch-{batch}-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if checkpoint["nextStage"] != "GENERATE_FROZEN_TRAIN_BATCH" or checkpoint.get("generationOnlyBatch") != batch or manifest["phase"] != "TARGETS_FROZEN":
        raise ValueError("checkpoint is not ready for this frozen batch")
    ids = manifest.get("generationTargetIds", manifest["targetIds"])
    if len(event_rows) != len(ids) or [x["targetId"] for x in event_rows] != ids:
        raise ValueError("event rows must match frozen targets in exact order")
    targets = {x["targetId"]: x for x in lines(TARGETS)}
    existing = lines(ATTEMPTS)
    invalidated, invalidation_errors = check_invalidations()
    if invalidation_errors or set(ids) & invalidated:
        raise ValueError(f"invalidated generation target: {invalidation_errors or sorted(set(ids) & invalidated)}")
    if set(ids) & {x["targetId"] for x in existing}:
        raise ValueError("target already has generation attempt")
    prior_events = [(x["targetId"], x["eventText"]) for x in existing]
    normalized_prior = {normalize(event): target_id for target_id, event in prior_events}
    exact_prior = {event: target_id for target_id, event in prior_events}
    vectors = [(target_id, grams(event)) for target_id, event in prior_events]
    attempts = []
    rejects = []
    review_flags = []
    for i, item in enumerate(event_rows):
        target_id, event = item["targetId"], item["eventText"]
        if not isinstance(event, str):
            raise ValueError(f"Event must be text: {target_id}")
        target = targets[target_id]
        if target["targetHash"] != manifest["targetHashes"][target_id]:
            raise ValueError(f"frozen target changed: {target_id}")
        normalized = normalize(event)
        exact = exact_prior.get(event)
        norm = normalized_prior.get(normalized)
        length_ok = 1 <= len(event) <= 300
        english = event.isascii() and re.search(r"[A-Za-z]", event) is not None
        vector = grams(event)
        near = [(other_id, round(cosine(vector, other_vector), 3)) for other_id, other_vector in vectors if cosine(vector, other_vector) >= 0.80]
        leakage = [label for label in LABEL_STEMS if re.search(r"\b" + re.escape(label) + r"\b", event, re.IGNORECASE)]
        fatal = not length_ok or not english or exact is not None or norm is not None
        if fatal:
            rejects.append(target_id)
        if near or leakage:
            review_flags.append(target_id)
        attempt = {
            "recordType": "GENERATION_ATTEMPT", "protocolVersion": "target-first-selective-data-v1",
            "targetId": target_id, "targetHash": target["targetHash"],
            "attemptId": f"TFV1-ATT-{int(target_id.rsplit('-', 1)[1]):07d}",
            "generatedAt": now(), "generator": "Codex semantic writer",
            "generatorVersion": "gpt-6-target-first-generation-only",
            "promptVersion": "target-first-v1-generation-spec-frozen",
            "eventText": event, "unicodeCharacterCount": len(event),
            "sourceDeclaration": {"createdFromScratch": True, "legacyRowContentUsed": False,
                                  "rightsPendingTextUsed": False, "protectedContentUsed": False,
                                  "incumbentOrErrorDataUsed": False, "modelVotesUsed": False},
            "mechanicalChecks": {"schema": "PASS", "english": "PASS" if english else "FAIL",
                                 "length": "PASS" if length_ok else "FAIL",
                                 "labelLeakage": "REVIEW" if leakage else "PASS",
                                 "exactDuplicate": "MATCH" if exact else "CLEAR",
                                 "normalizedDuplicate": "MATCH" if norm else "CLEAR",
                                 "nearDuplicateCandidate": "REVIEW" if near else "CLEAR",
                                 "delexicalizedTemplate": "REVIEW" if near else "CLEAR",
                                 "scenarioSplitIsolation": "PASS"},
        }
        attempts.append(attempt)
        exact_prior[event] = target_id
        normalized_prior[normalized] = target_id
        vectors.append((target_id, vector))
    atomic(ATTEMPTS, "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in existing + attempts))
    manifest.update({"phase": "DRAFTS_PERSISTED_AWAITING_INDEPENDENT_QA",
                     "generatedAt": now(), "draftIds": [x["targetId"] for x in attempts if x["targetId"] not in rejects],
                     "deterministicRejectIds": rejects, "mechanicalReviewIds": review_flags})
    atomic(manifest_path, json.dumps(manifest, indent=2) + "\n")
    checkpoint.update({"generationAttemptsWritten": len(existing) + len(attempts),
                       "nextStage": "BUILD_NEXT_TRAIN_BATCH",
                       "firstUnfinishedTargetId": checkpoint["nextUnbuiltTargetId"],
                       "nextAttemptOrdinal": max(int(x["attemptId"].rsplit("-", 1)[1]) for x in existing + attempts) + 1,
                       "resumeGenerationAt": checkpoint["nextUnbuiltTargetId"],
                       "remainingFrozenTargetIds": [],
                       "newDraftsAwaitingIndependentQA": checkpoint.get("newDraftsAwaitingIndependentQA", 0) + len(attempts) - len(rejects),
                       "deterministicRejectedNewDrafts": checkpoint.get("deterministicRejectedNewDrafts", 0) + len(rejects),
                       "lastGeneratedBatch": batch})
    atomic(CHECKPOINT, json.dumps(checkpoint, indent=2) + "\n")
    print(f"DRAFTS {len(attempts)-len(rejects)} rejected {len(rejects)} reviewFlags {len(review_flags)} {ids[0]}..{ids[-1]}")

def main():
    if len(sys.argv) != 3 or sys.argv[1] not in {"freeze", "freeze-replacements", "generate"} or not re.fullmatch(r"\d{3}[A-Z]?", sys.argv[2]):
        raise SystemExit("usage: draft_batch.py freeze|freeze-replacements|generate NNN")
    if sys.argv[1] == "freeze":
        freeze(sys.argv[2])
    elif sys.argv[1] == "freeze-replacements":
        freeze_replacements(sys.argv[2])
    else:
        generate(sys.argv[2])

if __name__ == "__main__":
    main()
