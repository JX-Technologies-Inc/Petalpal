CURRENT INCUMBENT:
- COSO Micro-F1: `0.5281`
- RTN RESOLVED Micro-F1: `0.3163`
- RTN RESOLVED Macro-F1: `0.3184`
- RTN exact-set: `50.41%`
- RTN FP/FN: `62 / 85`
- RTN 0/1/2: `153 / 86 / 5`

NEW CANDIDATE:
- COSO Micro-F1: `0.5521`
- delta: `+0.0241`
- RTN RESOLVED Micro-F1: `0.3644`
- delta: `+0.0481`
- RTN RESOLVED Macro-F1: `0.3660`
- delta: `+0.0476`
- RTN exact-set: `50.41%`
- delta: `0.00 pp`
- RTN FP/FN: `83 / 74`
- RTN 0/1/2: `127 / 106 / 11`

# Decoupled balanced Product-18 head v1

Decision: **REJECT**. This is the strongest RTN F1/macro candidate observed, but its false-positive increase violates both COSO and RTN precision guards. It does not replace the frozen incumbent.

## Hypothesis and data

This experiment tested long-tail decoupled classifier retraining (cRT), a materially different mechanism from the previously rejected full-model positive-weight loss. The incumbent encoder and classifier dense transform were frozen. Only the 18 Product-18 rows and biases in `classifier.out_proj` were trained.

The fixed 1,045-row training set combined 841 aligned historical research rows and the existing 204 targeted GoEmotions rows. A deterministic weighted sampler made one 1,045-row replacement draw: empty rows received inverse empty-count weight, while positive rows received the maximum inverse positive count among their labels. The copied incumbent head was trained for one epoch with ordinary BCE, AdamW LR `1e-3`, batch 32, seed 44. RTN was not used.

All inputs and initialization remain rights-unresolved and research-only. Canonical Product-18, threshold 0.35, max-two selection, and the evaluator were unchanged.

## Integrity

An initial artifact-assembly attempt was invalid: PyTorch advanced-index `.copy_()` modified a temporary tensor, so the saved model was byte-for-tensor identical to the incumbent. That artifact is preserved under `invalid-assembly-run/` and its scores are not evidence. The implementation was corrected to `index_copy_` and rerun under the exact same frozen data and hyperparameters.

The valid candidate changed Product-18 output weights by L2 `0.7208` and biases by L2 `0.0059`. Non-Product output rows had maximum absolute change `0.0`; every tensor outside `classifier.out_proj` was unchanged.

## Result

The decoupled head substantially improved recall and label-count alignment:

- COSO micro/macro-F1 `0.5281/0.3452 -> 0.5521/0.3505`; FN `85 -> 75`; exact-set `34.90% -> 36.24%`.
- RTN RESOLVED micro/macro-F1 `0.3163/0.3184 -> 0.3644/0.3660`; FN `85 -> 74`; outputs `153/86/5 -> 127/106/11`; distribution error `54 -> 16`.
- RTN HIGH micro-F1 `0.3678 -> 0.4468`, exact-set `55.66% -> 59.43%`, and FN `24 -> 19`.
- Supported COSO gains included caring `+0.1683`, surprise `+0.1591`, annoyance `+0.1552`, fear `+0.1270`, joy `+0.0221`, and optimism `+0.0200`.

The balanced sampler also shifted the effective priors too far toward positive outputs. COSO FP rose `58 -> 71` and RTN RESOLVED FP rose `62 -> 83`, failing mandatory guards. Gratitude F1 regressed `-0.1783`, failing the supported-label guard.

## Decision and next task

The candidate passes the F1, macro, exact, FN, distribution, and high-consensus gates, but fails both FP guards and supported-label stability. The complete decision is **REJECT**. It is the best RTN-scoring rejected candidate, not the current model.

Balanced sampling has a known, measurable train-prior shift. The next and final bounded formulation applies the exact binary log-odds correction implied by the original combined-train priors versus the deterministic sampled priors to the cRT head biases. The correction uses training labels only, has no tunable strength, and is frozen before any corrected COSO/RTN inference. No threshold or per-label development calibration is permitted.
