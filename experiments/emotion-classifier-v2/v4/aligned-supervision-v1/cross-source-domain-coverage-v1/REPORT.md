# Cross-Source Short-Event Coverage v1

Status: **PASS — no training, no model-quality conclusion**

The locked automatic comparison confirms that the two admitted unlabeled sources have different roles:

- Hippocorpus: `PRIMARY_FIRST_PERSON_EVENT`; 2,776 rows, median 167 characters, first-person markers in 95.53%.
- Unexpected Events: `AUXILIARY_HYPOTHETICAL_EVENT`; 8,122 rows, median 49 characters, first-person markers in 0.89% and third-person markers in 74.75%.

Their normalized vocabulary Jaccard overlap is 0.3081. Unexpected Events contributes 2,848 source-unique word types across 21 scenario materials, so it adds lexical/scenario coverage. Its larger row count does not make it more representative of PetalPal's first-person Event construct and must not allow it to dominate a future corpus mixture.

Neither source contains Product-18 human gold. This diagnostic authorizes no training, correctness score, promotion, or production-clearance claim. It only fixes source roles for future bounded research.
