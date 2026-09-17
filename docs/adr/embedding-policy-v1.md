# ADR: Embedding Policy v1

- Date: 2026-09-16
- Status: Accepted for M1 policy and contract work
- Scope: Phase 0 authorization/privacy policy and Phase 1 deterministic input/provider contracts

## Decision

Long-term AI source data is limited to provenance-validated, user-authored
`EventMemory` derived from `Event`. Journal, Daily Grow `journalText`, the
legacy `event` alias, `Flower.event`, arbitrary free text, and any
unprovenanced memory-shaped object are not valid embedding inputs.

The current consent mutation entrypoint is `PUT /users/:userId/ai-consent`
in `server.js`. Long-term AI processing is allowed only when the current
server-side consent record has all three flags true:

```text
aiProcessing && personalization && memoryEnabled
```

Missing consent or any false flag means `DENY`. An Event creation-time
consent snapshot is useful for job eligibility, but it does not replace a
current authorization check at processing or retrieval time.

## Consent revoke

After revoke, new `MEMORY_EXTRACTION` and `EMBEDDING_GENERATION` work is
denied. Semantic, keyword, and metadata memory retrieval are also denied.
No fallback may bypass the current consent check.

The privacy-preserving target behavior is to retain the original Event while
cleaning derived EventMemory and its embeddings. Report/evidence cleanup
semantics must be reconfirmed before future report wiring. M1 does not
implement cleanup.

## In-flight work

The target contract is that revoke prevents an old task from committing
derived data, including after revoke followed by regrant. The planned
mechanism is a monotonic `processingEpoch`; the provider request must not hold
a database transaction. A request already sent to a provider may be
best-effort aborted, but sent data cannot be claimed to be retrieved.

M1 records this policy only. It does not add schema, epochs, cleanup, or
provider calls.

## Reauthorization and historical events

Regrant does not automatically resume old jobs, restore vectors, or backfill
historical Events. Future backfill requires explicit user action and an
approved scope, with correct owner, currently valid three-flag consent, an
Event creation snapshot of `memoryProcessingAllowed=true`, and no conversion
of old Journal/legacy aliases into Events.

## Retrieval authorization contract

Future retrieval must: derive owner from authenticated server identity; reject
client-supplied owner; check current consent before query embedding/provider
calls; apply owner scope again in SQL; and re-check authorization epoch before
returning results. Retrieval is not implemented in M1.

## Phase 1 embedding contracts

`summary-v1` serializes only normalized summary. `structured-v1` serializes
only normalized summary, deduplicated/sorted topics, and deduplicated/sorted
people. Both use Unicode NFC, newline normalization, trim, fixed field order,
fixed compact serialization, and SHA-256 over version plus canonical content.
Owner IDs, database IDs, timestamps, raw Event text, Journal, and emotion
fields are excluded.

The profile registry is server-side and allowlisted. M1 has one
`TEST_ONLY` deterministic profile (`test-deterministic-v1`, 8 dimensions,
cosine, fixed revision). At the M1 checkpoint, no production embedding profile
was selected.
Provider contracts support document/query separation, abort signals, timeout
and provider-failure outcomes, ordered batches, dimensions, revision, usage,
and cost metadata. The test double performs no network calls.

## Consequences

This ADR establishes a narrow, deterministic input boundary before production
model selection. M1 intentionally did not implement pgvector, HNSW, worker
integration, backfill, benchmarking, real providers, or semantic retrieval.

## 2026-09-17 English production-candidate amendment

Phase 1 is English-only. The English dev benchmark compared three fixed local
ONNX candidates and both existing input versions. `bge-small-en-v1.5` with
`summary-v1` is selected as production candidate profile
`production-bge-small-en-v1.5-v1` (384 dimensions, cosine, q8 local inference).

The decision is based on aggregate retrieval quality plus slice balance:
compared with keyword, BGE improves Recall@1, Recall@3, Recall@5, and MRR while
remaining materially stronger than E5 on hard-negative and multi-plausible
queries. Local inference has zero per-call API fee; CPU/model-cache costs remain
deployment costs. This amendment does not authorize pgvector integration,
backfill, multilingual retrieval, or held-out evaluation.
