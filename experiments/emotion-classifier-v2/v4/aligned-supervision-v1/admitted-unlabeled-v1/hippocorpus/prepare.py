#!/usr/bin/env python3
"""Build a minimized, group-isolated Hippocorpus corpus for unlabeled ML use."""

import csv
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "raw" / "release" / "hcV3-stories.csv"
OUT = HERE / "prepared"
SEED = 44
VALIDATION_FRACTION = 0.05
MAX_EVENT_CHARACTERS = 300

CONTACT_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "url": re.compile(r"\b(?:https?://|www\.)\S+", re.I),
    "phone_like": re.compile(r"(?<!\d)(?:\+?\d[\d .()\-]{7,}\d)(?!\d)"),
}


def normalized(text: str) -> str:
    return " ".join(text.split())


def percentile(values: list[int], fraction: float) -> int:
    values = sorted(values)
    return values[round((len(values) - 1) * fraction)]


def main() -> None:
    csv.field_size_limit(sys.maxsize)
    with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        all_rows = list(csv.DictReader(handle))

    recalled = [row for row in all_rows if row["memType"] == "recalled"]
    assert len(all_rows) == 6854
    assert len(recalled) == 2779
    assert all(row["AssignmentId"].strip() for row in recalled)
    assert all(row["WorkerId"].strip() for row in recalled)
    assert all(row["summary"].strip() for row in recalled)

    normalized_summaries = [normalized(row["summary"]) for row in recalled]
    assert len(set(text.casefold() for text in normalized_summaries)) == len(recalled)

    character_counts_before_policy = [len(text) for text in normalized_summaries]
    excluded = []
    eligible = []
    for row, text in zip(recalled, normalized_summaries):
        reasons = [name for name, pattern in CONTACT_PATTERNS.items() if pattern.search(text)]
        if len(text) > MAX_EVENT_CHARACTERS:
            reasons.append("length_gt_300_characters")
        if reasons:
            excluded.append({"sourceRecordId": row["AssignmentId"], "reasons": reasons})
        else:
            eligible.append((row, text))

    rows_by_worker: dict[str, list[tuple[dict[str, str], str]]] = defaultdict(list)
    for row, text in eligible:
        rows_by_worker[row["WorkerId"]].append((row, text))

    workers = sorted(rows_by_worker)
    random.Random(SEED).shuffle(workers)
    target_validation_rows = round(len(eligible) * VALIDATION_FRACTION)
    validation_workers: set[str] = set()
    validation_rows = 0
    for worker in workers:
        if validation_rows >= target_validation_rows:
            break
        validation_workers.add(worker)
        validation_rows += len(rows_by_worker[worker])

    aliases = {worker: f"hippocorpus-worker-{index:04d}" for index, worker in enumerate(sorted(workers), 1)}
    prepared = []
    for row, text in eligible:
        worker = row["WorkerId"]
        prepared.append(
            {
                "id": f"hippocorpus-{row['AssignmentId']}",
                "text": text,
                "sourceGroupId": aliases[worker],
                "sourceRecordId": row["AssignmentId"],
                "dataset": "Hippocorpus V3",
                "admissionClass": "ADMIT_UNLABELED",
                "labelStatus": "UNLABELED",
                "split": "validation" if worker in validation_workers else "train",
            }
        )

    train = sorted((row for row in prepared if row["split"] == "train"), key=lambda row: row["id"])
    validation = sorted((row for row in prepared if row["split"] == "validation"), key=lambda row: row["id"])
    train_groups = {row["sourceGroupId"] for row in train}
    validation_groups = {row["sourceGroupId"] for row in validation}
    assert train_groups.isdisjoint(validation_groups)

    OUT.mkdir(exist_ok=True)
    for name, rows in (("train.jsonl", train), ("validation.jsonl", validation)):
        with (OUT / name).open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

    word_counts = [len(row["text"].split()) for row in prepared]
    audit = {
        "status": "PASS",
        "admissionClass": "ADMIT_UNLABELED",
        "source": str(SOURCE.relative_to(HERE)),
        "license": "Open Use of Data Agreement v1.0 (O-UDA-1.0)",
        "allowedRole": [
            "domain-adaptive pretraining",
            "representation adaptation",
            "self-supervised learning",
        ],
        "forbiddenRole": [
            "human emotion gold",
            "independent product evaluation",
            "standalone evidence for model promotion",
        ],
        "selection": "recalled summaries only; no long stories, demographics, questionnaire fields, or free-text metadata",
        "lengthPolicy": "retain complete recalled summaries of at most 300 Unicode characters; no truncation",
        "raw": {
            "rows": len(all_rows),
            "memoryTypes": dict(sorted(Counter(row["memType"] for row in all_rows).items())),
            "workers": len({row["WorkerId"] for row in all_rows}),
        },
        "prepared": {
            "recalledRowsBeforePolicy": len(recalled),
            "recalledSummaryCharacterLengthBeforePolicy": {
                "median": percentile(character_counts_before_policy, 0.5),
                "p75": percentile(character_counts_before_policy, 0.75),
                "p90": percentile(character_counts_before_policy, 0.9),
                "percentageAtMost300": 100 * sum(value <= MAX_EVENT_CHARACTERS for value in character_counts_before_policy) / len(character_counts_before_policy),
                "percentageOver300": 100 * sum(value > MAX_EVENT_CHARACTERS for value in character_counts_before_policy) / len(character_counts_before_policy),
            },
            "excludedRows": len(excluded),
            "excludedByContactHeuristic": sum(any(reason in CONTACT_PATTERNS for reason in row["reasons"]) for row in excluded),
            "excludedByLengthPolicy": sum("length_gt_300_characters" in row["reasons"] for row in excluded),
            "rows": len(prepared),
            "trainRows": len(train),
            "validationRows": len(validation),
            "sourceGroups": len({row["sourceGroupId"] for row in prepared}),
            "trainSourceGroups": len(train_groups),
            "validationSourceGroups": len(validation_groups),
            "normalizedDuplicateTexts": len(prepared) - len({row["text"].casefold() for row in prepared}),
            "wordCount": {
                "min": min(word_counts),
                "p25": percentile(word_counts, 0.25),
                "median": percentile(word_counts, 0.5),
                "p75": percentile(word_counts, 0.75),
                "p95": percentile(word_counts, 0.95),
                "max": max(word_counts),
            },
        },
        "excluded": excluded,
        "privacyNote": "Automated contact-pattern filtering is risk reduction, not a guarantee that narrative text contains no personal information.",
        "humanReviewPerformed": False,
    }
    (OUT / "audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
