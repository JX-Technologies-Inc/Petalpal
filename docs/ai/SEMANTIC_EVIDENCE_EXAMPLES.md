# Semantic evidence — six UNVERIFIED product targets

**Every draft below is UNVERIFIED_TARGET_PROSE and ineligible for production.** Six manual target-style drafts authored during this task; not Claude outputs, not executable native generation, not blind human review. No source-to-meaning or meaning-to-prose alignment in these drafts has independent certification. Naturalness, plausible citations, correct length, and a manually written support table do not make the text safe. The prototype cannot certify these drafts. They are not registered conditional fixture realizations either.

The six drafts deliberately reuse the creative scenario to make the locale and report-type comparison inspectable. The separate evaluation corpus covers eight domains and 32 Events. Within each report type, all three locales use identical unchanged source strings; those same inputs appear in the v1/v2/v2.1 comparison. Weekly uses S1–S2. Monthly uses S1–S4. The synthetic recording dates are September 15/18 for Weekly, and September 2/9/16/27 for Monthly. They order records. Activity time is not established merely by those dates. The comparator authors recording and Event occurrence metadata separately, with equal values only in these fixtures.

## Exact source text

- **S1 / creative-1:** I sketched the kitchen window. I liked the uneven lines, though the reflection was hard to draw.
- **S2 / creative-2:** 今天给短篇小说换了一个开头，还没决定用哪一版；写的时候既兴奋又烦躁。
- **S3 / creative-3:** I returned to the window sketch and added the cup on the sill. I still liked the uneven lines.
- **S4 / creative-4:** 把短篇小說的兩個開頭讀給朋友聽了。她喜歡第二版，我還沒有選好。

Original source text is never translated in storage. English, Simplified Chinese, and Traditional Chinese source languages are separate from the requested output locale. Event and Memory text are intentionally identical in these synthetic fixtures; this does not establish that production EventMemory summaries preserve original Events.

## Manual factual-support analysis (not independent proof)

| Draft claim group | Exact supporting source spans | Boundary and unresolved semantic work |
|---|---|---|
| User sketched a kitchen window; liked uneven lines; found the reflection difficult | S1: “I sketched the kitchen window.” / “I liked the uneven lines” / “the reflection was hard to draw” | Self-recorded experience, not external-world verification. Do not infer drawing location, accomplishment, pride, improvement, or a specific date. English “uneven” ↔ 不太规整/不太規整 needs intensity/idiom review. |
| Story opening changed; version not chosen; mixed emotion while writing | S2: “给短篇小说换了一个开头” / “还没决定用哪一版” / “写的时候既兴奋又烦躁” | The emotions are scoped to writing, not necessarily the act of replacement. Do not say the whole story was rewritten or finished. “irritated” is a proposed 烦躁 mapping; no exact equivalence is proved. |
| Returned to the same window sketch, added cup on sill, still liked lines | S3: “returned to the window sketch” / “added the cup on the sill” / “I still liked the uneven lines” | Same-sketch identity and a before/return relation are explicitly recorded. Record dates alone could not establish them. Neither recurring practice nor quality change follows. Cup ownership/color are unknown. |
| Read two openings to a friend; friend liked second; user had not chosen | S4: “把短篇小說的兩個開頭讀給朋友聽了” / “她喜歡第二版” / “我還沒有選好” | Preserve distinct actors. Her preference does not mean the user agreed. Non-decision is true of the recorded report, not necessarily now. Comparing S2/S4 must not imply a continuous state between them. |
| Both topics recur in the selected month's records | S1/S3 explicitly mention the window sketch; S2/S4 explicitly mention story openings | Counts concern distinct synthetic records with explicitly repeated subjects. No claim about habits, perseverance, recovery, personality, or increased activity is licensed. Topic equivalence remains a manual alignment assumption. |
| Optional source-specific questions | Referents: S1/S3 sketch and cup; S2/S4 openings | Optionality is not a proof that a question has no factual premise. Present availability, interest, an unfinished choice, and the wording “line or passage” require review. Every question remains uncertified. |

No draft asserts that drawing caused a feeling about story writing, that record order proves activity chronology, or that mixed feelings demonstrate growth. Those are excluded interpretations, not supported insights. The unresolved scope issues below are reasons to withhold certification even where the intended meaning seems reasonable.

## Lengths

Counts use Intl.Segmenter grapheme clusters, including punctuation and excluding whitespace. Chinese targets are approximately 100–180 Weekly and 250–350 Monthly; English word counts are descriptive, not a transferred Chinese limit.

| Draft | Graphemes | English words | Validation |
|---|---:|---:|---|
| WEEKLY / en | 341 | 72 | UNVERIFIED |
| WEEKLY / zh-Hans | 116 | — | UNVERIFIED |
| WEEKLY / zh-Hant | 117 | — | UNVERIFIED |
| MONTHLY / en | 607 | 128 | UNVERIFIED |
| MONTHLY / zh-Hans | 186 | — | UNVERIFIED |
| MONTHLY / zh-Hant | 186 | — | UNVERIFIED |

The Chinese Weekly drafts fit the requested range; the Monthly drafts are shorter than 250 graphemes. This is an explicit unmet product target. The available details did not justify more prose without repeated recap or padding. Neither length compliance nor a shorter draft establishes factual certification or usefulness.

## WEEKLY / en — UNVERIFIED

The uneven lines were something you liked in your kitchen-window sketch, even while the reflection was difficult to draw. With your short story, you tried a different opening and had not yet chosen a version; excitement and irritation were both part of writing it. If you feel like revisiting either piece, is there a line or passage you would like to linger over? Leaving them for another day is an option, too.

Specific unresolved concerns:

- Kitchen-window joins kitchen window and sketch; the source does not locate the user at the window.
- Different opening paraphrases 换了一个开头. It does not establish an improved, finished, or published story.
- Irritation is a proposed rendering of 烦躁, not an independently reviewed intensity equivalence.
- The invitation refers to existing pieces but line or passage is a small inferred detail of a sketch/story; a free-text checker cannot certify its presuppositions.

## WEEKLY / zh-Hans — UNVERIFIED

这周，你写到厨房窗户的速写：喜欢那些不太规整的线条，也觉得倒影不好画。写短篇小说时，你换了一个开头，还没决定用哪一版；兴奋和烦躁同时在场。如果愿意，可以再看看那张速写，或读一遍新开头，有没有哪一处想多停留一会儿？也可以先把它们放下。

Specific unresolved concerns:

- 这周 scopes recording, not a separately established date of drawing.
- 不太规整 may soften uneven; 不好画 may shift hard to draw. Neither multilingual equivalence has independent native-speaker review.
- 同时在场 renders 既兴奋又烦躁 without reducing the negative feeling, but remains an unvalidated metaphorical paraphrase.
- 新开头 means the replacement opening, not a completely new story; the invitation must not imply a wish to continue or a need to improve.

## WEEKLY / zh-Hant — UNVERIFIED

這週，你寫到廚房窗戶的速寫：喜歡那些不太規整的線條，也覺得倒影不好畫。寫短篇小說時，你換了一個開頭，還沒決定用哪一版；興奮和煩躁同時存在。如果你願意，可以再看看那張速寫，或讀一遍新開頭，有沒有哪一處想多停留一會兒？也可以先把它們放下。

Specific unresolved concerns:

- Traditional-script output must not alter the English source or the Simplified source/profile language.
- 速寫, 不太規整 and 不好畫 are proposed translations, not merely a lossless script conversion.
- 同時存在 retains mixed emotion in intent, but exact simultaneity/intensity needs review.
- No causal connection between the drawing difficulty and the emotions during story writing is licensed. The draft must continue to separate those activities.

## MONTHLY / en — UNVERIFIED

The kitchen-window sketch and the opening of your short story appear in entries from different weeks. You liked the sketch's uneven lines even though the reflection was difficult to draw. When you returned to that sketch and added the cup on the sill, you still liked those lines.

You wrote about changing the story's opening without yet choosing a version, and about feeling both excited and irritated while writing. Another entry describes reading two openings to a friend. She preferred the second; in that entry, you had not made your own choice.

If you feel like revisiting either piece, is there a detail in the sketch or a passage in an opening you would like to look at again? You can leave that question for another day, too.

Specific unresolved concerns:

- Recurrence is about distinct selected records, not a creative habit, commitment, or increase in activity.
- Returned to the window sketch explicitly links the sketch identity, but still does not prove artistic improvement or completion.
- The English draft resolves 她 to the friend and retains her preference separately from the user's non-decision; this mapping needs independent review.
- In that entry scopes the non-decision to the record; it does not establish the user's current preference or uninterrupted indecision.
- Irritated is an unreviewed translation of 烦躁. Emotions attach to writing generally, not necessarily changing the opening.
- The invitation and the words detail or passage have factual presuppositions that remain unverified; optionality is not semantic proof.

## MONTHLY / zh-Hans — UNVERIFIED

窗户速写和小说开头，出现在这个月不同周的记录里。你喜欢速写中不太规整的线条，倒影却不好画；回到那张速写时，你加上了窗台上的杯子，仍然喜欢那些线条。

写小说时，你既兴奋又烦躁，也换了一个开头。后来的一条记录写到，你把两个开头读给朋友听。她喜欢第二版，而在提到选择的那两条记录里，你当时都还没有选定。

如果愿意回看，你想先看看窗台上的杯子，还是读读那两个开头？也可以暂时不作选择。

Specific unresolved concerns:

- 不同周的记录 describes record coverage, not activity chronology, a habit, or increased practice.
- 回到那张速写 is supported by returned to the window sketch; it is not inferred merely from the later timestamp.
- 仍然喜欢 is explicitly supported by still liked, but 不太规整 and 不好画 are unreviewed renderings of uneven and hard to draw.
- 你当时都还没有选定 compares two recorded non-decisions only; it must not imply an uninterrupted state between the records or present uncertainty.
- 也换了一个开头 is neutral conjunction: the mixed emotions are scoped to writing, with no causal link to the replacement or sketch.
- The final question offers source-specific choices and an option not to choose, but present availability and interest remain unverified premises.

## MONTHLY / zh-Hant — UNVERIFIED

窗戶速寫和小說開頭，出現在這個月不同週的記錄裡。你喜歡速寫中不太規整的線條，倒影卻不好畫；回到那張速寫時，你加上了窗臺上的杯子，仍然喜歡那些線條。

寫小說時，你既興奮又煩躁，也換了一個開頭。後來的一則記錄寫到，你把兩個開頭讀給朋友聽。她喜歡第二版，而在提到選擇的那兩則記錄裡，你當時都還沒有選定。

如果你願意回看，想先看看窗臺上的杯子，還是讀讀那兩個開頭？也可以暫時不作選擇。

Specific unresolved concerns:

- The Simplified and Traditional story sources require meaning review, not only character conversion.
- 不同週的記錄 refers to record coverage; distinct records alone do not prove recurring real-world behavior or activity chronology.
- 窗臺上的杯子 is sourced from cup on the sill. Neither its color nor ownership is specified.
- 當時都還沒有選定 compares two source-time non-decisions; it cannot establish continuous or current uncertainty.
- 她 refers to the source's friend and must not imply a romantic relationship or the user's preference. 興奮/煩躁 remain mixed feelings about writing.
- The final optional question's assumptions about interest and present availability have not been independently checked.

## Reproduce

Run **node experiments/semantic-evidence/render-examples.mjs** from the repository root. This only renders the six developer-authored JSON drafts and lengths. It does not generate, validate, approve, publish, or persist a native reflection. See [evaluation](SEMANTIC_EVIDENCE_EVALUATION.md) for the identical-evidence baseline results and the separate blind-review plan.
