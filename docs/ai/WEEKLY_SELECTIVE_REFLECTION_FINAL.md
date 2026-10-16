# Weekly selective reflection — final editorial revision (default OFF)

Branch `feat/weekly-selective-reflection`, from `cbf091b5edd2f18da969726ca78805f570bd041d`.
This supersedes the composition paragraph in
[the narrative-thread candidate](WEEKLY_NARRATIVE_THREAD_CANDIDATE.md); that report's design and history are otherwise unchanged.
**Offline only.** No provider call, deployment, migration, flag activation or merge was made.

## Final prompt and flag

- **Flag:** `AI_WEEKLY_REFLECTION_NARRATIVE_THREAD`, unchanged.
  - Literal `true`/`false` only; unset means OFF.
  - Requires `weekly-reflection-v2`.
  - Exclusive with `AI_WEEKLY_REFLECTION_RETROSPECTIVE`.
  - No new flag was added.
- **Change:** only `WEEKLY_NARRATIVE_THREAD_COMPOSITION` now holds the owner-specified paragraph, verbatim.
  The introduction, evidence safeguards, JSON schema, citation and quotation rules are byte-identical.

> Treat Events as candidates, not a checklist. Select moments with stated significance: a wish, concern, choice, change, unresolved issue, or small detail valued by the user. One distinctive moment may matter more than routine entries; do not favor distress, recency, or equal coverage per day. Link Events only on textual evidence, not shared tags or dates; keep unrelated moments separate and omit filler. Organize by meaning, not weekdays. Preserve open outcomes and stated emotional intensity; infer no hidden motives, traits, diagnoses, lessons, growth, or whole-period trends from selected memories. Paraphrase naturally in English or Simplified Chinese without quotation marks, stock reassurance, or forced themes.

**Size:**
- The paragraph is 721 serialized bytes (719 raw), versus 430 for the original composition paragraph, so the prompt grows by **+291 bytes**.
- Native request framing is at most 172 bytes, so 291 + 172 = 463 bytes, within the builder's existing 512-byte allowance.
- Tests confirm admission for E01–E09, every stress packet and the worst-case eight-source packets, at output caps of 2048 and 4096.

**One call:** select → relate → write → verify all happen inside the existing single call, with no plan requested or stored.

## Stress set A–H (`experiments/weekly-selective-reflection-v1/stress.mjs`)

The set is deterministic and synthetic. `meaningful` marks are review annotations only and never enter selection or model input.
The analysis replays the production upstream path:
- **Chinese:** the last 32 Events in the period, with similarity 0.
- **English:** BGE retrieval, which can't be reproduced offline, so it is approximated with similarity 0.
- In both, `importanceScore` is null.

That ends in Selector V1 (default) and Selector V2.

### Q1 — did the selector deliver the meaningful evidence?

| Case | Delivered v1 / v2 | Meaningful delivered (v1 / v2) | Finding |
|---|---|---|---|
| A: 21 unrelated Events, 3 per day | 8 / 8 (Mon–Wed only) | **0/3 / 0/3** | **Severe selection limitation** |
| B: routine stress + one quiet positive moment | 3 / 8 | 1/1 / 1/1 | Quiet moment delivered |
| C: one project mixed with unrelated life | 6 / 7 | 3/5 / 4/5 | V2 drops the late unresolved "paint colour" entry (`maxPerTheme` 2 + lexical gate) |
| D: corrections, negation, attribution | 5 / 5 | 4/4 / 4/4 | All delivered verbatim |
| E: sparse ordinary | 3 / 3 | — | All delivered |
| F: 40 Events | 8 / 8 | 1/2 / 1/2 | **Blocker:** Chinese drops the early "offer accepted" Event before the selector (keeps the last 32); within the 32, earliest-first |
| H: colloquial en/zh, varied intensity | 4 / 4 | 3/3 / 3/3 | Byte-exact text |
| G: Monthly, 5 weeks | 12 | 4/4 | All 5 weeks covered; recurring theme and unresolved decision kept |

**Root cause:** the absence of an important Event in A and F is a **retrieval/selection limitation, not a prompt failure**.
- With no relevance signal, the ordering `similarity → importanceScore → earliest date` keeps the earliest Events.
- `EventMemory.importanceScore` is never populated in production: the `Event` model has no such field, so extraction always stores null.
- The Chinese path sets similarity to 0. The English similarity comes from a generic period query.
- The selector already honours importance: giving the significant A Events `importanceScore` 0.9 delivers 3/3.

**No selector change was made.** Neither available V2-only fix is demonstrably correct within the constraints:
- A lexical "significance" heuristic would be new semantic scoring.
- Spreading evidence across days would not have recovered A, whose significant Events are not first on their days. It would also change accepted V2 evidence.

**Blocker:** a real upstream significance signal is needed, for example populating `importanceScore` at extraction.
That is a product/RAG decision outside this revision.

### Q2 — given delivered evidence, what does the contract allow or miss?

- **Selective output passes.** A reflection citing a subset (B: the quiet moment plus one other) passes the unchanged validator.
  The existing Weekly rule still requires at least two cited Events, so a reflection about a single moment must cite one more.
- **Still enforced:** unsupported digits (D: 30th → 31st), reworded or negation-flipped quotations, and invented intensifiers in quotes (H) are all rejected.
- **Validator-blind** (only the prompt and human review guard these): unquoted negation flips (D), unquoted intensity inflation (H), and forced links between unrelated Events (A).

## Monthly

Monthly runtime, prompt, validator and selector are unchanged. The Monthly parity test includes the new flag.

The selection philosophy applies to Monthly only *within* its mandatory coverage:
- At least one source per represented week, and every represented week cited.
- 16 sources, 8,000 characters, `maxPerTheme` 3, up to 3 previous-month comparisons.
- Inside those bounds, choose stated significance over frequency, link only on textual evidence, and never turn selected memories into a month-long trend.

Monthly shares the same missing importance signal (G passed only because each week had few Events).

## Tests

These ran in the cloud sandbox on Node 24.21.0. Real `ajv` and `@electric-sql/pglite` could not be installed (the npm registry is blocked), so a module-loading stub was used.
**Schema validation is NOT verified by these runs.**

| Suite | Result |
|---|---|
| `weekly-selective-stress` (new) | 10/10 (logic; schema not exercised) |
| `weekly-narrative-thread` | 7/7 (logic) |
| `weekly-editorial` | 26/27. The 1 failure needs real `ajv` schema rejection and fails identically on the untouched base under the stub |
| `weekly-evidence-selector-v2` + `reflection-v2-quotation-contract` | 70/70 (logic) |
| `sonnet-weekly` (actual worker), `opus-monthly` (Monthly invariance) | **Blocked here** (PGlite) |

Run everything on a Mac with real dependencies:

```sh
cd ~/Documents/ChatGPT/jev/petalpal-weekly-editorial-runtime   # or any clean checkout
git fetch origin && git checkout feat/weekly-selective-reflection
npm ci
env -i PATH="$PATH" HOME="$HOME" node --test --test-concurrency=1 \
  test/back/weekly-selective-stress.test.js test/back/weekly-narrative-thread.test.js \
  test/back/weekly-editorial.test.js test/back/weekly-evidence-selector-v2.test.js \
  test/back/reflection-v2-quotation-contract.test.js test/back/reflection-language-support.test.js \
  test/back/sonnet-weekly.test.js
env -i PATH="$PATH" HOME="$HOME" node --test --test-concurrency=1 \
  --test-name-pattern='Weekly selector OFF/ON does not change actual Monthly' test/back/opus-monthly.test.js
```

## Limitations

- **Real writing quality is unproven.** Handwritten samples and lexical scorers are not evidence. The 18 exemplars were written for the previous paragraph and remain contract test doubles only.
  Whether Claude selects well, writes naturally or stays faithful requires authorized real outputs and human review.
- **Selection blockers:** A, F and C above. The prompt cannot select Events the model never receives.
- **The validator cannot detect** paraphrase negation flips, intensity inflation or forced links.
