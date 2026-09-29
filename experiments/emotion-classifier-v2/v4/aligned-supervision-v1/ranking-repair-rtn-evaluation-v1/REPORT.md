CURRENT INCUMBENT:
- COSO Micro-F1: `0.5281`
- RTN RESOLVED Micro-F1: `0.3163`
- RTN RESOLVED Macro-F1: `0.3184`
- RTN exact-set: `50.41%`
- RTN FP/FN: `62 / 85`
- RTN 0/1/2: `153 / 86 / 5`

NEW CANDIDATE:
- COSO Micro-F1: `0.5364`
- delta: `+0.0084`
- RTN RESOLVED Micro-F1: `0.3208`
- delta: `+0.0045`
- RTN RESOLVED Macro-F1: `0.3204`
- delta: `+0.0020`
- RTN exact-set: `51.23%`
- delta: `+0.82 pp`
- RTN FP/FN: `59 / 85`
- RTN 0/1/2: `156 / 83 / 5`

# Repaired selective-ranking canonical/RTN evaluation v1

Decision: **REJECT**. The candidate improves several aggregate scores but does not pass the complete frozen gate. The current best retained model remains the frozen incumbent.

## Hypothesis and data

The pre-existing repaired checkpoint was trained on the 841-row aligned historical research Train set from the frozen incumbent, using source-weighted BCE plus a 0.25 pairwise selected-versus-absent ranking loss. The repaired run corrected the historical 28-head/logit mapping defect. It had never been evaluated on RTN and its historical COSO result used a different direct-top2 research evaluator.

This milestone performed no training. It ran the unchanged canonical threshold-0.35/max-two evaluator on COSO-149 and the frozen RTN-300 reference. The checkpoint and all underlying training lineage remain rights-unresolved and research-only. RTN was evaluation-only and supplied no targets, thresholds, examples, calibration, or intervention parameters.

## Result

The candidate made a consistent but small precision-side improvement:

- COSO FP/FN improved `58/85 -> 56/84`, exact-set `34.90% -> 36.24%`, and micro-F1 `0.5281 -> 0.5364`.
- RTN RESOLVED FP/FN improved `62/85 -> 59/85`, exact-set `50.41% -> 51.23%`, and micro-F1 `0.3163 -> 0.3208`.
- RTN HIGH FP/FN improved `31/24 -> 27/24`, exact-set `55.66% -> 58.49%`, and micro-F1 `0.3678 -> 0.3855`.

The complete gate nevertheless failed. RTN RESOLVED micro-F1 required `>=0.3313`; output distribution error was 60 versus the allowed 54. COSO macro-F1 fell `0.3452 -> 0.3307`. Supported-label regressions included excitement `-0.1364`, surprise `-0.0833`, and gratitude `-0.0684`; caring, joy, and optimism improved `+0.0688`, `+0.0568`, and `+0.0585`.

## Decision and next task

This is a real directional gain but not a defensible all-around replacement. It is **REJECT**, not retained and not blended with the incumbent. No threshold or evaluator rescue is permitted.

The next bounded experiment is selective ranking with targeted-data replay. Its general hypothesis is that replaying the existing 204 targeted GoEmotions training rows while applying the correctly mapped ranking objective can prevent the observed rare-label forgetting without discarding the cross-diagnostic FP/exact-set gains. This hypothesis is chosen from COSO supported-label regression and training provenance, not RTN row errors.
