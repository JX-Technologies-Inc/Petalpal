# Semantic evidence for natural reflection: research and decision

Review date: 2026-10-13, America/Vancouver. **Decision: Revise the semantic evidence architecture.** Keep the experiment isolated. A structured representation makes verification obligations explicit and supports composition of facts and relations without another sentence dictionary. It does not, by itself, establish that a source means the representation or that a generated paragraph means only the representation. Both remain essential acceptance gates. No native AI writing, independent multilingual review, live model quality, or production acceptance is claimed by this prototype.

## 1. Repository evidence and the remaining problem

Source reviewed read-only at these exact commits:

| Baseline | Actual behavior | What the evidence does not establish |
| --- | --- | --- |
| `main` `ba867045c0c044a25b04e99dee93c53f10351506` | `lib/sonnet-weekly.js` selects exact source sentences; `lib/opus-monthly.js` selects factual cards rendered by the application. The older `lib/report-narrative.js` checks citations and a narrow Event-total grammar. | The older number-free prose policy is not a semantic validator. v1 localized application text is not native Claude writing. |
| PR #47 `28d9dbf3be61e50df2561826ebb3c949bd8b9d99` | Research, current-output examples and executable boundary counterexamples. Its [review](https://github.com/JX-Technologies-Inc/Petalpal/blob/28d9dbf3be61e50df2561826ebb3c949bd8b9d99/docs/ai/NATIVE_REFLECTION_REVIEW.md) correctly identifies the arbitrary-prose proof gap. | No native-generation implementation. |
| PR #48 `da67c2ca619fd3bb6f163435f07d3ff3f49df765` | `lib/native-reflection.js` derives bounded propositions, accepts only complete locale-specific permitted clauses, then preserves accepted text. Source interpretations use exact complete-summary forms. | More permitted wording is still a finite controlled language. The same implementation defines source mappings and accepted realizations. |
| PR #49 `09f6aee0584c386c99523e81657413efab32f1af` | `lib/reflection-source-language.js` parses a closed source language; `lib/native-composition.js` composes its fragments using an exact paragraph grammar. Ambiguous partner, litotes and planning-time constructions were narrowed. | Grammar membership proves conformance to its rules, conditional on those rules' semantic correctness. It is not independent multilingual entailment. |

The [PR #49 acceptance review at that commit](https://github.com/JX-Technologies-Inc/Petalpal/blob/09f6aee0584c386c99523e81657413efab32f1af/docs/ai/PR49_ACCEPTANCE_REVIEW.md) reports 4/24 constructed Events with native interpretations, 24/36 accepted report/locale candidates, and repeated whole quotations. Those are same-assistant synthetic results, not production rates, a blind holdout, or Sonnet/Opus samples. The review's conditional-launch verdict remains appropriate. This research preserves every prior branch and PR.

Adding synonyms or finished sentences cannot solve the central problem: ordinary writing expresses scope, uncertainty, implicit subjects, nested quotation, quantities, partial completion and relations in combinations the current grammar cannot express. Widening a rule also widens the meanings it must distinguish. PR #49's concrete defects illustrate this: `partner` did not establish a romantic relationship; `not a little` did not express ordinary Boolean negation; a time on planning did not necessarily date the intended action. A larger mapping table would still need independent scrutiny for each semantic distinction.

The upstream evidence has a separate limitation. In [main's extractor](https://github.com/JX-Technologies-Inc/Petalpal/blob/ba867045c0c044a25b04e99dee93c53f10351506/lib/event-memory.js), `summary` is `event.content.trim().slice(0, 500)`; topics and people are copied metadata. It is not an independently extracted fact graph. A span from a cropped summary can omit a later qualification, quotation boundary or speaker context. Future semantic admission needs an authorized, revision-bound source span and sufficient enclosing Event context, with a known completeness/truncation status. This proposal changes neither extraction nor retrieval.

`MODEL_SELECTION.md`, `LONG_TERM_AI.md` and `SECURITY.md` retain historical and planned statements. For example, SECURITY's DELTA-P2-1 explicitly limits the legacy validator to a bounded numeric grammar. Current source, exact commits and scoped executable results govern implementation claims; documentation history is not fresh production certification.

## 2. What the research supports

These are primary research or provider sources, checked without provider inference. The PetalPal choices in the last column are design judgments, not claims that the papers prove this implementation correct.

| Source | Established contribution | PetalPal implication |
| --- | --- | --- |
| [AIS: Measuring Attribution in Natural Language Generation Models](https://aclanthology.org/2023.cl-4.2/) | Defines attribution against an independent provided source and a human annotation procedure. | Evaluate whether the text is interpretable and supported by its source; citation existence alone is insufficient. Our source is the user's record, not independent observation of the world. |
| [FActScore](https://aclanthology.org/2023.emnlp-main.741/) | Measures factual precision by decomposing long text into atomic facts; its automated implementation estimates support with retrieval and a language model. | Use atomic claims for error accounting. Do not promote an estimated score or a second model's verdict into proof. Its biography benchmark does not establish PetalPal performance. |
| [Merging Facts, Crafting Fallacies](https://aclanthology.org/2024.findings-acl.160/) | Demonstrates that individually supported facts can form an incorrect paragraph through entity ambiguity. | Validate discourse, shared referents and relations as well as isolated atoms. An AST listing valid facts cannot certify every possible paragraph containing them. |
| [Building a Broad Infrastructure for Uniform Meaning Representations](https://aclanthology.org/2024.lrec-main.229/) | UMR separates sentence-level predicates/arguments from document-level temporal, modal and coreference relations, including Chinese and English annotations. | Borrow explicit roles, scope and relation distinctions. Do not adopt a full UMR parser or claim a universal language-neutral ontology. |
| [Annotation of Tense and Aspect Semantics for Sentential AMR](https://aclanthology.org/W18-4912/) and [UMR Parsing as a Pipelined Approach](https://aclanthology.org/2024.textgraphs-1.3/) | The first addresses tense/aspect information absent from standard AMR; the second describes added complexity in document-level parsing. | A graph schema is not a reliable source parser. Time, modality and coreference require their own validation and failure states. |
| [XNLI](https://aclanthology.org/D18-1269/) and [Stress Test Evaluation for NLI](https://aclanthology.org/C18-1198/) | Supply cross-language inference evaluation and targeted inference stress testing. | Use multilingual and adversarial evaluation; a benchmark score is not a per-claim guarantee or evidence for mixed-language personal Events. |
| [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | Constrains output structure; documents schema limits, refusals and truncation. | Closed JSON improves parsing. Schema compliance does not establish semantic support, and application validation remains mandatory. |

Practical alternatives:

1. **Exact quotation with minimal attribution:** mechanically checkable against authorized text, but source-language preservation and quotation density limit the companion experience. A quote establishes what was recorded, not what objectively happened.
2. **Finite source parser plus controlled renderer:** currently executable, predictable and inexpensive; inherited source and translation assumptions remain. Further sentence/dictionary expansion is outside this task.
3. **Model extraction plus model entailment or round-trip translation:** potentially useful offline diagnostic signals. Agreement, confidence and reconstruction can share an error. They cannot authorize a factual claim and add no production call here.
4. **Source-aligned typed propositions with separately reviewed mappings and realizations:** separates responsibilities and can represent arbitrary source subjects with explicit roles, modalities and relations. This is the recommended research direction; human review cost, coverage and output-language admission remain unresolved.
5. **Author-confirmed structured Event facts:** a possible future source of explicit meaning, but would change the product and collection workflow. No such UI, consent assumption or confirmation mechanism is implemented or required of users by this prototype.

## 3. Two semantic proof obligations and one authorization boundary

The following is a conceptual obligation diagram, not an implemented production pipeline or persistence path.

```text
Authorized source S ── source interpretation ──> semantic evidence E
                                                   │
                                            checked claim DAG C
                                                   │
                                complete text realization validation
                                                   ↓
                                           report text T
```

**Source obligation:** establish `S supports E` in its full relevant scope. Exact offsets prove where a string occurs, not that it expresses a proposition. An extraction model, author-written fixture annotation, confidence score or `reviewed: true` field cannot discharge this obligation. A source quotation requires no semantic reinterpretation, but still requires accurate attribution and safe framing.

**Text obligation:** establish that every assertion and presupposition in `T` is supported by the accepted claim DAG. `C follows from E` does not establish `T expresses only C`. A perfectly correct claim list can accompany “You recovered because you fixed the bug,” introduce a different actor, or hide the same assertions inside a question. Check all text, including joins, headings, pronouns, temporal adverbs, metaphors and invitations; model-supplied span labels cannot exempt text from scrutiny.

**Authorization obligation:** current owner, Event-only eligibility, consent, source identity, exact revision and timestamps must match the service's trusted source snapshot. Recheck existing fences at persistence. A correct graph with a deleted, foreign or revised source is not admissible.

The isolated experiment uses same-task synthetic annotations to exercise the middle implication. Its semantic checks are conditional on those annotations. It must report that condition explicitly and keep production acceptance false. Hypothetical externally reviewed certificates describe a missing trust boundary, not an implemented review authority. No model output or arbitrary caller can supply a trusted certificate. There is no new signature, hash, manifest or persistent certificate system in this proposal.

The [prototype](../../experiments/semantic-evidence/prototype.mjs), [fixture registry](../../experiments/semantic-evidence/fixtures.mjs), [focused tests](../../experiments/semantic-evidence/test.mjs) and [execution notes](../../experiments/semantic-evidence/README.md) make that boundary reviewable. They bind annotations to full synthetic source snapshots and exact UTF-16 spans over the named source field (`text` or `memoryText`), then check exact atoms, conjunction, explicitly admitted relations, record order, occurrence order and recurrence. Their source-admission schema only simulates canonical owner/consent/source checks; it does not call or certify real production authorization. Whole-source quote data can be compared mechanically, but arbitrary surrounding prose cannot be certified by that equality. There is no source parser, growing dictionary or sentence generator in this experiment.

## 4. Recommended request-local representation

This is a proposed representation, not a new database schema. Keep canonical source text immutable. Separate source language, internal meaning and requested output locale; do not overwrite Profile language, source text or existing embeddings.

| Component | Required information and semantics |
| --- | --- |
| Source binding | Owner scope, Event ID, Memory ID, source revision, source kind `EVENT`, authorization snapshot; `createdAt`, `updatedAt`, `occurredAt` with their actual meanings. Never rename `occurredAt` to “recorded at.” |
| Source alignment | Exact source field and immutable text, start/end offsets with an explicit unit, full enclosing scope, truncation/completeness status. Offsets must round-trip to the original text. Do not normalize before slicing or silently strip qualification. |
| Assertion | `RECORDED_ACTION`, `SELF_REPORTED_STATE`, `REPORTED_OTHER_STATEMENT`, or another explicitly reviewed type. Experiencer, speaker, actor, object, recipient and companion roles remain distinct. Unknown is not author. |
| Predicate and arguments | Stable typed predicate; source-local entity aliases and literal labels; identity/coreference evidence when merging references. No relationship inferred from a name, possessive or generic `partner`. Preserve quantities, units, approximation, exclusions and degree. |
| Scope and modality | Operators over propositions: `NOT(p)`, `PLAN(author,p)`, `WANT(author,p)`, `POSSIBLE(p)`, `REPORT(speaker,p)`. A simple polarity flag is acceptable only within a reviewed unambiguous scope. `NOT(PLAN(p))` and `PLAN(NOT(p))` are different. |
| Time | Distinct record creation time, Event metadata occurrence time, and asserted action/state time; exact/relative/interval/unknown values, timezone and anchor basis. Planning time and planned-action time require different nodes. |
| Relations | Neutral conjunction, explicitly reported contrast, explicitly reported cause, explicit occurrence order, and record-order metadata are different edges. Relation span and endpoints must be source-bound. Chronology never entails cause. |
| Evidence status | Mechanical record fact; attributed quotation; unverified semantic proposal; externally reviewed source interpretation; conditional fixture assumption; unsupported. Status is assigned by trusted code/review workflow, never accepted from model text. |
| Derivation | Rule identifier and exact premise IDs, with bounded acyclic dependency structure. Derived subject recurrence retains all distinct supporting Event identities and selection scope. |
| Text realization | Output locale, exact complete text, full assertion/relation coverage and review rule. A separate admission result is required even when the DAG passes. |

The prototype deliberately supports a smaller exact-value subset of this proposed scope language. It must reject constructions requiring unsupported nesting instead of flattening them. No unknown predicate receives semantics because its identifier happens to be a string. Unknown or ambiguous concepts may remain literal quotations; synthetic opaque predicate labels demonstrate structural extensibility only.

Exactly checkable facts and rules:

| Claim class | Defensible acceptance rule | Excluded strengthening |
| --- | --- | --- |
| Recorded text and identity | Exact quotation/span equality plus immutable authorized source binding | External truth, translation or omitted context asserted as equivalent |
| Metadata date / count | Recompute from canonical server fields, owner timezone and declared selected/full-period domain | Metadata order relabeled as activity order; selected evidence treated as the whole life/month |
| Semantic atom | Exact typed value and scope match to an independently admitted source proposition | In this prototype the admission is synthetic, so the result is conditional, not independently verified prose |
| Neutral conjunction | All premises accepted; actor/coreference scope remains separate; no new relation | “therefore,” “despite,” “again,” emotional trajectory or shared cause |
| Contrast / reported cause | Exact admitted edge with matching direction, endpoints, speaker and scope | Contrast deduced from opposite sentiment; cause deduced from sentence adjacency |
| Occurrence sequence | Explicit source time relation or unambiguous validated occurrence intervals | Record timestamps alone; dates on planning shifted to the planned activity |
| Repeated recorded subject | At least two distinct eligible Events with independently admitted subject identity, declared selection domain, and required distinct weeks for cross-week wording | Distinct Event IDs do not establish independent experiences: duplicate accounts may describe one occurrence. No habits, dedication, recovery, frequency in life, persistent feelings or progress follow. |
| Non-factual invitation | Complete reviewed speech act with only admitted referents and no hidden factual premises | “How did you become more resilient?” or an assumed desire/diagnosis disguised as a question |

Sensitive but ordinary emotions remain eligible source material. Explicit “I felt sad” supports an attributed past feeling; it does not establish depression, a lasting condition, hidden need, personality or improvement. Supporting positive, negative and mixed feelings requires preserving all the scoped qualifiers, not selecting only the positive side.

## 5. Multilingual mapping and generation contract

Language-neutral structure must not become an English-word dictionary labeled universal. A future reviewed mapping must bind each **source construction in context → typed meaning → permitted output meaning**, independently in each direction. Review must record actor, polarity, operator scope, aspect, intensity, reference and relation changes. Approval of an English-to-Simplified pair does not approve its reverse or Traditional wording. The current task supplies no independent native-speaker review.

| Hazard | Required treatment |
| --- | --- |
| `did not do` / `did not plan to do` / `planned not to do` | Keep operator scope; no completion or intention inferred. |
| `frustrated`, `relieved`, `relaxed`, `很`, `有点`, `还好` | Preserve the source expression and context; proposed translations need independent review for affect and degree. Do not force these onto a single emotion scale. |
| Simplified / Traditional | Script is not a guarantee of identical sense or regional usage. Review idiomatic output separately; preserve literal names unless an approved name mapping exists. |
| Names, places and relationships | Opaque source-local identities; no gender, romance, location type or cross-Event coreference without evidence. |
| `today`, `last Friday`, `后来`, `终于` | Preserve time/assertion scope and known anchors; do not infer calendar dates or intermediate failures from an adverb. |
| Code switching and ellipsis | Detect scope and referents across the entire utterance. An English fragment inside Chinese is not an independently interpretable sentence by default. |
| Figurative or uncertain language | “I drowned in work” is not a literal incident; “maybe I was happy” is not unqualified happiness. Quote or abstain until the relevant interpretation is independently admitted. |

A future **native-generation contract** would give Sonnet Weekly or Opus Monthly a minimized authorized evidence package and request a coherent report in the saved locale. Claude may select and order supported moments and propose actual complete text, a source-aligned claim DAG, relation links and an optional source-specific invitation. All returned annotations remain untrusted. The backend validates types/bounds, checks each DAG derivation against admitted evidence, then separately validates the entire text's semantic realization. Missing coverage, an unverifiable span or a hidden premise rejects the whole candidate. No stripping, paid repair, translation call, second judge, automatic provider fallback or retry is permitted.

Structured outputs may help transport this contract, but cannot implement the two semantic proofs. Keep evidence values in message data, not schema property names/enums: Anthropic documents separate caching of compiled schemas and privacy restrictions for sensitive schema contents in its [structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Actual account retention and Gateway policy need separate authorization and verification before private traffic; this research does not certify them.

Targets remain approximately 100–180 Chinese grapheme clusters Weekly and 250–350 Monthly, conditional on sufficient source material. Use extended grapheme segmentation, not UTF-16 length as a user-perceived count ([Unicode UAX #29](https://www.unicode.org/reports/tr29/)); retain application hard bounds separately. Monthly must cover eligible weeks and support every comparison. Neither word count nor week coverage proves insight. Meaningful reflection may consist of a concise juxtaposition and optional invitation; no general psychological interpretation is admitted.

The missing step is executable whole-text semantic admission for open-ended native wording. This task intentionally does not disguise exact approved sample text as a general natural-language validator. A separate implementation decision is needed after review establishes whether a useful, extensible subset can meet both grounding and writing goals.

### Proposed mapping review cases (not executable equivalences)

These concrete pairs propose a **review protocol**, not a synonym dictionary or
approved translation library. Every row is same-task authored and unverified in
both directions; an independent bilingual reviewer must inspect the complete
source, its speakers and surrounding qualifications. The IR operators below are
the proposed richer representation; nested operator scope is not implemented by
the prototype's flat polarity/modality subset.

| Source/context | Proposed internal meaning | Candidate en / zh-Hans / zh-Hant realization | Required check |
| --- | --- | --- | --- |
| `I did not send the file.` | `REPORT(self, NOT(SEND(self, file_1)))` | “You recorded that you did not send the file.” / “你记录了自己没有发送那个文件。” / “你記錄了自己沒有傳送那個檔案。” | Preserve source-local file identity and negation; no failure, refusal or motive. |
| `我打算不参加会议。` | `REPORT(self, PLAN(self, NOT(ATTEND(self, meeting_1))))` | “You wrote that you planned not to attend the meeting.” / “你写下了不参加会议的打算。” / “你寫下了不參加會議的打算。” | Do not change this into `NOT(PLAN(ATTEND))` or an actual absence. Prototype needs reviewed scope extension first. |
| `I might ask Mira tomorrow.` | `REPORT(self, POSSIBLE(ASK(self, Mira_1)), time=relative-unresolved)` | “You wrote that you might ask Mira tomorrow.” / “你写到自己明天可能会问 Mira。” / “你寫到自己明天可能會問 Mira。” | Preserve possibility, proper name and unresolved author-time anchor; ask-about object remains unknown. |
| `我有点期待，也仍不确定。` | Two self-reported state nodes; source degree literal `有点`; continued-uncertainty qualifier `仍`; conjunction only | “You wrote of some anticipation and continuing uncertainty.” / “你写下了有点期待，也仍不确定。” / “你寫下了有點期待，也仍不確定。” | Emotional degree and idiom need contextual review. No contrast, cause, improvement, present-state or objective emotion claim. |
| `今天和朋友去公园散步，感觉很放松。` | Proposed author walk + companion with unknown number + park + feeling; `今天` unresolved; no causal edge | English paraphrase withheld pending actor/number/degree review; the original Chinese may remain an exact attributed source in either output locale | Do not assume an English plural, translate `很` mechanically to VERY, or create `walk CAUSED relaxed`. |

Approved mappings would record the full source span/context, every retained or
omitted qualifier, source/output locales, reviewer decision and counterexamples.
Separate reviewer evidence would be needed for a new direction, wording or scope;
the current prototype has no trusted approval store and cannot import such review
as production authority.

## 6. Factual audit of the supplied target example

Original sources: Monday, “I felt frustrated because my project wasn't working.” Wednesday, “I finally fixed the bug today. I felt relieved.” Saturday, “今天和朋友去公园散步，感觉很放松。” These are user-supplied synthetic examples, not private Events. The labels supply a proposed narrative calendar context; real admission still requires trustworthy time anchors.

| Target wording / implication | Support and remaining issue | Admission now |
| --- | --- | --- |
| `这周，你记录了` | Requires all three source records belong to the requested owner-local reporting week. The labels alone do not define a canonical week/year/timezone. | Conditional on metadata; not established by prose alone. |
| `项目遇到问题时的烦躁` | Monday explicitly attributes frustration to a project not working. `遇到问题` changes wording; `烦躁` can emphasize irritability/agitation and is not automatically equivalent to `frustrated`. | Source relation is explicit; exact cross-language realization unreviewed. |
| `修好 Bug` | Wednesday explicitly reports the author fixed a bug, with “finally” and “today.” | Semantic reading is plausible; keep author, completion, scope and time. No certified translation here. |
| `修好 Bug 后那份轻松` | The adjacent relief sentence does not explicitly locate relief after repair or state repair caused it. `轻松` also does not uniquely preserve relief. | Reject the asserted order without further evidence; translation unreviewed. |
| Project difficulty connected to bug repair | Nothing explicitly identifies Monday's project and Wednesday's bug as the same project/problem. | Do not assert shared identity or resolution of Monday's problem. |
| `到了周末` | Saturday can support weekend under an established calendar; record date alone does not prove the walking occurred then. Source `今天` needs an appropriate author-time anchor. | Conditional on actual occurrence evidence. |
| `和朋友在公园散步` | Saturday explicitly mentions a friend relationship and walking in a park; `朋友` does not itself specify companion count. A Chinese omitted subject needs contextual admission before labeling the author as actor. | Plausible self-report; no universal parser proof or singular/plural inference. |
| `又成为了一个让你感到放松的片段` | `让` introduces a cause from walking to relaxation. Source conjunction reports co-occurring content without an explicit causal statement. `又` may merge earlier relief with later relaxation or imply recurrence. `很` is also dropped. | Reject causal/recurrence strengthening; degree needs review. |
| `这几个不同的时刻` | Distinct records are known; distinct experienced moments depend on occurrence evidence. | Prefer record-based scope until established. |
| `有哪一个是你最想记住的？` | An invitation is not automatically factual, but this wording can presuppose a preferred moment and a desire to remember. | Needs full invitation review; allowing “none” avoids imposing a preference. |

The supplied paragraph is **not accepted** merely because its tone is desirable. A less committal author-written direction is to juxtapose the recorded project difficulty, the separately reported bug fix and relief, and the park walk and relaxation, then invite the user to choose a fragment or leave it open. Such a rewrite still needs source interpretation and complete multilingual realization review; it is not executable proof. The [six product examples](SEMANTIC_EVIDENCE_EXAMPLES.md) retain their explicit author/origin and conditional or unvalidated status.

## 7. Independent evaluation plan

All fixtures written by this task, including another collaborating agent, are **developer-authored**. Different files, an agent called “reviewer,” or fixtures written before a fix do not create independent authorship. They support regression checks only. Do not use the frozen emotion-classifier final evaluation set, private user data, PR #49's examples as a new holdout, or generated variants of known acceptance sentences as independent evidence.

For the next separately approved study, recruit source authors who have not seen the parser, mappings, prompts or accepted examples. Give them domain briefs rather than approved phrases. Prepare 80 synthetic bundles: ten each for work/study, technical projects, friendship/relationships, daily life, creativity, rest/leisure, mixed/uncertain emotions, and sensitive ordinary personal experiences. Balance English, Simplified Chinese, Traditional Chinese and mixed-language sources within each domain. Each bundle includes four eligible Events across different weeks and a preselected Weekly subset. Independently annotate actor/scope/time/relations and unsupported candidate mutations. Authors and adjudicators must not tune implementation on the sealed test portion. Freeze inputs and evaluation rules in version control; if a defect is repaired after opening that set, it becomes development evidence and requires a new independent set.

Run v1, v2, v2.1 and the proposal on identical Event text, owner scope, metadata, source revisions, topics, selected evidence, locale and type. Do not add topic metadata or simplify wording to rescue one version. Score all three output locales for every applicable input; split source-language and output-locale results. A mock author comparison measures contract expressivity, not provider quality. Real Sonnet/Opus sampling, if later authorized, needs a single-attempt protocol with failures and rejected outputs counted, never repaired or resampled into success. Include both Weekly and Monthly; reuse the same evidence for pairwise product review.

Grounding review precedes and remains separate from writing review:

| Dimension | Reported metric / required evidence |
| --- | --- |
| Factual support | Unsupported atomic claim count and unsupported discourse/presupposition count, with source span and severity; count errors even when the paragraph sounds kind. |
| Fidelity | Negation/modality preservation, actor/relationship preservation, quantity/unit fidelity, temporal accuracy, causal accuracy and source attribution, with denominators by eligible claim type. |
| Rejection | Rejected unsafe claims, unsafe claims accepted, and safe candidates rejected. Report each abstention reason and stage: source interpretation, semantic derivation, text realization, coverage, bounds or provider failure. |
| Availability | Valid report yield over all eligible inputs; separate quotation-only, semantically interpreted and actually certified native text. A 100% abstaining system cannot win quality evaluation. |
| Product quality | Blind, randomized paired ratings of naturalness, warmth, personalization, repetition, meaningful insight, idiomatic language, source coverage and usefulness. Raters must see the same sources and may prefer a shorter accurate report. |
| Independence | Corpus author, annotation reviewer and adjudicator roles; what each could see; disagreement rates and resolution. No undocumented “gold” authority. |

Use at least two bilingual reviewers per cross-language case and adjudicate disagreements before treating a mapping as accepted. Review output language independently from source interpretation. Record error categories, not only an averaged factuality score. Any observed unsupported accepted claim blocks the affected rule from rollout; zero observed errors is finite-sample evidence, not a universal guarantee. Quality thresholds and minimum useful yield must be agreed before examining the blind results, separately by locale and report type. This document does not invent an acceptable hallucination budget.

Adversarial and metamorphic cases include:

- Swap `I` with `my friend`; introduce nested quoted or fictional speech; use two people with the same name. Actor and coreference acceptance must change or abstain.
- Negate an atom or an intention; add `maybe`, `only`, `not yet`, `almost`, `a little`, or litotes. An old interpretation must not survive unchanged.
- Move record timestamps without changing explicit occurrence dates; independently move occurrence dates. Record order may change without creating action order or causality.
- Change `and` to `because` or reverse causal endpoints. Conjunction cannot authorize a cause; a supported direction cannot authorize its inverse.
- Duplicate one Event under repeated references or revisions. Recurrence must count distinct eligible Events, not mentions. Two records about one experience still do not establish a repeated activity.
- Change owner, Memory ID, revision or source span; delete a source; truncate before a qualification. Source binding must fail closed.
- Keep a valid DAG but replace the paragraph with a diagnosis, recovery narrative, altered quantity or presuppositional question. Text admission must fail even when the DAG passes.
- Permute neutral conjunction premises: support should remain if meaning is unchanged. Permute temporal/causal endpoints: support must not remain automatically.
- Change only output locale: ownership, retrieval policy, source text, propositions and Profile language must remain unchanged. The new realization needs its own review.
- Use emoji/combining characters, mixed scripts and ambiguous punctuation; offsets must refer to original text. Inject instructions inside an Event; treat them as data and never as authorization.

## 8. Privacy, reliability, cost and rollout implications

The research prototype uses synthetic in-memory inputs, no credentials, no real/paid Claude calls and no production imports, routing or persistence. A semantic proposal may itself expose sensitive personal content. Future review tooling needs owner-scoped access, data minimization, explicit retention/deletion rules and sanitized diagnostics; research convenience does not authorize sending private Events to reviewers or external models.

Keep Event-only processing and Journal exclusion before retrieval and before semantic interpretation. Preserve current source revision/deletion and consent fences, durable AiJob state, lease/heartbeat checks, period idempotency, immutable finalized reports and atomic report/evidence/job completion. Do not regenerate a finalized report because a semantic contract changed. Rejected or ambiguous potentially billed attempts remain non-replayable. No automatic provider fallback is introduced.

Keep English BGE 384d, pgvector and the existing bounded Chinese evidence retrieval. The [Cloudflare model documentation](https://developers.cloudflare.com/ai/models/%40cf/baai/bge-small-en-v1.5/) identifies the existing 384-dimensional model and 512-token input bound; it does not certify multilingual semantic retrieval. Translation, multilingual embeddings or altered retrieval selection require separate evaluation and authorization.

The extra graph and alignment data consume context tokens and local validation time. Benchmark those bounds before any integration; neither existing model prices nor synthetic execution establish per-report cost or latency. Any future single native-generation request stays within existing pre-dispatch cost reservations, call limits and USD ceilings. Independent human semantic review has its own cost and cannot be hidden as a free runtime validator. Missing useful evidence should abstain before dispatch; failed text validation must not buy another call.

Recommended next gate: independently review a small semantic domain and its multilingual scope distinctions, obtain independently authored evidence, and demonstrate a useful text-realization acceptance method that goes beyond approved strings. Only then decide whether a narrowly scoped implementation is justified. Offline diagnostic model scores may guide review if separately authorized; they must never be labeled proof. Activation, provider resources, credentials, schema migrations, deployment and production integration remain outside this request.

The present result is a reviewable architecture experiment. The conditional DAG rules are useful engineering evidence, but the gap from raw Event meaning to native report meaning remains open. **Revise the architecture; do not integrate it into production report routing on the strength of this prototype.**
