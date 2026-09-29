# PetalPal Long-Term AI

> Canonical engineering record for long-term memory, retrieval, reports, and
> AI application architecture. This is a living record: update it with every
> AI architecture decision, schema change, implementation completion, reversal,
> and material test result.

## 1. Canonical Product Rules

- AI only processes user-authored Events.
- Journal is never an AI source.
- Journal is never embedded.
- Journal never enters RAG.
- Journal never contributes to Weekly / Monthly / Yearly AI reports.
- AI-generated Memory and Reports are private and owner-only.
- All retrieval is owner-scoped before similarity search.
- AI must not claim historical facts unless grounded in retrieved evidence.
- Emotion ML is an optional structured signal, not a prerequisite for the
  long-term AI architecture.

Daily Grow accepts `journalText`; its legacy `event` field is a deprecated alias
for the same Journal-only input. Neither form is sent to emotion AI or written
to the Event table. `Flower.event` remains temporarily as a legacy private
display copy and is never an AI evidence source. Historical Journal rows are
not backfilled into Event; any future import requires explicit user opt-in.

## 2. Production AI Workflow

```text
Event
  → Private EventMemory
  → Embedding / Retrieval
  → Weekly Recap + Trend
  → Monthly Pattern Analysis
  → Yearly Growth / Journey
```

```text
Journal
  → Private storage only
  → No long-term AI
  → No embedding
  → No RAG
  → No AI reports
```

## 3. Current Architecture

### IMPLEMENTED

- Event flow: authenticated `POST /events` persists a private Event with
  request idempotency. Ownership comes only from verified Firebase identity.
  When the locked current consent row has AI processing, personalization, and
  memory all enabled, Event and the versioned memory job are committed atomically.
- Journal flow: `DailyCheckIn` has an optional private `Journal`; the existing
  Daily Grow route creates it transactionally and never invokes emotion AI.
- Authentication / authorization: Firebase ID tokens are verified server-side;
  `req.auth.userId` is mapped from the verified Firebase UID and owner guards
  protect private HTTP resources.
- AI modules: local mood classification, optional Cloudflare Workers AI
  inference, secondary emotion selection, and deterministic Flower metadata.
- Cloudflare Workers AI: implemented for Event secondary emotions and grounded
  Weekly/Monthly narratives with server-only bearer authentication, bounded
  input, and schema validation.
- Current database models: Prisma PostgreSQL schema includes User,
  DailyCheckIn, Journal, EmotionResult, Flower, consent, metadata, social,
  Fairy, and subscription models. This revision adds Event, EventMemory,
  WeeklyReport, MonthlyReport, YearlyReport, AiEvidence, and AiJob.
- Current async/background processing: `AiJob` is DB-backed and supports atomic
  `SKIP LOCKED` claim, leases, crash recovery, bounded attempts, and guarded
  transitions. `npm run start:ai-worker` runs the production worker loop with
  graceful shutdown and the EventMemory, embedding, and grounded Weekly/Monthly
  handlers.
- Current report support: `Report` is the existing social moderation/report
  model. Private AI report reads and an authenticated Weekly trigger exist;
  Monthly generation uses the worker, while Yearly remains a foundation model.
- Current tests: backend and client suites cover auth, ownership, Daily Grow,
  emotion routing, Worker boundaries, deletion, Flower/Fairy behavior, and the
  new foundation contracts.

### PARTIAL

- Emotion ML is an optional structured signal and is not a dependency of
  EventMemory. Its production readiness remains tracked in `ML_PROGRESS.md`.
- Account/Event deletion cascades the inline pgvector value and citing reports.
  Managed worker deployment and a production grounded-report smoke remain
  unverified.

### SCAFFOLD ONLY

- Replaceable MemoryExtractor and RetrievalStrategy contracts, HybridRetrieval,
  YearlyQueryRouter, and evaluation traces. The deterministic extractor remains
  the production EventMemory extraction implementation.

### NOT IMPLEMENTED

- Managed worker deployment/process supervision, keyword full-text indexing,
  reranking, report scheduling, Yearly generation, and user-facing report UI.
- Production groundedness/evidence-coverage metrics and a real grounded-report
  provider smoke. No external vector/object store is used by this pipeline.

## 4. Target Architecture

- Event-only AI boundary
- EventMemory
- MemoryExtractor
- EmbeddingProvider
- MemoryRepository
- RetrievalService
- Metadata Filtering
- Hierarchical Memory
- WeeklyReportService
- MonthlyReportService
- TrendAnalyzer
- YearlyQueryRouter
- Evidence / Provenance
- RAG Evaluation
- Background AI Jobs
- future Hybrid Retrieval
- future Reranking

The current code has contracts for these boundaries where practical; contracts
are not claims that the backing provider or worker is production-ready.

Hierarchical memory target:

- Tier 3: raw private `Event`
- Tier 2: structured `EventMemory`
- Tier 1: `WeeklyReport` and `MonthlyReport`
- Tier 0: `YearlyReport` / future yearly snapshot

## 5. Data Model

| Model | Purpose | Ownership / provenance |
| --- | --- | --- |
| `Event` | Private user-authored source | `ownerId` is a required User FK |
| `EventMemory` | Structured derived memory | owner-scoped; unique `sourceEventId` |
| `EventMemoryEmbedding` | Profile-keyed pgvector generation | owner-preserving EventMemory cascade |
| `WeeklyReport` | Weekly recap and trend container | owner + unique period |
| `MonthlyReport` | Monthly patterns and turning points | owner + unique year/month |
| `YearlyReport` | Future yearly growth/journey container | owner + unique year |
| `AiJob` | Retryable async work record | owner-scoped; idempotency key |
| `AiEvidence` | Explicit report claim → Event provenance | owner-scoped Event FK; optional memory/report FKs |

`EventMemory` supports `summary`, `topics`, `people`, `importanceScore`,
`eventDate`, extraction/memory versions, and optional structured emotion fields
(`primaryMood`, `secondaryEmotions`, `emotionConfidence`,
`emotionModelVersion`, `emotionOutcome`, `emotionProvenance`,
`emotionModelId`, `emotionModelStatus`, `emotionProbabilities`). It also stores
an inline `vector(384)` with embedding status, profile, model, and
input-revision metadata.

`EventMemoryEmbedding` is the expanded, profile-keyed `vector(384)` store. It
records one row per EventMemory/profile/input revision, including model
revision, status, and generation time. The existing inline local vector
and metadata remain during rollout so older application versions can continue
to read/write them and rollback does not discard the local corpus.

Composite foreign keys enforce that EventMemory, AiEvidence, report evidence,
and Event-linked AiJob rows have the same owner as their parent records.
`AiEvidence` is the sole evidence source of truth and each edge belongs to
exactly one report. Deleting an Event deletes every report that cited it before
the memory/evidence cascades run, so a summary cannot survive its provenance.

## 6. Retrieval Design

- `ownerId` is mandatory and comes from an authenticated server-side identity;
  it is never selected from a client query.
- Metadata filters are contracted for date range, topics, people, memory type,
  and minimum importance.
- The repository currently implements owner-scoped metadata/keyword fallback
  over structured memory fields.
- SQL retrieval, keyword/full-text search, and semantic/vector search are
  separate future strategies that can be composed by `HybridRetrieval`.
- Query routing is intentionally simple. The yearly router maps count/who
  questions to SQL, first-record questions to keyword, semantic-feeling
  questions to vector, turning-point questions to reports, and otherwise to
  metadata.
- Future reranking and query rewriting are explicitly deferred.
- Evidence selection must happen after owner scoping and must return source
  Event IDs to the generation layer.

## 7. Trend & Change Analysis

Report services load current and previous Event periods with owner-scoped SQL
using `[start, end)` UTC bounds derived from the owner's IANA timezone. Real
statistics and time comparison are computed by deterministic backend logic. An
LLM may explain those results later; it
does not calculate or guess the numbers.

Current `TrendAnalyzer` supports:

- current and previous period event counts;
- topic frequencies and topic changes;
- important-event count;
- week-over-week and month-over-month comparison contracts;
- explicit `insufficient_data` when the current period has no events.

Weeks start Monday in the user's local timezone. Production reports default to
closed periods; an explicitly requested partial report is stored with status
`PARTIAL`. Weekly and Monthly builders include deterministic top topics,
important-event IDs, and trend signals. Monthly also reserves turning-point IDs
using an importance threshold.

## 8. Evidence / Provenance

`AiEvidence` links an owner, source Event, optional source EventMemory, claim
type, and exactly one Weekly/Monthly/Yearly report. Report regeneration replaces
all evidence edges in the same transaction as the report upsert. Future LLM
generation must receive an evidence package rather than the user's entire
history. No citation UI exists yet.

## 9. RAG Evaluation

`createRetrievalEvaluationTrace` provides a non-business-response trace shape
for:

`Recall@K`, `Precision@K`, `MRR / ranking quality`, `Groundedness`,
`Hallucination Rate`, `Evidence Coverage`, `Latency`, `Cost`, and `User Rating`.

The trace keeps query, strategy, candidate IDs, chosen evidence, generation
version, model version, latency, and cost. No benchmark or production metrics
pipeline exists yet.

## 10. Emotion ML Integration

Emotion ML is an optional structured signal, not a dependency of long-term AI.
The existing system stores primary label, secondary emotions, confidence,
intensity, model version, and inference path on `EmotionResult`. EventMemory
has nullable future-compatible fields for `primaryMood`,
`secondaryEmotions`, `emotionConfidence`, and `emotionModelVersion`.

The current local classifier and Cloudflare Worker pipeline are production
application support for Daily Grow, but the ML experiments and their status
remain owned by `ML_PROGRESS.md`. No experiment files were changed in this
foundation work.

## 11. Privacy & Security

- Firebase-authenticated identity is mapped to server-side PetalPal ownership.
- Memory, reports, jobs, evidence, and Event access are owner-scoped before
  retrieval.
- Journal has no relation to EventMemory, embedding, retrieval, report, or AI
  job models in this schema.
- New repository methods require an authenticated identity and reject forged
  owner IDs or cross-user reads.
- Negative tests cover cross-user memory reads/searches, forged ownership,
  Journal pipeline isolation, and report input ownership.
- Event and user deletion cascade EventMemory and its inline pgvector value;
  deleted embeddings cannot remain retrieval candidates.
- Existing security requirements and operational controls remain canonical in
  `SECURITY.md`; this section records only the AI-specific boundary.

## 12. Current Implementation Status

| Component | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Event-only AI boundary | IMPLEMENTED | Event API + Daily Grow route tests | Journal path is isolated; Event API is the only long-term AI source |
| EventMemory | IMPLEMENTED | Prisma schema + pgvector migration | Structured Event memory with versioned 384d vector lifecycle |
| MemoryExtractor | SCAFFOLD ONLY | `DeterministicMemoryExtractor` | Replaceable contract, not LLM extraction |
| EmbeddingProvider | IMPLEMENTED | Cloudflare Workers AI and retained local Transformers.js providers + durable embedding worker | BGE small English v1.5, summary-v1, 384d |
| pgvector | IMPLEMENTED | `vector(384)` migration + PostgreSQL integration tests | Exact cosine Top-K; ANN intentionally deferred |
| Multi-profile embedding storage | CLOUDFLARE ACTIVE | `EventMemoryEmbedding` expand/copy migration + production candidate backfill | Cloudflare is active; local vectors and ONNX remain for rollback |
| MemoryRepository | IMPLEMENTED FOR SEMANTIC RETRIEVAL | `PrismaMemoryRepository`, `PrismaEventEmbeddingRepository` | Owner-scoped storage, invalidation, exact semantic retrieval |
| Weekly Report | INPUT READY | deterministic aggregates + bounded semantic evidence input | No LLM narrative or scheduler |
| Monthly Report | INPUT READY | deterministic aggregates + bounded semantic evidence input | No LLM narrative or scheduler |
| Trend Analyzer | PARTIAL | `lib/trend-analyzer.js`, report services | Deterministic counts/comparison; advanced normalization remains deferred |
| Evidence / Provenance | INPUT SELECTION IMPLEMENTED | owner-safe selector + relational `AiEvidence` foundation | Selected input retains Event/EventMemory references; no narrative citations yet |
| Yearly Router | SCAFFOLD ONLY | `lib/yearly-query-router.js` | Routing contract, no retrieval workers |
| Background Jobs | IMPLEMENTED | PostgreSQL atomic intent, lease recovery, memory and embedding handlers | Embedding failures use the existing bounded three-attempt job lifecycle |
| RAG Evaluation | SCAFFOLD ONLY | `lib/rag-evaluation.js` | Trace shape only |

### M1 checkpoint — 2026-09-16

| Deliverable | Status |
| --- | --- |
| Phase 0 embedding policy ADR | IMPLEMENTED / DOCUMENTED — `docs/adr/embedding-policy-v1.md` |
| Deterministic embedding input contract | IMPLEMENTED — `summary-v1`, `structured-v1` |
| Server-side profile registry | IMPLEMENTED FOR TEST INFRASTRUCTURE — test profile only |
| Provider abstraction and deterministic test double | IMPLEMENTED — no network calls |
| Production embedding provider/profile | NOT SELECTED AT M1 |
| Vector storage/retrieval | NOT IMPLEMENTED |
| Benchmark | NOT RUN |

### Phase 2 benchmark status — updated 2026-09-17

| Deliverable | Status |
| --- | --- |
| Benchmark fixture foundation | PASS FOR ENGLISH DEV — deterministic English source-of-truth; multilingual slices preserved but excluded |
| Multilingual synthetic gold set | DEFERRED — `zh-zh`, `en-zh`, `zh-en`, and `code-switch` are outside Phase 1 |
| Keyword baseline harness | IMPLEMENTED — owner-scoped, deterministic |
| Exact-vector benchmark harness | IMPLEMENTED — exhaustive cosine, owner-filtered before ranking |
| Recall@K / MRR metrics | IMPLEMENTED — no-answer queries excluded from recall denominator |
| Benchmark protocol | IMPLEMENTED — `docs/semantic-benchmark-protocol.md` |
| Dev gold semantic audit | PASS FOR ENGLISH — 84 queries / 78 positive edges / 0 issues / 0 unresolved |
| Held-out protection | IMPLEMENTED — development/model-selection runs are rejected; final-evaluation purpose required |
| Real embedding provider benchmark | PASS ON ENGLISH DEV — 3 candidates × 2 input versions × 3 runs |
| Production embedding model | SELECTED CANDIDATE — BGE small English v1.5 + summary-v1, 384d |
| Semantic production retrieval | PASS — owner-scoped exact pgvector Top-K with selected BGE profile |

The original Phase 2 foundation output was marked `INFRASTRUCTURE VALIDATION
ONLY — NOT MODEL QUALITY EVIDENCE`. The later English candidate checkpoint
below adds real local-provider dev evidence; production database, pgvector,
ANN, backfill, multilingual data, and held-out data remain unused.

### Semantic gold audit checkpoint — 2026-09-17

- Actual execution: `test/back/semantic-retrieval.test.js` passed 8 / 8 after
  adding the audit and held-out guard; keyword dev benchmark executed.
- Finding: the existing artifact is structurally valid but semantically
  unsuitable for model selection. The dev audit found 77 inconsistent positive
  edges among 120, including explicit topic/person mismatches.
- Decision: do not benchmark/select a real provider, freeze vector dimensions,
  or add a production pgvector index against this gold set.
- Safety: held-out benchmark execution now requires explicit
  `final-evaluation` purpose and is not used for tuning/model selection.
- Blocker at this checkpoint (resolved by the English-only checkpoint below):
  repair dev labels while leaving held-out families closed.

### English-only semantic gold repair checkpoint — 2026-09-17

- Product scope: Phase 1 retrieval and embedding selection are English-only.
  Chinese, cross-language, and code-switch retrieval are deferred to a future
  multilingual phase.
- Root cause retained: the original 77 issues came from stale exact-query
  ordinals (36), fixed first-Event topic/cross-language mapping (18), incorrect
  multi-plausible mapping (12), paraphrase drift (6), and proper-noun drift
  (5). The 18 cross-language issues are excluded rather than tuned in Phase 1.
- Repair: English dev queries now use deterministic objective criteria over
  English Events, owner, and scenario family. Under-specified broad and
  hard-negative English queries were narrowed instead of guessing positives.
- Verification: 84 English dev queries, 78 positive edges, 0 audit issues,
  0 unresolved cases, 0 scenario-family leakage, and 0 cross-owner leakage.
  The 24 multilingual dev queries remain present and excluded (6 per deferred
  slice). Held-out remains closed.
- Tests: semantic retrieval suite passed 9 / 9; English keyword dev benchmark
  executed as infrastructure validation only.

### English embedding candidate checkpoint — 2026-09-17

- Candidates: local q8 ONNX `all-MiniLM-L6-v2`, `bge-small-en-v1.5`, and
  `e5-small-v2`; both `summary-v1` and `structured-v1` were evaluated three
  times on 84 English dev queries / 120 English dev Events.
- Baseline: keyword Recall@1/3/5 = 0.528/0.528/0.528; MRR = 0.588.
- Selected: BGE + `summary-v1`, Recall@1/3/5 = 0.549/0.708/0.750;
  MRR = 0.673. It reached Recall@5 = 1.0 on paraphrase/proper-noun/short-vague
  and 0.667 on both hard-negative and multi-plausible.
- Tradeoff: E5 had higher aggregate Recall@5 (0.813) and MRR (0.687), but
  regressed hard-negative Recall@5 to 0.333 and reached only 0.250 on
  multi-plausible; BGE was selected for safer slice balance.
- Deployment: 384 dimensions, cosine, local Node.js ONNX q8, zero per-call API
  fee; observed BGE median total benchmark latency was 1,892 ms and median warm
  query+ranking latency was 11.38 ms/query. CPU and model-cache costs remain
  unpriced infrastructure costs.
- Boundaries: no held-out or multilingual data, no gold changes, and no
  pgvector/ANN/backfill integration.

### Owner-safe pgvector retrieval checkpoint — 2026-09-17

- Implemented: owner Event extraction persists `summary-v1` through the
  selected local q8 BGE provider into an inline PostgreSQL `vector(384)` on
  EventMemory. Profile key, model, model revision, input version, input
  revision, and generation time identify every usable vector.
- Retrieval: `SemanticEventRetrievalService` embeds the English query once and
  runs exact cosine Top-K with owner, generated-status, profile, model, and
  input-revision predicates in SQL. No ANN, reranker, hybrid search, evidence
  selection, multilingual slice, or held-out data was introduced.
- Lifecycle: unchanged embedding inputs reuse the existing revision and
  idempotent job; a changed EventMemory summary increments the input revision
  and atomically invalidates the old vector. Event/user deletion removes the
  EventMemory row and vector through the existing cascade.
- Safety: identity is server-derived at every repository boundary. Current AI
  memory consent is checked before provider use and locked/rechecked before a
  vector is stored or returned. Provider calls have a bounded timeout and
  durable jobs retain the existing bounded retry policy.
- Verification: Prisma schema validation and JavaScript syntax checks passed.
  The focused unit/integration suites passed 23 / 23, including the real
  PGlite pgvector extension. A clean 17-migration chain and the real PostgreSQL
  suite passed 8 / 8 against an isolated PostgreSQL 16 + pgvector database;
  the new test covers 384 dimensions, model metadata, owner isolation,
  summary-update invalidation, exact retrieval, and deletion cleanup.
- Status: PASS. The pre-deployment EventMemory backfill requirement is resolved
  by the checkpoint below.

### EventMemory embedding backfill checkpoint — 2026-09-17

- Implemented a one-batch, cursor-based backfill command for the selected
  `production-bge-small-en-v1.5-v1` profile. Batch size is explicitly bounded
  to 1–500 rows and defaults to 100.
- Eligibility is limited to EventMemory rows whose source Event still permits
  memory processing, whose owner has an English preferred locale and current
  AI processing/personalization/memory consent, and whose stored vector or
  production profile metadata is missing or stale.
- Current vectors are skipped. Eligible rows reuse the existing
  `EMBEDDING_GENERATION` job key for profile + input revision, so concurrent or
  repeated backfill runs return the same job rather than creating duplicate
  work. The existing worker remains responsible for provider calls, timeouts,
  three-attempt retry/failure handling, and final pgvector storage.
- Operator entry point: `npm run backfill:event-memory-embeddings`. Each run
  processes one bounded page; `AI_EMBEDDING_BACKFILL_AFTER_ID` continues from
  the returned cursor.
- Verification: focused unit and PGlite integration tests passed 25 / 25. A
  clean migration chain and real PostgreSQL 16 + pgvector suite passed 9 / 9;
  the backfill test covers missing and stale processing, current-vector skip,
  repeated idempotency, owner attribution, English/consent exclusion, bounded
  paging, worker execution, and job completion.
- Boundaries: multilingual owners and revoked owners are excluded; held-out
  data, evidence selection, reports, ANN, reranking, and hybrid retrieval were
  not touched.

### Weekly / Monthly evidence-selection checkpoint — 2026-09-17

- Implemented `ReportInputService` for closed Weekly and Monthly periods. It
  reuses the existing deterministic aggregates and selected BGE exact semantic
  retrieval; no second retrieval pipeline was introduced.
- Retrieval now applies owner, Event-only source, current English locale,
  source-Event eligibility, production embedding metadata, and report
  `[periodStartUtc, periodEndUtc)` predicates in PostgreSQL before ranking.
  Current memory consent is still checked before query embedding and locked /
  rechecked before results are returned.
- Final evidence is not raw Top-K. The deterministic selector removes duplicate
  Event/Memory references and near-duplicate summaries, balances distinct
  themes, retains multiple non-duplicate events from a repeated/changing theme,
  enforces count and conservative context-character limits, and emits stable
  chronological output.
- Weekly input is bounded to 8 selected items / 4,000 context characters from
  at most 32 candidates. Monthly input is bounded to 16 items / 8,000 context
  characters from at most 64 candidates. Below-minimum selections return
  `INSUFFICIENT_EVIDENCE` rather than inventing content.
- Every selected item carries `sourceEventId`, `sourceMemoryId`, and an explicit
  provenance object. Journal, social, friend, cross-owner, out-of-window,
  revoked-consent, ineligible Event, non-English, stale-vector, and duplicate
  candidates cannot become report evidence.
- Verification: focused unit and PGlite pgvector integration tests passed
  28 / 28. A clean migration chain and real PostgreSQL 16 + pgvector suite
  passed 10 / 10, including real Monthly report-input retrieval, time-window
  filtering, owner isolation, consent rejection, duplicate suppression,
  bounded selection, repeated-theme change retention, and provenance checks.
- Status: PASS. No narrative generation, Yearly path, held-out data,
  multilingual retrieval, ANN, reranker, or hybrid search was added.

### Grounded Weekly / Monthly narrative-adapter checkpoint — 2026-09-17

- Implemented `GroundedReportNarrativeService` as a provider-neutral adapter
  over `ReportInputService` output. It has no database dependency and sends the
  provider only bounded deterministic aggregates, report period metadata, and
  the already-selected Event evidence. Extra input fields are not forwarded.
- Weekly output is constrained to recent moments, recurring themes, and notable
  changes. Monthly output is constrained to major experiences, broader
  recurring themes, and meaningful changes or milestones. The provider is
  instructed to produce concise English claims without inventing people,
  events, dates, causes, trends, emotions, diagnoses, or milestones.
- Each provider section contains one claim and must cite an allowed aggregate
  or an exact selected `sourceEventId` / `sourceMemoryId` pair. Output
  validation rejects unknown or duplicate section kinds, missing grounding,
  unselected evidence references, unavailable aggregates, malformed JSON, and
  count / character-limit violations. The result retains both all selected
  provenance and the exact evidence and aggregates cited by generated claims.
- Owner identity is now carried on each selected evidence item and is checked
  against the report, aggregates, and evidence-selection owner before any
  provider call. `INSUFFICIENT_EVIDENCE` returns without invoking the provider.
- Provider calls use a bounded timeout and at most two attempts by default
  (hard-capped at three). Exhausted timeout, provider failure, or invalid output
  returns an explicit `FAILED` result with no fabricated fallback narrative.
- Verification: the focused AI foundation suite passed 31 / 31; the combined
  focused foundation plus PGlite pgvector / report regression passed 37 / 37.
  A broader backend run reached 149 passes with 10 real-PostgreSQL tests skipped
  because no test database URL was supplied; its only failure was an unrelated
  Daily Grow local-date concurrency assertion. This adapter makes
  no schema or database-query changes.
- Status: PASS. No report scheduler, persistence integration, Yearly report,
  multilingual path, held-out access, new retrieval system, or fallback
  narrative was added.

### Grounded report worker and atomic-persistence checkpoint — 2026-09-17

- Wired `WEEKLY_REPORT` and `MONTHLY_REPORT` into the existing leased
  `AiJobWorker`. A canonical period-key job now runs `ReportInputService`, the
  grounded narrative adapter, validated outcome persistence, and the existing
  job success / bounded retry lifecycle. No scheduler or second queue was
  introduced.
- Added explicit persisted narrative outcomes for Weekly and Monthly reports:
  `NOT_GENERATED`, `GENERATED`, and `INSUFFICIENT_EVIDENCE`. Validated narrative
  sections are stored as bounded JSON while the concise narrative remains in
  `summary`. Provider timeout, failure, malformed output, and persistence
  failure leave no partially generated report and use the existing AI job
  retry / final `FAILED` state.
- Report upsert, narrative outcome, validated sections, selected evidence, and
  cited provenance are one PostgreSQL transaction. `AIEvidence.claimType`
  distinguishes `NARRATIVE_CITED` from `NARRATIVE_SELECTED`; replacement is
  delete-and-create inside the transaction, so retry cannot duplicate reports,
  claims, or provenance rows.
- `INSUFFICIENT_EVIDENCE` is a successful, persisted, idempotent report outcome
  with no provider call, null summary, empty narrative sections, and the
  bounded selected provenance that was available.
- Owner and period identity are rechecked across the job, report input,
  narrative outcome, selected evidence, cited evidence, and composite database
  relations. Only the current `grounded-narrative-v1` job key may generate;
  stale version jobs and replayed/finalized jobs are no-ops. Older deterministic
  report persistence also refuses to overwrite a finalized grounded result.
- Verification: focused narrative, report-worker, PGlite migration, pgvector,
  evidence, lease, and transaction tests passed 46 / 46. A clean 18-migration
  PostgreSQL 16 + pgvector database and real integration suite passed 11 / 11,
  including the report worker, idempotent replay, atomic provenance, and stale
  deterministic-write protection. The broader backend run passed 158 tests,
  skipped 11 real-PostgreSQL tests when no URL was supplied, and retained only
  the known unrelated Daily Grow date assertion failure (reported as the child
  assertion plus its parent suite).
- Status: PASS. The worker accepts an injected grounded report provider; a
  concrete production report-provider endpoint/configuration remains separate.
  No scheduler, Yearly report, multilingual path, prompt tuning, UI work, or
  retrieval change was added.

### Production grounded-report LLM provider checkpoint — 2026-09-17

- Implemented the concrete report provider by reusing the existing Cloudflare
  Worker, Workers AI binding, shared-secret authentication, grounded narrative
  adapter, AI job lifecycle, and atomic report persistence path. The backend AI
  worker now enables this provider only when `CLOUDFLARE_WORKER_AI_URL` and
  `CLOUDFLARE_WORKER_AI_TOKEN` are configured.
- Added the authenticated `/v1/report-narrative` endpoint. Its Workers AI model
  is replaceable through `REPORT_NARRATIVE_MODEL`; the configured production
  default is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Generation uses
  Cloudflare JSON-schema mode with bounded tokens and a low temperature.
- The endpoint accepts only the existing Weekly / Monthly bounded contract. It
  validates report type, period, aggregate, evidence-count, evidence-context,
  and section bounds, then allowlists fields before Workers AI receives them.
  Supplied instruction/control fields and any extra Event fields are not
  forwarded. The provider has no database or retrieval access.
- Structured responses still pass through the existing authoritative
  claim/provenance grounding validation before the existing atomic persistence
  transaction. Invalid JSON/schema, timeout, HTTP/provider failure, and
  unsupported citations cannot create a fallback narrative or partial report.
  `INSUFFICIENT_EVIDENCE` still skips the provider, and bounded retries remain
  owned by the existing leased AI job lifecycle.
- Verification: provider/adapter/Worker/report-worker focused tests passed
  54 / 54; the combined provider, narrative, report persistence, PGlite,
  pgvector, evidence, and lease regression passed 60 / 60. Wrangler production
  bundle/config dry-run passed with the AI binding and model variable. The full
  backend run passed 167 tests, skipped 11 real-PostgreSQL tests because no test
  database URL was supplied, and retained only the known unrelated Daily Grow
  local-date assertion failure (reported as its child assertion and parent
  suite).
- Status: PASS for implementation and configured wiring. A real Workers AI
  smoke call is BLOCKED on this machine because the production Worker URL and
  shared-secret configuration are absent; no real provider success is claimed.
  No schema, retrieval, evidence-selection, scheduler, Yearly, multilingual,
  emotion-classifier, Fairy, or UI changes were made.

### Authenticated Weekly report trigger checkpoint — 2026-09-17

- Added authenticated `POST /ai/reports/weekly/trigger` for the existing Render
  Web Service. The route derives the owner only from the verified session,
  accepts only an optional `localDate`, canonicalizes a closed Weekly period in
  the owner's timezone, and cannot select another owner or another AI job type.
- The route reuses `PrismaAiJobRepository` idempotency and the production
  `AiJobWorker` Weekly handler. A targeted claim is constrained by job id,
  owner id, and `WEEKLY_REPORT`, so an HTTP request cannot claim an unrelated
  queued job. Duplicate/concurrent triggers reuse the same job, and finalized
  reports remain protected by the existing worker replay rules.
- Trigger-created jobs use one bounded attempt for the controlled production
  smoke. The response exposes only bounded job/report status fields. No report
  generation logic, retrieval, evidence selection, provider, persistence,
  scheduler, queue, or schema was duplicated or changed.
- Verification: route/worker/PGlite focused tests passed 18 / 18, including
  unauthenticated rejection, forged-owner/job-type rejection, idempotent replay,
  finalized-report protection, exact owner/type claims, and concurrent
  single-claim behavior. The full backend run passed 169 tests and skipped 11
  real-PostgreSQL tests without a configured test URL; only the known unrelated
  Daily Grow local-date assertion remained (reported as its child assertion and
  parent suite).
- Status: PASS for implementation. No real LLM inference was made. Deploy this
  checkpoint before issuing the single authenticated production Weekly smoke.

### End-to-end consent safety checkpoint — 2026-09-28

- Long-term processing still starts only from a user-owned Event. Event/job
  creation, embedding backfill enqueue, and the authenticated Weekly trigger
  lock the existing AI processing, personalization, and memory consent row
  before enqueue. Weekly/Monthly input checks current consent before loading
  periods, and its owner-scoped Event query excludes rows with
  `memoryProcessingAllowed = false` before counts or trends are computed.
  Existing semantic retrieval applies the same source eligibility before
  ranking; bounded evidence and narrative input therefore cannot include an
  ineligible Event.
- Memory persistence and embedding-job enqueue now share one transaction. That
  transaction locks and rechecks current consent and source Event eligibility
  before writing EventMemory or durable embedding intent. Embedding status
  changes also recheck current consent before writing. Weekly/Monthly report,
  narrative, and evidence persistence locks and rechecks current consent in its
  existing atomic transaction after any provider call.
- A claimed job that reaches a revoked-consent check uses the existing
  `CANCELLED` status, including when the consent route already cancelled it.
  No memory, vector, report, or citation is written after that check; the job
  does not retry solely because consent was revoked. The existing consent route
  still cancels pending/running jobs, and semantic retrieval still rejects
  revoked consent.
- Re-enabling consent does not reopen terminal `CANCELLED` jobs with the same
  idempotency key. Historical reprocessing after a re-grant still needs an
  explicit product policy and versioned re-enqueue path.
- Focused route, foundation, PGlite, report-worker, semantic-retrieval, and
  Event-emotion suites passed 73/73 locally, including memory, embedding,
  Weekly, Monthly, aggregate-eligibility, and owner-isolation regressions.
  The real PostgreSQL
  suite was unavailable because `REAL_POSTGRES_DATABASE_URL` was unset. No
  schema migration, deployment, live LLM call, model, or prompt change occurred.

### Managed worker preflight — 2026-09-28

- An isolated PostgreSQL worker process stayed alive with an empty queue, resumed
  processing after idle time, and exited cleanly on SIGTERM. Idle polling had
  accumulated abort listeners and relied on an unreferenced timer; the loop now
  retains its timer and removes each listener after the poll interval.
- The default job lease is 60 seconds. A real PostgreSQL probe showed that a
  healthy handler exceeding a one-second test lease could be reclaimed by a
  second worker. Active jobs now renew their existing lease until the handler
  finishes. A two-connection PostgreSQL test confirmed no competing claim after
  the original lease elapsed; consent cancellation remains terminal.
- Under a 512 MiB Docker limit, the production-compatible amd64 image was
  OOM-killed while loading the selected BGE embedding model. Under a strict
  1 GiB limit, an isolated synthetic chain completed three EventMemory jobs
  and three real BGE embeddings, stored three 384-dimensional vectors, retrieved
  only the intended owner's memories, and completed mocked Weekly and Monthly
  report jobs. The worker returned to stable idle polling without an OOM; peak
  observed RSS across the constrained runs was about 694 MiB. A 2 GiB run also
  passed the representative memory and embedding chain.
- Focused lifecycle/report/retrieval tests passed 47/47, and the isolated real
  PostgreSQL suite passed 16/16, including concurrent claim, lease recovery,
  long-running claim protection, and consent cancellation. No Render worker,
  production database operation, model change, or live report-provider call was made.

### Multi-profile embedding storage preparation — 2026-09-28

- Added profile-keyed `EventMemoryEmbedding` rows with 384-dimensional pgvector,
  model/input revisions, status, and a composite owner-preserving cascade to
  EventMemory. The expand migration copies complete, current local generations
  without removing the legacy inline vectors or metadata.
- The active production profile remains local
  `production-bge-small-en-v1.5-v1`. The registered
  `migration-cloudflare-bge-small-en-v1.5-mean-v1` profile is a candidate only;
  no production Cloudflare embedding provider or backfill is enabled.
- New local generation writes the legacy slot and profile row atomically. Local
  retrieval continues to use the legacy slot, so old instances can still write
  it after expansion and rollback remains immediate. Candidate generation and
  retrieval use only its own profile row. Query and document profile identities
  are checked; mixed embedding spaces are forbidden.
- A summary change invalidates both local and profile rows. Retrieval requires
  current input revision, owner, eligible Event, English locale, active consent,
  and matching profile/model revision before exact cosine ranking. Candidate
  backfill must be complete and verified before any later cutover. Old instances
  may write legacy-only rows while running or leave older profile rows behind;
  the input-revision predicate excludes stale rows, and a future backfill must
  account for those writes before cutover.
- Isolated PostgreSQL 16 + pgvector rehearsal applied all 21 migrations,
  verified migration copy, dual-profile coexistence, owner/consent isolation,
  interrupted resume, idempotent upsert, failure and invalid-vector handling,
  deletion cascade, candidate cutover, and local rollback. No production
  migration, deployment, provider switch, or production re-embedding occurred.

### Cloudflare embedding candidate provider — 2026-09-28

- The private Cloudflare Worker now has a bearer-protected `/v1/embedding`
  endpoint for `@cf/baai/bge-small-en-v1.5` with mean pooling and strict
  384-dimensional finite-vector validation. The Node provider uses the same
  summary-v1 document construction and query prefix as the local profile;
  selecting it does not initialize local ONNX.
- An explicit, bounded, resumable candidate backfill command reports counts
  and estimated usage before writing. It reuses owner, Event, and consent
  guards, writes only the candidate profile, and leaves local vectors intact.
- Isolated PostgreSQL and one real Cloudflare inference call verified that a
  synthetic memory can hold both profiles without altering the legacy local
  vector. The deployed private Worker answered one synthetic embedding,
  event-emotion, and report-narrative call successfully; Render deployed the
  provider code with no pending schema migration.
- Production preflight found one eligible memory, one current local vector,
  and zero candidate rows. One bounded candidate call generated its vector.
  Postflight found one complete 384-dimensional candidate vector, no failed or
  unresolved candidate rows, no orphans or ineligible rows, and the original
  local vector intact. Three shadow queries for the dedicated safe test account
  returned the same sole Top-1 memory across profiles with no provider errors.
  This one-memory corpus cannot measure ranking quality; the separate controlled
  English benchmark remains the quality evidence.
- At this candidate checkpoint, the active profile was
  `production-bge-small-en-v1.5-v1`; cutover had not happened.

### Cloudflare embedding production cutover — 2026-09-28

- The canonical `PRODUCTION_EMBEDDING_PROFILE_KEY` now selects
  `migration-cloudflare-bge-small-en-v1.5-mean-v1` for new embedding jobs and
  semantic retrieval. The default provider follows that selection and uses the
  private Cloudflare Worker without initializing local ONNX.
- `production-bge-small-en-v1.5-v1` remains registered as the local rollback
  profile. Existing local vectors, legacy EventMemory vector columns, and the
  local ONNX implementation are retained. Returning the canonical active key
  to the local profile restores local-profile retrieval; profile-key predicates
  prevent mixed-space retrieval.
- The pre-cutover production gate found one eligible memory and one complete
  Cloudflare vector, with zero unresolved candidate rows and one intact local
  vector. Isolated PostgreSQL rehearsal verified targeted EventMemory creation,
  Cloudflare embedding generation, 384-dimensional storage, and retrieval.
- pgvector remains the only vector store. Top-K, ranking, consent semantics,
  LLMs, and AiJob claim/lease/retry behavior are unchanged. No Cloudflare Queue
  or Workflow migration or managed background worker was introduced.

### Queue dispatch preparation — 2026-09-28

- The planned dispatch boundary keeps PostgreSQL `AiJob` as the canonical
  audit, idempotency, retry, and status record. Cloudflare Queue carries only
  an opaque job ID. A private token-authenticated Render endpoint invokes the
  existing targeted `runJob` implementation; no EventMemory, embedding,
  retrieval, or report business logic moves into Cloudflare.
- The application defaults to `AI_ASYNC_EXECUTION_MODE=manual`. `shadow`
  restricts Queue execution to the configured safe test owner; ordinary users
  retain current behavior. A later `cloudflare_queue` setting enables normal
  dispatch only after staging and production gates pass.
- Immediate dispatch follows committed Event or Weekly AiJob creation. A
  twenty-minute Cloudflare Cron requests at most five due job IDs from Render and
  re-enqueues them if immediate dispatch was lost. The Queue consumer calls
  Render for an exact job ID, and PostgreSQL lease and attempt rules make
  duplicate delivery harmless. Render's current consent checks remain the
  authority. A successful memory job may enqueue its embedding child job.
- The long-running Node worker remains available as fallback code. The Queue
  path does not require an always-on Render Background Worker. Cloudflare
  Workflow is not part of this design; Queue's 15-minute consumer duration
  covers the observed job durations, subject to staging cold-start checks.
- The free-plan staging Queue `petalpal-ai-jobs-staging` and separate dispatch
  Worker were created with a single-message consumer, one concurrent consumer,
  three transport retries, and a twenty-minute reconciler. Its private
  dispatch route rejects unauthenticated requests. Production AiJob routing
  remains manual until the staging Event, embedding, Weekly, duplicate,
  reconciliation, and cold-start checks have passed.

## 13. Decisions / ADR-style Log

### 2026-09-14 — Journal removed from long-term AI workflows

- Decision: Journal is excluded from memory extraction, embeddings, RAG, and
  Weekly / Monthly / Yearly reports.
- Why: stronger privacy boundary and clearer product semantics.
- Rejected alternative: embedding or stuffing Journal content into all-history
  prompts.
- Impact: long-term AI derives only from user-authored Events; the legacy Daily
  Grow `event` alias remains Journal-only and historical Journals are not
  automatically migrated.

### 2026-09-14 — Production AI P0 ownership and lifecycle hardening

- Decision: the authenticated Event API is the only long-term AI source;
  composite owner foreign keys protect all Event-derived relationships.
- Decision: `AiEvidence` is canonical. Event deletion removes all citing
  reports; regeneration replaces evidence atomically.
- Decision: Event and a consent-approved, versioned memory job are one DB
  transaction. Jobs use guarded transitions, leases, and `SKIP LOCKED` claims.
- Decision: Event stores `occurredAt`, IANA timezone, and derived local date.
  Weeks start Monday; report UTC bounds come from local calendar boundaries,
  use `[start, end)`, and default to closed periods.
- Verification: the complete 15-migration chain passed from an empty PostgreSQL
  16.15 database with pgvector 0.8.6. Real PostgreSQL tests passed composite
  ownership constraints, checks, PL/pgSQL deletion/state triggers, atomic
  evidence replacement, 25 independent connection claims with zero duplicates,
  lease recovery, Event/job atomicity, worker child-process crash/restart, and
  Vancouver DST `[start, end)` report queries.

### 2026-09-14 — Reports require trend and change analysis

- Decision: Weekly / Monthly / Yearly foundations include trend/change fields,
  not only recap text.
- Why: pure summarization has weak long-term user value.
- Rejected alternative: LLM-only narrative without backend comparison.
- Impact: SQL/backend computes factual changes, retrieval supplies evidence,
  and a future LLM explains the result.

### 2026-09-14 — Provider and queue abstractions precede production selection

- Decision: add replaceable provider/job contracts and deterministic doubles;
  do not select an embedding model by intuition.
- Why: model quality, multilingual behavior, latency, cost, and vector
  dimensions require PetalPal-specific evaluation.
- Rejected alternative: hard-code a model and claim semantic retrieval.
- Impact: actual Embedding/RAG remains explicitly future work.

## 14. Next Tasks

### NEXT

- Deploy the authenticated Weekly trigger, then call it once for a closed
  owner period and verify the real Workers AI inference, grounding, provenance,
  atomic persistence, and unchanged free-tier usage boundary.

### LATER

- Report scheduling and groundedness/evidence-coverage evaluation follow the
  production provider integration. Hybrid retrieval, reranking, query rewriting,
  multilingual retrieval, user feedback, cost tracking, and yearly answers
  remain deferred.

## 15. Deprecated / Rejected Ideas

- Journal embeddings
- Journal RAG
- Journal memory extraction
- Journal-based yearly AI
- all-history LLM stuffing
- premature Multi-Agent
- premature GraphRAG
- MCP/A2A for this workflow
- premature LLM fine-tuning
- LLM-calculated statistics without backend verification
