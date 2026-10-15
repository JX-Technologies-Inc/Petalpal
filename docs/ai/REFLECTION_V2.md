# Opt-in Prompt-First reflection v2 — 2026-10-15

Status: **implemented offline, default off, not production-ready.** No paid inference has used this contract. Human editorial acceptance and a separately approved live evaluation are required before any cutover.

## Why v1 reads mechanically

- `weekly-reflection-v1`: Claude returns two refs plus exact quotes; the application wraps them in one fixed template ("You recorded N Events… Looking back… at your own pace…"). Chinese quotes must be ≤36 UTF-16 characters, so English or long sentences are excluded and mixed-language weeks abstain.
- `monthly-reflection-v1`: Claude only selects fact-card IDs; every sentence, count and disclaimer is application text.

Claude's writing ability is therefore unused. Prompt changes alone cannot fix this.

## v2 contract

Opt-in per report type: `AI_WEEKLY_REFLECTION_CONTRACT=weekly-reflection-v2`, `AI_MONTHLY_REFLECTION_CONTRACT=monthly-reflection-v2`. Unset keeps v1; any other value fails closed with `AI_GATEWAY_CONFIG_INVALID` before retrieval or dispatch.

- Input packet (`lib/reflection-v2.js`): version, report type, locale and chronological Event evidence `{ ref, day, week|scope, text, topics?, clipped? }`. No owner, Event/memory IDs, counts or timestamps. Evidence remains untrusted data.
- Output: `{ version, locale, paragraphs: [{ sentences: [{ text, refs }] }] }`. Claude writes every visible sentence in the requested locale; the application only joins sentences (space for `en`, none for Chinese) and paragraphs.
- Saved sections: one per paragraph, `contractVersion` v2, cited `evidenceRefs`, `aggregateRefs: []` and per-sentence `claims[{ text, evidenceRefs }]`. Counts and topics stay in the existing UI statistics.
- Unchanged: models, `grounded-narrative-v1` job/idempotency identity, evidence selection and limits, English BGE/pgvector, Chinese bounded selection, consent/lease/source fences, atomic persistence, no-replay cost ledger, timeouts, max output tokens and Gateway byte admission. Finalized reports, including v1 reports, are reused and never regenerated.
- When Event text exceeds the existing Gateway byte admission, whole optional Events are dropped from the packet (longest first), keeping two Weekly Events or every Monthly week; text is never truncated. Dropped Events stay selected provenance.

## What validation proves — and does not

Deterministic, fail-closed checks: project schema; version/locale echo; every sentence cites 1–4 supplied aliases; Weekly cites ≥2 Events; Monthly cites every represented week and cites last month only alongside this month; no alias text, URLs, list markers or control characters; every digit sequence (NFKC) appears in the cited Event text; every quotation is an exact clause-aligned copy from a cited Event and not from a clipped fragment; existing section/narrative length bounds.

Not proven: that a paraphrase preserves negation, litotes, speaker, relationship, chronology, cause, uncertainty or feeling; spelled-out numbers (English words, Chinese numerals); invented times of day, durations or weekdays; locale script/register (Simplified vs Traditional); boilerplate or repetition. Valid JSON and citations are traceability, not factual correctness. These risks require human editorial review of real outputs.

## Same-evidence examples (Prompt-First `mixed-work` fixture)

A = actual v1 code rendering of an authored selection. C = authored offline test double from `test/back/reflection-v2.test.js`, **not Claude output**; it shows what the contract permits, not achieved quality.

| Case | A: v1 production source | C: authored v2 test double (NOT Claude) |
|---|---|---|
| Weekly en | You recorded 2 Events this week. Looking back, you wrote: “I finally fixed the bug today, but I'm still worried about tomorrow's demo.” In another entry: “今天画了窗边的杯子…” These are moments you chose to record, rather than a complete picture of your week. You can reflect on their meaning at your own pace… | You finally fixed the bug and tested the login screen twice, yet tomorrow's demo was still ahead of you and still on your mind. The fix was done; the worry had not gone anywhere. … In what you wrote, both stayed open: a demo that had not happened yet, and a sketch left halfway. |
| Weekly zh-Hans | Abstains (`REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE`) | 你终于修好了那个 bug，登录页面也测了两遍，可明天的演示还没到，担心也还在。… 这一周写下的两件事都还没有落定：演示还没发生，素描也停在了一半。 |
| Weekly zh-Hant | Abstains | 你終於修好了那個 bug，登入頁面也測了兩次，但明天的 demo 還沒到，擔心也還在。… 這週寫下的兩件事都還沒落定：demo 還沒發生，素描也停在一半。 |
| Monthly en | You recorded 4 Events this month. This reflection selects 4 moments across all 4 calendar weeks with eligible memories. … Read together, these are two moments from different parts of the recorded month, without assuming one explains the other. … | Early in the month you finally fixed the bug … On a weekend walk with your friend 小林, you talked about the unfinished sketch. … Across these weeks, finished and unfinished things sat side by side: a fix next to a worry, a sketch set down with no date to pick it up. |
| Monthly zh-Hans | Abstains | 月初，你终于修好了那个 bug…… 这个月写下的事里，有做成的，也有还悬着的：问题修好了，担心还在；素描停在一半，什么时候再画也还没定。 |
| Monthly zh-Hant | Abstains | 月初，你終於修好了那個 bug…… 這個月寫下的事，有完成的，也有還懸著的：問題修好了，擔心還在；素描停在一半，再畫的時間也還沒定。 |

Prompt-First v2 live outputs (Drafts #54/#55) are external historical evidence and are not in this repository; they were not reproduced here.

## Cost and latency

Reservations are unchanged: Weekly ≈ US$0.041 (8,192-byte input allowance, 2,048 output tokens), Monthly ≈ US$0.164. Estimated actual use per call (not measured): Weekly ≲ 3k input / 0.9k output tokens ≈ US$0.015; Monthly ≲ 5.5k / 1.5k ≈ US$0.052. Longer prose increases generation time; Opus Monthly against the unchanged 20 s timeout is unmeasured and is the main latency risk.

## Required before production

1. Owner-approved, budgeted live evaluation of the same 12-case matrix (`negation`, `mixed-work` × Weekly/Monthly × en/zh-Hans/zh-Hant), with no retries.
2. Independent human factual and editorial review of every output: negation/litotes, speaker, unresolved matters, temporal and emotional additions, fluency, translation-like phrasing, repetition, Traditional Chinese wording.
3. Measured latency, tokens and grounding-failure rate. Byte-based admission counts Chinese at ~3 bytes per character; any change to it is a separate budget decision.

## Isolated zh-Hans Weekly acceptance (prepared 2026-10-15, live call not run)

`scripts/zh-reflection-v2-weekly-acceptance.mjs` exercises `weekly-reflection-v2` with `claude-sonnet-5-5` through the production worker path on a fresh disposable PostgreSQL. Weekly only; Monthly/Opus is unconfigured.

- `offline` ($0, mocked Gateway; CI workflow `zh-reflection-v2-weekly-offline.yml` or `scripts/zh-reflection-v2-weekly-offline.sh`) covers:
  - the saved v2 report: zh-Hans, contract, model, cited owner-scoped evidence, owner-only reads, finalized reuse and no re-charge;
  - the single-report limits refusing a second report;
  - Monthly being refused;
  - consent denial;
  - deletion mid-flight;
  - ungrounded output with no repair and no replay;
  - cross-owner isolation.
- `live-weekly` makes exactly one real call. It needs a separate `APPROVE-1-ZH-WEEKLY-V2-SONNET-CALL` approval naming the exact verified commit and a cap ≤ US$0.05 (the full reservation is US$0.04096). Gates are listed in `SECURITY.md`. Output is synthetic and must still receive human editorial review; it is not production acceptance.
