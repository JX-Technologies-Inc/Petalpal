# Weekly Evidence Selector V2 integration candidate

2026-10-15, America/Vancouver. Base:
`171dbd555355934b19fb63b1b201db2d1c296a61`.
Branch: `codex/weekly-selector-v2-candidate`.
Worktree: `/Users/xingranma/Documents/ChatGPT/jev/petalpal-weekly-selector-v2-candidate`.
**Candidate prepared and verified offline. Default OFF. Not activated or deployed.**

The corrected selector retains all ten annotated follow-ups recovered by the
earlier V2 while excluding its two added routine records. Exact-only duplicate
suppression retains changed negation and contradictory assertions. A default-OFF
integration path is prepared; its complete Weekly inputs and packets match the
pinned implementation on all 28 frozen cases. No narrative improvement is claimed.

## Corrected rules

[The runtime candidate](../../lib/weekly-evidence-selector-v2.js) uses only existing
EventMemory summaries, topics, IDs, timestamps, similarity and importance metadata.
It creates no relevance scores and calls no model or service.

**Duplicate suppression:** merge only identical source identities or text identical
after NFC normalization and whitespace collapsing. Case, punctuation, numbers,
word order, negation and names are preserved. Token-set similarity is never used
to merge statements. Changed assertions remain candidates even when their words
largely overlap. Conflicting versions sharing an Event/Memory identity fail closed
with a content-free stale-source error; retrieval scores may vary for otherwise
identical source hits. Every retained row carries its exact original text/topics
and paired Event/Memory provenance.

**Initial diversity:** retain the existing two-round topic allocation, existing
ranking precedence and chronological output. The first sorted topic is still the
group key, with per-Event fallback for empty topics. Correcting deduplication can
change membership when V1 previously conflated distinct statements; preserving
that conflation is not part of preserving the diversity algorithm. The V1 function
and earlier experimental V2 remain unchanged.

**Backfill:** capacity alone and a shared topic are insufficient. An addition must
share at least two nontrivial lexical words with an *initially selected* source in
the same group and contain a previously unseen sentence segment. Common function
words and weekday labels do not establish the link. English and Simplified Chinese
use standard local word/sentence segmentation; meaningful single-character Han
words are retained. Only initial sources can establish links, preventing additions
from creating a chain into unrelated topics.

A narrow exception preserves brief surface corrections such as “I am happy” and
“I am not happy”: one shared content word suffices when the remaining word sequence
matches after removing literal negators, and the number of negators changes.
Common English negative contractions and literal Chinese negators are recognized
for this admission check only. It neither resolves double negation nor labels a
feeling; it is never a duplicate test and never edits the source. A new negated
sentence remains new evidence even when all its other words are familiar.

Known sentences reordered into another record do not pad backfill. Meaningful
corrections that alter an assertion remain separate. Additions use the existing
rank order, satisfy count/context bounds, and must survive the unchanged Weekly
packet builder without evicting any initial source. If the initial selection
already trims or fails packet admission, it receives no enrichment; existing
downstream admission/rejection remains authoritative.

The authoritative bounds remain 32 supplied candidates, eight selected Events,
4,000 context characters using `summary.length + 96`, two Events for generation,
and unchanged conservative Gateway byte admission. No token/output limit, schema,
validator, quotation contract, privacy allowlist or request count changes.

## Default OFF integration boundary

`AI_WEEKLY_EVIDENCE_SELECTOR_V2` is unset by default. Unset or literal `false`
executes V1. Only literal `true` enables the candidate for localized Weekly inputs
under the exact `AI_WEEKLY_REFLECTION_CONTRACT=weekly-reflection-v2` contract.
Other flag values or an incompatible output contract fail closed before semantic
retrieval, candidate selection or provider use; consent-checked period reads still
precede this configuration check.
This contract guard keeps the candidate's byte preview aligned with the actual
packet format. Monthly and unlocalized Workers AI Weekly inputs ignore the flag.
No environment/configuration values were changed by this task.

The worker forwards its existing environment to `ReportInputService`; the service
snapshots only the two nonsecret selector/contract settings. OFF takes the
unchanged selector path. ON lazily loads the candidate, avoiding a packet-builder
module-initialization cycle. There is no dependency from runtime code on experiment
fixtures, results, review labels or historical evaluation runners.

Consent and owner-scoped eligible period rows are loaded by the existing service.
ON reconciles every retrieved candidate with those exact Event/Memory versions
before selection: owner, source IDs, memory type, occurrence time, raw text, topics
and importance must match. Forged/stale data is refused before it can become a
provider packet. Existing authorization/source rechecks before dispatch and
persistence, deletion/revision fences, selected-versus-cited tracking, atomic
completion, finalized reuse and no-replay liabilities remain unchanged. The pure
selector is not a replacement for consent or those fences.

## Three-way frozen comparison

[Comparison code](../../experiments/weekly-evidence-selector-v2-candidate/compare.mjs)
and [saved results](../../experiments/weekly-evidence-selector-v2-candidate/results.json)
reuse the original semantic/editorial fixtures unchanged. Every supplied score is
still neutral (`similarity: 0`, `importanceScore: null`). Review annotations affect
measurement only, never selection.

| Measure across both languages | V1 | Earlier offline V2 | Corrected V2 |
| --- | --- | --- | --- |
| Semantic evidence retained | 32 / 32 | 32 / 32 | 32 / 32 |
| Semantic target evidence retained | 18 / 18 | 18 / 18 | 18 / 18 |
| Editorial evidence retained | 44 / 56 | 56 / 56 | 54 / 56 |
| Annotated meaningful editorial evidence | 22 / 32 | 32 / 32 | 32 / 32 |
| Previously lost meaningful follow-ups | 0 / 10 | 10 / 10 | 10 / 10 |

Per-locale selections below are the same in English and Simplified Chinese.
Positions refer to the original fixture sources, independently of packet aliases.

| Case | V1 positions | Earlier V2 positions | Corrected positions |
| --- | --- | --- | --- |
| Q01 proposal | E1–E4 | E1–E7 | E1–E5, E7 |
| Q02 visit/choir | E1–E5 | E1–E6 | E1–E6 |
| Q03 ordinary moments | E1–E4 | E1–E4 | E1–E4 |
| Q04 sparse week | E1–E2 | E1–E2 | E1–E2 |
| Q05 pottery | E1–E3 | E1–E4 | E1–E4 |
| Q06 exhibition | E1–E4 | E1–E5 | E1–E5 |

Q01's later revision and clear-example feedback remain; its additional towel
laundry entry is excluded in both languages. Q02's unbooked visit, Q05's unfired
bowl and Q06's continuing disappointment remain available. No source claims a
successful presentation, completed firing or emotional recovery.

Every initially selected frozen source and every distinct topic survives. Q01's
largest-topic share rises to 4/6 (66.7%) rather than earlier V2's 4/7 (57.1%), because
the added routine is removed; topic breadth remains two. The other enriched cases
retain earlier V2's concentration. All tested rotations/reversals are deterministic,
and every selected frozen source survives packet admission. Maximum corrected
context is 1,492 characters; maximum full request plus existing reserve is 4,694
bytes against 8,192. These are byte admission checks, not an Anthropic token count.

## Regression findings and limits

- Near-identical negated corrections that V1/earlier V2 discarded survive exact-only
  deduplication. Tests also retain changed denial scope, litotes, actor order,
  quantities, case distinctions, Chinese negation and distinct contradictory notes.
- In a tight three-source pool, earlier V2 fills the remaining slot with a
  higher-ranked unrelated coupon and loses a lower-ranked proposal follow-up.
  Corrected V2 rejects the coupon and retains the follow-up. High importance alone
  does not bypass the link gate.
- Reordered previously known sentences and a transitive topic-drift example are
  excluded. A changed negated sentence and brief one-content-word correction remain.
- Exact/repeated identities, ambiguous source versions, sparse/empty weeks,
  half-open time windows, Journal exclusion, malformed ranks/limits, owner/opt-out
  refusal and character/Unicode-heavy byte bounds are covered.
- Default-OFF and explicit false match the *pinned previous class*, not merely
  another invocation of current code, on all 28 complete inputs and packets.
  Monthly inputs match with OFF/ON/invalid Weekly flags. The legacy Weekly route
  also matches. Invalid ON configuration and revoked consent stop retrieval.
- The actual worker is exercised with synthetic PGlite data and an authored mock
  response. OFF preserves V1's two-source packet; ON retains the negated correction
  in a three-source packet. Both use the unchanged prompt and one mocked dispatch.
  Three evidence edges persist; finalized reuse makes no second dispatch.

Lexical linking is a conservative admission heuristic, not semantic relevance
proof. It can miss paraphrased follow-ups without shared words or explicit topic
metadata, and unrelated records can still share specific words. The initial
diversity pass intentionally retains its existing relevance assumptions; V2 does
not remove its false positives or displace its sources when all eight slots are
occupied. Empty topics still behave as separate groups. Surface-negator recognition
is limited and does not establish entailment, emotional direction or temporal
resolution. Human semantic review remains necessary.

Exact-only deduplication can retain punctuation/case variants that fuzzy matching
would have discarded. This trades some redundancy for preserving distinct claims.
Count, character and byte bounds can still omit a correction; the corrected rule
prevents lexical duplicate suppression from being the cause. No promise is made
that every contradictory record survives a saturated evidence budget.

Local verification uses Node 24.7.0 / ICU 77.1. The repository deployment image
specifies Node 24.21.0, which was not installed or executed here. Segmentation can
change with ICU versions; rerun the frozen regression suite in the release runtime
before a separately authorized enablement. No runtime installation or deployment
was performed for this preparation.

## Files and verification

Runtime changes:

- `lib/weekly-evidence-selector-v2.js`: corrected deterministic candidate.
- `lib/report-foundation.js`: default-OFF routing, contract guard and source reconciliation.
- `lib/ai-worker.js`: pass existing environment to the input service.

Evidence/tests/documentation:

- `test/back/weekly-evidence-selector-v2.test.js`: candidate, pinned parity and service tests.
- `test/back/sonnet-weekly.test.js`: one new mocked worker integration/reuse test.
- `experiments/weekly-evidence-selector-v2-candidate/compare.mjs` and `results.json`.
- This report and a short new `SECURITY.md` section for the flag/source boundary.

Security documentation was reviewed and updated because runtime admission now has
a feature gate and explicit source-version reconciliation. No manual/provider
status changed, so `MANUAL_SECURITY_CHECKLIST.md` remains unchanged. Historical
reports, frozen fixtures, earlier experiment code/results, commits, approval
records and consumed ledgers are untouched. Monthly code, all prompts, schemas,
validators and provider/cost configuration are unchanged.

```sh
env -i PATH="$PATH" node experiments/weekly-evidence-selector-v2-candidate/compare.mjs
env -i PATH="$PATH" node --test test/back/weekly-evidence-selector-v2.test.js experiments/weekly-evidence-selector-v2/selector.test.mjs
env -i PATH="$PATH" node --test --test-name-pattern='selector flag reaches the worker' test/back/sonnet-weekly.test.js
env -i PATH="$PATH" node --test --test-name-pattern='report evidence selection|Weekly and Monthly report inputs' test/back/ai-foundation.test.js
env -i PATH="$PATH" node --test --test-concurrency=1 test/back/weekly-evidence-selector-v2.test.js test/back/sonnet-weekly.test.js test/back/opus-monthly.test.js test/back/report-write-fence.test.js test/back/report-worker.test.js test/back/reflection-v2.test.js test/back/reflection-v2-validation-diagnostics.test.js test/back/reflection-v2-quotation-contract.test.js
```

249 distinct cases pass without failures/skips: 144 existing service, worker,
Reflection and source-fence cases; one new mocked worker case; 57 corrected-selector
cases/subtests; 44 frozen prior-experiment cases; and three existing selection/input
cases. The broad run passed 200 cases before the final two targeted regressions
were added. The final focused run passed 101 cases, including 55 overlapping the
broad run; repeated passes are not added to the distinct total. The final mocked
worker rerun also passes. Disposable in-memory PGlite is the only SQL engine used.
Saved comparison equality, syntax, diff hygiene and AST-only Graphify verification
accompany the commit.

This is a reviewable integration candidate, with no activation included. Do not
claim better narrative quality from evidence-selection metrics. No live AI calls,
paid evaluations, deployment, production database writes or provider/configuration
changes occurred. Stop for owner review before enabling V2.
