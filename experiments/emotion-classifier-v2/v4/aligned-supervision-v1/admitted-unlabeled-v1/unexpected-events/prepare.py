#!/usr/bin/env python3
"""Prepare a minimized, group-isolated Unexpected Events unlabeled corpus."""

import csv
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
RELEASE = HERE / "raw" / "release"
OUT = HERE / "prepared"
SEED = 44
VALIDATION_FRACTION = 0.05
MAX_EVENT_CHARACTERS = 300

SOURCES = (
    ("experiment-1", RELEASE / "0_data/0_Experiment1/expt1_master_post_resolve.csv"),
    ("experiment-2", RELEASE / "2_pipeline/expt2_master_data.csv"),
    ("experiment-3", RELEASE / "0_data/3_Experiment3/expt3_master_post_resolve.csv"),
)

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
    source_rows = []
    source_counts = {}
    nonblank_counts = {}
    for experiment, source in SOURCES:
        with source.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        source_counts[experiment] = len(rows)
        nonblank_counts[experiment] = 0
        for source_line, row in enumerate(rows, start=2):
            text = normalized(row.get("answer_text", ""))
            if not text:
                continue
            nonblank_counts[experiment] += 1
            source_rows.append(
                {
                    "experiment": experiment,
                    "sourceLine": source_line,
                    "rawGroup": row.get("user_id", "").strip(),
                    "material": row.get("material", "").strip(),
                    "text": text,
                }
            )

    # These checks lock the exact released tables used and prevent silent schema drift.
    assert source_counts == {
        "experiment-1": 5080,
        "experiment-2": 5140,
        "experiment-3": 1020,
    }
    assert nonblank_counts == {
        "experiment-1": 2540,
        "experiment-2": 5140,
        "experiment-3": 1020,
    }
    assert len(source_rows) == 8700
    assert all(row["rawGroup"] for row in source_rows)

    character_counts_before_policy = [len(row["text"]) for row in source_rows]
    excluded = []
    eligible = []
    seen_texts = set()
    for row in source_rows:
        reasons = [name for name, pattern in CONTACT_PATTERNS.items() if pattern.search(row["text"])]
        if len(row["text"]) > MAX_EVENT_CHARACTERS:
            reasons.append("length_gt_300_characters")
        if len(re.findall(r"[A-Za-z]", row["text"])) < 3:
            reasons.append("fewer_than_3_ascii_letters")
        text_key = row["text"].casefold()
        if text_key in seen_texts:
            reasons.append("normalized_duplicate_text")
        if reasons:
            excluded.append(
                {
                    "sourceRecordId": f"unexpected-events-{row['experiment']}-{row['sourceLine']:06d}",
                    "reasons": reasons,
                }
            )
        else:
            seen_texts.add(text_key)
            eligible.append(row)

    rows_by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in eligible:
        rows_by_group[row["rawGroup"]].append(row)

    groups = sorted(rows_by_group)
    random.Random(SEED).shuffle(groups)
    target_validation_rows = round(len(eligible) * VALIDATION_FRACTION)
    validation_groups = set()
    validation_rows = 0
    for group in groups:
        if validation_rows >= target_validation_rows:
            break
        validation_groups.add(group)
        validation_rows += len(rows_by_group[group])

    aliases = {
        group: f"unexpected-events-participant-{index:04d}"
        for index, group in enumerate(sorted(groups), 1)
    }
    prepared = []
    for row in eligible:
        group = row["rawGroup"]
        source_record_id = f"unexpected-events-{row['experiment']}-{row['sourceLine']:06d}"
        prepared.append(
            {
                "id": source_record_id,
                "text": row["text"],
                "sourceGroupId": aliases[group],
                "sourceRecordId": source_record_id,
                "dataset": "Unexpected Events",
                "experiment": row["experiment"],
                "material": row["material"],
                "domainRole": "AUXILIARY_HYPOTHETICAL_EVENT",
                "admissionClass": "ADMIT_UNLABELED",
                "labelStatus": "UNLABELED",
                "split": "validation" if group in validation_groups else "train",
            }
        )

    train = sorted((row for row in prepared if row["split"] == "train"), key=lambda row: row["id"])
    validation = sorted((row for row in prepared if row["split"] == "validation"), key=lambda row: row["id"])
    train_groups = {row["sourceGroupId"] for row in train}
    validation_group_aliases = {row["sourceGroupId"] for row in validation}
    assert train_groups.isdisjoint(validation_group_aliases)
    assert len({row["text"].casefold() for row in prepared}) == len(prepared)
    assert all(len(row["text"]) <= MAX_EVENT_CHARACTERS for row in prepared)

    OUT.mkdir(exist_ok=True)
    for name, rows in (("train.jsonl", train), ("validation.jsonl", validation)):
        with (OUT / name).open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

    word_counts = [len(row["text"].split()) for row in prepared]
    exclusion_reasons = Counter(reason for row in excluded for reason in row["reasons"])
    audit = {
        "status": "PASS",
        "admissionClass": "ADMIT_UNLABELED",
        "source": "Mendeley Data kkt999sn7b version 1",
        "license": "CC BY 4.0",
        "allowedRole": [
            "auxiliary domain-adaptive pretraining",
            "representation adaptation",
            "self-supervised learning",
            "weak-label research with explicit WEAK/PSEUDO status",
        ],
        "forbiddenRole": [
            "Product-18 human emotion gold",
            "independent product evaluation",
            "standalone evidence for model promotion",
            "treating source valence, topic, or goal-relation labels as Product-18 labels",
        ],
        "selection": "answer_text from the three released post-resolution/master experiment tables only; no pre/post-test, rater, comment, label, or participant-identifier fields",
        "domainQualification": "Short everyday hypothetical event continuations; useful only as auxiliary Event-like text because they are prompted third-person predictions rather than first-person PetalPal Events.",
        "lengthPolicy": "retain complete responses of at most 300 Unicode characters; no truncation",
        "qualityPolicy": "require at least three ASCII letters; remove normalized exact duplicates deterministically",
        "releaseClaimDiscrepancy": {
            "publishedTextResponseCount": 9720,
            "nonblankResponsesInSelectedReleasedTables": len(source_rows),
            "difference": 9720 - len(source_rows),
            "handling": "Use reproducible released-table contents; do not infer or synthesize missing records.",
        },
        "raw": {
            "tableRows": source_counts,
            "nonblankAnswerTextRows": nonblank_counts,
            "nonblankAnswerTextRowsTotal": len(source_rows),
            "sourceGroups": len({row["rawGroup"] for row in source_rows}),
        },
        "characterLengthBeforePolicy": {
            "median": percentile(character_counts_before_policy, 0.5),
            "p75": percentile(character_counts_before_policy, 0.75),
            "p90": percentile(character_counts_before_policy, 0.9),
            "percentageAtMost300": 100
            * sum(value <= MAX_EVENT_CHARACTERS for value in character_counts_before_policy)
            / len(character_counts_before_policy),
            "percentageOver300": 100
            * sum(value > MAX_EVENT_CHARACTERS for value in character_counts_before_policy)
            / len(character_counts_before_policy),
        },
        "prepared": {
            "excludedRows": len(excluded),
            "exclusionReasonCounts": dict(sorted(exclusion_reasons.items())),
            "rows": len(prepared),
            "trainRows": len(train),
            "validationRows": len(validation),
            "sourceGroups": len({row["sourceGroupId"] for row in prepared}),
            "trainSourceGroups": len(train_groups),
            "validationSourceGroups": len(validation_group_aliases),
            "normalizedDuplicateTexts": len(prepared)
            - len({row["text"].casefold() for row in prepared}),
            "characterCount": {
                "min": min(len(row["text"]) for row in prepared),
                "median": percentile([len(row["text"]) for row in prepared], 0.5),
                "p75": percentile([len(row["text"]) for row in prepared], 0.75),
                "p90": percentile([len(row["text"]) for row in prepared], 0.9),
                "max": max(len(row["text"]) for row in prepared),
            },
            "wordCount": {
                "min": min(word_counts),
                "p25": percentile(word_counts, 0.25),
                "median": percentile(word_counts, 0.5),
                "p75": percentile(word_counts, 0.75),
                "p95": percentile(word_counts, 0.95),
                "max": max(word_counts),
            },
            "experimentCounts": dict(sorted(Counter(row["experiment"] for row in prepared).items())),
        },
        "privacyNote": "Raw participant IDs, including IP-like values, are never written to prepared outputs. Deterministic aliases preserve grouping. Automated contact-pattern filtering is risk reduction, not a guarantee that free text contains no personal information.",
        "humanReviewPerformed": False,
    }
    (OUT / "audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
