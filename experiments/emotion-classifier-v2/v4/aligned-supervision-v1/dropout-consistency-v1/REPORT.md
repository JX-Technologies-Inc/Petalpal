# Dropout Consistency v1

Decision: **REJECT**. Promotion status remains **INCONCLUSIVE**.

The feasibility diagnostic found substantial stochastic instability on admitted short-event train text: 39.84% of Hippocorpus rows and 28.13% of Unexpected Events rows changed selected output across five dropout passes. This supported one fixed consistency experiment.

The candidate initialized from the incumbent and trained for one epoch on a 5,274-row, 1:1 source-balanced admitted train pool. Only the top two encoder layers were trainable. The classifier head was frozen and verified tensor-identical. Two dropout passes were softly anchored to the incumbent's deterministic Product-18 probabilities and penalized for probability disagreement. No hard labels, pseudo-gold, threshold changes, or hyperparameter sweep were used.

The independent validation stability hypothesis failed. Hippocorpus unstable rows stayed at 35.97% and mean pairwise agreement fell slightly `0.8036 -> 0.8000`. Unexpected Events unstable rows increased `26.11% -> 29.06%` and pairwise agreement fell `0.8648 -> 0.8547`. Average relative unstable-row reduction was `-5.66%`, meaning instability worsened.

On COSO-149, micro-F1 changed `0.5281 -> 0.5226`, false positives `58 -> 64`, false negatives `85 -> 84`, and 0/1/2 outputs `35/90/24 -> 32/89/28`. The 19-row short-slice aggregate F1 and FP/FN stayed unchanged, although its output counts moved `8/9/2 -> 7/11/1`. Supported-label regressions included surprise `-0.0833` and gratitude `-0.0684`.

The candidate failed its core stability, aggregate F1, false-positive, and supported-label guards. It is rejected without a consistency-weight, dropout-strength, epoch, or learning-rate follow-up.
