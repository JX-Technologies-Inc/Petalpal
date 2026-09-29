#!/usr/bin/env python3
"""Deterministically validate and materialize the current accepted checkpoint."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path
from target_invalidation import check_invalidations, invalidation_state


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
ACCEPTED = ROOT / "accepted"
LABELS = ["admiration", "amusement", "anger", "annoyance", "caring", "confusion", "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude", "joy", "love", "optimism", "remorse", "sadness", "surprise"]
CLUSTERS = {
    "UPBEAT": {"joy", "amusement", "excitement", "optimism"},
    "WARM_SOCIAL": {"gratitude", "love", "caring", "admiration"},
    "REFLECTIVE": {"sadness", "disappointment", "remorse"},
    "THREAT_INTENSITY": {"anger", "annoyance", "fear", "disgust"},
    "EXPLORATION": {"curiosity", "confusion", "surprise"},
}
CLUSTER_BY_LABEL = {label: cluster for cluster, labels in CLUSTERS.items() for label in labels}
P0 = {
    ("sadness", "caring"), ("caring", "sadness"), ("caring", "love"), ("love", "caring"),
    ("joy", "optimism"), ("optimism", "joy"), ("joy", "excitement"), ("excitement", "joy"),
    ("caring", "gratitude"), ("gratitude", "caring"), ("joy", "love"), ("love", "joy"),
    ("fear", "annoyance"), ("annoyance", "fear"),
}


def rows(path):
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x]


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def target_hash(row):
    material = {k: v for k, v in row.items() if k != "targetHash"}
    return hashlib.sha256(json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def normalize(text):
    text = unicodedata.normalize("NFKC", text).lower()
    text = text.translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-"}))
    return " ".join(text.split())


def grams(text):
    text = normalize(text)
    return Counter(text[i:i+n] for n in (3, 4, 5) for i in range(max(0, len(text)-n+1)))


def cosine(a, b):
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    aa = sum(v * v for v in a.values())
    bb = sum(v * v for v in b.values())
    return dot / math.sqrt(aa * bb) if aa and bb else 0.0


def attempt_lifecycle_errors(target_by_id, attempts, qa_results):
    """Validate same-target append-only retry budgets and single-PASS admission."""
    errors = []
    exception_allowance = Counter()
    exception_path = WORK / "dev-exhausted-recovery-exception.json"
    if exception_path.exists():
        exception = json.loads(exception_path.read_text(encoding="utf-8"))
        listed = exception.get("attempts", [])
        ids = [item.get("targetId") for item in listed]
        feasibility_path = WORK / "dev-exhausted-target-feasibility.json"
        feasibility = json.loads(feasibility_path.read_text(encoding="utf-8")) if feasibility_path.exists() else {}
        authorized_ids = {
            item.get("targetId") for item in feasibility.get("results", [])
            if item.get("decision") == "REALIZABLE"
        }
        if (exception.get("exceptionType") != "ONE_TIME_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("authorizedTargetCount") != 68
                or len(listed) != 68 or len(ids) != len(set(ids))
                or set(ids) != set(exception.get("authorizedTargetIds", []))
                or set(ids) != authorized_ids
                or set(ids) & set(exception.get("excludedConstraintConflictTargetIds", []))):
            errors.append("invalid exhausted-recovery exception record")
        else:
            attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
            for item in listed:
                attempt = attempt_by_id.get(item.get("attemptId"))
                target = target_by_id.get(item.get("targetId"))
                if (not attempt or not target
                        or attempt.get("targetId") != item.get("targetId")
                        or attempt.get("targetHash") != item.get("targetHash")
                        or target.get("targetHash") != item.get("targetHash")
                        or attempt.get("generatorVersion") != "gpt-5-target-first-dev-exhausted-recovery-exception-001"):
                    errors.append(f"invalid exhausted-recovery attempt {item.get('attemptId')}")
                else:
                    exception_allowance[item["targetId"]] = 1
    final_exception_path = WORK / "dev-final-hard-case-recovery-exception.json"
    if final_exception_path.exists():
        exception = json.loads(final_exception_path.read_text(encoding="utf-8"))
        listed = exception.get("attempts", [])
        ids = [item.get("targetId") for item in listed]
        expected_ids = {
            "TFV1-DEV-00011", "TFV1-DEV-00142", "TFV1-DEV-00162",
            "TFV1-DEV-00193", "TFV1-DEV-00202", "TFV1-DEV-00237",
        }
        if (exception.get("exceptionType") != "FINAL_HARD_CASE_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("authorizedTargetCount") != 6
                or len(listed) != 6 or set(ids) != expected_ids
                or set(ids) != set(exception.get("authorizedTargetIds", []))
                or set(ids) & set(exception.get("excludedConstraintConflictTargetIds", []))):
            errors.append("invalid final hard-case recovery exception record")
        else:
            attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
            for item in listed:
                attempt = attempt_by_id.get(item.get("attemptId"))
                target = target_by_id.get(item.get("targetId"))
                if (not attempt or not target
                        or attempt.get("targetId") != item.get("targetId")
                        or attempt.get("targetHash") != item.get("targetHash")
                        or target.get("targetHash") != item.get("targetHash")
                        or attempt.get("generatorVersion") != "gpt-5-target-first-dev-final-hard-case-exception-001"):
                    errors.append(f"invalid final hard-case recovery attempt {item.get('attemptId')}")
                else:
                    exception_allowance[item["targetId"]] += 1
    target_00142_exception_path = WORK / "dev-00142-final-recovery-exception.json"
    if target_00142_exception_path.exists():
        exception = json.loads(target_00142_exception_path.read_text(encoding="utf-8"))
        item = exception.get("attempt", {})
        attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
        attempt = attempt_by_id.get(item.get("attemptId"))
        target = target_by_id.get(item.get("targetId"))
        if (exception.get("exceptionType") != "FINAL_00142_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("scopeTargetId") != "TFV1-DEV-00142"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("attemptsAppended") != 1
                or item.get("targetId") != "TFV1-DEV-00142"
                or "TFV1-DEV-00284" not in exception.get("excludedConstraintConflictTargetIds", [])
                or "TFV1-DEV-00285" not in exception.get("excludedConstraintConflictTargetIds", [])
                or not attempt or not target
                or attempt.get("targetId") != item.get("targetId")
                or attempt.get("targetHash") != item.get("targetHash")
                or target.get("targetHash") != item.get("targetHash")
                or attempt.get("generatorVersion") != "gpt-5-target-first-dev-00142-final-recovery-001"):
            errors.append("invalid TFV1-DEV-00142 final recovery exception record")
        else:
            exception_allowance["TFV1-DEV-00142"] += 1
    final_data_quality_exception_path = WORK / "final-exhausted-recovery-exception.json"
    if final_data_quality_exception_path.exists():
        exception = json.loads(final_data_quality_exception_path.read_text(encoding="utf-8"))
        listed = exception.get("attempts", [])
        ids = [item.get("targetId") for item in listed]
        feasibility_path = WORK / "final-exhausted-target-feasibility.json"
        feasibility = json.loads(feasibility_path.read_text(encoding="utf-8")) if feasibility_path.exists() else {}
        authorized_ids = {
            item.get("targetId") for item in feasibility.get("results", [])
            if item.get("classification") == "REALIZABLE"
        }
        if (exception.get("exceptionType") != "ONE_TIME_FINAL_DATA_QUALITY_ADDITIONAL_ATTEMPT"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("authorizedTargetCount") != 25
                or len(listed) != 25 or len(ids) != len(set(ids))
                or set(ids) != set(exception.get("authorizedTargetIds", []))
                or set(ids) != authorized_ids
                or "TFV1-FINAL_TEST-00047" in set(ids)):
            errors.append("invalid Final exhausted-recovery exception record")
        else:
            attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
            for item in listed:
                attempt = attempt_by_id.get(item.get("attemptId"))
                target = target_by_id.get(item.get("targetId"))
                if (not attempt or not target
                        or attempt.get("targetId") != item.get("targetId")
                        or attempt.get("targetHash") != item.get("targetHash")
                        or target.get("targetHash") != item.get("targetHash")
                        or attempt.get("generatorVersion") != "gpt-5-target-first-final-exhausted-recovery-exception-001"):
                    errors.append(f"invalid Final exhausted-recovery attempt {item.get('attemptId')}")
                else:
                    exception_allowance[item["targetId"]] += 1
    final_last6_exception_path = WORK / "final-last-6-recovery-exception.json"
    if final_last6_exception_path.exists():
        exception = json.loads(final_last6_exception_path.read_text(encoding="utf-8"))
        listed = exception.get("attempts", [])
        ids = [item.get("targetId") for item in listed]
        expected_ids = {
            "TFV1-FINAL_TEST-00047", "TFV1-FINAL_TEST-00096",
            "TFV1-FINAL_TEST-00137", "TFV1-FINAL_TEST-00186",
            "TFV1-FINAL_TEST-00224", "TFV1-FINAL_TEST-00282",
        }
        if (exception.get("exceptionType") != "FINAL_LAST_6_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("authorizedTargetCount") != 6
                or len(listed) != 6 or len(ids) != len(set(ids))
                or set(ids) != expected_ids
                or set(ids) != set(exception.get("authorizedTargetIds", []))):
            errors.append("invalid Final last-6 recovery exception record")
        else:
            attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
            for item in listed:
                attempt = attempt_by_id.get(item.get("attemptId"))
                target = target_by_id.get(item.get("targetId"))
                if (not attempt or not target
                        or attempt.get("targetId") != item.get("targetId")
                        or attempt.get("targetHash") != item.get("targetHash")
                        or target.get("targetHash") != item.get("targetHash")
                        or attempt.get("generatorVersion") != "gpt-5-target-first-final-last-6-recovery-001"):
                    errors.append(f"invalid Final last-6 recovery attempt {item.get('attemptId')}")
                else:
                    exception_allowance[item["targetId"]] += 1
    final_last3_exception_path = WORK / "final-last-3-recovery-exception.json"
    if final_last3_exception_path.exists():
        exception = json.loads(final_last3_exception_path.read_text(encoding="utf-8"))
        listed = exception.get("attempts", [])
        ids = [item.get("targetId") for item in listed]
        expected_ids = {
            "TFV1-FINAL_TEST-00047",
            "TFV1-FINAL_TEST-00137",
            "TFV1-FINAL_TEST-00224",
        }
        if (exception.get("exceptionType") != "FINAL_LAST_3_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("authorizedTargetCount") != 3
                or len(listed) != 3 or len(ids) != len(set(ids))
                or set(ids) != expected_ids
                or set(ids) != set(exception.get("authorizedTargetIds", []))):
            errors.append("invalid Final last-3 recovery exception record")
        else:
            attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
            for item in listed:
                attempt = attempt_by_id.get(item.get("attemptId"))
                target = target_by_id.get(item.get("targetId"))
                if (not attempt or not target
                        or attempt.get("targetId") != item.get("targetId")
                        or attempt.get("targetHash") != item.get("targetHash")
                        or target.get("targetHash") != item.get("targetHash")
                        or attempt.get("generatorVersion") != "gpt-5-target-first-final-last-3-recovery-001"):
                    errors.append(f"invalid Final last-3 recovery attempt {item.get('attemptId')}")
                else:
                    exception_allowance[item["targetId"]] += 1
    final_last1_exception_path = WORK / "final-last-1-recovery-exception.json"
    if final_last1_exception_path.exists():
        exception = json.loads(final_last1_exception_path.read_text(encoding="utf-8"))
        item = exception.get("attempt", {})
        attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
        attempt = attempt_by_id.get(item.get("attemptId"))
        target = target_by_id.get(item.get("targetId"))
        if (exception.get("exceptionType") != "FINAL_00137_SINGLE_ADDITIONAL_ATTEMPT"
                or exception.get("scopeTargetId") != "TFV1-FINAL_TEST-00137"
                or exception.get("normalAttemptBudgetModified") is not False
                or exception.get("furtherRetryAuthorized") is not False
                or exception.get("attemptsAppended") != 1
                or item.get("targetId") != "TFV1-FINAL_TEST-00137"
                or not attempt or not target
                or attempt.get("targetId") != item.get("targetId")
                or attempt.get("targetHash") != item.get("targetHash")
                or target.get("targetHash") != item.get("targetHash")
                or attempt.get("generatorVersion") != "gpt-5-target-first-final-00137-last-recovery-001"):
            errors.append("invalid Final 00137 recovery exception record")
        else:
            exception_allowance["TFV1-FINAL_TEST-00137"] += 1
    attempts_by_target = Counter(
        attempt["targetId"] for attempt in attempts if attempt.get("targetId") in target_by_id
    )
    for target_id, count in sorted(attempts_by_target.items()):
        budget = target_by_id[target_id]["attemptBudget"] + exception_allowance[target_id]
        if count > budget:
            errors.append(f"attempt budget exceeded {target_id}: {count}>{budget}")

    passing_by_target = Counter(
        result["targetId"] for result in qa_results
        if result.get("decision") == "PASS" and result.get("targetId") in target_by_id
    )
    for target_id, count in sorted(passing_by_target.items()):
        if count > 1:
            errors.append(f"multiple passing attempts for target {target_id}: {count}")
    return errors


def main():
    targets = rows(WORK / "targets.jsonl")
    attempts = rows(WORK / "generation-attempts.jsonl")
    qa = rows(WORK / "qa-results.jsonl")
    checkpoint = json.loads((WORK / "checkpoint.json").read_text())
    errors = []
    existing_accepted = [
        row for split_file in ("train.jsonl", "dev.jsonl", "final-test.locked.jsonl")
        for row in rows(ACCEPTED / split_file)
    ]
    invalidated, terminal_invalidated, invalidation_errors = invalidation_state(
        targets, attempts, qa, existing_accepted
    )
    errors.extend(invalidation_errors)

    target_by_id = {}
    for target in targets:
        tid = target["targetId"]
        if tid in target_by_id:
            errors.append(f"duplicate targetId {tid}")
        target_by_id[tid] = target
        if target_hash(target) != target["targetHash"]:
            errors.append(f"target hash mismatch {tid}")
        sup = target["supervision"]
        parts = [set(sup[k]) for k in ("selected", "plausibleNotSelected", "notApplicable")]
        if any(parts[i] & parts[j] for i in range(3) for j in range(i)) or set.union(*parts) != set(LABELS):
            errors.append(f"invalid state partition {tid}")
        if len(sup["selected"]) > 2:
            errors.append(f"too many selected {tid}")
        clusters = [CLUSTER_BY_LABEL[x] for x in sup["selected"]]
        if len(clusters) != len(set(clusters)):
            errors.append(f"selected cluster collision {tid}")
        expected = {(s, p) for s in sup["selected"] for p in sup["plausibleNotSelected"]}
        actual = {(p["selectedLabel"], p["plausibleLabel"]) for p in target["boundaryPairs"]}
        if expected != actual:
            errors.append(f"boundary product mismatch {tid}")

    attempt_by_id = {}
    previous_attempt_ordinal = 0
    for attempt in attempts:
        aid = attempt["attemptId"]
        match = re.fullmatch(r"TFV1-ATT-(\d{7})", aid)
        if not match:
            errors.append(f"invalid attemptId {aid}")
        else:
            ordinal = int(match.group(1))
            if ordinal <= previous_attempt_ordinal:
                errors.append(f"non-append-only attempt order {aid}")
            previous_attempt_ordinal = ordinal
        if attempt["targetId"] in invalidated and attempt["targetId"] not in terminal_invalidated:
            errors.append(f"attempt for invalidated target {aid}")
        if aid in attempt_by_id:
            errors.append(f"duplicate attemptId {aid}")
        attempt_by_id[aid] = attempt
        target = target_by_id.get(attempt["targetId"])
        if not target or target["targetHash"] != attempt["targetHash"]:
            errors.append(f"orphan/hash-mismatched attempt {aid}")
        if len(attempt["eventText"]) != attempt["unicodeCharacterCount"] or len(attempt["eventText"]) > 300:
            errors.append(f"length mismatch {aid}")
        if not all(value is False for key, value in attempt["sourceDeclaration"].items() if key != "createdFromScratch") or attempt["sourceDeclaration"]["createdFromScratch"] is not True:
            errors.append(f"source declaration failure {aid}")

    qa_by_attempt = {}
    for result in qa:
        aid = result["attemptId"]
        if result["targetId"] in invalidated and result["targetId"] not in terminal_invalidated:
            errors.append(f"QA for invalidated target {aid}")
        if aid in qa_by_attempt:
            errors.append(f"duplicate QA result {aid}")
        qa_by_attempt[aid] = result
        attempt = attempt_by_id.get(aid)
        if not attempt or attempt["targetId"] != result["targetId"] or attempt["targetHash"] != result["targetHash"]:
            errors.append(f"orphan/hash-mismatched QA {aid}")
        if result["decision"] == "PASS":
            if result["targetId"] in terminal_invalidated:
                errors.append(f"PASS for terminally invalidated target {aid}")
            checks = [result[k] for k in ("selectedSupported", "plausibleSupportedAndSecondary", "notApplicableUnsupported", "selectionNaturalAndNonRedundant", "eventNaturalAndWithinLength")]
            if result["flags"] or any(x not in {"YES", "NOT_APPLICABLE"} for x in checks):
                errors.append(f"invalid QA PASS {aid}")

    errors.extend(attempt_lifecycle_errors(target_by_id, attempts, qa))

    candidate_audit_path = WORK / "dev-event-isolation-audit.json"
    if candidate_audit_path.exists():
        candidate_map = json.loads(candidate_audit_path.read_text(encoding="utf-8")).get("candidateAttemptByTarget", {})
        for target_id in sorted(terminal_invalidated & set(candidate_map)):
            errors.append(f"candidate selected for terminally invalidated target {target_id}")

    if checkpoint.get("generationAttemptsWritten") != len(attempts):
        errors.append("checkpoint generation-attempt count mismatch")
    if checkpoint.get("nextAttemptOrdinal") != previous_attempt_ordinal + 1:
        errors.append("checkpoint next-attempt ordinal mismatch")

    # The reviewer role string alone does not prove that a different reviewer
    # performed QA.  A separately produced reviewer manifest is required for
    # admission; until then QA=PASS rows remain provisional.
    review_manifest_path = WORK / "independent-qa-verification.json"
    if not review_manifest_path.exists():
        errors.append("independent QA reviewer evidence missing; QA PASS rows are provisional")
    else:
        review_manifest = json.loads(review_manifest_path.read_text(encoding="utf-8"))
        if review_manifest.get("status") != "VERIFIED" or set(review_manifest.get("reviewedAttemptIds", [])) != set(qa_by_attempt):
            errors.append("independent QA reviewer evidence incomplete or invalid")

    accepted = []
    accepted_target_ids = set()
    for aid, result in qa_by_attempt.items():
        if result["decision"] != "PASS":
            continue
        if result["targetId"] in invalidated:
            errors.append(f"admission for invalidated target {result['targetId']}")
            continue
        if result["targetId"] in accepted_target_ids:
            # attempt_lifecycle_errors records the deterministic validation
            # failure; never materialize a second accepted row for a target.
            continue
        accepted_target_ids.add(result["targetId"])
        attempt = attempt_by_id[aid]
        target = target_by_id[attempt["targetId"]]
        accepted.append({
            "rowId": target["targetId"],
            "targetHash": target["targetHash"],
            "attemptId": aid,
            "eventText": attempt["eventText"],
            "split": target["split"],
            "scenarioFamilyId": target["scenarioFamilyId"],
            "supervision": target["supervision"],
            "boundaryPairs": target["boundaryPairs"],
            "p0Coverage": target["p0Coverage"],
            "primaryGardenMood": None,
            "annotationProvenance": "SYNTHETIC_WEAK_SUPERVISION",
            "annotationMethod": "SEMANTIC_TARGET_THEN_GENERATE",
            "qa": {"decision": "PASS", "mayEditSupervision": False, "mayEditEvent": False},
        })
    accepted.sort(key=lambda x: x["rowId"])

    texts = [r["eventText"] for r in accepted]
    if len(texts) != len(set(texts)) or len(texts) != len(set(map(normalize, texts))):
        errors.append("accepted exact/normalized duplicate")
    vectors = [grams(x) for x in texts]
    for i in range(len(texts)):
        for j in range(i):
            if cosine(vectors[i], vectors[j]) >= 0.80:
                errors.append(f"accepted near duplicate {accepted[j]['rowId']} {accepted[i]['rowId']}")
    family_split = {}
    for row in accepted:
        old = family_split.setdefault(row["scenarioFamilyId"], row["split"])
        if old != row["split"]:
            errors.append(f"scenario family split leakage {row['scenarioFamilyId']}")

    by_split = {split: [r for r in accepted if r["split"] == split] for split in ("TRAIN", "DEV", "FINAL_TEST")}
    selected = Counter(x for r in accepted for x in r["supervision"]["selected"])
    cardinality = Counter(len(r["supervision"]["selected"]) for r in accepted)
    p0 = Counter()
    for row in accepted:
        for pair in row["boundaryPairs"]:
            key = (pair["selectedLabel"], pair["plausibleLabel"])
            if key in P0:
                p0[f"{key[0]}>{key[1]}"] += 1

    if checkpoint["accepted"] != {k: len(v) for k, v in by_split.items()}:
        errors.append("checkpoint accepted counts mismatch")
    if checkpoint["qaPass"] != sum(r["decision"] == "PASS" for r in qa) or checkpoint["qaReject"] != sum(r["decision"] == "REJECT" for r in qa) or checkpoint["qaFlag"] != sum(r["decision"] == "FLAG" for r in qa):
        errors.append("checkpoint QA counts mismatch")

    mechanical_errors = [error for error in errors if not error.startswith("independent QA")]
    report = {
        "status": "PASS" if not errors else "FAIL",
        "mechanicalValidation": "PASS" if not mechanical_errors else "FAIL",
        "qaIndependence": "VERIFIED" if not any(error.startswith("independent QA") for error in errors) else "NOT_VERIFIED",
        "admissionStatus": "ADMITTED" if not errors else "PROVISIONAL_NOT_FOR_TRAINING",
        "errors": errors,
        "targets": len(targets),
        "attempts": len(attempts),
        "qaResults": len(qa),
        "accepted": {k: len(v) for k, v in by_split.items()},
        "rejected": sum(r["decision"] == "REJECT" for r in qa),
        "flagged": sum(r["decision"] == "FLAG" for r in qa),
        "cardinality": {str(k): cardinality[k] for k in (0, 1, 2)},
        "selectedSupport": {label: selected[label] for label in LABELS},
        "p0DirectionalCoverage": {f"{a}>{b}": p0[f"{a}>{b}"] for a, b in sorted(P0)},
        "finalTestLock": checkpoint["finalTestLock"],
        "continuation": {"nextStage": checkpoint["nextStage"], "firstUnfinishedTargetId": checkpoint["firstUnfinishedTargetId"], "nextUnbuiltTargetId": checkpoint["nextUnbuiltTargetId"]},
    }
    if errors:
        atomic_write(WORK / "provisional-train.jsonl", "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in by_split["TRAIN"]))
    else:
        atomic_write(ACCEPTED / "train.jsonl", "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in by_split["TRAIN"]))
        atomic_write(ACCEPTED / "dev.jsonl", "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in by_split["DEV"]))
        atomic_write(ACCEPTED / "final-test.locked.jsonl", "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in by_split["FINAL_TEST"]))
    atomic_write(WORK / "validation-report.json", json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    atomic_write(WORK / "stats.json", json.dumps({k: v for k, v in report.items() if k not in {"errors", "continuation"}}, ensure_ascii=False, indent=2) + "\n")
    if errors:
        raise SystemExit("validation failed: " + "; ".join(errors))


if __name__ == "__main__":
    main()
