# Weekly editorial E03 OFF/ON evaluation — prepared, not run

Branch `eval/weekly-editorial-e03-sonnet-45af54bd`, pinned runtime revision
`45af54bd1e96c56361ab7d0f5c271513a804c1ae`. **No provider call has been made.
Running requires explicit owner approval.**

## Plan

| Case | Arm | Settings | Prompt | Packet |
|---|---|---|---|---|
| E03 en, E03 zh-Hans | baseline | both editorial flags unset (default OFF) | `REFLECTION_V2_INSTRUCTIONS.WEEKLY` | original weekday format |
| E03 en, E03 zh-Hans | candidate | both `"true"` | `WEEKLY_RETROSPECTIVE_INSTRUCTIONS` | `recordDays` separated |

- Model `claude-sonnet-5-5`, `max_tokens` 2048, effort low, timeout 20 s, Weekly v2 schema.
- Selector V2 is held fixed for both arms, so the only difference between arms is the two editorial flags. Both arms use the same 4 retained sources, refs, order and text.
  The plan fails closed if the candidate's separated format would fall back.
- Requests are built with the runtime's own `buildWeeklyReflectionV2Packet`, `weeklyEditorialSettings`,
  `weeklyEditorialInstructions` and `weeklyEditorialPacket`. Outputs go through the unchanged
  `validateReflectionV2` against each arm's exact packet/ref map.
- Synthetic frozen E03 data only: no database, service, user data, consent records or production.

## Budget

Per call: ⌈8192 × 2000 × 1.25⌉ + 2048 × 10000 = 40,960,000 nano-USD = **US$0.04096**.
**4 calls = US$0.16384 maximum** padded reservation (actual usage is expected to be lower).
The cap must be exactly `0.16384`. Changed model rates fail the plan.

## Safety controls (inherited from the editorial-freedom runner)

- Default/`check` is offline. `live` requires a TTY, `env -i` isolation with `NODE_ENV=test` and only allowlisted
  variables, no `.env`, the exact approval phrase, HEAD equal to the stated commit on this branch, a clean tree,
  Gateway/scope attestations and hidden-input Integration credentials.
- `lib`, `server.js`, `experiments/` and the shared ledger/diagnostic scripts must be byte-identical to the
  pinned revision, so historical evidence can't be changed.
- Fresh batch `weekly-editorial-e03-off-on-45af54bd`: the ledger is opened with exclusive create under
  `<git-common-dir>/petalpal-acceptance/`. An existing ledger or artifacts directory blocks the run. Prior ledgers are never opened.
- One attempt per arm; on the first failure the runner stops with no retry, repair or resume.
  Gateway headers: max-attempts 1, skip-cache, logging and payload logging off.
- Blind review: per-case random A/B labels and order. The mapping is written only to `operator-metadata.json`.
  Ledger and review files contain labels only. Thinking blocks, raw envelopes and credentials are never saved. Files are 0600, directories 0700.

## Operator commands (local, after approval)

```sh
node scripts/weekly-editorial-e03-evaluation.mjs check   # offline, 0 calls
env -i PATH="$PATH" TERM="$TERM" NODE_ENV=test \
  PETALPAL_WEEKLY_EDITORIAL_EVAL_APPROVAL=APPROVE-4-WEEKLY-EDITORIAL-E03-45AF54BD-OFF-ON-EN-ZH-CALLS \
  PETALPAL_WEEKLY_EDITORIAL_EVAL_COMMIT=<runner commit> \
  PETALPAL_WEEKLY_EDITORIAL_EVAL_BUDGET_USD=0.16384 \
  PETALPAL_WEEKLY_EDITORIAL_EVAL_GATEWAY_VERIFIED=<existing attestation> \
  PETALPAL_WEEKLY_EDITORIAL_EVAL_SCOPE_VERIFIED=<existing attestation> \
  node scripts/weekly-editorial-e03-evaluation.mjs live
```

Offline test: `test/back/weekly-editorial-e03-evaluation.test.js`. Native fetch is trapped and sends are injected.
Handcrafted E03 targets are used as response test doubles.
