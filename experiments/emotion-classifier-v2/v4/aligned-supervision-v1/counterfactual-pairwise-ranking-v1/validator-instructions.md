# Blind pair validator instructions

Judge every JSON object in `blind-input.jsonl` independently.

For each pair, decide which Event provides stronger support for the supplied target-label definition:

- `A_STRONGER`
- `B_STRONGER`
- `TIE_UNCLEAR`

The weaker Event does not need to be an absolute negative. Compare only the target emotion. Other emotions may occur naturally; do not judge general intensity or writing quality. Choose `TIE_UNCLEAR` when neither direction is adequately supported.

Write one JSON object per input row, in the same order, with exactly these fields:

```json
{"pairId":"CPV1-001","judgment":"A_STRONGER"}
```

Do not add reasoning, summaries, markdown, or extra fields. Process all rows exactly once.
