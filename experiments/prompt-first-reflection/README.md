# Prompt-first Claude reflection evaluation

Offline preparation only. No provider transport, credential lookup, route, database, report persistence or production eligibility. Requires Node 24 and the repository's existing dependencies (`npm ci --ignore-scripts` in a clean isolated checkout if needed). Do not load `.env`.

```sh
node experiments/prompt-first-reflection/prepare.mjs
node experiments/prompt-first-reflection/prepare.mjs --requests > /tmp/petalpal-synthetic-requests.json
node --test experiments/prompt-first-reflection/test.mjs
node experiments/prompt-first-reflection/render-examples.mjs
node experiments/prompt-first-reflection/acceptance.mjs   # 36-case plan and reservation only
node --test experiments/prompt-first-reflection/acceptance.test.mjs
```

`--requests` emits 120 real Anthropic Messages API body shapes, with credential-free headers and relative Gateway path. They are **not sent**. Bind the existing authenticated Gateway URL and credentials only inside a separately approved trusted runner. There is deliberately no `--send` flag. `dataset: synthetic` is a caller assertion, not a private-data detector; the CLI accepts only the committed fixtures, never a file upload, database query or arbitrary Event input.

[Design, source review, acceptance and limitations](../../docs/ai/PROMPT_FIRST_REFLECTION.md). [Readable comparisons](../../docs/ai/PROMPT_FIRST_EXAMPLES.md). [Full system prompts](../../docs/ai/PROMPT_FIRST_SYSTEM_PROMPTS.md).

## Modules

- `prompts/shared-v1.txt` + report-specific versioned suffix: exact system prompt assembled by `systemPrompt`. Shared changes require version review for both prompts; versions are fixed for this experiment.
- `experiment.mjs`: synthetic source admission, minimized alias-only user packet, wire/local schema, provider request construction and structural review. Original source/memory IDs, owner and revisions stay in its private closure. No mutable input reference is retained.
- `fixtures.mjs`: 20 authored scenarios, 73 source Events; Weekly uses the first two (or fewer), Monthly uses up to four. All three locales see byte-identical evidence. Dates are synthetic fixture choices, never translations of source-relative time.
- `examples.mjs`: six manually authored writing targets. Not used as a semantic acceptance registry or supplied as few-shot examples.
- `acceptance.mjs`: approval-gated runner for the 36-case first batch. Checks that request-construction sources match the approved commit, then runs model and token-count preflight, serial single attempts, a no-replay ledger (`wx`, fsync before dispatch), 20 s/64 KiB/20 min limits, usage/budget stops and sanitized results. A live run (no `mockLedgerPath`) always uses the fixed `~/.petalpal-acceptance/<commit>.jsonl` and accepts no other option, so a new path cannot start a second live run. Mocked runs must name their own ledger and are labelled `MOCK`. It has no transport: after authorization, a trusted caller injects the Gateway-bound one. Verified only with mocked transports (`acceptance.test.mjs`). The tests need git history containing that commit; CI runs them via `.github/workflows/prompt-first-acceptance-mock.yml` with `npm ci`.

**Runner limits.** The fixed ledger only blocks a second live run for one OS user on one machine. It is **not** cross-machine replay prevention: another machine, a different HOME or a deleted ledger file can start again. The human approval record and Gateway-side limits remain the authority. `mockLedgerPath` exists only for mocked transports. A `MOCK` run never authorizes real or paid calls, must never be used with a real transport, and its results are not acceptance evidence.
- `compare.mjs`: reference v1/v2/v2.1 comparison using one deterministic authored candidate per case. v1 is main's deterministic rendering; v2/v2.1 are pinned Draft #49 source. Abstention is recorded, never repaired by rewriting source text.

To reproduce the committed baseline artifact, use a clean, read-only checkout of `09f6aee0584c386c99523e81657413efab32f1af` with its existing dependencies. Do not reset anyone else's checkout. No provider calls or DB connection occur; transitive reference configuration receives a synthetic closed localhost endpoint only:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null \
  DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test \
  node experiments/prompt-first-reflection/compare.mjs --reference /path/to/read-only-pr49 \
  > /tmp/petalpal-comparison.json
```

Compare that JSON with `comparison-results.json`. The reference pin and clean `lib/`/dependency declarations are checked. This optional comparison is not needed for ordinary CI; the experimental tests are registered in the existing environment-stripping security CI runner. Output artifacts contain only authored synthetic evidence. Do not use this script to inspect live records.
