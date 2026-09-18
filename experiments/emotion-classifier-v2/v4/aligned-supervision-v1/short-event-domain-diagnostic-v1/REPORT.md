# Short-Event Domain Diagnostic v1

Status: **PASS — descriptive diagnostic only; no training or promotion decision**

The canonical incumbent evaluator exactly reproduced the locked 149-row historical development micro-F1 of `0.5280528053`. This matters because an earlier local draft used a noncanonical simplified selector; those draft outputs were renamed `*.invalid-*` and are not evidence.

The historical development set is poorly matched to the PetalPal length target. Its character-length median/P75/P90 are `616/906/1189`; only `19/149` rows (`12.75%`) are at most 300 characters. No row exceeds the 512-token runtime ceiling, so the mismatch is product-domain length, not truncation.

On the 19-row `<=300` slice, incumbent micro-F1 is `0.6154` and false positives are `0.2632` per row, versus `0.5199` and `0.4077` on the 130 rows over 300 characters. These differences are descriptive only: the short slice is too small, label support is sparse, and COSO is not independent rights-cleared product gold. They do not establish that short-event quality is better.

On the independent, rights-cleared but unlabeled 139-row Hippocorpus validation split, the incumbent produced 0/1/2-label counts of `21/100/18`. This is a behavior profile only; without Product-18 human gold it provides no correctness score and cannot justify promotion.

Conclusion: the short-event evaluation gap is material. Model promotion remains **INCONCLUSIVE**, the incumbent remains `goemotions-targeted-v1/experiment/epoch-1-checkpoint`, and its historical GoEmotions/Reddit-derived lineage remains rights-unresolved and not production-cleared.
