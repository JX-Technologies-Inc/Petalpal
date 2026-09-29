#!/usr/bin/env python3
"""Apply the frozen two-validator exact-target acceptance rule."""

import json
from collections import Counter, defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
ORDER = {label: index for index, label in enumerate(LABELS)}


def read(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def validate(rows, ids, name):
    if len(rows) != len(ids) or [row.get("rowId") for row in rows] != ids:
        raise ValueError(f"{name}: count/order mismatch")
    for row in rows:
        if set(row) != {"rowId", "labels", "uncertainty"}:
            raise ValueError(f"{name}:{row.get('rowId')}: invalid keys")
        labels = row["labels"]
        if not isinstance(labels, list) or len(labels) > 2 or len(labels) != len(set(labels)):
            raise ValueError(f"{name}:{row['rowId']}: invalid cardinality")
        if any(label not in ORDER for label in labels) or labels != sorted(labels, key=ORDER.get):
            raise ValueError(f"{name}:{row['rowId']}: invalid labels/order")
        if row["uncertainty"] not in {"LOW", "MEDIUM", "HIGH"}:
            raise ValueError(f"{name}:{row['rowId']}: invalid uncertainty")


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    generated = read(HERE / "generator-output.jsonl")
    ids = [row["rowId"] for row in generated]
    b = read(HERE / "validator-b-labels.jsonl")
    c = read(HERE / "validator-c-labels.jsonl")
    validate(b, ids, "validator-b")
    validate(c, ids, "validator-c")
    accepted = []
    accepted_counts = Counter()
    validator_agreement = 0
    for source, left, right in zip(generated, b, c):
        validator_agreement += int(left["labels"] == right["labels"])
        if left["labels"] == source["targetLabels"] and right["labels"] == source["targetLabels"]:
            accepted.append(source)
            accepted_counts.update(source["targetLabels"] or ["<EMPTY>"])
    criteria = protocol["feasibilityGate"]
    checks = {
        "acceptedPerLabel": all(accepted_counts[label] >= criteria["acceptedPerLabelAtLeast"] for label in LABELS),
        "acceptedEmpty": accepted_counts["<EMPTY>"] >= criteria["acceptedEmptyAtLeast"],
    }
    passed = all(checks.values())
    selected = []
    if passed:
        by_target = defaultdict(list)
        for row in accepted:
            key = row["targetLabels"][0] if row["targetLabels"] else "<EMPTY>"
            by_target[key].append(row)
        for label in LABELS:
            selected.extend(sorted(by_target[label], key=lambda row: row["rowId"])[:12])
        selected.extend(sorted(by_target["<EMPTY>"], key=lambda row: row["rowId"])[:72])
        selected.sort(key=lambda row: row["rowId"])
        with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
            for row in selected:
                out = {
                    "rowId": row["rowId"], "text": row["text"],
                    "weakLabels": row["targetLabels"],
                    "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
                }
                handle.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE" if passed else "DO_NOT_TRAIN",
        "generatedRows": len(generated),
        "validatorExactAgreementRows": validator_agreement,
        "acceptedRows": len(accepted),
        "acceptedCounts": {key: accepted_counts[key] for key in [*LABELS, "<EMPTY>"]},
        "selectedTrainingRows": len(selected) if passed else 0,
        "checks": checks,
        "labelStatus": "MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        "humanReview": False,
        "adjudicatorUsed": False,
        "RTNUsed": False,
        "incumbentPredictionsUsed": False,
    }
    (HERE / "feasibility-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
