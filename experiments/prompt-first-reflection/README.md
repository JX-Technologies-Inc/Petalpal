# Prompt-first Claude reflection evaluation

The v2 prompt revision is offline preparation only: no provider calls, credentials, database, report persistence or production eligibility. The v1 direct transport remains solely as immutable first-run evidence and is not authorized for another run. Requires Node 24 and the repository's exact locked dependencies (`npm ci --ignore-scripts` in a clean isolated checkout). Do not load `.env`.

```sh
node experiments/prompt-first-reflection/prepare.mjs
node experiments/prompt-first-reflection/prepare.mjs --requests > /tmp/petalpal-synthetic-requests.json
node --test experiments/prompt-first-reflection/test.mjs
node experiments/prompt-first-reflection/prepare-v2.mjs
node --test experiments/prompt-first-reflection/test-v2.mjs
node experiments/prompt-first-reflection/render-examples.mjs
node experiments/prompt-first-reflection/acceptance.mjs   # 36-case plan and reservation only
node --test experiments/prompt-first-reflection/acceptance.test.mjs
node experiments/prompt-first-reflection/acceptance-v2.mjs  # 12-case unauthorized plan only
node --test experiments/prompt-first-reflection/acceptance-v2.test.mjs
```

`--requests` emits 120 real Anthropic Messages API body shapes, with credential-free headers and relative Gateway path. They are **not sent**. Bind the existing authenticated Gateway URL and credentials only inside a separately approved trusted runner. There is deliberately no `--send` flag. `dataset: synthetic` is a caller assertion, not a private-data detector; the CLI accepts only the committed fixtures, never a file upload, database query or arbitrary Event input.

[Design, source review, acceptance and limitations](../../docs/ai/PROMPT_FIRST_REFLECTION.md). [Readable comparisons](../../docs/ai/PROMPT_FIRST_EXAMPLES.md). [Full system prompts](../../docs/ai/PROMPT_FIRST_SYSTEM_PROMPTS.md).

## Modules

- `prompts/shared-v1.txt` + report-specific v1 suffixes: immutable first-evaluation prompts assembled by `systemPrompt`.
- `prompts-v2/shared-v2.txt` + report-specific v2 suffixes: revised semantic and writing instructions assembled by `systemPromptV2`. The v2 path has no live authorization.
- `experiment.mjs`: immutable v1 synthetic source admission, minimized alias-only user packet, wire/local schema, provider request construction and structural review. Original source/memory IDs, owner and revisions stay in its private closure. No mutable input reference is retained.
- `experiment-v2.mjs`: changes only the versioned system prompt and packet `promptVersion`; delegates admission, evidence construction, schema, source fence, evaluator and reservation to v1.
- `prepare-v2.mjs`: builds the 120 revised requests offline and exposes no `--requests` or send mode.
- `fixtures.mjs`: 20 authored scenarios, 73 source Events; Weekly uses the first two (or fewer), Monthly uses up to four. All three locales see byte-identical evidence. Dates are synthetic fixture choices, never translations of source-relative time.
- `examples.mjs`: six manually authored writing targets. Not used as a semantic acceptance registry or supplied as few-shot examples.
- `acceptance.mjs`: approval-gated runner for the 36-case first batch. Checks that request-construction sources match the approved commit, then runs model and token-count preflight, serial single attempts, a no-replay ledger (`wx`, fsync before dispatch), 20 s/64 KiB/20 min limits, usage/budget stops and sanitized results. A live run (no `mockLedgerPath`) always uses the fixed `~/.petalpal-acceptance/<commit>.jsonl` and accepts no other option, so a new path cannot start a second live run. Mocked runs must name their own ledger and are labelled `MOCK`. It has no transport of its own. The only real one is `live-anthropic.mjs`, a direct `https://api.anthropic.com` adapter that sends only when called by an active LIVE run. It reads the key once from `PETALPAL_CLAUDE_EVAL_API_KEY` in a trusted runtime and never logs it or writes it to the ledger. Verified only with mocked transports (`acceptance.test.mjs`). The tests need git history containing that commit; CI runs them via `.github/workflows/prompt-first-acceptance-mock.yml` with `npm ci`.

- `acceptance-v2.mjs`: separate proposed 12-case v2 runner for `negation` and `mixed-work` × Weekly/Monthly × three locales. It pins the v2 prompt commit, reserves $1.2288 below a proposed $1.50 ceiling, performs exact model and token-count preflight, and reuses the serial, no-retry, durable attempt-before-send, 20 s/64 KiB/20 min, sanitized-result and uncertain-cost stop policies. Its CLI prints an unauthorized zero-call plan only.
- `anthropic-v2.mjs`: future direct Anthropic adapter with no environment lookup or CLI. It rejects every MOCK call and accepts only a private grant from `runV2Live`; no trusted launcher is included.

**V2 runner boundary.** The LIVE ledger has a fixed identity containing `1e3b538f` and `v2-negation-mixed-work-12`, stored under this checkout's Git common directory rather than HOME. Callers cannot override its path, and MOCK mode never receives a live transport grant. This blocks silent bypass by changing HOME or choosing another path in the same clone; it cannot prevent execution from another clone or machine. Human authorization remains required. V2 has not run, and the consumed v1 approval, key handling and ledger cannot authorize it.

**Runner limits.** The fixed ledger only blocks a second live run for one OS user on one machine. It is **not** cross-machine replay prevention: another machine, a different HOME or a deleted ledger file can start again. The human approval record and Gateway-side limits remain the authority. `mockLedgerPath` exists only for mocked transports. A `MOCK` run never authorizes real or paid calls, must never be used with a real transport, and its results are not acceptance evidence.

**Historical v1 live run.** The first 36-call batch completed. Its authorization and single-use ledger are consumed. Do not invoke `live-anthropic.mjs` again or use that approval for v2; any v2 provider evaluation requires a new, separately scoped authorization, budget and ledger.
- `compare.mjs`: reference v1/v2/v2.1 comparison using one deterministic authored candidate per case. v1 is main's deterministic rendering; v2/v2.1 are pinned Draft #49 source. Abstention is recorded, never repaired by rewriting source text.

To reproduce the committed baseline artifact, use a clean, read-only checkout of `09f6aee0584c386c99523e81657413efab32f1af` with its existing dependencies. Do not reset anyone else's checkout. No provider calls or DB connection occur; transitive reference configuration receives a synthetic closed localhost endpoint only:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null \
  DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test \
  node experiments/prompt-first-reflection/compare.mjs --reference /path/to/read-only-pr49 \
  > /tmp/petalpal-comparison.json
```

Compare that JSON with `comparison-results.json`. The reference pin and clean `lib/`/dependency declarations are checked. This optional comparison is not needed for ordinary CI; the experimental tests are registered in the existing environment-stripping security CI runner. Output artifacts contain only authored synthetic evidence. Do not use this script to inspect live records.
