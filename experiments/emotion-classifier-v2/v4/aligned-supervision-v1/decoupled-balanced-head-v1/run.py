#!/usr/bin/env python3
"""One fixed long-tail decoupled classifier retraining experiment."""

from __future__ import annotations

import importlib.util
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset, WeightedRandomSampler
from transformers import AutoModelForSequenceClassification, AutoTokenizer


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
TRAIN = ALIGNED / "train.jsonl"
REPLAY = ALIGNED / "public-source-shortlist-20260910/goemotions-targeted-tranche.jsonl"
DEV = ALIGNED / "dev.jsonl"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
OUTPUT = HERE / "candidate"
SEED = 44


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module("canonical_experiment", V4 / "auto-v1/experiment.py")
rtn_eval = load_module(
    "rtn_evaluator", REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analyze.py"
)
PRODUCT = list(canonical.PRODUCT)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


@torch.inference_mode()
def extract_features(model, tokenizer, texts: list[str], device) -> torch.Tensor:
    model.eval()
    output = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start:start + 32], padding=True, truncation=True,
            max_length=512, return_tensors="pt",
        )
        hidden = model.roberta(**{key: value.to(device) for key, value in encoded.items()}).last_hidden_state[:, 0, :]
        feature = torch.tanh(model.classifier.dense(hidden))
        output.append(feature.cpu())
    return torch.cat(output)


@torch.inference_mode()
def infer(model, tokenizer, texts: list[str], positions, device) -> np.ndarray:
    model.eval()
    batches = []
    for start in range(0, len(texts), 32):
        encoded = tokenizer(
            texts[start:start + 32], padding=True, truncation=True,
            max_length=512, return_tensors="pt",
        )
        logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
        batches.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(batches)


def labeled_report(rows, probabilities):
    report = canonical.report(rows, probabilities, 0.35)
    truth = [set(row["modelLabels"]) & set(PRODUCT) for row in rows]
    predicted = [set(labels) & set(PRODUCT) for labels in report["outputs"]]
    return {
        "micro": report["selected18"]["micro"],
        "macro": report["selected18"]["macro"],
        "perLabel": report["selected18"]["perLabel"],
        "exactSet": sum(left == right for left, right in zip(truth, predicted)) / len(rows),
        "falsePositives": sum(len(output - expected) for output, expected in zip(predicted, truth)),
        "falseNegatives": sum(len(expected - output) for output, expected in zip(predicted, truth)),
        "outputCountDistribution": report["product"]["outputCountDistribution"],
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_FEATURE_EXTRACTION_OR_TRAINING":
        raise ValueError("Protocol is not locked")
    aligned = read_jsonl(TRAIN)
    replay = read_jsonl(REPLAY)
    train = aligned + replay
    dev = read_jsonl(DEV)
    if (len(aligned), len(replay), len(train), len(dev)) != (841, 204, 1045, 149):
        raise ValueError("Unexpected frozen row counts")
    if {row["sourceGroupId"] for row in train} & {row["sourceGroupId"] for row in dev}:
        raise ValueError("Train/dev sourceGroup overlap")

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model, loading = AutoModelForSequenceClassification.from_pretrained(
        INCUMBENT, local_files_only=True, output_loading_info=True
    )
    if loading["missing_keys"] or loading["unexpected_keys"] or loading["mismatched_keys"]:
        raise ValueError(f"Incumbent load mismatch: {loading}")
    id2label = {int(index): label for index, label in model.config.id2label.items()}
    product_positions = [next(index for index, label in id2label.items() if label == target) for target in PRODUCT]
    canonical_positions = [next(index for index, label in id2label.items() if label == target) for target in canonical.LABELS]
    model.to(device)

    started = time.time()
    features = extract_features(model, tokenizer, [str(row["journal"]) for row in train], device)
    labels = torch.tensor(
        [[float(label in set(row["modelLabels"])) for label in PRODUCT] for row in train],
        dtype=torch.float32,
    )
    positive_counts = Counter(label for row in train for label in set(row["modelLabels"]) if label in PRODUCT)
    empty_count = sum(not (set(row["modelLabels"]) & set(PRODUCT)) for row in train)
    row_weights = []
    for row in train:
        positives = set(row["modelLabels"]) & set(PRODUCT)
        row_weights.append(
            max(1.0 / positive_counts[label] for label in positives) if positives else 1.0 / empty_count
        )
    sampler = WeightedRandomSampler(
        row_weights, num_samples=len(train), replacement=True,
        generator=torch.Generator().manual_seed(SEED),
    )
    loader = DataLoader(TensorDataset(features, labels), batch_size=32, sampler=sampler)
    head = torch.nn.Linear(features.shape[1], len(PRODUCT)).to(device)
    with torch.no_grad():
        head.weight.copy_(model.classifier.out_proj.weight[product_positions])
        head.bias.copy_(model.classifier.out_proj.bias[product_positions])
    optimizer = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=0.0)
    head.train()
    loss_total = 0.0
    rows_total = 0
    for batch_features, batch_labels in loader:
        batch_features = batch_features.to(device)
        batch_labels = batch_labels.to(device)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(head(batch_features), batch_labels)
        loss.backward()
        gradient_norm = torch.nn.utils.clip_grad_norm_(head.parameters(), 1.0)
        if not torch.isfinite(gradient_norm):
            raise ValueError("Non-finite gradient")
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
        loss_total += float(loss.detach().cpu()) * len(batch_labels)
        rows_total += len(batch_labels)
    with torch.no_grad():
        product_index = torch.tensor(product_positions, device=device)
        model.classifier.out_proj.weight.index_copy_(0, product_index, head.weight)
        model.classifier.out_proj.bias.index_copy_(0, product_index, head.bias)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")
    candidate_dev = infer(model, tokenizer, [str(row["journal"]) for row in dev], canonical_positions, device)
    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    consensus = read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    candidate_rtn = infer(model, tokenizer, [str(row["text"]) for row in reference], canonical_positions, device)
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn)

    incumbent_coso = labeled_report(dev, np.load(INCUMBENT_DEV))
    candidate_coso = labeled_report(dev, candidate_dev)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_sets = [set(labels) & set(PRODUCT) for labels in canonical.report(fake, candidate_rtn, 0.35)["outputs"]]
    baseline = json.loads(
        (REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analysis.json").read_text(encoding="utf-8")
    )
    high = [index for index, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved = [index for index, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]
    def evaluate(indices):
        return rtn_eval.evaluate(
            [set(consensus[index]["consensusLabels"]) for index in indices],
            [candidate_sets[index] for index in indices],
        )
    rtn = {
        "incumbent": {"highConsensus": baseline["highConsensus"], "resolved": baseline["resolved"]},
        "candidate": {"highConsensus": evaluate(high), "resolved": evaluate(resolved)},
        "referenceRole": "MODEL_GENERATED_WEAK_PSEUDO_REFERENCE_NOT_HUMAN_GOLD",
    }
    supported_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in PRODUCT if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    cr = rtn["candidate"]["resolved"]
    ch = rtn["candidate"]["highConsensus"]
    distribution_error = sum(
        abs(cr["incumbentCountDistribution"][str(size)] - cr["consensusCountDistribution"][str(size)])
        for size in range(3)
    )
    gates = {
        "rtnResolvedMicroF1": cr["micro"]["f1"] >= 0.3313265306,
        "rtnResolvedMacroF1": cr["macroAll18"]["f1"] >= 0.3184047525,
        "rtnResolvedExact": cr["exactSetAgreement"]["percent"] >= 50.41,
        "rtnResolvedFP": cr["falsePositives"] <= 64,
        "rtnResolvedFN": cr["falseNegatives"] <= 85,
        "rtnResolvedDistribution": distribution_error <= 54,
        "rtnHighMicroF1": ch["micro"]["f1"] >= 0.3678160920,
        "rtnHighExact": ch["exactSetAgreement"]["percent"] >= 55.66,
        "cosoMicroF1": candidate_coso["micro"]["f1"] >= 0.5180528053,
        "cosoMacroF1": candidate_coso["macro"]["f1"] >= 0.3351786297,
        "cosoFP": candidate_coso["falsePositives"] <= 60,
        "cosoFN": candidate_coso["falseNegatives"] <= 87,
        "cosoSupportedLabels": min(supported_deltas.values()) >= -0.08,
        "outputIntegrity": all(len(labels) <= 2 and labels <= set(PRODUCT) for labels in candidate_sets),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "currentIncumbentChanged": False,
        "training": {
            "trainRows": len(train), "alignedRows": len(aligned), "targetedReplayRows": len(replay),
            "positiveCounts": {label: positive_counts[label] for label in PRODUCT},
            "emptyCount": empty_count, "sampleDraws": len(train), "replacement": True,
            "updatedParameters": "Product-18 output rows only", "epochs": 1,
            "learningRate": 1e-3, "batchSize": 32, "seed": SEED,
            "meanTrainLoss": loss_total / rows_total, "elapsedSeconds": time.time() - started,
            "rights": "HISTORICAL_UNRESOLVED_RESEARCH_LINEAGE_ONLY",
        },
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn, "rtnResolvedCandidateDistributionError": distribution_error,
        "gates": gates, "RTNTrainingUse": False, "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False, "credibleProductQualityPromotionProven": False,
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"], "training": result["training"],
        "coso": {
            "incumbent": {key: incumbent_coso[key] for key in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
            "candidate": {key: candidate_coso[key] for key in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
        },
        "rtnResolved": {
            "incumbent": {key: rtn["incumbent"]["resolved"][key] for key in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
            "candidate": {key: cr[key] for key in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
        },
        "rtnHigh": {
            "incumbent": {key: rtn["incumbent"]["highConsensus"][key] for key in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
            "candidate": {key: ch[key] for key in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
        },
        "distributionError": distribution_error, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
