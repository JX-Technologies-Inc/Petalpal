# Reflection v2 paired editorial evaluation — preparation only

Verified starting point on 2026-10-15: worktree `petalpal-reflection-v2-editorial`, branch `codex/reflection-v2-editorial-quality`, prompt commit `c2d7a9d9a7d06f8291de5be7d890988fcdb5b9a8`. Baseline prompt source: `d80ab522d77c0c8483b45a7827e2fbf5561f5ee0`. The preparation-only executor commit must be approved separately. Final prompts, runtime code, historical evidence and live ledgers are untouched. No provider call, database connection, migration or deployment has occurred during this preparation.

## Exact cases and comparison

Twelve **paired cases require 24 fresh calls**, one baseline and one candidate per case. The historical Chinese Weekly sample has different evidence and cannot substitute for a baseline arm. Offline authored reference prose is not a model baseline.

| Case | Type | Output locale | Evidence |
|---|---|---|---|
| C01 | Weekly | en | M |
| C02 | Weekly | en | O-en |
| C03 | Weekly | zh-Hans | M |
| C04 | Weekly | zh-Hans | O-zh-Hans |
| C05 | Weekly | zh-Hant | M |
| C06 | Weekly | zh-Hant | O-zh-Hant |
| C07 | Monthly | en | M |
| C08 | Monthly | en | O-en |
| C09 | Monthly | zh-Hans | M |
| C10 | Monthly | zh-Hans | O-zh-Hans |
| C11 | Monthly | zh-Hant | M |
| C12 | Monthly | zh-Hant | O-zh-Hant |

M reuses five complete existing synthetic Events, in this order:

1. I finally fixed the bug today, but I'm still worried about tomorrow's demo. I tested the login screen twice; the demo has not happened yet.
2. I was not a little happy about the result.
3. 我不是不想去，只是还没决定。
4. I did not say I stopped drawing.
5. 我沒有覺得事情變好了。

O reuses the four localized drawing Events from `test/back/opus-monthly.test.js`:

| Event | O-en | O-zh-Hans | O-zh-Hant |
|---|---|---|---|
| E1 | I finished a sketch. It was a quiet afternoon. | 今天画完了一幅素描。那个下午很安静。 | 今天畫完了一幅素描。那個下午很安靜。 |
| E2 | I shared my drawing with a friend. | 我把画分享给朋友，聊了彼此的近况。 | 我把畫分享給朋友，聊了彼此的近況。 |
| E3 | I tried charcoal in the studio. | 在画室试用了炭笔。 | 在畫室試用了炭筆。 |
| E4 | I kept the drawing on my desk. | 把画留在了书桌上。 | 把畫留在了書桌上。 |

All dates are September 2026 at 12:00 UTC, timezone UTC, with empty topics. Weekly M dates: 14, 15, 16, 18, 20; Weekly O: 14, 16, 18, 20. Monthly M: 02, 09, 16, 23, 27; Monthly O: 02, 09, 16, 27. Monthly evidence spans four represented weeks; the two final M Events share W4. No previous-month evidence. Stable aliases E1 onward. The ordinary variants are locale-specific fixtures, not exact translations of one another; baseline and candidate within each pair receive byte-identical evidence.

## Verified preparation runner

```sh
env -i PATH="$PATH" node scripts/reflection-v2-editorial-plan.mjs
```

This is a **network-free preparation check, not a live executor**. It has no live mode, credentials, database or ledger access. It loads the baseline instruction strings directly from the pinned Git object, uses unchanged production packet/schema code, and constructs all 24 requests in memory. Assertions verify pinned prompt source, branch and candidate ancestry, unchanged runtime dependencies, no dropped/truncated Events, identical request bodies except system instructions, four-week Monthly coverage, and complete request byte admission with existing framing allowance. A later preparation-only commit is permitted, but future live execution must separately pin its reviewed runner revision. Result: PASS, 12 pairs, 24 planned calls, zero actual calls. The CLI rejects `live` before preparation.

The new executor is `scripts/reflection-v2-editorial-evaluation.mjs`. Its default mode and `check` mode are network-free and never open a ledger or prompt for credentials. The original plan generator remains available unchanged in purpose; its existing fixture arrays are now protected against caller mutation.

```sh
env -i PATH="$PATH" node scripts/reflection-v2-editorial-evaluation.mjs check
env -i PATH="$PATH" node --test test/back/reflection-v2-editorial-evaluation.test.js test/back/zh-reflection-v2-weekly-gates.test.js
```

Targeted tests cover all 24 mocked responses, exact paired bodies and case list, preflight rejection, cumulative budget exhaustion, duplicate/25th attempts, exclusive ledgers, an attempt-fsync failure, mid-batch transport failure, malformed/oversized/refused/ungrounded responses, token limits, unexpected cache usage, interruption, consumed/partial ledgers, changed checkout, blind mapping and secret-free artifacts. Weekly and Monthly both use fake timers to verify the unchanged **20,000 ms** deadline, including body stalls and noncooperative late responses. The Monthly output cap remains **4,096 tokens**. Native fetch is trapped in tests; CLI checks also run with a network trap. These checks do not establish real Opus latency or human prose quality.

Offline validation on 2026-10-15: **24 tests passed, 0 failed** (16 paired-executor tests plus 8 existing single-call gate tests), with **zero real provider calls**. The full-batch test supplied all 24 responses through injected mocked transport. Test ledgers and artifacts were confined to disposable synthetic temporary directories; no live ledger was created or consumed.

## Models and maximum reservation

Use production defaults identically in both arms: `claude-sonnet-5-5` for Weekly, `claude-opus-5-5` for Monthly; `output_config.effort=low`; the same JSON schema; 20,000 ms deadline; no temperature/top-p/top-k overrides, tools, batching, fast mode or explicit cache writes.

| Model/use | Calls | Reserved input allowance | Output cap | Reservation/call | Total |
|---|---:|---:|---:|---:|---:|
| Sonnet / Weekly | 12 | 8,192 | 2,048 | US$0.04096 | US$0.49152 |
| Opus / Monthly | 12 | 16,384 | 4,096 | US$0.16384 | US$1.96608 |
| Complete paired evaluation | 24 | | | | **US$2.45760** |

Calculation uses `gatewayQuote`: input allowance × input rate × 1.25, plus output cap × output rate. Standard rates checked against official [Sonnet documentation](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) and [Opus documentation](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5): respectively US$2/10 and US$4/20 per million input/output tokens. The input allowance is the application's conservative byte-based admission proxy, not a tokenizer or guaranteed final invoice. No cache discount is assumed.

Proposed owner ceiling: **US$2.46**, at most 24 sends. This is a requested future ceiling, not authorization. Twelve candidate-only outputs would reserve US$1.22880 but would not provide the requested paired comparison. Stop and recalculate if rates, models, output caps or Gateway routing change. Confirm no additional paid Gateway feature/tax is included in the intended budget; the calculation covers inference reservations only.

## Safe execution method and verified infrastructure limits

The existing exact live runner is `scripts/zh-reflection-v2-weekly-acceptance.mjs live-weekly`. It supports only zh-Hans Weekly, one Sonnet call, one fixed ledger and a cap no higher than US$0.05. It deliberately leaves Monthly unconfigured. **Do not run it repeatedly, widen its old approval, or reset its ledger to execute this matrix.** The old offline shell wrapper is also unsuitable: it checks another branch and runs migrations/container cleanup, which are outside this request.

The new executor performs direct synthetic prompt evaluation with **no database**. It reuses the frozen plan, production schema compiler and Reflection validator, pricing helpers and existing Gateway attestation. Its transport follows the existing Gateway client's wire format, headers, Anthropic envelope checks and response bounds (512 KiB response / 32 KiB generated JSON). The production client requires a Prisma cost/consent database, so the executor uses its own narrowly scoped batch ledger instead; it does not claim to exercise production consent, persistence, owner readback or SQL locking. The ledger follows the existing exclusive/fsync pattern and adds `O_APPEND`; the historical single-call helper and ledger are unchanged.

Implemented behavior, verified with mocked transport:

1. Pin reviewed runner source plus both prompt commits; accept only a clean approved checkout. Refuse inherited provider/database configuration, `.env`, CI and missing explicit owner authorization. Human operator enters integration-only secrets through a hidden TTY; never arguments, logs, chat or saved artifacts.
2. Allowlist the `petalpal-integration` Anthropic Messages endpoint. Retain `cf-aig-max-attempts: 1`, `cf-aig-skip-cache: true`, disabled payload logging, `redirect: error`, the existing bounded response reader and deadline. Human operator verifies Gateway retries, fallbacks, caching and routing separately; a header alone cannot prove upstream configuration.
3. Create the **new, fixed batch ledger** `<git-common-dir>/petalpal-acceptance/reflection-v2-editorial-paired-c2d7a9d9.jsonl` using exclusive create, append-only writes and fsync. Never touch `zh-weekly-v2-sonnet-live.jsonl`. Record the approved complete schedule's reservation once, then debit each attempt conservatively before dispatch. Before each send, fsync case, arm, model, output cap and cumulative liability; never credentials or raw request headers. A consumed, empty or partial batch ledger blocks all reruns. A crash, timeout, refusal, invalid JSON or validation failure consumes that attempt; no refund, repair, fallback, retry or automatic resume. Disk failure prevents dispatch; the existing ledger continues to block replay even if a final stop entry cannot be written.
4. Sequential sends, at most two distinct arms per case and 24 total, with per-model caps and total US$2.46 enforcement before dispatch. Stop the batch on a transport/provider/validation failure and retain partial results; do not spend remaining authorization on replacement samples. Any recovery needs a new scoped approval; do not erase old evidence.
5. Preserve the exact synthetic packet and generated sentence citations. Record technical validation, usage, reservation, latency, response model and failure codes independently of prose scores. Write only synthetic output and sanitized metadata to private evaluation artifacts. Native reviewers receive the blinded material, not prompts, arm identities, cost/latency hints or the mapping key.

Exactly one HTTP attempt is permitted **per case/arm**, meaning two per paired case. Neither a failed arm nor a missing sample can be replaced within this authorization. The executor requires zero reported cache read/write tokens; unexpected cache usage stops the batch. Malformed/unvalidated generated text and provider error bodies are not saved. A structurally valid output missing the sheet's additional Weekly mixed/negation coverage is recorded as `UNASSESSED`; it is not repaired or treated as complete editorial acceptance.

Before live execution, an owner must explicitly approve the exact **executor commit** (not merely the earlier prompt commit), 24 calls and the cap. This command is a future owner-run procedure, **not authorization to execute it now**. Replace the literal commit placeholder only with the owner's approved full SHA; do not auto-fill it from arbitrary current HEAD.

```sh
env -i PATH="$PATH" NODE_ENV=test \
  PETALPAL_EDITORIAL_APPROVAL=APPROVE-24-PAIRED-REFLECTION-V2-CALLS \
  PETALPAL_EDITORIAL_COMMIT=OWNER_APPROVED_40_HEX_EXECUTOR_COMMIT \
  PETALPAL_EDITORIAL_BUDGET_USD=2.46 \
  PETALPAL_EDITORIAL_GATEWAY_VERIFIED=petalpal-integration-no-retry-no-fallback-no-cache-verified \
  PETALPAL_EDITORIAL_SCOPE_VERIFIED=integration-only-credentials-direct-model-routing-standard-rates-verified \
  node scripts/reflection-v2-editorial-evaluation.mjs live
```

The attestations require actual human verification of integration-only credentials, direct routing to the pinned models, standard rates, retries/fallbacks disabled and caching disabled. They do not inspect or prove remote settings. Live also requires a clean expected branch, approved HEAD, no `.env`, no inherited provider/database/CI variables and a private terminal. Only then are the integration account, Gateway token and Anthropic key requested through hidden TTY input. Neither keys nor headers are saved. SIGINT/SIGTERM stop an active batch; a hard kill leaves the already-fsynced ledger consumed. The exact commit and clean state are rechecked before every attempt.

Artifacts are created exclusively under `<git-common-dir>/petalpal-acceptance/reflection-v2-editorial-paired-c2d7a9d9/` with 0700 directories and 0600 files:

- `operator-mapping.json`: protected A/B-to-arm mapping and separately counterbalanced generation order. The stored map reproduces the assignment; it must not enter the reviewer bundle.
- `review/prose/Cxx-A.txt` and `Cxx-B.txt`: validated synthetic narratives only.
- `review/claims/Cxx-A.json` and `Cxx-B.json`: sentence citations for the second review pass.
- `review/evidence/Cxx.json`: exact shared synthetic input packet.
- The sibling batch ledger holds timing, model, usage, estimated costs, coverage and failure metadata. Keep it with the coordinator, not reviewers.

Give reviewers only `review/` and a copy of the unchanged scoring sheet, revealing evidence/claims after their first prose pass. Existing artifacts or ledgers are never overwritten. File permissions and a clone-local ledger do not prevent the owner from copying files, deleting controls or running another clone; they are not cross-machine authorization enforcement.

If full worker/persistence revalidation is required instead, the existing runner requires a **fresh, empty, already schema-initialized disposable PostgreSQL with pgvector**, loopback host `127.0.0.1`, port `55432`, exact database name `petalpal_acceptance_v2_live_test`, and generated Prisma Client. It rejects existing user/audit rows. These are the existing single-case requirements, not proof that an available database meets them. A matrix adapter would need separately named fresh isolation and unique synthetic owners/jobs for each arm to avoid saved-report reuse. No database availability or credentials were inspected; provisioning/migrations remain separately authorized prerequisites. No production DB may be used.

## Independent human acceptance and remaining prerequisites

Use the separate [blind scoring sheet](REFLECTION_V2_BLIND_SCORE_SHEET.md); reviewers must not see this operator plan or the prompt diff until scores are locked. A coordinator randomizes A/B separately for each pair, balanced within each type/locale (one baseline-A and one baseline-B across M/O); generation order is separately counterbalanced. Keep the mapping outside the reviewer bundle. Two independent reviewers per locale must be fluent in the output register and able to read the mixed-language sources. Neither prompt author nor generation model can supply independent acceptance. Resolve disagreements with a third reviewer while still blinded.

Remaining prerequisites: review and explicitly approve the committed executor revision; owner confirms integration credentials, model access, standard pricing and Gateway no-retry/no-fallback/no-cache/direct-routing configuration; confirm the fixed new ledger and artifact paths are unused; recruit independent bilingual/native reviewers; explicitly authorize the 24-call/US$2.46 scope. No live call is authorized by this document. Production remains default-off, even if the editorial evaluation passes. This small reused-fixture study is a directional paired check, not a statistically conclusive or unseen-data production evaluation.
