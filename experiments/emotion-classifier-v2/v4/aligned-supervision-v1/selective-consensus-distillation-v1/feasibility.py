#!/usr/bin/env python3
"""Create conservative weak labels from two frozen research teachers."""

import importlib.util
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
HIPPO_TRAIN = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl"
UNEXPECTED_TRAIN = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/train.jsonl"
TEACHERS = {
    "incumbent": ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint",
    "domainRestoration": ALIGNED / "domain-restoration-v1/experiment/epoch-1-checkpoint",
}
POSITIVE_CONFIDENCE = 0.70
NEGATIVE_CONFIDENCE = 0.10
POOL_ROWS_PER_SOURCE = 2637
SEED = 44

spec = importlib.util.spec_from_file_location(
    "canonical_experiment", ALIGNED.parents[1] / "v4/auto-v1/experiment.py"
)
canonical = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(canonical)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def unexpected_round_robin(rows: list[dict[str, object]], count: int) -> list[dict[str, object]]:
    by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in sorted(rows, key=lambda item: str(item["id"])):
        by_group[str(row["sourceGroupId"])].append(row)
    groups = sorted(by_group)
    random.Random(SEED).shuffle(groups)
    selected = []
    depth = 0
    while len(selected) < count:
        added = 0
        for group in groups:
            if depth < len(by_group[group]):
                selected.append(by_group[group][depth])
                added += 1
                if len(selected) == count:
                    break
        if not added:
            break
        depth += 1
    assert len(selected) == count
    return selected


@torch.inference_mode()
def infer(checkpoint: Path, texts: list[str], device: torch.device) -> np.ndarray:
    tokenizer = AutoTokenizer.from_pretrained(checkpoint, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, local_files_only=True)
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    model.to(device).eval()
    outputs = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start : start + 32],
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        outputs.append(torch.sigmoid(logits).cpu().numpy())
    del model
    if device.type == "mps":
        torch.mps.empty_cache()
    return np.concatenate(outputs)


def selected_outputs(probabilities: np.ndarray, ids: list[str]) -> list[list[str]]:
    fake_rows = [{"id": row_id, "modelLabels": []} for row_id in ids]
    return canonical.report(fake_rows, probabilities, 0.35)["outputs"]


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_FEASIBILITY_INFERENCE"
    assert protocol["pseudoLabelPolicy"]["status"] == "WEAK_PSEUDO_NOT_HUMAN_GOLD"
    torch.set_num_threads(4)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

    hippocorpus = read_jsonl(HIPPO_TRAIN)
    unexpected_all = read_jsonl(UNEXPECTED_TRAIN)
    assert len(hippocorpus) == POOL_ROWS_PER_SOURCE
    unexpected = unexpected_round_robin(unexpected_all, POOL_ROWS_PER_SOURCE)
    assert all(row["split"] == "train" and len(str(row["text"])) <= 300 for row in hippocorpus + unexpected)
    assert {row["sourceGroupId"] for row in unexpected}.issubset(
        {row["sourceGroupId"] for row in unexpected_all}
    )

    pool = [dict(row, weakSource="hippocorpus") for row in hippocorpus] + [
        dict(row, weakSource="unexpectedEvents") for row in unexpected
    ]
    texts = [str(row["text"]) for row in pool]
    ids = [str(row["id"]) for row in pool]
    probabilities = {
        name: infer(checkpoint, texts, device) for name, checkpoint in TEACHERS.items()
    }
    for name, values in probabilities.items():
        assert values.shape == (len(pool), len(canonical.LABELS))
        np.save(HERE / f"{name}-train-pool-probabilities.npy", values)

    outputs = {name: selected_outputs(values, ids) for name, values in probabilities.items()}
    product_positions = {label: canonical.LABELS.index(label) for label in canonical.PRODUCT}
    weak_rows = []
    source_stats = defaultdict(Counter)
    positive_counts = Counter()
    exact_agreement = 0
    for index, row in enumerate(pool):
        first = outputs["incumbent"][index]
        second = outputs["domainRestoration"][index]
        agrees = first == second
        exact_agreement += int(agrees)
        selected = list(first) if agrees else []
        strong_positives = [
            label
            for label in selected
            if min(
                probabilities["incumbent"][index, product_positions[label]],
                probabilities["domainRestoration"][index, product_positions[label]],
            )
            >= POSITIVE_CONFIDENCE
        ]
        strong_negatives = [
            label
            for label in canonical.PRODUCT
            if max(
                probabilities["incumbent"][index, product_positions[label]],
                probabilities["domainRestoration"][index, product_positions[label]],
            )
            <= NEGATIVE_CONFIDENCE
        ]
        confident_abstention = agrees and not selected and len(strong_negatives) == len(canonical.PRODUCT)
        positive_eligible = agrees and bool(selected) and len(strong_positives) == len(selected)
        eligible = positive_eligible or confident_abstention
        source = str(row["weakSource"])
        source_stats[source]["poolRows"] += 1
        source_stats[source]["exactAgreementRows"] += int(agrees)
        source_stats[source]["eligibleRows"] += int(eligible)
        source_stats[source]["confidentAbstentionRows"] += int(confident_abstention)
        if eligible:
            positive_counts.update(strong_positives)
            weak_rows.append(
                {
                    "id": row["id"],
                    "text": row["text"],
                    "sourceGroupId": row["sourceGroupId"],
                    "sourceDataset": row["dataset"],
                    "sourceRole": row.get("domainRole", "PRIMARY_FIRST_PERSON_EVENT"),
                    "labelStatus": "WEAK_PSEUDO_NOT_HUMAN_GOLD",
                    "weakLabels": strong_positives,
                    "strongNegativeLabels": strong_negatives,
                    "confidentAbstention": confident_abstention,
                }
            )

    criteria = protocol["feasibilityPassCriteria"]
    labels_with_20 = sum(count >= 20 for count in positive_counts.values())
    abstentions = sum(row["confidentAbstention"] for row in weak_rows)
    checks = {
        "eligibleRows": len(weak_rows) >= criteria["eligibleRowsAtLeast"],
        "eligibleRowsPerSource": all(
            source_stats[source]["eligibleRows"] >= criteria["eligibleRowsPerSourceAtLeast"]
            for source in ("hippocorpus", "unexpectedEvents")
        ),
        "labelCoverage": labels_with_20 >= criteria["labelsWithAtLeast20StrongPositivesAtLeast"],
        "confidentAbstentions": abstentions >= criteria["confidentAbstentionRowsAtLeast"],
    }
    passed = all(checks.values())
    audit = {
        "status": "PASS" if passed else "FAIL",
        "decision": "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE" if passed else "DO_NOT_TRAIN",
        "device": str(device),
        "trainingPerformed": False,
        "humanReviewPerformed": False,
        "labelStatus": "WEAK_PSEUDO_NOT_HUMAN_GOLD",
        "pool": {
            "rows": len(pool),
            "rowsPerSource": POOL_ROWS_PER_SOURCE,
            "sourceGroups": {
                source: len({row["sourceGroupId"] for row in pool if row["weakSource"] == source})
                for source in ("hippocorpus", "unexpectedEvents")
            },
            "exactTeacherOutputAgreementRows": exact_agreement,
            "exactTeacherOutputAgreementPercentage": 100 * exact_agreement / len(pool),
        },
        "eligibility": {
            "rows": len(weak_rows),
            "sourceStats": {source: dict(values) for source, values in sorted(source_stats.items())},
            "confidentAbstentionRows": abstentions,
            "strongPositiveCounts": dict(sorted(positive_counts.items())),
            "labelsWithAtLeast20StrongPositives": labels_with_20,
        },
        "fixedCriteria": criteria,
        "checks": checks,
        "validationSplitsOpened": False,
        "historicalDevelopmentOpenedForThresholdSelection": False,
        "frozenFinalEvaluationOpened": False,
        "rights": {
            "texts": "ADMIT_UNLABELED",
            "teachers": "HISTORICAL_UNRESOLVED_LINEAGE_RESEARCH_ONLY",
            "candidateIfTrained": "RESEARCH_ONLY_NOT_PRODUCTION_CLEARED",
        },
    }
    (HERE / "feasibility-audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    if passed:
        with (HERE / "weak-train.jsonl").open("w", encoding="utf-8") as handle:
            for row in weak_rows:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
