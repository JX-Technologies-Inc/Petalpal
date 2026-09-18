#!/usr/bin/env python3
"""Attach native Unexpected Events valence labels without Product-18 mapping."""

import csv
import json
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
SOURCE_BASE = ALIGNED / "admitted-unlabeled-v1/unexpected-events"
RELEASE = SOURCE_BASE / "raw/release"
PREPARED = SOURCE_BASE / "prepared"
SOURCES = {
    "experiment-1": (RELEASE / "0_data/0_Experiment1/expt1_master_post_resolve.csv", "best_senti"),
    "experiment-2": (RELEASE / "2_pipeline/expt2_master_data.csv", "best_senti"),
    "experiment-3": (RELEASE / "0_data/3_Experiment3/expt3_master_post_resolve.csv", "val_code"),
}
ALLOWED = {"pos", "neg", "neither"}


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_DATA_PREPARATION"
    native = {}
    for experiment, (path, field) in SOURCES.items():
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for line, row in enumerate(csv.DictReader(handle), start=2):
                value = row.get(field, "").strip()
                native[f"unexpected-events-{experiment}-{line:06d}"] = value

    output_rows = {"train": [], "validation": []}
    missing = []
    for split in output_rows:
        for row in read_jsonl(PREPARED / f"{split}.jsonl"):
            value = native.get(str(row["sourceRecordId"]), "")
            if value not in ALLOWED:
                missing.append({"sourceRecordId": row["sourceRecordId"], "value": value})
                continue
            output_rows[split].append(
                {
                    "id": row["id"],
                    "text": row["text"],
                    "sourceGroupId": row["sourceGroupId"],
                    "split": split,
                    "nativeValence": value,
                    "labelStatus": "NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD",
                    "dataset": "Unexpected Events",
                }
            )

    train_groups = {row["sourceGroupId"] for row in output_rows["train"]}
    validation_groups = {row["sourceGroupId"] for row in output_rows["validation"]}
    counts = {
        split: Counter(row["nativeValence"] for row in rows) for split, rows in output_rows.items()
    }
    prepared_total = sum(
        len(read_jsonl(PREPARED / f"{split}.jsonl")) for split in ("train", "validation")
    )
    criteria = protocol["dataFeasibilityPassCriteria"]
    checks = {
        "coverage": sum(map(len, output_rows.values())) / prepared_total
        >= criteria["labeledPreparedCoverageAtLeast"],
        "trainClassCoverage": all(
            counts["train"][label] >= criteria["eachTrainClassAtLeast"] for label in ALLOWED
        ),
        "validationClassCoverage": all(
            counts["validation"][label] >= criteria["eachValidationClassAtLeast"] for label in ALLOWED
        ),
        "groupIsolation": train_groups.isdisjoint(validation_groups),
    }
    passed = all(checks.values())
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "TRAIN_ONE_FIXED_AUXILIARY_CANDIDATE" if passed else "DO_NOT_TRAIN",
        "preparedRows": prepared_total,
        "labeledRows": sum(map(len, output_rows.values())),
        "coverage": sum(map(len, output_rows.values())) / prepared_total,
        "missingRows": missing,
        "classCounts": {split: dict(sorted(value.items())) for split, value in counts.items()},
        "sourceGroups": {"train": len(train_groups), "validation": len(validation_groups)},
        "checks": checks,
        "labelStatus": "NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD",
        "product18MappingPerformed": False,
        "humanReviewPerformed": False,
    }
    (HERE / "data-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    if passed:
        for split, rows in output_rows.items():
            with (HERE / f"valence-{split}.jsonl").open("w", encoding="utf-8") as handle:
                for row in rows:
                    handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
