# Hosted TEST acceptance — short Weekly report (`weekly-short-v1`, zh-Hans)

Status: **prepared 2026-10-20, nothing executed.** No step below is authorized by this document.
Each step marked **APPROVAL** needs the owner's separate, task-specific approval (exact workflow,
environment, SHA and phase). Follow [INTEGRATION_DEPLOYMENT.md](../../INTEGRATION_DEPLOYMENT.md);
[WARNING.md](../../WARNING.md) takes precedence. Design: [WEEKLY_SHORT_REPORT_DESIGN.md](../product/WEEKLY_SHORT_REPORT_DESIGN.md).
Earlier hosted evidence and the reused procedure: [BILINGUAL_WEEKLY_ACCEPTANCE.md](BILINGUAL_WEEKLY_ACCEPTANCE.md).

## What this run proves (and what it does not)

Proves, for one real hosted zh-Hans week: trigger → one Sonnet call → per-part validation → persistence
through the widened source fence → owner-only read → Reflection display of every short section,
including a real "then and now" pair across weeks.

Does **not** cover (offline evidence only, see the design doc): English (hosted TEST has no embedding
path, so the "change in wording" path cannot run there), the support-week path, and the owner's blind
review against the current report (a separate local live A/B with its own paid-inference approval).

## Target

- Week **2026-10-19** (Mon) to 2026-10-26 (UTC owner), trigger `localDate` **2026-10-24**, not before
  **2026-10-26T00:00:00Z** — fixed in [scripts/integration-weekly-trigger.mjs](../../scripts/integration-weekly-trigger.mjs).
- Week 2026-10-12 is consumed (v2 report, 2026-10-19) and cannot be regenerated; it does not block this run.
- Event times are always server time (`occurredAt`; no backdating), so the Events must be written
  during the target week itself.

## Steps

### 0. Prerequisites (owner)

- Review and merge `feat/weekly-short-v1` into `main` (owner-only Git publishing). Record the merge SHA (**X**).
- Offline evidence on the branch: backend weekly-short / then-and-now / sonnet-weekly / integration-environment /
  integration-weekly-trigger suites pass; full backend suite has only the 23 known environment failures that
  clean `origin/main` also has; mobile type check and short-report tests pass.

### 1. Write the week's Events (owner, TEST Web app, 2026-10-19 … 2026-10-25 UTC)

- At least **3** zh-Hans Events, each with a Primary Mood, so the side-by-side part and the question are
  requested (fewer than 3 shows only the line of the week and the mood curve).
- Spread them over Mon–Thu and Fri–Sun with different moods, so the curve and its factual line are visible.
- **Then and now:** write one Event whose sentence repeats a phrase of at least 4 Chinese characters from a hosted
  2026-10-16 or 2026-10-17 Event, a full 7 × 24 hours later: on **2026-10-25 (UTC)** it pairs with either; on
  2026-10-24 only with the 2026-10-16 entry. Keep that
  sentence, and the earlier one, at most 60 characters and use a specific phrase (not everyday filler such as
  "今天去了"). Optionally make the phrase appear in a third entry to see the count line.
- None of these Events should contain an immediate-danger statement (that would switch the week to the support
  path, which this run does not target).
- Only the owner reads or writes this content; it is never shared with Claude or logs.

### 2. Process the memories (owner, phrase-gated, no provider call)

After the last Event, run the existing one-shot runner with the owner-entered TEST database URL:
`AUTHORIZATION_PHRASE=RUN-TEST-MEMORY-JOBS-ONCE OWNER_ID=<TEST owner id> DATABASE_URL=<entered by the owner> node scripts/integration-memory-run-once.mjs`.
Expect `SUCCEEDED` equal to the number of new Events, 0 provider calls. The 2026-10-16/17 memories already exist.

### 3. TEST backend release of X — **APPROVAL** (Render TEST, exact SHA X)

Deploy X with the AI kill switch still on (no budget variables). Expect startup
`Integration environment isolation PASS (database marker verified)`, no pending migrations, anonymous smoke.

### 4. Budget configuration and redeploy — **APPROVAL** (on 2026-10-26, just before step 6)

Same owner-entered table as the 2026-10-19 v2 run ([BILINGUAL_WEEKLY_ACCEPTANCE.md](BILINGUAL_WEEKLY_ACCEPTANCE.md),
"TEST Render environment"), with one change:

| Variable | Value |
|---|---|
| `AI_WEEKLY_REFLECTION_CONTRACT` | **`weekly-short-v1`** (now accepted by the TEST guard) |
| `PETALPAL_TEST_AI_BUDGET` | `weekly-sonnet-v1` |
| `AI_WEEKLY_REPORT_PROVIDER` / `_MODEL` | `anthropic` / `claude-sonnet-5-5` |
| `AI_REPORT_SUPPORTED_LOCALES` | `zh-Hans` |
| Call limits / `AI_WEEKLY_REPORT_DAILY_LIMIT` | `2` / `1` |
| Five USD caps | `0.05` (one reservation is at most US$0.04096) |
| `AI_WEEKLY_EVIDENCE_SELECTOR_V2`, `AI_WEEKLY_EVIDENCE_SIGNIFICANCE`, `AI_WEEKLY_REFLECTION_*` editorial flags | **unset** (the short contract rejects them) |

Alternative: keep `AI_WEEKLY_REFLECTION_CONTRACT=weekly-reflection-v2` and set `AI_WEEKLY_SHORT_OWNER_IDS` to the TEST
owner id only (the per-owner switch); the TEST guard accepts either. Provider secrets are entered by the owner in the Render UI only. Save without auto-redeploy, then Manual Deploy
of X. A guard failure at startup means stop, without retrying.

### 5. `phase=check` — **APPROVAL** (`integration-weekly-trigger.yml`, environment `petalpal-web-build-integration`, `main` at X)

Read-only. Expect `CHECK PASS: identity matched; locale zh-Hans; week 2026-10-19; memory consent on; no existing
report for the week`. Anything else: stop.

### 6. `phase=trigger` — **APPROVAL** (same workflow, on/after 2026-10-26T00:00Z, attempt 1)

Exactly one request, never retried. Pass = exit 0 (HTTP 200, narrative `GENERATED`). A failure after the cost
reservation uses that UTC day's single budget: do not trigger again the same day; investigate first.

### 7. Restore the kill switch — **APPROVAL** (Render TEST)

Remove `PETALPAL_TEST_AI_BUDGET` and both provider secrets, call limits back to `0`, redeploy, isolation PASS,
anonymous smoke.

### 8. Display — **APPROVAL** (`cloudflare-web-build.yml`, then `cloudflare-integration-deploy.yml`, each with its artifact ID/digest)

The TEST Web build must include X's mobile changes for the new layout; until then the Reflection page shows the
report as plain text. Then the owner reads the report owner-only on TEST Web.

## Owner acceptance checklist

| Part | Pass when |
|---|---|
| Line of the week | Exactly one clause from one of this week's Events, unchanged (full-width punctuation kept); tapping shows that Event |
| Mood curve | One point per Event with a mood, on the right day (UTC); the Mon–Thu / Fri–Sun line matches your choices |
| Side by side | Two of this week's Events, what happened only — no cause, meaning or judgment |
| Then and now | 那时 (the 10-16/17 entry) and 现在 (the new entry) sentences, exactly as written, dates in order; count line only if the phrase is in ≥ 3 entries |
| Question | One open question, no advice; 写一写 opens the Event panel |
| Overall | Nothing invented; any hidden part simply absent; no part from another user |

Record the run IDs, SHA, outcome and checklist result in [BILINGUAL_WEEKLY_ACCEPTANCE.md](BILINGUAL_WEEKLY_ACCEPTANCE.md)
and the design doc. If "then and now" does not appear although a phrase was planted, note the phrase length and
sentence lengths: the 60-character quote limit and the filler list are first guesses awaiting this review.
