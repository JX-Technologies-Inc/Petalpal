# Independent QA specification

Status: `DESIGN_FROZEN / QA_NOT_STARTED`

## Role and permitted output

QA is a target-visible verifier, independent of the target author and Event writer. It receives exactly the immutable target record, the linked generation attempt, canonical Product-18 definitions, and mechanical-check results. It receives no incumbent output, model prediction, COSO/RTN error, protected row, other reviewer vote, desired acceptance rate, or split performance.

QA returns exactly one decision:

- `PASS`
- `REJECT`
- `FLAG`

QA may attach only schema-defined flags and check results. It must not rewrite Event text, alter any state, substitute a target, negotiate a label, or use agreement/majority voting to create gold.

## PASS conditions

Every condition must hold:

1. Every `SELECTED` label is supported by the author's Event and is independently central enough for PetalPal's final zero-to-two output.
2. Every `PLAUSIBLE_NOT_SELECTED` label is genuinely supported for the author, yet clearly secondary to every selected label. It is neither an unsupported distractor nor an equally central label pushed down to fit a target.
3. Every `NOT_APPLICABLE` label is unsupported by the Event. A reasonably supported omitted emotion fails this check.
4. Zero, one, or two selected labels is natural. Two labels have distinct central signals and distinct production clusters; neither is merely a consequence, synonym, generic valence, or another person's emotion.
5. An abstention contains no reasonable author-specific Product-18 evidence. Ambiguity is not abstention.
6. The Event is English, natural personal-Event prose, at most 300 Unicode characters, and preferably 40–220 without padding.
7. It contains no label-word shortcut, definition copying, conspicuous template, name/place swap, or unnatural target exposition.
8. Rights/provenance declarations and exact, normalized, near-duplicate, template, scenario-family, and split-isolation checks are clean.

A `PASS` record has no flags and all applicable schema checks equal `YES`.

## REJECT conditions

Use `REJECT` when a failure is clear, including:

- a selected label is absent or not central;
- a plausible label is absent, equally central, or actually should be selected;
- a not-applicable label is reasonably supported;
- a two-label target is redundant or selector-incompatible;
- an abstention suppresses supported emotion;
- text is non-English, over length, unnatural, non-personal, templated, duplicative, leaking labels, or provenance-invalid;
- target and Event do not align for any reason.

Rejected records remain immutable and excluded. QA does not say what replacement labels should be. Regeneration follows the frozen replacement rule and cannot reuse rejected prose.

## FLAG conditions

Use `FLAG` only when the verifier cannot resolve a material semantic, duplication, or provenance question from the authorized evidence. `FLAG` is quarantined and excluded exactly like a rejection until a non-label process question is resolved. Resolution cannot modify the target or Event; if either would need modification, reject it.

## Audit rules

- No acceptance quota or desired distribution is shown to QA.
- QA order is randomized within each split, while target/Event links remain intact.
- Final Test QA is completed and sealed before training by a role that does not participate in candidate selection.
- Aggregate acceptance, rejection, flag, reason, length, label-support, cardinality, P0-direction, and family statistics are reported. They diagnose generation quality but cannot trigger post-Dev or post-Final relabeling or generation.
- A high reject rate is a generator/target-design finding, not permission to weaken the rubric.
