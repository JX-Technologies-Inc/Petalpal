#!/usr/bin/env python3
"""Train and evaluate one fixed Event-to-label NLI candidate."""

from __future__ import annotations

import importlib.util
import json
import math
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
V4 = ALIGNED.parent
BASE_MODEL = "cross-encoder/nli-deberta-v3-small"
TRAIN = ALIGNED / "train.jsonl"
GO = ALIGNED / "public-source-shortlist-20260910/goemotions-targeted-tranche.jsonl"
DEV = ALIGNED / "dev.jsonl"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
REFERENCE_DIR = V4 / "model-consensus-reference-300-v1"
OUTPUT = HERE / "candidate"
SEED = 48
LR = 2e-6
BATCH = 16
MAX_LENGTH = 256

DEFINITIONS = {
    "admiration": "respectful approval or being impressed by someone or something",
    "amusement": "finding something funny, playful, or entertaining",
    "anger": "strong displeasure, hostility, or rage",
    "annoyance": "milder irritation, frustration, or being bothered",
    "caring": "concern for, nurturing of, or desire to support another",
    "confusion": "uncertainty about understanding, interpretation, or what to do",
    "curiosity": "interest or desire to know, learn, or investigate",
    "disappointment": "sadness or dissatisfaction because hopes or expectations were unmet",
    "disgust": "revulsion, strong aversion, or moral or physical repugnance",
    "excitement": "high-energy positive anticipation or enthusiasm",
    "fear": "anxiety, worry, threat, dread, or feeling unsafe",
    "gratitude": "thankfulness or appreciation for a benefit or kindness received",
    "joy": "happiness, delight, contentment, or positive pleasure",
    "love": "deep affection, attachment, or warmth toward someone",
    "optimism": "hopeful expectation or confidence about a favorable future",
    "remorse": "guilt, regret, or sorrow over the writer's own action or failure",
    "sadness": "sorrow, grief, loneliness, or unhappiness",
    "surprise": "being startled or encountering something notably unexpected",
}


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


def hypothesis(label: str) -> str:
    return f"The writer's secondary emotion is {DEFINITIONS[label]}."


def build_pairs(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    pairs = []
    for row in rows:
        positives = [label for label in PRODUCT if label in set(row["modelLabels"])]
        absent = [label for label in PRODUCT if label not in positives]
        neutral = random.Random(f"{SEED}:{row['id']}").sample(absent, min(3, len(absent)))
        for label in positives:
            pairs.append({"rowId": row["id"], "event": row["journal"], "label": label, "target": 1})
        for label in neutral:
            pairs.append({"rowId": row["id"], "event": row["journal"], "label": label, "target": 2})
    return pairs


class PairDataset(Dataset):
    def __init__(self, pairs, tokenizer):
        self.pairs = pairs
        self.encoded = tokenizer(
            [str(row["event"]) for row in pairs],
            [hypothesis(str(row["label"])) for row in pairs],
            truncation=True,
            max_length=MAX_LENGTH,
        )

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, index):
        return {
            **{key: value[index] for key, value in self.encoded.items()},
            "labels": int(self.pairs[index]["target"]),
        }


def collate(tokenizer):
    def make_batch(rows):
        labels = torch.tensor([row.pop("labels") for row in rows], dtype=torch.long)
        return tokenizer.pad(rows, padding=True, return_tensors="pt") | {"labels": labels}
    return make_batch


@torch.inference_mode()
def infer(model, tokenizer, texts: list[str], device) -> np.ndarray:
    model.eval()
    probabilities = np.zeros((len(texts), len(PRODUCT)), dtype=np.float32)
    for label_index, label in enumerate(PRODUCT):
        second = [hypothesis(label)] * len(texts)
        batches = []
        for start in range(0, len(texts), 32):
            encoded = tokenizer(
                texts[start:start + 32], second[start:start + 32], padding=True,
                truncation=True, max_length=MAX_LENGTH, return_tensors="pt",
            )
            logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits
            batches.append(torch.softmax(logits, dim=-1)[:, 1].cpu().numpy())
        probabilities[:, label_index] = np.concatenate(batches)
    result = np.zeros((len(texts), len(canonical.LABELS)), dtype=np.float32)
    for index, label in enumerate(PRODUCT):
        result[:, canonical.LABELS.index(label)] = probabilities[:, index]
    return result


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


def rtn_comparison(candidate_sets):
    consensus = read_jsonl(REFERENCE_DIR / "consensus.jsonl")
    baseline = json.loads(
        (REFERENCE_DIR / "incumbent-baseline-diagnostic-v1/analysis.json").read_text(encoding="utf-8")
    )
    high = [i for i, row in enumerate(consensus) if row["consensusStatus"] == "HIGH_CONSENSUS"]
    resolved = [i for i, row in enumerate(consensus) if row["consensusStatus"] != "UNRESOLVED"]
    def evaluate(indices):
        return rtn_eval.evaluate(
            [set(consensus[i]["consensusLabels"]) for i in indices],
            [candidate_sets[i] for i in indices],
        )
    return {
        "incumbent": {"highConsensus": baseline["highConsensus"], "resolved": baseline["resolved"]},
        "candidate": {"highConsensus": evaluate(high), "resolved": evaluate(resolved)},
        "referenceRole": "MODEL_GENERATED_WEAK_PSEUDO_REFERENCE_NOT_HUMAN_GOLD",
    }


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    if protocol["status"] != "LOCKED_BEFORE_PAIR_CONSTRUCTION_OR_TRAINING":
        raise ValueError("Protocol is not locked")
    train = read_jsonl(TRAIN) + read_jsonl(GO)
    dev = read_jsonl(DEV)
    if len(train) != 1045 or len(dev) != 149:
        raise ValueError("Unexpected frozen train/dev row counts")
    train_groups = {row["sourceGroupId"] for row in train}
    dev_groups = {row["sourceGroupId"] for row in dev}
    if train_groups & dev_groups:
        raise ValueError("Train/dev sourceGroup overlap")
    pairs = build_pairs(train)
    pair_counts = Counter(row["target"] for row in pairs)

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, local_files_only=True)
    if model.config.id2label != {0: "contradiction", 1: "entailment", 2: "neutral"}:
        raise ValueError(f"Unexpected NLI labels: {model.config.id2label}")
    model.to(device)
    loader = DataLoader(
        PairDataset(pairs, tokenizer), batch_size=BATCH, shuffle=True,
        generator=torch.Generator().manual_seed(SEED), collate_fn=collate(tokenizer),
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
    scheduler = get_linear_schedule_with_warmup(
        optimizer, math.ceil(0.1 * len(loader)), len(loader)
    )
    started = time.time()
    model.train()
    total_loss = 0.0
    total_rows = 0
    for batch_index, batch in enumerate(loader, 1):
        labels = batch.pop("labels").to(device)
        loss = model(**{key: value.to(device) for key, value in batch.items()}, labels=labels).loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        total_loss += float(loss.detach().cpu()) * len(labels)
        total_rows += len(labels)
        if batch_index % 50 == 0:
            print(json.dumps({"event": "train", "batch": batch_index, "batches": len(loader)}), flush=True)

    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")

    incumbent_dev = np.load(INCUMBENT_DEV)
    candidate_dev = infer(model, tokenizer, [str(row["journal"]) for row in dev], device)
    np.save(OUTPUT / "coso-candidate-probabilities.npy", candidate_dev)
    incumbent_coso = labeled_report(dev, incumbent_dev)
    candidate_coso = labeled_report(dev, candidate_dev)

    reference = read_jsonl(REFERENCE_DIR / "frozen-reference-300.jsonl")
    candidate_rtn_probs = infer(model, tokenizer, [str(row["text"]) for row in reference], device)
    np.save(OUTPUT / "rtn-candidate-probabilities.npy", candidate_rtn_probs)
    fake = [{"id": row["rowId"], "modelLabels": []} for row in reference]
    candidate_outputs = canonical.report(fake, candidate_rtn_probs, 0.35)["outputs"]
    rtn = rtn_comparison([set(labels) & set(PRODUCT) for labels in candidate_outputs])

    supported_deltas = {
        label: candidate_coso["perLabel"][label]["f1"] - incumbent_coso["perLabel"][label]["f1"]
        for label in PRODUCT if incumbent_coso["perLabel"][label]["support"] >= 5
    }
    ir = rtn["incumbent"]["resolved"]
    cr = rtn["candidate"]["resolved"]
    ih = rtn["incumbent"]["highConsensus"]
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
        "outputIntegrity": all(len(labels) <= 2 and set(labels) <= set(PRODUCT) for labels in candidate_outputs),
    }
    retained = all(gates.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "researchEvidenceImproved": retained,
        "credibleProductQualityPromotionProven": False,
        "currentIncumbentChanged": retained,
        "training": {
            "model": BASE_MODEL, "trainRows": len(train), "pairs": len(pairs),
            "entailmentPairs": pair_counts[1], "neutralPairs": pair_counts[2],
            "contradictionPairs": pair_counts[0], "epochs": 1, "learningRate": LR,
            "batchSize": BATCH, "seed": SEED, "maxLength": MAX_LENGTH,
            "meanTrainLoss": total_loss / total_rows, "elapsedSeconds": time.time() - started,
            "rights": "HISTORICAL_UNRESOLVED_RESEARCH_LINEAGE_ONLY",
        },
        "coso149": {"incumbent": incumbent_coso, "candidate": candidate_coso, "supportedPerLabelF1Delta": supported_deltas},
        "rtn300": rtn,
        "rtnResolvedCandidateDistributionError": distribution_error,
        "gates": gates,
        "humanReview": False,
        "RTNTrainingUse": False,
        "thresholdOrSelectorChanged": False,
        "postHocRescueRun": False,
        "promotionStatement": "Research-only; RTN is model consensus and training lineage rights remain unresolved.",
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"], "training": result["training"],
        "coso": {"incumbent": {k: incumbent_coso[k] for k in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")},
                 "candidate": {k: candidate_coso[k] for k in ("micro", "macro", "exactSet", "falsePositives", "falseNegatives", "outputCountDistribution")}},
        "rtnResolved": {"incumbent": {k: ir[k] for k in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")},
                        "candidate": {k: cr[k] for k in ("micro", "macroAll18", "exactSetAgreement", "falsePositives", "falseNegatives", "incumbentCountDistribution")}},
        "rtnHigh": {"incumbent": {k: ih[k] for k in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")},
                    "candidate": {k: ch[k] for k in ("micro", "exactSetAgreement", "falsePositives", "falseNegatives")}},
        "distributionError": distribution_error, "gates": gates,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
