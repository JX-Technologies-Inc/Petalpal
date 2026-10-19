# Weekly pattern-insight candidate (2026-10-17)

Status: **LIVE A/B COMPLETE (2026-10-17) · NOT ADOPTED · DEFAULT OFF · keep the baseline narrative-thread prompt.**
Flag: `AI_WEEKLY_REFLECTION_PATTERN_INSIGHT=true` (requires `weekly-reflection-v2`;
mutually exclusive with `AI_WEEKLY_REFLECTION_NARRATIVE_THREAD` and
`AI_WEEKLY_REFLECTION_RETROSPECTIVE`). Source: `lib/weekly-editorial.js`.

## Origin and scope

The owner proposed a "zero-hallucination, deep-insight, no-inventory" Weekly/Monthly
prompt with eight fixed analysis dimensions and seven fixed sections. It was **not**
adopted as written, because:

1. Several requirements are speculation by design: unstated thoughts, hidden worries,
   things the user "hasn't noticed", latent risks, personality patterns.
2. Fixed sections push sparse weeks into padding or a run of "no evidence" lines.
3. Risk, diagnosis and advice language conflicts with the companion (non-clinical)
   positioning and emotional-safety policy.
4. A free-form long report would drop the per-sentence `refs` contract that the
   validator relies on, and would replace a prompt that passed the final 8-call live
   acceptance and 4/4 blind review (PR #62).

What was kept, as a replacement for the v2 **composition paragraph only** (introduction,
evidence safeguards and the JSON/ref/quotation contract stay byte-identical):

- a reflection, not a record: no weekday walk-through, no per-entry summary, and
  one-word entries can be left out;
- organize around what the user's own words show recurring or shifting (a repeated
  feeling, a returning concern, a change in description, a moment marked as mattering);
- hard, mixed or low weeks kept as written, at the stated intensity, with no softening,
  reassurance or encouragement; say less when little supports a pattern;
- an explicit exclusion of unstated thoughts, worries, motives, traits, risks, diagnoses,
  growth and advice.

Size: +258 serialized bytes over the base paragraph (narrative thread: +291), inside the
builder's 512-byte allowance, so selection, trimming and Gateway admission are unchanged.

## Offline evidence ($0)

| Test | Result |
|---|---|
| `test/back/weekly-realistic-weeks.test.js`: realistic weeks M-Q (`experiments/weekly-selective-reflection-v1/realistic.mjs`) | 4/4: every meaningful moment reaches the writer in en and zh-Hans with selectors v1, v2 and significance; a single-Event week abstains; short, sarcastic and code-switched entries arrive verbatim. Small weeks also deliver filler, so ignoring it is the prompt's job. |
| `test/back/weekly-pattern-insight.test.js` | 4/4: OFF is byte-identical; ON replaces only the composition paragraph; invalid or ambiguous flags fail closed; all A-Q weeks fit admission in both languages. |
| `test/back/weekly-insight-validator-probes.test.js` | 2/2: what the validator stops vs. what it cannot detect (below). |
| Existing Weekly suites (editorial, Sonnet, selective stress, narrative thread, significance, reflection-v2) | 252/252 together with the above, unchanged. |

### What the code can and cannot stop

| Output | Validator |
|---|---|
| Invented counts ("you logged 5 moods"), fake quotations, Markdown headings, a single cited Event | **Rejected** |
| Speculation ("you habitually doubt yourself, deep down afraid of rejection") | **Passes** |
| Diagnosis-like risk ("suggests a risk of depression") | **Passes** |
| Advice ("next week, keep a regular routine") | **Passes** |
| Chinese numbered section titles without digits ("一、周期整体状态总览") | **Passes** |

Only the prompt's exclusions and human editorial review stop the second group. No prompt
can guarantee zero hallucination; the guarantee is validator + prompt + blind review +
in-app output reporting.

## Live A/B (prepared offline; needs separate owner approval; not run)

Runner: `scripts/weekly-pattern-insight-ab-evaluation.mjs` on the eval-only branch
`eval/weekly-pattern-insight-ab` (commit `0cf47fcf`; never merge to `main`, because the
runner asserts its branch). It is derived from the final 8-call acceptance runner, and
only the plan differs.

- **Arms:** baseline = narrative-thread prompt (the configuration accepted in the final
  acceptance); candidate = this prompt. Both use Selector V2 with significance OFF and
  byte-identical evidence packets; only the system prompt differs.
- **Weeks:** stress B, D, L and realistic M, N, O, P, × `en` and `zh-Hans` = 14 weeks ×
  2 arms = **28 Sonnet calls**. Q abstains and is not sent.
- **Cost:** reservation cap 28 × US$0.04096 = **US$1.14688**. Recorded actual use was
  about US$0.006 per call, so the expected spend is about US$0.20. No retries, no repairs;
  one-time ledger.
- **Offline evidence:** `check` mode PASS (28 cells, max request 3,694 bytes, 0 provider
  calls); runner tests 6/6 with injected sends (blind labels, private mapping, consumed
  ledger, rejection without retry, stop on HTTP/transport failure, no secret leakage).
- **Live run (owner's Mac, separate approval):** check out the eval branch clean, then run
  `node scripts/weekly-pattern-insight-ab-evaluation.mjs live` under `env -i` with
  `NODE_ENV=test` and the `PETALPAL_PATTERN_INSIGHT_AB_*` variables (approval phrase
  `APPROVE-28-WEEKLY-PATTERN-INSIGHT-AB-2773ACED-EN-ZH-USD-1.14688`, commit, budget
  `1.14688`, Gateway and scope attestations). Credentials are entered at hidden prompts;
  integration Gateway `petalpal-integration` only.
- **Review:** blind pairwise review of `review/prose` per week using
  `experiments/weekly-editorial-quality-v1/RUBRIC.md`, plus a line-by-line check for the
  "Passes" categories above. Open `operator/mapping.json` only after scoring.
- **Adopt only if:** zero validator failures, zero speculative, diagnostic or advice
  sentences, and the candidate wins most pairs in **both** languages. Otherwise keep
  the baseline.
- Monthly is out of scope; it needs its own plan and Opus budget.

## Live A/B result — 2026-10-17

Run on the owner's Mac from `eval/weekly-pattern-insight-ab` (`0cf47fcf`), with
integration credentials entered at hidden prompts. Ledger outcome: **COMPLETE**,
dispatched 28, attempts 28, validated 26, rejected 2, no retries; reservation
US$1.14688 (the cap), estimated actual use **US$0.1443** at configured rates (average
1,416 input and 232 output tokens; slowest call 5.6 s). Private artifacts:
`.git/petalpal-acceptance/weekly-pattern-insight-ab-2773aced*` in that checkout.

| | Baseline (narrative thread) | Candidate (pattern insight) |
|---|---|---|
| Validator rejections | 0 | **2** (en B and L: `REFLECTION_V2_SCHEMA_MAX_ITEMS`) |
| Blind pairwise wins, 12 comparable weeks | **8** | 4 |
| en (5 comparable) | 4 | 1 |
| zh-Hans (7) | 4 | 3 |
| Speculation, diagnosis or advice sentences | none seen | none seen |

The blind review was done by Claude before opening `operator/mapping.json`. Claude also
wrote the candidate, so the owner should re-review `review/prose` before treating this
as final.

Observations:

- The candidate's synthesis helped when the text supported it: "two things turned out
  differently" (D en), the mother's call as the week's thread (M zh), joy and worry side
  by side (O zh).
- Its losses came from voice and framing. It referred to "the user" or 「用户」 instead
  of "you" (N en/zh, O en), invented a gender ("herself", P en), added commentary about
  missing information (L zh), and twice exceeded the output schema.
- The baseline also lists weekdays at times (B), slips into "the user" (L en, P en), and
  once misattributed the speaker as 「我」 (D zh, baseline B).

**Decision:** not adopted; the flag stays OFF and the baseline stays. Possible follow-up
for both prompts, each needing its own evaluation: always address the reader as
"you"/「你」, never comment on what the records do not say, and add no gendered
pronouns that the text does not give.

**2026-10-19:** these three fixes were applied to the narrative-thread composition
paragraph only (`lib/weekly-editorial.js`, still default OFF; the paragraph now adds
329 serialized bytes, inside the 512-byte allowance). Pattern insight is unchanged.
Live quality is unproven until the multi-Event A/B against the default configuration.

## Default vs selective live A/B — 2026-10-19

Runner `scripts/weekly-default-vs-selective-ab-evaluation.mjs` on eval-only branch
`eval/weekly-default-vs-selective-ab` (`f2738ac1`, revision `66732a53`), owner-run with
integration credentials at hidden prompts. Arms: **default** (Selector V1, base
weekly-reflection-v2 prompt, no flags) vs **selective** (`AI_WEEKLY_EVIDENCE_SELECTOR_V2`,
`AI_WEEKLY_EVIDENCE_SIGNIFICANCE`, `AI_WEEKLY_REFLECTION_NARRATIVE_THREAD` with the voice
fixes). Weeks: busy stress A, B, F, J, K, L (en, zh-Hans) and native-Chinese R-U
(`experiments/weekly-selective-reflection-v1/zh-native.mjs`, written by Opus, important
Events agreed blind by Haiku). Ledger COMPLETE: 32 dispatched, 25 validated, 7 rejected,
no retries; reservation US$1.31072 (cap), estimated use **US$0.1766**.

| | Default | Selective |
|---|---|---|
| Important Events delivered to the writer (offline) | 10/32 | 32/32 |
| Important Events cited in validated output | 8/32 | 27/32 (every validated output cited all of its week's) |
| Validator rejections (all `REFLECTION_V2_SCHEMA_MAX_ITEMS`) | 4 (A en/zh, L en/zh: 5-8 refs in one sentence) | 3 (B en: 6 refs; S, T zh: 4 paragraphs) |
| Blind pairwise wins, 9 comparable weeks (Opus reviewer, mapping opened after) | 0 | **9** |
| Reviewer-noted fidelity slips | record commentary ("记录里说", "in the record"), added mood words | one invented cause (F en), minor framing |

**Finding:** selection, not prose, was the main gap: default writers mostly saw routine
entries and produced weekday lists. **Open blocker for any rollout:** `maxItems` bounds
(3 paragraphs, 8 sentences, 4 refs) are local-only and not stated in the prompt, so busy
weeks are rejected in both arms (22%), leaving the owner without a report. Next: state those
limits in the shared final stage, test offline, then a separately approved live check.

**Limits fix (2026-10-19, branch `fix/weekly-limits-in-prompt`, live check pending):** the
shared final Weekly stage now says "Max 3 paragraphs, 8 sentences each, 4 refs per sentence."
It applies to the default prompt and every Weekly candidate. To keep the packet allowance
unchanged (the weekly prompt may not exceed the frozen `ab523996` size), three phrases were
shortened: "in the requested locale (en or zh-Hans)", "Copy numbers, dates and times exactly",
and "No headings, lists or citation aliases in prose". Net size: 1,460 bytes, equal to the bound.
A test now pins the stated limits to the schema's `maxItems`. Monthly is unchanged.
