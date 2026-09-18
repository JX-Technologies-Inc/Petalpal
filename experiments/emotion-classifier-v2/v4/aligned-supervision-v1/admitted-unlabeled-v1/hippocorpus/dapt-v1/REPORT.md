# Hippocorpus DAPT v1 — Research-Only Result

## Scope and governance

Hippocorpus is `ADMIT_UNLABELED`: O-UDA-1.0 permits the present ML use, and its original crowd-written English summaries are Event-like. It supplies no Product-18 human gold. The initialized encoder is the existing historical GoEmotions/Reddit-derived incumbent; its underlying training-text rights remain unresolved, so every resulting checkpoint remains research-only and not production-cleared.

No human review, pseudo-labeling, frozen product evaluation, threshold tuning, taxonomy change, or production change occurred.

## Product-length corpus

Before filtering, the 2,779 recalled summaries have character-length median/P75/P90 of 167/213/259. `99.9280%` are at most 300 characters and `0.0720%` are over. The automatic policy keeps each complete summary only when it is at most 300 characters; it does not truncate. Two over-length summaries and one contact-pattern match were excluded.

The prepared corpus contains 2,776 unique unlabeled summaries: 2,637 train and 139 held-out validation rows, with 2,524/135 disjoint anonymized author groups.

## Full DAPT result

One epoch updated only the top two encoder layers and MLM transform head. Held-out MLM loss improved from `9.0983` to `3.7429` (`-58.86%`), but the candidate failed the frozen-development false-positive guard:

| Diagnostic | Incumbent | Full DAPT |
| --- | ---: | ---: |
| Micro-F1 | 0.4016 | 0.3941 |
| Macro-F1 over supported labels | 0.2474 | 0.2766 |
| 0 / 1 / 2 outputs | 71 / 67 / 11 | 69 / 56 / 24 |
| False positives | 38 | 51 |
| False positives per row | 0.2550 | 0.3423 |

The `+0.0872` false-positive increase per row exceeded the locked `+0.05` limit, so full DAPT was rejected despite improved MLM loss.

## Fixed midpoint repair

A single predeclared 50% encoder-weight midpoint between the incumbent and rejected DAPT encoder was tested; the original classifier head remained byte-for-byte tensor-equivalent, and no interpolation sweep was performed.

| Diagnostic | Incumbent | 50% midpoint | Change |
| --- | ---: | ---: | ---: |
| Held-out MLM loss | 9.0983 | 5.1062 | -43.88% |
| Micro-F1 | 0.4016 | 0.3985 | -0.0031 |
| Macro-F1 over supported labels | 0.2474 | 0.2566 | +0.0091 |
| 0 / 1 / 2 outputs | 71 / 67 / 11 | 67 / 68 / 14 | — |
| False positives | 38 | 44 | +6 |
| False positives per row | 0.2550 | 0.2953 | +0.0403 |
| Exact selected-output agreement | — | 93.96% | — |
| Mean absolute probability change | — | 0.00614 | — |

For labels with support at least 3, the worst F1 change was sadness at `-0.0316`, within the `-0.10` guard. The midpoint passed all predeclared retention guards and is retained as a **research candidate only**.

## Conclusion

The experiment demonstrates a bounded representation-adaptation signal and a workable forgetting-control mechanism. It does **not** demonstrate product-model improvement. Promotion remains `INCONCLUSIVE_NO_INDEPENDENT_RIGHTS_CLEARED_HUMAN_GOLD`, and the unresolved historical GoEmotions/Reddit lineage independently prevents production-clearance claims.
