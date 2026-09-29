# Targeted short-Event synthetic weak supervision v1

Decision: **INCONCLUSIVE — DO_NOT_TRAIN**. The synthetic pool was repaired and blind-labeled successfully, but the predeclared supervision-coherence gate failed. No classifier candidate was trained, RTN-300 was not opened for this experiment, and the frozen incumbent remains unchanged.

## Product-fit audit and repair

The source was the 800-row `synthetic_targeted_events_800_v1.csv` candidate pool. Audit and repair were entirely programmatic; no row received human review or adjudication.

- Original/final rows: `800 / 800`.
- Repaired/replaced/removed: `218 / 0 / 0`. Repair reasons overlap: 99 generated transition tails removed, 80 excessive explanatory tails removed, and 47 role-led third-person reports given a concrete personal relationship context.
- Length after repair: min `34`, max `192`, mean `106.6825`, median `107` characters.
- Exact/normalized/TF-IDF near duplicates after repair: `0 / 0 / 0`.
- Product-fit heuristic failures: `43 -> 0`; Event-shape failures: `0 -> 0`.
- Template leakage: sentence-boundary transition occurrences `99 -> 0`; repeated clause types `2 -> 0`; repeated five-word suffix types `31 -> 0`; maximum five-word suffix frequency `4 -> 1`.
- Removed transition family included `At the next chance`, `Once recorded`, `When we spoke again`, `By week's end`, `On a second look`, `At the last check`, and `Once settled`.

The frozen blind input contains only `rowId` and repaired Event text. It contains no intended target, generator category, incumbent output, COSO/RTN information, or other agent output.

## Independent weak labeling

Agents were `gpt-6-astra / medium`, `gpt-5.6-sol / medium`, and `gpt-5.6-luna / medium`. Each independently received only the frozen Event text, Product-18 definitions, and the 0-2-label policy. All three 800-row outputs were frozen before comparison. No fourth adjudicator or human review was used. Forty-eight Luna rows required mechanical canonical label-order normalization; their label sets were unchanged.

Exact-set consensus:

- HIGH_CONSENSUS (3/3): `274`
- MEDIUM_CONSENSUS (2/3): `420`
- UNRESOLVED: `106`
- Resolved 0/1/2-label distribution: `65 / 621 / 8`
- High-only 0/1/2-label distribution: `19 / 255 / 0`

Resolved per-label weak support:

| Label | Support | Label | Support |
|---|---:|---|---:|
| admiration | 65 | amusement | 0 |
| anger | 71 | annoyance | 2 |
| caring | 0 | confusion | 0 |
| curiosity | 54 | disappointment | 3 |
| disgust | 61 | excitement | 62 |
| fear | 73 | gratitude | 3 |
| joy | 2 | love | 50 |
| optimism | 65 | remorse | 70 |
| sadness | 56 | surprise | 0 |

Agent behavior:

| Agent | 0 labels | 1 label | 2 labels | Empty rate | Mean labels/row |
|---|---:|---:|---:|---:|---:|
| Astra | 121 | 675 | 4 | 15.125% | 0.85375 |
| Sol | 54 | 677 | 69 | 6.750% | 1.01875 |
| Luna | 151 | 487 | 162 | 18.875% | 1.01375 |

Per-label agent frequencies:

| Label | Astra | Sol | Luna |
|---|---:|---:|---:|
| admiration | 76 | 74 | 54 |
| amusement | 0 | 1 | 0 |
| anger | 73 | 91 | 49 |
| annoyance | 2 | 6 | 4 |
| caring | 0 | 12 | 6 |
| confusion | 1 | 0 | 6 |
| curiosity | 52 | 72 | 74 |
| disappointment | 8 | 14 | 1 |
| disgust | 71 | 69 | 35 |
| excitement | 66 | 64 | 91 |
| fear | 77 | 79 | 67 |
| gratitude | 2 | 12 | 25 |
| joy | 0 | 15 | 14 |
| love | 50 | 81 | 144 |
| optimism | 72 | 72 | 74 |
| remorse | 72 | 75 | 48 |
| sadness | 61 | 77 | 86 |
| surprise | 0 | 1 | 33 |

Conservatism is mixed rather than attributable to one uniformly conservative agent: Luna abstained most, while Astra had the lowest mean label count and almost never emitted two labels. Pairwise exact-set agreement was Astra/Sol `619`, Astra/Luna `316`, and Sol/Luna `307` rows.

## Frozen training decision

The protocol was frozen before audit or labeling. HIGH-only required at least 300 rows and failed at 274. HIGH+MEDIUM passed row count, non-empty count, distinct-label, per-label support, maximum-share, and empty-rate checks, but failed the required two-label coverage: `8 < 15`. Zero-support labels were amusement, caring, confusion, and surprise; annoyance, disappointment, gratitude, and joy also had very low support.

Therefore:

- Rows used for training: `0`.
- Training protocol executed: none.
- The frozen but unexecuted protocol was incumbent initialization; classifier plus top two encoder layers; one epoch; LR `1e-6`; weight decay `0.01`; batch 16; seed 48; standard unweighted Product-18 BCE; unchanged threshold `0.35` and max-two selector.
- No gate was relaxed, no labels were forced, no unresolved row was used, and no coverage regeneration occurred after aggregate supervision was visible.

## Classifier decision

Because no candidate was trained, candidate COSO and RTN metrics are not applicable. The historical frozen research incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`.

- Incumbent COSO-149: micro-F1 `0.5281`, macro-F1 `0.3452`, exact-set `34.90%`, FP/FN `58/85`, output 0/1/2 `35/90/24`.
- Incumbent RTN-300 RESOLVED model-consensus reference: micro-F1 `0.3163`, macro-F1 `0.3184`, exact-set `50.41%`, FP/FN `62/85`, output 0/1/2 `153/86/5`.
- Candidate deltas: not applicable; RTN was not opened for this experiment.
- Classifier actually improved: **NO**.
- Current incumbent changed: **NO**.
- SHA/hash logic added: **NO**. The task-local generator SHA reporting was removed; historical frozen-protocol hashes were not redesigned.

The exact decision is **INCONCLUSIVE — DO_NOT_TRAIN**, not a retained classifier candidate. A rescue using lower two-label requirements, post-consensus generation, quotas, or a second training configuration is forbidden.

Next highest-value task remains an external evidence change: a rights-cleared, source-grouped, independently human-labeled short-Event Product-18-compatible dataset, or written rights clearance for a suitable exhaustively annotated source. The existing pending permission routes should be resolved before another model-only synthetic supervision variant.
