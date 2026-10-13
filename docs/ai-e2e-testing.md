# AI E2E testing: TEST-only clock, fixtures and limits

## What it does

The suite runs a fixed set of Events through the whole AI pipeline at simulated
dates in September to November 2026 (America/Vancouver):

Event → Flower → EventMemory → embedding → pgvector retrieval → Weekly/Monthly report → saved report API.

The OS clock is never changed and global `Date` is never patched. Simulated time
comes from two places only:

- The `X-PetalPal-Simulated-Time` header, accepted only behind the server gate.
- An injected `reportAsOf` for the worker, used in tests.

## Isolation

| Layer | Control |
|---|---|
| Client | The TEST date exists only in `__DEV__` builds (`mobile/src/services/testClock.ts`). It is shown as a red "TEST DATE" badge and Event notice, can be reset to the device date, and is lost on reload. Release builds never send the header. |
| Server | `lib/simulated-time.js` checks every request (see `SECURITY.md`, 2026-10-12). It denies production, hosted integration, Render, non-localhost or non-`test` databases, the production Firebase project, non-manual dispatch, and non-allowlisted identities. A denial returns 403 before any write. |
| Reports | Closed-period checks still run, against the simulated `asOf`. There is no production Monthly trigger or scheduler; Monthly jobs are created only inside the test. |
| Embeddings | The `test-deterministic-384-v1` profile is `TEST_ONLY` and is refused in any `NODE_ENV=production` process. |
| Database | `.github/workflows/ai-e2e-postgres.yml` creates a disposable `pgvector/pgvector:pg17` service container (`petalpal_ai_e2e_test`), migrates it, and deletes it at the end of the job. The suite refuses to run if the database holds any user whose id does not start with `fx-`. Before and after the migration, `scripts/verify-ai-e2e-database.mjs` fails the job unless all of these hold: it is running inside GitHub Actions, `NODE_ENV=test`, `DATABASE_URL` and the hosted-environment markers are unset, the URL is exactly `127.0.0.1:5432/petalpal_ai_e2e_test` (and is the database the application resolver selects), the connected database has that name, and the database is fresh. `scripts/verify-ai-e2e-counts.mjs` fails each test step unless the exact expected number of tests pass with zero failed, skipped, todo or cancelled tests. |
| Credentials | None. No repository secrets or environments are used. The Firebase token verifier is stubbed. |

## Fixtures

The fixtures are defined in `test/fixtures/ai-e2e-manifest.json`:

- Four synthetic owners, `fx-owner-a` to `fx-owner-d`, using `example.test` emails.
- Twenty Events with exact UTC instants, covering week, month and DST boundaries.
- A duplicate Event, an owner-B decoy and an insufficient-evidence week.
- A probe Event (b02) whose embedding is deliberately never generated.

The manifest also lists the expected counts, comparisons, evidence and citations.
`test/back/simulated-time.test.js` re-derives every date, period membership and
expected selection using the real period, aggregate and evidence-selection code,
so a wrong manifest fails before any database run.

## Providers and limits

- **Embeddings: MOCK.** A fixed lexical-theme table maps text onto 384-dimension basis vectors. This tests storage, ordering, owner and window filters, the no-fallback behaviour and provenance. It is **not** evidence of semantic relevance: a paraphrase matches only if it shares a listed keyword.
- **Narrative: MOCK.** A template that cites the evidence it is given. It shows the citation and write-fence path, not narrative quality.
- **Cost:** 0 inference calls and $0.
- **Reflection UI:** `reflection.tsx` visual rendering is not exercised. T09 checks the list and detail API contract that the UI reads.
- **Not yet proven:** semantic relevance needs a separate, version-pinned real-embedding benchmark run with an approved provider, call ceiling and cost ceiling.
