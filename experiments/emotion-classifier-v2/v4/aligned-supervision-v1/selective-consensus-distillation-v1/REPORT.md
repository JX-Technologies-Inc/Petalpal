# Selective Consensus Distillation v1

Decision: **REJECT**. Promotion status remains **INCONCLUSIVE**.

## Hypothesis and teachers

The fixed hypothesis was that exact-output, high-confidence consensus between two frozen research teachers could create conservative weak supervision on rights-cleared short Events and avoid the false-positive growth seen in MLM DAPT.

- Incumbent teacher: `goemotions-targeted-v1/experiment/epoch-1-checkpoint`. It descends from the historical candidate-c/GoEmotions Reddit-derived research lineage through aligned and standard-continuation training, then a fixed targeted GoEmotions continuation. It is the frozen research incumbent, not production-cleared.
- Domain-restoration teacher: `domain-restoration-v1/experiment/epoch-1-checkpoint`. It initializes from the incumbent and receives one fixed standard-BCE epoch on the existing 841-row aligned PetalPal Train. It had slightly better COSO micro-F1 and FP/FN but worse macro-F1, so it was used only as a behaviorally different consensus filter, not as an incumbent replacement.

Both teachers inherit unresolved historical underlying-text rights. Their outputs are `WEAK_PSEUDO_NOT_HUMAN_GOLD` and provide no independent evaluation evidence.

## Feasibility

The locked feasibility gate passed without opening the prepared validation splits: exact teacher output agreement was 98.27% on a 5,274-row, 1:1 source-balanced train pool. Fixed confidence rules yielded 2,416 eligible weak rows: 1,162 Hippocorpus and 1,254 Unexpected Events, including 995 confident abstentions. Nine Product-18 labels had at least 20 strong positives.

## Fixed candidate

One epoch at `2e-6` updated only the classifier and top two encoder layers from the incumbent. The 2,416 training rows were complete `<=300`-character admitted text. Uncertain labels were masked; no confidence threshold, epoch, learning rate, or checkpoint sweep was performed.

On the historical COSO-149 development diagnostic:

| Diagnostic | Incumbent | Candidate |
| --- | ---: | ---: |
| Micro precision | 0.5797 | 0.5532 |
| Micro recall | 0.4848 | 0.4727 |
| Micro F1 | 0.5281 | 0.5098 |
| False positives | 58 | 63 |
| False negatives | 85 | 87 |
| 0/1/2 outputs | 35/90/24 | 31/95/23 |

On the 19-row `<=300` descriptive slice, micro-F1 changed `0.6154 -> 0.5926`, false positives `5 -> 6`, and false negatives remained 5. Supported-label regressions included gratitude `-0.2294`, disappointment `-0.1905`, optimism `-0.1164`, excitement `-0.1000`, and caring `-0.0621`.

Previously untouched unlabeled validation behavior remained stable: exact incumbent/candidate output agreement was 89.21% on Hippocorpus and 95.07% on Unexpected Events, with all 0/1/2 distribution shifts below 1.5 percentage points. Stability does not offset the labeled-diagnostic regressions.

All labeled quality guards failed; both unlabeled stability guards passed. The candidate checkpoint is rejected, the incumbent is unchanged, and no product-quality improvement is claimed.
