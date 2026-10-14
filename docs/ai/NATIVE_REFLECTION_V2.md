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
