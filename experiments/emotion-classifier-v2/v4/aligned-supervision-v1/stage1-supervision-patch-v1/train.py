#!/usr/bin/env python3

import csv
import hashlib
import json
import math
import random
import time
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    get_linear_schedule_with_warmup,
)

HERE = Path(__file__).resolve().parent
PARENT = HERE.parent
V4 = PARENT.parent

sys.path.insert(0, str(PARENT.parent / "auto-v1"))

from experiment import LABELS, label_positions, collate, report
from data_safety import assert_disjoint, accumulation_weight

MAXLEN = 512
BATCH = 2
ACCUM = 8

PATCH_FILE = (
    V4
    / "stage1-final-adjudication-plan-v1"
    / "stage1-supervision-patch-mapped-v1.csv"
)


def rows(p):
    return [
        json.loads(x)
        for x in Path(p).read_text(encoding="utf-8").splitlines()
        if x.strip()
    ]


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


class Data(Dataset):
    def __init__(self, rs, tok, patch):
        self.rs = rs
        self.patch = patch
        self.enc = tok(
            [r["text"] if "text" in r else r["journal"] for r in rs],
            truncation=True,
            max_length=MAXLEN,
        )

    def __len__(self):
        return len(self.rs)

    def __getitem__(self, i):
        r = self.rs[i]

        positives = set(r["modelLabels"])
        mask = {l: 1.0 for l in LABELS}

        for label, app in self.patch.get(r["id"], {}).items():
            if app == "NO":
                positives.discard(label)
            elif app == "CLEAR":
                positives.add(label)
            elif app == "PLAUSIBLE":
                mask[label] = 0.0
            else:
                raise RuntimeError(f"Bad applicability: {app}")

        return (
            {k: v[i] for k, v in self.enc.items()}
            | {
                "labels": [float(l in positives) for l in LABELS],
                "loss_mask": [mask[l] for l in LABELS],
            }
        )


def masked_collate(tok):
    def fn(items):
        masks = torch.tensor(
            [x.pop("loss_mask") for x in items],
            dtype=torch.float32,
        )
        return collate(tok)(items) | {"loss_mask": masks}

    return fn


@torch.inference_mode()
def infer(model, loader, pos):
    model.eval()
    out = []

    for b in loader:
        b.pop("labels")
        b.pop("loss_mask", None)
        out.append(
            torch.sigmoid(model(**b).logits[:, pos])
            .cpu()
            .numpy()
        )

    return np.concatenate(out)


def main():
    out = HERE / "experiment"
    out.mkdir(exist_ok=False)

    # Canonical locked data
    lock = json.loads((PARENT / "annotation-lock.json").read_text())

    base = rows(PARENT / "train.jsonl")
    go = rows(
        PARENT
        / "public-source-shortlist-20260910"
        / "goemotions-targeted-tranche.jsonl"
    )
    dev = rows(PARENT / "dev.jsonl")

    train = base + go

    assert (
        lock["status"] == "LOCKED"
        and sha(PARENT / "train.jsonl") == lock["hashes"]["train.jsonl"]
        and sha(PARENT / "dev.jsonl") == lock["hashes"]["dev.jsonl"]
        and len(base) == 841
        and len(go) == 204
        and len(train) == 1045
    )

    assert_disjoint(train, dev)

    # Load Stage-1 patch
    base_by_id = {r["id"]: r for r in base}

    patch = {}
    patch_rows = []

    with PATCH_FILE.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            cid = r["canonical_id"]
            label = r["label"]
            app = r["final_applicability"].strip().upper()

            assert cid in base_by_id, (
                f"Patch canonical ID not in locked 841 Train: {cid}"
            )
            assert label in LABELS, f"Unknown label: {label}"
            assert app in {"NO", "PLAUSIBLE", "CLEAR"}

            existing = patch.setdefault(cid, {}).get(label)
            assert existing is None or existing == app, (
                f"Conflicting patch for {cid}/{label}"
            )

            patch[cid][label] = app
            patch_rows.append(r)

    counts = Counter(
        r["final_applicability"].strip().upper()
        for r in patch_rows
    )

    # Guards from frozen mapped patch
    assert len(patch_rows) == 694
    assert len(patch) == 108
    assert counts["NO"] == 591
    assert counts["PLAUSIBLE"] == 76
    assert counts["CLEAR"] == 27

    # Audit how many binary targets actually change
    changed_zero = 0
    changed_one = 0

    for cid, decisions in patch.items():
        old = set(base_by_id[cid]["modelLabels"])

        for label, app in decisions.items():
            if app == "NO" and label in old:
                changed_zero += 1
            elif app == "CLEAR" and label not in old:
                changed_one += 1

    # Fixed continuation setup
    torch.set_num_threads(3)
    torch.manual_seed(44)
    random.seed(44)
    np.random.seed(44)

    cp = (
        PARENT
        / "goemotions-targeted-v1"
        / "experiment"
        / "epoch-1-checkpoint"
    )

    tok = AutoTokenizer.from_pretrained(
        cp,
        local_files_only=True,
    )

    model = AutoModelForSequenceClassification.from_pretrained(
        cp,
        local_files_only=True,
    )

    pos = label_positions(model)

    tr = DataLoader(
        Data(train, tok, patch),
        batch_size=BATCH,
        shuffle=True,
        generator=torch.Generator().manual_seed(44),
        collate_fn=masked_collate(tok),
    )

    dv = DataLoader(
        Data(dev, tok, {}),
        batch_size=BATCH,
        collate_fn=masked_collate(tok),
    )

    prior = json.loads(
        (
            PARENT
            / "goemotions-targeted-v1"
            / "experiment"
            / "summary.json"
        ).read_text()
    )

    base_metrics = prior["finalMetrics"]

    opt = torch.optim.AdamW(
        model.parameters(),
        lr=2e-6,
        weight_decay=0.01,
    )

    steps = math.ceil(len(tr) / ACCUM)

    sched = get_linear_schedule_with_warmup(
        opt,
        math.ceil(0.1 * steps),
        steps,
    )

    t0 = time.time()
    model.train()
    opt.zero_grad(set_to_none=True)

    total = 0.0
    n = 0

    for i, b in enumerate(tr):
        y = b.pop("labels")
        mask = b.pop("loss_mask")

        logits = model(**b).logits[:, pos]

        raw = torch.nn.functional.binary_cross_entropy_with_logits(
            logits,
            y,
            reduction="none",
        )

        loss = (raw * mask).sum() / mask.sum()

        (
            loss
            * accumulation_weight(
                i,
                len(train),
                BATCH,
                ACCUM,
            )
        ).backward()

        total += loss.item() * len(y)
        n += len(y)

        if (i + 1) % ACCUM == 0 or i + 1 == len(tr):
            torch.nn.utils.clip_grad_norm_(
                model.parameters(),
                1.0,
            )
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)

    # One fixed Dev evaluation
    p = infer(model, dv, pos)
    np.save(out / "probabilities.npy", p)

    metrics = report(dev, p, 0.35)

    model.save_pretrained(out / "checkpoint")
    tok.save_pretrained(out / "checkpoint")

    score = metrics["selected18"]["macro"]["f1"]
    precision = metrics["selected18"]["micro"]["precision"]

    baseline_score = (
        base_metrics["selected18"]["macro"]["f1"]
    )

    summary = {
        "status": "COMPLETE",
        "trainingRows": len(train),
        "canonicalTrainRows": len(base),
        "goRows": len(go),

        "patchCanonicalRows": len(patch),
        "patchCells": len(patch_rows),

        "stage1NO": counts["NO"],
        "stage1Plausible": counts["PLAUSIBLE"],
        "stage1Clear": counts["CLEAR"],

        "plausiblePolicy": "MASK_LOSS",
        "unadjudicatedPolicy": "KEEP_EXISTING_TARGET",

        "existingPositiveToZeroChanges": changed_zero,
        "existingNegativeToOneChanges": changed_one,

        "trainLoss": total / n,

        "baselineMetrics": base_metrics,
        "finalMetrics": metrics,

        "baselineMacroF1": baseline_score,
        "selectedMacroF1": score,

        "microPrecision": precision,

        "decision": (
            "PROMOTE"
            if score > baseline_score and precision >= 0.5
            else "REJECT"
        ),

        "singleDevEvaluation": True,
        "threshold": 0.35,
        "seed": 44,
        "learningRate": 2e-6,

        "externalEvaluationLoaded": False,
        "usesOpenedGemini300": False,

        "elapsedSeconds": time.time() - t0,
    }

    (out / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n"
    )

    print(
        json.dumps(
            {
                k: v
                for k, v in summary.items()
                if k not in ["baselineMetrics", "finalMetrics"]
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
