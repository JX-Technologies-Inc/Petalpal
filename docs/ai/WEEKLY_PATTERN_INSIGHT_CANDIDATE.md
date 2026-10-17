# Weekly pattern-insight candidate (2026-10-17)

Status: **OFFLINE TESTED · DEFAULT OFF · LIVE QUALITY UNPROVEN · NOT FOR PRODUCTION.**
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

## Live A/B plan (needs separate owner approval; not run)

- **Variants:** the configuration accepted in the final 8-call acceptance (baseline) vs.
  this candidate.
- **Weeks:** realistic M, N, O, P plus stress B (quiet positive moment), D (negation and
  corrections) and L (open decision), × `en` and `zh-Hans` = 14 weeks × 2 variants =
  **28 Sonnet calls**. Q abstains and is not sent.
- **Cost:** reservation 28 × US$0.04096 ≈ **US$1.15** cap. Recorded actual use was about
  US$0.006 per call, so the expected spend is about US$0.20. No retries; one-time ledger.
- **Environment:** isolated disposable PostgreSQL with synthetic owners on the owner's
  machine, same pattern as the final acceptance runner. No hosted TEST or production data.
- **Review:** blind pairwise review using `experiments/weekly-editorial-quality-v1/RUBRIC.md`,
  plus a line-by-line check for the "Passes" categories above.
- **Adopt only if:** zero validator failures, zero speculative, diagnostic or advice
  sentences, and the candidate wins most pairs in **both** languages. Otherwise keep
  the baseline.
- Monthly is out of scope; it needs its own plan and Opus budget.
