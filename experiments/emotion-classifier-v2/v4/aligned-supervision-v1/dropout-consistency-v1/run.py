#!/usr/bin/env python3
"""Run one fixed soft-anchored dropout-consistency candidate."""

import importlib.util
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup


HERE = Path(__file__).resolve().parent
ALIGNED = HERE.parent
INCUMBENT = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-checkpoint"
INCUMBENT_DEV = ALIGNED / "goemotions-targeted-v1/experiment/epoch-1-probabilities.npy"
TEACHER_POOL = ALIGNED / "selective-consensus-distillation-v1/incumbent-train-pool-probabilities.npy"
DEV = ALIGNED / "dev.jsonl"
HIPPO_TRAIN = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/train.jsonl"
UNEXPECTED_TRAIN = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/train.jsonl"
HIPPO_VALIDATION = ALIGNED / "admitted-unlabeled-v1/hippocorpus/prepared/validation.jsonl"
UNEXPECTED_VALIDATION = ALIGNED / "admitted-unlabeled-v1/unexpected-events/prepared/validation.jsonl"
OUTPUT = HERE / "candidate"
EPOCHS = 1
LEARNING_RATE = 1e-6
BATCH_SIZE = 16
MAX_LENGTH = 512
SEED = 44
STOCHASTIC_SEEDS = [440, 441, 442, 443, 444]

shared_spec = importlib.util.spec_from_file_location(
    "shared_run", ALIGNED / "selective-consensus-distillation-v1/run.py"
)
shared = importlib.util.module_from_spec(shared_spec)
assert shared_spec.loader is not None
shared_spec.loader.exec_module(shared)
canonical = shared.canonical

feasibility_spec = importlib.util.spec_from_file_location(
    "consensus_feasibility", ALIGNED / "selective-consensus-distillation-v1/feasibility.py"
)
feasibility = importlib.util.module_from_spec(feasibility_spec)
assert feasibility_spec.loader is not None
feasibility_spec.loader.exec_module(feasibility)

uncertainty_spec = importlib.util.spec_from_file_location(
    "dropout_uncertainty", ALIGNED / "dropout-uncertainty-v1/analyze.py"
)
uncertainty = importlib.util.module_from_spec(uncertainty_spec)
assert uncertainty_spec.loader is not None
uncertainty_spec.loader.exec_module(uncertainty)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


class ConsistencyDataset(Dataset):
    def __init__(self, rows: list[dict[str, object]], teacher: np.ndarray, tokenizer):
        self.rows = rows
        self.teacher = teacher
        self.encoded = tokenizer(
            [str(row["text"]) for row in rows], truncation=True, max_length=MAX_LENGTH
        )

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, object]:
        return {
            **{key: value[index] for key, value in self.encoded.items()},
            "teacher": self.teacher[index].tolist(),
        }


def collate(tokenizer):
    def make_batch(rows: list[dict[str, object]]) -> dict[str, torch.Tensor]:
        teacher = torch.tensor([row["teacher"] for row in rows], dtype=torch.float32)
        encoded = tokenizer.pad(
            [{key: value for key, value in row.items() if key != "teacher"} for row in rows],
            padding=True,
            return_tensors="pt",
        )
        return {**encoded, "teacher": teacher}

    return make_batch


@torch.inference_mode()
def stochastic_outputs(model, tokenizer, rows, positions, device):
    fake = [{"id": row["id"], "modelLabels": []} for row in rows]
    outputs = []
    texts = [str(row["text"]) for row in rows]
    for seed in STOCHASTIC_SEEDS:
        torch.manual_seed(seed)
        model.train()
        probabilities = []
        for start in range(0, len(texts), 32):
            encoded = tokenizer(
                texts[start : start + 32],
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
                return_tensors="pt",
            )
            logits = model(**{key: value.to(device) for key, value in encoded.items()}).logits[:, positions]
            probabilities.append(torch.sigmoid(logits).cpu().numpy())
        outputs.append(canonical.report(fake, np.concatenate(probabilities), 0.35)["outputs"])
    return outputs


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Refusing to overwrite candidate: {OUTPUT}")
    protocol = json.loads((HERE / "protocol.json").read_text())
    feasibility_audit = json.loads(
        (ALIGNED / "dropout-uncertainty-v1/analysis.json").read_text()
    )
    assert protocol["status"] == "LOCKED_BEFORE_TRAINING"
    assert feasibility_audit["feasibilityGatePassed"] is True

    hippocorpus = read_jsonl(HIPPO_TRAIN)
    unexpected = feasibility.unexpected_round_robin(
        read_jsonl(UNEXPECTED_TRAIN), len(hippocorpus)
    )
    pool = hippocorpus + unexpected
    teacher = np.load(TEACHER_POOL)
    assert len(pool) == 5274 and teacher.shape == (5274, len(canonical.LABELS))
    assert all(row["split"] == "train" and len(str(row["text"])) <= 300 for row in pool)

    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(INCUMBENT, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
    positions, _ = shared.model_positions(model)
    product_indices = [canonical.LABELS.index(label) for label in canonical.PRODUCT]
    original_classifier = {
        name: tensor.detach().cpu().clone() for name, tensor in model.classifier.state_dict().items()
    }
    for parameter in model.parameters():
        parameter.requires_grad = False
    trainable = []
    for name, parameter in model.named_parameters():
        if ".encoder.layer.10." in name or ".encoder.layer.11." in name:
            parameter.requires_grad = True
            trainable.append(parameter)
    assert trainable and not any(parameter.requires_grad for parameter in model.classifier.parameters())
    model.to(device)

    loader = DataLoader(
        ConsistencyDataset(pool, teacher, tokenizer),
        batch_size=BATCH_SIZE,
        shuffle=True,
        generator=torch.Generator().manual_seed(SEED),
        collate_fn=collate(tokenizer),
    )
    optimizer = torch.optim.AdamW(trainable, lr=LEARNING_RATE, weight_decay=0.01)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=math.ceil(0.1 * len(loader)),
        num_training_steps=len(loader),
    )
    started = time.time()
    totals = {"softBce": 0.0, "consistencyMse": 0.0, "examples": 0}
    model.train()
    for batch_index, batch in enumerate(loader):
        teacher_batch = batch.pop("teacher").to(device)[:, product_indices]
        encoded = {key: value.to(device) for key, value in batch.items()}
        logits_one = model(**encoded).logits[:, positions][:, product_indices]
        logits_two = model(**encoded).logits[:, positions][:, product_indices]
        soft_one = torch.nn.functional.binary_cross_entropy_with_logits(logits_one, teacher_batch)
        soft_two = torch.nn.functional.binary_cross_entropy_with_logits(logits_two, teacher_batch)
        consistency = torch.nn.functional.mse_loss(torch.sigmoid(logits_one), torch.sigmoid(logits_two))
        soft = (soft_one + soft_two) / 2
        loss = soft + consistency
        loss.backward()
        torch.nn.utils.clip_grad_norm_(trainable, 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        totals["softBce"] += float(soft.detach().cpu()) * len(teacher_batch)
        totals["consistencyMse"] += float(consistency.detach().cpu()) * len(teacher_batch)
        totals["examples"] += len(teacher_batch)
        if (batch_index + 1) % 75 == 0:
            print(json.dumps({
                "event": "train",
                "batch": batch_index + 1,
                "batches": len(loader),
                "elapsedSeconds": time.time() - started,
            }), flush=True)

    classifier_unchanged = all(
        torch.equal(original_classifier[name], tensor.detach().cpu())
        for name, tensor in model.classifier.state_dict().items()
    )
    assert classifier_unchanged
    OUTPUT.mkdir()
    model.save_pretrained(OUTPUT / "checkpoint")
    tokenizer.save_pretrained(OUTPUT / "checkpoint")

    development = read_jsonl(DEV)
    incumbent_dev = np.load(INCUMBENT_DEV)
    candidate_dev = shared.infer(
        model, tokenizer, [str(row["journal"]) for row in development], positions, device
    )
    np.save(OUTPUT / "development-probabilities.npy", candidate_dev)
    incumbent_all = shared.report_with_errors(development, incumbent_dev)
    candidate_all = shared.report_with_errors(development, candidate_dev)
    short_indices = [index for index, row in enumerate(development) if len(str(row["journal"])) <= 300]
    incumbent_short = shared.report_with_errors(
        [development[index] for index in short_indices], incumbent_dev[short_indices]
    )
    candidate_short = shared.report_with_errors(
        [development[index] for index in short_indices], candidate_dev[short_indices]
    )

    validation = {}
    relative_reductions = []
    for name, path in (("hippocorpus", HIPPO_VALIDATION), ("unexpectedEvents", UNEXPECTED_VALIDATION)):
        rows = read_jsonl(path)
        incumbent_model = AutoModelForSequenceClassification.from_pretrained(INCUMBENT, local_files_only=True)
        incumbent_positions, _ = shared.model_positions(incumbent_model)
        incumbent_model.to(device)
        incumbent_stochastic = uncertainty.summarize(
            stochastic_outputs(incumbent_model, tokenizer, rows, incumbent_positions, device)
        )
        candidate_stochastic = uncertainty.summarize(
            stochastic_outputs(model, tokenizer, rows, positions, device)
        )
        incumbent_probabilities = shared.infer(
            incumbent_model, tokenizer, [str(row["text"]) for row in rows], incumbent_positions, device
        )
        candidate_probabilities = shared.infer(
            model, tokenizer, [str(row["text"]) for row in rows], positions, device
        )
        deterministic = shared.unlabeled_comparison(
            rows, incumbent_probabilities, candidate_probabilities
        )
        relative_reduction = (
            incumbent_stochastic["unstablePercentage"] - candidate_stochastic["unstablePercentage"]
        ) / incumbent_stochastic["unstablePercentage"]
        relative_reductions.append(relative_reduction)
        validation[name] = {
            "incumbentDropout": incumbent_stochastic,
            "candidateDropout": candidate_stochastic,
            "relativeUnstableRowReduction": relative_reduction,
            "deterministic": deterministic,
        }

    supported_deltas = {
        label: candidate_all["perLabel"][label]["f1"] - incumbent_all["perLabel"][label]["f1"]
        for label in canonical.PRODUCT
        if incumbent_all["perLabel"][label]["support"] >= 3
    }
    guards = {
        "classifierIntegrity": classifier_unchanged,
        "dropoutUnstableNotWorse": all(
            result["candidateDropout"]["unstablePercentage"]
            <= result["incumbentDropout"]["unstablePercentage"]
            for result in validation.values()
        ),
        "dropoutPairwiseAgreementNotWorse": all(
            result["candidateDropout"]["meanPairwiseExactOutputAgreement"]
            >= result["incumbentDropout"]["meanPairwiseExactOutputAgreement"]
            for result in validation.values()
        ),
        "averageRelativeUnstableReduction": sum(relative_reductions) / len(relative_reductions) >= 0.20,
        "developmentMicroF1": candidate_all["micro"]["f1"] >= incumbent_all["micro"]["f1"],
        "developmentFalsePositives": candidate_all["falsePositives"] <= 58,
        "developmentFalseNegatives": candidate_all["falseNegatives"] <= 85,
        "supportedLabelRegression": min(supported_deltas.values()) >= -0.05,
        "shortMicroF1": candidate_short["micro"]["f1"] >= incumbent_short["micro"]["f1"] - 0.02,
        "shortFalsePositives": candidate_short["falsePositives"] <= 5,
        "deterministicValidationAgreement": all(
            result["deterministic"]["exactOutputAgreement"] >= 0.85 for result in validation.values()
        ),
        "deterministicValidationDistribution": all(
            abs(delta) <= 0.08
            for result in validation.values()
            for delta in result["deterministic"]["distributionDeltaFraction"].values()
        ),
    }
    retained = all(guards.values())
    result = {
        "status": "COMPLETE",
        "decision": "RETAIN_FOR_RESEARCH" if retained else "REJECT",
        "promotionStatus": "INCONCLUSIVE",
        "training": {
            "rows": len(pool),
            "epochs": EPOCHS,
            "learningRate": LEARNING_RATE,
            "batchSize": BATCH_SIZE,
            "maxLength": MAX_LENGTH,
            "trainableEncoderParameters": sum(parameter.numel() for parameter in trainable),
            "meanSoftBce": totals["softBce"] / totals["examples"],
            "meanConsistencyMse": totals["consistencyMse"] / totals["examples"],
            "elapsedSeconds": time.time() - started,
        },
        "classifierHeadTensorIdentical": classifier_unchanged,
        "development": {
            "incumbent": {key: value for key, value in incumbent_all.items() if key != "outputs"},
            "candidate": {key: value for key, value in candidate_all.items() if key != "outputs"},
            "supportedPerLabelF1Delta": supported_deltas,
            "shortAtMost300": {
                "incumbent": {key: value for key, value in incumbent_short.items() if key != "outputs"},
                "candidate": {key: value for key, value in candidate_short.items() if key != "outputs"},
            },
        },
        "independentUnlabeledValidation": validation,
        "averageRelativeUnstableRowReduction": sum(relative_reductions) / len(relative_reductions),
        "guards": guards,
        "credibleProductQualityImprovementProven": False,
        "incumbentChanged": False,
        "frozenFinalEvaluationOpened": False,
        "humanReviewPerformed": False,
    }
    (OUTPUT / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "decision": result["decision"],
        "promotionStatus": result["promotionStatus"],
        "development": {
            "incumbentMicro": incumbent_all["micro"],
            "candidateMicro": candidate_all["micro"],
            "incumbentFPFN": [incumbent_all["falsePositives"], incumbent_all["falseNegatives"]],
            "candidateFPFN": [candidate_all["falsePositives"], candidate_all["falseNegatives"]],
            "incumbentOutputCounts": incumbent_all["outputCountDistribution"],
            "candidateOutputCounts": candidate_all["outputCountDistribution"],
        },
        "averageRelativeUnstableRowReduction": result["averageRelativeUnstableRowReduction"],
        "validation": validation,
        "guards": guards,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
