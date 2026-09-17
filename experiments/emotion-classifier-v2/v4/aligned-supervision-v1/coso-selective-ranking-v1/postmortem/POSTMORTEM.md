# Mechanical ML postmortem — coso-selective-ranking-v1

POSTMORTEM ONLY — NO TRAINING. No inference, rerun, Dev tuning, protected evaluation, or training-code modification was performed. The audit reads existing checkpoints, source, incumbent probabilities and reports only.

## 1. Integrity verdict

**IMPLEMENTATION FAILURE LIKELY**. A 21-column probability-artifact index was applied directly to a 28-output model head in both training and evaluation. This is a confirmed implementation defect, not merely a hypothesis. Eleven of eighteen target columns address the wrong semantic logits. The relative contribution of wrong evaluation naming versus destructive gradients cannot be quantified from the saved artifacts.

## 2. Strongest evidence and exact mechanism

`train_once.py:34` constructs `pos` using `FULL.index(l)`, where FULL has 21 entries; lines 37 and 45 index raw model logits with it. The initialization and final configs both retain the original 28-label order. The incumbent `run_rebaseline.py` applies the same 21-label indexing to an already projected (149,21) probability artifact, where that indexing is appropriate. Copying that convention to raw logits is the boundary error.

Targets and evaluator LABELS have the same 18-label order; the incorrect connection is between each target and the original model output. Both BCE and ranking therefore train incorrect semantic channels. Evaluation then names those channels as the intended product labels. For example, a fear score is reported as joy, joy as optimism, gratitude as love, and nervousness as sadness. A well-preserved initialization can consequently score very poorly even without large parameter movement. This explains a direct mechanism for .3665 → .0450, but does not numerically apportion the decline.

### Exact target/logit correspondence

All indices below are zero-based; table order is target/evaluator column order.

| Target/evaluator label | Target column | Correct head index | Actual index | Actual head meaning |
|---|---:|---:|---:|---|
| admiration | 0 | 0 | 0 | admiration |
| amusement | 1 | 1 | 1 | amusement |
| anger | 2 | 2 | 2 | anger |
| annoyance | 3 | 3 | 3 | annoyance |
| caring | 4 | 5 | 5 | caring |
| confusion | 5 | 6 | 6 | confusion |
| curiosity | 6 | 7 | 7 | curiosity |
| disappointment | 7 | 9 | 8 | desire |
| disgust | 8 | 11 | 10 | disapproval |
| excitement | 9 | 13 | 11 | disgust |
| fear | 10 | 14 | 12 | embarrassment |
| gratitude | 11 | 15 | 13 | excitement |
| joy | 12 | 17 | 14 | fear |
| love | 13 | 18 | 15 | gratitude |
| optimism | 14 | 20 | 17 | joy |
| remorse | 15 | 24 | 18 | love |
| sadness | 16 | 25 | 19 | nervousness |
| surprise | 17 | 26 | 20 | optimism |

The preflight `preparation-audit.json` records the correct mapping, but the actual training script does not consume or assert it. Autograd routes gradients to the selected original rows correctly; the row selection itself is wrong. Only 18 logits enter the loss, but these include four non-product channels: desire, disapproval, embarrassment, nervousness. Product output rows disappointment, remorse, sadness, surprise are omitted. Those four non-product rows changed; the four omitted product output weights and biases are bit-identical before/after. The other six non-product output rows are also unchanged. Shared backbone/dense changes can still affect all 28 output values, even where output-row parameters are unchanged.

## 3. Checkpoint and parameter integrity

201 tensor keys and every shape match; all saved tensors are finite before and after. The output head remains (28,768), with 28 biases; config id2label/label2id remain intact and mutually consistent. Configs are identical. Initialization SHA matches the run summary. No fresh/reinitialized head is indicated by code or the small saved deltas.

| Parameter group | Before L2 | After L2 | Delta L2 | Relative delta | Scalars changed |
|---|---:|---:|---:|---:|---:|
| roberta. | 960.16647807 | 960.16649051 | 0.32752941 | 0.034112% | 73.2379% |
| classifier. | 16.73580702 | 16.73510321 | 0.03840392 | 0.229472% | 98.7419% |
| classifier.dense. | 16.29750456 | 16.29674111 | 0.03796057 | 0.232923% | 99.9981% |
| classifier.out_proj. | 3.80507313 | 3.80524749 | 0.00581862 | 0.152917% | 64.2857% |

Classifier output bias deltas range from -8.98381695151329e-05 to 8.073262870311737e-05. Full row norms/bias deltas and per-tensor changes are in `artifact-audit.json` and `parameter-deltas.csv`. Small norm changes do not prove absence of functional forgetting, but do not support parameter explosion or accidental reinitialization.

Tokenizer/config file hash comparisons: config.json: identical, tokenizer.json: identical, tokenizer_config.json: identical, special_tokens_map.json: identical, vocab.json: identical, merges.txt: identical.

The code loads the requested local epoch-1 initialization, then saves the trained in-memory model before evaluating that same in-memory object. **The evaluator does not reload the saved checkpoint.** Thus there is no wrong-final-load path in this script; there is also no saved reload parity test. Matching keys/shapes and lineage support save integrity, but absent load logs do not establish an observed missing/unexpected-key-free runtime. The original execution command/import resolution and immutable training-script hash were not saved in run/; this audit describes current on-disk code and corroborating tensors, not a complete execution attestation.

## 4. Training trace, LR and normalization

- 841 rows at batch size 2 yield 421 microbatches, with 52 full accumulation windows and one 5-microbatch window; ceil(421/8)=53 optimizer steps agrees with summary. Runtime 281.353 seconds.
- AdamW is constructed with lr=2e-6, weight_decay=.01. No scheduler or LR reassignment exists: nominal optimizer LR is constant 2e-6 for all steps, with **no warmup or decay**. Revised protocol says to retain existing warmup, but a concrete warmup schedule is not specified there. No saved optimizer/LR trace independently proves runtime values. Clipping (max norm 1) and Adam moments affect effective updates; those are not recoverable.
- BCE/ranking/combined loss trajectories and gradient norms are **not saved**. `total` accumulates scalar loss but is never written; clip_grad_norm_ return value is discarded. Printed events only identify optimizer-step numbers. Sudden loss explosion/collapse cannot be determined from endpoints.
- Every loss is divided by 8, including the last window, instead of normalizing the partial window. Last window contains four batches of 2 and one batch of 1: its coefficients are 1/16 per ordinary row and 1/8 for the singleton (before source weighting), rather than 1/9 each for a row-normalized nine-row window. The total coefficient is 5/8, and the singleton gets twice the base weight of its neighboring rows. Clipping and Adam prevent translating this directly into a proportional parameter update.
- BCE computes mean over 18 labels, multiplies each row by source weight **once**, then averages by batch count, not sum of source weights. No double source multiplication exists. At equal row representation its scale relative to a weight-normalized mean is 1160/841≈1.3793. Whether this denominator violates the intended weighted-BCE definition cannot be settled from the abbreviated frozen loss specification.
- COSO has explicit BCE weight 2, PHQ/HUM 1. The last singleton anomaly can double a row's base coefficient, so uniform effective weighting across every row is not established. Ranking is **unweighted by source**, averages all positive-negative pairs within each eligible row, then averages eligible rows within each microbatch; zero-positive rows are excluded. A row's ranking coefficient depends on whether its batch partner is eligible. This is not a global row-mean ranking loss accumulated equivalently across a larger batch.
- `synthetic_validation.py` checks finite ordinary BCE and equivalence of three equal-size BCE batches only. It never calls the real rank loss, never tests source weighting, gradients, the partial/singleton window, mapping, or model mode. Thus the advertised synthetic PASS cannot establish production-loop integrity.
- Another implementation deviation: `from_pretrained` defaults to eval mode (confirmed from installed Transformers source); the script never calls `model.train()`. Dropout is therefore disabled during optimization. Eval mode does not disable gradients. This is not evidence of no training, but is an additional departure from ordinary continuation training.

## 5. Probability artifacts, ordering, and per-label collapse

Candidate run/ contains only summary.json and checkpoint files. No candidate probability matrix, prediction rows, per-label metrics, loss history or optimizer state is persisted by the script. Initial per-label mean, median, min/max and fraction >=.35 are saved in this audit's JSON from the existing (149,21) artifact. After statistics and mean shifts cannot be recovered without new inference; none was performed because the mapping failure already answers the integrity question.

Candidate Dev loader uses shuffle=False by default and walks the same dv list used to create targets, so no input-order mismatch is apparent in code. The deterministic .35/direct-top2 selector is unchanged. The error precedes selection: wrong channels are labeled as product probabilities. Incumbent provenance records a Dev hash and probability hash; candidate output has no Dev hash or per-row IDs, limiting retrospective row identity verification.

N/A below means not saved / not reconstructable from aggregate metrics; it is not zero. No corrected evaluation was performed.

| Label | Incumbent F1 | Candidate F1 | Incumbent pred count | Candidate pred count | Mean probability shift |
|---|---:|---:|---:|---:|---:|
| admiration | 0.000000 | N/A | 1 | N/A | N/A |
| amusement | 0.444444 | N/A | 2 | N/A | N/A |
| anger | 0.000000 | N/A | 1 | N/A | N/A |
| annoyance | 0.344828 | N/A | 8 | N/A | N/A |
| caring | 0.363636 | N/A | 7 | N/A | N/A |
| confusion | 0.000000 | N/A | 2 | N/A | N/A |
| curiosity | 0.000000 | N/A | 1 | N/A | N/A |
| disappointment | 0.857143 | N/A | 3 | N/A | N/A |
| disgust | 0.000000 | N/A | 0 | N/A | N/A |
| excitement | 0.428571 | N/A | 6 | N/A | N/A |
| fear | 0.444444 | N/A | 8 | N/A | N/A |
| gratitude | 0.700000 | N/A | 8 | N/A | N/A |
| joy | 0.725490 | N/A | 60 | N/A | N/A |
| love | 0.307692 | N/A | 4 | N/A | N/A |
| optimism | 0.538462 | N/A | 14 | N/A | N/A |
| remorse | 0.000000 | N/A | 1 | N/A | N/A |
| sadness | 0.692308 | N/A | 15 | N/A | N/A |
| surprise | 0.750000 | N/A | 3 | N/A | N/A |

Aggregate prediction count fell 144→114; abstentions rose 35→59. TP fell 86→19 while FP rose 58→95; FN rose 79→146. This is not merely evidence of producing fewer predictions: a much greater share is wrong. Misnamed channels provide a concrete mechanism. The artifacts cannot establish that all labels collapsed, that every score moved below .35, or which individual labels became high after training. Correctly mapped first seven labels may also shift through shared parameters; their individual results are unavailable.

## 6. Ranking hypothesis and next action

**Is the ranking hypothesis actually falsified? NO.** This run did not implement the intended label-aligned hybrid objective/evaluation, and has secondary normalization/mode deviations. It cannot establish genuine objective failure. It also cannot establish that ranking would succeed. No clean causal claim about catastrophic forgetting, ranking, or source weighting is supported by this run.

**NEXT ACTION = protocol-level repair analysis — NO TRAINING**
