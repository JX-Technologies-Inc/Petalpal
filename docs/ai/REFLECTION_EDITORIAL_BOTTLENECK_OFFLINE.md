# Weekly Reflection bottleneck investigation and offline benchmarks

2026-10-15, America/Vancouver. Implementation inspected:
`e5c16b709b62f04e4bec9731b86c9b50c478cbca`, in
`petalpal-reflection-quote-paraphrase-fix`. **Stopped for owner review.**
No prompt, runtime, validator, production configuration, historical output or
consumed ledger changes. No live AI calls, paid evaluations or deployments.

## Findings and their limits

The confirmed assessment bottleneck is the evaluation material: C01 tests difficult
semantic boundaries using disconnected snippets; C04 is a very sparse ordinary
week. Neither establishes whether Claude can write a coherent reflection from
rich, explicitly related evidence. Their awkward writing is real, but further
stylistic prompt edits against these two cases cannot diagnose its cause.
Sparse material still permits fluent, concise prose; it does not excuse the
observed grammar problems or require a weekday inventory.

A separate information bottleneck is reproducible upstream: the hard limit of two
Events per topic can discard the follow-ups that make a weekly thread meaningful,
even with unused evidence capacity. This did **not** cause the latest C01/C04
outputs: those runners supplied their frozen Events directly, bypassing retrieval
and selection. No single Claude-side cause of the mechanical prose is confirmed.

| Question | Confirmed evidence | Remaining hypothesis |
| --- | --- | --- |
| Chronology and dates | Selection sorts by Event date; packet preserves that order, assigns sequential aliases and puts `day` before `text`. All four inspected UNV/FINAL outputs use Events in source order. | Those cues may encourage inventories. There is no controlled order/weekday ablation establishing causation. The packet has weekday tags, not full dates or timestamps. |
| JSON and references | The existing contract accepts reordering, cross-Event sentences, selective coverage and a one-sentence sparse reflection. | Sentence-by-sentence citation generation may encourage local paraphrases, but output schema overhead has not been isolated. |
| Evidence richness | C01 has five disconnected semantic challenges; C04 has four short notes totaling 53 JavaScript string characters, including punctuation. | Claude might write much better with adequate material; that remains unmeasured. Richer evidence also must not require an arc. |
| Adversarial examples | C01 combines litotes, double negation, denied speech, uncertainty and mixed source languages. It has no explicit thread linking the result, demo, decision, drawing and lack of improvement. | Safety instructions plus these traps may encourage defensive literalism. Their contribution to style is not experimentally established. |
| Event coverage pressure | Weekly requires two cited Events overall, not every supplied Event. FINAL covers all; UNV C01 omitted E4. Selection has a hard two-per-topic cap. | The model may interpret inclusion in the packet, or “include every Event used,” as an exhaustiveness request. No observed coverage pattern proves that interpretation. |

## What the real outputs establish

Read-only diagnostics use preserved synthetic prose, claims and evidence under
`petalpal-appstore-release.git/petalpal-acceptance/`. They compare UNV with FINAL
on **identical input packets**, checked by the offline script. These are
descriptive measurements, not independent native-editor scores or an A/B trial.

| Output | Supplied Events | First-use citation order | Sentence objects with multiple refs | Objects mentioning weekdays | Prose characters |
| --- | --- | --- | --- | --- | --- |
| UNV C01 English | 5 | E1, E2, E3, E5 | 0 / 5 | 4 / 5 | 369 |
| FINAL C01 English | 5 | E1, E2, E3, E4, E5 | 0 / 5 | 5 / 5 | 515 |
| UNV C04 Simplified Chinese | 4 | E1, E2, E3, E4 | 0 / 4 | 4 / 4 | 72 |
| FINAL C04 Simplified Chinese | 4 | E1, E2, E3, E4 | 0 / 4 | 4 / 4 | 84 |

“Sentence objects” refers to JSON objects; an object can contain more than one
grammatical sentence, as in FINAL C04's opening. Character counts use `.length`.
Weekday detection is a lexical diagnostic, not a quality score. Good writing may
use chronology, and a coherent paragraph need not contain multi-ref sentences.

FINAL C01's “with the demo not yet happened” is ungrammatical. Its explanation of
“not a little happy” reads like a semantic exercise. FINAL C04 adds a topic opening
but still enumerates weekdays. Its “那幅画” also warrants an identity audit:
the notes do not explicitly identify the drawing on the desk as the earlier
sketch. C01's “By Sunday” warrants a temporal audit rather than assuming a
week-long emotional progression. These are separate fidelity questions, not
just reasons to prefer more elegant language. Validation alone resolves neither.

The latest consumed ledgers were read only through allowlisted status fields:
both record one dispatch, one completion and `VALIDATED`. The historical
`editorialCoverage: ASSESSED` flag means citation coverage, not semantic or
editorial acceptance. The old C01 coverage check requires E1 and any one of E2–E5;
it can leave most adversarial boundaries untested. Rejected responses were not
read or reconstructed. No new ledger or batch exists.

## Contract and upstream constraints

Relevant source locations:

- [Packet, instructions, schema and validator](../../lib/reflection-v2.js).
- [Weekly service and packet adapter](../../lib/sonnet-weekly.js).
- [Evidence selection](../../lib/report-foundation.js).
- [Input envelope and length checks](../../lib/report-narrative.js).
- [EventMemory extraction](../../lib/event-memory.js).
- [Frozen C01/C04 source material](../../scripts/reflection-v2-editorial-plan.mjs).
- [Historical evaluation coverage check](../../scripts/reflection-editorial-freedom-evaluation.mjs).

Weekly allows one to three paragraphs, up to eight sentence objects per paragraph,
400 characters per object, one to four refs per object, 700 characters per
paragraph and 1,800 overall. It requires two distinct current Event refs overall.
It has no source-order rule, no all-Events quota and no minimum prose length beyond
schema string bounds. A sentence synthesizing five Events would exceed the ref
bound; two sentences can express the same supported thread. Neither latest output
is close to the overall length cap. Removing citations or switching to paragraph
citations is therefore unjustified and would lose clause-level attribution.

The prompt already permits grouping and brevity. Its “preserve supplied numbers,
dates and times exactly” may sound exhaustive, but the validator only checks
digit support for claims that are actually made. It does not require those facts
to be mentioned and does not semantically verify weekday claims. Ownership,
consent, source eligibility and deletion fences remain upstream obligations;
an alias is not proof of entailment.

Before the request, English uses bounded semantic retrieval; Simplified Chinese
uses bounded period EventMemory candidates. Both ultimately use the same selector:
max eight Events, 4,000 context characters, and two rounds taking at most one
candidate from each topic group per round. A group's key is its first sorted topic;
topic labels are not evidence of narrative relatedness. The selector then restores
chronological order. Ranking/importance and selection reasons are not sent in the
v2 packet. The model sees the resulting texts without the reasons they were selected.

In new Q01, four proposal entries explicitly refer to the same proposal, with
feedback and revision, interleaved with three routine entries. Even assigning all
proposal entries importance 0.9 and routines 0.1, current selection retains E1/E3
and routine E2/E4, dropping the meaningful revision E5 and subsequent feedback E7.
It retains only four of seven eligible Events. The behavior reproduces in both
languages; the eight-Event and context bounds are not responsible. Q02, Q05 and
Q06 likewise lose later related context in these synthetic probes. These tests
model candidate selection only; they do not establish real retrieval recall,
topic-label quality or prevalence in actual users' weeks.

There are two other potential information losses: EventMemory retains the first
500 UTF-16 code units of Event content, and packet byte trimming drops the longest
removable Event, rather than the least meaningful one. Neither explains these
latest outputs: their complete short frozen texts survived unchanged. Do not
expand source access to private Journals or add inferred emotion metadata to
compensate. No private data was used in this investigation.

## Separate offline benchmarks

[Fixtures](../../experiments/reflection-editorial-bottleneck/fixtures.mjs) contain
Codex-authored synthetic Event notes and review guidance. They are not Claude
outputs, independent human gold prose, few-shots or material derived from the
sealed emotion-classifier evaluation set. Only evidence and locale enter packet
views; meanings, counterexamples, salience annotations and review notes stay out.

**Semantic accuracy: 8 scenarios × 2 languages = 16 cases.**

| IDs | Boundary |
| --- | --- |
| S01–S04 | Negation, double negation/undecided choice, English litotes/native Chinese emotional intensity, denied speech |
| S05–S06 | Explicit mixed emotions without a fabricated outcome; another person's feelings versus the user's |
| S07–S08 | Object identity and unsupported cause; recalled time, affirmed versus negated quantities, evidence attribution |

Each has a faithful and a misleading authored contrast, a target-ref list and
an interpretation boundary. All 16 misleading contrasts can pass structural
validation, deliberately demonstrating its documented semantic limit. They must
fail a human entailment review; this is not an acceptance gold set for production.
Omission of a target means that boundary is **unassessed**, not passed and not
necessarily a factual error. Require all target refs only for targeted semantic
assessment, never as an editorial coverage quota. Review each claim's actor,
negation scope, feeling/intensity, uncertainty, numbers, time, identity, cause and
source attribution. No fluency score can offset a material semantic error.

**Editorial quality: 6 scenarios × 2 languages = 12 cases.**

| ID | Material | What a good reflection may do |
| --- | --- | --- |
| Q01 | Detailed proposal, specific feedback, revision and routine distractions | Select concrete related moments; retain satisfaction and presentation nerves |
| Q02 | Interleaved visit discussion and choir rehearsals | Organize two supported threads without a shared psychological lesson |
| Q03 | Soup, sewing, an amusing dog and a book | Choose ordinary details without manufacturing a common arc |
| Q04 | Two very short notes | Write one brief paragraph or sentence without an emotional conclusion |
| Q05 | Pottery attempts with explicit links and recalled dates | Use helpful chronology without confusing record day with experience day |
| Q06 | Rejection, a satisfying edit and a welcome conversation | Leave disappointment unresolved rather than creating recovery |

For each language, a future qualified native reader should first assess the prose
without citations, then audit claims against refs. Record separate 0–4 ratings for
native fluency, coherence/organization, supported emotional nuance and selection/
proportion, using 0 unacceptable, 1 substantial problems, 2 needs revision,
3 acceptable, 4 strong. Include exact clause-level reasons and “not applicable”
where a week contains no emotional or thematic material. A 4 does not require
emotion, synthesis, chronological avoidance or longer writing. Compare structure
across cases for repetition. Audit fidelity in every editorial sample as a separate
gate; do not combine category averages or let style compensate for invention.

`meaningfulRefs` describes opportunities, not mandatory citations. No penalty for
omitting routine notes or a secondary meaningful detail. Missing a central thread
is a selection concern; failure to mention every Event is not. A two-note sparse
week still meets the unchanged two-Event minimum. Zero/one eligible Event remains
`INSUFFICIENT_EVIDENCE`, as checked offline. No expanded generation eligibility.

Native acceptance and actual model writing quality remain **unmeasured**. No
external reviewers or model judges were invoked. All review labels should be
reviewed by the owner before freezing a future evaluation. Authored witnesses
only establish what the contract can represent.

## Small input-format comparisons prepared

The offline checker prepares a 2×2 comparison without changing the system prompt,
output schema, text, topic strings, refs, record time information or validator:

| View | Evidence array | Weekday metadata |
| --- | --- | --- |
| `current` | Original chronological order | `day` before each Event text |
| `permuted` | E2/E4/… followed by E1/E3/… | Unchanged |
| `days-separated` | Original order | Moved to a separate trailing `recordDays` alias/day table |
| `permuted-days-separated` | Same fixed permutation | Same separate table |

This gives 112 packet views across the 28 cases. All retain their full source text,
fit existing request admission, and reconstruct the original evidence by alias.
The current ref-to-source map stays server-side. No topic-based grouping,
inferred salience, extra source data, plan text or invented connection is added.
For example, a separated view contains `evidence: [{ref, text, topics}]` and
`recordDays: [{ref, day}]`; it retains the existing version/type/locale envelope.

These are preparation artifacts, not measured improvements. Stable aliases still
correlate with original chronology, so permutation tests array order rather than
fully removing chronology. Separating weekdays tests placement, not the effect of
deleting all date information. Those deliberate limits preserve attribution and
time context. A future blinded comparison must hold all other inputs fixed and
inspect content fidelity as well as inventory behavior. Do not infer an alias,
JSON or weekday causal effect from the existing outputs alone.

## Recommended next implementation after owner review

First review and freeze the two benchmark categories. Do not write another style
prompt. The smallest **demonstrably relevant architectural candidate** is a
Weekly-only offline selector variant that treats two-per-topic as an initial
diversity pass, then fills unused slots from remaining eligible, deduplicated
candidates in existing rank order, subject to the same eight-Event/context bounds.
Keep original chronological sorting for this selector comparison so selection
and formatting are not confounded. This should recover Q01's dropped follow-ups
without an inferred narrative plan. Test a competing-topic case and a tight budget
case as well: backfill must not bypass bounds or displace existing selected Events.

Do not globally change `maxPerTheme`, the shared selector, Monthly selection or
privacy checks. Do not increase candidate retrieval, source access, model calls,
token/byte limits or logging. Keep owner/consent/source/deletion fences, source
provenance, selected-versus-cited tracking and rejection behavior unchanged.
The candidate is a proposal here; the benchmark runs only the current selector.

For the Claude inventory question, the smallest input candidate is the prepared
`days-separated` view, compared against `current` on identical evidence. Preserve
sentence refs and the output JSON contract. Only if the controlled comparison
supports it should input serialization be changed; array permutation is a
diagnostic control, not a recommendation to randomly reorder production evidence.
No schema relaxation, paragraph-only citations, second planning/writing call,
automatic repair or emotion inference is justified by the present findings.

The selector candidate can be implemented and verified offline after review.
Its effect on actual prose, and the packet-format hypotheses, would require a
separately authorized future evaluation. This package has no execution arm, paid
batch allocation or live-call approval request. Keep historical approvals and
consumed ledgers closed. Stop here for the owner's decision on that next candidate.

## Verification

```sh
env -i PATH="$PATH" node experiments/reflection-editorial-bottleneck/check.mjs check
env -i PATH="$PATH" node experiments/reflection-editorial-bottleneck/check.mjs view Q01 en days-separated
env -i PATH="$PATH" node --test test/back/reflection-v2.test.js test/back/reflection-v2-validation-diagnostics.test.js test/back/reflection-v2-quotation-contract.test.js
```

The checker is read-only, traps native `fetch`, has no live mode or provider client,
and reads only its own fixtures plus four named preserved validated synthetic
outputs/packets. It never opens a ledger. All 112 input views pass content,
time-metadata, privacy-allowlist and byte-admission assertions. Four authored
capability witnesses pass; eight invalid boundary mutations fail. The 16 semantic
contrast pairs demonstrate the semantic-review limitation, not model performance.
The existing 52 focused tests pass with no failures or skips. Syntax and diff
checks and the AST-only Graphify update passed; runtime and historical files
remain untouched.
