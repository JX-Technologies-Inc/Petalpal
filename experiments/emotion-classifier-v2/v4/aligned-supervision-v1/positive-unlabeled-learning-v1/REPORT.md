# Positive-Unlabeled Learning V1

Date: 2026-09-18

Decision: **REJECT**

Classifier actually improved: **NO**

The sole frozen nnPU candidate was trained once, frozen, and evaluated once. It improved RTN recall and Macro-F1, but increased false positives, reduced exact-set agreement, missed the predeclared RTN Micro-F1 requirement, and materially regressed COSO. No rescue run was performed.

## 1. Exact PU formulation

For target label logit `z` and fixed class prior `pi`, the per-label non-negative PU logistic risk was:

`pi * mean_P(softplus(-z)) + max(0, mean_U(softplus(z)) - pi * mean_P(softplus(z)))`

Each label-stratified batch affected only one Product-18 target logit. Unconfirmed cells never received target 0, neutral gold, or loss for another label.

## 2. Positive and unlabeled supervision

The training pool reused the already frozen, fully synthetic Three-State V1/V2/V3 cohorts only. `HIGH_POSITIVE` and `MEDIUM_POSITIVE` consensus cells became P. Every other cell, including cells previously called negative or uncertain, became U.

| Source | Events | Confirmed positive cells |
|---|---:|---:|
| Three-State V1 | 126 | 131 |
| Three-State V2 | 90 | 91 |
| Three-State V3 | 108 | 107 |
| Total | 324 | 329 |

- Total Product-18 cells: 5,832.
- Confirmed P cells: 329.
- U cells: 5,503.
- Confirmed positives per label: 17–21; every Product-18 label was covered.
- Negative targets created: 0.
- Neutral-gold targets created: 0.
- RTN/COSO/reference rows used for training: 0.
- Label status: `MODEL_GENERATED_SYNTHETIC_WEAK_PSEUDO_NOT_HUMAN_GOLD`.

No new validation agents were needed: the P cells already came from the previously frozen independent Astra/Sol/Luna consensus runs.

## 3. Class-prior method

`pi = 1/18 = 0.0555555556` was fixed uniformly for all labels before training. This came only from the training-side generator design: each source cohort had exactly one intended positive assignment per Event on average, balanced across 18 labels. The prior was not estimated from RTN or COSO and was not swept.

## 4. Exact training protocol

- Initialization: frozen incumbent `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.
- Objective: nnPU logistic risk above; no base BCE or auxiliary loss.
- Trainable parameters: classifier and encoder layers 10–11 only; 14,787,868 of 124,667,164 parameters.
- Optimizer: AdamW, LR `1e-6`, weight decay `0.01`.
- Epochs: one shuffled pass through every U cell for every label.
- Batch: at most 32 target-label cells, comprising 8 P draws and up to 24 U cells.
- Positive sampling: seeded with replacement from the target label's P set.
- Seed: 54.
- Max length: 512; gradient clipping: 1.0; linear schedule with 10% warmup.
- Inference: unchanged threshold 0.35 and max-2 selector.
- Training executed 234 optimizer steps, visited all 5,503 U cells exactly once, and made 1,872 P draws.
- Mean total/positive/raw-negative/clamped-negative risk: `0.131882 / 0.107270 / 0.012578 / 0.024612`.
- The non-negative clamp activated on 109/234 steps.
- CPU training time: 282.9 seconds.

The candidate checkpoint and training summary were saved before evaluation artifacts were opened. The incumbent was not modified in place.

## 5. COSO-149 result

| Metric | Incumbent | Candidate | Delta |
|---|---:|---:|---:|
| Micro-F1 | 0.5281 | 0.5125 | -0.0156 |
| Macro-F1 | 0.3452 | 0.3365 | -0.0087 |
| Exact-set | 34.90% | 31.54% | -3.36 pp |
| False positives | 58 | 73 | +15 |
| False negatives | 85 | 83 | -2 |
| Output 0/1/2 | 35/90/24 | 29/85/35 | — |

Important supported-label F1 changes included love `+0.1410`, fear `+0.0556`, and surprise `+0.0500`, but excitement fell `-0.0714`, gratitude `-0.0684`, joy `-0.0329`, and sadness `-0.0256`. The COSO Micro, Macro, exact-set, FP, and supported-label-regression gates failed.

## 6. RTN-300 RESOLVED result

| Metric | Incumbent | Candidate | Delta |
|---|---:|---:|---:|
| Micro-F1 | 0.3163 | 0.3305 | +0.0142 |
| Macro-F1 | 0.3184 | 0.3373 | +0.0189 |
| Exact-set | 50.41% | 47.95% | -2.46 pp |
| Precision | 0.3542 | 0.3333 | -0.0208 |
| Recall | 0.2857 | 0.3277 | +0.0420 |
| False positives | 62 | 78 | +16 |
| False negatives | 85 | 80 | -5 |
| Output 0/1/2 | 153/86/5 | 135/101/8 | — |

The candidate's Micro-F1 gain was slightly below the frozen meaningful-improvement minimum of `0.3313265306`, while exact-set, precision, and FP gates failed. The output distribution moved toward more predictions rather than collapsing to abstention, but the additional recall cost too many false positives.

Important supported-label F1 changes were gratitude `+0.1500`, love `+0.1212`, optimism `+0.0929`, and disappointment `+0.0455`; regressions included confusion `-0.0667`, surprise `-0.0635`, fear `-0.0364`, and joy `-0.0353`. Improvement was not isolated to one label, but it was not globally defensible.

On RTN HIGH, Micro/Macro-F1 changed `0.3678/0.3360 -> 0.3871/0.3578`, while exact-set fell `55.66% -> 53.77%`, FP rose `31 -> 35`, and FN fell `24 -> 22`.

## 7. Decision

**REJECT**.

The experiment demonstrates the intended PU tradeoff: positive recall and several target labels improved without hard-negative targets, but the candidate became too aggressive. RTN FP rose by 16 and COSO FP by 15; both evaluation sets lost exact-set accuracy, and COSO Micro/Macro regressed. Therefore the classifier did not improve under the frozen success definition.

No prior, LR, epoch, seed, threshold, positive inclusion, selector, or gate was changed after evaluation. There will be no PU V2 rescue.

## 8. Current incumbent and next task

Current incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

The next materially different task should change the evidence source rather than reweight PU: acquire independently human-labeled, rights-cleared short-Event evidence with explicit per-label positive and negative judgments. The already specified `rw3d-explicit-extremes-v1` remains conditional on written product-use clearance; no external search or permission request was made in this task.
