# Weekly editorial-freedom evaluation — offline preparation

Prepared 2026-10-15. **NOT AUTHORIZED / NOT EXECUTED.** No provider call, credential
entry, real batch ledger or output directory has been created by preparation.

## Pinned scope

- Implementation: `ab52399656904f4f698c5f2d731f9b98d9b658ff`.
- Isolated checkout: `/Users/xingranma/Documents/ChatGPT/jev/petalpal-reflection-editorial-freedom-evaluation`.
- Branch: `codex/reflection-editorial-freedom-evaluation`.
- Runner: `scripts/reflection-editorial-freedom-evaluation.mjs`. Approve the exact
  clean commit containing this plan, reported separately after committing.
- Batch: `reflection-v2-weekly-editorial-freedom-ab523996`.
- Approval identifier: `APPROVE-2-WEEKLY-EDITORIAL-FREEDOM-AB523996-C01-C04-CALLS`.

| Order | Case | Output | Evidence | Requests |
| --- | --- | --- | --- | --- |
| 1 | C01 | English (`en`) | Frozen mixed-negation | 1 |
| 2 | C04 | Simplified Chinese (`zh-Hans`) | Frozen ordinary week | 1 |

Only this implementation's Weekly prompt/schema runs. There is no baseline,
Candidate, R2, UNV, Traditional Chinese output or Monthly execution arm. C01's
unchanged multilingual *source evidence* contains Traditional Chinese; this is
not a Traditional Chinese output case. Prior outputs are review references only,
never inserted into the model request. The two built evidence packets were compared
read-only with the preserved UNV packets and match exactly.

## Budget assumptions

Model: `claude-sonnet-5-5`, effort `low`, maximum output 2,048 tokens. The existing
standard-rate assumptions are US$2/million input and US$10/million output tokens.
The runner asserts their local configuration values (2,000 and 10,000 nanoUSD/token).

Per-call reservation: `ceil(8192 × 2000 × 1.25) + 2048 × 10000 = 40,960,000`
nanoUSD = **US$0.04096**. Exactly two planned calls reserve **US$0.08192**.
The 25% input reserve is the existing budgeting rule, not a provider surcharge.
Receipts estimate actual cost from reported uncached input/output usage at these
rates; no actual cost exists for this unexecuted batch.

This verifies the repository's assumptions and arithmetic, not current provider
billing. Before execution a human must freshly verify the applicable standard
rates, account, integration-only credentials and direct Sonnet 5.5 routing. If any
assumption differs or cannot be verified, stop; do not increase the cap or substitute
a model. Previous batch approvals and attestations do not authorize this batch.

## Gates and execution plan after separate approval

1. Obtain explicit owner approval of the exact runner SHA, two cases and US$0.08192
   cap with the identifier above. This document is not approval.
2. Confirm the dedicated branch, clean worktree, implementation ancestor and exact
   runtime (`lib/` and `server.js`), frozen evidence, ledger helper and diagnostics.
   Ensure no `.env`, existing new-batch ledger or existing artifact directory.
   Recheck that the shared artifact root is an operator-owned 0700 directory and
   not a symlink; stop on unsafe permissions rather than changing them implicitly.
3. Human-only fresh verification: exact `petalpal-integration` Gateway/account;
   retries, fallback, dynamic routing, caching and log/payload collection disabled;
   direct `claude-sonnet-5-5` routing; integration-only Gateway and Anthropic credentials;
   standard rates above. Record only the confirmation, never secrets/screenshots.
4. Use a private real Terminal with an empty environment plus the allowlisted
   runtime/approval metadata. `NODE_ENV=test`; no database, production or provider
   secret environment variables. Set the following non-secret gates only after
   the corresponding approval/verification. The macOS-only exact text-encoding
   metadata exception remains unchanged.

| Environment gate | Required value |
| --- | --- |
| `PETALPAL_FREEDOM_EVAL_APPROVAL` | Approval identifier above |
| `PETALPAL_FREEDOM_EVAL_COMMIT` | Exact approved full runner commit SHA |
| `PETALPAL_FREEDOM_EVAL_BUDGET_USD` | `0.08192` |
| `PETALPAL_FREEDOM_EVAL_GATEWAY_VERIFIED` | `petalpal-integration-no-retry-no-fallback-no-cache-verified` |
| `PETALPAL_FREEDOM_EVAL_SCOPE_VERIFIED` | `integration-only-credentials-direct-model-routing-standard-rates-verified` |

5. Only after these gates pass, the runner accepts hidden human Terminal entry of
   the account ID, integration Gateway token and integration Anthropic key. Never
   enter them in chat, shell arguments, files or tool-visible Terminal sessions.
6. The runner exclusively creates an append-only 0600 ledger under an owner-only
   0700 directory. It fsyncs each attempt before dispatch, then makes C01 followed
   by C04 sequentially. Each request has a 20-second fetch/body deadline, no
   redirects, one Gateway attempt, cache bypass and log/payload collection off.
   The checkout is checked again before every attempt.
7. Any failure stops the batch immediately, possibly before both planned calls.
   There is no retry, repair, fallback, resume, reset, replacement arm or budget
   refund. Even an empty/partial ledger is consumed. **Never rerun after dispatch.**
8. Save only validated synthetic prose/claims, frozen evidence and sanitized
   metadata/usage. Rejects keep fixed content-free `validationCode` diagnostics,
   never rejected text, thinking, raw provider envelopes, errors or credentials.
   Report each case, dispatched/completed counts, validation codes and estimated
   total cost, then use the [human review guide](REFLECTION_EDITORIAL_FREEDOM_REVIEW.md).

## Artifact locations (reserved names, absent during preparation)

Shared root: `/Users/xingranma/Documents/ChatGPT/jev/petalpal-appstore-release.git/petalpal-acceptance/`.

- Ledger: `reflection-v2-weekly-editorial-freedom-ab523996.jsonl`.
- Artifacts: `reflection-v2-weekly-editorial-freedom-ab523996/`.
- Validated prose: `review/prose/C01-FREEDOM.txt`, `review/prose/C04-FREEDOM.txt`.
- Validated claims: corresponding `review/claims/*-FREEDOM.json`.
- Frozen packets: `review/evidence/C01.json`, `review/evidence/C04.json`.
- `operator-metadata.json`: runner/implementation pins and arm mapping; no secrets.

All earlier ledgers/artifacts, including Traditional Chinese evidence, remain
untouched. No production, database, provider configuration or deployment change.

## Offline verification

- 20 runner tests: injected synthetic replies/disposable ledgers with native fetch
  trapped; fixed plan and old-approval rejection, third-call refusal, budget and
  receipt arithmetic, historical preservation, permissions/symlink refusal,
  durable attempt ordering, hidden data exclusion, schema/grounding diagnostics,
  envelope/usage/cache/HTTP limits, deadline/interruption and no replay/resume.
- 5 Weekly-only diagnostic parity/boundary tests (English and Simplified Chinese).
- Actual C01/C04 frozen packets equal preserved UNV packets; both earlier validated
  prose files exist. Transport, response normalization/validation, artifact writes,
  execution and hidden-input code equal the frozen UNV runner, apart from the new
  environment prefix in execution.
- Shared artifact root is owner-only, owned by the current user and not a symlink;
  the new ledger and artifact paths are absent.
- Runtime/source pins, syntax, staged diff hygiene and AST-only Graphify update.
  Implementation's 137 scoped passing cases are reused because runtime is unchanged.

Offline command (no credential entry, writes or network):

```sh
env -i PATH="$PATH" node scripts/reflection-editorial-freedom-evaluation.mjs check
```

Structural validity is separate from editorial quality. No quality improvement is
claimed until actual model outputs receive human review. Current preparation stops
for explicit owner approval; external gates above remain pending.
