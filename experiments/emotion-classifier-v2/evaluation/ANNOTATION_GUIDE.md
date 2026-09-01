# PetalPal In-Domain Annotation Guide

Annotate each example independently without viewing model predictions. Judge whether a secondary emotion adds useful information beyond the user-selected Primary Garden Mood. Use only the current 21-label taxonomy; `neutral`, `approval`, and `disapproval` may be discussed during review but are not valid Flower Variant outputs.

## Fields

- `expectedSecondaryEmotions`: the best 0–2 useful secondary emotions; prefer one when sufficient.
- `acceptableAlternatives`: reasonable but less useful alternatives.
- `clearlyWrongEmotions`: outputs that clearly conflict with the journal or would create a misleading modifier.
- `preferNoSecondaryEmotion`: `true` when abstention is the best result; otherwise `false`.
- `primaryRedundantEmotions`: plausible labels that only repeat the Primary Mood and add no modifier value.
- `expectedOutputCount`: set `min` and `max` to the useful output range (`0–0`, `1–1`, or `1–2`).
- `rationale`: one concise sentence explaining the judgment.

## Process

1. Two reviewers annotate all examples independently and remain blind to predictions.
2. Do not infer an emotion only from the selected Primary Mood; evaluate the journal for additional information.
3. Prefer abstention for empty, neutral, too ambiguous, or entirely Primary-redundant journals.
4. Keep expected, acceptable, clearly wrong, and Primary-redundant lists mutually exclusive.
5. Adjudicate disagreements before running Candidate C-Lite and record the final gold annotations separately from predictions.
