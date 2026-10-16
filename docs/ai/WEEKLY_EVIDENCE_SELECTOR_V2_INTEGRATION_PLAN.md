# Weekly Evidence Selector V2 — controlled Integration test proposal

**Prepared for owner review; execution is not authorized.** Runtime reference:
`dac2b512c996ed396be33cd69d3330790b7798c5`. Its accepted Node 24.21.0 evidence
is 366 tests per flag state natively and 233 per state in the Linux image.
[Readiness report](WEEKLY_EVIDENCE_SELECTOR_V2_READINESS.md).

The selector remains technically ready for a controlled test. **Hosted execution
is gated** on the live TEST baseline/resource read-back, source compatibility,
and a reviewed bounded execution harness. This proposal changes documentation
only. No deployment, flag activation, hosted setting/database change or inference
was performed. Historical evidence and consumed ledgers remain intact.

## 1. Inspection and exact intended target

| Component | Intended Integration target | Inspection status |
|---|---|---|
| Render backend | `petalpal-backend-test`, `srv-db4q7bflk1mc73fkuf90`; `https://petalpal-backend-test.onrender.com` | Service ID/name are recorded repository evidence; current deployment/configuration not independently read back |
| Source / image | Exact subsequently reviewed TEST candidate; `Dockerfile.backend`, `node:24.21.0-bookworm-slim`, `/app` | Source configuration inspected; actual live TEST SHA/image remain required |
| Startup | `/bin/sh /app/scripts/start-integration-backend.sh` | Script runs guard, then `npm start` (Prisma migration deploy, then server); live override not verified |
| Firebase | `petalpal-integration-test`; dedicated verified TEST identities | Historical environment mapping; current binding and test-user eligibility pending secret-free operator confirmation |
| PostgreSQL | Separate Prisma Postgres resource historically named `petalpal_integration`, recorded region `us-west-1`; marker `petalpal_environment.marker = integration` | Actual resource ID/binding/schema baseline pending; shared hostname or display name cannot prove identity |
| Web, if needed for authenticated reads | `petalpal-web-integration`; `https://petalpal-web-integration.petalpal-jx.workers.dev`, existing Worker-level Access | Existing mapping; no Web build/deploy/Access change needed for this backend experiment |
| AI route, optional paid phase | Dedicated Integration Anthropic credential and Integration AI Gateway binding, native `claude-sonnet-5-5` | Exact Gateway account/resource ID and isolation/retention entitlement must be attested before use; no production credentials |

Production exclusions are `PetalPal_v2` / `srv-d983eguq1p3s73fnk1m0`,
`https://petalpal-v2.onrender.com`, `petalpal-b212c`, `petalpal-web-production`,
and `https://app.jastrevia.com`. None is an experiment target. Do not infer the
Prisma target from `db.prisma.io` or `/postgres`.

Fresh read-only observations on 2026-10-16 UTC:

- GitHub `main` resolves to `fd687834aee8a0518cdbbe5cda9ac2d66446a63e`.
  [Branch metadata](https://api.github.com/repos/JX-Technologies-Inc/Petalpal/branches/main).
  It is not a deployed-SHA attestation or deployment authorization.
- Local object comparison with the verified branch shows server/schema differences
  and five migration files present on that main but absent on the verified branch
  (`202610150001` through `202610150005`). The selector change itself needs no
  migration. Do not deploy the entire older branch over an unknown newer TEST
  schema, or deploy unrelated main changes as part of this experiment.
- The Integration guard and backend Dockerfile are identical between these two
  sources. The guard requires `PETALPAL_ENVIRONMENT=integration`, production mode,
  isolated Firebase/database/origins, manual AI execution and **all three shared
  daily call limits = 0**. It forbids the existing Workers AI URL/token and job
  dispatch/executor credentials. English's active BGE route needs those forbidden
  Worker bindings; it is not available simply by changing a selector flag.
- One anonymous GET to TEST `/session`, returning only status/cache metadata, was
  unavailable from this execution host (`URLError`; no HTTP status observed).
  This is not evidence that the service is down. Current TEST workflow-run metadata
  was unavailable through the available connector. No dashboard secrets, logs,
  account data or database were inspected.

Before execution, the operator must supply only nonsecret metadata: exact TEST
service/deployment/source IDs, Dockerfile/start command, Auto-Deploy OFF, actual
Prisma resource ID + TEST binding confirmation, current schema compatibility,
marker verification status, Firebase project match and TEST-origin-only CORS.
Reuse valid existing attestations where the relevant bindings have not changed.
Never request credential values or credential-page screenshots. Do not run the
marker CLI as a read-only probe: it can initialize/move a marker and startup can
run migrations. A trusted read-only transaction may check the existing marker and
migration IDs; it must not create or repair anything.

## 2. Execution boundary and exactly how V2 is selected

**Preferred design: a finite, Integration-only evaluation runner using the actual
`createProductionAiWorker` and `ReportInputService`, while the normal TEST server
remains OFF with its zero budgets.** The runner is a proposed prerequisite, not an
existing approved capability. Do not launch an existing script with positive caps
to bypass `assertIntegrationEnvironment`.

The future runner needs an explicit, reviewed run authorization policy: exact
TEST resource identities, source SHA, expiring run ID, allowlisted test owners,
periods/job IDs, phase, call slots and money cap, checked before every dispatch.
Default/no authorization must deny execution. Production identities/origins and
ambient credentials must be rejected. Positive process-local budgets are allowed
only inside that reviewed capability; normal hosted environment groups and the
existing server guard remain unchanged. No public control endpoint is added.

| Setting in the approved evaluation worker only | Selector V1 arm | Selector V2 arm |
|---|---|---|
| `AI_WEEKLY_EVIDENCE_SELECTOR_V2` | literal `false` | literal `true` |
| `AI_WEEKLY_REPORT_PROVIDER` / model | `anthropic` / `claude-sonnet-5-5` | identical |
| `AI_WEEKLY_REFLECTION_CONTRACT` | `weekly-reflection-v2` | identical |
| Output / timeout | 2048 tokens / 20 seconds | identical |
| Async execution | manual; targeted `runJob`, no poller/queue/reconciler | identical |
| Monthly / Event providers | no activation | no activation |

Both arms use the unchanged Weekly v2 prompt/schema/validator: **V1/V2 refers to
selectors, not different reflection contracts.** The flag is snapshotted when the
worker/service is constructed; each arm needs a newly constructed worker. True on
the legacy Workers AI route does not select V2. True with the v1 reflection
contract is rejected. The flag is server-side, not a user preference or REST field.

For causal writing comparison, inject the same frozen, owner/period-scoped candidate
pool with the existing metadata ranks into each worker's semantic retrieval boundary.
Chinese retains its period-memory route. Keep the real selector, packet builder,
Gateway native request, validators, SQL fences and persistence. This isolates the
selector and needs **zero live embeddings**, with no fabricated active-profile
vectors. It does not establish live English BGE/pgvector ranking acceptance.

A persistent flag flip on the hosted HTTP service is a separate option, not the
recommended first experiment: it affects every localized Weekly on that service,
and current zero budgets still prohibit inference. It requires a reviewed
Integration-only execution/owner policy, credentials, source/config delta and
explicit restart/deploy approval. Never set `PETALPAL_ENVIRONMENT` differently,
bypass the startup guard, or relax its limits to make a test run.

## 3. Fixed comparison dataset and preservation

Reuse the frozen synthetic [editorial fixtures](../../experiments/reflection-editorial-bottleneck/fixtures.mjs)
without tuning their text, review labels, ranks or selector rules after results.
Four dedicated TEST owners: English baseline/candidate and Simplified Chinese
baseline/candidate. Prefer eligible existing disposable identities; otherwise
separately approve provisioning/verification emails. No operator's personal account
or ordinary TEST user's content may be repurposed. UID/email mappings stay private;
reports use aliases only. All owners explicitly consent to processing,
personalization and memory, and all included Events permit memory processing.

| Case, in each language | Events | V1 selected refs | V2 selected refs | Review purpose |
|---|---:|---|---|---|
| Q01 connected work + routine distractions | 7 | E1–E4 | E1–E5, E7 | Incorporate meaningful later feedback/follow-up; omit unrelated towel entry |
| Q03 unrelated ordinary moments | 4 | E1–E4 | identical | Same-packet control; separate vignettes can be appropriate |
| Q04 sparse eligible week | 2 | E1–E2 | identical | Same-packet control; a brief reflection is sufficient |
| Q05 recorded date vs remembered event | 4 | E1–E3 | E1–E4 | Keep unfinished follow-up and distinguish record time from remembered Saturday |
| Q06 satisfying edit + continuing disappointment | 5 | E1–E4 | E1–E5 | Preserve negation, mixed feelings and unresolved outcome |

There are 10 pairs / **20 maximum Claude attempts**. Pilot: Q01 both languages,
4 attempts. Remaining cases: 16 attempts, separately reviewed after the pilot.
Q03/Q04 have identical evidence packets within each pair; writing differences
there are generation variability, not selector improvement.

Use five distinct, closed UTC weeks per owner, proposed Mondays 2026-08-31,
09-07, 09-14, 09-21 and 09-28 for Q01/Q03/Q04/Q05/Q06 respectively. Freeze the
relative record days before approval; preserve Q05's recalled-event meaning.
Each owner has 22 Events/22 EventMemories: **88 of each** for the quality dataset,
plus at most 20 quality jobs/reports and their normal provenance/audit rows.
Any safety scratch rows require a separately enumerated, bounded fixture preview.

`POST /events` rejects backdated timestamps and simulated-time headers. Therefore
an approved test-only seeder must create these historical synthetic fixtures through
owner-scoped database operations, after a dry-run preview. Do not change that API,
simulate an entire week via production requests or populate fake embedding rows.
No hosted fixtures are seeded in this preparation task.

The flag is absent from job/report identity. `grounded-narrative-v1`,
`WEEKLY_REPORT:<period>:<generationVersion>` and unique owner/period remain unchanged.
Never run OFF then ON for the same owner/period expecting another generation:
a finalized report is intentionally reused. Pair separate owners with identical
source text/days/topics/ranks, then confirm packet equality except selected evidence.
Never reset attempts, delete reservations, change generation versions or delete a
report to buy another paid inference. Existing historical ledgers are not test storage.
Use a fresh run namespace with the existing append-before-send, non-replayable ledger
pattern; preserve partial/failed runs, source packets, alias mapping and reviews.
Only synthetic content belongs in new artifacts; never provider thinking or secrets.

## 4. Proposed execution steps and safety acceptance

All steps below are future actions, gated by the approvals in section 8.

1. **Pin source and target.** Read back TEST Live and resource identities. Compose
   only the missing selector patch/tests onto the approved compatible TEST baseline;
   do not merge/deploy all of main or this older branch. Review default-OFF delta,
   startup, schema and dependency compatibility. Revalidate changed runtime on Node
   24.21.0; reuse unchanged accepted checks. A new runtime/harness SHA needs review.
2. **Implement/review the bounded runner and fixture preview.** Separate `mock`
   and `live` capabilities; mock mode traps external sends and has no usable provider
   credentials. Native request capture remains synthetic and private. Live mode has
   no generic batch/queue access and no fallback, repair or automatic retry. No
   historical live-evaluation workflow/approval/consumed ledger is reused.
3. **Real PostgreSQL, zero inference.** Extend existing `ai-p0.postgres.test.js`
   patterns to the localized Sonnet worker with explicit OFF/ON and mocked Gateway.
   Existing real-PG tests cover constraints, claim concurrency, DST and consent
   races, but are not proof of V2 native-path locking. Run the new matrix first on
   a fresh disposable pgvector PostgreSQL database. Do not point the existing broad
   suite, migrations or cleanup routines at shared Integration. Then run only the
   reviewed owner-scoped hosted subset on enumerated synthetic scratch rows.
4. **Seed/inspect TEST data after write approval.** Verify existing marker by a
   read-only query and operator resource binding before DML. Check test Firebase
   `aud`/issuer and ownership without printing tokens; inspect only allowlisted
   synthetic records. Preview exact fixture inserts; scope all mutations/cleanup to
   run-owned IDs. Verify consent/opt-outs and source snapshots. Build both selections
   with zero model calls, checking the table, repeated/permuted determinism, themes,
   <=32 candidates, <=8 Events, <=4000 context characters, real request admission
   <=8192 bytes including reserve and exact source-to-alias mapping.
5. **Optional four-call pilot.** Dedicated Integration credentials only; preflight
   logging/payload suppression and absence of retry/fallback. Freeze native model,
   system instructions, schema, output limit, evidence ordering and relative dates.
   Send each arm once, sequentially, with counterbalanced order across the two
   languages. Persist via the actual worker and atomic fence, not direct report
   inserts. Invalid/ambiguous/error responses consume their slot and stop the batch.
6. **Review pilot, then separately authorize continuation.** Require a substantive
   writing gain in both language pairs and no factual/privacy regression before
   continuing. Otherwise stop and keep OFF. No prompt tuning or retry in this batch.
   The remaining 16 slots are a ceiling, not permission to continue automatically.
7. **Read/replay and rollback drill.** After saved reports exist, verify own reads,
   denied cross-owner reads and owner/body injection rejection. Duplicate the same
   approved job/trigger and verify finalized reuse with zero extra inference. Perform
   the scoped OFF restoration below and a zero-cost selection/routing check.

Required real-PG safety matrix (both selectors; mock provider for destructive races):

| Scenario | Required observation |
|---|---|
| Concurrent claim / SKIP LOCKED | Independent clients/processes claim a job at most once; a locked earlier job does not claim twice or block the next eligible job |
| Consent revoke/regrant | Hold an uncommitted consent update on connection A; B's authorization/persistence blocks; commit revoke and B fails closed. Changed consent epoch rejects stale input even if booleans become true again |
| Source revision, deletion or opt-out | Actual Event/Memory SHARE locks block conflicting writers; pre-dispatch stale input yields no send; a change during a mocked request prevents publication. A previously dispatched real request cannot be unsent |
| Lease loss / atomic completion | Expire/reclaim a synthetic claim while completion waits; old attempt cannot persist. Failure after report/evidence writes rolls the transaction back; no partial report or SUCCEEDED job |
| Owner/provenance/time | Wrong owner/job, foreign memory, Journal, duplicate identity and window boundaries cannot enter another owner's packet/report; composite FKs and exact source refs remain enforced. Include Vancouver DST boundaries in scratch tests |
| Retry / idempotency | API Weekly jobs remain maxAttempts=1. Failures before inference follow that lifecycle; once reserved/dispatched, timeout, 429, malformed output or reclaim never buys another call. Failed/partial ledgers cannot resume |
| Sparse/repetitive/contradictory input | 0/1-Event weeks abstain with zero provider sends; two eligible Events may yield a brief reflection. Exact duplicates do not pad capacity; distinct negated corrections/contradictions remain verbatim when admissible |

Use transaction barriers and bounded `lock_timeout`/`statement_timeout` on independent
connections; observe lock waits/SQLSTATE and final counts, not raw queries or data
in logs. Preserve existing lock order (consent, claim, Events before Memories) and
non-cascading audit reservations. Do not hold SQL transactions across real network
calls merely to manufacture a race. Scope real-provider runs to healthy writing
cases; race/retry/failure cases require no paid requests. A rollback-only lock witness
on hosted synthetic rows may verify provider row-lock behavior without rewriting
quality fixtures; the full publish races still require the reviewed mock subset.

## 5. Editorial evaluation, separate from semantic safety

Two human reviews: fluent English and native Simplified Chinese coverage. Blind
V1/V2 labels and counterbalance A/B display order; retain the private mapping.
Review against each arm's **own supplied packet** for factual grounding. Review
selection completeness against the full synthetic week separately; V1's omission
of evidence it never received is not an unsupported-inference error.

- Semantic hard gate: no lost negation/correction, wrong speaker/date/source,
  unsupported emotional conclusion, fabricated causal link/resolution or provenance
  failure. Validators must also pass unchanged. Record validator-vs-human failures
  separately; passing validation does not prove semantic fidelity.
- Rate 1–5, with a source-backed explanation: natural organization, coherent use of
  explicitly related Events, emotional nuance, and fluent native wording. Mark
  forced arcs, literal translations and mechanical inventories when the actual
  evidence supports a more natural structure. Do not reward length or Event count.
- For Q03, unrelated vignettes can be the best organization. For Q04, brief is
  appropriate; do not require a lesson or emotional arc. For Q05, distinguish
  remembered Saturday from the record weekday. For Q06, pleasure and continuing
  disappointment must coexist without invented recovery.
- Proposed continuation criterion: no semantic/privacy/structural regression; V2
  preferred on at least 4 of the 6 changed-packet pairs (Q01/Q05/Q06), at least one
  substantive win per locale, remaining pairs tied with no material loss. Controls
  must not suggest systematic degradation. These are small-sample review criteria,
  not a statistical claim or production acceptance. Declare them before dispatch.

Adversarial double-negation, scope, duplication and fabricated-source cases remain
in the zero-cost semantic suite. Do not use those cases to judge ordinary prose or
count evidence coverage as a writing-quality win. Inconclusive writing results
mean keep V2 OFF and record the remaining bottleneck; no speculative prompt rewrite.

## 6. Paid calls and maximum cost — separate approval

Published standard global Sonnet 5.5 pricing is **$2/M input, $10/M output**
([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing),
checked 2026-10-16 UTC). This matches `lib/ai-gateway-config.js`.
Freeze 8192 input admission and 2048 max output tokens. Existing reservation:
`8192 × $2/M × 1.25 + 2048 × $10/M = $0.04096` per permitted request.

| Paid phase | Maximum Claude attempts | Existing padded reservation ceiling |
|---|---:|---:|
| Q01 pilot, both languages, both selectors | 4 | $0.16384 |
| Separately approved continuation | 16 | $0.65536 |
| Entire proposed experiment | **20** | **$0.81920** |

Suggested owner Claude-only cap: **$0.82 total**, with independent 20-slot and
phase caps; no spare retry/calibration/judge calls. Uncached base token upper-bound
calculation is $0.73728; the higher reservation includes existing input padding.
Actual token usage can be lower. Taxes, Gateway/Worker/storage/hosting fees are not
included, so $0.82 is not an all-in invoice guarantee. Recheck rates/entitlement and
request shape before dispatch; changed pricing, caching/premium parameters or a
higher output cap requires a new estimate/approval.

Each report reserves two shared call units even with injected retrieval. For five
reports per new owner, allow at most 5 Weekly actions / 10 shared units per owner,
40 shared units globally and the corresponding provider limits. Maximum per-owner
USD reservation is $0.20480. The dedicated runner must account for **existing**
AuditEvent liabilities, including failed/insufficient/mock reservations; never reset
history or treat UTC midnight as a fresh run authorization. Hard run/phase limits
stay independent of available shared-budget headroom. Normal hosted shared caps
stay at zero. The existing default of four Weekly actions per owner/day is not
enough for five scenarios; any runner-only override needs explicit review.

No paid AI is needed for preparation, selector metrics, auth/privacy checks or
mocked real-PG races. Real Claude calls are needed only to assess actual writing.
The preferred frozen-retrieval comparison requires **0 BGE inference calls**.
Live English BGE/pgvector end-to-end acceptance would be a separate scope: provision
an Integration-only embedding route, preserve the active BGE Small EN 384d/mean
profile and approve embedding calls. Current guard forbids its Worker bindings.
Do not substitute random vectors and call that live retrieval acceptance.
[Cloudflare's BGE Small card](https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/)
lists 512 input tokens, 384 dimensions and $0.0202/M input tokens; price any such
optional workload and platform fees separately before approval. No embedding,
Event-emotion, Monthly, fallback or AI-judge calls are included in the 20 slots.

## 7. Safe rollback to OFF

1. Stop admitting new run slots/targeted jobs; freeze the run ledger. Cancel future
   dispatch, then allow already dispatched requests to reach their bounded deadline
   and confirm no selected job remains RUNNING/leased before restart or cleanup.
   OFF alone cannot undo an in-flight request or cancel its liability.
2. Dispose the runner's V2 worker and construct only OFF workers with literal
   `AI_WEEKLY_EVIDENCE_SELECTOR_V2=false`. Constructor snapshots require a fresh
   worker; changing an environment object is not sufficient. Normal TEST hosted
   flag/settings were never changed under the preferred runner design.
3. Verify OFF via a zero-cost owned input/packet comparison to V1, with no new paid
   job, and check normal TEST budgets remain zero/manual. Preserve all generated
   reports, evidence, attempts and reservations for owner review. OFF does not
   rewrite existing V2 reports or authorize regeneration/deletion.
4. If a separately approved persistent TEST activation was chosen, restore only
   that TEST service's flag to false and the recorded TEST-only AI setting diff.
   Restart/release only the approved compatible source/image. Preserve the exact
   guard startup command; its migration-deploy side effect must have been reviewed
   in advance. A settings save may rebuild/redeploy: no Deploy Latest or automatic
   platform rollback to a stale schema/source. Never touch Production environment
   groups, credentials or services.
5. Run the same bounded TEST identity/anonymous metadata checks and OFF selection
   probe. Record exact effective source/flag state and outstanding liabilities.
   Cleanup only approved synthetic IDs after review through existing owner-scoped
   deletion paths; retain non-cascading AuditEvent rows and all consumed ledgers.
   Dedicated credential revocation/removal is a separately authorized operator action.

## 8. Owner approvals required before execution

These gates follow the current no-execution instruction and the repository
[Integration/deployment SOP](../../INTEGRATION_DEPLOYMENT.md), especially its
source pinning, resource isolation and separate provider-change scopes.

| Approval | Concrete scope / prerequisite |
|---|---|
| Source and execution-harness preparation | Approve the compatible TEST baseline and focused selector/runner policy implementation. Review its new SHA, default-deny tests and Node 24.21.0 real-PG/mock evidence before any hosted execution |
| Publication/deployment, if required | Exact reviewed TEST source/build/service and startup/migration effects; Auto-Deploy OFF, no Production action. Existing environment reviewer gates still apply. This plan grants no merge/push/deploy permission |
| TEST identities/data/safety rehearsal | Confirm actual TEST Prisma/Firebase bindings and protected access; approve the four test owners (and any separately enumerated scratch owners/rows), exact fixture preview, explicit consent and owner-scoped cleanup. New account verification emails require explicit approval |
| Paid pilot | Only four specified Claude attempts, max $0.16384 padded reservation, exact runner/source/TEST Gateway, dedicated credentials, retention/no-retry attestation, expiring run and OFF rollback scope |
| Paid continuation | After reviewing the pilot, at most 16 additional specified attempts / $0.65536; total run <=20 / $0.81920. No automatic continuation or retry |
| Rollback | Pre-authorize stopping only this run and restoring only its TEST OFF settings/worker, including any necessary same-source restart effects. No Production rollback or historical-data deletion |

Current disposition: **plan ready for review; no hosted or paid execution yet.**
Required unknowns are the live TEST source/resource binding, compatible release
candidate, available verified TEST identities, and the bounded runner policy.
Do not send secret values. All previous consumed evaluation namespaces remain
closed; this experiment needs its own reviewed run authorization.

Preparation validation: Node 24.21.0 `gatewayQuote` reproduced the exact cost
ceilings; fixture metadata confirmed the 5 cases / 88 Events / 20 report slots;
selected-reference expectations match the preserved candidate artifact. Local
links, Monday dates and diff whitespace checks passed. Runtime/configuration,
fixtures, tests and consumed ledgers are unchanged; accepted readiness suites
were reused rather than repeated. No Integration test was executed.
