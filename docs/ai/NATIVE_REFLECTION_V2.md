# Native reflection v2: executable grounding boundary

Status: implemented behind a new default-off content contract; mocked acceptance
only. Base `main@ba867045` includes PR #46 (`18ceb079` reference). PR #47 was still
an open Draft at reviewed head `28d9dbf3`; its documentation-only arbitrary-language
boundary is preserved. This separate implementation does not modify those PRs.

## Smallest credible path

Keep the existing authorized EventMemory selection, deterministic aggregates,
Gateway, cost reservations and atomic worker. Add one request-local proposition
builder and a closed native clause language. Claude supplies actual `text` strings,
selects supported observations, varies eligible forms and composes paragraphs.
The backend validates whole strings and joins them with whitespace; it never turns
model-selected fact IDs into replacement report prose. This is **controlled native
composition**, with a finite set of linguistic forms, not a general entailment
validator or unrestricted writer. The language still shares the limitations of
controlled phrasing. Most ordinary Events remain explicitly quoted, and this
subset does not yet deliver all of the intended companion experience.

Enablement requires the exact `AI_REPORT_REFLECTION_CONTRACT=native-reflection-v2`
in addition to existing explicit Anthropic/Sonnet Weekly or Anthropic/Opus Monthly
routes, Gateway switches, credentials and finite budgets. Absent/`v1` preserves
verified v1. Unknown values fail closed. No configuration is changed by this PR.
Workers AI, Event emotion processing, readers and schema are unchanged.

## Request-local proof and output contract

1. Reuse the existing bounded owner-scoped evidence envelope and canonical local
   period. Require saved locale/policy, exact selected Event/Memory identities,
   EVENT type, processing eligibility, summary/topics, revision and timestamps to
   match the private source snapshot. Check Event count against the complete
   eligible current-period snapshot. Monthly keeps prior-month bounds, at most
   three prior sources and every eligible current-week anchor.
2. Derive propositions with `id`, typed `kind`, literal values, exact private
   `{ownerId, sourceEventId, sourceMemoryId, occurredAt, revision, updatedAt}`,
   supporting request aliases, current weeks, aggregate references and rule version.
   Aggregates additionally use the canonical period/source snapshot. These are
   request-local proof values, not a new persisted provenance system.
3. Export only bounded values, aliases, local dates, required current weeks and
   locale grammar. No owner/Event/Memory/job IDs, full source fence, Journal, raw
   previous summaries or credentials enter report data. Source text is untrusted
   data. No tools or translator are added.
4. Require closed JSON `{version, reportType, locale, blocks}`. An overview and
   one/two observations each contain one to three `{propositionId,text}` clauses;
   optional final closing contains reflective clauses only. Every substantive block
   must contain a non-count fact. No new fields, citations or free text are accepted.
5. Rebuild the proposition set from the service's captured source input; never
   trust returned proof, mutable caller packets or model assertion labels. Match
   every complete clause against the selected proposition's permitted locale forms
   with exact literal substitution. No unparsed prefix, suffix or connective can
   introduce a fact. Source quotations also require balanced framing delimiters
   and exclude display-control characters, so attribution cannot be escaped.
6. Require two distinct current sources Weekly, three Monthly and complete Monthly
   current-week coverage. Event totals cannot buy coverage. Reject duplicate facts,
   count-led overviews, filler-only substantive blocks and excessive closing text.
   Preserve accepted strings exactly, assembling only spaces/paragraph breaks.
7. Save existing JSON sections plus `contractVersion`, locale/model and native blocks,
   canonical AiEvidence refs, deterministic statistics and atomic job completion.
   One section preserves main-text order through existing readers; the existing
   700 UTF-16 section cap remains. Chinese hard caps are 250 Weekly/500 Monthly
   graphemes (Intl.Segmenter, excluding layout whitespace); targets are 100–180 and
   250–350 with sufficient content. There is no minimum-padding or repair call.

Validation runs inside the existing Gateway deadline. Late noncooperative fetches
cannot read/validate output or execute application callbacks after timeout. Final
consent/epoch, source/locale/timezone, lease and owner fences remain mandatory before
persistence. Full source snapshots remain server-side and are not bypassed by a
locally valid proposition. Existing deletion cascades invalidate citing reports.

## Category contracts and executable counterexamples

The executable cases are in `test/back/native-reflection.test.js`; service cases in
`test/back/sonnet-weekly.test.js` and `test/back/opus-monthly.test.js` exercise actual
mocked Gateway/worker/PGlite persistence. This is independent deterministic proof
of the narrow stated claim, not proof that a user's account of the world is true.

| Category | Independent permitted claim | Executable rejection / limit |
| --- | --- | --- |
| Verifiable record facts | Exact attributed source sentence, owner-local ISO date; optional Event total recomputed from authorized period sources | Changed date, `99` Events, removed negation, altered quotation, fabricated source, Journal or foreign owner fails. A quotation proves what was recorded, not that an external experience occurred. |
| Explicit subjective emotions | Complete stored summary exactly `I felt tired.` / `我感到疲惫。` / `我感到疲憊。` (and finite listed feelings/degree forms) permits attributed `you described feeling tired` | `I did not feel sad.`, a friend's quotation, qualification, fictional context or an appended sentence never creates a feeling proposition. No inferred enduring state, cross-language feeling translation or diagnosis. Exact attributed quotes remain eligible. |
| Recorded activity / recurrence | Complete summaries in the finite grammar for drawing in a sketchbook or walking in a park permit attributed native wording; two distinct records, and two current weeks Monthly, permit recurrence of **recorded actions** | Appending `This was only a plan.`, adding negation or `It became a calming habit.` fails activity parsing/output validation. Repetition does not prove enjoyment, coping, a new habit, importance or growth. |
| Supported metadata themes | Exact topic label on at least two selected records; Monthly at least two weeks. Wording explicitly names the **label**, not a semantic interpretation of source content | A label `drawing` does not prove the owner drew. Claiming `drawing calmed you` or changing topic/count fails, even with correct citations. No topic metadata means no topic synthesis. |
| Supported changes | Exact label counts on bounded selected current/prior sources, both nonzero and different; clauses explicitly say selected samples | Current 3/prior 1 permits a sample count statement. `You drew more this month`, whole-month/emotional change, missing prior evidence or manufactured positive trajectory fails. These are not representative activity-frequency estimates. |
| Safe reflective language | A complete audited condition + optional invitation + ending, e.g. `If you wish, you can leave their meaning open for now.`; positive membership only | `Why has your anxiety improved?`, `If you wish, why has your anxiety improved?` and Chinese equivalents fail even with proposition ID `R`. Marking prose reflective does not exempt its assertions. No unrestricted questions or advice. |
| Unsupported interpretation | No eligible proposition/form | Diagnosis, hidden intentions, causality, optimism trajectory, personality, achievement, predictions, significance and arbitrary paraphrases are rejected rather than assigned speculative confidence. |

The source-language parsers match complete stored summaries; they do not strip
negation/modality or cherry-pick a sentence to justify an unattributed emotional
claim. Exact quotes preserve original names, language, numbers and polarity.
Finite native paraphrases are currently same-language only. Mixed-language source
Events are never overwritten or silently translated. Quotations from a longer
record remain excerpts; they do not establish complete context, salience or external
truth. Content or grammar that cannot preserve these bounds is ineligible.

Citations select the proof scope; **citations alone are not proof**. Keyword overlap,
model self-assessment, generic forbidden-word filters, second-model opinions and
chronological proximity are never used as semantic evidence.

## Reliability and truthful v1 availability

Content version is distinct from the stable `grounded-narrative-v1` operation key.
A rejected/refused/malformed/truncated/timeout result has no repair, retry, refund,
automatic fallback or second provider request. Existing reservations persist and
block paid replay, including switching back to v1. Finalized native or v1 reports
are reused, never regenerated. The verified v1 renderer is preserved for **future
eligible operations** under an explicit route choice, not as compensation for an
ambiguous or spent v2 operation. This does not implement Phase 5.

The existing consent, owner isolation, deletion, source revision, durable claims,
atomic evidence/job writes, USD admission and bounded egress remain authoritative.
English semantic retrieval remains BGE 384d/pgvector; Chinese keeps the independently
bounded owner-scoped chronological policy, not a claimed Chinese semantic model.
Deterministic Event extraction/statistics and Journal exclusion are unchanged.

## Quality, examples and acceptance plan

[Six actual validated mock-response examples](NATIVE_REFLECTION_EXAMPLES.md) cover
Weekly/Monthly and all three locales, preserving mixed-language source details and
negation. They are manually authored synthetic provider responses, not Claude
samples. Chinese Weekly examples are 108/107 graphemes and Monthly 266/273; no output
is padded. Their repeated attribution and limited reflective depth are visible
product limitations. Neither tests nor examples establish actual model fluency,
selectivity, emotional sensitivity, refusal rates or successful provider adherence.

Before any activation:

1. Review each positive source/output grammar and semantic implication with product,
   security and native speakers. Reject hidden presuppositions and misleading
   quotation/context cuts. Judge warmth, repetition, topic-label awkwardness and
   useful reflection separately from mechanical grounding. Failure here blocks
   product acceptance even when the validator passes.
2. Expand only a useful **complete** predicate grammar (for example another literal
   recorded activity) with exact source-language meaning and executable negatives
   for speaker, negation, modality, degree, time, fiction and causal/psychological
   additions. Review all three locales independently. No catch-all text or weaker
   validator may be introduced to improve fluency. This is the concrete next step
   when the current finite language is insufficient; universal entailment is not a
   prerequisite for adding another verifiable predicate.
3. Require exact-head mocked CI for default-off routing, schema/whole-clause proofs,
   sparse evidence, all weeks, consent/regrant, ownership/Journal, source deletion,
   deadline, duplicates, cost denial, immutable finalization and atomic rollback.
   PGlite is not independent multi-connection PostgreSQL lock certification.
4. Under **separate explicit authorization only**, confirm exact Sonnet/Opus Gateway
   availability, structured schema/token/thinking settings and a bounded synthetic
   acceptance budget. Assess naturalness, meaningful selection, original-language
   fidelity, Chinese lengths, recurrence fairness, unsupported-positive-trajectory
   negatives, rejection/timeout rates and latency. Save only sanitized metadata;
   never retry a rejected or ambiguous paid attempt to get a better sample.
5. Obtain processor/retention/consent-disclosure, budget and exact-release approval.
   Existing manual/provider gates remain open. This change makes none of those
   provider actions and therefore does not update MANUAL_SECURITY_CHECKLIST.md.

The exact unsupported boundary is arbitrary prose outside the reviewed finite
language: it cannot be independently checked by this implementation. The working
subset is suitable for code/product review, not a claim of completed unrestricted
production-quality native writing or approval to activate it.

## 2026-10-13 addendum — native-reflection-v2.1 composition expansion

This addendum preserves the original v2 contract and the historical discussion
above. It is an executable, separately default-off expansion, not acceptance for
launch. Worktree `petalpal-native-reflection-composition`, branch
`feat/native-reflection-composition`, is based on exact PR #48 head
`da67c2ca619fd3bb6f163435f07d3ff3f49df765`. Verified main was
`ba867045c0c044a25b04e99dee93c53f10351506`; PRs #47 and #48 were open Drafts.
The expansion must remain stacked on `feat/native-reflection-v2` while #48 is
unmerged. It is not independently mergeable into main.

### Executable source language

`reflection-source-language.js` consumes the **whole** stored EventMemory summary
(up to 499 UTF-16 units), with at most three first-person predicates. The first
actor must be explicit (`I`/`我`); actor elision is allowed only within a supported
same-subject conjunction. Each new sentence requires the actor again. Unknown
suffixes, fiction/quoted-speaker qualifications, third parties, hypotheticals,
unsupported negation and partial matches reject the entire construction.

The internal `recorded-construction-v1` AST carries AUTHOR, action/feeling,
positive/negative polarity, plain/very/a-little degree, actual/plan modality,
explicit mixed feelings and their AND/CONTRAST relationship, typed quantities,
relationship and possession where present, finally, temporal context, source
language candidates, and exact source evidence/revision/owner/timestamps.
Supported lexical families are deliberately finite:

- Work/study, finishing a shift, studying 1–99 minutes, reading 1–99 pages.
- Fixing/resolving the bug; encountering a failing test; completing a draft.
- Writing a poem; sketchbook drawing; drawing 1–9 trees; comparing lines in 1–9
  drawings; sharing one drawing with one friend.
- Resting, cooking dinner, walking in a park, talking with one friend/colleague/
  partner. An unspecified Chinese `朋友` cannot silently become singular English
  `a friend`: the supported source specifies `一位`.
- Tired, exhausted/worn out, happy, sad, frustrated, lonely, grateful/thankful,
  relieved, worried, calm, and explicitly recorded “a little more at ease.”
  This last phrase retains its comparative meaning; it never proves recovery.
- Explicit plans/negative actions for registered base forms; bounded positive
  quantities; after work/study; today/yesterday; explicit then; mixed emotions.
  Relative dates resolve to the owner-local **record date**, never report-read
  time. “After” is a temporal qualifier, never causal evidence.
- `drew <name> using/with charcoal` and its explicit Chinese equivalents, with a
  bounded 1–4-word Latin title-case name. The name remains an untranslated quoted
  label, not a verified place type. No link says separately recorded drawings
  are the same artwork or that two references to a friend are the same person.

Each supported predicate has explicit en/Hans/Hant lexical mappings. Source
language, language-neutral AST, and server-authoritative output locale are
separate. This is finite translation, not arbitrary multilingual entailment.
The mappings need independent bilingual review before activation. Original Events
and EventMemory are never rewritten. Arbitrary code-switching (for example,
`今天去了 River Park and walked for 20 minutes.`), implicit actors, unlisted
synonyms, causal stories and qualified creative narratives remain quotation-only.
The target `今天学习很累，但和朋友聊天后感觉轻松了一点。` is deliberately ineligible
for native paraphrase because its actor/relationship/temporal structure is outside
this reviewed construction, rather than being simplified until it passes.

### Typed facts and complete paragraph proof

`native-composition.js` reuses the original authorized snapshot checks. It derives
`RECORDED_EPISODE`, `EXACT_RECORD`, `RECORDED_RECURRENCE` and `SAMPLE_COMPARISON`.
Recurrence requires independently parsed positive actual actions in distinct
Events (and distinct weeks for Monthly). It no longer depends on optional topic
metadata. Plans and negative actions cannot create activity recurrence. Sample
comparisons require both current and previous selected records and unequal counts;
wording explicitly concerns selected records, never activity frequency or a life
trend. Complete whole-summary quotes retain unrecognized language and qualifiers;
framing characters, display controls and potentially truncated 500-unit summaries
cannot use the quote escape hatch. At least one native episode is required: a
quote-only packet abstains before inference rather than claiming native writing.

The provider returns `paragraphs[{role,refs,text}]`: one overview, one or two
observations, optional final invitation. A recursive-descent validator consumes
all text against independently rebuilt facts and the locale grammar:

1. A record-scoped opening plus 1–4 complete episode fragments. Neutral list
   conjunctions/semicolons combine fragments; within an episode its proved AND,
   CONTRAST or explicit THEN and temporal qualifiers remain intact. Fragment
   choices compose dynamically; there is no menu of finished report paragraphs.
2. A cross-week opening requires facts from at least two current calendar weeks.
   An earlier/later construction requires strictly increasing record dates and
   explicitly describes **entries**, not inferred action chronology.
3. Whole attributed quotation, or a precisely scoped recurrence/sample-count
   sentence, can accompany episodes. Up to three sentences per paragraph are
   parsed with exact separators. IDs select candidates; every word and connective
   must still parse. No unconsumed suffix, added cause, repair or normalization.
4. An optional invitation uses an already included named drawing entry, with an
   explicit choice to stop. It labels the **record**, not an artwork assumed still
   to exist. No enjoyment, improvement, diagnosis or hidden question assumptions.

Each factual paragraph needs an episode or exact record; statistical cards and
closings cannot buy source coverage. Weekly requires two distinct current Events;
Monthly three and every eligible current week. The unchanged saved-section bound
is 700 UTF-16 units total, Chinese caps 250 Weekly/500 Monthly. Length targets are
100–180/250–350 Chinese graphemes when sufficient evidence exists, never minima
that justify filler. Exact accepted text is persisted unchanged with paragraph
metadata. v1 and original v2 remain reproducible and are not silently upgraded.

### Counterexamples and exact limits

| Category | Supported claim | Rejected counterexample |
| --- | --- | --- |
| Recorded action | Two trees in a sketchbook, exact source quantity | Three trees; `your` sketchbook when possession was unspecified |
| Subjective feeling | Author recorded tired but happy after work | Work caused fatigue; tired therefore unhappy; durable mood diagnosis |
| Recorded plan/negation | Planning to fix the bug; not fixing it | The bug was fixed; a plan counted as an actual recurring activity |
| Recurrence | Two selected drawing records in two weeks | Drawing became a habit, therapy or growing commitment |
| Selected comparison | One previous and two current selected records | You drew more this month or became more creative |
| Record chronology | Earlier entry / later entry with ordered dates | One experience caused the next or these were the same drawing |
| Invitation | Revisit the named entry, or stop | Why did River Park make you feel better? |
| Unknown language | Entire original-language attributed record | Fluent translation inferred from a citation or a few shared words |

No citation, keyword match, model self-assessment, blacklist or second LLM serves
as proof. Truth is bounded to what the authorized records explicitly say; the
system does not prove that a recorded real-world experience actually happened.
Arbitrary paraphrases, implied speakers, pragmatic irony, arbitrary names/scripts,
open-ended relationships and psychological/causal synthesis remain unverified.

### Evidence and acceptance

[Six complete examples and identical-source comparisons](NATIVE_COMPOSITION_EXAMPLES.md)
are byte-checked mocked provider outputs. New examples use the same mixed-language
sources for all requested output locales. Chinese examples meet their target
ranges without padding. English Monthly omits the optional count comparison to
stay inside the existing 700-unit cap. They are authored examples, not measured
Claude quality. They demonstrate new source coverage and composition, not launch
acceptance.

The earlier 30 selected everyday variants now yield **18 native / 12 quotation-only**:
6/10 native in each locale, versus original v2 0/30. The distinct predeclared set
has **48 cases** (16/locale): 24 accepted positives, 24 rejected negatives,
zero expectation mismatches. It was authored in the same task before the parser,
not collected blind or independently, and is not a production-rate estimate.
The first evaluation harness read array fixtures as objects; fixing the harness
produced the reported results without changing parser rules to fit the held-out
cases. Metamorphic actor/negation/modality/date/quantity/scope tests reject stale
prose, rather than treating a source ID as permanent evidence.

**Product verdict: useful executable expansion; launch acceptance still blocked.**
The original six PR #48 examples retain their qualified creative text as quotations
(Weekly one quoted record; Monthly three). The new samples reduce quote dependence
and add specific invitations, but openings, attribution and coordination remain
noticeably constrained. Cross-week grouping is meaningful at the level of recorded
activities; it does not supply a free-form personal interpretation. The main
limitation is expressive coverage/product quality, not permission to weaken proof.

Before activation: independent bilingual semantic review of every source/output
production and adversarial scope cases; fresh blind, owner-approved representative
synthetic evaluation with eligible/quotation/abstention denominators; product review
of same-evidence outputs for warmth/repetition/personalization; then separately
authorized provider-format, quality, latency and USD acceptance. Human reviewers
must decide whether this controlled language is useful enough for a limited pilot.
No production claim follows from these mocked tests. Remain Draft/default-off until
that review; arbitrary prose stays outside the accepted contract.

Scope hardening in v2.1: shared-AND feeling constructions with negation or unequal
degrees are ineligible (`I felt not tired and happy`, `I felt very tired and happy`).
Explicit per-predicate wording remains available. Modal/negative action compounds
with THEN or CONTRAST stay quotation-only pending a separate scope rule. Neutral
modal/negative compounds reattribute each following predicate explicitly, so a
plan or negation cannot silently extend to the next action. A failing test remains
a test-related record; it cannot establish that the author did technical work.

### Local verification record — 2026-10-13

| Check | Accepted result |
| --- | --- |
| Native composition proof/source/schema/evaluation/examples | 17 passed |
| Original native v2 proof and historical examples | 11 passed, original six unchanged |
| Sonnet Weekly matrix, v1/v2/v2.1 | 25 passed |
| Opus Monthly matrix, v1/v2/v2.1 | 32 passed |
| Full cost-gate, consent-lifecycle, report-write-fence and CI-runner tests | 45 passed |
| Security matrix (auth, Gateway, HTTP/DAST, Event/Journal, reports, cost, consent, startup and hosting regression fixtures) | 241 passed across staged runs |
| Final affected rerun after scope hardening | 28 proof/baseline + 10 v2.1 Gateway integration tests passed |
| `git diff --check`; `graphify update .` | Passed; AST-only local graph, no inference |

Focused counts overlap the security matrix and final reruns; they must not be
added into an inflated unique-test total. Tests used injected fetch, synthetic
fixtures, disposable PGlite and the repository's local security harness. No real
provider, credentials, production database, actual migration or deployment ran.
Independent-connection PostgreSQL locking and real Claude output are not certified.

Accepted regression runtime: Node 24.19.0 with IANA tzdata 2026b. The repository's
hosted workflow pins 24.21.0; no runtime pin was changed. An earlier 24.7 aggregate
run stalled and was stopped, not counted as a pass. A v1 immutability fixture
initially used newly mixed-language evidence and correctly abstained; restoring
its original v1 evidence fixed the test's incorrect one-inference expectation.
The held-out harness's initial array/object mismatch was also fixed, as recorded
above. The security runner later reached 210 passing tests but its startup fixture
could not find `npm` adjacent to the bundled Node binary. A task-local copy of the
same Node binary with an adjacent npm link fixed only that test environment; all
31 tests from startup onward then passed. No unrelated source was changed to make
these environment checks pass. Final native proof and provider tests were rerun
after the last semantic-scope changes and passed.

Hosted CI remains a separate acceptance gate. The existing workflow PR filters
cover `main` and `integration/mobile-backend-test`, not this stacked feature base;
no filters were widened and no unrelated workflow/deployment was dispatched. The
Draft PR reports the exact-head GitHub check status rather than equating these
local runs with hosted CI. Semantic/product approval, PR #48 integration, and a
clean required hosted run remain necessary before merge/activation decisions.
