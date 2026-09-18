#!/usr/bin/env python3
"""Automatic domain-coverage comparison for admitted unlabeled short-event corpora."""

import json
import re
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCES = {
    "hippocorpus": ROOT / "admitted-unlabeled-v1/hippocorpus/prepared",
    "unexpectedEvents": ROOT / "admitted-unlabeled-v1/unexpected-events/prepared",
}
WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
FIRST_PERSON = {"i", "i'm", "i've", "i'd", "me", "my", "mine", "myself", "we", "we're", "we've", "we'd", "us", "our", "ours", "ourselves"}
THIRD_PERSON = {"he", "he's", "he'd", "him", "his", "himself", "she", "she's", "she'd", "her", "hers", "herself"}


def percentile(values: list[int], fraction: float) -> int:
    values = sorted(values)
    return values[round((len(values) - 1) * fraction)]


def load(directory: Path) -> list[dict[str, object]]:
    rows = []
    for split in ("train", "validation"):
        with (directory / f"{split}.jsonl").open(encoding="utf-8") as handle:
            for line in handle:
                rows.append(json.loads(line))
    return rows


def summarize(rows: list[dict[str, object]]) -> tuple[dict[str, object], set[str]]:
    tokenized = [[token.casefold() for token in WORD.findall(str(row["text"]))] for row in rows]
    char_counts = [len(str(row["text"])) for row in rows]
    token_counts = [len(tokens) for tokens in tokenized]
    vocab = {token for tokens in tokenized for token in tokens}
    first_rows = sum(bool(set(tokens) & FIRST_PERSON) for tokens in tokenized)
    third_rows = sum(bool(set(tokens) & THIRD_PERSON) for tokens in tokenized)
    splits = Counter(str(row["split"]) for row in rows)
    materials = {str(row.get("material", "")) for row in rows if row.get("material")}
    return (
        {
            "rows": len(rows),
            "sourceGroups": len({str(row["sourceGroupId"]) for row in rows}),
            "splits": dict(sorted(splits.items())),
            "characterCount": {
                "median": percentile(char_counts, 0.5),
                "p75": percentile(char_counts, 0.75),
                "p90": percentile(char_counts, 0.9),
                "max": max(char_counts),
            },
            "wordCount": {
                "median": percentile(token_counts, 0.5),
                "p75": percentile(token_counts, 0.75),
                "p90": percentile(token_counts, 0.9),
                "max": max(token_counts),
            },
            "firstPersonMarkerRows": first_rows,
            "firstPersonMarkerPercentage": 100 * first_rows / len(rows),
            "thirdPersonMarkerRows": third_rows,
            "thirdPersonMarkerPercentage": 100 * third_rows / len(rows),
            "vocabularyTypes": len(vocab),
            "materials": len(materials),
        },
        vocab,
    )


def main() -> None:
    rows = {name: load(directory) for name, directory in SOURCES.items()}
    summaries = {}
    vocabularies = {}
    for name, corpus_rows in rows.items():
        summaries[name], vocabularies[name] = summarize(corpus_rows)

    left = vocabularies["hippocorpus"]
    right = vocabularies["unexpectedEvents"]
    shared = left & right
    union = left | right
    result = {
        "status": "PASS",
        "trainingPerformed": False,
        "humanReviewPerformed": False,
        "corpora": summaries,
        "vocabularyOverlap": {
            "sharedTypes": len(shared),
            "unionTypes": len(union),
            "jaccard": len(shared) / len(union),
            "hippocorpusUniqueTypes": len(left - right),
            "unexpectedEventsUniqueTypes": len(right - left),
        },
        "decision": {
            "hippocorpusRole": "PRIMARY_FIRST_PERSON_EVENT",
            "unexpectedEventsRole": "AUXILIARY_HYPOTHETICAL_EVENT",
            "automaticRationale": "Unexpected Events is an explicitly prompt-conditioned third-person prediction corpus and its prepared rows show much lower first-person-marker incidence. Its extra vocabulary and scenario coverage can support bounded auxiliary research, but its larger size must not dominate the more product-like first-person corpus.",
            "trainingAuthorizedByThisDiagnostic": False,
            "promotionImpact": "NONE",
        },
        "limitations": [
            "Pronoun-marker counts are automatic surface diagnostics, not semantic labels.",
            "Neither corpus contains Product-18 human gold.",
            "Vocabulary coverage does not establish model-quality benefit.",
        ],
    }
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
