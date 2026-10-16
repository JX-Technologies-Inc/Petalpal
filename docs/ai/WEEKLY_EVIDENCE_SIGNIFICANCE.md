# Weekly evidence significance — opt-in Selector V2 refinement (default OFF)

Branch `feat/weekly-evidence-significance`, from `4816ce3ce740b5822aee5a38c145f9180c4d72da`.
This change touches evidence selection only.
- The Weekly prompts are byte-identical, and `AI_WEEKLY_REFLECTION_NARRATIVE_THREAD` is untouched.
- Monthly is unchanged.
- No migration, flag activation, deployment or provider call was made.

## Confirmed root causes

| Stage | Cause | Cases |
|---|---|---|
| Upstream candidates | Chinese passes only the **last 32** period rows to the selector. English passes the BGE top 32 for a generic period query. Meaningful early (zh) or low-similarity (en) Events never reach the selector | F |
| Missing metadata | `EventMemory.importanceScore` is always null in production (see below) | all |
| Ranking | With equal similarity and null importance, the order falls back to `similarity → importance → earliest date`, so the first days absorb all 8 slots | A, J, K |
| Theme quota | Two slots per topic label, filled theme-round by theme-round. A later linked outcome in a busy week loses to round-0 picks of other themes, and unrelated experiences sharing a label compete for the same 2 slots | C, I, K, L |
| Lexical backfill | Needs ≥2 shared words, so a short later outcome ("Still haven't decided on the paint") cannot be added | C |
| Packet budget | Not a cause. Maximum stress context is 1,304 of 4,000 characters | — |

### `importanceScore` is not usable

- The only writer is `DeterministicMemoryExtractor.extract`, which copies `event.importanceScore`.
- The `Event` model has no such column, and no route, service or job sets it.
- The value is therefore persisted as null (only an acceptance script inserts synthetic values).
- The selectors, write fence and trend analyzer consume it, but it never carries information.
- Making it real needs a new source of truth and a schema/migration decision.
- This change still honours it if it is ever populated, and stale-checks it exactly as before.

## What changed

**New flag:** `AI_WEEKLY_EVIDENCE_SIGNIFICANCE`.
- Literal `true`/`false` only; unset means OFF.
- Requires `AI_WEEKLY_EVIDENCE_SELECTOR_V2=true` on the localized Weekly path. Any other value, or use without V2, fails before retrieval with `AI_GATEWAY_CONFIG_INVALID`.
- With it OFF, V1 and V2 are byte-identical to before.

**Retrieval** (`lib/report-foundation.js`):
- The English BGE retrieval call is unchanged (one call, same query and take), and its rows are still reconciled against the loaded source versions, with stale or forged rows refused.
- The bounded 32-row pool is now ranked from **every already-loaded, consent-checked, owner-scoped period row**. The `sourceFence` snapshot already covers those rows.
- English similarity contributes ranking only.
- No new query, model, API call or limit was added.

**Selection** (`lib/weekly-evidence-selector-v2.js`, only when `significance: true`): candidates are ordered, never rewritten. The tiers are applied in this order:
1. **Repetition:** records whose content words repeat a higher-ranked record (Jaccard ≥ 0.6) are deferred. Negated corrections are exempt, because frequency is not significance.
2. **Importance:** an explicit `importanceScore` is used if present.
3. **Stated stance:** a closed, polarity-neutral set of first-person *wanting, valuing, deciding, concern and open-question* constructions.
   - en examples: "I liked", "I'm worried", "haven't decided", "not sure".
   - zh examples: 我…喜欢/担心/决定, 还没定, 不确定.
   - It contains **no emotion adjectives**: "Sad weather", "Happy hour" and "She sounded excited" are not marked. It is never emitted to the model.
4. **Day spread:** within a tier, candidates take turns by local day. Within a day the order is similarity, then more distinct content words (a bounded detail count), then time.

**Allocation:**
- Rows are admitted in rank order, with `maxPerTheme` (2), 8 sources and 4,000 characters unchanged.
- A topic label groups records only if their text shares a specific word that is not a label word. Otherwise each record is its own experience.
- A linked group's **endpoint** (its latest other non-repeated record) is admitted together with its first record.
- Lexical backfill, packet admission, ordering and provenance are unchanged.

## Before/after (same limits; `experiments/weekly-selective-reflection-v1/report.mjs`)

The stress set is deterministic and synthetic. A–H are recorded unchanged, and I–L were added.
`meaningful`, `group` and `outcome` are review annotations, stripped before selection; a test asserts they never appear.
English and Chinese give identical recall.

| Case | Eligible | Candidates before → after | V2 meaningful | After meaningful | Later outcome before → after |
|---|---|---|---|---|---|
| A 21 unrelated, 3/day | 21 | 21 → 21 | 0/3 | **3/3** | — |
| B routine stress + quiet positive | 12 | 12 → 12 | 1/1 | 1/1 | — |
| C project + unrelated | 8 | 8 → 8 | 4/5 | **5/5** | — |
| D corrections/negation | 5 | 5 → 5 | 4/4 | 4/4 | — |
| E sparse | 3 | 3 → 3 | — | — | — |
| F 40 Events | 40 | 32 → 32 (now ranked from all 40) | 1/2 | **2/2** | — |
| H colloquial | 4 | 4 → 4 | 3/3 | 3/3 | — |
| I similar labels, unrelated | 6 | 6 → 6 | 3/3 | 3/3 | 1/1 → 1/1 |
| J 7 Events on one day | 13 | 13 → 13 | 0/1 | **1/1** | — |
| K 21 all-distinct | 21 | 21 → 21 | 1/3 | **3/3** | 0/1 → **1/1** |
| L studio concern → open decision | 14 | 14 → 14 | 1/2 | **2/2** | 0/1 → **1/1** |
| G Monthly | — | unchanged | 4/4, 5/5 weeks | identical | — |

- Every case improves or stays equal against both V1 and V2.
- The maximum context is 1,304 characters.
- Independent-experience coverage is equal or higher, except K (8/20 → 7/20) and L en (7/12 → 6/12). There the linked outcome takes the slot of one more routine record.

**False-link risk:**
- Case I delivers unrelated records that share a topic label (en: 5 pairs, zh: 3), and labels remain in the packet.
- The selector adds no link metadata. Avoiding tag-only links is left to the final prompt's existing instruction and to human review.

## Remaining limitations

- **Significance without stance or detail is invisible.** A meaningful one-liner with no first-person stance competes only on day spread and detail. The stance list is a bounded heuristic, not significance understanding: it can miss implicit significance and can mark trivial "I liked the soup".
- **Very high volume:** the pool ranks all loaded rows (O(n·representatives) in memory; the period query was already unbounded). Only 8 sources reach Claude. Weeks with more than 8 meaningful Events still lose some.
- **English similarity** comes from a generic query and stays the first tie-break inside a day. It is approximated as 0 offline because BGE can't run here.
- **Monthly** shares the same null importance and earliest-first fallback. It is unchanged here by design: the same tiers could order within its mandatory per-week anchors in a future, separately approved change.
- A real `importanceScore`, or a user-explicit "this mattered" marker, would be the principled signal. It needs product approval and a migration.

## Tests

- `test/back/weekly-evidence-significance.test.js`: recall, faithfulness, stance neutrality, label/identity, bounds, fences, input-service routing, Monthly parity.
- `test/back/sonnet-weekly.test.js`: actual worker with the flag ON, covering one call, provenance, privacy, invalid configuration, budget, invalid output, deletion and consent.
