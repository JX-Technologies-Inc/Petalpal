# Weekly short report — design (approved direction, 2026-10-20)

Status: **design approved by the owner; build after the beta.** No code yet. The beta keeps the
current narrative-thread Weekly report ([BILINGUAL_WEEKLY_ACCEPTANCE.md](../testing/BILINGUAL_WEEKLY_ACCEPTANCE.md)).

## Why

Two live A/Bs (2026-10-17, 2026-10-20) showed that prompt wording alone cannot make a one-week
report both deep and faithful: the owner read one style as long-winded and "obviously AI", the
other as an inventory ([WEEKLY_PATTERN_INSIGHT_CANDIDATE.md](../ai/WEEKLY_PATTERN_INSIGHT_CANDIDATE.md)).
Depth should come from the user's own words placed side by side and across time, not from the
model interpreting feelings. Fewer model-written words also means less "AI voice".

## Sections (top to bottom)

| Section | Source | Rule |
|---|---|---|
| Line of the week | Model picks, code verifies | One exact clause from this week's Events, unchanged; tap opens that Event |
| Mood curve | Code only | Seven days from the user's own `primaryGardenMood` per Event; one factual line ("Quiet or Drifting 5 times early in the week; Healing and Peaceful 3 times from Friday") |
| Side by side | Model, at most 2 sentences | Two Events placed next to each other; states what happened only — no "because", no "this shows you…"; per-sentence refs and the existing validators |
| Then and now | Retrieval + code | An earlier entry about the same thing (≥ 7 days apart), both exact quotes in date order; only factual counts ("the third time this month you wrote about not sleeping") |
| A question for you | Model, 1 sentence | A question, never advice; its button starts a new Event |
| Petal card (optional) | Code only | [PETAL_CARDS_DESIGN.md](PETAL_CARDS_DESIGN.md) |

Mood curve levels (display only, never shown as labels): Sunny high; Peaceful, Gentle, Wonder,
Healing middle; Quiet, Drifting, Fire low. Points are the user's own flowers.

## Fallbacks (never pad)

1. Fewer than 3 Events: line of the week and mood curve only.
2. No earlier entry about the same thing: hide "then and now".
3. Then-and-now order of preference: a change in wording → a repeated phrase → hidden.
4. Any Event triggers the existing support hint: no quotation and no card; show support resources.
5. A model-written section fails validation: hide that section only; the rest still shows
   (today a single failure loses the whole report).

## Build notes (not started)

- English cross-week retrieval can reuse BGE/pgvector; Chinese needs a retrieval path (BGE is
  English-only today).
- New per-section contract and validator (exact-quote check for the line of the week and then-and-now).
- Live acceptance: owner blind review against the current report, as in the earlier A/Bs.
- Mockup used for approval: low-week example in en and zh-Hans (synthetic data), reviewed in chat on
  2026-10-20; not stored in the repository.
