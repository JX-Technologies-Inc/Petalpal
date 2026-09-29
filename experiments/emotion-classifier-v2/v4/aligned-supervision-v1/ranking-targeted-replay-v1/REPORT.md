CURRENT INCUMBENT:
- COSO Micro-F1: `0.5281`
- RTN RESOLVED Micro-F1: `0.3163`
- RTN RESOLVED Macro-F1: `0.3184`
- RTN exact-set: `50.41%`
- RTN FP/FN: `62 / 85`
- RTN 0/1/2: `153 / 86 / 5`

NEW CANDIDATE:
- COSO Micro-F1: `0.5298`
- delta: `+0.0017`
- RTN RESOLVED Micro-F1: `0.3333`
- delta: `+0.0171`
- RTN RESOLVED Macro-F1: `0.3285`
- delta: `+0.0101`
- RTN exact-set: `52.05%`
- delta: `+1.64 pp`
- RTN FP/FN: `56 / 84`
- RTN 0/1/2: `159 / 79 / 6`

# Selective ranking with targeted replay v1

Decision: **REJECT**. This is the highest RTN RESOLVED micro-F1 observed in the current loop, but it does not satisfy the complete balance/COSO gate and does not replace the frozen incumbent.

## Hypothesis and data

The correctly mapped repaired ranking checkpoint had improved cross-diagnostic precision/exact-set behavior while losing COSO macro-F1, especially excitement, surprise, and gratitude. This experiment tested whether replaying the existing targeted GoEmotions tranche during ranking training would preserve targeted label semantics.

Training used the 841 aligned historical research rows plus the existing 204 targeted GoEmotions rows, 1,045 total. All data and initialization belong to the historical rights-unresolved research lineage. RTN supplied no training target, example choice, calibration, threshold, or parameter.

The candidate initialized from the incumbent and ran one epoch over the fixed combined data. It used the correctly recovered 28-head Product-18 indices, row-mean BCE plus 0.25 positive-versus-absent pairwise ranking, LR `2e-6`, batch 16, seed 44, and COSO-row weight 2. The full model was updated. There was no intermediate evaluation, sweep, or rescue.

## Result

RTN aggregate quality improved materially:

- RESOLVED micro-F1 `0.3163 -> 0.3333`, macro-F1 `0.3184 -> 0.3285`, exact-set `50.41% -> 52.05%`.
- RESOLVED FP/FN improved `62/85 -> 56/84`.
- HIGH micro-F1 `0.3678 -> 0.3810`, exact-set `55.66% -> 57.55%`, FP/FN `31/24 -> 28/24`.
- COSO micro-F1 changed `0.5281 -> 0.5298`, exact-set `34.90% -> 36.24%`, and FP/FN `58/85 -> 57/85`.

The candidate nevertheless became too conservative on RTN: outputs changed `153/86/5 -> 159/79/6`, while consensus is `128/113/3`; summed distribution error rose from 54 to 68. COSO macro-F1 fell `0.3452 -> 0.3296`. Supported COSO regressions included surprise `-0.1786` and gratitude `-0.0684`; love and joy improved `+0.1410` and `+0.0416`.

## Decision and next task

The candidate passes the aggregate RTN F1/exact/FP/FN gates and COSO micro/FP/FN gates, but fails RTN output-distribution, COSO macro, and supported-label gates. The frozen decision rule therefore gives **REJECT**. It is recorded as the best RTN-scoring rejected candidate, not a retained incumbent or production model.

No replay-ratio, rank-weight, threshold, or blend rescue is authorized. The next materially different experiment is a decoupled classifier retraining (cRT) test: freeze the incumbent representation, train only the Product-18 output head under one fixed label-balanced row sampler on the same admissible 1,045 rows, and retain the unchanged canonical inference path.
