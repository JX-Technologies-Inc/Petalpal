ANALYSIS ONLY — DO NOT TRAIN

# Stage-1 221 supervision diagnostic

## Executive conclusion

The 221 review does reveal real supervision trouble, but it does **not** define a drop-in replacement for canonical labels. The dominant issue is a policy mismatch: canonical supervision asks for the best 0–2 distinct, useful labels and prefers one when sufficient; Stage-1 judges each label independently, permits any number of applicable emotions, and includes past emotions in the full text. On the 1,256 finalized cells, Stage-1 therefore behaves as a broader applicability layer, while canonical Train/Dev remain a selective output layer.

This mismatch is visible directly: canonical-positive cells are 0 NO / 5 PLAUSIBLE / 57 CLEAR, whereas canonical-negative cells are 988 NO / 118 PLAUSIBLE / 88 CLEAR. Thus Stage-1 almost never deletes a canonical positive, but 60.69% of all Stage-1 CLEAR cells are additions. Of the 88 additions, 57 (64.77%) occur on rows already at canonical cardinality two. The 88 cells affect 60 rows; 35 of those rows were already at the canonical two-label cap.

The direct patch then moves the fixed-Dev boundary outward: selected outputs rise from 138 to 149. There are 13 gained decisions (2 TP, 11 FP) and 2 lost decisions (1 TP, 1 FP), for net +1 TP and +10 FP. Macro precision falls by -0.045872, while Macro recall rises only 0.006594; Macro-F1 falls 0.345179 → 0.328716. This is the expected signature when broader semantic applicability is trained against a selective evaluation reference.

## 1. CLEAR missing positives

### Per label

| label | count | share of 88 | Train support | count / support |
|---|---|---|---|---|
| optimism | 12 | 13.64% | 49 | 24.49% |
| caring | 11 | 12.50% | 34 | 32.35% |
| disappointment | 10 | 11.36% | 45 | 22.22% |
| curiosity | 9 | 10.23% | 8 | 112.50% |
| fear | 6 | 6.82% | 39 | 15.38% |
| surprise | 6 | 6.82% | 29 | 20.69% |
| confusion | 5 | 5.68% | 15 | 33.33% |
| sadness | 5 | 5.68% | 64 | 7.81% |
| amusement | 4 | 4.55% | 43 | 9.30% |
| love | 4 | 4.55% | 36 | 11.11% |
| anger | 3 | 3.41% | 14 | 21.43% |
| annoyance | 3 | 3.41% | 77 | 3.90% |
| admiration | 2 | 2.27% | 18 | 11.11% |
| excitement | 2 | 2.27% | 24 | 8.33% |
| gratitude | 2 | 2.27% | 71 | 2.82% |
| remorse | 2 | 2.27% | 24 | 8.33% |
| disgust | 1 | 1.14% | 24 | 4.17% |
| joy | 1 | 1.14% | 224 | 0.45% |

The top four labels—optimism, caring, disappointment, curiosity—contain 42/88 = 47.73%. This is meaningful concentration, but not a one-label failure. Relative to existing support, the largest shocks are curiosity 9/8 = 112.50%, confusion 5/15 = 33.33%, caring 11/34 = 32.35%, optimism 12/49 = 24.49%, and disappointment 10/45 = 22.22%.

### Label × source

| label | PHQ | COSO | HUM | total |
|---|---|---|---|---|
| admiration | 0 | 2 | 0 | 2 |
| amusement | 1 | 3 | 0 | 4 |
| anger | 1 | 2 | 0 | 3 |
| annoyance | 1 | 2 | 0 | 3 |
| caring | 0 | 10 | 1 | 11 |
| confusion | 0 | 5 | 0 | 5 |
| curiosity | 3 | 5 | 1 | 9 |
| disappointment | 0 | 9 | 1 | 10 |
| disgust | 1 | 0 | 0 | 1 |
| excitement | 0 | 2 | 0 | 2 |
| fear | 2 | 4 | 0 | 6 |
| gratitude | 0 | 2 | 0 | 2 |
| joy | 0 | 1 | 0 | 1 |
| love | 0 | 4 | 0 | 4 |
| optimism | 2 | 10 | 0 | 12 |
| remorse | 0 | 2 | 0 | 2 |
| sadness | 1 | 3 | 1 | 5 |
| surprise | 0 | 5 | 1 | 6 |

### Source-normalized view

| source | review rows | finalized cells | canonical-negative cells | missing CLEAR | share of 88 | rate / finalized negatives |
|---|---|---|---|---|---|---|
| PHQ | 110 | 694 | 676 | 12 | 13.64% | 1.78% |
| COSO | 103 | 507 | 466 | 71 | 80.68% | 15.24% |
| HUM | 8 | 55 | 52 | 5 | 5.68% | 9.62% |

COSO supplies 71/88 = 80.68% of the additions despite being 103/221 = 46.61% of reviewed rows. Its rate among finalized canonical-negative cells is 15.24%, versus 1.78% for PHQ (8.57×) and 9.62% for HUM. The effect is therefore strongly source-specific, not merely a consequence of label frequency.

## 2. PLAUSIBLE distribution and fuzzy boundaries

Of the 123 PLAUSIBLE cells, 118 (95.93%) were canonical negatives and 5 (4.07%) canonical positives. By source: PHQ 76, COSO 44, HUM 3.

| label | PLAUSIBLE | finalized cells | rate | old + | old − | Core human disagreement |
|---|---|---|---|---|---|---|
| joy | 10 | 44 | 22.73% | 2 | 8 | 49.73% |
| sadness | 10 | 50 | 20.00% | 1 | 9 | 30.05% |
| excitement | 20 | 108 | 18.52% | 0 | 20 | 61.20% |
| love | 10 | 68 | 14.71% | 0 | 10 | 37.16% |
| optimism | 17 | 122 | 13.93% | 1 | 16 | 61.75% |
| disappointment | 7 | 57 | 12.28% | 0 | 7 | 28.42% |
| fear | 7 | 62 | 11.29% | 0 | 7 | 28.02% |
| annoyance | 4 | 37 | 10.81% | 0 | 4 | 25.14% |
| anger | 5 | 53 | 9.43% | 0 | 5 | 15.85% |
| surprise | 9 | 105 | 8.57% | 0 | 9 | 51.65% |
| amusement | 7 | 84 | 8.33% | 0 | 7 | 41.21% |
| caring | 4 | 76 | 5.26% | 0 | 4 | 40.44% |
| disgust | 2 | 49 | 4.08% | 0 | 2 | 14.21% |
| gratitude | 3 | 77 | 3.90% | 1 | 2 | 43.17% |
| admiration | 2 | 53 | 3.77% | 0 | 2 | 18.68% |
| curiosity | 3 | 94 | 3.19% | 0 | 3 | 37.70% |
| confusion | 2 | 65 | 3.08% | 0 | 2 | 21.86% |
| remorse | 1 | 52 | 1.92% | 0 | 1 | 12.02% |

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

| canonical status | Stage-1 NO | Stage-1 PLAUSIBLE | Stage-1 CLEAR |
|---|---|---|---|
| positive | 0 | 5 | 57 |
| negative | 988 | 118 | 88 |

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

| label | added CLEAR | masked PLAUSIBLE | pred Δ | net TP Δ | net FP Δ | F1 before | F1 after | F1 Δ |
|---|---|---|---|---|---|---|---|---|
| disappointment | 10 | 7 | 2 | 0 | 2 | 0.8571 | 0.6667 | -0.1905 |
| surprise | 6 | 9 | 1 | 0 | 1 | 0.7500 | 0.6667 | -0.0833 |
| gratitude | 2 | 3 | -1 | -1 | 0 | 0.7000 | 0.6316 | -0.0684 |
| excitement | 2 | 20 | 1 | 0 | 1 | 0.5000 | 0.4615 | -0.0385 |
| sadness | 5 | 10 | 4 | 1 | 3 | 0.6923 | 0.6667 | -0.0256 |
| fear | 6 | 7 | 1 | 0 | 1 | 0.4444 | 0.4211 | -0.0234 |
| caring | 11 | 4 | 1 | 0 | 1 | 0.3478 | 0.3333 | -0.0145 |
| admiration | 2 | 2 | 1 | 0 | 1 | 0.0000 | 0.0000 | +0.0000 |
| amusement | 4 | 7 | 0 | 0 | 0 | 0.2500 | 0.2500 | +0.0000 |
| anger | 3 | 5 | 0 | 0 | 0 | 0.0000 | 0.0000 | +0.0000 |

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

| slice | rows | Macro-F1 all 18 | Macro-F1 supported | Micro-F1 |
|---|---|---|---|---|
| all OOF | 841 | 0.492306 | 0.492306 | 0.570888 |
| PHQ OOF | 468 | 0.497711 | 0.497711 | 0.592593 |
| COSO OOF | 319 | 0.370892 | 0.370892 | 0.521341 |
| HUM OOF | 54 | 0.486308 | 0.583569 | 0.694215 |
| reviewed 221 | 221 | 0.411337 | 0.411337 | 0.466523 |
| A/B disagreement 179 | 179 | 0.421291 | 0.421291 | 0.456693 |
| controls 42 | 42 | 0.234568 | 0.281481 | 0.512195 |
| not reviewed 620 | 620 | 0.523877 | 0.523877 | 0.613879 |

The strongest explanation is more specific than “domain shift”:

- Fixed Dev is 149/149 COSO. OOF is a mixed 841-row evaluation: PHQ 468, COSO 319, HUM 54. COSO-only OOF is 0.370892, only 0.025713 above fixed Dev, whereas aggregate OOF is 0.147128 above fixed Dev. Source conditioning removes 82.52% of the raw numerical gap.
- OOF and fixed Dev do **not** use different annotation policies: both are locked outputs of the same two-pass Gemini + adjudication protocol. Stage-1 shows a mismatch between broad applicability and that shared selective policy; it does not prove an OOF-vs-Dev policy change.
- Strict sourceGroup splitting prevents author-group leakage, but it does not change the source mixture or break shared dataset style and shared annotation semantics. OOF therefore measures learnability of canonical supervision within the canonical Train mixture.
- The reviewed 221 are harder under the existing OOF model even against canonical labels (Macro 0.4113; Micro 0.4665) than the 620 non-reviewed rows (Macro 0.5239; Micro 0.6139), consistent with sensitivity/disagreement enrichment; source and label composition remain confounders.
- Fixed Dev is small for an 18-label macro metric: anger has zero positives and five other labels have only 1–2 positives. OOF has much larger per-label support. This amplifies fixed-Dev variance.
- The two headline scores are not a controlled model comparison: OOF used five candidate-C-initialized, two-epoch fold models; fixed Dev uses the saved GoEmotions-targeted current-best checkpoint. The source slice is diagnostic, not a causal decomposition.

Stage-1 nevertheless adds a concrete bridge: COSO is both the weaker OOF source (0.370892) and the source of 80.68% of Stage-1 missing CLEAR cells. That supports source-conditioned semantic complexity and broader-applicability pressure in COSO, while the common canonical annotation contract and small Dev support explain why this should not be reframed as a separate Dev labeling policy. The 82.52% figure is a descriptive gap decomposition, not a causal estimate.

## Final judgment

Stage-1 found **applicability positives**, not necessarily **canonical output positives**. The direct patch failed because it trained the model toward the former and evaluated it against the latter. The evidence supports a supervision-objective mismatch plus strong COSO concentration and enriched-sample bias; it does not support treating the 88 cells as corrected gold. Preserve the 221 as a diagnostic asset and policy-contrast benchmark only.

ANALYSIS ONLY — DO NOT TRAIN
