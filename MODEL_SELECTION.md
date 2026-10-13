# PetalPal — AI Model Selection and Cloudflare Architecture

**Status:** Intended architecture; implementation and activation require separate approval.

**Verification date:** 2026-10-13 (America/Vancouver). Prices are USD.

**Repository baseline:** `b69e909e` on `main`; source inspection is not a fresh production certification.

**Scope:** Documentation only. No inference, benchmarking, credential changes, deployment, database operations, or PR #37 merge.

> Phase 1 source implementation is tracked in [LONG_TERM_AI.md](LONG_TERM_AI.md#phase-1-gateway-provider-abstraction--2026-10-13).
> Its adapters are disabled and disconnected from existing customer routes;
> live provider acceptance and phases 2–6 remain pending.

## 1. Executive Summary

PetalPal prioritizes factual grounding, report quality, reliability, and user experience over small per-request savings. The intended hierarchy is Claude Haiku 5.5 for Event secondary emotions, Claude Sonnet 5.5 for Weekly reflections, Claude Opus 5.5 for Monthly reflections, and OpenAI GPT-6 Sol for explicitly permitted report fallback. Deterministic EventMemory extraction, Cloudflare BGE Small English v1.5 embeddings, and PostgreSQL pgvector remain in place.

Official documentation verifies these language-model names, API IDs, context limits, structured-output support, and prices. It also documents Cloudflare's native provider routes. **This does not establish PetalPal account entitlement, configured credentials, exact-model Gateway compatibility, production capacity, or successful report generation.** No live inference was performed. Section 2 records the remaining acceptance gates.

Cloudflare remains the unified AI access layer, with two distinct execution paths: Workers AI for embeddings and AI Gateway for third-party language models. Render retains authentication, consent, owner isolation, job execution, cost admission, retrieval, validation, and persistence. A stronger narrative model cannot compensate for incorrect retrieval or missing evidence.

The controlling repository records are [WARNING.md](WARNING.md), [SECURITY.md](SECURITY.md), [LONG_TERM_AI.md](LONG_TERM_AI.md), and [INTEGRATION_DEPLOYMENT.md](INTEGRATION_DEPLOYMENT.md). Existing historical checkpoints remain evidence of their original scope. This document neither rewrites them nor authorizes implementation, paid testing, provider configuration, migration, merge, or release.

## 2. Final Intended Model Selection

### Product decision

| Task | Preferred selection | Execution/provider | Decision |
| --- | --- | --- | --- |
| Event secondary emotion analysis | Claude Haiku 5.5 | Anthropic through Cloudflare AI Gateway | Planned Tier 1 |
| EventMemory extraction | Existing deterministic extractor | Local backend | Retain |
| EventMemory embedding | BGE Small EN v1.5 | Cloudflare Workers AI | Retain active 384d profile |
| Semantic retrieval | PostgreSQL pgvector | Existing owner-scoped backend | Retain |
| Weekly Report | Claude Sonnet 5.5 | Anthropic through Cloudflare AI Gateway | Planned Tier 2 |
| Monthly Report | Claude Opus 5.5 | Anthropic through Cloudflare AI Gateway | Planned Tier 3 |
| Report fallback | OpenAI GPT-6 Sol | OpenAI through Cloudflare AI Gateway | Planned, disabled until authorized |

### Official availability and capability verification

These are **provider-native request IDs**, not names to insert into the current Workers AI binding. Limits describe provider capability, not permission to send an entire user history.

| Model | Verified request ID | Documented context / maximum output tokens | Structured response capability | Evidence |
| --- | --- | --- | --- | --- |
| Haiku 5.5 | `claude-haiku-5-5` | 1,000,000 / 128,000 | Claude JSON Schema outputs supported | [Haiku specifications][a-haiku], [structured outputs][a-json] |
| Sonnet 5.5 | `claude-sonnet-5-5` | 1,000,000 / 128,000 | Claude JSON Schema outputs supported | [Sonnet specifications][a-sonnet], [structured outputs][a-json] |
| Opus 5.5 | `claude-opus-5-5` | 1,000,000 / 128,000 | Claude JSON Schema outputs supported | [Opus specifications][a-opus], [structured outputs][a-json] |
| GPT-6 Sol | `gpt-6-sol` | 1,050,000 / 128,000 | Structured outputs supported; planned Responses API adapter | [OpenAI model page][o-sol] |
| BGE Small EN v1.5 | `@cf/baai/bge-small-en-v1.5` | 512 maximum input tokens / 384-dimensional vector | Embedding array, not narrative JSON generation | [Cloudflare model card][c-bge] |

Anthropic's structured-output mechanism is `output_config.format` with `type: "json_schema"`; this is distinct from the current Workers AI request shape. Anthropic supports only a subset of JSON Schema; application validation remains authoritative. GPT-6 Sol's model page verifies structured-output support, but the adapter's exact Responses request schema must be reviewed against the then-current API contract before implementation. Do not assume an OpenAI-compatible translation preserves all provider features. [Anthropic contract][a-json], [OpenAI model][o-sol]

Haiku and Sonnet 5.5 enable adaptive thinking by default. Haiku's guidance says to omit sampling parameters; Sonnet rejects non-default sampling parameters. Opus 5.5 thinking is always on. The existing Llama request's low temperature and token cap must not be copied blindly. Configure supported effort and total output allowances explicitly, including thinking/reasoning consumption. These are compatibility constraints, not reasons to change the chosen hierarchy. [Haiku][a-haiku], [Sonnet][a-sonnet], [Opus][a-opus]

### Exact blockers and alternatives

No requested model was absent from the official catalogs reviewed. There is consequently no catalog-driven substitution in this decision. The following remain **NOT VERIFIED / NOT IMPLEMENTED**:

- PetalPal's Anthropic/OpenAI entitlement, provider limits, billing agreement, privacy terms, and approved credentials. Public documentation cannot verify account access.
- Exact IDs plus structured-output fields, usage accounting, thinking limits, refusal/truncation handling, and response normalization through PetalPal's eventual native Gateway routes. Cloudflare's examples establish provider endpoints, not an account-specific success certificate for these models.
- Gateway provider adapters, provider-aware cost reservations, Chinese/localized grounding, revised presentation contracts, and durable fallback/recovery authorization.

If Anthropic is unavailable, the closest **verified alternative already in the owner's hierarchy** is `gpt-6-sol` for reports, subject to the fallback gates in section 9. It is not an emotion substitute. If Haiku cannot be used, retain the existing authorized emotion path or abstain; do not escalate to Sonnet/Opus. If Gateway itself is unavailable, keep a truthful unavailable state; direct-to-provider egress is not an approved alternative. Keep the existing Llama report route only as an explicitly selected rollback option with its existing limits, never as a silently promoted equivalent.

Any later model retirement or incompatibility requires a dated decision update documenting the exact blocker and a newly verified candidate. Do not invent date-suffixed IDs, adopt a newer model alias merely because it exists, or run an A/B experiment to reaffirm this product decision.

## 3. Cloudflare AI Architecture

### Target request and data flow — PLANNED

```text
Mobile / Web App
  → Firebase-authenticated PetalPal Backend on Render
  → Current consent, source eligibility and authorization checks
  → AI Job / Request Router + durable cost reservation
  → Cloudflare AI Layer
      ├─ Private existing inference Worker → Workers AI → BGE embedding
      └─ AI Gateway native provider route → Anthropic / OpenAI
  → Bounded response parsing + schema + evidence/grounding validation
  → PostgreSQL atomic persistence with final owner/consent/claim/source fence
  → Owner-authorized response
```

Cloudflare Queue remains transport for opaque job IDs to the private Render executor. PostgreSQL `AiJob` is the durable authority, not Queue delivery count or a Gateway request log. The planned request router is a backend policy boundary; it does not introduce a new scheduler, queue, database, or vector store.

**Workers AI — CURRENTLY IMPLEMENTED:** The private Worker exposes `/v1/embedding`, `/v1/event-emotion`, and `/v1/report-narrative`. BGE embeddings continue through the existing `env.AI.run` integration, authenticated server-to-server. The Llama emotion/report implementations remain available until separately approved cutover. See [Worker source](cloudflare-worker/src/index.js) and [embedding provider](lib/embedding-provider.js).

**AI Gateway — PLANNED:** Render will call native provider endpoints through an approved adapter:

- Anthropic: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic/v1/messages`.
- OpenAI Responses: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/responses`.

These documented routes preserve provider-specific API contracts. The proposed initial authentication mode is server-held provider credentials plus an authenticated Gateway token: Anthropic uses `x-api-key` and its API-version header; OpenAI uses provider bearer authentication; Gateway authentication is separate. Human operators must approve and configure the actual secret-store bindings. Cloudflare also offers stored-key/BYOK and billing options, but those are separate design/approval decisions, not implicitly enabled. [Anthropic route][c-anthropic], [OpenAI route][c-openai]

Third-party API charges and credentials are separate from Workers AI's free Neurons allocation. Provider-native language models are not made free by routing through Cloudflare, and the current Workers AI binding does not become an Anthropic/OpenAI adapter by changing a string. Gateway/logging, Workers, Queue, and provider charges must be accounted for separately. [Workers AI pricing][c-ai-price], [Gateway pricing][c-gateway-price]

Gateway receives minimized inference payloads and sanitized operational metadata only. Disable body logging and response caching before private traffic. SDK, Gateway, and transport-layer automatic inference retries must be disabled; the backend's durable policy decides whether another attempt is admissible. Dynamic routing, extra moderation/guardrail model calls, and automatic fallback are not enabled by this design.

## 4. Model Routing Policy

Routing is deterministic by authenticated task type, authorized provider, and enabled capability; user text cannot choose a model, endpoint, budget, tool, or retry policy.

| Tier | Admission and purpose | Required behavior |
| --- | --- | --- |
| 1 — Lightweight AI | Eligible Event secondary emotions; future bounded categorization/extraction only where deterministic logic cannot meet the requirement | Haiku; bounded effort/output; no expensive reasoning model merely to label emotions |
| 2 — Weekly reflection | Eligible closed-week report with sufficient selected evidence and deterministic aggregates | Sonnet; emotional context, meaningful changes, concise natural language, warm nonjudgmental tone |
| 3 — Monthly reflection | Eligible closed-month report with sufficient cross-week evidence | Opus; recurring themes, significant changes and longitudinal reflection supported by source Events |
| Report fallback | Preferred report provider cannot serve an eligible operation and fallback policy permits it | GPT-6 Sol, same evidence and quality contract, renewed authorization/cost checks |

Preserve the user's Primary Garden Mood. Secondary output is limited to zero to two canonical, non-redundant labels; excluded labels and uncertain/empty input must abstain under [secondary selection rules](lib/secondary-emotion-selector.js) and [product taxonomy](lib/flower-variant-config.js). Do not replace the production taxonomy with an experimental classifier taxonomy. EventMemory extraction remains deterministic even when emotion inference fails.

For reports, do not infer personality, medical diagnoses, hidden psychological causes, or personal growth from sentiment labels or model knowledge. Distinguish recorded experiences from interpretations. A recurring theme requires multiple eligible Events; a change requires comparable observed periods. Sparse recording is not evidence that the user's life improved or worsened. Optional emotion signals must retain their provenance and must not be treated as observed clinical facts.

## 5. RAG Integration

Preserve the existing pipeline:

```text
Consented Event → deterministic EventMemory → BGE embedding (384d)
→ owner-scoped PostgreSQL pgvector retrieval → bounded evidence selection
→ grounded Weekly / Monthly narrative → report + AiEvidence persistence
```

Only Events eligible under current AI consent may contribute to input, embeddings, retrieval, aggregates, or reports. **Journal data must NEVER enter AI processing, RAG, or reports**, including Daily Grow's legacy `event` alias and `Flower.event` display copy. No Journal import/backfill, translated Journal, or Journal-derived summary is an exception.

Owner scope must be applied in the database query before similarity ranking and top-K selection. Apply source eligibility, date bounds, active embedding profile, and ready/input-revision predicates before ranking. Do not retrieve globally and filter later. Selected Event/Memory pairs and aggregate owners must match the authenticated server identity. [Retrieval implementation](lib/semantic-retrieval.js), [report input/evidence selection](lib/report-foundation.js)

Retain the exact active profile `migration-cloudflare-bge-small-en-v1.5-mean-v1`: Cloudflare BGE, 384 dimensions, cosine comparison, mean pooling, `summary-v1`, existing document construction and query prefix, and `workers-ai-mean-v1` revision metadata. Keep the local rollback profile `production-bge-small-en-v1.5-v1`, inline vectors, ONNX implementation, and profile-keyed `EventMemoryEmbedding` rows. Equal dimensions do not imply interchangeable vector spaces. [Profile registry](lib/embedding-profiles.js), [input construction](lib/embedding-input.js)

The provider's 512-token embedding input limit differs from the repository profile's 8,000-character input bound. Preserve current behavior; do not claim that character validation guarantees token fit. Any new truncation/chunking/translation strategy changes input semantics and requires separate evaluation and migration planning. Query embedding also consumes Workers AI budget. [BGE specifications][c-bge]

Retain `EventMemory`, `AiEvidence`, `AiJob`, `WeeklyReport`, and `MonthlyReport`, their owner constraints, and atomic evidence replacement. No new external memory store is required. A report cannot cite an unselected source, another owner's source, deleted evidence, or a stale source revision.

**Multilingual retrieval is a separate future phase.** Chinese narrative output does not establish Chinese BGE retrieval quality. Preserve the English production profile; do not silently translate and embed, switch to multilingual BGE, mix profiles, or re-embed history. A future proposal needs consent/input-language policy, language-specific relevance acceptance, separate provenance, bounded backfill, coexistence, and rollback. If retrieval lacks sufficient evidence, report insufficiency instead of asking a stronger LLM to fill gaps.

## 6. Weekly Report Design

**Target:** A compact reflection in the user's preferred supported language. For Chinese, aim for approximately **100–180 Chinese characters for the main reflection**, comprising one concise overview and two or three meaningful insights. Avoid repetitive filler and chronological retelling of every Event. Do not invent additional insights to satisfy a section count; return fewer when evidence is limited, or the existing insufficient-evidence outcome when the minimum is not met.

The application controls headings, status text, buttons, dates, and statistics. The model supplies only validated reflection content and citations. Every factual sentence in the overview and insights must have selected Event evidence or a supported deterministic aggregate. Suggested content is a recent moment, a genuinely repeated theme, and a meaningful week-over-week change, when each is supported.

Reuse the owner's IANA timezone, Monday-start weeks, `[start, end)` UTC query bounds, previous-period comparison, and closed-period default. Explicit partial reports retain their `PARTIAL` status and must not be compared as if complete. User-visible statistics are computed by the backend, never by token generation. [Period rules](lib/ai-periods.js), [trend computation](lib/trend-analyzer.js)

**Current gap:** The existing prompt requests English, allows up to three section claims, and has no separate overview or locale contract. The current numeric grounding grammar recognizes a narrow set of English Event-count sentences. Chinese output needs a versioned language contract and equivalent or stronger grounding; it cannot be enabled by changing the prompt alone. See section 8.

## 7. Monthly Report Design

**Target:** Approximately **250–350 Chinese characters by default**, with an overall reflection, important patterns, meaningful changes, and a grounded closing observation. Use the user's preferred supported language. These are presentation targets, not model token limits or minimum evidence requirements.

Monthly evidence must cover the relevant weeks, not just the most semantically similar cluster. Reuse current per-theme limits and deterministic current/previous-month aggregates; identify sparse coverage explicitly. Comparisons require evidence from the compared periods. A milestone requires an Event that actually records it. The closing observation may restate a supported pattern but must not promise future improvement or imply a diagnosis.

Previously generated Weekly prose is not independent evidence. If later used as a compact navigation aid, resolve its claims back to eligible Events and current aggregates before a Monthly claim is accepted. Retain current Monthly worker generation; scheduled Monthly delivery and a user-facing report UI are separate planned product work.

## 8. Structured Output Contracts

### Existing contract — CURRENTLY IMPLEMENTED

[Report narrative validation](lib/report-narrative.js) accepts a bounded `sections` array with `kind`, `claim`, `evidenceRefs` (exact `sourceEventId` / `sourceMemoryId` pairs), and `aggregateRefs`. The current adapter also accepts model metadata. Weekly kinds are `RECENT_MOMENTS`, `RECURRING_THEMES`, and `NOTABLE_CHANGES`; Monthly kinds are `MAJOR_EXPERIENCES`, `BROADER_RECURRING_THEMES`, and `MEANINGFUL_CHANGES_OR_MILESTONES`.

Current limits are 3 sections, 700 characters per claim, and 1,800 total narrative characters. Serialized input limits are 12,000 characters Weekly and 20,000 Monthly. Evidence limits are 8 / 16 selected items, 4,000 / 8,000 context characters, and minimum evidence 2 / 3 respectively. Preserve these boundaries until a reviewed contract deliberately changes them; token admission is an additional bound.

The validator checks allowed references, duplicate section kinds, unknown fields, bounded text, and a narrow deterministic numeric grammar. **Valid citations do not prove that prose follows from evidence.** Existing number-free prose checks are not a general semantic truth checker. [Recorded grounding limits](SECURITY.md#delta-p2-1-deterministic-report-grounding--2026-10-07)

### Target contract — PLANNED, versioned migration required

Keep the existing provider-neutral narrative service and report storage structures. A new generation version must define an explicit mapping from the proposed overview/insights/closing fields into the existing bounded narrative JSON, `summary`, and `AiEvidence`. Review reader compatibility before changing section counts or shapes. Old jobs retain their original contract; changing a version must never be used to evade a spent reservation.

| JSON Schema requirement | Target constraint |
| --- | --- |
| Envelope | Required contract version, report type, supported locale, grounded overview, bounded insight array, and nullable grounded closing; `additionalProperties: false` at every object level |
| Grounded text object | Required plain `text`, `evidenceRefs`, and `aggregateRefs`; at least one valid supporting reference, enforced locally |
| Insights | Maximum 3, unique approved kind; normally 2–3 Weekly, up to 3 Monthly; fewer only for evidence-limited output |
| Locale/type/version | Exact server-approved enums; must equal the request envelope; never trust a model-supplied owner, period, or permission |
| Evidence references | Exact selected Event/Memory pairs; no free-form URLs, invented identifiers, or cross-owner references; bound arrays to the selected evidence count |
| Aggregate references | Allowlisted references to immutable server snapshots; no model-created statistics or arbitrary lookup paths |
| Provider/model metadata | Set by the adapter using requested/returned provider metadata; never accepted as a narrative assertion or routing instruction |
| Maximum text | Proposed Chinese hard bounds: 250 characters Weekly and 500 Monthly across overview, insights, closing; each field also bounded by the total. Other supported locales: at most the existing 1,800-character total and 700-character claim bounds until separately specified |
| Raw response | Proposed 32 KiB maximum final JSON payload; 512 KiB maximum total provider response/stream, including non-text blocks, enforced at the transport boundary |

The 100–180 and 250–350 targets exclude UI headings, citation markers, and deterministic statistics. Specify a single Unicode-aware counting method for Chinese presentation, such as grapheme clusters including punctuation and excluding layout whitespace, and test it with emoji/combined characters. Existing JavaScript string-length checks are not equivalent. A shorter grounded report is preferable to filler. Do not incur a second model call solely to meet a preferred length.

The backend must validate JSON syntax, exact field types, enum values, lengths, evidence eligibility, and grounding independently of provider constrained decoding. Validate references against the selected immutable input snapshot, then recheck current sources, consent, owner, and claim at persistence. Refusal, truncation, an unexpected finish reason, or missing text is a rejected response, not a completed report.

Normalize only harmless representation differences: trim outer whitespace, use the approved Unicode normalization, normalize newlines, and deduplicate identical references. Render as escaped plain text. Do not strip unsupported claims, fabricate citations, coerce types, truncate away qualifications, or weaken validation to turn rejection into success.

For localized deterministic facts, prefer backend-rendered statistics and reviewed locale templates. Any quantitative prose must match approved localized grammar and exact server values. Unsupported numbers, dates, causal statements, diagnostic assertions, or contradictory trends fail closed. New factual categories require concrete validation rules and synthetic fixtures before release. A second LLM is not an automatic repair or factuality oracle.

Treat Event content as untrusted data, including instructions embedded in Events. Keep system instructions separate, allowlist input fields, disable tools/web access, and never let evidence request additional data. Citation IDs may be minimized to request-local opaque references in a future adapter only if the exact mapping back to existing provenance is preserved and validated.

## 9. Reliability and Fallback

### Durable authority and existing safeguards

Reuse [AiJob](lib/ai-jobs.js), [worker](lib/ai-worker.js), [Cost Gate](lib/ai-cost-gate.js), and [report write fence](lib/report-write-fence.js). Preserve atomic claim/lease/heartbeat checks, owner/period/version idempotency, finalized-report lookup, consent locks, source snapshots, and atomic report/evidence persistence. Queue redelivery never means permission for another inference.

Current jobs default to three execution attempts. The production report worker explicitly configures **one narrative attempt**, even though the reusable narrative service has a larger standalone default. The non-cascading reservation blocks re-inference for an already reserved operation, including after a lost lease or deletion. Do not restore historical adapter retries as part of provider integration.

### Failure policy — target admission rules

| Failure | Classification and behavior | Retry/fallback policy |
| --- | --- | --- |
| Local validation, missing consent/ownership, disabled route | No dispatch; reject or cancel with static reason | No inference retry; consent re-grant does not reopen terminal jobs |
| Application Cost Gate limit or ledger unavailable | Fail closed before dispatch | Wait for valid capacity/authorization; fallback cannot bypass the same limit |
| Account/provider budget exhausted | Admission denied; retain deterministic statistics | No switch to another billing account or provider to evade a cap |
| Provider 429 / capacity refusal | Classify using documented response and transport stage | Honor `Retry-After` only when definitively unprocessed; otherwise hold as ambiguous |
| Connection/transport failure known not to reach provider | Only classify this way with trustworthy pre-dispatch evidence; a generic fetch error is insufficient | At most two additional durable scheduling attempts with bounded exponential backoff/jitter, within the three-execution policy and deadline |
| Timeout, reset after sending, Gateway 5xx, lost response | Possibly processed and billed; outcome ambiguous | Preserve reservation; no automatic replay or fallback; a client abort does not prove provider cancellation |
| Completed response with invalid JSON/schema, refusal or truncation | Inference completed or potentially billed; output unusable | No automatic repair call/fallback; retain reservation and sanitized failure code |
| Grounding violation | Reject narrative and citations | Terminal for that generation attempt; no weaker validator or re-prompt loop |
| Provider outage detected before dispatch | Circuit open; do not consume provider capacity unnecessarily | Authorized alternative may be selected before sending, after provider consent and budget checks |
| Duplicate job/lease loss/stale source | Current claim/source checks govern; finalized output is reused only when still authorized | No second inference; stale executor cannot write |
| Persistence failure after response | Provider work must not be repeated merely to repair storage | Controlled persistence-only recovery requires retained valid result and fresh final fences; otherwise remain unavailable |

Current reservations are conservative and are not automatically refunded even for a pre-dispatch failure. The proposed safe-retry classification needs reviewed durable evidence and an explicit reconciliation path; **until implemented, retain the current no-replay behavior after reservation**. A new idempotency key, process restart, account deletion, or lease reclaim is not reconciliation.

A future recovery action must record the original attempt outcome, authorized actor, reason, provider, reserved maximum spend, and link to the same logical job. An ambiguous attempt stays charged/reserved until conclusively reconciled. If a human authorizes a new attempt despite unresolved billing, retain the original liability and reserve additional spend; this is exceptional recovery, not automatic fallback.

### Fallback admission

Default fallback is off. Once separately enabled, OpenAI can serve an operation only if the user disclosure/consent covers that processor, the owner and source still qualify, the preferred attempt is known unprocessed or no attempt occurred, and the existing logical job has an approved provider-aware reservation. Reserve for the permitted route before sending. Limit the logical operation to one preferred provider and at most one explicitly permitted fallback; there must be no fallback loop. A billed/ambiguous/validation-rejected attempt is excluded from automatic fallback regardless of remaining budget.

SDK automatic retries, Gateway retries, and dynamic route fallback must not multiply backend attempts. Cloudflare documents configurable retry controls, but their chosen configuration and exact one-upstream-attempt behavior require acceptance before activation. [Gateway request handling][c-retries]

### User-visible failure state

Preserve correct deterministic statistics and any valid existing report; never store canned prose as `GENERATED`. Existing narrative outcomes are `NOT_GENERATED`, `GENERATED`, and `INSUFFICIENT_EVIDENCE`; jobs carry their own pending/running/failed/cancelled status. Map these to truthful application-owned pending, insufficient-evidence, or unavailable wording without inventing database enum values.

The current worker does not persist a newly successful report when narrative generation fails. A future statistics-only presentation/persistence path must reuse deterministic builders, distinguish narrative availability, and preserve the atomic/finalized-write rules. Pending/unavailable UI and authorized recovery are planned, not claims about current production screens.

## 10. Performance and Cost

### Verified unit prices — 2026-10-13

Standard synchronous text pricing, no discounts, no tools, and short inputs as budgeted below. Anthropic prices: [official API pricing][a-price]. OpenAI prices: [GPT-6 Sol][o-sol] and [API pricing][o-price]. Cloudflare embedding prices: [Workers AI pricing][c-ai-price].

| Model | Input / 1M tokens | Output / 1M tokens | Cached input / 1M | Cache writes / 1M |
| --- | ---: | ---: | ---: | ---: |
| Haiku 5.5, input ≤100,000 tokens | $0.10 | $0.50 | $0.01 | $0.125 (5 min), $0.20 (1 hour) |
| Sonnet 5.5 | $2.00 | $10.00 | $0.10 | $2.50 (5 min), $4.00 (1 hour) |
| Opus 5.5 | $4.00 | $20.00 | $0.20 | $5.00 (5 min), $8.00 (1 hour) |
| GPT-6 Sol | $2.00 | $10.00 | $0.20 | $2.50 |
| BGE Small EN v1.5 | $0.0202 (model card; pricing table rounds to $0.020) | Not applicable | Not assumed | Not assumed |

Haiku input above 100,000 tokens costs $0.50/M input and $2.50/M output. GPT-6 Sol input above 272,000 tokens uses higher whole-request rates; neither long-context tier is admitted by this proposal. Cache discounts are not assumed in estimates. Pricing must be refreshed before implementation/rollout and when provider/model/tier changes; regional, premium processing, cache writes, and taxes can change the bill. [Anthropic pricing][a-price], [OpenAI pricing][o-price]

Workers AI documents 10,000 free Neurons per day and $0.011 per 1,000 additional Neurons on Workers Paid. BGE is listed at 1,841 Neurons per million input tokens. The [model card][c-bge] lists $0.0202/M input tokens while the platform table rounds this to $0.020/M; estimates below use $0.0202. Neuron conversion and rounding mean neither display is a precise billing cap. No Anthropic/OpenAI token allowance comes from those Neurons. Gateway core analytics, caching and rate limiting are documented as free. Logging charges/retention depend on account eligibility; new customers from 2026-09-24 use Workers Logs pricing. Optional Unified Billing adds a 5% credit-purchase fee and is not selected here. Do not assume the entire access layer is free. [Workers AI pricing][c-ai-price], [Gateway pricing][c-gateway-price]

### Proposed request budgets and estimates — NOT configured

Input budgets include instructions, schema overhead and evidence. Output budgets include **all billed output, including reasoning/thinking**, not just displayed characters. Use provider-specific token counting/admission without making an inference call during documentation work. Character counts alone are not token budgets.

| Operation | Illustrative input / billed output tokens | Estimated model cost | Proposed hard input / output token admission |
| --- | ---: | ---: | ---: |
| Event secondary emotions, Haiku | 1,000 / 256 | $0.000228 | 4,096 / 512 |
| EventMemory embedding, BGE | 256 / — | $0.0000051712 before free allowance | Existing profile; provider max 512 input |
| Weekly, Sonnet | 4,000 / 2,000 | $0.028 | 8,192 / 4,096 |
| Monthly, Opus | 8,000 / 4,000 | $0.112 | 16,384 / 8,192 |
| Weekly fallback, GPT-6 Sol | 4,000 / 2,000 | $0.028 | Same Weekly admission |
| Monthly fallback, GPT-6 Sol | 8,000 / 4,000 | $0.056 | Same Monthly admission |

Formula: `(input tokens × input price + billed output tokens × output price) / 1,000,000`. One illustrative Event with emotion plus embedding costs approximately **$0.00023317**; local extraction has no per-token API fee, but backend/storage compute is not free. Each report may additionally embed a retrieval query; a 128-token BGE query adds approximately **$0.0000025856**. Include every actual query and any separately authorized recovery in accounting.

At the proposed hard token admission sizes, base-rate reservation estimates are $0.0006656 for Haiku, $0.057344 for Weekly Sonnet, $0.229376 for Monthly Opus, and $0.114688 for Monthly GPT-6 Sol. These figures are planning arithmetic, **not guaranteed billing caps**. Account for hidden output, provider tokenizer changes, overhead, rate changes, concurrent reservations, and unresolved attempts. Do not lower report quality merely to shave tiny costs; change a budget only through an explicit reviewed policy.

### Cost admission and capacity

**Current:** [PrismaAiCostGate](lib/ai-cost-gate.js) serializes reservations in shared PostgreSQL `AuditEvent`. Defaults are 4 Weekly operations/user/day, 2 Monthly, 200 embedding, 100 Event emotion; report reservations count 2 calls for retrieval plus narrative. The default user call budget is 300/day; global and provider call budgets are each 10,000/day. Windows use UTC. These are source defaults, not inspected live values. Zero disables admission. Reservations survive deletion and block duplicate inference. The provider label is currently `CLOUDFLARE_WORKERS_AI`; this is not a multi-provider dollar ledger.

**Planned:** Extend this shared admission boundary, not process-local counters. Reserve provider-specific worst-case token spend before dispatch and reconcile trusted usage afterward. Track user daily/monthly USD ceilings, global daily/monthly USD ceilings, provider/account ceilings, call quotas, and outstanding ambiguous liability. Budgets cover all authorized consumers of the billing account; if external consumers cannot be included, reserve headroom and do not claim a global hard cap. Unavailable accounting fails closed. Existing call limits stay in force alongside dollar limits.

Proposed rollout policy: start with allowlisted consenting users and explicitly approved account/user USD ceilings; unset ceilings or a disabled provider permit no new-provider traffic. Finance/product must select numeric ceilings before activation from expected population and authorized report cadence. No amount is silently configured by this document. Use provider-side budgets/alerts as a second line of defense, not proof that every in-flight request will be rejected at a dollar threshold.

### Latency and timeout policy

Current code defaults to 3 seconds for Event secondary emotion and 20 seconds for report narrative. AiJob leases default to 60 seconds with renewal around every third of the lease. These are implementation defaults, not measured production latency. [Emotion adapter](lib/event-emotion.js), [worker](lib/ai-worker.js)

Proposed acceptance targets: Event emotion p95 within 3 seconds (5-second application deadline); Weekly generation p95 within 30 seconds (60-second provider deadline); Monthly p95 within 60 seconds (120-second provider deadline). They are product SLO proposals, not provider guarantees or benchmark results. Event creation must remain usable if optional emotion is unavailable; reports run asynchronously with truthful status.

Budget connection/setup, Gateway, provider, parsing, persistence, and cold-start time separately. Set the inner provider/Gateway timeout below the backend operation deadline and below the enclosing executor transport deadline; continue heartbeats throughout execution and abort on lost authorization/claim. Do not extend the current timeouts until that complete chain is reviewed. Deadline expiry remains ambiguous for billing.

Use bounded provider-specific concurrency, RPM/TPM admission, queue backpressure, and a circuit breaker driven by sanitized errors. Reserve capacity for interactive emotion requests separately from reports. Provider/model/account limits are finite and account-specific; no unlimited capacity or guaranteed availability is assumed.

Monitor task, route/model, schema version, queue age, stage latency, estimated/reserved/actual token cost, outcome code, validation rejection, and circuit status. Keep internal owner accounting in the authorized database. Do not export owner IDs, Firebase UIDs, Event identifiers/text, prompts, outputs, or evidence into provider diagnostics. Gateway cost estimates must be reconciled with provider billing, especially for newly released models.

## 11. Privacy and Security

The target preserves [existing trust boundaries](SECURITY.md#architecture--trust-boundaries) and [consent rules](LONG_TERM_AI.md#11-privacy--security). The client never supplies authoritative ownership. Verify Firebase identity on Render and derive the internal owner server-side. Private memories, reports, jobs and evidence require owner authorization on reads and writes; use private/no-store responses.

Long-term memory/reports require current AI processing, personalization, and memory consent plus per-Event eligibility. Existing Event emotion requires its applicable AI-processing consent; do not conflate this with memory permission. Recheck consent before dispatch and at final persistence. A revoke cancels/disqualifies work and blocks late writes; a re-grant does not silently reprocess historical Events or reopen cancelled keys. Provider fallback needs disclosed processor authorization as well as these existing checks.

Before activation, disclose that minimized eligible Event content is processed by Cloudflare and the selected Anthropic/OpenAI provider, for what purpose, in which approved regions, and under what retention/deletion terms. A private report can contain sensitive personal material even without a name. Use only selected summaries and necessary aggregates; exclude emails, Firebase identifiers, unrelated Events, Journal, chat history, and raw database rows.

Approved secret stores must hold server-only credentials, separately for TEST and production. Proposed placement is Render's approved secret configuration for backend provider/Gateway authentication; using Cloudflare stored keys instead requires its own review. Never put credentials in client bundles, source, model input, `.env` examples with values, logs, or PRs. Human operators handle secret values under [WARNING.md](WARNING.md). Do not retrieve existing secrets to complete this design.

Gateway logging is on by default according to Cloudflare. Require payload logging off, with `cf-aig-collect-log-payload: false` where supported; metadata must also pass an allowlist. If that cannot be demonstrated, disable log collection entirely. Disable Gateway response caching and use `cf-aig-skip-cache: true` as defense in depth; a bypass header alone is not evidence that all storage is off. Verify SDK/APM/log-export paths too. Keep only sanitized metrics, never raw provider errors or reasoning blocks. [Logging][c-logs], [caching][c-cache]

Provider retention is separate from Gateway retention. Review Anthropic's actual organization/feature agreement; ZDR eligibility is not proof of an enabled agreement. For OpenAI Responses, plan `store: false`; this does not eliminate default abuse-monitoring retention or all caching. OpenAI documents up to 30-day abuse monitoring and endpoint-specific application-state rules. Confirm approved retention, region, training/data-sharing settings, and deletion obligations before private traffic. Do not claim universal zero retention. [Anthropic data retention][a-data], [OpenAI data controls][o-data]

Preserve Event/account deletion cascades, report invalidation when cited Events disappear, `AiEvidence` lifecycle, and final source fences. Existing profile/vector storage remains deletable with its source. Minimal non-content cost reservations must remain compatible with the existing non-cascading audit policy so deletion cannot buy another inference. New external storage of Events/reports is not part of this architecture. Document any provider retention that outlives local deletion; do not promise that deleting a row recalls an already delivered provider request.

This documentation introduces no verified security fix or provider status change. `SECURITY.md` and `MANUAL_SECURITY_CHECKLIST.md` therefore remain unchanged. Future implementation/configuration work must record its meaningful new evidence there without replacing historical records.

## 12. Implementation Roadmap

Phase 1 abstraction source is implemented in a separate follow-up PR, as recorded in [LONG_TERM_AI.md](LONG_TERM_AI.md#phase-1-gateway-provider-abstraction--2026-10-13); activation remains pending. Phases 2–6 below remain **PLANNED**. Existing environment names are listed to identify integration points; proposed names are design candidates only, with **no values**. Do not edit deployment configuration while reviewing this document.

### Phase 1 — Gateway abstraction and configuration design

- **Modules:** `lib/report-narrative.js`, `lib/event-emotion.js`, `lib/ai-cost-gate.js`, `lib/ai-worker.js`; a small provider adapter boundary if needed. Preserve `cloudflare-worker/src/index.js` embedding path.
- **Proposed names:** `AI_GATEWAY_ENABLED`, `CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID`, `CLOUDFLARE_AI_GATEWAY_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_USER_DAILY_USD_LIMIT`, `AI_USER_MONTHLY_USD_LIMIT`, `AI_GLOBAL_DAILY_USD_LIMIT`, `AI_GLOBAL_MONTHLY_USD_LIMIT`, `AI_ANTHROPIC_MONTHLY_USD_LIMIT`, `AI_OPENAI_MONTHLY_USD_LIMIT`.
- **Compatibility/security:** Native provider request/response adapters; default off; fixed endpoint allowlist; provider-aware reservations and usage; separate secret stores; logging/cache policy; no SDK/Gateway retry bypass. Reuse existing call limits and Worker authentication.
- **Rollback:** Disable Gateway routing; keep previous adapters, reservations, and embedding profiles. Do not refund or replay attempted operations.
- **Approval:** Architecture/contract and billing/privacy review before code activation; explicit human authorization for each provider account, secret/configuration change and paid acceptance request. This phase's design alone authorizes none of those actions.

### Phase 2 — Lightweight Event emotion routing

- **Modules:** `lib/event-emotion.js`, `lib/secondary-emotion-selector.js`, Event route integration in `server.js`, `lib/ai-cost-gate.js`; credential-free provider contract tests.
- **Proposed names:** `AI_EVENT_EMOTION_PROVIDER`, `AI_EVENT_EMOTION_MODEL`; reuse `AI_REQUEST_TIMEOUT_MS`, `AI_EVENT_EMOTION_DAILY_LIMIT` and shared budget controls.
- **Compatibility/security:** Haiku only; current consent, Event length bounds, primary mood, label taxonomy, exclusion rules and zero-to-two selection unchanged. Preserve Event creation/idempotency and deterministic memory extraction when inference fails. Validate provider metadata without exporting user identifiers.
- **Rollback:** Return to the previously authorized Workers AI emotion route or abstain; no retrospective reclassification or duplicate Event write.
- **Approval:** Explicit implementation/cutover approval for emotion only, bounded synthetic paid acceptance if needed, then approval for the exact release. No report-model escalation or model comparison experiment.

### Phase 3 — Sonnet Weekly narrative integration

- **Modules:** `lib/report-narrative.js`, `lib/report-foundation.js`, `lib/ai-worker.js`, `lib/report-write-fence.js`, `lib/ai-periods.js`, `lib/trend-analyzer.js`, and report readers only where contract compatibility requires it.
- **Proposed names:** `AI_WEEKLY_REPORT_PROVIDER`, `AI_WEEKLY_REPORT_MODEL`, `AI_WEEKLY_REPORT_TIMEOUT_MS`, `AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS`, `AI_REPORT_SUPPORTED_LOCALES`; reuse `AI_WEEKLY_REPORT_DAILY_LIMIT`.
- **Compatibility/security:** Version the new schema, supported locale and grounding policy; keep the existing Weekly trigger, period uniqueness, selected evidence, consent/source fence, and atomic writes. Validate overview and insight citations. Chinese release is blocked until localized factual validation is accepted; multilingual retrieval remains separate.
- **Rollback:** Stop new Sonnet admissions, preserve valid saved reports, and use the old compatible renderer/adapter where authorized. Do not overwrite finalized reports or reopen their jobs.
- **Approval:** Product acceptance of brevity/tone/locale, security acceptance of grounding and privacy, exact budget/route approval, and a separately scoped paid acceptance and release decision.

### Phase 4 — Opus Monthly narrative integration

- **Modules:** Monthly branches of the same report modules, evidence selection and existing worker handler; no automatic scheduler addition.
- **Proposed names:** `AI_MONTHLY_REPORT_PROVIDER`, `AI_MONTHLY_REPORT_MODEL`, `AI_MONTHLY_REPORT_TIMEOUT_MS`, `AI_MONTHLY_REPORT_MAX_OUTPUT_TOKENS`; reuse `AI_MONTHLY_REPORT_DAILY_LIMIT`.
- **Compatibility/security:** Account for always-on thinking; validate cross-week coverage, previous-month comparison, closing observation, and sparse-data behavior. Preserve Monthly period keys, original Event provenance, and 384d retrieval.
- **Rollback:** Disable new Opus admissions, retain deterministic statistics and saved valid reports; use an explicitly approved compatible previous route or unavailable state.
- **Approval:** Monthly content/coverage acceptance plus provider capacity, spend, exact release, and any bounded paid acceptance authorization. No new schema migration unless separately reviewed and approved.

### Phase 5 — OpenAI fallback and durable recovery

- **Modules:** Provider router/adapters, `lib/ai-cost-gate.js`, `lib/ai-jobs.js`, `lib/ai-worker.js`, `lib/report-write-fence.js`, existing audit metadata and private status APIs.
- **Proposed names:** `AI_REPORT_FALLBACK_ENABLED`, `AI_REPORT_FALLBACK_PROVIDER`, `AI_REPORT_FALLBACK_MODEL`, `AI_REPORT_FALLBACK_MAX_ATTEMPTS`; reuse OpenAI credentials and all shared/user/account limits.
- **Compatibility/security:** Keep fallback off until durable attempt classification, provider consent, usage accounting, non-replay behavior and controlled recovery exist. Preserve `AiJob` as authority; any required additive persistence change gets a separate migration review. Simulate 429, outage, before/after-send timeout, malformed JSON, grounding failure, duplicate delivery, lost lease and deletion races without paid inference.
- **Rollback:** Disable fallback/recovery admission immediately, retain original reservations and statuses, and drain only safe already-authorized work. No reset of ambiguous jobs or audit rows.
- **Approval:** Explicit cross-provider processing and fallback policy authorization; a new billed recovery needs its own approved liability/reservation. Exact release and any migrations require separate scoped approval.

### Phase 6 — Production acceptance and controlled rollout

- **Modules:** Focused provider/report/cost/consent regression tests, approved release configuration, safe operational metrics, and affected readers. Follow [integration/deployment SOP](INTEGRATION_DEPLOYMENT.md).
- **Names:** Review only the phase-specific names above and existing `CLOUDFLARE_WORKER_AI_URL`, `CLOUDFLARE_WORKER_AI_TOKEN`, `AI_ASYNC_EXECUTION_MODE`, `AI_USER_DAILY_CALL_LIMIT`, `AI_GLOBAL_DAILY_CALL_LIMIT`, `AI_PROVIDER_DAILY_CALL_LIMIT`. Preserve dispatcher/executor secret bindings; do not repurpose them as provider credentials.
- **Compatibility/security:** Credential-free synthetic contract tests first; then only explicitly authorized bounded integration/provider acceptance. Verify token/schema compatibility, privacy-safe metadata, one upstream attempt, budget denial, owner isolation, revoke/delete races, deterministic statistics, locale limits, and rendering. Reuse prior equivalent evidence; no unnecessary A/B or broad repeated audit.
- **Rollout/rollback:** Start with approved allowlisted consenting users, finite concurrency and USD ceilings; expand only after accepted quality/error/latency observations. Roll back admission on privacy leakage, grounding regression, wrong model, repeated ambiguous calls or spend overruns. Preserve evidence, existing reports, local vectors, and prior compatible release artifacts. Rollback deployment itself requires authorization under the SOP.
- **Approval:** Human sign-off on exact source SHA, service, model IDs, region/retention, budgets, feature flags, acceptance request count, and rollback procedure. A docs PR, green CI, or prior model availability check is not production authorization.

## 13. Current vs Target Architecture

| Concern | CURRENTLY IMPLEMENTED / recorded baseline | TARGET / PLANNED |
| --- | --- | --- |
| Event-only boundary | Journal excluded; Firebase ownership and consent/source guards | Preserve across every new provider and fallback |
| Extraction | Deterministic backend extractor | Unchanged |
| Embeddings | Cloudflare BGE 384d active profile, local rollback profile retained | Unchanged; multilingual retrieval separate |
| Retrieval | Owner/profile/source-scoped pgvector and bounded evidence | Preserve; stronger model does not expand data access |
| Emotion | Workers AI Llama route and deterministic secondary selection | Haiku through Gateway after approval |
| Reports | Workers AI Llama 3.3 70B default; bounded English section contract | Sonnet Weekly / Opus Monthly, localized validated content |
| Factual validation | Citation/shape checks and narrow English numeric grammar | Reviewed locale/fact contracts; no claim of universal semantic proof |
| Job execution | Durable PostgreSQL AiJob, Queue dispatch, private Render executor | Same authority, provider-aware attempt/recovery policy |
| Cost | Shared call reservations, non-replay, one Workers AI provider label | Preserve plus per-provider token/USD reservations and reconciliation |
| Fallback | No approved Anthropic/OpenAI automatic fallback path | Default-off GPT-6 Sol route, strict eligibility and budget checks |
| Report availability | Atomic generated/insufficient results; failed narrative is not successful persistence | Truthful pending/unavailable presentation and compatible statistics-only path |
| UI/scheduling | Report reads and Weekly trigger; Monthly worker; no report UI/scheduler claimed | Separate reviewed presentation work; no implicit scheduling |
| Deployment evidence | Existing dated production checkpoints in canonical docs | Exact-model Gateway acceptance still unverified; no live changes in this task |

Implementation comparisons are based on the repository baseline named above, with [LONG_TERM_AI.md](LONG_TERM_AI.md) and [SECURITY.md](SECURITY.md) for historical production evidence. `main`, Render Live, and Cloudflare's deployed sources can differ. No claim here substitutes for release-specific verification.

## 14. Official References

All links below were consulted on **2026-10-13**. Public documentation establishes published capabilities/prices, not customer entitlement, contracted retention, or an end-to-end PetalPal result. Refresh affected references before activation.

| Reference | Scope |
| --- | --- |
| [Anthropic model overview][a-models] | Current model names and native identifiers |
| [Haiku 5.5][a-haiku] | Limits and request-setting constraints |
| [Sonnet 5.5][a-sonnet] | Limits and request-setting constraints |
| [Opus 5.5][a-opus] | Limits and always-on thinking |
| [Anthropic structured outputs][a-json] | Supported models, JSON Schema contract and limitations |
| [Anthropic API pricing][a-price] | Standard input/output and cache prices |
| [Anthropic API retention][a-data] | Organization/model/feature-dependent retention |
| [OpenAI GPT-6 Sol][o-sol] | Exact requested model, capabilities and limits |
| [OpenAI API pricing][o-price] | Pricing tiers and billing qualifications |
| [OpenAI data controls][o-data] | Storage, abuse monitoring and retention exceptions |
| [Cloudflare Anthropic route][c-anthropic] | Native Messages endpoint and authentication |
| [Cloudflare OpenAI route][c-openai] | Native Responses endpoint and authentication |
| [Cloudflare BGE model][c-bge] | 384-dimensional embeddings and 512-token input |
| [Workers AI pricing][c-ai-price] | Neurons, allowance and BGE token price |
| [AI Gateway pricing][c-gateway-price] | Gateway feature and logging costs |
| [AI Gateway logging][c-logs] | Metadata-only payload suppression |
| [AI Gateway caching][c-cache] | Response caching and bypass controls |
| [AI Gateway request handling][c-retries] | Timeout and retry controls |

[a-models]: https://platform.claude.com/docs/en/models/overview
[a-haiku]: https://platform.claude.com/docs/en/models/haiku-5-5/overview
[a-sonnet]: https://platform.claude.com/docs/en/models/sonnet-5-5/overview
[a-opus]: https://platform.claude.com/docs/en/models/opus-5-5/overview
[a-json]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
[a-price]: https://platform.claude.com/docs/en/about-claude/pricing
[a-data]: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
[o-sol]: https://developers.openai.com/api/docs/models/gpt-6-sol
[o-price]: https://developers.openai.com/api/docs/pricing
[o-data]: https://developers.openai.com/api/docs/guides/your-data
[c-anthropic]: https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/
[c-openai]: https://developers.cloudflare.com/ai-gateway/usage/providers/openai/
[c-bge]: https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/
[c-ai-price]: https://developers.cloudflare.com/workers-ai/platform/pricing/
[c-gateway-price]: https://developers.cloudflare.com/ai-gateway/reference/pricing/
[c-logs]: https://developers.cloudflare.com/ai-gateway/observability/logging/
[c-cache]: https://developers.cloudflare.com/ai-gateway/features/caching/
[c-retries]: https://developers.cloudflare.com/ai-gateway/configuration/request-handling/

## 15. Decision Log

| Date | Decision | Reason / consequence |
| --- | --- | --- |
| 2026-10-13 | Retain the owner's Haiku → Sonnet → Opus task hierarchy and GPT-6 Sol report fallback | Quality and grounding lead; all requested names/IDs are documented, with deployment gates still open |
| 2026-10-13 | Separate Workers AI embeddings from AI Gateway third-party generation | Different APIs, credentials, billing and privacy controls; no model-string-only migration |
| 2026-10-13 | Preserve deterministic extraction, active English BGE 384d profile, pgvector, and local rollback corpus | Narrative upgrades must not disturb accepted retrieval/provenance behavior |
| 2026-10-13 | Treat localized output, dollar accounting, and fallback recovery as planned work | Current English grounding and call-count reservations cannot certify those target capabilities |
| 2026-10-13 | Keep ambiguous/billed requests out of automatic retry/fallback | Durable jobs and reservations must prevent duplicate charges and writes |
| 2026-10-13 | Keep Journal excluded and all source/owner/consent/deletion boundaries authoritative | Provider quality does not expand processing permission |
| 2026-10-13 | Publish documentation for review only | No model experiments, application edits, production changes, or PR #37 merge; further implementation requires a separate task |
