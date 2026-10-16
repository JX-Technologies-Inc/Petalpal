# Weekly narrative-thread candidate (default OFF)

Branch `feat/weekly-narrative-thread`, based on `45af54bd1e96c56361ab7d0f5c271513a804c1ae`.
**This is an offline design only.** No provider call, live evaluation, deployment, migration or flag activation was made.
The E03 runner branch, reports and ledgers are untouched.

## Why the current design produces chronological summaries

Evidence from the code:

1. **The packet is a timeline.** `evidence` is in date order, each item leads with `day`, and aliases `E1…En` follow that order.
   The most visible structure the model gets is the week's sequence.
2. **The composition paragraph has adjectives but no decisions.** It says "write thoughtfully", "synthesize supported patterns" and "avoid weekday inventories".
   It never says what to organize around, where to open, how to develop or where to stop. Without a procedure, the packet order becomes the plan.
3. **The citation contract rewards one Event per sentence.** "Refs must support every meaningful claim" makes a source-by-source walk the lowest-risk compliant shape.
   Nothing says that one sentence may bind several Events in order to state their relationship, although the schema allows up to 4 refs per sentence.
4. **The retrospective candidate stayed abstract and dropped existing guidance.** It used phrases like "let their relationship carry the writing" and "let the ending rest".
   It also removed the existing anti-inventory, anti-motivational-ending and no-therapist lines. Moving weekdays into `recordDays` did not change the order.
   This is consistent with its E03 losses in both languages, but the live result does not identify a cause.

## Design

The new flag `AI_WEEKLY_REFLECTION_NARRATIVE_THREAD` accepts only literal `true`/`false`; it is unset (OFF) by default and requires `weekly-reflection-v2`.
It is exclusive with `AI_WEEKLY_REFLECTION_RETROSPECTIVE`, and setting both fails before retrieval with `AI_GATEWAY_CONFIG_INVALID`.
It replaces **only** the composition paragraph. The introduction (evidence safeguards) and the fidelity/JSON/ref/quotation paragraph stay byte-identical.
The packet is byte-identical to OFF: same object, sources, order, weekdays and refs. The prompt is the only thing that changes.

The replacement paragraph sets out these decisions, each conditioned on evidence:

| Decision | Rule | Evidence condition |
|---|---|---|
| Organize | Around relationships the Events state, not record order | — |
| Thread exists | Only when Events **explicitly share a named project, person or object** | Topics/sequence alone do not count (existing safeguard) |
| Open | On what the user *said* they wanted, liked or worried about | Stated in text |
| Develop | What each change fixed, kept or cost; cite linked Events together in a sentence that states the link | Change and effect stated |
| End | Latest stated state, including anything undecided | Stated |
| Unlinked Events | Side by side, briefly, no shared theme | — |
| Sparse | One plain sentence | — |
| Voice | The user's concrete details; feelings at their stated intensity; weekdays only when timing matters | — |
| Forbidden | Therapist voice, "This week"/"这周" opening, lesson, encouragement, invented metaphor | — |

**Budget.** The prompt adds 306 serialized bytes. With at most 172 bytes of native framing, the total stays within the builder's existing 512-byte allowance.
Packet trimming, Gateway admission, cost reservation, one-call dispatch, consent/ownership/source fences and the validator are all unchanged.
Monthly does not read the flag.

## Offline evaluation (E01–E09 × en/zh-Hans)

`experiments/weekly-narrative-thread-v1/` holds the evaluation material:

- **18 handcrafted exemplars** written in the intended style. They are test doubles, not Claude output and not owner-approved.
- **9 failure foils.**
- **A deterministic scorer** that reports each dimension separately. Each dimension is a lexical/structural *proxy*:

| Dimension | Proxy |
|---|---|
| Factual fidelity | Unchanged validator, plus per-case `keep` patterns (negation, open outcomes, attribution) and `avoid` patterns (documented failure claims) |
| Restraint | No lesson/therapy lexicon, no imposed-theme phrasing, sparse output ≤ 60 en / 30 zh characters |
| Cohesion | Fewer than 2 weekday names; thread weeks are not a one-Event-per-sentence date walk |
| Synthesis | For thread and mixed weeks, at least one sentence binds Events through a stated link; n/a for unrelated and sparse weeks |
| Naturalness | No stock opening and no opener repeated more than twice. **Human review required.** |

Results (`node experiments/weekly-narrative-thread-v1/run.mjs`):

- All 18 exemplars pass every applicable dimension and the unchanged validator under both selectors.
- Each foil fails its targeted dimension: weekday inventory, invented lesson, negation flip, invented outcome, forced theme with misattribution, padding and causal cure.
  **8 of the 9 foils pass the structural validator**, which shows what it cannot detect. Only the reworded quotation is rejected.
- Earlier provisional targets: the proxies flag a date walk in E02/en, a repeated opener in E03/en, and the "这周" opening in E09/zh.
  These are informational signals, not verdicts.

## Representative examples, traced

**E03 en**
> You liked the crooked cranes in your harbour sketch and wanted to keep them. The first test print lost the water completely in a dark block, and you were disappointed. Cutting thin channels through that dark water brought the water back, but the cranes looked too tidy, and you missed their crookedness. You redrew them from the original sketch and cut them unevenly; the new test kept the water lines and brought back the awkward cranes, closer to what you'd wanted, and you were pleased.
>
> The latest test print is on the shelf, and you like looking at it there; the paper for the final edition isn't chosen yet.

| Claim | Source |
|---|---|
| liked crooked cranes, wanted to keep them | E1 "I liked the crooked cranes in my sketch and wanted to keep them." |
| water lost in dark block; disappointed | E1 "lost the water completely in a dark block. I was disappointed." |
| channels through *that* dark water → water back; cranes too tidy; missed crookedness | E2 "cut thin channels through the dark water area… water showed up, but the cranes looked too tidy. I missed their crookedness." The link to E1 is stated by "the dark water area" |
| redrew from original sketch, cut unevenly; kept water lines, awkward cranes back; closer to wanted; pleased | E3, all clauses |
| on shelf, like looking; paper not chosen | E4 |

No perseverance, confidence or "final edition done" claim. The thread is the user's stated aesthetic preference.

**E07 zh-Hans**
> 城另一头那间工作室能让你画大画，你一直挺期待；让你担心的是租金。起初不知道报价包不包暖气，看房时房东不在，也没问清楚；你喜欢那扇朝北的窗，出来时很有兴趣，又有点不踏实。后来房东确认租金包含暖气，这笔费用让你松了口气。
>
> 总租金能不能负担，还得算一算。你跟阿黎说，决定之前还想再看一次，也没有答应搬过去。

| Claim | Source |
|---|---|
| 画大画→期待；担心租金 | E1 "能画大画让我挺期待，又担心租金"; E4 "还是很期待那里的画画空间" (supports 一直) |
| 不知道包不包暖气；房东不在没问清；朝北的窗；有兴趣又不踏实 | E1, E2 |
| 确认含暖气；松了口气 (scoped to that cost) | E3 "至少这笔费用不用另算，松了口气" |
| 总租金还得算 | E3 |
| 想再看一次；没有答应搬 | E4 |

The studio is "the one Ari suggested", not Ari's. Relief is limited to the heating cost. Nothing is signed and there is no move.

## What offline tests prove — and what they don't

**Proven offline:**
- Default OFF keeps the original prompt, settings shape and packet.
- The new prompt routes only when the flag is ON. Invalid or ambiguous settings fail before retrieval.
- Byte admission holds for all 36 corpus views and for the worst-case eight-source packets at both output caps.
- Every exemplar validates, and the scorer separates the known failure shapes.
- Actual-worker tests were added for E03 en/zh across both selectors. They cover one dispatch, a packet identical to OFF, only the system prompt differing, provenance, privacy and no regeneration.
  They also re-run the zero-budget, invalid-output, deletion and consent safeguards with the flag ON, and the Monthly parity matrix now includes the flag.
  **These PGlite tests still need a local run** (the sandbox has no `@electric-sql/pglite` or real `ajv`).

**Not proven:**
- Whether Claude writes better, or even differently, under this prompt.
- Faithful paraphrase. The validator cannot check entailment, and the probes are lexical.
- Naturalness.
- Blind preference over baseline.

All of these require separately authorized real Claude outputs and human review against the existing rubric.
That should be a fresh, independent blind OFF/thread comparison, with the retrospective arm retired, and it must not reuse consumed ledgers.
