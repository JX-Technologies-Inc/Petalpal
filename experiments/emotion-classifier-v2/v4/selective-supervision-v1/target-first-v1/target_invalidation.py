"""Append-only target invalidation integrity for target-first-v1."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
INVALIDATIONS = WORK / "target-invalidations.jsonl"
TERMINAL_STAGE = "POST_GENERATION_TERMINAL"
TERMINAL_REASON = "TARGET_CONSTRAINT_CONFLICT"
TERMINAL_EVIDENCE = WORK / "dev-exhausted-target-feasibility.json"


def rows(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def coverage_role(target):
    """Fields a one-for-one replacement must preserve exactly."""
    return {key: target.get(key) for key in (
        "split", "targetKind", "coverageTags", "supervision", "boundaryPairs", "p0Coverage"
    )}


def _terminal_eligible_ids():
    if not TERMINAL_EVIDENCE.exists():
        return set()
    evidence = json.loads(TERMINAL_EVIDENCE.read_text(encoding="utf-8"))
    return {
        item.get("targetId") for item in evidence.get("results", [])
        if item.get("decision") == TERMINAL_REASON
    }


def invalidation_state(targets=None, attempts=None, qa=None, accepted=None):
    targets = rows(WORK / "targets.jsonl") if targets is None else targets
    attempts = rows(WORK / "generation-attempts.jsonl") if attempts is None else attempts
    qa = rows(WORK / "qa-results.jsonl") if qa is None else qa
    accepted = rows(ROOT / "accepted/train.jsonl") if accepted is None else accepted
    target_by_id = {x["targetId"]: x for x in targets}
    attempted = {x["targetId"] for x in attempts}
    reviewed = {x["targetId"] for x in qa}
    admitted = {x["rowId"] for x in accepted}
    invalidated = set()
    terminal = set()
    replacement_ids = set()
    errors = []
    for record in rows(INVALIDATIONS):
        tid = record.get("targetId")
        if tid not in target_by_id:
            errors.append(f"invalidation references missing target {tid}")
        if tid in invalidated:
            errors.append(f"duplicate invalidation {tid}")
        invalidated.add(tid)
        if record.get("recordType") != "TARGET_INVALIDATION":
            errors.append(f"invalid invalidation record {tid}")
        elif record.get("stage") == "PRE_GENERATION":
            if record.get("reasonCode") != "SCENARIO_SKELETON_OVERLAP":
                errors.append(f"invalid invalidation record {tid}")
            if tid in attempted or tid in reviewed or tid in admitted:
                errors.append(f"invalidated target already generated/reviewed/admitted {tid}")
            conflicts = record.get("conflictsWith")
            if not isinstance(conflicts, list) or not conflicts or len(set(conflicts)) != len(conflicts):
                errors.append(f"invalid conflict list {tid}")
                continue
            target_index = targets.index(target_by_id[tid]) if tid in target_by_id else -1
            for prior in conflicts:
                if prior not in target_by_id or targets.index(target_by_id[prior]) >= target_index:
                    errors.append(f"nonhistorical/missing conflict {tid} {prior}")
        elif record.get("stage") == TERMINAL_STAGE:
            terminal.add(tid)
            replacement_id = record.get("replacementTargetId")
            if (record.get("reasonCode") != TERMINAL_REASON
                    or record.get("targetHash") != target_by_id.get(tid, {}).get("targetHash")
                    or record.get("evidenceArtifact") != "dev-exhausted-target-feasibility.json"
                    or tid not in _terminal_eligible_ids()
                    or tid not in attempted or tid in admitted
                    or not isinstance(replacement_id, str)
                    or not re.fullmatch(r"TFV1-(TRAIN|DEV|FINAL_TEST)-\d{5}", replacement_id)
                    or replacement_id in replacement_ids
                    or replacement_id == tid):
                errors.append(f"invalid terminal invalidation {tid}")
            replacement_ids.add(replacement_id)
            replacement = target_by_id.get(replacement_id)
            if replacement is not None:
                original = target_by_id.get(tid, {})
                if (coverage_role(replacement) != coverage_role(original)
                        or replacement.get("scenarioFamilyId") == original.get("scenarioFamilyId")
                        or sum(x.get("scenarioFamilyId") == replacement.get("scenarioFamilyId") for x in targets) != 1
                        or targets.index(replacement) <= targets.index(original)):
                    errors.append(f"invalid terminal replacement {tid} {replacement_id}")
        else:
            errors.append(f"invalid invalidation record {tid}")
        if not record.get("note") or not record.get("source"):
            errors.append(f"missing invalidation provenance {tid}")
    return invalidated, terminal, errors


def check_invalidations(targets=None, attempts=None, qa=None, accepted=None):
    invalidated, _, errors = invalidation_state(targets, attempts, qa, accepted)
    return invalidated, errors


def append_invalidations(records):
    targets = rows(WORK / "targets.jsonl")
    attempts = rows(WORK / "generation-attempts.jsonl")
    qa = rows(WORK / "qa-results.jsonl")
    accepted = rows(ROOT / "accepted/train.jsonl")
    existing, _, errors = invalidation_state(targets, attempts, qa, accepted)
    target_ids = {x["targetId"] for x in targets}
    attempted = {x["targetId"] for x in attempts}
    reviewed = {x["targetId"] for x in qa}
    admitted = {x["rowId"] for x in accepted}
    seen = set(existing)
    reserved_replacements = {
        record.get("replacementTargetId") for record in rows(INVALIDATIONS)
        if record.get("stage") == TERMINAL_STAGE
    }
    for record in records:
        tid = record["targetId"]
        terminal = record.get("stage") == TERMINAL_STAGE
        if tid not in target_ids or tid in seen or tid in admitted or (not terminal and (tid in attempted or tid in reviewed)):
            errors.append(f"cannot invalidate target {tid}")
        seen.add(tid)
        if terminal:
            replacement_id = record.get("replacementTargetId")
            if (record.get("recordType") != "TARGET_INVALIDATION"
                    or record.get("reasonCode") != TERMINAL_REASON
                    or tid not in _terminal_eligible_ids()
                    or tid not in attempted
                    or record.get("targetHash") != next((x["targetHash"] for x in targets if x["targetId"] == tid), None)
                    or record.get("evidenceArtifact") != "dev-exhausted-target-feasibility.json"
                    or not replacement_id or replacement_id in reserved_replacements):
                errors.append(f"invalid terminal record fields {tid}")
            reserved_replacements.add(replacement_id)
        else:
            if record.get("recordType") != "TARGET_INVALIDATION" or record.get("stage") != "PRE_GENERATION" or record.get("reasonCode") != "SCENARIO_SKELETON_OVERLAP":
                errors.append(f"invalid record fields {tid}")
            conflicts = record.get("conflictsWith", [])
            if not conflicts or any(prior not in target_ids or int(prior.rsplit("-", 1)[1]) >= int(tid.rsplit("-", 1)[1]) for prior in conflicts):
                errors.append(f"invalid historical conflicts {tid}")
        if not record.get("note") or not record.get("source"):
            errors.append(f"missing provenance {tid}")
    if errors:
        raise ValueError("; ".join(errors))
    with INVALIDATIONS.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return seen
