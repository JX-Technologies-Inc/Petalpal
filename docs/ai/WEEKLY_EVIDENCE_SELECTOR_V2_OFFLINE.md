# Weekly Evidence Selector V2 offline experiment

Prepared 2026-10-15, America/Vancouver. Branch `codex/weekly-selector-v2-offline`,
worktree `/Users/xingranma/Documents/ChatGPT/jev/petalpal-weekly-selector-v2-offline`.
Base implementation `e5c16b709b62f04e4bec9731b86c9b50c478cbca`.
**OFFLINE VERIFIED; NOT INTEGRATED. Stop for owner review.**

V2 recovers the ten annotated follow-ups lost by the original selector across the
English and Simplified Chinese editorial fixtures. It preserves every initially
selected source, all represented topics and existing hard admission bounds.
This establishes a useful evidence-retention improvement on these synthetic
weeks. It does not establish improved Claude writing or justify replacing the
production selector yet: backfill also admits routine/irrelevant material when
capacity remains, and existing lexical deduplication can discard negated updates.

## Is the two-per-topic rule a hard contract?

It is a **hard cap in the existing algorithm, serving a selection heuristic**,
not a schema, authorization or persistence limit. This distinction is explicit:

- `lib/report-foundation.js:17` sets Weekly `maxPerTheme: 2`; the loop at line 135
  uses it as the number of diversity rounds. Existing tests at
  `test/back/ai-foundation.test.js:603` verify diverse selection, change retention,
  bounds and determinism; they do not establish an independent two-source-per-topic
  downstream contract.
- `LONG_TERM_AI.md` specifies owner-scoped provenance and the bounded 32-candidate,
  eight-evidence/4,000-character pool. It does not mandate two sources per topic.
- `lib/report-narrative.js`, `lib/reflection-v2.js`, `lib/report-write-fence.js`
  and report evidence persistence enforce total bounds, source identity, content,
  owner, consent, revision and deletion fences; none checks a Weekly per-topic cap.
- Monthly has its own cap/coverage policy in `lib/monthly-evidence.js`; that policy
  and every production selector remain unchanged.

V2 deliberately changes the **experimental final selection policy** from a hard
per-topic cap to an initial diversity allocation followed by bounded backfill.
It calls the original selector with the original `maxPerTheme: 2`; it never edits
that constant, widens it through an override, or changes a shared implementation.
Future integration would require explicit review of this selection-policy change.

## Candidate behavior and boundary

[selector.mjs](../../experiments/weekly-evidence-selector-v2/selector.mjs) is imported
only by experiment code. There is no runtime flag, service routing or production
import. It accepts an already authorized Weekly candidate pool, not a database
connection, raw Journals or credentials.

1. Require explicit Weekly scope, a supported locale, an explicit timezone and bounded input.
   Reject foreign/missing owners, explicit source opt-out, invalid rank values,
   and conflicting versions with identical provenance and identical ranking keys.
2. Delegate initial selection to `selectReportEvidence` unchanged. Preserve each
   selected row's content, metadata, reason and provenance; never displace it.
3. Reproduce the original window/source filter, ranked deduplication and ordering
   for the remaining candidate pool. Consider extras in supplied similarity,
   importance, Event date and stable ID order. No model, new relevance score,
   semantic relatedness inference or future-outcome preference is introduced.
4. Add fitting extras until capacity is exhausted. Apply the same `summary.length
   + 96` accounting and total limits. Restore chronological output ordering.
5. Before each addition, run the unchanged Weekly packet builder and refuse the
   addition if it would trigger dropping any selected source. Existing longest-item
   trimming could otherwise evict an initial source after backfill. If the original
   selection already trims or fails packet admission, return it without enrichment;
   V2 does not broaden its admission or change the downstream failure behavior.

The experiment can tighten but cannot increase 32 candidates, eight selected Events
or 4,000 context characters. It retains the two-Event minimum and original rank
precedence. The packet preview is checked against the actual
`buildWeeklyReflectionV2Packet` adapter in every ready benchmark/test selection.
Full requests retain existing conservative byte admission, unchanged schemas,
Weekly/Monthly prompts, output limits and native one-call generation behavior.
Offline byte measurements are not a claim to have run an Anthropic tokenizer.

Consent is still an upstream obligation: this pure function cannot establish
current account consent or replace source/deletion fences. Tests verify that the
unchanged `ReportInputService` denies retrieval for each revoked consent flag,
and existing in-memory SQL fence tests remain passing. No sources are fetched by
V2. Repeated-source/memory-ID suppression, exact text/topics and paired
Event/Memory provenance are checked. Only aliased text/topics/weekday fields enter
packet previews; owner IDs, source IDs and review labels stay server-side.

Ranking, topic keys and lexical duplicate helpers are mirrored locally because
the originals are private. This deliberate experimental duplication avoids a
production refactor, but is a maintenance consideration before integration.

## Frozen original versus V2 results

[results.json](../../experiments/weekly-evidence-selector-v2/results.json) records all
28 case/language comparisons and both pre-packet and packet-visible selections.
The [frozen fixtures](../../experiments/reflection-editorial-bottleneck/fixtures.mjs)
are unchanged. Primary comparisons use `similarity: 0`, `importanceScore: null`
for every Event. Review labels affect measurements only, never candidate scores.
This avoids turning a hand-authored quality label into a ranking advantage.

| Category, both languages | Original | V2 |
| --- | --- | --- |
| Semantic cases | 16 | 16 |
| Semantic evidence retained | 32 / 32 | 32 / 32 |
| Semantic target evidence retained | 18 / 18 | 18 / 18 |
| Editorial cases | 12 | 12 |
| Editorial evidence retained | 44 / 56 (78.6%) | 56 / 56 (100%) |
| Annotated meaningful editorial evidence | 22 / 32 (68.8%) | 32 / 32 (100%) |
| Annotated previously lost follow-ups | 0 / 10 | 10 / 10 |

The following selections are identical across the two locales. `E1`, `E2`, etc.
refer to stable **original fixture positions**, not a promise that packet aliases
remain numerically identical when selected-source positions change. Actual source
provenance is preserved and checked independently.

| Week | Original positions | V2 positions | Topics before/after | Largest topic share before/after |
| --- | --- | --- | --- | --- |
| Q01 proposal | E1–E4 | E1–E7 | 2 / 2 | 50.0% / 57.1% |
| Q02 visit and choir | E1–E5 | E1–E6 | 3 / 3 | 40.0% / 50.0% |
| Q03 ordinary moments | E1–E4 | E1–E4 | 4 / 4 | 25.0% / 25.0% |
| Q04 sparse week | E1–E2 | E1–E2 | 2 / 2 | 50.0% / 50.0% |
| Q05 pottery | E1–E3 | E1–E4 | 2 / 2 | 66.7% / 75.0% |
| Q06 exhibition | E1–E4 | E1–E5 | 3 / 3 | 50.0% / 60.0% |

Concrete recoveries, each in both languages:

- Q01 E5: the cost explanation is revised using the specifically identified
  feedback. E7: the reviewer finds the example clear, while presentation nerves
  remain. These connect feedback and revision without inventing presentation success.
- Q02 E6: the visit remains unbooked despite the shorter-visit suggestion. Its
  retention prevents the candidate pool from ending at an earlier, easier moment.
- Q05 E4: the bowl is still unglazed/unfired and the final outcome is unknown.
- Q06 E5: enjoying the photo edit has not resolved disappointment about rejection;
  another submission is still undecided.

All initially selected rows survive exactly; distinct-topic counts do not decline
in any of the 28 cases. Both selectors produce identical results across all tested
rotations and their reversals, without mutating candidates. All new fixture
evidence survives downstream packet admission. Maximum observed context is
1,668 characters against 4,000; maximum full request size plus existing reserve is
4,846 bytes against 8,192. These small fixtures do not stress the maximum pool;
separate adversarial cases exercise count, character and serialized-byte ceilings.

## Trade-offs and adversarial findings

**Higher coverage is not automatically higher quality.** Of twelve added editorial
records across both languages, ten are annotated meaningful follow-ups and two
are routine Q01 entries. Topic breadth stays fixed, while concentration increases
in the four enriched scenarios. No initial topic is sacrificed, but additional
routine detail could encourage exhaustive model writing. Selection does not
require the writer to mention every source.

**Relevance still depends on the supplied pool/ranks.** In a polluted pool, V2
selects a meaningful follow-up before a lower-similarity unrelated coupon note
under a tight count limit. With enough spare capacity, it also adds the coupon.
No unsupported cutoff or inferred relevance label is added to conceal this limit.
An already full eight-topic initial selection receives no enrichment, even when
a useful follow-up remains outside it. V2 does not solve competition for occupied
slots or poor upstream retrieval.

**Contradictions are not reconciled.** Distinct contradictory notes are retained
verbatim with separate source attribution. However, the original token-set
Jaccard deduplication can treat a nearly identical statement with added “not” as
a duplicate and discard the correction before selection. V2 inherits this known
limitation intentionally; fixing it would be a separate change to deduplication,
with its own semantic regression evidence. Repeated text/IDs do not reenter
through capacity filling.

Other adversarial checks cover the inclusive start/exclusive end, invalid dates,
Journal and missing-ID exclusion, foreign/missing owner, source opt-out, revoked
consent before source access, exact provenance, unchanged sparse-week eligibility,
a saturated count budget, skipping an oversized candidate for a smaller one,
Unicode-heavy topic metadata exhausting byte capacity, and preservation of an
original selection that already trims. Nonfinite ranks and conflicting equal-rank
versions fail closed rather than introducing input-order-dependent winners.

## Integration recommendation

The evidence is sufficient to retain V2 as a concrete, reviewable candidate and
to justify an integration proposal. It is **not sufficient for production
replacement or a claim of better Weekly Reflection prose**. The frozen weeks
are small, use authored topics and neutral ranks, and have no live retrieval or
independent native-editor assessment. Weeks with empty topics mostly remain
unchanged because the existing fallback treats each Event as its own group.

Before a separately authorized integration, review the soft-cap policy and the
relevance/near-duplicate trade-offs. Decide whether candidate-pool quality is
adequate or whether a separately scoped deduplication/relevance experiment is
needed. Do not infer that all same-topic Events are meaningful follow-ups, add a
new style prompt, or weaken validation to manufacture an editorial gain. No further
implementation, provider evaluation, deployment or production action is included
in this task. Stop for owner review.

## Files and offline verification

New experiment files:

- `experiments/weekly-evidence-selector-v2/selector.mjs`: candidate and admission preview.
- `experiments/weekly-evidence-selector-v2/benchmark.mjs`: read-only comparison and metrics.
- `experiments/weekly-evidence-selector-v2/selector.test.mjs`: frozen/adversarial tests.
- `experiments/weekly-evidence-selector-v2/results.json`: synthetic measured results.
- This report.

Three previously uncommitted investigation files are carried into this branch
byte-for-byte, so the commit is self-contained: the earlier bottleneck report,
`experiments/reflection-editorial-bottleneck/fixtures.mjs`, and its `check.mjs`.
They remain unchanged in the original worktree as well. No production source,
existing tests, dependency/lock files, environment files, database schema,
historical evaluation artifacts or consumed ledgers are edited. The experiment
does not open the shared historical-artifact directory. Installed dependencies
are reused through an ignored local directory; no installation scripts run.

```sh
env -i PATH="$PATH" node experiments/weekly-evidence-selector-v2/benchmark.mjs
env -i PATH="$PATH" node --test experiments/weekly-evidence-selector-v2/selector.test.mjs
env -i PATH="$PATH" node --test --test-name-pattern='report evidence selection|Weekly and Monthly report inputs' test/back/ai-foundation.test.js
env -i PATH="$PATH" node --test test/back/reflection-v2.test.js test/back/reflection-v2-validation-diagnostics.test.js test/back/reflection-v2-quotation-contract.test.js test/back/report-write-fence.test.js
```

**114 tests pass, zero failures/skips:** 44 new experiment tests, 3 existing
selection/input tests, and 67 existing Reflection/quotation/diagnostic/source-fence
tests. Source fences use disposable in-memory PGlite, not a production database.
The first adversarial run exposed a test-only Node 24 comparison issue for cloned
invalid Dates; input-mutation checking was corrected before the final passing run.
Syntax, staged diff hygiene, unchanged-runtime checks and AST-only Graphify update
accompany the commit. No live AI calls, paid evaluations, deployments, database
changes, new evaluation ledgers or provider changes occurred.
