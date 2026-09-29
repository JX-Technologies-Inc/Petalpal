# Synthetic Event generation contract

Read `target-plan.jsonl`. For every row, generate one original English first-person private Event of 30-260 Unicode characters. Do not copy, quote, transform, or paraphrase any external or repository source text.

For a one-label target, make that secondary emotion reasonably expressed and central, but avoid using the canonical label word itself. Do not add content that clearly requires a second Product-18 label. For an empty target, write a concrete personal Event that does not reasonably express any Product-18 secondary emotion. Keep the Event natural and varied; avoid repeated templates, explanations, label definitions, diagnostic claims, and meta-language.

Write exactly one JSON object per plan row, in plan order, to `generator-output.jsonl`:

```json
{"rowId":"TBS-0001","targetLabels":["admiration"],"text":"..."}
```

Use exactly the target supplied by the plan. Do not include rationale or other keys.
