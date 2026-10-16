# Weekly editorial quality — offline candidate and frozen review set

2026-10-15, America/Vancouver. Branch: `experiment/weekly-editorial-benchmark`.
**Offline work complete; actual Claude writing improvement unproven. Hosted
Integration preflight remains BLOCKED.** No inference, deployment, hosted config,
database, migration, historical experiment or consumed-ledger action occurred.

## Baseline and preserved work

The new isolated worktree is
`/Users/xingranma/Documents/ChatGPT/jev/petalpal-weekly-editorial-benchmark`.
Git ancestry, not directory names, establishes the combined baseline:

| Commit | Included work |
|---|---|
| `ab52399656904f4f698c5f2d731f9b98d9b658ff` | Editorial freedom and `en`/`zh-Hans` future generation |
| `e5c16b709b62f04e4bec9731b86c9b50c478cbca` | Exact quotation versus idiomatic paraphrase |
| `957c6c2de713e1c3b2219ab5d661c14971a747d3` | Corrected Selector V2 behind default-OFF flag |
| `dac2b512c996ed396be33cd69d3330790b7798c5` | Accepted Node 24.21.0 / ICU 78.3 readiness verification |
| `b94154bef05f08253b748874130f5764959fcd38` | Existing Integration plan; parent baseline of this work |

All five are ancestors of this branch. The original worktrees, including the
uncommitted investigation files observed in the quotation-fix checkout, were
left intact. The combined baseline already tracks the older investigation under
`experiments/reflection-editorial-bottleneck/`; it need not be copied from that
dirty worktree. No separate branches were assumed to be merged into main.

Production runtime, prompt constants, schemas, validation, worker/fences, flags,
dependencies and deployment files are unchanged. `SECURITY.md` and
`MANUAL_SECURITY_CHECKLIST.md` were reviewed and left unchanged: no actual
production safeguard, provider/manual state or required security verification
obligation changed. This experiment's rejection rules are local to its adapter.

## What is established, and what is only a hypothesis

| Finding | Evidence / limit |
|---|---|
| The old editorial benchmark is inadequate | C01 is an adversarial semantic case; C04 has very sparse notes. The preserved investigation documents awkward English, weekday inventories and an object-identity concern in actual historical outputs. These remain failures, even when JSON passed. We reused that investigation without reopening outputs or ledgers. |
| Selection can remove the material needed for synthesis | V1's two-per-topic allocation drops related revisions/follow-ups. Accepted V2 evidence retains **10/10 meaningful follow-ups**, versus V1's 0/10, and 32/32 meaningful sources. This is selection evidence, not prose evidence. |
| Selection loss did not cause the observed direct-packet C01/C04 writing | Those evaluations bypassed retrieval/selection. V2 retention alone cannot establish an editorial fix. |
| Input encourages source-local reading | Current packet order is chronological, aliases correlate with that order, and each Event starts with a weekday before its text. This describes the code; its causal effect on prose is **unmeasured**. |
| The output contract can express synthesis | Handcrafted E01/E03 targets cite several Events in coherent prose and pass unchanged validators. No weekday/all-Event quota or exact sentence template is needed. This proves representability, not model skill. |
| Validated does not mean faithful | Reused S01–S08 faithful and misleading contrasts both pass structural validation. Negation scope, actor, causal implication, recalled time and object identity still require clause-level human review. |

Packet byte trimming and 500-character EventMemory extraction can lose context
in general; neither explains the preserved tiny C01/C04 packets. No new retrieval,
summary rewriting, emotion labels, inferred links, theme scoring or source access
was implemented. Shared topics and V2 lexical overlap never establish identity.

## Frozen editorial benchmark and handcrafted references

[cases.json](../../experiments/weekly-editorial-quality-v1/cases.json) has nine
scenarios in English and native-style Simplified Chinese: **18 localized cases,
70 source notes**. Each source includes a record day, topics and complete text.
Both languages are independently worded fictional companions, not private notes
or emotion-classifier evaluation material. No adversarial wording is needed to
test ordinary composition.

| Case | Editorial opportunity |
|---|---|
| E01 | Work: proposal, specific feedback, handover gap, revision, fatigue and pending presentation |
| E02 | Friendship: understanding a cancellation, hurt, difficult communication, relief and remaining regret |
| E03 | Creative project: preserve an aesthetic intention while revising a lino print through successive tests |
| E04 | Stress beside real pleasure: shift change, leak, tomato and concert; no claim of a cure |
| E05 | Ordinary soup, coat repair and reading; no required depth or theme |
| E06 | Residency rejection remains painful alongside a satisfying edit and welcome conversation |
| E07 | Heating cost clarified; affordability and a studio move remain undecided |
| E08 | Distinct unrelated experiences; a single theme would mislead |
| E09 | Two sparse notes; one honest sentence is sufficient |

Review opportunities/failures stay outside requests. The corpus is a versioned
frozen file; corrections create a new version. It is not a statistical population
sample. Existing S01–S08, multilingual quotation, retired-locale, formatting and
source-isolation tests remain separate. A style score cannot excuse their failures.

[targets.json](../../experiments/weekly-editorial-quality-v1/targets.json) contains
ten **handcrafted human-style targets written by Codex**, two languages each for
E01/E02/E03/E05/E09. They are neither Claude output nor independently human-written
gold. [Readable examples](../../experiments/weekly-editorial-quality-v1/EXAMPLES.md)
include sentence-by-sentence refs; the JSON stores refs outside visible prose in
the production contract. Nothing injects these targets into a prompt.

## Exact candidate changes, offline only

[candidate.mjs](../../experiments/weekly-editorial-quality-v1/candidate.mjs) calls
the existing `buildWeeklyReflectionV2Packet`, preserving its envelope checks,
allowlisted sources and exact ref map. It provides two independent factors:

1. **Presentation:** keep the current packet, or move each `day` value to
   `recordDays: [{ref, day}]` after the evidence array. Evidence becomes
   `{ref, text, topics?, clipped?}` in exactly its original order. No summary,
   topic, day value, identity, source, clip marker or citation alias is rewritten.
2. **Composition:** keep the current instructions, or replace only their writing
   paragraph with the following. Introduction, evidence safeguards and final
   JSON/citation/quotation paragraph remain byte-identical.

> Compose a retrospective around what matters in these Events. Where the text explicitly connects experiences, let their relationship carry the writing: a revision in response to feedback, a changed understanding, or feelings that coexist. Choose the details that make that relationship clear; supplied Events are available evidence, not a coverage checklist. Independent experiences can stand beside one another, and a quiet week can stay small. Write directly in idiomatic English or everyday Simplified Chinese, with natural paragraph flow. Paraphrase without quotation marks. Let the ending rest where the evidence leaves things, including what remains unresolved.

This gives four offline combinations on identical evidence. No array permutation,
theme inference, separate plan, few-shot targets, second model call, retry or
repair was added. The separation already had a hypothesis in the prior
investigation; this adapter tests its information preservation and V2 compatibility,
not its literary effect. The replacement paragraph makes the compositional task
more explicit rather than adding a longer list of prohibitions.

The candidate **rejects** if the underlying packet builder trims a selected Event,
or if complete native request framing plus the existing 1024-byte reserve exceeds
8192 bytes. It never evicts a follow-up to fit the experiment. Model stays
`claude-sonnet-5-5`, low effort and the current 2048-token default; no actual call
occurs. Existing model/cost/timeout admission is not replaced by this local byte
check. A future runtime change must reuse the same Gateway and final-write fences.

Why this may help: complete follow-ups give the writer something meaningful to
connect; separating record metadata gives source text visual priority; the prompt
names composition rather than sequential paraphrase. Grounding stays in the
sources and per-sentence refs. None of these claims establish that Claude will
respond well. Chronological evidence and correlated aliases remain, citation
production may still encourage local rewriting, and a style instruction may have
little effect. No runtime default adopts either hypothesis.

## Handcrafted target review, separate from executable checks

These are **Codex self-review ratings**, not native-editor acceptance, model
evaluation or evidence of user preference. Dimensions follow [RUBRIC.md](../../experiments/weekly-editorial-quality-v1/RUBRIC.md):
fluency / coherence / synthesis / nuance / fidelity / chronology / specificity /
proportion. A 5 for nuance in a sparse case credits restraint, not inferred emotion.

| Target | Provisional ratings | Grounding and editorial assessment |
|---|---|---|
| E01 en / zh-Hans | 4 / 5 / 5 / 4 / 5 / 5 / 4 / 4 (each) | Opens with the actual relationship between explanation and rota. Feedback→example→handover gap is supported by E2/E4; satisfaction, fatigue and pending presentation stay within E5. Revision is not personal growth. The opening is deliberately analytical; native reviewers should judge its warmth. |
| E03 en / zh-Hans | 4 / 5 / 5 / 4 / 5 / 5 / 4 / 5 (each) | Original aesthetic intention provides focus. E1/E2 distinguish water and crane problems, E3 explicitly returns to the sketch, E4 keeps the final paper undecided. Test prints remain successive objects. Language is concrete rather than decorative. |
| E02 en / zh-Hans | 4 / 4 / 4 / 5 / 5 / 4 / 4 / 4 (each) | E1/E2 keep understanding and hurt together, E3 explicitly supports relief without erasing regret. Neither friendship repair nor the walk is asserted. More temporal progression is appropriate because message and reply matter. |
| E05 en / zh-Hans | 4 / 4 / 4 / 5 / 5 / 4 / 4 / 5 (each) | Brief juxtaposition of unrelated ordinary details. Soup preference is stated; repair and story receive no added psychology. Three details in sequence are appropriate here; no invented thesis improves them. |
| E09 en / zh-Hans | 4 / 4 / 4 / 5 / 5 / 5 / 4 / 5 (each) | One compact sentence cites both sources; no sensory embellishment or unexpressed mood. This is an honest limit case, not an exemplar of rich synthesis. |

All meaningful clauses were checked against their named Events during authorship;
automated tests check schema, quotation and source identity only. These provisional
scores may change under native human review. Future responses should match the
quality and restraint, not the wording, ordering or paragraph shapes. The rubric
specifies blind paired review, per-language scores, hard fidelity failures and a
concrete preference gate. No actual response has been accepted under it.

## Verification and reuse

Pinned runtime: **Node v24.21.0, ICU 78.3, Darwin arm64**. Temporarily symlinked
the readiness worktree's existing installed dependencies; removed only that new
symlink after checks. No install hook, provider, Docker or database operation.
For a fresh reproduction in this checkout, restore that local symlink first
(`ln -s ../petalpal-weekly-selector-v2-readiness/node_modules node_modules`), or
use compatible already-installed dependencies. Do not stage the symlink.

```sh
env -i PATH="/tmp/petalpal-node-24.21.0/node-v24.21.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/bin:/bin" \
  node --test experiments/weekly-editorial-quality-v1/candidate.test.mjs \
  test/back/reflection-v2-quotation-contract.test.js \
  test/back/reflection-language-support.test.js
```

**54/54 PASS**, zero failures/skips/cancellations: 37 new candidate/fixture tests,
13 existing quotation tests and 4 existing locale/history tests. Checks cover:

- 18 localized cases × four combinations = 72 information-preserving packet views;
  max serialized request including reserve **4957 / 8192 bytes**.
- Ten handcrafted targets × four views pass the original schema, evidence refs,
  exact-quote and length constraints. No exact model sentence is required by tests.
- The same views compose with both selectors on new cases. The narrow compatibility
  check of 12 existing editorial cases matches the preserved accepted selected-ref
  artifact and retains **10/10 follow-ups**, without a full selector/readiness rerun.
- Invalid refs, duplicate refs, retired locale, extra JSON keys, numeric invention,
  unsupported quotation, one-Event output and formatting are rejected.
- Wrong owner/provenance/policy, insufficient status, Monthly input and unknown
  candidate options fail closed; clipped fragments and mixed-language/untrusted
  text remain verbatim evidence. Oversized Unicode input fails without eviction.
- Separate S01–S08 contrasts document why structural PASS is not semantic PASS.
  Existing tests retain translated-quote rejection and historical Traditional
  Chinese readability. No Monthly narrative behavior is changed.

The accepted 366/366 native OFF/ON and 233/233 deployment-image OFF/ON readiness
matrices remain reusable because runtime inputs/code/config are unchanged.
They were **not rerun**. This focused run is not a hosted, real-PostgreSQL or
production security certification. Unchanged lifecycle, consent, deletion,
idempotency and cost controls rely on that scoped existing evidence.

## Exact future Integration path and blockers

The canonical path remains [the existing Integration plan](WEEKLY_EVIDENCE_SELECTOR_V2_INTEGRATION_PLAN.md),
with [accepted readiness](WEEKLY_EVIDENCE_SELECTOR_V2_READINESS.md). This branch
adds an offline composition adapter, not a second Integration system or a paid
evaluation runner. No batch, slots, credentials, ledger, paid payloads or execution
approval were prepared here. The existing plan's prior cases/slots are not an
authorization for this new editorial corpus.

1. Reuse the approved selector runtime from `957c6c2d…`, verified at `dac2b512…`,
   and the planning baseline `b94154be…`. This branch already contains them.
   At a later authorized integration step, reconcile only needed changes onto
   the exact reviewed TEST-compatible source; do not deploy this older full
   baseline over an unknown newer schema or assume it equals main/Live.
2. Keep the target **`petalpal-backend-test` only**, isolated TEST Prisma/Firebase/
   Gateway resources, the current Integration startup guard, manual execution and
   zero normal-server budgets. Reuse `createProductionAiWorker`, `ReportInputService`,
   Gateway admission, existing security checks and final-write fences. No parallel
   deployment path, bypass of the guard, new persistence contract or migration.
3. **BLOCKED: live resource verification.** Actual TEST deployed SHA/image,
   source/startup override, Prisma resource binding/marker, Firebase project,
   identities and protected origins require the existing secret-free verification.
   Neither historical mapping nor offline PASS upgrades hosted readiness.
4. **BLOCKED: schema/deployment reconciliation.** Existing plan records main/TEST
   uncertainty and five migrations absent from the verified branch. Confirm actual
   source and schema, review startup migration effects and pin a compatible source.
   No migration or reconciliation was executed in this task.
5. **BLOCKED: reviewed bounded runner.** The finite Integration-only harness/policy
   in the existing plan remains unimplemented/unverified. It must reuse the actual
   worker, frozen retrieval and test-owner scopes, budget/idempotency and no-retry
   admission. An offline packet adapter is not that runner. Do not set positive
   hosted budgets or attach provider credentials to make this experiment run.
6. When separately authorized, compose the selected V2 sources with any accepted
   editorial factor while preserving count/context/byte bounds, aliases, source
   versions and the **10/10 retained follow-ups** compatibility criterion. Apply
   selection and editorial factors separately so preference has an interpretable
   cause. Reuse impact-based tests; redo runtime/fence tests only if their inputs
   actually change. A future adapter integration must keep the selector's byte
   prediction aligned with the real request; this offline adapter is not wired
   into that admission today.
7. Preserve `AI_WEEKLY_EVIDENCE_SELECTOR_V2` unset/false by default. Opt-in still
   requires literal true and `weekly-reflection-v2`. Rollback remains the existing
   plan §7: stop new slots, account for in-flight liabilities, construct fresh OFF
   workers, verify zero-cost OFF parity and preserve saved reports/consumed ledgers.
   OFF never erases reports or authorizes a replay. Editorial factors have no runtime
   flag because nothing imports this experiment in production.

Before adoption, actual Sonnet responses must pass the human rubric: zero
fabrication/misattribution, valid JSON/refs, fluent language, meaningful supported
connections, no weekday inventory in rich cases, and strong blind preference per
language. Real model behavior, native human acceptance, retrieval recall, hosted
readiness and generalization remain **unproven**. If responses are still flat or
awkward, this remains an editorial failure regardless of offline test results.

## Changed files

- This report.
- `experiments/weekly-editorial-quality-v1/cases.json`: frozen bilingual source set.
- `targets.json`: ten handcrafted contract-shaped targets.
- `fixtures.mjs`: read-only fixture loader and existing-envelope adapters.
- `candidate.mjs`: offline presentation/composition factors and byte admission.
- `candidate.test.mjs`: focused deterministic compatibility/contract regressions.
- `RUBRIC.md`: 1–5 anchors, hard fails and future human acceptance gate.
- `EXAMPLES.md`: readable rendering of the target JSON with sentence source refs.

Stop at offline implementation and review. No paid or hosted work is authorized.
