# Label-Wise Prototype Supervision V1

Date: 2026-09-18

Decision: **REJECT**

Classifier actually improved: **NO**

The sole frozen prototype candidate was trained once, frozen, and evaluated once. RTN recall, Micro-F1, Macro-F1, and several labels improved modestly, but false positives rose, exact-set fell, and COSO materially regressed. The positive prototype geometry diagnostic also worsened slightly rather than improving.

## 1. Exact formulation

The experiment used one fixed centroid per Product-18 label.

1. Run the frozen incumbent over every validated positive training Event.
2. Take the final RoBERTa encoder CLS vector before the classification head and L2-normalize it.
3. For each label, average representations from all Events with validated positive membership in that label, then L2-normalize the centroid.
4. Freeze all 18 centroids before training.
5. Train with:

   `positive-only masked BCE + 1.0 * mean(1 - cosine(event_representation, fixed_label_centroid))`

The BCE term was `softplus(-target_logit)` only for validated positive memberships. All unconfirmed label-cells were masked. There was no repulsion loss, no hard-negative construction, and no assumption that different labels were mutually negative.

Multi-label Events contributed independently to both validated label prototypes and both attraction terms.

## 2. Positive supervision source

Only already frozen, rights-clean synthetic training-side positives were used:

| Source | Positive-bearing Events |
|---|---:|
| Three-State V1/V2/V3 frozen positive consensus | 270 |
| Synthetic Semantic V2 frozen positive consensus | 137 |
| Total | 407 |

The pool contained 314 single-label and 93 two-label Events, for 500 validated label memberships. There were no normalized exact duplicates, every Event was at most 300 characters, and no RTN/COSO/reference row entered prototype construction or training.

### Per-label positive support

| Label | Support | Label | Support | Label | Support |
|---|---:|---|---:|---|---:|
| admiration | 19 | amusement | 31 | anger | 18 |
| annoyance | 36 | caring | 37 | confusion | 36 |
| curiosity | 18 | disappointment | 36 | disgust | 18 |
| excitement | 18 | fear | 23 | gratitude | 35 |
| joy | 39 | love | 38 | optimism | 18 |
| remorse | 18 | sadness | 25 | surprise | 37 |

## 3. Validation and independence

No new synthetic examples were generated and no new multi-agent validation was used. Every membership came from prior complete Astra/Sol/Luna blind consensus artifacts that had already been frozen before their original aggregation. This experiment did not reopen, modify, or adjudicate those outputs.

New validation used: **NO**. Fourth adjudicator: **NO**. Repeated-model vote: **NO**. Human review: **NO**.

## 4. Training protocol

- Initialization: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- Representation: final encoder CLS, 768 dimensions.
- Prototypes: one fixed centroid per label, constructed before training.
- Base-loss policy: option A, prototype auxiliary plus existing masked classification objective; the classifier objective contained positive cells only.
- Prototype loss weight: 1.0, frozen before training; no sweep.
- Trainable parameters: RoBERTa encoder layers 10–11 only; classifier frozen.
- Trainable parameters: 14,175,744 of 124,667,164.
- Optimizer: AdamW; LR `1e-6`; weight decay `0.01`.
- Epochs: 2; batch size: 16 Events; 52 optimizer steps.
- Seed: 55; max length: 512; gradient clip: 1.0; linear schedule with 10% warmup.
- Inference: unchanged threshold 0.35 and max-2 selector.
- Membership visits: 1,000, exactly two passes over 500 positive memberships.
- Mean total / positive BCE / prototype loss: `2.7720 / 2.4807 / 0.2913`.
- Negative targets and repulsive pairs created: 0/0.

The candidate checkpoint and training summary were saved before any evaluation artifact was opened. The incumbent was not modified in place.

## 5. Prototype diagnostic

| Positive-membership cosine | Before | After | Delta |
|---|---:|---:|---:|
| Overall | 0.73914 | 0.73644 | -0.00270 |
| Single-label | 0.73159 | 0.72912 | -0.00246 |
| Multi-label | 0.75189 | 0.74880 | -0.00310 |

All 18 per-label mean cosines declined, by approximately `-0.0015` to `-0.0041`. This diagnostic is training-side and auxiliary only, but it shows that the equal-weight combined objective did not achieve its intended positive-centroid alignment. The observed gradients from positive BCE and centroid attraction were not mutually sufficient to improve the frozen-centroid metric under this protocol.

## 6. COSO-149

| Metric | Incumbent | Candidate | Delta |
|---|---:|---:|---:|
| Micro-F1 | 0.5281 | 0.5143 | -0.0138 |
| Macro-F1 | 0.3452 | 0.3302 | -0.0150 |
| Exact-set | 34.90% | 32.89% | -2.01 pp |
| False positives | 58 | 69 | +11 |
| False negatives | 85 | 84 | -1 |
| Output 0/1/2 | 35/90/24 | 29/90/30 | — |

Major supported-label changes included love `+0.1410`, but surprise fell `-0.0833`, gratitude `-0.0684`, sadness `-0.0256`, fear `-0.0234`, and joy `-0.0198`. COSO Micro, Macro, exact-set, FP, and supported-label-regression gates failed.

## 7. RTN-300 RESOLVED

| Metric | Incumbent | Candidate | Delta |
|---|---:|---:|---:|
| Micro-F1 | 0.3163 | 0.3246 | +0.0083 |
| Macro-F1 | 0.3184 | 0.3302 | +0.0118 |
| Exact-set | 50.41% | 49.18% | -1.23 pp |
| Precision | 0.3542 | 0.3394 | -0.0147 |
| Recall | 0.2857 | 0.3109 | +0.0252 |
| False positives | 62 | 72 | +10 |
| False negatives | 85 | 82 | -3 |
| Output 0/1/2 | 153/86/5 | 142/95/7 | — |

Major supported-label gains were gratitude `+0.1944`, love `+0.1212`, and disappointment `+0.0455`. Regressions included fear `-0.0364`, surprise `-0.0357`, joy `-0.0248`, and optimism `-0.0065`.

RTN HIGH Micro/Macro changed `0.3678/0.3360 -> 0.3778/0.3446`, but exact-set fell `55.66% -> 53.77%`; FP/FN changed `31/24 -> 33/23`.

The frozen RTN Micro, exact-set, FP, and HIGH exact-set gates failed. Macro, precision floor, recall, FN, distribution, HIGH Micro, broad-label improvement, and catastrophic-regression protection passed.

## 8. Decision and interpretation

**REJECT**.

The experiment did not improve its primary representation diagnostic and did not translate positive-only prototype supervision into defensible classifier behavior. Like PU V1, it shifted toward more nonempty predictions and recovered some positives, but the FP and exact-set costs remained unacceptable and COSO regressed. Prototype separation alone was not retained as a success criterion, and here even the intended attraction metric moved in the wrong direction.

No loss-weight, layer, epoch, seed, LR, prototype count, temperature, threshold, or positive-pool change was made after evaluation. There will be no Prototype V2 rescue.

Current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

This experiment taught us that positive-only representation shaping, even with multi-label-aware fixed centroids and no fabricated negatives, does not supply enough precision control for this classifier. The next materially different task should change the evidence source: independently human-labeled, rights-cleared short-Event data with explicit per-label positives and negatives. The conditional `rw3d-explicit-extremes-v1` remains blocked pending written product-use clearance; this task performed no external search or permission request.
