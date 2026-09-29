#!/usr/bin/env python3
"""Static integrity checks for confusion-aware-hard-negative-v1 artifacts."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent


def rows(name: str) -> list[dict[str, str]]:
    with (HERE / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    required = [
        "confusion-pair-priority.csv", "existing-hard-negative-candidates.csv",
        "source-audit.json", "leakage-audit.json", "eligibility-summary.json", "REPORT.md",
        "blind-input.csv", "astra-judgments.csv", "luna-judgments.csv", "sol-judgments.csv",
        "model-panel-comparison.csv", "uncertainty-manifest.csv", "model-panel-provenance.json",
        "high-confidence-hard-negatives.csv", "secondary-hard-negatives.csv", "panel-summary.json",
    ]
    missing = [name for name in required if not (HERE / name).is_file()]
    if missing:
        raise ValueError(f"Missing artifacts: {missing}")
    for name in (
        "source-audit.json", "leakage-audit.json", "eligibility-summary.json",
        "model-panel-provenance.json", "panel-summary.json", "blind-input-lock.json",
    ):
        json.loads((HERE / name).read_text(encoding="utf-8"))
    lock = json.loads((HERE / "blind-input-lock.json").read_text())
    assert hashlib.sha256((HERE / "blind-input.csv").read_bytes()).hexdigest() == lock["sha256"]
    assert len(rows("confusion-pair-priority.csv")) == 7
    assert len(rows("existing-hard-negative-candidates.csv")) == 1152
    assert len(rows("blind-input.csv")) == 1005
    for name in ("astra-judgments.csv", "luna-judgments.csv", "sol-judgments.csv"):
        assert len(rows(name)) == 1005
    assert len(rows("model-panel-comparison.csv")) == 1005
    assert len(rows("high-confidence-hard-negatives.csv")) == 9
    assert len(rows("secondary-hard-negatives.csv")) == 40
    assert len(rows("uncertainty-manifest.csv")) == 371
    provenance = json.loads((HERE / "model-panel-provenance.json").read_text())
    for judge in ("astra", "luna", "sol"):
        path = HERE / f"{judge}-judgments.csv"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == provenance["judges"][judge]["outputSha256"]
    leakage = json.loads((HERE / "leakage-audit.json").read_text())
    assert leakage["status"] == "PASS"
    assert leakage["exactNormalizedOverlap"] == 0
    assert leakage["lexicalNearDuplicateOverlap"] == 0
    assert leakage["sourceGroupOverlap"] == 0
    summary = json.loads((HERE / "panel-summary.json").read_text())
    eligibility = json.loads((HERE / "eligibility-summary.json").read_text())
    assert summary["status"] == eligibility["status"] == "DATA_NOT_READY"
    assert summary["highConfidenceHardNegatives"] == eligibility["finalHighConfidenceHardNegatives"] == 9
    assert summary["trainingAuthorized"] is False and summary["trainingOccurred"] is False
    assert eligibility["trainingAuthorized"] is False and eligibility["trainingOccurred"] is False
    print(json.dumps({
        "status": "PASS", "blindCells": 1005, "judgeRowsEach": 1005,
        "highConfidenceHardNegatives": 9, "secondaryHardNegatives": 40,
        "decision": "DATA_NOT_READY", "trainingOccurred": False,
    }, indent=2))


if __name__ == "__main__":
    main()
