CURRENT INCUMBENT:
- COSO Micro-F1: `0.5281`
- RTN RESOLVED Micro-F1: `0.3163`
- RTN RESOLVED Macro-F1: `0.3184`
- RTN exact-set: `50.41%`
- RTN FP/FN: `62 / 85`
- RTN 0/1/2: `153 / 86 / 5`

NEW CANDIDATE:
- COSO Micro-F1: `0.5287`
- delta: `+0.0006`
- RTN RESOLVED Micro-F1: `0.3144`
- delta: `-0.0019`
- RTN RESOLVED Macro-F1: `0.3293`
- delta: `+0.0109`
- RTN exact-set: `50.00%`
- delta: `-0.41 pp`
- RTN FP/FN: `74 / 83`
- RTN 0/1/2: `142 / 94 / 8`

# Training-prior-corrected decoupled head v1

Decision: **REJECT**. The analytical correction does not produce a balanced all-around improvement. The frozen incumbent remains the current best model under the complete gate.

## Hypothesis and correction

The uncorrected balanced cRT head strongly improved RTN recall, macro-F1, and label-count alignment but inflated false positives. This experiment tested the standard prior-shift explanation without using evaluation data: for each Product-18 label, add

`logit(original combined-train positive rate) - logit(realized sampled positive rate)`

to the cRT bias. The realized sampled priors were reproduced from the fixed inverse-frequency sampler, 1,045 replacement draws, and seed 44. Correction strength was exactly 1.0. No COSO/RTN label, output, threshold, row, or metric entered the calculation. Only Product-18 biases changed; the encoder, dense transform, learned cRT weights, non-Product rows, threshold 0.35, max-two selector, and evaluator remained fixed.

The correction ranged from `+0.1944` log-odds for annoyance to `-0.8468` for caring. Data and lineage remain rights-unresolved and research-only.

## Result

The correction reduced the uncorrected cRT's aggressiveness, but not enough to satisfy FP guards and too much for several labels:

- COSO micro-F1 was effectively flat versus incumbent (`0.5281 -> 0.5287`), but macro-F1 fell `0.3452 -> 0.3274`; FP/FN changed `58/85 -> 66/82`.
- RTN RESOLVED micro-F1 fell `0.3163 -> 0.3144`; macro-F1 improved `0.3184 -> 0.3293`; exact-set fell `50.41% -> 50.00%`; FP/FN changed `62/85 -> 74/83`.
- RTN output counts became `142/94/8`, with distribution error 38, better than incumbent 54 but worse than the uncorrected cRT's 16.
- RTN HIGH remained directionally better: micro-F1 `0.3678 -> 0.4176`, exact-set `55.66% -> 59.43%`, FP/FN `31/24 -> 32/21`.
- Supported COSO regressions included amusement `-0.2500` and gratitude `-0.2000`; caring and annoyance improved `+0.1522` and `+0.1417`.

## Decision and stopping boundary

The candidate fails RTN RESOLVED micro/exact/FP and COSO macro/FP/supported-label gates. It is **REJECT**. No correction-strength, threshold, or blend sweep is authorized.

Current best retained model: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, with COSO micro-F1 `0.5281` and RTN RESOLVED micro/macro-F1 `0.3163/0.3184`.

Best rejected score candidate: `decoupled-balanced-head-v1/candidate/checkpoint`, with COSO micro/macro-F1 `0.5521/0.3505` and RTN RESOLVED micro/macro-F1 `0.3644/0.3660`, but FP `71` on COSO and `83` on RTN RESOLVED. It cannot be retained under the complete quality gate.

The current locally actionable, materially different paths have been reasonably exhausted: full-model BCE/weighted/asymmetric/ranking routes, targeted replay, DAPT/consistency/weak supervision/synthetic supervision, alternate DeBERTa/NLI formulations, and decoupled balanced-head/prior-correction formulations have all been tested. Continuing from these results would require an evaluation-derived calibration strength, replay ratio, threshold, or similar rescue sweep, which is forbidden.

The highest-value unlock is a new rights-cleared, source-grouped, human-labeled English short-Event dataset with Product-18-compatible labels, usable for a genuinely independent calibration/model-selection source. A genuinely new locally available pretrained short-text emotion backbone with clear redistribution/commercial lineage would also reopen an architecture test without tuning the existing failures. No human labeling or permission workaround is requested.
