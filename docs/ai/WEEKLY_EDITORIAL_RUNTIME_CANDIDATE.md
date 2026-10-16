# Weekly editorial runtime candidate — default OFF

2026-10-15, America/Vancouver. Branch `experiment/weekly-editorial-runtime`, new
isolated worktree `/Users/xingranma/Documents/ChatGPT/jev/petalpal-weekly-editorial-runtime`.
Parent: `4fa694727caf86bb4b480021995c898ea9fe64f5`.

**Source implementation and offline review only.** No hosted flags, credentials,
configuration, deployment, production data, migrations or inference changed.
Stop for owner review before any live evaluation. Actual writing improvement is
unproven; production-compatible code is not production or hosted acceptance.

The owner approved **E03 English and Simplified Chinese as provisional editorial
quality references**, not final human gold. The frozen source/target files remain
unchanged. Other targets have no new owner approval, and none is a Claude output
or a prompt few-shot. See the [benchmark investigation](WEEKLY_EDITORIAL_QUALITY_V1.md),
[readable references](../../experiments/weekly-editorial-quality-v1/EXAMPLES.md)
and [human rubric](../../experiments/weekly-editorial-quality-v1/RUBRIC.md).

## Runtime changes

The existing `SonnetWeeklyReflectionService` now snapshots two independent,
server-side settings. No configuration file sets either one.

| Flag | Default | Effect when explicitly true |
|---|---|---|
| `AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED` | unset / literal false | Move record weekdays from each evidence object to `recordDays: [{ref, day}]` after the evidence array, subject to the availability rule below |
| `AI_WEEKLY_REFLECTION_RETROSPECTIVE` | unset / literal false | Use the retrospective composition paragraph from the offline candidate |

Only literal `true`/`false` are accepted on the Sonnet Weekly path; malformed
values fail with the existing content-free `AI_GATEWAY_CONFIG_INVALID` before
retrieval. An enabled factor requires `weekly-reflection-v2`; v1 stays unchanged
when flags are OFF. Workers AI Weekly and Monthly do not interpret these flags.
No client request, source text, topic or model response can set them.

All four combinations are supported: original/original, separated/original,
original/retrospective, separated/retrospective. The prompt factor replaces only
the composition paragraph. Introduction, evidence safeguards and final JSON/ref/
quotation rules remain identical. The production constant exactly matches the
offline candidate; production imports no experiment, benchmark, exemplar or review
metadata. No intermediate plan, inferred theme, emotion label or second call.

`lib/weekly-editorial.js` holds the small configuration/presentation helpers.
`lib/sonnet-weekly.js` applies them inside the existing Gateway preparation and
validation flow. Source selection, packet construction, aliases, validation refs,
output schemas and persisted report shapes retain their existing implementations.
Record-day separation never reorders or rewrites text, topics or clipping metadata.

## Availability and budget behavior

The earlier **offline experiment** rejected packets when the underlying builder
trimmed selected sources. That restriction is **not adopted** here.

1. Run `buildWeeklyReflectionV2Packet` exactly as before. Its existing count,
   character and deterministic byte trimming rules choose the same retained
   sources and aliases for all four combinations. Existing invalid/insufficient
   cases retain their original rejection behavior.
2. The retrospective prompt adds **238 serialized UTF-8 bytes**. Native request
   framing uses at most **172 bytes** for the supported output caps, so their
   combined 410 bytes fit the builder's existing 512-byte framing allowance.
   Regression tests verify that inequality against the actual schema/prompt and
   request shape. No smaller packet allowance or extra source eviction is needed.
3. If separation is requested, measure the proposed complete native request using
   the chosen prompt and configured output cap, including the unchanged 1024-byte
   reserve. If it exceeds **8192 bytes**, keep the original weekday format for
   that report. Keep the chosen prompt and exact same retained sources/ref map.
   This is a presentation choice before the single call, not a provider fallback,
   retry, repair or new failure condition.
4. The existing Gateway still performs authoritative byte admission, maximum
   liability reservation, consent/claim/source checks, timeout and no-replay
   enforcement. No budget cap, model, output cap or shared call policy changes.

Tests cover both valid oversized source sets that need the original trimming and
a valid eight-source V2 packet where all eight fit the original builder but the
optional separation does not fit with the new prompt. That packet keeps all eight
sources and the retrospective prompt using the original input format.

The availability rule matters to interpretation: a requested format factor may
be inactive for a budget-bound report. Future authorized synthetic comparisons
must inspect the actual prepared format and identify these samples separately;
do not attribute a format effect to a packet without `recordDays`. No payload
logging or new telemetry was added. All nine frozen bilingual cases fit the
requested format without this fallback.

## Focused verification

Runtime: **Node v24.21.0 / ICU 78.3, Darwin arm64**. Dependencies were reused via
a temporary local symlink to the readiness worktree; only the new symlink is
removed afterward. No install hook, database connection, Docker, provider or
hosted resource was used. PGlite tests use disposable synthetic in-memory SQL.

| Check | Result |
|---|---|
| Affected Weekly service, quotation, locale/history and initial editorial suite | 179/181 passing on the first combined run; the two failed counts were a new consent parent/child assertion expecting an error instead of the existing cancellation outcome |
| Corrected consent group plus targeted actual Monthly worker matrix | **22/22 PASS**, zero failures/skips; verifies consent cancellation/no persisted report and Monthly request/claim/evidence parity |
| Final editorial unit/compatibility file, including the added eight-source boundary case | **27/27 PASS**, zero failures/skips |

**All 199 distinct scoped checks have passing evidence across these runs** (counts
include parent/subtests; overlapping reruns are not added). The only correction
after the combined run was to tests, not application behavior. Boundary fixtures
were also adjusted to probe the real admission threshold. No failed behavior was
hidden by changing production limits or weakening a security assertion.

Coverage:

- Independent pinned reference from `4fa69472…`: default and explicit false
  prepared packets/instructions match across **18 realistic localized cases and
  28 preserved historical fixtures**. OFF presentation returns the original object.
  Existing actual worker v1/default behavior also passes.
- Nine realistic scenarios × two languages × two selectors × four factor
  combinations: complete retained text, order, weekdays, clipping/ref metadata,
  privacy allowlist and byte admission remain intact. Unrelated E08 and sparse
  E09 require no artificial theme. Direct-source packet measurement covers 72
  factor views, max **4957/8192 bytes**, zero format fallbacks for this corpus.
- All ten handcrafted targets pass unchanged schema, quotation, reference and
  length checks under all four factors. This is contract evidence, not a style
  test of Claude. E03 approval is provisional and separately human-authored review
  is still needed for actual responses.
- **16 actual-worker E03 combinations**: both languages, both selector states,
  both flags independently. They verify selected source text, chosen system prompt,
  input shape, model/output cap, one mocked dispatch, evidence persistence and
  finalized-report reuse. Responses are handcrafted test doubles, not generations.
- Preserved V2 artifact compatibility: **10/10 meaningful follow-ups** retained
  through the runtime formatting step, identical to the accepted selector evidence.
- Both factors ON preserve zero-budget denial before retrieval, invalid-output
  liability/no replay, consent cancellation and late source deletion fencing.
  The changed service suite also exercises owner/Journal/opt-out/time-window,
  epoch/locale/source freshness, lease, rollback, timeout and no-repair boundaries
  under the existing selector OFF/ON tests.
- Actual Monthly requests, summaries, claims and evidence are identical with the
  Weekly settings unset, false, true and malformed, for both output contracts and
  languages. Monthly runtime/prompt/validator files are byte-unchanged.
- Existing tests preserve English/Simplified Chinese generation only, exact
  quotations and historical Traditional Chinese reads/finalized reuse.

Reproduce with already-installed compatible dependencies, or temporarily use
`ln -s ../petalpal-weekly-selector-v2-readiness/node_modules node_modules` in this
checkout. Use a credential-free environment; no `.env` loading:

```sh
env -i PATH="/tmp/petalpal-node-24.21.0/node-v24.21.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  node --test --test-concurrency=1 test/back/weekly-editorial.test.js \
  test/back/sonnet-weekly.test.js test/back/reflection-v2-quotation-contract.test.js \
  test/back/reflection-language-support.test.js

env -i PATH="/tmp/petalpal-node-24.21.0/node-v24.21.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  node --test --test-name-pattern='Weekly selector OFF/ON does not change actual Monthly' \
  test/back/opus-monthly.test.js
```

Syntax, diff whitespace, local document links and AST-only graph update are checked
separately. Accepted full readiness/deployment-image matrices were not repeated.
Unchanged selector internals, source fences, schema and Integration guard retain
their prior scoped evidence; this runtime change gets the affected-path checks
above rather than a claim that all old results certify the new runtime wholesale.

## Existing Integration path, rollback and remaining limits

Ancestry retains:

- Selector candidate `957c6c2de713e1c3b2219ab5d661c14971a747d3`.
- Verified readiness `dac2b512c996ed396be33cd69d3330790b7798c5`.
- Integration plan `b94154bef05f08253b748874130f5764959fcd38`.
- Editorial benchmark `4fa694727caf86bb4b480021995c898ea9fe64f5`.

Reuse the [existing readiness](WEEKLY_EVIDENCE_SELECTOR_V2_READINESS.md),
[Integration plan](WEEKLY_EVIDENCE_SELECTOR_V2_INTEGRATION_PLAN.md), actual worker,
Gateway, source/consent fences, guard and deployment procedure. No parallel
Integration system, bounded paid runner, batch/ledger or execution authorization
was created. Target remains **`petalpal-backend-test` only**, isolated from
Production with the existing normal-server zero budgets/manual execution.

**Hosted preflight remains BLOCKED** on actual TEST resource/source/binding
verification, schema/deployment reconciliation and a reviewed bounded runner.
The existing plan's five-migration discrepancy and startup migration effects
still need reconciliation against actual TEST state. Do not deploy this older
whole branch over an unknown newer schema; a later authorized integration must
apply the focused change to the exact reviewed compatible TEST source.

Selector V2 stays default OFF with its existing exact-contract requirement and
rollback. For an authorized future rollback of editorial factors, stop new work,
account for already-dispatched liability, and construct fresh workers with both
editorial flags false; constructor snapshots mean mutating an existing environment
object is insufficient. Restore the selector's own flag independently when that
is in scope. Preserve finalized reports, attempts/reservations and consumed
ledgers; toggles do not authorize regeneration or erase existing content.

Remaining risks: prompt/format effects on Claude are unmeasured; source order and
chronological aliases remain; budget-bound format fallback can limit comparisons;
structural validation cannot establish paraphrase entailment. New native tests do
not prove Linux-image, hosted-schema or live-provider acceptance. The existing
rubric and provisional E03 references govern future human review. Fluent, grounded
writing and blind preference still require separately authorized actual outputs.

## Changed files

- `lib/weekly-editorial.js`: optional factors, strict configuration and safe format fallback.
- `lib/sonnet-weekly.js`: existing service integration and named-setting snapshots.
- `test/back/weekly-editorial.test.js`: pinned OFF parity, bilingual factors, retention and byte boundaries.
- `test/back/sonnet-weekly.test.js`: actual-worker E03 matrix and affected safeguards.
- `test/back/opus-monthly.test.js`: extend existing Monthly parity test with both new Weekly flags.
- `SECURITY.md`: newly verified boundaries/evidence; no provider state upgrade.
- This report.

Original worktrees, frozen benchmarks, historical experiments, ledgers, readiness
and Integration planning documents are unchanged. `MANUAL_SECURITY_CHECKLIST.md`+remains unchanged because no provider/manual state changed.
