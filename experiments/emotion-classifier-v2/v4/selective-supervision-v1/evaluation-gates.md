# Selective Supervision V1 evaluation gates

Status: `FROZEN_DESIGN / NO EVALUATION YET`

## Evaluation contract

The unchanged incumbent and the single frozen candidate are scored on the exact same rows of each authorized split with the exact same Product-18 mapping, threshold `0.35`, cluster policy, tie-break, and maximum-two selector. V1 is Event-only and always passes `primaryGardenMood = null`. Historical incumbent scores are context only; every delta is computed on the new split itself.

Use the canonical `lib/secondary-emotion-selector.js` with clusters from `lib/flower-variant-config.js`, sigmoid probabilities filtered at `>=0.35`, descending score and fixed Product-18 order for ties, and maximum two outputs. The current evaluator's `v4/auto-v1/experiment.py::report` uses this Primary-unavailable policy. Do not substitute the cluster-free `canonical-direct-top2-v1/evaluator.py` or `auto-v1/selector-v4.mjs` ablation. Do not invoke historical evaluation entry points or their default datasets; no protected historical holdout is authorized by V1.

Reference `SELECTED` is the expected output set. A predicted `PLAUSIBLE_NOT_SELECTED` label is still an output error for exact-set and Product-18 F1, but it is tracked separately from a prediction marked `NOT_APPLICABLE`.

For a direction `s > p`, eligible rows have `s` selected and `p` plausible-not-selected. Directional **selection accuracy** is the fraction with `s` in the final output and `p` absent; ranking success alone does not count. Directional **raw-ranking accuracy** is the fraction with `z_s > z_p`; ties fail. Average row indicators within a direction, average directions equally for macro accuracy, and average the two directions equally for an unordered pair. Also report the fraction of pair-bearing rows where every selected-versus-plausible pair is correctly ranked.

Report Macro precision/recall/F1 over all 18 labels, supported-label Macro-F1, Micro precision/recall/F1, TP/FP/FN, exact-set accuracy, output cardinality `0/1/2`, correct and unwanted abstention, per-label metrics/support, P0 directional selection accuracy, P0 raw-score ranking accuracy, and errors split into plausible-versus-not-applicable predictions.

Split supports are frozen before training using references only. A supported label has at least 15 selected references; a supported P0 direction has at least 8 rows. These are reporting/support definitions, not generation quotas. Report counts and low-support status for every label and all 14 directions, including zero-support cells. All-18 Macro-F1 uses all 18 labels with `zero_division=0`; supported-label Macro-F1 uses the fixed supported set. Correct abstention rate is the fraction of true-empty rows predicted empty; unwanted abstention is the count of nonempty-reference rows predicted empty.

Do not silently omit a missing direction from the 14-direction selection macro or a missing pair from the seven-pair guards. A direction with 1–7 rows remains in that macro with a low-support warning; its lack of eight rows is not itself failure. An undefined required Dev metric (e.g. a zero-support P0 direction, no supported P0 directions, no supported labels, or no true-empty rows) means insufficient evidence, never an automatic pass. If knowable from pretraining Dev support, record `INCONCLUSIVE_COVERAGE / DO_NOT_TRAIN`; do not force synthetic rows or weaken a gate. Final coverage gaps only limit the terminal report and never make a training decision. The engineered synthetic distribution and sparse cells preclude claims about real-domain prevalence or statistical certainty from these point thresholds.

## Selective Dev: sole candidate PASS / REJECT gate

Run once after the final candidate checkpoint freezes. The full quality/behavior guards previously placed on Final Test are moved here; there is no second selection gate. All must pass on **Selective Dev**:

1. **Primary score:** all-18 Macro-F1 is at least incumbent `+0.020` absolute.
2. **Micro preservation:** Micro-F1 is at least incumbent `-0.005`.
3. **FP control:** candidate FP is no more than incumbent FP plus `max(3, ceil(0.01 * N_dev))`.
4. **Exact-set:** exact-set accuracy is not below incumbent.
5. **Abstention behavior:** unwanted abstention count does not exceed incumbent; total empty-output rate is no more than incumbent `+0.030`; correct abstention rate on true-empty rows is at least incumbent `-0.020`.
6. **Supported-label guard:** no supported label loses more than `0.050` F1, no more than two supported labels lose more than `0.020`, and supported-label Macro-F1 does not decrease.
7. **P0 boundary improvement:** macro directional selection accuracy across the 14 P0 directions improves by at least `+0.080`; at least five of seven unordered P0 pairs improve strictly; no pair regresses more than `0.050`.
8. **Ranking mechanism:** macro raw-logit `SELECTED > PLAUSIBLE_NOT_SELECTED` accuracy across supported P0 directions improves by at least `+0.050`.
9. **No cardinality gaming:** mean labels per row stays within `±0.15` of the reference mean and within `±0.15` of the incumbent unless the change reduces both FP and FN.

All nine passing yields `PASS_DEV`; any failure or undefined required metric yields `REJECT_DEV` (record insufficient evidence where applicable), and Locked Final Test stays unopened. Neither outcome authorizes tuning, regeneration, relabeling, or another candidate. A PASS is limited to the joint intervention on this synthetic-weak benchmark, not causal attribution or production promotion.

## Locked Final Test: one-time terminal evaluation firewall

1. Before training, a separate preparation role locks the new Final split and validates only dataset integrity, rights, isolation, and reference coverage. Final text/references are unavailable to the training/candidate-decision process. Final coverage summaries are not candidate selection or training inputs. The protocol and metric definitions also freeze before training.
2. Record `PASS_DEV` before any model inference on or release of Final content to the evaluator. Freeze the sole candidate checkpoint, unchanged incumbent, tokenizer, label mapping, threshold, selector, and evaluation code before that access.
3. A separate evaluator makes exactly one terminal evaluation of both frozen systems on the same locked rows. It freezes predictions before revealing references/scores and returns aggregate metrics, deltas, support/coverage limitations, and the fixed nine Dev guard values as descriptive quantities only. No training agent receives Final row-level errors.
4. There is **no `PASS_FINAL`, `REJECT_FINAL`, or Final promotion gate**. Final results cannot accept, reject, replace, rescue, tune, continue training, or select a second candidate; the recorded Dev candidate decision remains unchanged. Unfavorable results must be reported plainly and limit any generalization claim. Favorable results do not authorize deployment.
5. After that report, V1 is closed. No second opening, re-scoring changed predictions, post-Final threshold/loss/seed/LR/gate changes, annotation repair, or error-driven dataset follow-up is allowed. Missing support is reported `NOT_ESTIMABLE`, never filled after seeing results. The protected historical frozen-100 and other historical holdouts remain outside V1 authorization throughout.

## Interpretation boundary

Dev PASS establishes only that the single candidate cleared the predeclared synthetic-weak development gate. Final evaluation estimates its performance on another locked synthetic-weak split and may fail to corroborate Dev. Neither split establishes real PetalPal improvement, converts targets into human gold, clears upstream rights, or justifies production deployment. Production promotion still requires rights-cleared model lineage and independent human Product-18 evidence with short-Event coverage and a separately authorized protocol. No new real-data collection, human review, or historical evaluation is authorized here.

The largest validity risk is generator/annotation self-consistency: a model may learn synthetic target conventions and score better without improving on real PetalPal Events. Scenario/prompt-family isolation, old-text preservation, naturalness checks, and one-time evaluation reduce leakage, but do not establish real-domain validity. QA sees target states and is only blind to predictions and evaluation outcomes; its independence does not remove target-confirmation bias. Report performance/support by predeclared origin (reused/new), length (`<40`, `40–220`, `221–300`), selected cardinality, and plausible-label presence; report empty slices as unavailable. These are descriptive domain-gap checks, never new gates or tuning opportunities. Improvements confined to target-generated styles or weakly supported cells must be described as such.
