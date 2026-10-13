# Native multilingual reflection upgrade — grounding boundary review

**Status: design boundary only; native prose is NOT implemented or enabled.**
Reference: PR #46 at `18ceb079f83fb6d82a8b31d091ba3259994eaacf`.
Main independently advertised `daba16e51de9c5ca189fda6d265d90e1011cb96e`.
This separate branch is based directly on that verified Phase 4 head; no merge,
rewrite or modification of PR #46 is performed. The review PR is stacked on
`feat/opus-monthly-phase4` so its diff contains only this request's review changes.

## Decision

The desired product is native Claude-authored prose, with Sonnet for Weekly and
Opus for Monthly, not selection of fact IDs followed by an application template.
The current renderers do not meet that writing objective. Their exact quotations,
controlled phrasing and fact cards have independently checkable limits, but those
limits do not establish the truth of new multilingual prose.

The request explicitly permits stopping at the narrowest safe design boundary.
That boundary is reached here: **no reviewed independent mechanism currently
validates arbitrary paraphrases or distinguishes all non-factual reflection from
new assertions/presuppositions about the user.** This change supplies a concrete
contract proposal, reproducible current-output examples and executable counterexamples.
It does not advertise a native-writing implementation or a working native validator.
No keyword blacklist, citation-only acceptance, “reflection” label, second model,
translation stage or new provider is introduced.

This is not a claim that natural language can never be checked, or that Chinese
is unsafe. It is a limitation of the verification available in this architecture.
Enforcing a menu/grammar that only reproduces the current fixed wording would
also fail the product objective; that is not presented as an upgrade.

## What is independently checkable now?

| Claim/property | Available check | Limit |
| --- | --- | --- |
| Exact attributed source sentence | Equality to a supplied immutable sentence candidate; current source revision at dispatch/persistence | Quotation verifies what was recorded, not external truth; sentence segmentation/truncated memory limits still apply |
| Event total | Deterministic eligible-period Event count and exact supported numeric grammar | A matching number somewhere in prose does not validate the rest of a sentence |
| Event date/period | Owner timezone, canonical bounds, source timestamps | Does not prove that a model's localized date phrase refers to the correct source |
| Topic recurrence | Exact recorded metadata and distinct Event/week membership | Metadata can be empty; a topic label does not prove an experience or emotional state |
| Sample comparison | Selected current/previous source counts, dates and explicit scope | Not a whole-month personal/emotional trend; chronology is not causality |
| Citations/ownership | Exact selected Event/Memory pairs, owner, permission and revision fences | Citation existence does not prove prose follows from a source |
| New paraphrase, psychological interpretation, translation, causal link | No accepted independent entailment rule here | Reject/abstain; do not certify with token overlap, a regex blacklist or model self-labeling |
| Reflective question | Some individually reviewed utterances can be non-factual | “Why has your anxiety improved?” contains a factual presupposition despite being a question |

The preserved deterministic extractor copies optional Event topic metadata; it
does not produce a semantic fact graph, causal relations or a verified emotional
trajectory. Model-generated extracted facts would themselves require validation.
Adding an unreviewed extraction/entailment model is outside this request.

The existing legacy `GroundedReportNarrativeService` explicitly does not certify
number-free subjective prose. Focused mocked counterexamples show that valid
citations can accompany unsupported diagnoses/causality and still pass that older
filter. This is the already documented limitation in MODEL_SELECTION/SECURITY,
not a newly weakened gate. It must not be reused as a native-prose truth checker.
The current strict Sonnet/Opus contracts reject extra prose in any language,
including benign prose. That rejection is schema isolation, not semantic competence.

## Proposed contract: `native-reflection-v2` (DESIGN ONLY)

One output schema would serve both report types, with server-approved bounds.
Every object must be closed (`additionalProperties: false`), every field have an
exact type, and version/type/locale equal the trusted request. No implementation
accepts this version yet. This proposal is not a bypass for saved v1 reports.

- Envelope: `version`, `reportType` (`WEEKLY`/`MONTHLY`), `locale`
  (`en`/`zh-Hans`/`zh-Hant`), `overview`, `insights` (one or two), nullable `closing`.
- Each block: ordered `segments`; its text is exactly their concatenation. Each
  segment carries `kind`, native-language `text`, exact request-local
  `evidenceRefs`, allowlisted `aggregateRefs` and a bounded typed `proposition`.
  A segment label is an untrusted assertion about the text, never an approval.
- `QUOTE`: exact supplied source-language sentence, source identity and revision.
  Preserve names, numerals, negation and mixed-language text without translation.
- `DETERMINISTIC_FACT`: typed total/recorded-topic/sample-comparison proposition,
  computed independently from the immutable package. **Its native text also needs
  an accepted complete localized grammar**; verifying the proposition alone cannot
  bless “2 Events proved you are recovering.” No unparsed clause may remain.
- `REFLECTION`: non-factual connective/invitation, with no new person, event,
  relationship, cause, diagnosis, improvement, hidden emotion or presupposition.
  **Acceptance remains unresolved.** A question mark, hedge, lack of digits, valid
  citation or self-reported kind is insufficient. Broad acceptance cannot ship
  before an independent, reviewed policy can establish this property. A fixed
  phrase menu alone is not the requested native-writing product.
- New experiential paraphrases, translated quotations, inferred growth/causality,
  diagnoses and unsupported emotional trajectories have no accepted proposition
  type. Current evidence cannot support marking those generated claims verified.

Claude would supply actual native text, not IDs for backend-written paragraphs.
A future implementation would validate the entire text, including connectives,
not just annotated factual spans. It must reject unrecognized or unverified text,
never strip it, silently translate it, add citations or repair it with another call.
For now, the unresolved segment checks block implementation and dispatch of v2.
Safe existing refusal/unavailable/insufficient-evidence states remain truthful;
provider refusal must not be recorded as native AI generation success.

### Length and persistence mapping

Target main text: approximately 100–180 Chinese grapheme clusters Weekly and
250–350 Monthly, only with sufficient meaningful evidence. Count via
`Intl.Segmenter`, punctuation/combined emoji included, layout whitespace excluded.
Keep at most 3 saved sections, 700 UTF-16 characters per section, 1,800 total, and
Chinese hard caps 250 Weekly/500 Monthly until a separately reviewed change.
These are ceilings, not reasons to pad. Shorter truthful prose is preferred.

A reviewed mapping must combine overview with the first observation and closing
with the final observation, preserve text order, union exact citations, keep
section kinds unique and fit existing JSON/readers. Existing saved v1 JSON must
remain readable and immutable. Store content version separately from the stable
`grounded-narrative-v1` job/reservation identity. A new version cannot reopen a
spent period or buy another inference. This mapping is proposed, not integrated.

### Source and reliability invariants

Reuse the authenticated saved `preferredLocale`; unsupported locale is explicit
failure. Compose directly in that language. No English-first/translation stage,
translation of source Events, locale/routing instructions from model output or
special rejection of Chinese characters. Source language inside quotations stays
verbatim. Ordinary grief, stress, loneliness and frustration are eligible Event
content subject to consent and provider safety; no zero-refusal promise is made.

Preserve owner-scoped Event-only retrieval, Journal exclusion, BGE 384d/pgvector
English retrieval, existing bounded Chinese period selection, and PR #46's
current-week coverage/chronological anchors/previous-month sample boundaries.
Chronological Chinese selection is not validated Chinese semantic RAG. Full source
and consent snapshots remain server-only and authoritative; immutable provider
input uses minimized request aliases, never owner credentials or Journal content.

Reuse Gateway schema/body limits, native completion/refusal/model/usage checks,
pre-retrieval call/USD admission, timeout/late-response fences, no logs/cache and
one attempt. Rate limit, malformed/truncated output, refusal or ambiguous billed
work remains failed/unavailable with retained reservation; no repair, translation,
paid retry, extra model or provider fallback. Recheck claim/lease, consent epoch,
owner, source revision/deletion, timezone and locale before atomic report/evidence/
job completion. No production route or storage changes are made by this review.

## Product quality review

[Actual deterministic examples](REFLECTION_RENDERED_EXAMPLES.md) are generated
from synthetic fixtures by the existing v1 validators/renderers and checked byte
for byte by the new focused test. They are not Claude output or target-style prose.
They demonstrate that the present output still reads as a database summary.

| Dimension | Current deterministic examples | Required native improvement / limit |
| --- | --- | --- |
| Naturalness / warmth | Grammatically readable; repeated disclaimers dominate | Model-authored language should attend to actual recorded moments; native acceptance is blocked |
| Repetition | Every opening includes counts; closing repeats generic guidance | Do not force counts or motivational filler into each paragraph |
| Insight | Exact moments and chronology; limited synthesis when topics are empty | Relationships/changes need independent support, not just two dates |
| Factual accuracy | Quotes/counts have scoped checks | These checks do not prove new paraphrases or external truth |
| Psychological interpretation | No inferred diagnosis/growth in these outputs | Keep this constraint through all generated framing, including questions |
| Chinese / English | Native application wording, preserved mixed-language quotations | Correct grammar in mocked text is not proof of Claude fluency or safety |
| Conciseness | Chinese examples fit the existing targets; English is verbose | Reduce boilerplate; target length cannot justify extra unsupported words |

### Manually authored target-style examples — NOT Claude output, NOT validated

These illustrate product direction only. They are not executable acceptance
fixtures, approved truth claims or a workaround for the missing validator.
They were authored independently in each language, without a translation model.

**Weekly / Simplified Chinese**

项目延期带来的烦闷，和画进 sketchbook 的 River Park，都在这周的记录里。你也写得很清楚：没有和同事吵架，也没有参加展览。把这些片段并排放着，可以先回看当时留下的具体表达；如果愿意，也可以翻回那页画，暂时不急着为这一周下结论。

**Weekly / Traditional Chinese**

這週留下的片段，一邊是專案延期時的煩悶，一邊是 sketchbook 裡的 River Park。你寫到沒有和同事吵架，也沒有參加展覽。這些話可以照著當時的意思留在這裡；回看時，不一定要立刻替它們找出共同的答案，也可以先停在那頁畫上。

**Weekly / English**

Your entries hold frustration about the delayed project alongside a drawing of River Park. You were specific about what did not happen, too: no argument with colleagues and no exhibition. If you wish, you could return to that sketchbook page without needing it to explain the whole week.

**Monthly / Simplified Chinese — deliberately shorter than the target for this sparse fixture**

这个月的记录里，有项目延期时的烦闷，也有几条和画树有关的片段。你试过用炭笔画 River Park，把公园画进 sketchbook，又把一张炭笔画分享给朋友；对方说喜欢画里的树。关于工作和画画，你也留下了清楚的限定：没有和同事吵架，没有参加展览。这些事发生在不同的周，却不能仅凭先后顺序说成心情好转或生活进步。回看时，可以先停在某个具体片段上，也可以把它们之间的关系暂时留白。

The manual prose itself still needs review: “alongside”, “一邊…一邊”, “hold” and
cross-Event references can convey relationships beyond literal equality. A model
can produce text of this form, but the current validators cannot independently
certify all its implications. Human readability does not close that gap.

## Validation and what remains blocked

Focused tests reproduce six current multilingual outputs, ordinary sensitive
Chinese/mixed source handling, exact numeral/negation preservation, rejection of
native prose under v1 schemas, the legacy citation-only entailment gap, sparse/
wrong-owner rejection and strict existing version/locale isolation. No fetch/inference is used.
Saved-reader compatibility and the existing v1 native-provider refusal/timeout/rate-limit, consent/deletion/claim/
cost/atomic persistence evidence from PR #46 is reused, because runtime modules
are byte-unchanged. This change does not claim a new native runtime handles those
cases. No frozen evaluation set, user data or provider credentials are used.

Remaining blocker: agree on independently verifiable native factual/reflective
language scope, validate it in all three locales with adversarial examples, then
review the contract-to-persistence mapping before wiring a paid provider. No new
semantic system, migration or relaxation is authorized by this design record.
Live writing quality/latency and provider refusal behavior remain unmeasured.
A separate review of a bounded prototype or a revised evidence representation is
needed to proceed; another LLM's opinion is not an automatic truth certificate.
