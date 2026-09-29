#!/usr/bin/env python3
"""Audit existing supervision and prepare a sealed blind model-panel queue.

No evaluation labels, errors, or probabilities are used. Protected text is loaded
only inside leakage checks and is never emitted.
"""

from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
BALANCED = ALIGNED / "decoupled-balanced-head-v1/candidate/checkpoint"
CANONICAL_TRAIN = ALIGNED / "train.jsonl"
GO_TRANCHE = ALIGNED / "public-source-shortlist-20260910/goemotions-targeted-tranche.jsonl"
GO_RAW = ALIGNED / "public-source-shortlist-20260910/goemotions-raw"
HIPPO = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl"
LINEAGE_REFERENCE = ALIGNED / "public-source-shortlist-20260910/lineage-reference.jsonl"
SEED = 20260917
PAIR_TARGET_PER_DIRECTION = 30
NO_CLEAR_CONTROL_TARGET = 10
TWO_LABEL_CONTROL_TARGET = 10

PAIRS = [
    ("sadness_caring", "sadness", "caring", "substitution sadness→caring observed 3 times", 1),
    ("caring_love", "caring", "love", "substitution caring→love observed 2 times", 2),
    ("joy_optimism", "joy", "optimism", "substitution joy→optimism observed 2 times", 3),
    ("joy_excitement", "joy", "excitement", "substitution excitement→joy observed 2 times", 4),
    ("caring_gratitude", "caring", "gratitude", "substitution caring→gratitude observed 2 times", 5),
    ("joy_love", "joy", "love", "substitution joy→love observed 2 times", 6),
    ("fear_annoyance", "fear", "annoyance", "substitution fear→annoyance observed 2 times", 7),
]

DEFINITIONS = {
    "admiration": "Approval or warm regard for another person or their qualities.",
    "amusement": "Finding something entertaining or funny.",
    "anger": "Strong displeasure or hostility toward a person or situation.",
    "annoyance": "Mild irritation or bother.",
    "caring": "Concern for and desire to support another person.",
    "confusion": "Uncertainty or lack of understanding.",
    "curiosity": "Desire to know or learn more.",
    "disappointment": "Sadness or dissatisfaction because an outcome was worse than hoped.",
    "disgust": "Strong aversion or revulsion.",
    "excitement": "Strong eager enthusiasm about something anticipated or happening.",
    "fear": "Apprehension or threat-related distress.",
    "gratitude": "Appreciation for a benefit or kindness received.",
    "joy": "Strong happiness or delight.",
    "love": "Deep affection or attachment.",
    "optimism": "Positive expectation about the future.",
    "remorse": "Regret and guilt about one's own action.",
    "sadness": "Unhappiness, sorrow, or low mood.",
    "surprise": "Reaction to something unexpected.",
}
PRODUCT = list(DEFINITIONS)


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def shingles(text: str) -> set[tuple[str, ...]]:
    words = norm(text).split()
    if len(words) < 3:
        return {tuple(words)} if words else set()
    return {tuple(words[index:index + 3]) for index in range(len(words) - 2)}


def lexical_near(left: str, right: str) -> float:
    a, b = shingles(left), shingles(right)
    return len(a & b) / len(a | b) if a or b else 1.0


def text_of(row: dict) -> str:
    return str(row.get("text") or row.get("journal") or "")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@torch.inference_mode()
def infer(checkpoint: Path, texts: list[str], labels: list[str]) -> np.ndarray:
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model, info = AutoModelForSequenceClassification.from_pretrained(
        checkpoint, local_files_only=True, output_loading_info=True
    )
    if info["missing_keys"] or info["unexpected_keys"] or info["mismatched_keys"]:
        raise ValueError(f"Checkpoint load mismatch: {info}")
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, value in id2label.items() if value == label) for label in labels]
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model.to(device).eval()
    output = []
    for start in range(0, len(texts), 64):
        encoded = tokenizer(
            texts[start:start + 64], padding=True, truncation=True,
            max_length=256, return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        output.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(output)


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def canonical_rights(row: dict) -> tuple[str, str]:
    provenance = row.get("provenance") or {}
    if row.get("sourceType") == "HUMAN_CONSENTED":
        return "PASS_EXISTING_CONSENT", "existing consented canonical Train lineage"
    if provenance.get("dataset") == "CoSoWELL-v1":
        return "PASS_EXISTING_LEGAL_CORPUS", "CoSoWELL author-grouped canonical Train lineage"
    return "UNRESOLVED_UNDERLYING_REDDIT_RIGHTS", "historical research lineage only"


def main() -> None:
    outputs = [
        "confusion-pair-priority.csv", "existing-hard-negative-candidates.csv",
        "source-audit.json", "leakage-audit.json", "eligibility-summary.json",
        "blind-input.csv", "blind-input-lock.json", "candidate-selection-private.csv",
    ]
    if any((HERE / name).exists() for name in outputs):
        raise FileExistsError("Refusing to overwrite prepared artifacts")

    pair_rows = []
    for pair_id, a, b, evidence, priority in PAIRS:
        pair_rows.append({
            "pair_id": pair_id,
            "label_a": a,
            "label_b": b,
            "observed_error_type": "RELATED_EMOTION_SUBSTITUTION_OR_EXTRA_LABEL",
            "evidence_source": "COSO legal development balanced-head-error-analysis-v1 aggregate",
            "priority": priority,
            "desired_direction_a_positive_b_negative": 20,
            "desired_direction_b_positive_a_negative": 20,
            "rationale": evidence,
        })
    write_csv(HERE / "confusion-pair-priority.csv", pair_rows, list(pair_rows[0]))

    canonical_rows = read_jsonl(CANONICAL_TRAIN)
    go_rows = read_jsonl(GO_TRANCHE)
    existing = []
    unresolved = 0
    for row in canonical_rows:
        labels = set(row["modelLabels"])
        rights, provenance_note = canonical_rights(row)
        for pair_id, a, b, _, _ in PAIRS:
            for positive, negative in ((a, b), (b, a)):
                if positive not in labels or negative in labels:
                    continue
                unresolved += 1
                existing.append({
                    "sample_id": row["id"],
                    "text": row["journal"],
                    "source": (row.get("provenance") or {}).get("dataset") or row.get("sourceType"),
                    "source_group_id": row["sourceGroupId"],
                    "positive_label": positive,
                    "negative_label": negative,
                    "positive_evidence_type": "MODEL_WEAK_EXACT_AGREEMENT_OR_ADJUDICATION_NOT_HUMAN_GOLD",
                    "negative_evidence_type": "SELECTIVE_OMISSION_NEGATIVE_STATUS_UNRESOLVED",
                    "provenance": provenance_note,
                    "rights_status": rights,
                    "eligibility_status": "NEGATIVE_STATUS_UNRESOLVED",
                    "exclusion_reason": "omitted weak-model label is not an explicit negative",
                })

    raw_by_id: dict[str, list[dict]] = defaultdict(list)
    go_ids = {(row.get("provenance") or {}).get("originalRowId") for row in go_rows}
    for path in sorted(GO_RAW.glob("goemotions_*.csv")):
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                if row["id"] in go_ids and row["example_very_unclear"] == "False":
                    raw_by_id[row["id"]].append(row)
    go_explicit = 0
    go_directions = Counter()
    for row in go_rows:
        labels = set(row["modelLabels"])
        original_id = (row.get("provenance") or {})["originalRowId"]
        raters = raw_by_id[original_id]
        for pair_id, a, b, _, _ in PAIRS:
            for positive, negative in ((a, b), (b, a)):
                if positive not in labels or negative in labels:
                    continue
                explicit_zero = bool(raters) and all(rater[negative] == "0" for rater in raters)
                if explicit_zero:
                    go_explicit += 1
                    go_directions[f"{positive}>{negative}"] += 1
                existing.append({
                    "sample_id": row["id"],
                    "text": row["journal"],
                    "source": "GoEmotions",
                    "source_group_id": row["sourceGroupId"],
                    "positive_label": positive,
                    "negative_label": negative,
                    "positive_evidence_type": "HUMAN_MULTI_LABEL_AGREEMENT_FILTERED",
                    "negative_evidence_type": (
                        "ALL_AVAILABLE_NON_UNCLEAR_RATERS_BINARY_ZERO" if explicit_zero
                        else "NEGATIVE_STATUS_UNRESOLVED"
                    ),
                    "provenance": "official raw per-rater binary columns joined by original row id",
                    "rights_status": "REVIEW_REQUIRED_UNDERLYING_REDDIT_RIGHTS",
                    "eligibility_status": "RIGHTS_STATUS_UNRESOLVED",
                    "exclusion_reason": "source rights are not cleared for product/commercial training",
                })
    fields = [
        "sample_id", "text", "source", "source_group_id", "positive_label", "negative_label",
        "positive_evidence_type", "negative_evidence_type", "provenance", "rights_status",
        "eligibility_status", "exclusion_reason",
    ]
    write_csv(HERE / "existing-hard-negative-candidates.csv", existing, fields)

    rights_clear_canonical = [
        row for row in canonical_rows
        if 30 <= len(row["journal"]) <= 300 and canonical_rights(row)[0].startswith("PASS_")
    ]
    hippo_rows = [row for row in read_jsonl(HIPPO) if 30 <= len(row["text"]) <= 300]
    inference_rows = []
    for row in rights_clear_canonical:
        inference_rows.append({
            "sample_id": row["id"], "text": row["journal"],
            "source": "canonical-rights-clear", "source_group_id": row["sourceGroupId"],
            "weak_labels": row["modelLabels"],
        })
    for row in hippo_rows:
        inference_rows.append({
            "sample_id": row["id"], "text": row["text"],
            "source": "Hippocorpus V3", "source_group_id": row["sourceGroupId"],
            "weak_labels": [],
        })
    texts = [row["text"] for row in inference_rows]
    inference_cache = HERE / "selection-probabilities-private.npz"
    input_hash = digest("\n".join(row["sample_id"] + "\t" + row["text"] for row in inference_rows))
    if inference_cache.exists():
        cached = np.load(inference_cache)
        if str(cached["input_hash"]) != input_hash:
            raise ValueError("Inference cache input hash mismatch")
        incumbent_probs = cached["incumbent"]
        balanced_probs = cached["balanced"]
    else:
        incumbent_probs = infer(INCUMBENT, texts, PRODUCT)
        balanced_probs = infer(BALANCED, texts, PRODUCT)
        np.savez(
            inference_cache, input_hash=input_hash,
            incumbent=incumbent_probs, balanced=balanced_probs,
        )
    label_index = {label: index for index, label in enumerate(PRODUCT)}

    protected_exact_hashes = set()
    if LINEAGE_REFERENCE.exists():
        for row in read_jsonl(LINEAGE_REFERENCE):
            # Reusing admitted training text is allowed; only explicit
            # development and holdout lineage entries are protected here.
            if row.get("split") in {"dev", "holdout"} and row.get("text_normalized_sha256"):
                protected_exact_hashes.add(row["text_normalized_sha256"])
    protected_paths = [
        ALIGNED / "dev.jsonl",
        V4 / "gemini-eval-v1/blind-cohort.jsonl",
        V4 / "model-consensus-reference-300-v1/frozen-reference-300.jsonl",
    ]
    protected_texts = []
    protected_groups = set()
    for path in protected_paths:
        for row in read_jsonl(path):
            text = text_of(row)
            if text:
                protected_texts.append(text)
                protected_exact_hashes.add(digest(norm(text)))
            group = row.get("sourceGroupId") or (row.get("provenance") or {}).get("sourceGroupId")
            if group:
                protected_groups.add(str(group))
    exact_safe_indices = [
        index for index, row in enumerate(inference_rows)
        if digest(norm(row["text"])) not in protected_exact_hashes
        and row["source_group_id"] not in protected_groups
    ]

    selected_assignments = []
    used_assignment = set()
    for pair_id, a, b, _, _ in PAIRS:
        for positive, negative in ((a, b), (b, a)):
            eligible_indices = list(exact_safe_indices)
            eligible_indices.sort(key=lambda index: (
                0 if positive in set(inference_rows[index]["weak_labels"]) and negative not in set(inference_rows[index]["weak_labels"]) else 1,
                0 if balanced_probs[index, label_index[negative]] >= 0.25 else 1,
                -float(balanced_probs[index, label_index[positive]]),
                abs(float(balanced_probs[index, label_index[negative]]) - 0.35),
                -float(balanced_probs[index, label_index[negative]] - incumbent_probs[index, label_index[negative]]),
                inference_rows[index]["sample_id"],
            ))
            direction_count = 0
            for index in eligible_indices:
                key = (inference_rows[index]["sample_id"], pair_id, positive, negative)
                if key in used_assignment:
                    continue
                selected_assignments.append({
                    "selection_role": "PAIR_HARD_NEGATIVE_CANDIDATE",
                    "pair_id": pair_id,
                    "desired_positive_label": positive,
                    "desired_negative_label": negative,
                    "sample_id": inference_rows[index]["sample_id"],
                    "text": inference_rows[index]["text"],
                    "source": inference_rows[index]["source"],
                    "source_group_id": inference_rows[index]["source_group_id"],
                    "old_weak_labels": "|".join(inference_rows[index]["weak_labels"]),
                    "incumbent_positive_probability": f"{incumbent_probs[index, label_index[positive]]:.8f}",
                    "incumbent_negative_probability": f"{incumbent_probs[index, label_index[negative]]:.8f}",
                    "balanced_positive_probability": f"{balanced_probs[index, label_index[positive]]:.8f}",
                    "balanced_negative_probability": f"{balanced_probs[index, label_index[negative]]:.8f}",
                })
                used_assignment.add(key)
                direction_count += 1
                if direction_count == PAIR_TARGET_PER_DIRECTION:
                    break
            if direction_count != PAIR_TARGET_PER_DIRECTION:
                raise ValueError(f"Insufficient candidates for {positive}>{negative}: {direction_count}")

    hippo_start = len(rights_clear_canonical)
    hippo_indices = [index for index in exact_safe_indices if index >= hippo_start]
    no_clear = sorted(
        hippo_indices,
        key=lambda index: (float(balanced_probs[index].max()), inference_rows[index]["sample_id"]),
    )[:NO_CLEAR_CONTROL_TARGET]
    two_label = sorted(
        hippo_indices,
        key=lambda index: (
            -float(np.sort(balanced_probs[index])[-2]),
            float(np.sort(balanced_probs[index])[-3]),
            inference_rows[index]["sample_id"],
        ),
    )[:TWO_LABEL_CONTROL_TARGET]
    for role, indices in (("NO_CLEAR_CONTROL_CANDIDATE", no_clear), ("TWO_LABEL_CONTROL_CANDIDATE", two_label)):
        for index in indices:
            selected_assignments.append({
                "selection_role": role, "pair_id": "", "desired_positive_label": "",
                "desired_negative_label": "", "sample_id": inference_rows[index]["sample_id"],
                "text": inference_rows[index]["text"], "source": inference_rows[index]["source"],
                "source_group_id": inference_rows[index]["source_group_id"], "old_weak_labels": "",
                "incumbent_positive_probability": "", "incumbent_negative_probability": "",
                "balanced_positive_probability": "", "balanced_negative_probability": "",
            })

    selection_by_sample = {}
    for row in selected_assignments:
        selection_by_sample[row["sample_id"]] = row
    excluded_exact = set()
    excluded_near = set()
    excluded_group = set()
    maximum_similarity = 0.0
    for sample_id, row in selection_by_sample.items():
        if digest(norm(row["text"])) in protected_exact_hashes:
            excluded_exact.add(sample_id)
        if row["source_group_id"] in protected_groups:
            excluded_group.add(sample_id)
        for protected in protected_texts:
            similarity = lexical_near(row["text"], protected)
            maximum_similarity = max(maximum_similarity, similarity)
            if similarity >= 0.80:
                excluded_near.add(sample_id)
                break
    excluded = excluded_exact | excluded_near | excluded_group
    selected_assignments = [row for row in selected_assignments if row["sample_id"] not in excluded]
    if excluded:
        raise ValueError(
            "Selection lost protected-overlap rows; regenerate quotas: "
            f"total={len(excluded)} exact={len(excluded_exact)} "
            f"near={len(excluded_near)} group={len(excluded_group)}"
        )

    private_fields = list(selected_assignments[0])
    write_csv(HERE / "candidate-selection-private.csv", selected_assignments, private_fields)
    blind_cells = {}
    for row in selected_assignments:
        labels = (
            PRODUCT if row["selection_role"].endswith("CONTROL_CANDIDATE")
            else [row["desired_positive_label"], row["desired_negative_label"]]
        )
        for label in labels:
            key = (row["sample_id"], label)
            blind_cells[key] = {
                "sample_id": row["sample_id"], "text": row["text"], "target_label": label,
                "label_definition": DEFINITIONS[label], "allowed_values": "NO|PLAUSIBLE|CLEAR",
            }
    blind_rows = []
    for number, key in enumerate(sorted(blind_cells), 1):
        blind_rows.append({"adjudication_id": f"CAHN-{number:04d}", **blind_cells[key]})
    blind_fields = [
        "adjudication_id", "sample_id", "text", "target_label", "label_definition", "allowed_values"
    ]
    write_csv(HERE / "blind-input.csv", blind_rows, blind_fields)
    blind_hash = hashlib.sha256((HERE / "blind-input.csv").read_bytes()).hexdigest()
    (HERE / "blind-input-lock.json").write_text(json.dumps({
        "status": "SEALED_BEFORE_ANY_JUDGE",
        "rows": len(blind_rows),
        "uniqueSamples": len({row["sample_id"] for row in blind_rows}),
        "sha256": blind_hash,
        "allowedJudgeFields": blind_fields,
        "forbiddenJudgeContext": [
            "source", "old annotation", "model prediction", "probability", "FP/FN",
            "confusion pair", "expected answer", "other judge votes", "RTN/COSO evidence",
        ],
    }, indent=2) + "\n", encoding="utf-8")

    source_audit = {
        "status": "PASS_FOR_PANEL_INPUT_ONLY",
        "sources": {
            "canonicalCoSoWELLTrain": {
                "rights": "PASS_EXISTING_LEGAL_CORPUS", "grouping": "author",
                "labels": "MODEL_WEAK_NOT_HUMAN_GOLD", "directHardNegativeEligibility": False,
            },
            "canonicalHumanConsentedTrain": {
                "rights": "PASS_EXISTING_CONSENT", "grouping": "consented contributor",
                "labels": "MODEL_WEAK_NOT_HUMAN_GOLD", "directHardNegativeEligibility": False,
            },
            "canonicalRedditTrain": {
                "rights": "UNRESOLVED_UNDERLYING_REDDIT_RIGHTS", "grouping": "thread where available",
                "labels": "MODEL_WEAK_NOT_HUMAN_GOLD", "directHardNegativeEligibility": False,
            },
            "GoEmotionsTargeted": {
                "rights": "REVIEW_REQUIRED_UNDERLYING_REDDIT_RIGHTS", "grouping": "author available",
                "labels": "HUMAN_MULTI_LABEL_WITH_PER_RATER_BINARY_COLUMNS",
                "directHardNegativeEligibility": False,
            },
            "HippocorpusTrain": {
                "rights": "PASS_O_UDA_1_0", "grouping": "worker",
                "labels": "UNLABELED", "directHardNegativeEligibility": False,
                "panelCandidateEligibility": True,
            },
            "UnexpectedEvents": {
                "rights": "PASS_CC_BY_4_0", "grouping": "participant",
                "labels": "NON_PRODUCT_NATIVE_LABELS", "directHardNegativeEligibility": False,
                "panelCandidateEligibility": False,
                "reason": "third-person hypothetical auxiliary domain; Hippocorpus supplies preferred first-person candidates",
            },
        },
        "noNewHumanReview": True,
        "modelPanelOutputsAreHumanGold": False,
    }
    (HERE / "source-audit.json").write_text(json.dumps(source_audit, indent=2) + "\n", encoding="utf-8")
    leakage_audit = {
        "status": "PASS",
        "selectedUniqueSamples": len(selection_by_sample),
        "exactNormalizedOverlap": len(excluded_exact),
        "lexicalNearDuplicateThreshold": 0.80,
        "lexicalNearDuplicateOverlap": len(excluded_near),
        "sourceGroupOverlap": len(excluded_group),
        "maximumObservedProtectedLexicalSimilarity": maximum_similarity,
        "fullHistoricalLineageExactHashIndexUsed": LINEAGE_REFERENCE.exists(),
        "historicalLineageIndexScope": "explicit dev/holdout entries only; admitted train reuse remains allowed",
        "currentProtectedTextChecks": [str(path.relative_to(V4)) for path in protected_paths],
        "protectedLabelsOrErrorsRead": False,
        "RTNUsedForSelectionOrDesign": False,
    }
    (HERE / "leakage-audit.json").write_text(json.dumps(leakage_audit, indent=2) + "\n", encoding="utf-8")
    summary = {
        "status": "MULTI_AGENT_REQUIRED",
        "existingCandidateRecords": len(existing),
        "existingEligibleHardNegatives": 0,
        "explicitNegativeRecords": go_explicit,
        "explicitNegativeDirectionCounts": dict(sorted(go_directions.items())),
        "explicitNegativeEligibleAfterRights": 0,
        "unresolvedNegativeRecords": unresolved + sum(
            row["negative_evidence_type"] == "NEGATIVE_STATUS_UNRESOLVED" for row in existing
            if row["source"] == "GoEmotions"
        ),
        "multiAgentNeeded": True,
        "reason": "No existing row combines rights PASS, reliable positive, and explicit paired negative with adequate quota coverage.",
        "blindInputRows": len(blind_rows),
        "pairCandidateAssignments": sum(row["selection_role"] == "PAIR_HARD_NEGATIVE_CANDIDATE" for row in selected_assignments),
        "noClearControlCandidates": NO_CLEAR_CONTROL_TARGET,
        "twoLabelControlCandidates": TWO_LABEL_CONTROL_TARGET,
        "trainingAuthorized": False,
    }
    (HERE / "eligibility-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    main()
