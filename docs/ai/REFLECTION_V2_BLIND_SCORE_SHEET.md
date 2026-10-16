# Reflection editorial review — blind score sheet

Reviewer ID: ______  Date: ______  Native output locale/register: ______

Independence confirmed (not a prompt author; no arm identities or prompt diff seen): ______

Use an independent copy per reviewer for each stage. The coordinator supplies only the selected cases' exact synthetic Events with aliases and two unedited outputs labeled A/B. Leave unrun rows blank. Do not infer which version is newer. Do not discuss scores until both reviewers submit and lock their sheets. Ignore model names, cost and latency; the coordinator withholds those metadata. Reviewers must be qualified native-language editors/readers in the output register, able to understand the mixed-language evidence, and independent of prompt authorship. Use two reviewers per locale, with blinded third-person adjudication when needed.

First read each narrative for naturalness, specificity, comfort and style; record scores before seeing sentence citations. Then inspect every meaningful clause against its cited Events and complete factual scoring. Finally compare the pair. Both outputs may be acceptable, or neither may be acceptable. Do not reward more words or more emotion.

## Score anchors

Score each dimension 0–4: **0 unacceptable, 1 substantial problems, 2 needs revision, 3 acceptable, 4 strong**.

| Code | Dimension | What to judge |
|---|---|---|
| N | Native naturalness | Directly composed, idiomatic and pleasant to read; appropriate colloquial rhythm and code-switching; Traditional Chinese vocabulary beyond converted characters. |
| F | Factual accuracy | Each meaningful claim follows from cited Events; actor, negation, litotes, quantities, time, uncertainty, relationships and object identity stay faithful. Assign 4 only if the full audit finds no unsupported assertion. |
| P | Personal specificity | Concrete, recognizable details from this person's Events; no generic insight substituting for attention. |
| C | Emotional comfort | Feelings retain their stated intensity and timing; no therapy, diagnosis, hidden motives, forced consolation, advice or imposed recovery. |
| V | Variation / unforced style | No formulaic inventory, repeated attribution, decorative emotional metaphor, unsupported interpretation or mandatory lesson/closing. Compare repetition across this locale's cases too. |

**Automatic failure:** any materially invented fact, outcome, feeling, motive, causal link, relationship, object identity or temporal continuation/resolution. Negation reversals and assigning another person's experience to the user also fail. A fluent sentence and valid citations cannot rescue it. Quote the offending clause, identify the cited Event, and explain the unsupported inference. Do not assume separately mentioned drawings are either identical or different. Missing information is not evidence of an outcome.

Technical gate: invalid schema, wrong locale, insufficient citations or missing represented Monthly weeks fails the sample independently of style. A Weekly mixed/negation sample must include E1 and at least one of E2–E5 to exercise both aspects of that case; otherwise mark **coverage unassessed**, not an invented-fact failure. Do not regenerate to fill a gap.

## Pair scoring

Enter five separate scores in N/F/P/C/V order. Preference: A, B, tie, or neither. Fill only supplied cases for your assigned output locale. For failure notes, use the audit table below. Stage 1 supplies C01/C04/C05; Stage 2 supplies C08/C09/C12 only after review and separate approval. Other rows are optional targeted follow-ups, not required samples.

| Case | Type | Locale | Material | A N/F/P/C/V | B N/F/P/C/V | Auto-fail A/B? | Preferred | Reason / note ID |
|---|---|---|---|---|---|---|---|---|
| C01 | Weekly | en | Mixed/negation | | | | | |
| C02 | Weekly | en | Ordinary | | | | | |
| C03 | Weekly | zh-Hans | Mixed/negation | | | | | |
| C04 | Weekly | zh-Hans | Ordinary | | | | | |
| C05 | Weekly | zh-Hant | Mixed/negation | | | | | |
| C06 | Weekly | zh-Hant | Ordinary | | | | | |
| C07 | Monthly | en | Mixed/negation | | | | | |
| C08 | Monthly | en | Ordinary | | | | | |
| C09 | Monthly | zh-Hans | Mixed/negation | | | | | |
| C10 | Monthly | zh-Hans | Ordinary | | | | | |
| C11 | Monthly | zh-Hant | Mixed/negation | | | | | |
| C12 | Monthly | zh-Hant | Ordinary | | | | | |

| Note ID / case / arm | Exact clause | Cited Event(s) | Unsupported claim or style concern | Material failure? |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

Cross-case repeated opening, closing, chronology or imagery observed: ______

Scores locked at: ______  Reviewer signature/ID: ______

## Coordinator decision — only after blinded scores are locked

- Every evaluated candidate must pass technical validation and the relevant coverage check, have **zero material factual failures**, F=4 and N/P/C/V>=3 after blinded adjudication. No aggregate average can hide a failing sample. A major unsupported claim automatically fails that arm. Candidate material error, poor writing or meaningful language regression means **STOP**: recommend the smallest justified prompt revision as a separate task before more paid evaluation. Never repair a generated sample.
- After Stage 1's three pairs, lock scores and explicitly decide whether the evidence justifies Monthly testing. Stage 1 alone cannot satisfy a six-pair signal. Stage 2 requires separate owner approval after this review; successful technical execution is insufficient. Ambiguous judgments should first be adjudicated without further inference. If uncertainty remains, recommend the smallest targeted follow-up instead of automatically purchasing six Opus calls.
- Across the **six preselected pairs from Stages 1 and 2**, at least **5/6 adjudicated preferences for the improved prompt**, no material factual errors and no meaningful language regression constitute a **preliminary positive signal only**. Ties are not wins. Any lower naturalness score requires explicit blinded adjudication of whether it is a meaningful regression; unresolved disagreement is inconclusive. This small, reused-fixture sample cannot establish universal reliability or production quality.
- Stage 3 has no automatic allocation. Identify the exact unresolved question and start with **one unused pair (two calls)** if it can resolve that question. More pairs need individual justification, a separate owner-approved case list and budget. Prioritize missing scenario coverage, factual fidelity/negation, unsupported identity links and unnatural language in the affected locale. Do not replace failed/missing outputs or rerun an ambiguous call. Targeted follow-ups remain exploratory: do not pool them into the preselected 5/6 denominator or selectively remove earlier failures.
- Missing output, failed technical execution or unassessed coverage makes that stage incomplete. Retain all evidence and stop; no retry/resume is included. An early Stage 3 follow-up does not automatically unlock Stage 2. If the available unused fixtures cannot answer the uncertainty, report it and propose the smallest separately reviewed plan change.

Case decisions locked: ______  Mapping revealed at: ______

Adjudicator: ______  Reviewed stage(s): ______

Decision (continue-to-Monthly / preliminary-positive / inconclusive / stop-revise / incomplete): ______

Material errors / meaningful language regressions, including clause and source: ______

Unresolved question and why existing evidence cannot resolve it: ______

Minimum additional case IDs (or smallest proposed revision), justification per case: ______

Separate owner approval reference, exact executor commit and additional budget: ______
