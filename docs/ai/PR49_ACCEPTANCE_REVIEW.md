# PR #49 independent synthetic acceptance review

Review baseline: `b99b85aa80891060f57c0ab49fcdcf8c8d084bb3`. Review work uses a new isolated worktree; existing worktrees and branches remain intact. No inference, deployment, provider/credential change, database connection or merge.

## Verdict

**Not accepted for companion-product launch.** A useful default-off grounding experiment, with three source-mapping defects narrowed in this review. Paragraph grammar membership is independently executable, but is only as sound as the lexical and scope rules from which its fragments are derived. Passing a grammar validator is not a universal semantic proof.

The fixes do not add expressive forms or increase acceptance. No privacy, ownership, consent, cost, Journal, BGE/pgvector, job, persistence, fallback or production-route change was needed. v1 and v2 production modules are unchanged. No paid retry, automatic fallback, finalized-report regeneration or ambiguous-attempt replay is introduced.

## Concrete grounding defects (distinct from product quality)

1. **Relationship ambiguity:** `I talked with a partner.` admitted `和一位伴侣聊天` / `和一位伴侶聊天`. English partner may be a business or project partner; a romantic relationship was not established. English partner action/plan/negation constructions now remain whole quotes. Chinese explicitly recorded 伴侣/伴侶 remains eligible.
2. **Negation and degree:** `I felt not a little happy.` admitted `感到不有点开心`. English “not a little” can mean “very”; Boolean negation plus LITTLE was not a valid cross-language equivalence. Negative LITTLE is now ineligible for native interpretation.
3. **Time and intention scope:** `Yesterday, I planned to rest.` admitted `planning to rest on 2026-09-15`. This can date the intended rest instead of the act of planning. Context-bearing plans now remain quotes; unqualified plans remain eligible. No new planning-time grammar was added.

All three use the existing whole-record quote path when another native episode and the coverage rules permit a report. Quote-only packages still abstain before inference; this is not a second-provider or v1 fallback. Regression tests exercise complete returned paragraphs in all three output locales, not just parser internals. Additional mutations cover polarity, both sides of mixed feelings, quantity, actor, date, causal appendices and presuppositional questions. Existing schema, source fences, consumption and provenance checks remain in force.

## Fresh evaluation method

`test/evaluation/review49-everyday.json` contains 24 newly authored synthetic Events in six bundles: work, study, relationships, emotions, daily life and code switching. These were written separately from the old development/example fixtures, before the review fixes, and were not rewritten to fit the grammar. No development fixture is imported by the new evaluator. This is a fresh same-assistant review set, **not a blind external evaluator, representative user sample or model-output benchmark**. The implementation was already visible to the reviewer; “independent” here means new evidence and a separate mock author, not independence of authorship or an unseen research holdout.

Each bundle supplies the identical first two Events to Weekly, and all four Events to Monthly on four different weeks. Each input is reused unchanged across v1/v2/v2.1 and en/zh-Hans/zh-Hant. Topic metadata is empty, as ordinary deterministic extraction need not supply themes. No synthetic topic labels are added to rescue Monthly eligibility. Source strings, owner scope, timestamps, aggregate counts and evidence are held constant; only requested locale/contract varies. Input immutability is asserted.

The new mock author selects proved forms without repair. v1 chooses the available verified cards; v2 varies its available quote forms and uses one optional closing; v2.1 uses supported episode prose and whole quotes. These are validated authored candidates, not sampled Sonnet/Opus responses. A failed candidate is reported, never retried to inflate success. Counts measure these cases only, not model accuracy or real-world prevalence. `referencedEvents` counts metadata references; v1 Monthly's overview references all four records but quotes only the early and late anchors, so it must not be read as four narrated experiences.

Reproduce without inference or a database:

```sh
NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test node test/evaluation/review49.mjs
```

Use the repository's isolated environment procedure; never load production environment files.

## Identical-evidence results after hardening

| Contract | Accepted candidates / 36 | Preflight abstention | Output validation rejection |
|---|---:|---:|---:|
| v1 | 32 | 4 | 0 |
| v2 | 36 | 0 | 0 |
| v2.1 | 24 | 12 | 0 |

v1's four preflight abstentions are Chinese Weekly work/emotion bundles whose second English sentence exceeds its localized sentence bound. v2 can quote all bundles; this is not native paraphrase coverage. v2.1 abstains on all six relationship and six code-switching report/locale combinations because neither bundle contains a safely native episode after the partner fix. **Only 4/24 sources (16.7%) have native v2.1 interpretations; 20/24 (83.3%) remain ineligible.** Before the fix the ambiguous partner sentence was a fifth eligible source; losing that coverage is intentional. These percentages describe this small constructed set only.

Every accepted v2.1 Weekly consists of one native record plus one whole quote; every accepted Monthly consists of one native record plus three whole quotes. Chinese v2.1 outputs are 39–73 graphemes Weekly and 127–139 Monthly, below the requested 100–180 / 250–350 targets. No padding is added. Calendar-week coverage is preserved, but coverage does not itself create a supported pattern or change. No recurrence or trajectory is invented from this corpus.

## Product dimensions, scored separately from grounding

| Dimension | v1 | v2 | v2.1 |
|---|---|---|---|
| Naturalness | Readable but long, procedural and defensive | Shorter; assembled quotations remain obvious | Simple episode wording is smoother in English; long quote stretches remain; Chinese `写到了读17页` is awkward |
| Warmth | Generic reassurance repeated across users | Optional, generic invitation | No closing eligible in these ordinary domains: its detail-bound closing currently requires named charcoal drawing |
| Repetition | Same count opening and cautionary ending | Several attribution variants, same closing | Only one whole-quote wrapper per locale; Monthly repeats it three times |
| Meaningfulness | Early/late moments and record statistics | Broad quotation coverage, little synthesis | Preserves mixed feelings only for its narrow source language; does not connect the complex ordinary Events here |
| Abstention | 4/36 preflight | 0/36, mostly quoting | 12/36 preflight; safe but significant usefulness loss |
| Factual grounding | Existing exact-sentence/card baseline; no new universal completeness claim | Existing finite-clause baseline; quotes are not proof of paraphrases | Three mapping defects fixed; no unsupported altered text accepted in the focused tests |

English is generally grammatical but sounds like record commentary. Simplified Chinese becomes clipped when action fragments follow 写到了; Traditional Chinese framing is readable but has the same structural limitations. Original English and opposite-script Chinese remain visible inside exact quotations. This preserves source meaning and avoids silent rewriting, but does not deliver a fully localized reflection. Clause-level code switching, ordinary explanations, half-completed actions, indirect speech, relationship uncertainty and nuanced ambivalence are overwhelmingly quote-only. A finite grammar's superficial variety does not establish emotional sensitivity.

## Remaining boundary and acceptance gates

- Arbitrary paraphrases, inferred motives/causes, diagnoses, psychological change, habit claims, positive trajectories and implicit factual premises in questions remain unverifiable and forbidden. Citation, keyword overlap, self-assessment and a second model do not prove them.
- The existing dictionary is a reviewed proposal, not a multilingual entailment oracle. Native-speaker adversarial review of every allowed equivalence and scope is still needed; subjective-emotion lexical nuance (for example frustrated/沮丧) deserves explicit sign-off, not a claim of exact psychological equivalence.
- Mixed-language summaries with clauses outside the finite productions remain verbatim, and quote length/delimiter bounds can make them unusable. Long evidence can force abstention. This review does not alter source extraction, source Events or historic reports.
- Smallest next product step: approve one domain and a precise typed semantic contract first (for example explicit completed versus incomplete study/work activity, with actor, quantity, time and qualification scope). Independently review positive/negative cross-locale pairs and a new externally authored acceptance corpus, then evaluate whole paragraphs blind for warmth/usefulness. Do not add synonymous wrappers or remove safeguards just to improve the above count. This is a recommendation, not implemented grammar expansion.
- Provider compliance, useful output yield, latency and real language quality are unmeasured. Any future bounded inference evaluation and activation need separate authorization; neither is necessary for keeping this draft reviewable.

## CI and merge dependency

The existing manual security workflow was dispatched on the unmodified requested branch head. [Run 38494203122](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38494203122) checked out `b99b85aa80891060f57c0ab49fcdcf8c8d084bb3` in both jobs (verified from `git log -1 --format=%H` in hosted checkout logs). Expo passed. Security failed: all 32 Monthly tests passed, but the combined file was cancelled at the unchanged 90-second child-process limit. This is a CI execution defect, not evidence that the full baseline passed.

The runner now schedules the unchanged v1, v2 and v2.1 Weekly/Monthly matrices in disjoint processes; the 90-second bound and every test remain. Intermediate [run 38494932309](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38494932309) at `8aad6b42c42b0fecf340955dfe71a01e0e515d99` passed both jobs, but hosted logs exposed duplicate execution: the negative-lookahead base selector matched a Node parent container and therefore also selected native descendants (32/25 instead of 22/15 base tests). Positive base-title prefixes now exclude parent containers. CI-contract assertions cover both exact-once title selection and exclusion of empty/file/root containers; final hosted counts must confirm 22+5+5 Monthly and 15+5+5 Weekly. The intermediate pass is not claimed as validation of disjoint execution. Local execution of the corrected selectors passed exactly 22 Monthly and 15 Weekly tests. No workflow file, dependency or deployment setting changed. Local focused proof/CI checks passed 37/37; both v2.1 integration groups passed 5/5 each. The amended CI-contract suite passed 6/6 again. Final exact-head hosted results are recorded on PR #49 after push, so a documentation-only commit need not invalidate that tested SHA.

PR #48 is Draft, head `da67c2ca619fd3bb6f163435f07d3ff3f49df765`, based on main `ba867045c0c044a25b04e99dee93c53f10351506`. PR #49 is Draft and directly stacked on #48's branch `feat/native-reflection-v2`. **Review and approve #48 first, merge #48 only when authorized, then retarget/reconcile #49 onto the resulting main, inspect the residual diff and rerun exact-head security CI before reviewing/merging #49.** A squash/rebase merge of #48 may require restacking only #49's commits; a merge commit may allow a simple retarget. Do not merge #49 into #48's branch as a shortcut. No merge, retarget or existing-branch rewrite was performed in this review. Both remain Draft and activation remains separately blocked by product acceptance.

## Six representative comparisons (same evidence for all versions)

All strings below are actual validated mock results. They are not live Claude outputs.

### work — WEEKLY / en

**v1**

You recorded 2 Events this week. Looking back, you wrote: “I felt frustrated.” In another entry: “The meeting ran over, but I did not promise to finish tonight.” These are moments you chose to record, rather than a complete picture of your week. You can reflect on their meaning at your own pace, without treating how much you recorded as a judgment about your life.

**v2**

In one entry, you described feeling frustrated.

One entry says: “The meeting ran over, but I did not promise to finish tonight.”

If you wish, you can leave their meaning open for now.

**v2.1**

You wrote about feeling frustrated.

One entry reads: “The meeting ran over, but I did not promise to finish tonight.”

### study — WEEKLY / zh-Hans

**v1**

这周，你留下了2条记录。回看其中的片段，你写到：“I read 17 pages.”也记录了：“我复习了两章，但练习题只做对一半。”这些片段来自你当时选择留下的内容，并不代表这一周的全部。你可以按自己的节奏回顾，不急着把记录的多少当作生活好坏的判断。

**v2**

你写下过：“I read 17 pages.”

有一条记录写着：“我复习了两章，但练习题只做对一半。”

如果愿意，你可以暂时把这些片段的意义留白。

**v2.1**

这周，你写到了读17页。

有一条记录写着：“我复习了两章，但练习题只做对一半。”

### emotions — WEEKLY / zh-Hant

**v1**

Abstained: REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE

**v2**

你寫下過：「我感到平静。」

有一條記錄寫著：「I was proud of submitting it and anxious about the response.」

如果願意，你可以暫時把這些片段的意義留白。

**v2.1**

這週，你寫到了感到平靜。

有一則記錄寫著：「I was proud of submitting it and anxious about the response.」

### study — MONTHLY / en

**v1**

You recorded 4 Events this month. This reflection selects 4 moments across all 4 calendar weeks with eligible memories. These entries offer points of reference, rather than a complete account of your month. In an earlier represented week, you wrote: “I read 17 pages.” In a later represented week: “今天只讀了半小時，還是沒弄懂那個證明。” Read together, these are two moments from different parts of the recorded month, without assuming one explains the other. These recorded moments leave space for your own perspective. They do not explain the whole month or tell you how its experiences should feel.

**v2**

You wrote: “I read 17 pages.”

One entry says: “我复习了两章，但练习题只做对一半。” In your own words: “I understood the example after class, not during the exam.” On 2026-09-27, you wrote: “今天只讀了半小時，還是沒弄懂那個證明。”

If you wish, you can leave their meaning open for now.

**v2.1**

You wrote about reading 17 pages.

One entry reads: “我复习了两章，但练习题只做对一半。” One entry reads: “I understood the example after class, not during the exam.” One entry reads: “今天只讀了半小時，還是沒弄懂那個證明。”

### daily-life — MONTHLY / zh-Hans

**v1**

回看这个月，你留下了4条事件记录。这次回顾从其中选取4个片段，覆盖有可用事件记忆的全部4个自然周；这些片段分布在月内不同的周，提供了回看的几个落点，并不代表整个月的全部经历。在所选片段中较早的一周，你写到：“I cooked dinner.”到了较晚的一周，你留下了：“我幫鄰居搬了兩箱書，剩下的三箱是她自己搬的。”把它们放在一起，可以回看月内不同时间留下的具体片段，但不据此认定两件事之间有因果，也不把先后顺序当作情绪变化。回顾可以先停在这些具体记录上：它们保留了不同时刻的表达，也留下了未被记录的空白。这些片段对你意味着什么，仍可以由你自己慢慢理解，不必急着把整个月归成一个结论。

**v2**

你写下过：“I cooked dinner.”

有一条记录写着：“下雨没去散步，在家把衣服叠好了。”回到你当时的话：“I slept badly, though I cannot tell whether the coffee mattered.”在2026-09-27的记录里，你写到：“我幫鄰居搬了兩箱書，剩下的三箱是她自己搬的。”

如果愿意，你可以暂时把这些片段的意义留白。

**v2.1**

这个月，你写到了做晚饭，感到感激。

有一条记录写着：“下雨没去散步，在家把衣服叠好了。”有一条记录写着：“I slept badly, though I cannot tell whether the coffee mattered.”有一条记录写着：“我幫鄰居搬了兩箱書，剩下的三箱是她自己搬的。”

### work — MONTHLY / zh-Hant

**v1**

回看這個月，你留下了4條事件記錄。這次回顧從其中選取4個片段，涵蓋有可用事件記憶的全部4個自然週；這些片段分布在月內不同的週，提供了回看的幾個落點，並不代表整個月的全部經歷。在所選片段中較早的一週，你寫到：「I felt frustrated.」到了較晚的一週，你留下了：「同事接手了簡報；我鬆了口氣，也擔心交接漏了細節。」把它們放在一起，可以回看月內不同時間留下的具體片段，但不據此認定兩件事之間有因果，也不把先後順序當作情緒變化。回顧可以先停在這些具體記錄上：它們保留了不同時刻的表達，也留下了未被記錄的空白。這些片段對你意味著什麼，仍可以由你自己慢慢理解，不必急著把整個月歸成一個結論。

**v2**

你寫下過：「I felt frustrated.」

有一條記錄寫著：「The meeting ran over, but I did not promise to finish tonight.」回到你當時的話：「客户没有批准方案，我只是把问题整理给团队。」在2026-09-27的記錄裡，你寫到：「同事接手了簡報；我鬆了口氣，也擔心交接漏了細節。」

如果願意，你可以暫時把這些片段的意義留白。

**v2.1**

這個月，你寫到了感到沮喪。

有一則記錄寫著：「The meeting ran over, but I did not promise to finish tonight.」有一則記錄寫著：「客户没有批准方案，我只是把问题整理给团队。」有一則記錄寫著：「同事接手了簡報；我鬆了口氣，也擔心交接漏了細節。」
