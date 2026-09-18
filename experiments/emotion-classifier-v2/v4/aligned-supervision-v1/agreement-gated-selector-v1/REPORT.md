# Agreement-Gated Selector v1

Decision: **REJECT**. Promotion status remains **INCONCLUSIVE**.

One fixed non-training selector retained only Product-18 labels selected by both the incumbent and domain-restoration checkpoints under the existing canonical threshold 0.35/max-2 policy. There was no probability blend, threshold change, or selector sweep.

On COSO-149, false positives improved `58 -> 53`, false negatives changed `85 -> 88`, micro precision improved `0.5797 -> 0.5923`, but recall fell `0.4848 -> 0.4667` and micro-F1 fell `0.5281 -> 0.5220`. Output counts changed `35/90/24 -> 40/88/21`. The 19-row short slice was unchanged. The supported-label regression guard failed, most notably because love F1 changed `0.1667 -> 0.0` and excitement changed `0.5000 -> 0.4000`.

Unlabeled behavior stayed close to the incumbent: exact output agreement was 98.56% on Hippocorpus and 98.52% on Unexpected Events, with small shifts toward abstention. These are stability observations, not correctness evidence.

The selector met its FP, FN, precision, short-slice, and unlabeled-stability guards, but failed the locked overall F1 and supported-label guards. It is rejected rather than retuned into label-specific gates or blends.
