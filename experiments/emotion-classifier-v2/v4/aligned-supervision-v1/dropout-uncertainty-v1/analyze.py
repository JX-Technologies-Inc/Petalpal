#!/usr/bin/env python3
"""Measure stochastic-output instability on admitted short-event train text."""

import importlib.util
import itertools
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
HIPPO = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl"
UNEXPECTED = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/train.jsonl"
ROWS_PER_SOURCE = 512
SEEDS = [440, 441, 442, 443, 444]

spec = importlib.util.spec_from_file_location(
    "shared_run", ALIGNED / "selective-consensus-distillation-v1/run.py"
)
shared = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(shared)
canonical = shared.canonical


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def group_round_robin(rows: list[dict[str, object]], count: int, seed: int) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in sorted(rows, key=lambda item: str(item["id"])):
        grouped[str(row["sourceGroupId"])].append(row)
    groups = sorted(grouped)
    random.Random(seed).shuffle(groups)
    selected = []
    depth = 0
    while len(selected) < count:
        for group in groups:
            if depth < len(grouped[group]):
                selected.append(grouped[group][depth])
                if len(selected) == count:
                    return selected
        depth += 1
    return selected


@torch.inference_mode()
def stochastic_probabilities(model, tokenizer, texts: list[str], positions: list[int], seed: int) -> np.ndarray:
    torch.manual_seed(seed)
    model.train()
    values = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start : start + 32],
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        logits = model(**encoded).logits[:, positions]
        values.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(values)


def summarize(outputs_by_pass: list[list[list[str]]]) -> dict[str, object]:
    rows = len(outputs_by_pass[0])
    tuples = [[tuple(output) for output in pass_outputs] for pass_outputs in outputs_by_pass]
    unstable = sum(len({pass_outputs[index] for pass_outputs in tuples}) > 1 for index in range(rows))
    pairwise = [
        sum(left[index] == right[index] for index in range(rows)) / rows
        for left, right in itertools.combinations(tuples, 2)
    ]
    label_counts = {
        label: [sum(label in output for output in pass_outputs) for pass_outputs in tuples]
        for label in canonical.PRODUCT
    }
    output_counts = [
        {str(count): sum(len(output) == count for output in pass_outputs) for count in range(3)}
        for pass_outputs in tuples
    ]
    return {
        "rows": rows,
        "unstableRows": unstable,
        "unstablePercentage": 100 * unstable / rows,
        "allPassExactStableRows": rows - unstable,
        "meanPairwiseExactOutputAgreement": sum(pairwise) / len(pairwise),
        "minPairwiseExactOutputAgreement": min(pairwise),
        "maxPairwiseExactOutputAgreement": max(pairwise),
        "outputCountDistributionByPass": output_counts,
        "perLabelPredictionCountMeanStd": {
            label: {"mean": float(np.mean(counts)), "std": float(np.std(counts))}
            for label, counts in label_counts.items()
        },
    }


def main() -> None:
    protocol = json.loads((HERE / "protocol.json").read_text())
    assert protocol["status"] == "LOCKED_BEFORE_INFERENCE"
    torch.set_num_threads(4)
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    positions, _ = shared.model_positions(model)

    sources = {
        "hippocorpus": group_round_robin(read_jsonl(HIPPO), ROWS_PER_SOURCE, 44),
        "unexpectedEvents": group_round_robin(read_jsonl(UNEXPECTED), ROWS_PER_SOURCE, 44),
    }
    results = {}
    for name, rows in sources.items():
        assert len(rows) == ROWS_PER_SOURCE
        assert all(row["split"] == "train" and len(str(row["text"])) <= 300 for row in rows)
        texts = [str(row["text"]) for row in rows]
        fake = [{"id": row["id"], "modelLabels": []} for row in rows]
        outputs_by_pass = []
        for seed in SEEDS:
            probabilities = stochastic_probabilities(model, tokenizer, texts, positions, seed)
            outputs_by_pass.append(canonical.report(fake, probabilities, 0.35)["outputs"])
        results[name] = summarize(outputs_by_pass)

    feasible = any(
        value["unstablePercentage"] >= 15.0
        or value["meanPairwiseExactOutputAgreement"] < 0.90
        for value in results.values()
    )
    result = {
        "status": "PASS",
        "decision": "DESIGN_ONE_CONSISTENCY_CANDIDATE" if feasible else "DO_NOT_TRAIN",
        "trainingPerformed": False,
        "sources": results,
        "feasibilityGatePassed": feasible,
        "validationSplitsOpened": False,
        "interpretation": "Stochastic dropout instability is only a research uncertainty proxy; it is not emotion correctness or promotion evidence.",
        "frozenFinalEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
