# Disposition and next-step recommendation

## v1 disposition

`sealed-blog-eval-v1` must remain immutable and `NOT_SEALED`. Its locked protocol fixes 360 rows and 360 authors and makes support >=15 for every label a seal prerequisite. The completed labels fail that prerequisite. The protocol contains no extension mechanism; appending, replacing, deleting, or relabeling rows would be a post-outcome protocol change.

The completed cohort should be retained as a failed feasibility pilot and audit record. It must not be used for classifier evaluation, tuning, model selection, threshold selection, or error-driven data design.

## Recommended successor (requires approval; not created or locked)

Create a separate `sealed-natural-eval-v2`, with no inheritance of v1 labels and no deficit-targeted extension. Recommended design:

- 1,200 human-written entries from 1,200 authors not present in v1 or any historical lineage.
- Pure deterministic natural-domain sampling from a rights-cleared personal-reflection source; no taxonomy cues, model outputs, v1 support deficits, or old evaluation errors in row selection.
- Same fixed 18-label taxonomy, 0-2 policy, independent Pass A/B, disagreement-only adjudication, and immutable post-annotation cohort.
- Preregister support >=15 for every label as a validity check, but do not modify the cohort if it fails.
- Report 18-label Macro-F1, Micro P/R/F1, per-label support/F1, and author bootstrap intervals. Permit one preregistered candidate evaluation only after sealing.

Why 1,200: natural sampling avoids cue-conditioned lexical enrichment. The v1 empirical minimum prevalence was 7/360; at that rate 1,200 yields about 23 expected positives, leaving practical headroom above 15 without using label-specific deficits to select rows. This is a planning calculation, not permission to reuse v1 rows or labels.

Estimated annotation cost from v1 actual spend is `1200 / 360 * US$1.88420325 = US$6.2806775`. This exceeds the prior US$2 authorization, so no source selection, new protocol lock, candidate creation, or API annotation should begin without explicit approval. The Blog Authorship Corpus also lacks a declared dataset license in its source card; use a rights-cleared source or obtain explicit research-use approval before locking v2.

No new evaluation design has been locked by this recommendation.
