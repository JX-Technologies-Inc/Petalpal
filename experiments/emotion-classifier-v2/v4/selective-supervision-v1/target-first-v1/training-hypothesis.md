# Future training hypothesis

Status: `FROZEN_DESIGN / DO_NOT_TRAIN`

Target-first semantics require no change to the existing single Selective Supervision V1 hypothesis. Only target-first rows with `QA_RESULT.decision = PASS` from the Train split may be used.

For Event `i` and Product-18 logit `z[i,l]`:

- `SELECTED` receives ordinary unweighted BCE target `1`.
- `NOT_APPLICABLE` receives ordinary unweighted BCE target `0`.
- `PLAUSIBLE_NOT_SELECTED` is masked out of BCE.
- For each within-Event pair `s ∈ SELECTED`, `p ∈ PLAUSIBLE_NOT_SELECTED`, require `z[i,s] > z[i,p]` with zero-margin logistic ranking loss `softplus(z[i,p] - z[i,s])`.

Per row:

`L_bce(i) = mean(BCEWithLogits(z[i,l], y[i,l]))` over `SELECTED ∪ NOT_APPLICABLE`.

`L_rank(i) = mean(softplus(z[i,p] - z[i,s]))` over the Cartesian product `SELECTED × PLAUSIBLE_NOT_SELECTED`, or zero when no pair exists.

`L(i) = L_bce(i) + (1/18) * L_rank(i)`.

The batch objective is the unweighted mean of row losses. The frozen `lambda_rank = 1/18` is inherited unchanged; there is no loss, weight, seed, learning-rate, threshold, or data sweep. The Product-18 mapping, threshold `0.35`, canonical selector clusters, maximum-two output, and `primaryGardenMood = null` remain unchanged.

There is one future candidate only. A failed run ends V1; it does not authorize another objective, extra epochs, rescue data, relabeling, or a second candidate.
