#!/usr/bin/env python3
"""Train and evaluate the single frozen independent-consensus candidate."""

from __future__ import annotations

import importlib.util
import json
import math
import random
import time
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
WEAK = HERE / "weak-train.jsonl"
OUTPUT = HERE / "candidate"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
VALIDATIONS = {
    "hippocorpus": ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl",
    "unexpectedEvents": ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl",
}
SEED = 46
LR = 1e-6
BATCH = 16
MAX_LENGTH = 512


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module("canonical_experiment", V4 / "auto-v1/experiment.py")
rtn_eval = load_module(
    "rtn_baseline_evaluator", REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analyze.py"
)
PRODUCT = list(canonical.PRODUCT)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


class WeakDataset(Dataset):
    def __init__(self, rows: list[dict[str, Any]], tokenizer):
        self.rows = rows
        self.encoded = tokenizer(
            [str(row["text"]) for row in rows], truncation=True, max_length=MAX_LENGTH
        )
        self.targets = [
            [float(label in set(row["weakLabels"])) for label in PRODUCT] for row in rows
        ]

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, Any]:
        return {
            **{key: value[index] for key, value in self.encoded.items()},
            "targets": self.targets[index],
        }


def collate(tokenizer):
    def make_batch(rows: list[dict[str, Any]]) -> dict[str, torch.Tensor]:
        targets = torch.tensor([row["targets"] for row in rows], dtype=torch.float32)
        encoded = tokenizer.pad(
            [{key: value for key, value in row.items() if key != "targets"} for row in rows],
            padding=True,
            return_tensors="pt",
        )
        return {**encoded, "targets": targets}

    return make_batch


def positions(model, labels: list[str]) -> list[int]:
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    return [next(index for index, value in id2label.items() if value == label) for label in labels]


@torch.inference_mode()
def infer(model, tokenizer, texts: list[str], label_positions: list[int], device) -> np.ndarray:
    model.eval()
    outputs = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start : start + 32], padding=True, truncation=True,
            max_length=MAX_LENGTH, return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits
        outputs.append(torch.sigmoid(logits[:, label_positions]).cpu().numpy())
    return np.concatenate(outputs)


def to_canonical21(product_probabilities: np.ndarray) -> np.ndarray:
    result = np.zeros((len(product_probabilities), len(canonical.LABELS)), dtype=np.float32)
    for source, label in enumerate(PRODUCT):
        result[:, canonical.LABELS.index(label)] = product_probabilities[:, source]
    return result


def labeled_report(rows: list[dict[str, Any]], probabilities21: np.ndarray) -> dict[str, Any]:
    report = canonical.report(rows, probabilities21, 0.35)
    truth = [set(row["modelLabels"]) & set(PRODUCT) for row in rows]
    predicted = [set(output) & set(PRODUCT) for output in report["outputs"]]
    return {
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "exactSet": sum(left == right for left, right in zip(truth, predicted)) / len(rows),
        "falsePositives": sum(len(output - expected) for output, expected in zip(predicted, truth)),
        "falseNegatives": sum(len(expected - output) for output, expected in zip(predicted, truth)),
        "outputCountDistribution": report["product"]["outputCountDistribution"],
    }


def unlabeled_behavior(rows, incumbent21, candidate21) -> dict[str, Any]:
    fake = [{"id": row["id"], "modelLabels": []} for row in rows]
    incumbent = canonical.report(fake, incumbent21, 0.35)
    candidate = canonical.report(fake, candidate21, 0.35)
    left, right = incumbent["outputs"], candidate["outputs"]
    return {
        "rows": len(rows),
        "exactOutputAgreement": sum(a == b for a, b in zip(left, right)) / len(rows),
        "incumbentOutputCountDistribution": incumbent["product"]["outputCountDistribution"],
        "candidateOutputCountDistribution": candidate["product"]["outputCountDistribution"],
        "candidatePerLabelPredicted": dict(Counter(label for labels in right for label in labels)),
        "correctnessMetric": False,
    }


def rtn_comparison(candidate_sets: list[set[str]]) -> dict[str, Any]:
    consensus = read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    baseline = json.loads(
        (REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analysis.json").read_text(encoding="utf-8")
    )
    high_indices = [i for i, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved_indices = [i for i, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]

    def evaluate(indices):
        truth = [set(consensus[i]["consensusLabels"]) for i in indices]
        predicted = [candidate_sets[i] for i in indices]
        return rtn_eval.evaluate(truth, predicted)

    return {
        "referenceRole": "MODEL_GENERATED_WEAK_PSEUDO_REFERENCE_NOT_HUMAN_GOLD",
        "incumbent": {"highConsensus": baseline["highConsensus"], "resolved": baseline["resolved"]},
        "candidate": {"highConsensus": evaluate(high_indices), "resolved": evaluate(resolved_indices)},
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    audit = json.loads((HERE / "feasibility-audit.json").read_text(encoding="utf-8"))
    if audit["status"] != "PASS" or audit["decision"] != "TRAIN_ONE_FIXED_RESEARCH_CANDIDATE":
        raise ValueError("Feasibility gate did not authorize training")
    weak = read_jsonl(WEAK)
    if len(weak) != audit["weakTrainingRows"] or not weak:
        raise ValueError("Weak training rows do not match frozen feasibility audit")
    if not all(row["labelStatus"] == "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD" for row in weak):
        raise ValueError("Invalid weak-label status")

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    product_positions = positions(model, PRODUCT)
    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable_names = []
    for name, parameter in model.named_parameters():
        if name.startswith("classifier.") or ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable_names.append(name)
    if not any(name.startswith("classifier.") for name in trainable_names):
        raise ValueError("Classifier was not made trainable")
    if not all(any(f".encoder.layer.{layer}." in name for name in trainable_names) for layer in (10, 11)):
        raise ValueError("Top two encoder layers were not made trainable")
    model.to(device)

    loader = DataLoader(
        WeakDataset(weak, tokenizer), batch_size=BATCH, shuffle=True,
        generator=torch.Generator().manual_seed(SEED), collate_fn=collate(tokenizer),
    )
    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=LR, weight_decay=0.01,
    )
    scheduler = get_linear_schedule_with_warmup(
        optimizer, math.ceil(0.1 * len(loader)), len(loader)
    )
    started = time.time()
    model.train()
    total_loss = 0.0
    total_rows = 0
    for batch_index, batch in enumerate(loader, 1):
        targets = batch.pop("targets").to(device)
        logits = model(**{key: value.to(device) for key, value in batch.items()}).logits[:, product_positions]
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            [parameter for parameter in model.parameters() if parameter.requires_grad], 1.0
        )
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        total_loss += float(loss.detach().cpu()) * len(targets)
        total_rows += len(targets)
        if batch_index % 20 == 0:
            print(json.dumps({"event": "train", "batch": batch_index, "batches": len(loader)}), flush=True)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")

    # The candidate is now final. Only now open frozen diagnostics and prepared validations.
    dev = read_jsonl(DEV)
    incumbent_dev21 = np.load(INCUMBENT_DEV)
    candidate_dev18 = infer(model, tokenizer, [str(row["journal"]) for row in dev], product_positions, device)
    candidate_dev21 = to_canonical21(candidate_dev18)
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev21)
    incumbent_coso = labeled_report(dev, incumbent_dev21)
    candidate_coso = labeled_report(dev, candidate_dev21)

    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    candidate_rtn18 = infer(model, tokenizer, [str(row["text"]) for row in reference], product_positions, device)
    candidate_rtn21 = to_canonical21(candidate_rtn18)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn21)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_rtn_outputs = canonical.report(fake, candidate_rtn21, 0.35)["outputs"]
    rtn = rtn_comparison([set(labels) & set(PRODUCT) for labels in candidate_rtn_outputs])

    validation = {}
    incumbent_model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    incumbent_model.to(device)
    for name, path in VALIDATIONS.items():
        rows = read_jsonl(path)
        texts = [str(row["text"]) for row in rows]
        incumbent21 = to_canonical21(infer(incumbent_model, tokenizer, texts, product_positions, device))
        candidate21 = to_canonical21(infer(model, tokenizer, texts, product_positions, device))
        validation[name] = unlabeled_behavior(rows, incumbent21, candidate21)
    del incumbent_model

    supported_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in PRODUCT if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    incumbent_resolved = rtn["incumbent"]["resolved"]
    candidate_resolved = rtn["candidate"]["resolved"]
    incumbent_high = rtn["incumbent"]["highConsensus"]
    candidate_high = rtn["candidate"]["highConsensus"]
    distribution_error = sum(
        abs(candidate_resolved["incumbentCountDistribution"][str(size)] - candidate_resolved["consensusCountDistribution"][str(size)])
        for size in range(3)
    )
    gates = {
        "rtnResolvedMicroF1": candidate_resolved["micro"]["f1"] >= 0.3313265306,
        "rtnResolvedExact": candidate_resolved["exactSetAgreement"]["percent"] >= incumbent_resolved["exactSetAgreement"]["percent"],
        "rtnResolvedPrecision": candidate_resolved["micro"]["precision"] >= incumbent_resolved["micro"]["precision"] - 0.02,
        "rtnResolvedRecall": candidate_resolved["micro"]["recall"] >= incumbent_resolved["micro"]["recall"],
        "rtnResolvedFP": candidate_resolved["falsePositives"] <= 64,
        "rtnResolvedFN": candidate_resolved["falseNegatives"] <= 85,
        "rtnResolvedDistribution": distribution_error <= 54,
        "rtnHighMicroF1": candidate_high["micro"]["f1"] >= incumbent_high["micro"]["f1"],
        "rtnHighExact": candidate_high["exactSetAgreement"]["percent"] >= incumbent_high["exactSetAgreement"]["percent"],
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= 0.5180528053,
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= 0.3351786297,
        "cosoFP": candidate_coso["falsePositives"] <= 60,
        "cosoFN": candidate_coso["falseNegatives"] <= 87,
        "cosoSupportedLabels": min(supported_deltas.values()) >= -0.08,
        "outputIntegrity": all(len(labels) <= 2 and set(labels) <= set(PRODUCT) for labels in candidate_rtn_outputs),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "researchEvidenceImproved": retained,
        "credibleProductQualityPromotionProven": False,
        "currentIncumbentChanged": False,
        "training": {
            "rows": len(weak), "nonEmptyRows": sum(bool(row["weakLabels"]) for row in weak),
            "emptyRows": sum(not row["weakLabels"] for row in weak), "epochs": 1,
            "learningRate": LR, "batchSize": BATCH, "seed": SEED,
            "loss": "standard unweighted Product-18 BCEWithLogitsLoss",
            "trainableParameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
            "totalParameters": sum(p.numel() for p in model.parameters()),
            "meanTrainLoss": total_loss / total_rows, "elapsedSeconds": time.time() - started,
            "labelStatus": "MODEL_GENERATED_WEAK_PSEUDO_NOT_HUMAN_GOLD",
        },
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn,
        "rtnResolvedCandidateDistributionError": distribution_error,
        "untouchedUntilCandidateUnlabeledValidation": validation,
        "gates": gates,
        "humanReviewPerformed": False,
        "RTNTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "promotionStatement": "No production promotion; RTN is model-consensus reference and candidate lineage is research-only.",
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"], "training": result["training"],
        "coso": {"incumbent": incumbent_coso, "candidate": candidate_coso},
        "rtnResolved": {"incumbent": incumbent_resolved, "candidate": candidate_resolved},
        "rtnHigh": {"incumbent": incumbent_high, "candidate": candidate_high},
        "validation": validation, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
