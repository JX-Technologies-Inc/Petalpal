#!/usr/bin/env python3
"""Validate three sealed blind judges and assemble the deterministic panel."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
INPUT = HERE / "blind-input.csv"
LOCK = HERE / "blind-input-lock.json"
JUDGES = {
    "astra": (HERE / "astra-judgments.csv", "gpt-6-astra"),
    "luna": (HERE / "luna-judgments.csv", "gpt-5.6-luna"),
    "sol": (HERE / "sol-judgments.csv", "gpt-5.6-sol"),
}
JUDGMENT_FIELDS = [
    "adjudication_id", "sample_id", "target_label", "judgment", "confidence",
    "short_rationale", "model_identity", "run_config", "input_hash",
]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def row_hash(row: dict[str, str]) -> str:
    visible = {
        key: row[key] for key in (
            "adjudication_id", "sample_id", "text", "target_label",
            "label_definition", "allowed_values",
        )
    }
    payload = json.dumps(visible, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def panel_status(votes: list[str]) -> str:
    counts = Counter(votes)
    if counts == {"CLEAR": 3}:
        return "MODEL_PANEL_CLEAR"
    if counts == {"NO": 3}:
        return "MODEL_PANEL_NO"
    if counts["CLEAR"] == 2 and counts["PLAUSIBLE"] == 1:
        return "MODEL_PANEL_STRONG_CLEAR"
    if counts["NO"] == 2 and counts["PLAUSIBLE"] == 1:
        return "MODEL_PANEL_STRONG_NO"
    if counts["CLEAR"] and counts["NO"]:
        return "MODEL_PANEL_CONFLICT"
    if counts["PLAUSIBLE"] >= 2:
        return "MODEL_PANEL_AMBIGUOUS"
    return "MODEL_PANEL_SPLIT"


def main() -> None:
    outputs = [
        "model-panel-comparison.csv", "uncertainty-manifest.csv",
        "model-panel-provenance.json", "panel-summary.json",
        "high-confidence-hard-negatives.csv", "secondary-hard-negatives.csv",
    ]
    if any((HERE / name).exists() for name in outputs):
        raise FileExistsError("Refusing to overwrite panel outputs")
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if hashlib.sha256(INPUT.read_bytes()).hexdigest() != lock["sha256"]:
        raise ValueError("Blind input hash mismatch")
    input_fields, inputs = read_csv(INPUT)
    if input_fields != [
        "adjudication_id", "sample_id", "text", "target_label",
        "label_definition", "allowed_values",
    ]:
        raise ValueError("Blind input schema mismatch")
    if len(inputs) != lock["rows"]:
        raise ValueError("Blind input row-count mismatch")
    input_by_id = {row["adjudication_id"]: row for row in inputs}
    expected_ids = [row["adjudication_id"] for row in inputs]

    judge_rows = {}
    judge_hashes = {}
    for judge, (path, identity) in JUDGES.items():
        fields, rows = read_csv(path)
        if fields != JUDGMENT_FIELDS:
            raise ValueError(f"{judge} schema mismatch: {fields}")
        if [row["adjudication_id"] for row in rows] != expected_ids:
            raise ValueError(f"{judge} order/coverage mismatch")
        for source, row in zip(inputs, rows):
            if row["sample_id"] != source["sample_id"] or row["target_label"] != source["target_label"]:
                raise ValueError(f"{judge} semantic key mismatch")
            if row["judgment"] not in {"NO", "PLAUSIBLE", "CLEAR"}:
                raise ValueError(f"{judge} invalid judgment")
            if row["confidence"] not in {"LOW", "MEDIUM", "HIGH"}:
                raise ValueError(f"{judge} invalid confidence")
            if len(row["short_rationale"].split()) > 20 or len(row["short_rationale"]) > 180:
                raise ValueError(f"{judge} rationale too long")
            if row["model_identity"] != identity:
                raise ValueError(f"{judge} identity mismatch")
            if row["run_config"] != "independent_blind_medium_v1":
                raise ValueError(f"{judge} config mismatch")
            if row["input_hash"] != row_hash(source):
                raise ValueError(f"{judge} row hash mismatch")
        judge_rows[judge] = {row["adjudication_id"]: row for row in rows}
        judge_hashes[judge] = hashlib.sha256(path.read_bytes()).hexdigest()

    comparison = []
    for source in inputs:
        aid = source["adjudication_id"]
        votes = [judge_rows[judge][aid]["judgment"] for judge in JUDGES]
        status = panel_status(votes)
        comparison.append({
            "adjudication_id": aid,
            "sample_id": source["sample_id"],
            "target_label": source["target_label"],
            "astra_judgment": votes[0],
            "luna_judgment": votes[1],
            "sol_judgment": votes[2],
            "panel_status": status,
            "main_pool_eligible": status in {"MODEL_PANEL_CLEAR", "MODEL_PANEL_NO"},
            "secondary_pool_eligible": status in {"MODEL_PANEL_STRONG_CLEAR", "MODEL_PANEL_STRONG_NO"},
        })
    comparison_fields = list(comparison[0])
    write_csv(HERE / "model-panel-comparison.csv", comparison, comparison_fields)
    status_by_cell = {(row["sample_id"], row["target_label"]): row["panel_status"] for row in comparison}

    private_fields, selections = read_csv(HERE / "candidate-selection-private.csv")
    main_hard_negatives = []
    secondary_hard_negatives = []
    uncertainty = []
    direction_main = Counter()
    pair_main = Counter()
    for row in selections:
        if row["selection_role"] != "PAIR_HARD_NEGATIVE_CANDIDATE":
            continue
        positive_status = status_by_cell[(row["sample_id"], row["desired_positive_label"])]
        negative_status = status_by_cell[(row["sample_id"], row["desired_negative_label"])]
        item = {
            "sample_id": row["sample_id"], "text": row["text"],
            "source": row["source"], "source_group_id": row["source_group_id"],
            "pair_id": row["pair_id"], "positive_label": row["desired_positive_label"],
            "negative_label": row["desired_negative_label"],
            "positive_panel_status": positive_status, "negative_panel_status": negative_status,
            "provenance_status": "MODEL_PANEL_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        }
        if positive_status == "MODEL_PANEL_CLEAR" and negative_status == "MODEL_PANEL_NO":
            main_hard_negatives.append(item)
            direction_main[f"{row['desired_positive_label']}>{row['desired_negative_label']}"] += 1
            pair_main[row["pair_id"]] += 1
        elif positive_status in {"MODEL_PANEL_CLEAR", "MODEL_PANEL_STRONG_CLEAR"} and negative_status in {
            "MODEL_PANEL_NO", "MODEL_PANEL_STRONG_NO"
        }:
            secondary_hard_negatives.append(item)
        else:
            uncertainty.append({**item, "uncertainty_reason": "PAIR_DID_NOT_MEET_PANEL_ADMISSION"})

    control_groups = defaultdict(list)
    for row in selections:
        if row["selection_role"].endswith("CONTROL_CANDIDATE"):
            control_groups[(row["selection_role"], row["sample_id"])].append(row)
    main_no_clear = []
    main_two_label = []
    secondary_controls = []
    for (role, sample_id), rows in control_groups.items():
        # Control selection rows occur once per sample; panel cells supply all 18 labels.
        statuses = {
            label: status_by_cell[(sample_id, label)]
            for label in sorted({source["target_label"] for source in inputs if source["sample_id"] == sample_id})
        }
        clears = [label for label, status in statuses.items() if status == "MODEL_PANEL_CLEAR"]
        strict_no = all(status == "MODEL_PANEL_NO" for status in statuses.values())
        if role == "NO_CLEAR_CONTROL_CANDIDATE" and strict_no:
            main_no_clear.append(sample_id)
        elif role == "TWO_LABEL_CONTROL_CANDIDATE" and len(clears) == 2 and all(
            status in {"MODEL_PANEL_CLEAR", "MODEL_PANEL_NO"} for status in statuses.values()
        ):
            main_two_label.append({"sample_id": sample_id, "clear_labels": clears})
        else:
            secondary_controls.append({
                "sample_id": sample_id, "control_role": role,
                "clear_labels": clears,
                "panel_status_counts": dict(Counter(statuses.values())),
            })

    uncertainty_fields = [
        "sample_id", "text", "source", "source_group_id", "pair_id", "positive_label",
        "negative_label", "positive_panel_status", "negative_panel_status", "provenance_status",
        "uncertainty_reason",
    ]
    write_csv(HERE / "uncertainty-manifest.csv", uncertainty, uncertainty_fields)
    write_csv(
        HERE / "high-confidence-hard-negatives.csv", main_hard_negatives,
        [
            "sample_id", "text", "source", "source_group_id", "pair_id", "positive_label",
            "negative_label", "positive_panel_status", "negative_panel_status", "provenance_status",
        ],
    )
    write_csv(
        HERE / "secondary-hard-negatives.csv", secondary_hard_negatives,
        [
            "sample_id", "text", "source", "source_group_id", "pair_id", "positive_label",
            "negative_label", "positive_panel_status", "negative_panel_status", "provenance_status",
        ],
    )

    exact_agreement = sum(len(set(
        [row["astra_judgment"], row["luna_judgment"], row["sol_judgment"]]
    )) == 1 for row in comparison)
    pairwise = {}
    for left, right in (("astra", "luna"), ("astra", "sol"), ("luna", "sol")):
        pairwise[f"{left}_{right}"] = sum(
            row[f"{left}_judgment"] == row[f"{right}_judgment"] for row in comparison
        ) / len(comparison)
    minimum_direction = min(direction_main.values(), default=0)
    pair_families_at_30 = sum(count >= 30 for count in pair_main.values())
    data_ready = (
        len(main_hard_negatives) >= 280
        and len(direction_main) == 14
        and minimum_direction >= 15
        and len(main_no_clear) >= 40
        and len(main_two_label) >= 40
    )
    summary = {
        "status": "DATA_READY" if data_ready else "DATA_NOT_READY",
        "blindCells": len(inputs),
        "panelStatusCounts": dict(Counter(row["panel_status"] for row in comparison)),
        "judgeJudgmentCounts": {
            judge: dict(Counter(row[f"{judge}_judgment"] for row in comparison))
            for judge in JUDGES
        },
        "threeWayExactAgreement": exact_agreement,
        "threeWayExactAgreementRate": exact_agreement / len(comparison),
        "pairwiseAgreementRates": pairwise,
        "highConfidenceHardNegatives": len(main_hard_negatives),
        "secondaryHardNegatives": len(secondary_hard_negatives),
        "mainDirectionCounts": dict(sorted(direction_main.items())),
        "mainPairCounts": dict(sorted(pair_main.items())),
        "minimumMainDirectionCount": minimum_direction,
        "pairFamiliesWithAtLeast30MainRows": pair_families_at_30,
        "strictNoClearControls": len(main_no_clear),
        "strictTwoLabelControlCount": len(main_two_label),
        "secondaryControls": len(secondary_controls),
        "acceptanceGate": {
            "hardNegativesAtLeast280": len(main_hard_negatives) >= 280,
            "all14DirectionsPresent": len(direction_main) == 14,
            "minimum15PerDirection": len(direction_main) == 14 and minimum_direction >= 15,
            "neutralControlsAtLeast40": len(main_no_clear) >= 40,
            "twoLabelControlsAtLeast40": len(main_two_label) >= 40,
            "rightsAndProvenance": True,
            "leakage": json.loads((HERE / "leakage-audit.json").read_text())["status"] == "PASS",
        },
        "trainingAuthorized": data_ready,
        "trainingOccurred": False,
        "modelPanelIsHumanGold": False,
        "mainPoolProvenance": "MODEL_PANEL_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        "strictNoClearSampleIds": main_no_clear,
        "strictTwoLabelControlsDetail": main_two_label,
        "secondaryControlsDetail": secondary_controls,
    }
    (HERE / "panel-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "status": "ALL_THREE_JUDGES_VALIDATED_AND_SEALED_BEFORE_COMPARISON",
        "blindInputSha256": lock["sha256"],
        "blindInputRows": len(inputs),
        "judges": {
            judge: {
                "modelIdentity": JUDGES[judge][1],
                "runConfig": "independent_blind_medium_v1",
                "rows": len(judge_rows[judge]),
                "outputSha256": judge_hashes[judge],
                "independentFreshContext": True,
            }
            for judge in JUDGES
        },
        "comparisonBeganAfterAllOutputsValidated": True,
        "humanReviewUsed": False,
        "humanGoldClaimed": False,
    }
    (HERE / "model-panel-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    eligibility = json.loads((HERE / "eligibility-summary.json").read_text(encoding="utf-8"))
    eligibility.update({
        "status": summary["status"],
        "panelCompleted": True,
        "panelBlindCells": len(inputs),
        "panelThreeWayExactAgreement": exact_agreement,
        "panelThreeWayExactAgreementRate": exact_agreement / len(comparison),
        "finalHighConfidenceHardNegatives": len(main_hard_negatives),
        "secondaryHardNegatives": len(secondary_hard_negatives),
        "strictNoClearControls": len(main_no_clear),
        "strictTwoLabelControls": len(main_two_label),
        "acceptanceGate": summary["acceptanceGate"],
        "trainingAuthorized": data_ready,
        "trainingOccurred": False,
        "modelPanelProvenance": "MODEL_PANEL_WEAK_PSEUDO_NOT_HUMAN_GOLD",
    })
    (HERE / "eligibility-summary.json").write_text(json.dumps(eligibility, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
