# Reflection v2 staged editorial evaluation — offline preparation only

Starting evaluation commit verified: `4096f70f7e154c0433d86dd733b4e3bc029cf222`, clean worktree `petalpal-reflection-v2-editorial`, branch `codex/reflection-v2-editorial-quality`. Baseline prompts remain `d80ab522d77c0c8483b45a7827e2fbf5561f5ee0`; improved prompts remain `c2d7a9d9a7d06f8291de5be7d890988fcdb5b9a8`. The revised executor commit needs separate owner approval. No inference is authorized by this document. Final prompts, production runtime, historical real evidence and consumed ledgers are untouched.

## Smallest planned evaluation and stop points

Each row is one baseline/improved pair (two calls). Only the system prompt differs within a pair; evidence, locale, model, schema, token limits and all other parameters are identical. The full original 12-pair/24-call matrix remains available offline as an optional expansion. It is never executed by default or by the old unscoped `live` command.

| Stage | Cases | Model | Exact calls on success | Maximum reservation |
|---|---|---|---:|---:|
| 1 | C01, C04, C05 | claude-sonnet-5-5 | 6 | **US$0.24576** |
| 2, separately approved after Stage 1 review | C08, C09, C12 | claude-opus-5-5 | 6 | **US$0.98304** |
| 3, only justified selected pairs | Explicit subset of C02, C03, C06, C07, C10, C11 | Per selected case | 2 × selected pairs | Exact sum; no default allocation |

Stages 1 + 2 would cost at most **US$1.22880 reserved for 12 calls**, half the original reservation. Stage 1 is the only initial request. Stage 2 is not pre-authorized, even if Stage 1 completes technically. A failure stops a stage before its planned count; there are no replacement calls.

| Case | Report | Locale | Evidence | Planned stage |
|---|---|---|---|---|
| C01 | Weekly | en | M | 1 |
| C02 | Weekly | en | O-en | Optional targeted 3 |
| C03 | Weekly | zh-Hans | M | Optional targeted 3 |
| C04 | Weekly | zh-Hans | O-zh-Hans | 1 |
| C05 | Weekly | zh-Hant | M | 1 |
| C06 | Weekly | zh-Hant | O-zh-Hant | Optional targeted 3 |
| C07 | Monthly | en | M | Optional targeted 3 |
| C08 | Monthly | en | O-en | 2 |
| C09 | Monthly | zh-Hans | M | 2 |
| C10 | Monthly | zh-Hans | O-zh-Hans | Optional targeted 3 |
| C11 | Monthly | zh-Hant | M | Optional targeted 3 |
| C12 | Monthly | zh-Hant | O-zh-Hant | 2 |

Selection rationale: Stage 1 exercises English negation/litotes and Traditional Chinese emotional nuance, while Simplified Chinese ordinary experiences probe the documented risks of artificial language, chronological inventory and unsupported drawing identity links. Stage 2 reverses the scenario in each locale: ordinary English/Traditional Chinese experiences test Monthly narrative restraint; Simplified Chinese tests mixed feelings and negation across weeks. Across six pairs, every locale has both scenarios and both report types. This deliberately does not cover every scenario × locale × report interaction; the unused counterpart cases are available only if that missing coverage matters to an observed uncertainty.

## Exact unchanged synthetic evidence

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

## Offline checks and implementation

```sh
env -i PATH="$PATH" node scripts/reflection-v2-editorial-plan.mjs
env -i PATH="$PATH" node scripts/reflection-v2-editorial-evaluation.mjs check stage1
env -i PATH="$PATH" node scripts/reflection-v2-editorial-evaluation.mjs check stage2
env -i PATH="$PATH" node scripts/reflection-v2-editorial-evaluation.mjs check stage3 C02
env -i PATH="$PATH" node --test test/back/reflection-v2-editorial-evaluation.test.js
```

The plan generator and executor's default/`check` modes are network-free, with no credential prompts, database access or ledger creation. Default/`check` without a stage inspects the optional full matrix only. Stage 3 requires a nonempty, unique case list in the table's canonical order; no implicit selection is allowed. Checks print the exact scope, reservation and approval string for later owner review.

The existing executor reuses frozen production packet/schema/validation/pricing code and Gateway conventions. It uses synthetic evidence and a local cost ledger, not a database. It does not test production consent, persistence, worker locking or saved-report behavior. No database provisioning or migrations are needed. The historical single-call runner and its ledger must not be repurposed for these stages.

Targeted staged validation: **20 mocked tests passed, 0 failed; ZERO real provider calls**. This includes exact complementary case selection, rejection of old/full/wrong-stage approvals, stage budgets and call limits, prerequisite evidence and review gates, one-pair early follow-up, and an optional 24-response matrix exercised through three separately approved mocked invocations. Existing tests still cover sequential dispatch, durable attempts before network, fsync failure, exhausted budgets, consumed ledgers, interruption, invalid/oversized responses, unexpected cache use, changed checkout and private blinded artifacts. Weekly and Monthly retain the **20,000 ms** deadline, including stalled bodies and noncooperative late responses. Monthly still caps output at **4,096 tokens**. Native fetch is trapped in tests, including CLI subprocesses. No live ledger was created or consumed; all test artifacts were disposable synthetic files.

### Earlier preparation validation, retained for history

The following record belongs to the original 24-call executor at `4096f70f`, not a new live evaluation:

Offline validation on 2026-10-15: **24 tests passed, 0 failed** (16 paired-executor tests plus 8 existing single-call gate tests), with **zero real provider calls**. The full-batch test supplied all 24 responses through injected mocked transport. Test ledgers and artifacts were confined to disposable synthetic temporary directories; no live ledger was created or consumed.

## Reservation calculation and unchanged model settings

Both arms use the same model, `output_config.effort=low`, JSON schema and 20,000 ms deadline. No temperature/top-p/top-k overrides, tools, fast mode, batching or explicit cache writes.

| Use | Input allowance | Output cap | Reservation/call | Reservation/pair |
|---|---:|---:|---:|---:|
| Weekly Sonnet | 8,192 | 2,048 | US$0.04096 | **US$0.08192** |
| Monthly Opus | 16,384 | 4,096 | US$0.16384 | **US$0.32768** |

Calculation uses `gatewayQuote`: input allowance × input rate × 1.25, plus output cap × output rate. Standard rates checked against official [Sonnet documentation](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) and [Opus documentation](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5): respectively US$2/10 and US$4/20 per million input/output tokens. The input allowance is the application's conservative byte-based admission proxy, not a tokenizer or guaranteed final invoice. No cache discount is assumed.

Each live stage requires a cap **equal to its exact full reservation**; higher/lower caps fail closed. Stage 3 requires a new, explicitly approved case list and its calculated budget: US$0.08192 per Weekly pair plus US$0.32768 per Monthly pair. Start with one pair when it answers the unresolved question. All six unused pairs would add US$1.22880/12 calls; that is a maximum optional expansion, not a recommendation or default. Across all three stages, unique pairs cannot exceed the original **24 calls / US$2.45760 reservation**, below the old US$2.46 ceiling. No prior budget authorization carries into a new stage.

Owner must verify current model access, standard rates and no additional paid Gateway features/charges before approval. Changed rates, caps, models or routing require a revised plan, not automatic spending. Real Opus latency and editorial quality remain unverified.

## Fail-closed execution and separate authorization

A human owner must approve the exact revised executor commit, selected stage/cases, call count and exact budget. This future Stage 1 example is **not authorization to execute now**:

```sh
env -i PATH="$PATH" NODE_ENV=test \
  PETALPAL_EDITORIAL_APPROVAL=APPROVE-STAGE1-6-REFLECTION-V2-CALLS-C01-C04-C05 \
  PETALPAL_EDITORIAL_COMMIT=OWNER_APPROVED_40_HEX_EXECUTOR_COMMIT \
  PETALPAL_EDITORIAL_BUDGET_USD=0.24576 \
  PETALPAL_EDITORIAL_GATEWAY_VERIFIED=petalpal-integration-no-retry-no-fallback-no-cache-verified \
  PETALPAL_EDITORIAL_SCOPE_VERIFIED=integration-only-credentials-direct-model-routing-standard-rates-verified \
  node scripts/reflection-v2-editorial-evaluation.mjs live stage1
```

Do not auto-fill the commit from arbitrary HEAD. No `.env`, inherited provider/database/CI variables or non-TTY credential entry is allowed. The human enters integration-only Cloudflare account/Gateway token/Anthropic key through hidden private terminal prompts. No keys, tokens, authorization headers, thinking blocks or provider error bodies are saved or printed.

| Requested scope | Separate approval | Budget | Additional human attestation |
|---|---|---|---|
| `live stage2` | `APPROVE-STAGE2-6-REFLECTION-V2-CALLS-C08-C09-C12` | `0.98304` | `PETALPAL_EDITORIAL_REVIEW=stage1-blind-reviewed-clear-for-monthly` |
| Example only: `live stage3 C02` | `APPROVE-STAGE3-2-REFLECTION-V2-CALLS-C02` | `0.08192` | `PETALPAL_EDITORIAL_REVIEW=prior-stages-blind-reviewed-targeted-followup-justified` |

For Stage 2, the attestation means qualified independent reviewers have locked and adjudicated Stage 1 scores, found no material candidate factual error or meaningful language regression, and judged Monthly spending justified. For Stage 3, it means reviewers have assessed all completed earlier stages, identified a specific unresolved risk or contradiction, and justified the selected minimum follow-up. Poor candidate performance requires STOP and the smallest justified revision, not an expansion attestation. Retain the signed/dated scoring sheets with the coordinator before approving either attestation. The executor records the attestation but cannot independently prove human review or remote configuration.

Stage 2 requires a complete, assessed Stage 1 ledger from the same approved executor commit; Stage 3 requires complete, assessed Stage 1 and, if present, complete Stage 2. Missing, partial, corrupt, wrong-commit or unassessed predecessor evidence blocks execution. A completed ledger is only a technical prerequisite, never editorial approval. Stage 3 may be separately approved after Stage 1 alone to resolve a narrow uncertainty without buying six Opus calls. It can select only the six reserved optional cases. If that early Stage 3 is used, this executor blocks later Stage 2: review the new evidence and prepare a separately approved follow-on plan if warranted. Stage 3 itself is a single one-time allocation and cannot be resumed or expanded by a second invocation.

Execution protections:

- Independent fixed ledgers `<git-common-dir>/petalpal-acceptance/reflection-v2-editorial-paired-c2d7a9d9-stage1.jsonl`, `-stage2.jsonl`, and `-stage3.jsonl`. Exclusive creation, `O_APPEND`, fsync of each attempt before dispatch, private 0600 files/0700 directories. A stopped, partial or even empty ledger consumes that stage. Later stages never modify predecessor ledgers.
- The original `reflection-v2-editorial-paired-c2d7a9d9.jsonl` and artifact directory are never read for results, reused or reset. If either exists, staged execution fails closed to avoid duplicating an older evaluation. The unrelated historical `zh-weekly-v2-sonnet-live.jsonl` remains untouched.
- Exactly one HTTP attempt per selected case/arm, sequentially. Enforce pinned cases/models/schema/settings and cumulative reservations before every send, and recheck approved commit/clean checkout and predecessor gates. No automatic next stage, retry, resume, repair, fallback, refund or replacement of an ambiguous call.
- Fixed `petalpal-integration` Anthropic endpoint, `redirect: error`, max-attempts 1, cache skip, logging disabled, Gateway timeout header 19,900 ms and client deadline 20,000 ms. Response limits remain 512 KiB envelope / 32 KiB generated JSON. Unexpected cache usage or invalid model/schema/usage stops the batch. These headers require separate owner verification of actual Gateway retry/fallback/cache/direct-routing settings; they do not prove remote behavior.
- Abort on SIGINT/SIGTERM, timeout, provider/validation error or storage failure. Record sanitized failure code, latency, token usage and estimated cost when known. Do not repeat an ambiguous attempt. A hard kill leaves its fsynced ledger consumed. Missing Weekly mixed-negation coverage is recorded as `UNASSESSED` and blocks progression; generated text is never repaired.

## Blinded artifacts and evidence-driven decisions

Artifacts use the matching stage directory beside its ledger. `operator-mapping.json` holds private randomized A/B identities and independent generation order. Within each invocation adjacent selected pairs are counterbalanced; an odd final pair is randomized. A three-pair stage therefore has a 2:1 or 1:2 balance, not a claimed per-locale balance. The stored mapping reproduces identities/order. Labels from one stage do not imply identities in another.

Reviewers receive only `review/prose/Cxx-A.txt` / `Cxx-B.txt` first, then `review/claims/*.json` and `review/evidence/*.json` for factual audit, plus the [blind scoring sheet](REFLECTION_V2_BLIND_SCORE_SHEET.md). Keep mapping, prompts, timing, usage, model metadata and operator runbook private until scores are locked. File permissions and clone-local ledgers are not cross-machine authorization enforcement.

Use two independent qualified native-language reviewers per locale, with a blinded third reviewer to resolve disagreements. Assess naturalness, factual fidelity, specificity/personalization, emotional comfort and stylistic variation. A major unsupported claim automatically fails the sample. Stop on candidate material factual error or meaningful language regression and recommend the smallest justified revision before further paid calls.

Across the six fixed Stage 1 + Stage 2 pairs, **at least 5/6 improved-prompt preferences with no material errors or meaningful language regression** is only a preliminary positive signal. Ties are not wins. Stage 1 alone cannot meet this threshold. The sample is too small and too familiar to establish universal or production quality. Production remains default-off.

For inconclusive results, first adjudicate existing outputs without inference. Then name the unresolved question and propose the minimum unused pair(s): C02/C06 for ordinary Weekly voice and drawing identity in English/Traditional Chinese; C03 for Simplified Chinese Weekly negation; C07/C11 for English/Traditional Chinese Monthly negation and unsupported temporal interpretation; C10 for Simplified Chinese Monthly ordinary specificity and identity links. Prioritize the affected language/report/scenario, not filling the matrix. Keep exploratory follow-ups separate from the preselected 5/6 denominator. If no unused fixture addresses the question, report inconclusive and propose a new reviewed plan rather than repeat a call.

Remaining prerequisites: explicit stage-specific owner authorization of the new executor commit and budget; real Gateway/credential/pricing verification by the owner; unused stage ledger/artifact paths; completed predecessor evidence where required; qualified reviewers and locked human review decisions before further approval. **ZERO paid calls are authorized or performed during this preparation.**
