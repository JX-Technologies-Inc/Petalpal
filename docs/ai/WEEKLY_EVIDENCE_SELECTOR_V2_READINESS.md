# Weekly Selector V2 — final offline integration readiness

Verification target: `957c6c2de713e1c3b2219ab5d661c14971a747d3`.
Work: isolated `codex/weekly-selector-v2-readiness` branch/worktree, based on that exact commit.

**Assessment: GO for a future owner-approved controlled integration test.**
This follow-up changes tests and verification documentation only. All runtime code,
prompts, validators, schemas, dependency locks and deployment configuration remain
byte-identical to the target. No flag was enabled outside disposable synthetic tests.

## Runtime and tests

The downloaded official Darwin arm64 Node distribution was checked against its
published SHASUMS256 entry. Both it and the configured `node:24.21.0-bookworm-slim`
image report **Node v24.21.0, ICU 78.3**. Previous local evidence used Node 24.7.0 /
ICU 77.1. Linux image tests ran on arm64, with networking disabled, source and
installed dependencies mounted read-only, and disposable `/tmp` storage.
This verifies the configured Node version and image family, not a deployed service
or its actual architecture/configuration.

| Runtime / suite | Flag OFF | Flag ON | Failures |
|---|---:|---:|---:|
| Darwin Node 24.21.0, complete affected suite | 366 | 366 | 0 |
| Linux deployment image, selector/service/worker/Monthly/fence suite | 233 | 233 | 0 |

Counts include Node subtests. After the last Monthly cleanup-only change, its full
46-test file was rechecked natively with each flag state; unchanged runtime/other
regression evidence was reused. The test-only `PETALPAL_WEEKLY_SELECTOR_TEST_MODE`
passes explicit false/true settings into the actual worker factory for each matrix
case. Merely setting an ambient production flag would be ineffective in tests
that inject their own environment objects. Contract-specific v1/default-routing
regressions deliberately keep their explicit configurations in both runs.

The complete affected suite consists of these files, run with `--test-concurrency=1`:

- `test/back/weekly-evidence-selector-v2.test.js`
- `test/back/sonnet-weekly.test.js`
- `test/back/opus-monthly.test.js`
- `test/back/report-write-fence.test.js`
- `test/back/report-worker.test.js`
- `test/back/reflection-v2.test.js`
- `test/back/reflection-v2-validation-diagnostics.test.js`
- `test/back/reflection-v2-quotation-contract.test.js`
- `test/back/reflection-language-support.test.js`
- `test/back/ai-foundation.test.js`
- `test/back/zh-reflection-v2-weekly-gates.test.js`
- `experiments/weekly-evidence-selector-v2/selector.test.mjs`

Native invocation, repeated with OFF and ON:

```sh
cd /Users/xingranma/Documents/ChatGPT/jev/petalpal-weekly-selector-v2-readiness
env -i PATH="/tmp/petalpal-node-24.21.0/node-v24.21.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  PETALPAL_WEEKLY_SELECTOR_TEST_MODE=OFF \
  node --test --test-concurrency=1 \
  test/back/weekly-evidence-selector-v2.test.js \
  test/back/sonnet-weekly.test.js \
  test/back/opus-monthly.test.js \
  test/back/report-write-fence.test.js \
  test/back/report-worker.test.js \
  test/back/reflection-v2.test.js \
  test/back/reflection-v2-validation-diagnostics.test.js \
  test/back/reflection-v2-quotation-contract.test.js \
  test/back/reflection-language-support.test.js \
  test/back/ai-foundation.test.js \
  test/back/zh-reflection-v2-weekly-gates.test.js \
  experiments/weekly-evidence-selector-v2/selector.test.mjs
```

Linux runs use the first five files plus the historical offline selector tests,
`node --max-old-space-size=256 --test --test-concurrency=1`, and
`--test-skip-pattern='default-OFF|Monthly input matches pinned|unlocalized legacy'`.
Those three independent pinned-Git-reference checks run in the complete native
suite; the deployment slim image has no Git executable. Linux still runs the
actual V2 service routing and full worker suites. No check was changed to pass on
missing Git. Recorded results are in [readiness-results.json](../../experiments/weekly-evidence-selector-v2-candidate/readiness-results.json).

## Confirmed behavior

- Unset and literal `false` match the independently loaded pre-integration
  `171dbd555355934b19fb63b1b201db2d1c296a61` Weekly input and final packet exactly
  across all 28 frozen cases. The V1 selector function itself is unchanged.
- ON routes all 28 frozen cases through `ReportInputService` to the corrected
  selector. English still performs one supplied semantic retrieval; Chinese uses
  owner-scoped period memories without query embedding. Worker matrix cases prove
  the flag reaches that service through `createProductionAiWorker`.
- Actual Workers AI Weekly routing ignores this Weekly-only localized flag,
  including true/invalid values, and preserves the legacy generation version.
  Localized Weekly V2 selection requires literal true and `weekly-reflection-v2` together.
  Invalid/incompatible settings fail before retrieval/dispatch. The direct service
  reports configuration errors; Gateway intentionally sanitizes prepare-input
  errors to `AI_GATEWAY_INVALID_INPUT` at the worker boundary.
- Consent denial and source opt-out, foreign owners, Journal memories and the
  exclusive end of the time window prevent dispatch. Existing tests cover the
  inclusive start, invalid dates, stale/forged summaries, IDs, topics and importance,
  duplicate identities, exact text duplicates, and deterministic ordering.
- Both flag states reject late consent/epoch changes, source deletion/revision and
  locale changes. A failed evidence write or expired completion lease rolls back
  report/evidence/completion. Unknown references, malformed output and late replies
  cannot trigger repair/replay or persistence. Finalized reports are reused.
- Raw selected summaries and source Event/Memory identity pairs remain exact;
  persisted evidence belongs to the requesting owner. Provider packets contain
  allowlisted aliases/text/topics/days, without internal IDs/source fences. Payload
  collection stays disabled and dispatch attempts stay bounded at one.
- Candidate pool <=32, selected Events <=8, context <=4000 characters and minimum
  evidence 2 remain. Unicode-heavy packet and serialized-request tests retain the
  existing 8192-byte Gateway admission including its 1024-byte reserve. Enrichment
  cannot evict initial sources to make room.
- Monthly input matches its pinned implementation for unset/false/true/invalid
  Weekly flags. Actual Monthly worker request bodies, rendered claims and saved
  provenance are identical with the Weekly flag OFF/ON, for both supported locales
  and both existing Monthly output contracts. Monthly runtime files are unchanged.

## Selection comparison; no writing-quality claim

The full three-way frozen comparison on both Node 24.21.0 platforms is deeply equal
to the preserved [candidate artifact](../../experiments/weekly-evidence-selector-v2-candidate/results.json).
Neither that file nor the original V2 artifacts/fixtures were overwritten.

| Frozen editorial metric (12 cases) | V1 | Earlier offline V2 | Corrected candidate |
|---|---:|---:|---:|
| Sources retained / 56 | 44 | 56 | 54 |
| Meaningful evidence / 32 | 22 | 32 | 32 |
| Meaningful follow-ups / 10 | 0 | 10 | 10 |

All three retain 32 semantic-test sources and all 18 semantic targets across 16
cases. Corrected V2 preserves distinct topic coverage on every frozen case and
excludes the unrelated towel entry in Q01 in each language. Frozen maxima remain
1492 context characters and 4694 request bytes including reserve. Permutations and
reverse orders produce identical results; labels are measurement-only.

The new realistic seven-Event worker week is independently authored in English and
Simplified Chinese. V1 retains E1/E2/E3/E7; V2 also retains E5 (revision based on
specific feedback) and E6 (explicitly negated approval with unresolved missing
fees). It excludes E4, an unrelated coupon assigned the same broad topic. Both
retain all three initial topics. The proposal topic's share increases from 2/4 to
4/6, an intentional concentration trade-off for relevant follow-ups. Near-identical
negated corrections and contradictory experiences remain distinct in the existing
selector regression cases.

These are evidence-selection and grounding results. Mock output uses authored
literal quotations; it measures neither Claude writing nor native editorial
quality. No narrative improvement, emotional conclusion or coherent arc is inferred.

## Verification issues and focused fixes

Initial exploratory native test-file imports included three historical live-evaluation
runner test files. Their original-branch/runtime guards correctly refused this
candidate branch before evaluation; they are outside the affected production
selector suite. Their guards, pinned revisions and consumed ledgers remain unchanged.
Two new assertions initially expected the service's configuration error through the
worker; they were corrected to assert the existing Gateway sanitization and zero
dispatch. No runtime error handling was changed.

Initial broad Linux attempts lost the Monthly test process to memory pressure
(the first container recorded `oom_kill=1`); a smaller JS heap alone was insufficient.
Legacy invalid-config loops kept 9 Weekly / 12 Monthly PGlite fixtures open until
the parent test ended. Monthly additionally captured each PGlite instance in an
after-hook retained until file end, even after closing it. The cases now use awaited
subtests, and Monthly reuses the existing Weekly holder-and-clear cleanup pattern.
Every original assertion remains. Linux matrices were rerun after these test-only
fixes; the changed Monthly fixture was also rechecked natively in both flag states.
The 256 MiB old-space limit is a verification command setting, not production config.

## Decision and remaining limits

**GO for entry into a future controlled integration test after owner review.** No
remaining offline blocker was found on the tested localized Weekly v2 route.
The feature remains default OFF. Hosted/provider acceptance and any enabling
action remain subject to the owner's separately scoped review and authorization.

Lexical linkage remains conservative guidance: it can miss paraphrases or admit
unrelated records sharing specific words. A saturated initial allocation cannot
make room for later corrections; missing topics and budget pressure still limit
retention. The two-per-topic rule remains the initial selection heuristic, while
total Event/character/byte limits remain hard bounds. These known limits are not
new security bypasses and do not establish better prose.

A future controlled integration test must use the existing Anthropic Weekly route
and matching Weekly v2 contract, create a worker with the reviewed settings, and
review exact selected/cited sources, sparse behavior and native writing quality.
Judge semantic accuracy separately from editorial quality, and do not require an arc
or resolution unsupported by the evidence.
Hosted PostgreSQL lock scheduling and actual provider behavior were not exercised
by disposable PGlite/mocked-provider tests. Existing consent, budget, execution and
approval gates still apply. This assessment authorizes no integration action.

No Claude/embedding inference, paid requests, deployment, production database
access or production configuration change occurred. Historical evaluations and
consumed ledgers were preserved. Stop for owner review before enabling V2.

## Changed files

- `test/back/weekly-evidence-selector-v2.test.js`: expand actual-service ON routing from Q01 to all frozen cases.
- `test/back/sonnet-weekly.test.js`: explicit worker OFF/ON matrix, realistic weeks, safety/timeout/replay/budget/provenance checks, legacy-route invariance and fixture lifetime bounds.
- `test/back/opus-monthly.test.js`: actual Monthly request/claim/provenance invariance under Weekly flags; fixture lifetime and retained-reference cleanup only.
- `SECURITY.md`: newly verified offline runtime/safety evidence; no external/manual status changed.
- `docs/ai/WEEKLY_EVIDENCE_SELECTOR_V2_READINESS.md`: this assessment and verification scope.
- `experiments/weekly-evidence-selector-v2-candidate/readiness-results.json`: new runtime/benchmark summary; historical artifacts unchanged.
