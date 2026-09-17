#!/usr/bin/env python3
"""Reproduce the Stage-1 supervision diagnostic without training or holdout access."""

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.metrics import f1_score, precision_recall_fscore_support


HERE = Path(__file__).resolve().parent
V4 = HERE.parent
ALIGNED = V4 / "aligned-supervision-v1"
FINAL = V4 / "stage1-final-adjudication-plan-v1"
REVIEW = V4 / "petalpal-train-decomposed-inclusion-policy-v1-r1"
CORE = V4 / "stage1-human-review-core-v1"

LABELS = [
    "admiration", "amusement", "anger", "annoyance", "caring", "confusion",
    "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude",
    "joy", "love", "optimism", "remorse", "sadness", "surprise",
]
SOURCES = ["PHQ", "COSO", "HUM"]


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def read_csv(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, rows, fields=None):
    if fields is None:
        fields = list(rows[0])
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def pct(value):
    return f"{100 * value:.2f}%"


def md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    out.extend("| " + " | ".join(str(v) for v in row) + " |" for row in rows)
    return "\n".join(out)


def main():
    train = read_jsonl(ALIGNED / "train.jsonl")
    dev = read_jsonl(ALIGNED / "dev.jsonl")
    pass_a = {r["id"]: r for r in read_jsonl(ALIGNED / "pass-a.jsonl")}
    pass_b = {r["id"]: r for r in read_jsonl(ALIGNED / "pass-b.jsonl")}
    train_by_id = {r["id"]: r for r in train}
    patch = read_csv(FINAL / "stage1-supervision-patch-full-v2.csv")
    crosswalk = read_csv(FINAL / "r3-canonical-crosswalk-manifest-v2.csv")
    triage = {r["adjudication_id"]: r for r in read_csv(FINAL / "triage-manifest.csv")}
    sidecar = {r["adjudication_id"]: r for r in read_csv(FINAL / "evidence-sidecar.csv")}
    core_agreement = {r["label"]: r for r in read_csv(CORE / "core-label-agreement.csv")}
    experiment = json.loads(
        (ALIGNED / "stage1-supervision-patch-full-v2/experiment/summary.json").read_text()
    )

    assert len(train) == 841 and len(dev) == 149 and len(crosswalk) == 221
    assert len(patch) == 1256
    assert {r["canonical_train_id"] for r in crosswalk} <= train_by_id.keys()

    reviewed_ids = {r["canonical_train_id"] for r in crosswalk}
    for row in patch:
        canonical = train_by_id[row["canonical_train_id"]]
        row["source"] = row["canonical_train_id"].split("-", 1)[0]
        row["existing_positive"] = row["label"] in canonical["modelLabels"]
        row["annotation_method"] = canonical["annotation"]["method"]
        row["source_group_id"] = canonical["sourceGroupId"]
        row["selection_cohort"] = (
            "A/B disagreement" if int(row["r3_sample_id"].split("-")[1]) <= 179 else "control"
        )

    missing = [
        r for r in patch if r["applicability"] == "CLEAR" and not r["existing_positive"]
    ]
    plausible = [r for r in patch if r["applicability"] == "PLAUSIBLE"]
    assert len(missing) == 88 and len(plausible) == 123

    support = Counter(label for row in train for label in row["modelLabels"])
    missing_by_label = []
    for label in LABELS:
        count = sum(r["label"] == label for r in missing)
        missing_by_label.append({
            "label": label,
            "missing_clear_count": count,
            "share_of_88": count / 88,
            "canonical_train_positive_support": support[label],
            "missing_as_fraction_of_train_support": count / support[label],
        })
    write_csv(HERE / "missing-positive-by-label.csv", missing_by_label)

    missing_matrix = []
    for label in LABELS:
        row = {"label": label}
        row.update({source: sum(r["label"] == label and r["source"] == source for r in missing) for source in SOURCES})
        row["total"] = sum(row[s] for s in SOURCES)
        missing_matrix.append(row)
    write_csv(HERE / "missing-positive-label-source.csv", missing_matrix)

    review_source_counts = Counter(r["source_prefix"] for r in crosswalk)
    source_rows = []
    for source in SOURCES:
        cells = [r for r in patch if r["source"] == source]
        negative = [r for r in cells if not r["existing_positive"]]
        mp = [r for r in negative if r["applicability"] == "CLEAR"]
        pl = [r for r in cells if r["applicability"] == "PLAUSIBLE"]
        source_rows.append({
            "source": source,
            "review_rows_221": review_source_counts[source],
            "finalized_cells": len(cells),
            "finalized_canonical_negative_cells": len(negative),
            "missing_clear_count": len(mp),
            "share_of_88": len(mp) / 88,
            "missing_rate_among_finalized_negative_cells": len(mp) / len(negative),
            "plausible_count": len(pl),
            "plausible_rate_among_finalized_cells": len(pl) / len(cells),
        })
    write_csv(HERE / "stage1-by-source.csv", source_rows)

    plausible_by_label = []
    plausible_matrix = []
    for label in LABELS:
        cells = [r for r in patch if r["label"] == label]
        rows = [r for r in plausible if r["label"] == label]
        plausible_by_label.append({
            "label": label,
            "finalized_cells": len(cells),
            "plausible_count": len(rows),
            "plausible_rate": len(rows) / len(cells),
            "existing_positive": sum(r["existing_positive"] for r in rows),
            "existing_negative": sum(not r["existing_positive"] for r in rows),
            "core_human_disagreement_rate": float(core_agreement[label]["disagreement_rate"]),
        })
        matrix_row = {"label": label}
        matrix_row.update({source: sum(r["source"] == source for r in rows) for source in SOURCES})
        matrix_row["total"] = len(rows)
        plausible_matrix.append(matrix_row)
    write_csv(HERE / "plausible-by-label.csv", plausible_by_label)
    write_csv(HERE / "plausible-label-source.csv", plausible_matrix)

    matrix = Counter(
        ("positive" if r["existing_positive"] else "negative", r["applicability"])
        for r in patch
    )
    policy_rows = []
    for cohort, predicate in [
        ("full canonical Train", lambda r: True),
        ("review sample", lambda r: r["id"] in reviewed_ids),
    ]:
        rows = [r for r in train if predicate(r)]
        methods = Counter(r["annotation"]["method"] for r in rows)
        policy_rows.append({
            "cohort": cohort,
            "rows": len(rows),
            "exact_gemini_pass_agreement": methods["exact_gemini_pass_agreement"],
            "gemini_adjudication": methods["gemini_adjudication"],
            "adjudication_share": methods["gemini_adjudication"] / len(rows),
        })
    write_csv(HERE / "annotation-method-comparison.csv", policy_rows)

    detail_rows = []
    for r in missing:
        canonical = train_by_id[r["canonical_train_id"]]
        detail_rows.append({
            "canonical_train_id": r["canonical_train_id"],
            "r3_sample_id": r["r3_sample_id"],
            "label": r["label"],
            "source": r["source"],
            "source_group_id": r["source_group_id"],
            "canonical_model_labels": ";".join(canonical["modelLabels"]),
            "canonical_cardinality": len(canonical["modelLabels"]),
            "annotation_method": canonical["annotation"]["method"],
            "canonical_rationale": canonical["annotation"]["rationale"],
            "bucket": r["bucket"],
            "model_relation": triage[r["adjudication_id"]]["model_relation"],
            "core_support_state": triage[r["adjudication_id"]]["core_support_state"],
            "aux_primary_support_state": triage[r["adjudication_id"]]["aux_primary_support_state"],
        })
    write_csv(HERE / "missing-positive-details.csv", detail_rows)

    # Existing, already-computed fixed-Dev outputs: no model inference is performed here.
    base_outputs = experiment["baselineMetrics"]["outputs"]
    final_outputs = experiment["finalMetrics"]["outputs"]
    effect_rows = []
    for label in LABELS:
        gained_tp = gained_fp = lost_tp = lost_fp = 0
        for row, base, final in zip(dev, base_outputs, final_outputs):
            truth = label in row["modelLabels"]
            if label not in base and label in final:
                gained_tp += int(truth)
                gained_fp += int(not truth)
            if label in base and label not in final:
                lost_tp += int(truth)
                lost_fp += int(not truth)
        before = experiment["baselineMetrics"]["selected18"]["perLabel"][label]
        after = experiment["finalMetrics"]["selected18"]["perLabel"][label]
        effect_rows.append({
            "label": label,
            "missing_clear_added_to_train": sum(r["label"] == label for r in missing),
            "plausible_masked": sum(r["label"] == label for r in plausible),
            "dev_prediction_count_before": sum(label in x for x in base_outputs),
            "dev_prediction_count_after": sum(label in x for x in final_outputs),
            "gained_true_positive": gained_tp,
            "gained_false_positive": gained_fp,
            "lost_true_positive": lost_tp,
            "lost_false_positive": lost_fp,
            "dev_f1_before": before["f1"],
            "dev_f1_after": after["f1"],
            "dev_f1_delta": after["f1"] - before["f1"],
        })
    write_csv(HERE / "patch-effect-by-label.csv", effect_rows)

    # Slice the already-saved strict sourceGroup OOF predictions; no training/inference.
    sys.path.insert(0, str((V4 / "auto-v1").resolve()))
    from experiment import LABELS as MODEL_LABELS, PRODUCT  # pylint: disable=import-outside-toplevel

    probabilities = np.load(V4 / "group-oof-transformer-v1/oof-probabilities.npy")
    positions = [MODEL_LABELS.index(label) for label in PRODUCT]
    y_true = np.array([[label in row["modelLabels"] for label in PRODUCT] for row in train], dtype=np.int8)
    raw = probabilities[:, positions] >= 0.35
    selected = np.zeros_like(raw, dtype=np.int8)
    for index in range(len(train)):
        selected_indexes = np.flatnonzero(raw[index])
        selected_indexes = selected_indexes[
            np.argsort(probabilities[index, positions][selected_indexes])[::-1][:2]
        ]
        selected[index, selected_indexes] = 1

    ids = np.array([row["id"] for row in train])
    disagreement_ids = {
        row["canonical_train_id"] for row in crosswalk
        if int(row["r3_sample_id"].split("-")[1]) <= 179
    }
    control_ids = reviewed_ids - disagreement_ids
    slices = [
        ("all OOF", np.ones(len(train), dtype=bool)),
        ("PHQ OOF", np.array([x.startswith("PHQ-") for x in ids])),
        ("COSO OOF", np.array([x.startswith("COSO-") for x in ids])),
        ("HUM OOF", np.array([x.startswith("HUM-") for x in ids])),
        ("reviewed 221", np.array([x in reviewed_ids for x in ids])),
        ("A/B disagreement 179", np.array([x in disagreement_ids for x in ids])),
        ("controls 42", np.array([x in control_ids for x in ids])),
        ("not reviewed 620", np.array([x not in reviewed_ids for x in ids])),
    ]
    oof_rows = []
    for name, mask in slices:
        _, _, label_f1, label_support = precision_recall_fscore_support(
            y_true[mask], selected[mask], average=None, zero_division=0
        )
        oof_rows.append({
            "slice": name,
            "rows": int(mask.sum()),
            "macro_f1_all_18": float(label_f1.mean()),
            "macro_f1_supported_labels": float(label_f1[label_support > 0].mean()),
            "supported_labels": int((label_support > 0).sum()),
            "micro_f1": float(f1_score(y_true[mask], selected[mask], average="micro", zero_division=0)),
        })
    write_csv(HERE / "oof-slice-comparison.csv", oof_rows)

    baseline = experiment["baselineMetrics"]["selected18"]
    after = experiment["finalMetrics"]["selected18"]
    missing_rows = {r["canonical_train_id"] for r in missing}
    cardinality_cells = Counter(len(train_by_id[r["canonical_train_id"]]["modelLabels"]) for r in missing)
    cardinality_rows = Counter(len(train_by_id[row_id]["modelLabels"]) for row_id in missing_rows)
    c_missing = [r for r in missing if r["bucket"] == "C"]
    prior_clear_counts = Counter()
    for row in c_missing:
        evidence = sidecar[row["adjudication_id"]]
        prior_clear_counts[sum(
            evidence[field] == "CLEAR" for field in [
                "astra_applicability", "luna_applicability", "core1_applicability",
                "core2_applicability", "primary_aux_consensus",
            ]
        )] += 1

    full_disagreement = sum(
        set(pass_a[row["id"]]["labels"]) != set(pass_b[row["id"]]["labels"])
        for row in train
    )
    source_disagreement = {}
    for source in SOURCES:
        rows = [r for r in train if r["id"].startswith(source + "-")]
        count = sum(set(pass_a[r["id"]]["labels"]) != set(pass_b[r["id"]]["labels"]) for r in rows)
        source_disagreement[source] = {"rows": len(rows), "count": count, "rate": count / len(rows)}

    gained = sum(len(set(final) - set(base)) for base, final in zip(base_outputs, final_outputs))
    lost = sum(len(set(base) - set(final)) for base, final in zip(base_outputs, final_outputs))
    gained_tp = sum(r["gained_true_positive"] for r in effect_rows)
    gained_fp = sum(r["gained_false_positive"] for r in effect_rows)
    lost_tp = sum(r["lost_true_positive"] for r in effect_rows)
    lost_fp = sum(r["lost_false_positive"] for r in effect_rows)

    summary = {
        "status": "ANALYSIS ONLY — DO NOT TRAIN",
        "inputs": {
            "canonical_train_rows": len(train),
            "fixed_dev_rows": len(dev),
            "review_rows": len(crosswalk),
            "hard_reference_cells": len(patch),
            "protected_or_frozen_holdout_loaded": False,
            "training_performed": False,
            "new_model_inference_performed": False,
        },
        "stage1_vs_canonical_matrix": {
            f"canonical_{canonical}__stage1_{stage1}": matrix[(canonical, stage1)]
            for canonical in ["positive", "negative"] for stage1 in ["NO", "PLAUSIBLE", "CLEAR"]
        },
        "missing_clear": {
            "cells": len(missing),
            "canonical_rows": len(missing_rows),
            "source_counts": dict(Counter(r["source"] for r in missing)),
            "bucket_counts": dict(Counter(r["bucket"] for r in missing)),
            "canonical_cardinality_cell_counts": dict(cardinality_cells),
            "canonical_cardinality_row_counts": dict(cardinality_rows),
            "canonical_rationale_exact_label_mentions": sum(
                bool(re.search(r"\b" + re.escape(r["label"]) + r"\b", train_by_id[r["canonical_train_id"]]["annotation"]["rationale"], re.I))
                for r in missing
            ),
            "unique_source_groups": len({r["source_group_id"] for r in missing}),
            "bucket_c_prior_clear_vote_count_distribution": dict(prior_clear_counts),
        },
        "plausible": {
            "cells": len(plausible),
            "existing_positive": sum(r["existing_positive"] for r in plausible),
            "existing_negative": sum(not r["existing_positive"] for r in plausible),
            "source_counts": dict(Counter(r["source"] for r in plausible)),
        },
        "selection": {
            "full_train_ab_disagreement_rows": full_disagreement,
            "full_train_ab_disagreement_share": full_disagreement / len(train),
            "review_ab_disagreement_rows": len(disagreement_ids),
            "review_ab_disagreement_share": len(disagreement_ids) / len(crosswalk),
            "enrichment_ratio": (len(disagreement_ids) / len(crosswalk)) / (full_disagreement / len(train)),
            "source_ab_disagreement": source_disagreement,
        },
        "patch_dev_effect": {
            "macro_f1_before": baseline["macro"]["f1"],
            "macro_f1_after": after["macro"]["f1"],
            "macro_precision_delta": after["macro"]["precision"] - baseline["macro"]["precision"],
            "macro_recall_delta": after["macro"]["recall"] - baseline["macro"]["recall"],
            "micro_precision_before": baseline["micro"]["precision"],
            "micro_precision_after": after["micro"]["precision"],
            "micro_recall_before": baseline["micro"]["recall"],
            "micro_recall_after": after["micro"]["recall"],
            "predictions_before": sum(len(x) for x in base_outputs),
            "predictions_after": sum(len(x) for x in final_outputs),
            "gained_predictions": gained,
            "lost_predictions": lost,
            "gained_tp": gained_tp,
            "gained_fp": gained_fp,
            "lost_tp": lost_tp,
            "lost_fp": lost_fp,
            "net_tp": gained_tp - lost_tp,
            "net_fp": gained_fp - lost_fp,
        },
        "oof": {row["slice"]: row for row in oof_rows},
    }
    (HERE / "analysis-summary.json").write_text(json.dumps(summary, indent=2) + "\n")

    top_missing = sorted(missing_by_label, key=lambda r: (-r["missing_clear_count"], r["label"]))
    top_plausible = sorted(plausible_by_label, key=lambda r: (-r["plausible_rate"], r["label"]))
    effect_worst = sorted(effect_rows, key=lambda r: (r["dev_f1_delta"], r["label"]))
    oof = {row["slice"]: row for row in oof_rows}
    oof_gap = oof["all OOF"]["macro_f1_all_18"] - baseline["macro"]["f1"]
    explained = (oof["all OOF"]["macro_f1_all_18"] - oof["COSO OOF"]["macro_f1_all_18"]) / oof_gap

    report = f"""ANALYSIS ONLY — DO NOT TRAIN

# Stage-1 221 supervision diagnostic

## Executive conclusion

The 221 review does reveal real supervision trouble, but it does **not** define a drop-in replacement for canonical labels. The dominant issue is a policy mismatch: canonical supervision asks for the best 0–2 distinct, useful labels and prefers one when sufficient; Stage-1 judges each label independently, permits any number of applicable emotions, and includes past emotions in the full text. On the 1,256 finalized cells, Stage-1 therefore behaves as a broader applicability layer, while canonical Train/Dev remain a selective output layer.

This mismatch is visible directly: canonical-positive cells are 0 NO / 5 PLAUSIBLE / 57 CLEAR, whereas canonical-negative cells are 988 NO / 118 PLAUSIBLE / 88 CLEAR. Thus Stage-1 almost never deletes a canonical positive, but 60.69% of all Stage-1 CLEAR cells are additions. Of the 88 additions, 57 (64.77%) occur on rows already at canonical cardinality two. The 88 cells affect 60 rows; 35 of those rows were already at the canonical two-label cap.

The direct patch then moves the fixed-Dev boundary outward: selected outputs rise from {summary['patch_dev_effect']['predictions_before']} to {summary['patch_dev_effect']['predictions_after']}. There are {gained} gained decisions ({gained_tp} TP, {gained_fp} FP) and {lost} lost decisions ({lost_tp} TP, {lost_fp} FP), for net +{summary['patch_dev_effect']['net_tp']} TP and +{summary['patch_dev_effect']['net_fp']} FP. Macro precision falls by {summary['patch_dev_effect']['macro_precision_delta']:.6f}, while Macro recall rises only {summary['patch_dev_effect']['macro_recall_delta']:.6f}; Macro-F1 falls {baseline['macro']['f1']:.6f} → {after['macro']['f1']:.6f}. This is the expected signature when broader semantic applicability is trained against a selective evaluation reference.

## 1. CLEAR missing positives

### Per label

{md_table(
    ['label', 'count', 'share of 88', 'Train support', 'count / support'],
    [[r['label'], r['missing_clear_count'], pct(r['share_of_88']), r['canonical_train_positive_support'], pct(r['missing_as_fraction_of_train_support'])] for r in top_missing],
)}

The top four labels—optimism, caring, disappointment, curiosity—contain {sum(r['missing_clear_count'] for r in top_missing[:4])}/88 = {pct(sum(r['missing_clear_count'] for r in top_missing[:4]) / 88)}. This is meaningful concentration, but not a one-label failure. Relative to existing support, the largest shocks are curiosity 9/8 = 112.50%, confusion 5/15 = 33.33%, caring 11/34 = 32.35%, optimism 12/49 = 24.49%, and disappointment 10/45 = 22.22%.

### Label × source

{md_table(['label', 'PHQ', 'COSO', 'HUM', 'total'], [[r['label'], r['PHQ'], r['COSO'], r['HUM'], r['total']] for r in missing_matrix])}

### Source-normalized view

{md_table(
    ['source', 'review rows', 'finalized cells', 'canonical-negative cells', 'missing CLEAR', 'share of 88', 'rate / finalized negatives'],
    [[r['source'], r['review_rows_221'], r['finalized_cells'], r['finalized_canonical_negative_cells'], r['missing_clear_count'], pct(r['share_of_88']), pct(r['missing_rate_among_finalized_negative_cells'])] for r in source_rows],
)}

COSO supplies 71/88 = 80.68% of the additions despite being 103/221 = 46.61% of reviewed rows. Its rate among finalized canonical-negative cells is 15.24%, versus 1.78% for PHQ (8.57×) and 9.62% for HUM. The effect is therefore strongly source-specific, not merely a consequence of label frequency.

## 2. PLAUSIBLE distribution and fuzzy boundaries

Of the 123 PLAUSIBLE cells, 118 (95.93%) were canonical negatives and 5 (4.07%) canonical positives. By source: PHQ 76, COSO 44, HUM 3.

{md_table(
    ['label', 'PLAUSIBLE', 'finalized cells', 'rate', 'old +', 'old −', 'Core human disagreement'],
    [[r['label'], r['plausible_count'], r['finalized_cells'], pct(r['plausible_rate']), r['existing_positive'], r['existing_negative'], pct(r['core_human_disagreement_rate'])] for r in top_plausible],
)}

Two distinct ambiguity signals should not be collapsed:

- Final PLAUSIBLE propensity is highest for joy (22.73%), sadness (20.00%), excitement (18.52%), love (14.71%), optimism (13.93%), and disappointment (12.28%). This supports fuzzy joy/excitement/optimism, sadness/disappointment, and love/affiliation boundaries.
- Independent Core-human disagreement is highest for optimism (61.75%), excitement (61.20%), surprise (51.65%), joy (49.73%), and gratitude (43.17%). Curiosity is also high at 37.70% even though few finalized cells land on PLAUSIBLE; its ambiguity manifests more as rater-threshold disagreement than as a stable middle category.
- Anger/annoyance show moderate final PLAUSIBLE rates (9.43%/10.81%); disgust is low (4.08%). Caring/love/admiration are uneven: love is high (14.71%), caring 5.26%, admiration 3.77%.

## 3. Stage-1 versus canonical annotation

The policies differ by construction, not inference:

| property | canonical Train/Dev | Stage-1 |
|---|---|---|
| decision | best label set for output | independent applicability per label |
| cardinality | 0–2, prefer one when sufficient | no maximum |
| redundancy | second label must add a distinct useful characterization | overlapping applicable emotions may all be CLEAR |
| uncertain evidence | omit if neutral/ambiguous/insufficient | preserve as PLAUSIBLE |
| temporal scope | writer-owned emotion under selective output task | explicitly permits past emotions anywhere in full text |
| provenance | two Gemini passes; disagreement adjudicated | frozen human observations + Astra/Luna + Sol model adjudication |

Observed finalized-cell matrix:

{md_table(
    ['canonical status', 'Stage-1 NO', 'Stage-1 PLAUSIBLE', 'Stage-1 CLEAR'],
    [
        ['positive', matrix[('positive', 'NO')], matrix[('positive', 'PLAUSIBLE')], matrix[('positive', 'CLEAR')]],
        ['negative', matrix[('negative', 'NO')], matrix[('negative', 'PLAUSIBLE')], matrix[('negative', 'CLEAR')]],
    ],
)}

The canonical rationale field is row-level and only justifies the chosen output set; Stage-1 final hard-reference rows do not contain comparable per-cell rationales. Exact missing-label names appear in 0/88 canonical rationales, consistent with selective justification, but this lexical fact is not itself semantic proof. The decisive evidence is the task contract plus the two-label-cap concentration above.

The “88 CLEAR” also should not be described as human gold or broad consensus: 87/88 are Bucket C values supplied by the final blind Sol adjudicator, and only one is Bucket A model consensus with Core/Aux support. Among the 87 Bucket-C additions, 64 have a defined opposing primary-Aux category, 42 have no valid Core support for the earlier model consensus, and 6 have no prior CLEAR among Astra, Luna, Core1, Core2, or primary Aux. They are useful model-adjudicated audit evidence, not authoritative Train targets.

## 4. Why the direct patch hurts fixed Dev

### Hypothesis assessment

| hypothesis | verdict | evidence |
|---|---|---|
| A: CLEAR applicability ≠ evaluation-positive | strongly supported | The task contracts differ; 88/145 Stage-1 CLEAR cells are absent from canonical; 64.77% of additions are on already-two-label rows; Dev precision falls while recall barely rises. |
| B: one-sided label/source skew | supported, strongest by source | 71/88 additions are COSO; COSO normalized addition rate is 8.57× PHQ. Top four labels contain 47.73%, so label concentration is moderate, not total. |
| C: enriched subset | strongly supported | 179/221 = 81.00% are A/B disagreement rows, versus 179/841 = 21.28% in Train: 3.81× enrichment. Existing OOF Macro-F1 is 0.4113 on reviewed rows versus 0.5239 on non-reviewed rows. |
| D: intentional sparse/selective canonical labels | strongly supported | Canonical protocol explicitly caps output at two, prefers one, and rejects redundant labels. “Sparse” here is intentional task policy, not necessarily annotation omission. |
| E: continuation boundary drift | supported as proximal mechanism; not isolated as root cause | Net +11 Dev outputs produce only +1 TP and +10 FP. No unchanged-target continuation control exists at the same seed/step, so generic continuation drift cannot be separated from patch-induced drift using current artifacts. |

Largest per-label Dev F1 losses:

{md_table(
    ['label', 'added CLEAR', 'masked PLAUSIBLE', 'pred Δ', 'net TP Δ', 'net FP Δ', 'F1 before', 'F1 after', 'F1 Δ'],
    [[
        r['label'], r['missing_clear_added_to_train'], r['plausible_masked'],
        r['dev_prediction_count_after'] - r['dev_prediction_count_before'],
        r['gained_true_positive'] - r['lost_true_positive'],
        r['gained_false_positive'] - r['lost_false_positive'],
        f"{r['dev_f1_before']:.4f}", f"{r['dev_f1_after']:.4f}", f"{r['dev_f1_delta']:+.4f}",
    ] for r in effect_worst[:10]],
)}

## 5. What the 221 should be retained for

Recommended designation: **model-adjudicated, disagreement-enriched semantic audit set**.

Use it for:

1. annotation-policy mismatch detection (primary use);
2. label semantic and taxonomy audit;
3. source-specific supervision diagnostics, especially COSO;
4. boundary ambiguity detection using both final PLAUSIBLE and reviewer-disagreement signals;
5. versioned error-analysis reference cases;
6. future automatic-relabeling benchmark, scored as agreement with this audit policy rather than canonical correctness;
7. taxonomy-redesign evidence, especially for positive-energy, affiliation, outcome, and epistemic boundaries.

Do not use it as hard gold, a population-representative benchmark, or direct Train augmentation. Its sampling is enriched, its hard subset excludes 562 unresolved cells, and 409/1,256 hard values come from one final Sol adjudication route.

## 6. OOF 0.492306 versus fixed Dev 0.345179

{md_table(
    ['slice', 'rows', 'Macro-F1 all 18', 'Macro-F1 supported', 'Micro-F1'],
    [[r['slice'], r['rows'], f"{r['macro_f1_all_18']:.6f}", f"{r['macro_f1_supported_labels']:.6f}", f"{r['micro_f1']:.6f}"] for r in oof_rows],
)}

The strongest explanation is more specific than “domain shift”:

- Fixed Dev is 149/149 COSO. OOF is a mixed 841-row evaluation: PHQ 468, COSO 319, HUM 54. COSO-only OOF is 0.370892, only 0.025713 above fixed Dev, whereas aggregate OOF is 0.147128 above fixed Dev. Source conditioning removes {pct(explained)} of the raw numerical gap.
- OOF and fixed Dev do **not** use different annotation policies: both are locked outputs of the same two-pass Gemini + adjudication protocol. Stage-1 shows a mismatch between broad applicability and that shared selective policy; it does not prove an OOF-vs-Dev policy change.
- Strict sourceGroup splitting prevents author-group leakage, but it does not change the source mixture or break shared dataset style and shared annotation semantics. OOF therefore measures learnability of canonical supervision within the canonical Train mixture.
- The reviewed 221 are harder under the existing OOF model even against canonical labels (Macro 0.4113; Micro 0.4665) than the 620 non-reviewed rows (Macro 0.5239; Micro 0.6139), consistent with sensitivity/disagreement enrichment; source and label composition remain confounders.
- Fixed Dev is small for an 18-label macro metric: anger has zero positives and five other labels have only 1–2 positives. OOF has much larger per-label support. This amplifies fixed-Dev variance.
- The two headline scores are not a controlled model comparison: OOF used five candidate-C-initialized, two-epoch fold models; fixed Dev uses the saved GoEmotions-targeted current-best checkpoint. The source slice is diagnostic, not a causal decomposition.

Stage-1 nevertheless adds a concrete bridge: COSO is both the weaker OOF source (0.370892) and the source of 80.68% of Stage-1 missing CLEAR cells. That supports source-conditioned semantic complexity and broader-applicability pressure in COSO, while the common canonical annotation contract and small Dev support explain why this should not be reframed as a separate Dev labeling policy. The 82.52% figure is a descriptive gap decomposition, not a causal estimate.

## Final judgment

Stage-1 found **applicability positives**, not necessarily **canonical output positives**. The direct patch failed because it trained the model toward the former and evaluated it against the latter. The evidence supports a supervision-objective mismatch plus strong COSO concentration and enriched-sample bias; it does not support treating the 88 cells as corrected gold. Preserve the 221 as a diagnostic asset and policy-contrast benchmark only.

ANALYSIS ONLY — DO NOT TRAIN
"""
    (HERE / "REPORT.md").write_text(report)
    print(json.dumps({"status": summary["status"], "outputs": len(list(HERE.glob("*.csv"))) + 2}, indent=2))


if __name__ == "__main__":
    main()
