# Weekly short report — design (approved direction, 2026-10-20)

Status: **design approved by the owner; step 1 (backend contract) built, default OFF.** The beta keeps
the current narrative-thread Weekly report ([BILINGUAL_WEEKLY_ACCEPTANCE.md](../testing/BILINGUAL_WEEKLY_ACCEPTANCE.md)).

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

## Step 1 — backend contract (built, default OFF, offline tests only)

Enable with `AI_WEEKLY_REFLECTION_CONTRACT=weekly-short-v1` (Sonnet provider). Code:
[lib/weekly-short.js](../../lib/weekly-short.js), wired in [lib/sonnet-weekly.js](../../lib/sonnet-weekly.js).

- One request; the model returns `line`, `sideBySide`, `question` (each may be empty). The packet
  reuses the v2 builder's selection, aliases and byte trimming; `include` lists the parts wanted.
- Saved `narrativeSections` kinds, in order: `LINE_OF_WEEK`, `MOOD_CURVE`, `SIDE_BY_SIDE`, `QUESTION`;
  a support week saves `MOOD_CURVE` + `SUPPORT_RESOURCES`. No schema migration.
- Per-part checks; a failing part is hidden alone. Malformed JSON or a wrong locale still fails the job.
  - Line of the week: an exact clause-aligned copy from the cited Event (same rule as v2 quotations).
  - Side by side: exactly two Events; numbers and quotations must come from cited Events; explanatory
    links (because / shows / means, 因为 / 所以 / 说明 …) hide it.
  - Question: one sentence ending in ? / ？; advice words (should / try to, 应该 / 试试 …) hide it.
- Mood curve: one point per period Event with a `primaryGardenMood` (date, mood, level, Event id) and a
  code-written line such as "Mon–Thu: Quiet 2 times, Drifting once. Fri–Sun: Healing 2 times."
  Time rules: [time.md](../../time.md).
- Fewer than 3 Events: only the line of the week is requested; side by side and question are ignored.
- Support: the mobile immediate-danger rule now also runs on the server
  ([lib/emotional-safety.js](../../lib/emotional-safety.js)) over this week's Event memories. A match
  skips the model call entirely: no quotation, mood curve and support text only.
- Event deletion also deletes a short report whose mood curve shows that Event, even when it was
  not cited ([lib/ai-events.js](../../lib/ai-events.js)).

Open items for the owner:

- zh-Hans mood names confirmed by the owner (2026-10-20): 晴朗 平静 温柔 好奇 疗愈 安静 迷茫 火焰.
- A week with fewer than two selectable Events stays "insufficient evidence" (no curve-only report yet).
- Hosted TEST only allows the v2 contract (`lib/integration-environment.js`); live acceptance needs that
  gate widened under a separately approved task, then paid inference approval.

## Step 2 — mobile rendering (built)

[ShortWeeklyReport.tsx](../../mobile/src/components/features/ShortWeeklyReport.tsx), parsing and layout in
[reflections.ts](../../mobile/src/services/reflections.ts); used by the Reflection Summary tab.

- Only a report whose every section has `contractVersion: weekly-short-v1` renders this way; older
  reports keep the plain summary text.
- Line of the week: tapping it loads that Event with the existing `GET /events/:id` and shows its full
  text inline (or a short "can't be opened" note); no new route.
- Mood curve: seven columns (Mon first), the user's mood icons from the Event panel as points, joined in
  time order; the factual line sits below and is the curve's accessibility label.
- Question: "Write about it" / 写一写 opens the existing Event panel (`/` with `feature=events`).
- Labels follow the report's locale (en / zh-Hans).
- Checked offline (parsing and layout tests, type check) and visually in Expo web at phone width with
  synthetic data; the signed-in tap-to-Event success path is not yet checked against a backend.

## Next steps

- Then and now: English cross-week retrieval can reuse BGE/pgvector; Chinese needs a code-only path
  (repeated phrase, ≥ 7 days apart), since BGE is English-only today.
- Live acceptance: owner blind review against the current report, as in the earlier A/Bs.
- Mockup used for approval: low-week example in en and zh-Hans (synthetic data), reviewed in chat on
  2026-10-20; not stored in the repository.
