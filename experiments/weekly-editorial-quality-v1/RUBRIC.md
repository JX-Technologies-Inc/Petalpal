# Weekly editorial review, version 1

This is a human-review instrument for `cases.json`, not an automatic score or an
authorization to run Claude. The 18 bilingual cases are synthetic. The separate
existing S01–S08 semantic cases remain in
`../reflection-editorial-bottleneck/fixtures.mjs`; never mix their style scores
into this ordinary-writing benchmark. Review source and targets before any future
test; freeze subsequent corrections under a new version rather than retuning this
version after seeing responses.

Every output first needs valid JSON, locale and sentence refs under the existing
Weekly v2 schema/validator. A valid alias establishes provenance, not entailment.
**Any fabricated or misattributed material claim, unsupported emotion/motive,
invented identity/cause/outcome, or privacy violation fails the sample regardless
of literary quality.** Audit every clause, including presuppositions and temporal
connectors, against its cited sources. Audit refusals, missing responses and invalid
JSON as failures too; do not remove them from the denominator.

Score each dimension 1–5 separately. Do not turn a high mean into an override for
a failure or hide a weak language behind the other language's scores. Lack of
emotional/thematic evidence earns credit for restraint; no score demands an arc.

| Dimension | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Naturalness and fluency | Broken or misleading grammar; translation syntax blocks reading | Recurring awkward wording or unnatural Chinese collocations | Readable, but several phrases need editing | Idiomatic English/native everyday Mandarin; only minor edits | Effortless phrasing and varied rhythm; reads as composed in its language |
| Narrative coherence | Disconnected fragments or an invented unifying arc | An event list with transitions pasted on | Understandable organization, uneven emphasis or flow | Clear focus or deliberate juxtaposition; paragraphs build naturally | Each detail contributes; transitions convey actual relationships without explanation-heavy scaffolding |
| Supported synthesis | Invented connections or no understanding of explicit developments | Repeats source notes without noticing central links | Notices some links but flattens an important development | Brings explicit feedback, changes or contrasts together accurately | Makes the supported development especially clear and economical; abstains where no relationship is given |
| Emotional sensitivity and nuance | Invents feelings, diagnoses, motives or closure | Flattens mixed feelings or exaggerates intensity | Keeps stated feelings but handles them mechanically | Preserves actor, intensity, uncertainty and coexistence with warmth | Concrete attention conveys the exact complexity; equally comfortable with emotional silence |
| Factual fidelity | Any material fabrication, misattribution or privacy breach: FAIL | Material distortion of scope, identity, timing or uncertainty: FAIL | No material error, but ambiguity needs clarification before acceptance | All meaningful clauses supported with correct refs and scope | Precise, economical fidelity including implicit claims; selective omission never changes meaning |
| Avoidance of chronological inventories | Weekday-by-weekday restatement obscures a clear thread | Most sentences follow record order without a compositional reason | Some grouping, with unnecessary time signposts | Organization follows meaning; chronology appears when useful | Order serves this particular week; rich cases synthesize, sparse/unrelated cases remain naturally brief or distinct |
| Avoidance of generic AI patterns | Advice, forced moral, psychological lesson or reusable uplift dominates | Repeated stock openings, ornate abstractions or coach voice | Mostly specific with some canned framing | Specific details, understated warmth, no forced conclusion | Distinctive attention to this evidence; ending feels earned, including unresolved or ordinary endings |
| Appropriate length and depth | Pads sparse notes or misses the central experience entirely | Disproportionate detail; routine material crowds out substance | Reasonable size but some repetition or missed emphasis | Selects useful detail and scales depth to evidence | Nothing feels padded or prematurely compressed; richer and sparse cases differ naturally |

Fidelity scores 1–2 fail the hard gate. Scores 3 are review holds; accepted outputs
must reach at least 4 in every dimension. For E05/E08/E09, synthesis means an honest
juxtaposition or compact account rather than a theme. A brief list of ordinary
details can be appropriate there. Calendar references are not intrinsically bad.

## Handcrafted references and comparison

`targets.json` contains ten **handcrafted human-style targets written by Codex**,
not Claude generations or independently human-written gold. They pass the same
production schema/citation/quotation constraints. Their wording, paragraph count,
ordering and inclusion choices are not required. Do not put targets, review notes
or dimension scores into the generation packet. E01 and E03 show related Events
becoming a retrospective; E02 preserves mixed feelings, E05 stays ordinary and
E09 stays short. They illustrate a reachable quality level, not model capability.

For future separately authorized responses, a native reader first reads prose
with aliases hidden, then audits it with sentence refs and complete source notes.
Record a short clause-specific reason for each score below 4 or any hard fail.
Compare a response with the corresponding target for depth, fluency and restraint,
not lexical overlap. Do not penalize a different but equally supported focus.

For a blind comparison, use anonymized A/B texts with identical selected evidence,
locale, model, output settings and source versions. Balance display order; hide
the implementation identity until ratings and reasons are locked. Prefer two
independent native reviewers per language, adjudicating fidelity disagreements
from sources. Report ties and losses alongside wins. Old C01/C04 outputs remain
semantic/sparse historical references, not matched baselines for the richer cases.

## Acceptance gate for actual Claude outputs

No acceptance has been measured yet. A future candidate must satisfy all of:

1. Zero fabricated/misattributed claims, unsupported feelings/causes/identity,
   privacy violations, malformed JSON, invalid refs or unsupported quotations.
2. All outputs fluent in their requested `en`/`zh-Hans`, with each dimension at
   least 4 after human review; no fixed sentences, paragraph layouts or emotional arcs.
3. E01/E02/E03/E06/E07 convey clear supported relationships without mechanical
   weekday narration. E04 preserves stress and pleasure without a cure narrative.
   E05/E08/E09 avoid manufactured depth or a single imposed theme.
4. Strong blind human preference over matched current-version outputs **within
   each language**: at least two thirds of comparisons prefer the candidate,
   no more than one ninth prefer the baseline, ties reported. With nine cases per
   language this is at least six wins and at most one loss per language. This is
   a product gate for a small set, not statistical proof of generalization.
5. Separate semantic review covers every S01–S08 target claim; omitted semantic
   targets are unassessed, not successful. Mixed-language evidence, untrusted
   instructions and unresolved/corrected facts keep their existing safety gates.

If valid JSON arrives with flat prose or awkward English/Chinese, the editorial
gate fails. Report that result directly. No retry, repair call or automatic paid
continuation follows from a failure. This document defines acceptance only; no
paid run, batch, ledger, model invocation or hosted execution has been prepared.
