# Native Valence Auxiliary Adaptation v1

Decision: **REJECT**. Promotion status remains **INCONCLUSIVE**.

The fixed hypothesis was that the rights-cleared native human `positive/negative/neither` task from Unexpected Events could adapt the incumbent's top two encoder layers to short-event affect without manufacturing Product-18 labels. The original emotion classifier head was frozen and verified tensor-identical after training; a temporary valence head was discarded.

Data feasibility passed: 8,120/8,122 prepared rows had native valence labels, with participant-disjoint 7,714/406 train/validation rows. Labels remained `NATIVE_HUMAN_VALENCE_NOT_PRODUCT18_GOLD`; no mapping to Product-18 occurred.

One fixed epoch used train-derived square-root inverse-frequency cross-entropy weights. Held-out valence accuracy was 0.8251, but macro-F1 was only 0.5680 because the 26 `neither` validation examples received zero predictions. The auxiliary-task guard therefore failed.

On historical COSO-149, emotion micro-F1 changed `0.5281 -> 0.5147`, false positives `58 -> 63`, false negatives `85 -> 86`, and 0/1/2 outputs `35/90/24 -> 32/92/25`. The 19-row short slice changed from F1 `0.6154` and FP/FN `5/5` to F1 `0.5926` and FP/FN `6/5`. Supported-label regressions included disappointment `-0.2571`, caring `-0.0751`, and gratitude `-0.0684`.

Unlabeled behavior remained stable enough for its guards: exact incumbent/candidate output agreement was 97.12% on Hippocorpus and 96.06% on Unexpected Events. This stability is not correctness evidence and does not offset the labeled regressions.

Conclusion: even with the Product-18 head unchanged, supervised valence adaptation moved the encoder in a direction that degraded discrete-emotion behavior. The candidate is rejected; the incumbent remains unchanged.
