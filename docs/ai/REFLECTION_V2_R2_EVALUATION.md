# Weekly Candidate vs Editorial R2 — isolated evaluation preparation

**OFFLINE CHECKED · OWNER APPROVAL PENDING · ZERO REAL REQUESTS · NO PRODUCTION CHANGE**

Prepared 2026-10-15 in branch `codex/reflection-v2-r2-evaluation`, worktree
`/Users/xingranma/Documents/ChatGPT/jev/petalpal-reflection-v2-r2-evaluation`.
This is a new synthetic batch, not a continuation of the consumed Stage 1 batch.
The original editorial and R2 worktrees, frozen commits, original ledger, mapping,
prose/claims and archive are preserved. The old evaluation scripts are unchanged.

## Exact comparison and scope

| Arm (operator only) | Frozen prompt commit |
|---|---|
| Previous Weekly Candidate | `c2d7a9d9a7d06f8291de5be7d890988fcdb5b9a8` |
| Weekly Editorial R2 | `99f471cb4345868cfc29de0395e52d7e93f17d43` |

| Case | Locale | Frozen evidence | Requests |
|---|---|---|---:|
| C01 | English (`en`) | Five mixed-language negation/mixed-feeling Events | 2 |
| C04 | Simplified Chinese (`zh-Hans`) | Four ordinary drawing/charcoal/friend Events | 2 |
| C05 | Traditional Chinese (`zh-Hant`) | Same five mixed-language Events as C01 | 2 |
| Total | Three locales | Same cases as original Stage 1 | **6** |

Evidence text, order, dates, empty topics, UTC weekdays, aliases and source mapping
reuse the frozen fixtures in `scripts/reflection-v2-editorial-plan.mjs`. Dates and
packet values match the original Stage 1 plan. C01/C05 use September 14, 15, 16, 18,
20, 2026; C04 uses September 14, 16, 18, 20. Each arm receives byte-identical packet,
model, schema and generation parameters; only the system prompt differs. Prompts
are extracted from the two pinned Git sources in a capability-free VM. Runtime
`lib/` must match R2 exactly; schema/packet/validator code must match between arms.
No Monthly cases, optional expansion or automatic follow-up exist in this runner.

## Exact maximum reservation

Model: `claude-sonnet-5-5`, `output_config.effort=low`, structured JSON schema,
**2,048 output tokens** per request, unchanged **20,000 ms** overall deadline
(including the response body), no temperature/top-p/top-k override, tools, batch,
fast mode or explicit cache writes. Gateway request deadline is 19,900 ms.

The existing `gatewayQuote` configuration reserves 8,192 input tokens at the
configured US$2/million input rate with a 1.25 input multiplier, plus 2,048 output
tokens at US$10/million:

`8192 × 2 / 1,000,000 × 1.25 + 2048 × 10 / 1,000,000 = US$0.04096/request`

**6 × US$0.04096 = US$0.24576 maximum batch reservation.** The runner requires
that exact cap; a lower or higher cap fails. Full serialized requests must fit the
unchanged Gateway admission allowance. The plan asserts the configured quote;
changed rates/settings require new review. This is a client-side reservation
under the attested standard-rate/no-extra-dispatch conditions, not independent
verification of provider billing, tax, retry configuration or dashboard limits.
The operator must reconfirm current standard rates and direct model routing before
attesting; no provider configuration is read or changed by this preparation.

## New batch and evidence storage

Batch: `reflection-v2-weekly-candidate-vs-r2-99f471cb`

Ledger:
`<git-common-dir>/petalpal-acceptance/reflection-v2-weekly-candidate-vs-r2-99f471cb.jsonl`

Artifacts:
`<git-common-dir>/petalpal-acceptance/reflection-v2-weekly-candidate-vs-r2-99f471cb/`

Both real paths are absent after offline preparation. Do not pre-create a real
ledger: exclusive creation consumes the batch. The approved execution will create
a fresh 0600 ledger and 0700 artifact directories, save the private operator
mapping and frozen evidence, then fsync each attempt before its sequential send.
Any empty, partial or completed ledger prevents another run; an existing artifact
directory also prevents execution. Crash, timeout or validation failure never
allows retry, repair, resume, replacement calls or a ledger reset.

A/B labels and dispatch order are independently randomized with balanced pairs;
there are six unique case/arm slots. Only validated synthetic prose and claims
are saved in `review/`, alongside source packets. Arm identities/commit mapping,
HTTP status, token/cost receipts and timings stay outside the blinded review
material. No headers, keys, raw provider envelopes/errors, thinking blocks or
rejected JSON are retained. Consequently a future rejected payload's exact failed
validation may again be unreconstructable; this preparation does not expand data
retention to solve the historical C05 failure.

## Safety and approval gates

- Default and `check` are offline: no secrets, database, ledger/artifact writes or
  transport. Live requires an explicit `live` argument; no stage arguments exist.
- The human owner must authorize this six-call comparison, the exact clean runner
  commit reported with the deliverable, and US$0.24576. Approval of the R2 prompt
  commit alone or an old Stage 1 approval does not authorize this new runner.
- Dedicated branch, R2 ancestry, exact prompt pins, unchanged runtime and full-plan
  equality are checked. Checkout HEAD/branch/cleanliness/common directory and
  `.env` absence are checked again before every send.
- `NODE_ENV=test`; environment allowlist only. No inherited CI, database, AI,
  provider, production, credential or Node injection variables. No `.env` loading.
- Both stdin and stdout must be TTYs. Integration-only account/token/key entry is
  human-controlled and hidden, only after approval/commit/budget/attestation gates.
  Do not paste secrets into chat or store them in files/environment variables.
- Fixed `petalpal-integration` Gateway and Anthropic messages endpoint; redirects
  rejected. Sends request max-attempts 1, skip-cache and payload/log collection off.
  Cached-token usage is refused. Operator independently confirms retry, fallback,
  dynamic routing and caching are disabled, integration-only credential scope,
  direct model routing and standard rates immediately before attesting.
- Six-call/exact-USD admission, no refunds or replacement slots; all attempts
  durable before transport. First failure/interruption/checkout change stops the
  batch. No database, deployment or production configuration action exists.
- Unchanged schema, canonical locale echo, references, quotes, digit support,
  length and coverage validation. Semantic fidelity, native prose and character
  script remain human review requirements, not guarantees of structural validity.

Required approval token:
`APPROVE-6-WEEKLY-CANDIDATE-VS-R2-C01-C04-C05-CALLS`

The human launch, only after explicit owner approval, uses a clean environment
with `NODE_ENV=test` and these nonsecret gates:

| Variable | Required value |
|---|---|
| `PETALPAL_R2_EVAL_APPROVAL` | Approval token above |
| `PETALPAL_R2_EVAL_COMMIT` | Exact final runner commit, not merely the R2 prompt commit |
| `PETALPAL_R2_EVAL_BUDGET_USD` | `0.24576` |
| `PETALPAL_R2_EVAL_GATEWAY_VERIFIED` | `petalpal-integration-no-retry-no-fallback-no-cache-verified` |
| `PETALPAL_R2_EVAL_SCOPE_VERIFIED` | `integration-only-credentials-direct-model-routing-standard-rates-verified` |

Do not set these attestations based on old screenshots. Preparation is not a
fresh provider verification and does not authorize setting them. Manual checklist
status is still NOT AUTHORIZED / NOT PERFORMED.

## Offline verification and editorial review

```sh
env -i PATH="$PATH" node scripts/reflection-v2-r2-evaluation.mjs check
env -i PATH="$PATH" node --test test/back/reflection-v2-r2-evaluation.test.js
```

Result: **OFFLINE_PREPARATION_PASS; 14 tests passed, 0 failed, 0 skipped; zero real
provider requests.** Tests trap native fetch, inject synthetic responses, use
private disposable temporary ledgers and remove only those test files. Coverage:
exact pinned scope and request parity; tampered plan rejection; environment,
TTY/approval/commit/branch/budget/attestation gates; historical-evidence separation;
label/order mapping; six-call cap; fsync before send; no replay of empty/partial or
completed ledgers; blinded/private outputs; error sanitization; invalid
JSON/schema/grounding/usage/cache/status/size rejection; deadlines including stalled
bodies and late noncooperative responses; interruption and changed checkout;
network-free CLI and rejection of expansion/resume/reset. No real ledger is created.

Reuse the R2 commit's accepted 73-test runtime evidence: no runtime, schema,
production configuration or dependencies change in this preparation. No model
quality is established by these mocked passes. The repository graph update is
AST-only and makes no AI requests.

Before unblinding, native reviewers should assess every claim against its cited
Events using the [existing editorial rubric](REFLECTION_V2_EDITORIAL.md): reject
unsupported facts, identity links, causes, emotional conclusions or “first attempt”
embellishments regardless of fluency. C01 emphasizes litotes, English rendering of
Chinese evidence and coherent prose; C04 checks natural direct Mandarin and
retention of the previous candidate's strengths; C05 checks native Traditional
phrasing, negation and correct quote handling. Check happiness and uncertainty
without inventing a shared cause or resolution. Compare factual accuracy,
naturalness, comfort, specificity and organization before viewing arm mapping.

If C01/C05 omit E1 or all of E2–E5, the receipt records editorial coverage as
UNASSESSED; do not treat that sample as a successful negation comparison or make
an extra request automatically. Structural success, editorial acceptance and any
later production decision remain separate. This small evaluation cannot establish
failure rates, broad stylistic variation or Monthly quality. It cannot recover the
lost historical C05 baseline response. Any further paid scope needs new approval.
