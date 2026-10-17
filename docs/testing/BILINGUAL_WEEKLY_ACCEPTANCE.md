# PetalPal — Bilingual Weekly Acceptance (en / zh-Hans)

Evidence matrix for the two Weekly acceptance tracks. It reuses existing
evidence; it is not a retest log. Time rules: [time.md](../../time.md). Phases
and approval gates: [TIME_WORKFLOW_TEST_PLAN.md](TIME_WORKFLOW_TEST_PLAN.md).

- **EN:** Event → Memory → BGE/pgvector retrieval → selection → Sonnet Weekly
  en → grounding → persistence → owner read → display.
- **ZH:** Event → Memory → bounded period EventMemory selection (no embeddings,
  by design) → Sonnet Weekly zh-Hans → grounding → persistence → owner read →
  display.

Status: **VC** verified current (unchanged code, passing evidence) · **VH**
verified historical (passed earlier; scope or version caveat) · **PARTIAL** ·
**MISSING** · **BLOCKED** (hosted access, paid AI, approval or infrastructure).

Compatibility basis (2026-10-17): the report pipeline (`sonnet-weekly`,
`reflection-v2`, `report-foundation`, `weekly-evidence-selector-v2`,
`ai-worker`, `event-memory`, `semantic-retrieval`, gateway, cost gate, write
fence, `ai-periods`, zh scripts, `prisma/`) is **unchanged since the PR #62
merge `1bab6796`**. Later commits touched Event creation, consent UI, the TEST
guard and the Fairy lock only.

## Matrix

| Stage | EN | ZH | Existing evidence | Missing verification | Next action |
|---|---|---|---|---|---|
| Event + consent | VC | VC (+ hosted) | `ai-event.route`, `ai-consent-lifecycle`, `mobile/test/privacyControls`; hosted consent + 2 zh Events (2026-10-16/17, recorded) | Hosted EN Event | None needed for ZH |
| Memory enqueue | VC | VC (+ hosted) | `ai-p0.postgres` atomic/race (17/17, 2026-10-17); hosted 2 PENDING (read-only preflight) | — | — |
| Memory processing | VC (local) | VC (local) + hosted manual | `ai-p0.postgres` worker crash/lease; runner disposable validation; hosted runner `{"SUCCEEDED":2}`, 0 provider calls | Hosted automatic: NOT SUPPORTED | — |
| EventMemory persistence | VC (local) | VC (local + hosted) | `ai-p0.postgres`; hosted read-only preflight 2026-10-17: 2 EVENT memories, owner/source/consent/date checks 2/2, `memoryWeekKeys ["2026-10-12"]`, MEMORY_EXTRACTION SUCCEEDED 2, Weekly jobs 0 | Hosted EN | — |
| Embedding / RAG retrieval | Model choice VH; pgvector storage/retrieval VC; hosted **BLOCKED** | N/A by design; hosted 2 `EMBEDDING_GENERATION` PENDING (harmless, not executed) | BGE `summary-v1` 2026-09-17: Recall@1/3/5 0.549/0.708/0.750, MRR 0.673 (84 en dev queries / 120 Events; [LONG_TERM_AI.md](../../LONG_TERM_AI.md)); Cloudflare BGE cutover 2026-09-28 (recorded); `ai-p0.postgres` 384d owner-scoped retrieval + backfill (injected provider) | No held-out or multilingual set; hosted TEST has no embedding executor or provider | Leave the 2 zh jobs PENDING: live embedding has no language gate and would call Cloudflare BGE, and zh Weekly does not read embeddings. Hosted EN needs a TEST embedding path (design + approval) |
| Evidence selection | VC | VC | `weekly-evidence-selector-v2`, `weekly-evidence-significance`, `weekly-narrative-thread`; Monthly semantic input (`ai-p0.postgres`); [WEEKLY_SELECTIVE_REFLECTION_FINAL.md](../ai/WEEKLY_SELECTIVE_REFLECTION_FINAL.md) (offline cases; en similarity approximated) | Real BGE ranking inside a live Weekly run | — |
| Weekly time eligibility | VC | VC | `ai-p0.integration`, `vancouver-timezone`, `ai-p0.postgres` Vancouver DST SQL; helper check: week 2026-10-12 = `[2026-10-12T00:00Z, 2026-10-19T00:00Z)`; ZH full pipeline at the exact boundary with the runbook budget (`weekly-zh-time-boundary.postgres`, 2026-10-17: 23:59:59Z rejected, 00:00:00Z generated once) | Hosted open-period 400 (route not called) | Wait for real boundary (no override) |
| Sonnet generation | Mock VC · live VH | Mock VC · live VH | `sonnet-weekly`, `reflection-v2`; zh live 2026-10-15 single call (earlier prompt, [REFLECTION_V2.md](../ai/REFLECTION_V2.md)); UNV batch validated C01 en + C04 zh ([TWO_LANGUAGES](../ai/REFLECTION_EDITORIAL_FREEDOM_TWO_LANGUAGES.md)); **final 8-call acceptance of the merged prompt** (see below) | Hosted live call; per-language split and editorial scores not in the repository; R2 evaluation NOT PERFORMED ([R2](../ai/REFLECTION_V2_R2_EVALUATION.md)) | **BLOCKED**: one approved call per language |
| Grounding | Mock VC · live VH | Mock VC · live VH | Validators in `reflection-v2`/`sonnet-weekly` tests; historical live outputs passed validation | Human review on current prompt | With live call |
| Report persistence | VC (local) | VC (local) | `ai-p0.postgres` report worker + atomic regeneration (17/17, 2026-10-17); `report-write-fence`; zh offline harness (CI path-filtered on PR #62; result not re-read locally) | Hosted | After live call |
| Owner-only API read | VC · hosted negatives VC | VC · hosted negatives VC | `private-report-list`; Phase A run 38991251290 (401/403/400) | Hosted positive read | After hosted report |
| Web/Mobile display | PARTIAL | PARTIAL | `mobile/src/app/reflection.tsx` implemented | No display test; no hosted report to display | After hosted report |
| Automatic background | Production queue VH; hosted **BLOCKED** | Same | Dispatch/Queue/executor/cron in source; `ai-async-dispatch(.postgres)`; production cutover 2026-09-29 (recorded) | TEST lane absent; **no Weekly/Monthly scheduler** (NOT SUPPORTED) | Design only, separate approval |

## Final Weekly editorial acceptance (merged prompt) — VERIFIED HISTORICAL

| Item | Record |
|---|---|
| Candidate | `45145ceb54f07b944e8e4e479daaf2af78d652b3`, merged via PR #62 on 2026-10-16 (flags default OFF); report pipeline unchanged on `main` since |
| Runner | `scripts/weekly-final-acceptance-evaluation.mjs` (branch `eval/weekly-final-acceptance-45145ceb`), `live` mode |
| Environment | Owner's macOS machine, isolated local checkout; not GitHub Actions |
| Result | COMPLETE: dispatched 8, attempts 8, rejected 0; budget reservation US$0.32768 (8 × US$0.04096) |
| Quality | 4/4 blind comparison wins (submitter-reported in PR #62) |
| Regression | Real-dependency suite 344/344 on macOS (PR #62) |
| Artifacts | Private ledger/review files in that checkout's Git directory (`petalpal-acceptance/weekly-final-acceptance-45145ceb*`), not in the repository |

Sources: PR #62 description and the owner's terminal record of the live run. An
earlier attempt in the same workflow stopped with `LEDGER_UNAVAILABLE` before it
was corrected. Claude did not open the private artifacts (macOS folder access
blocked), so this row is VERIFIED HISTORICAL, not re-verified. It proves isolated
live quality of the merged prompt, not hosted TEST behavior.

## Weekly language gate

The Sonnet Weekly path picks its language from `User.preferredLocale` (schema
default `"en"`; `weeklyReportLocale` in `lib/report-locale.js`). A hosted ZH run
needs the TEST owner at `zh-Hans`. With `en`, the run would take the BGE path
TEST cannot serve, and with `maxAttempts: 1` it would consume the week's only
attempt. `scripts/integration-memory-preflight.mjs` reports `ownerWeeklyLocale`
(validated on disposable PostgreSQL). Hosted value 2026-10-17: **`en`** at the
preflight; then switched by the owner in the TEST web app's Settings → Report
language (`ReportLanguageSettings`, owner-only `PUT /users/:id/profile`, app
session; no password script). **Now `zh-Hans` — VERIFIED** through the
owner-only server read the screen displays (`/session?view=metadata`, mapped
like `weeklyReportLocale`). The database preflight was not rerun; it is an
optional confirmation.
Switch and restore only through the owner-only profile API with the
phrase-gated `scripts/integration-test-locale.mjs` (`TARGET_LOCALE=zh-Hans`,
later `TARGET_LOCALE=en`; offline tests `test/back/integration-test-locale.test.js`
6/6). Each hosted run needs separate approval. EN acceptance stays isolated
(local BGE ONNX + one approved Sonnet call) until TEST has an embedding path.

## Tests run for this audit (2026-10-17, $0, disposable PostgreSQL)

`test/back/ai-p0.postgres.test.js` was the only real-database evidence for the
EN retrieval and report pipeline, and it could not pass on the current schema.
Its enabled-consent seeds used `termsVersion: "v1"`, which the 2026-10-15
grant-guard migration rejects. Fixture-only fixes:
1. Enabled seeds use `AI_DISCLOSURE_VERSION` (13 seeds).
2. The report-worker replay check now asserts the current behavior: a finished
   job is not re-claimed, and a direct handler call outside a claim is fenced
   (`REPORT_SOURCE_STALE`). It still asserts one provider call, one report and
   three evidence rows.

Result: **17/17 pass**. No runtime code, hosted access or provider call.

## Testing Weekly now, without waiting

- **Logic:** already covered by the closed fixture week in the `ai-p0.postgres`
  report-worker test and by `reportPeriodStatus` boundary tests.
- **Week 2026-10-12 offline:** the injected-`now` harness (plan B1/E1) is
  PROPOSED.
- **Hosted:** use the real boundary, 2026-10-19T00:00Z. No clock override exists
  or is needed.

## Hosted ZH Weekly runbook (prepared 2026-10-17, NOT executed)

**Prerequisite — guard fix (merged in PR #72; TEST backend deployed at `709c94c4` on 2026-10-17, startup isolation PASS, anonymous smoke 10/10, anonymous Weekly trigger and report list 401; budget variables not yet set).** One Weekly generation reserves **2**
calls (`WEEKLY_REPORT: { daily: 4, calls: 2 }`, `lib/ai-cost-gate.js`), and
the verified single-call harness uses call limits `2` with
`AI_WEEKLY_REPORT_DAILY_LIMIT=1`. The `weekly-sonnet-v1` TEST guard currently
allows call limits of only `0`/`1`, which would fail the reservation
(`AI_QUOTA_EXCEEDED`) and, with `maxAttempts: 1`, consume week 2026-10-12. The
guard must instead allow call limits `≤ 2` and **require**
`AI_WEEKLY_REPORT_DAILY_LIMIT=1`, keeping every USD cap ≤ 0.05 (a single
reservation is US$0.04096). It needs a local change, tests, a `SECURITY.md` note,
merge and a TEST backend deploy before any configuration below.

**TEST Render environment (owner-entered; secrets only in the Render UI):**

| Variable | Value |
|---|---|
| `PETALPAL_TEST_AI_BUDGET` | `weekly-sonnet-v1` |
| `AI_ASYNC_EXECUTION_MODE` | `manual` (unchanged) |
| `AI_GATEWAY_ENABLED`, `AI_GATEWAY_ANTHROPIC_ENABLED` | `true` |
| `CLOUDFLARE_AI_GATEWAY_ID` | `petalpal-integration` |
| `CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID` | TEST Cloudflare account ID (non-secret) |
| `CLOUDFLARE_AI_GATEWAY_TOKEN`, `ANTHROPIC_API_KEY` | secrets, entered by the owner |
| `AI_WEEKLY_REPORT_PROVIDER` / `_MODEL` | `anthropic` / `claude-sonnet-5-5` |
| `AI_WEEKLY_REFLECTION_CONTRACT` | `weekly-reflection-v2` |
| `AI_REPORT_SUPPORTED_LOCALES` | `zh-Hans` |
| `AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS` / `_TIMEOUT_MS` | `2048` / `20000` |
| `AI_USER/GLOBAL/PROVIDER_DAILY_CALL_LIMIT` | `2` (after the guard fix) |
| `AI_WEEKLY_REPORT_DAILY_LIMIT` | `1` |
| `AI_USER_DAILY_USD_LIMIT`, `AI_USER_MONTHLY_USD_LIMIT`, `AI_GLOBAL_DAILY_USD_LIMIT`, `AI_GLOBAL_MONTHLY_USD_LIMIT`, `AI_ANTHROPIC_MONTHLY_USD_LIMIT` | `0.05` |
| `AI_MONTHLY_REPORT_PROVIDER`, `AI_EVENT_EMOTION_PROVIDER`, Worker/dispatch/executor variables | unset |
| Weekly v2 optional flags (`AI_WEEKLY_EVIDENCE_SELECTOR_V2`, `AI_WEEKLY_EVIDENCE_SIGNIFICANCE`, `AI_WEEKLY_REFLECTION_*`) | unset (defaults), unless separately chosen |

**Deploy checklist:** save the environment without auto-redeploying, then do a
Manual Deploy of the exact approved SHA. Confirm the startup log reads
`Integration environment isolation PASS` (a guard failure means stop, without
retrying), run backend smoke, then the read-only preflight (`ownerWeeklyLocale
zh-Hans`, 2 memories, week `2026-10-12`, Weekly jobs 0).

**Trigger (on/after 2026-10-19T00:00:00Z, once, separate approval):**
authenticated owner `POST /ai/reports/weekly/trigger` with body
`{"localDate":"2026-10-17"}` (never an empty body). In manual mode it runs
inline. Expect 200/202 with a report, or a typed failure. Do not retry. Then
remove the budget variables and redeploy, and read the report owner-only.
**Caller (prepared, offline-tested, not dispatched):**
`.github/workflows/integration-weekly-trigger.yml` runs
`scripts/integration-weekly-trigger.mjs` with the stored TEST identity.
1. `phase=check` (environment `petalpal-web-build-integration`) is read-only.
   It signs in, then calls `GET /session?view=metadata` and `GET /ai/reports`; it
   never calls `/auth/session` or the consent GET, which can write. It requires the
   signed-in owner id to equal the pre-confirmed `INTEGRATION_WEEKLY_OWNER_ID`
   secret and the token email to equal the stored identity, plus locale `zh-Hans`,
   week `2026-10-12`, memory consent (report list 200) and no existing report for
   the week. Anything unconfirmed stops it.
2. `phase=trigger` (protected environment `petalpal-weekly-trigger`, required
   reviewers) runs only on `main` with `run_attempt == 1` and only at or after
   2026-10-19T00:00:00Z. It repeats every check, then sends exactly one request
   with no retry.

Duplicate generation is also blocked by the workflow concurrency group, the
existing-report stop and server-side idempotency (one job per owner, period and
version, `maxAttempts: 1`). Offline tests: `test/back/integration-weekly-trigger.test.js`
6/6. Manual setup is listed in `MANUAL_SECURITY_CHECKLIST.md`; each phase needs
separate approval.

**Budget caution (VERIFIED offline):** the cost reservation precedes input
preparation, so any trigger that fails after reserving (for example stale
sources) uses that day's single TEST Weekly budget. Do not attempt a second
trigger the same UTC day; investigate first.
