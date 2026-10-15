# Reflection v2 editorial standards — 2026-10-15

**PROMPT IMPROVED · OFFLINE TESTED · REAL PROVIDER REVALIDATION PENDING · HUMAN EDITORIAL ACCEPTANCE PENDING · PRODUCTION DEFAULT OFF**

Scope: instruction strings in `lib/reflection-v2.js`, focused tests and documentation. Zero inference calls. No production data, database changes, deployment, ledger edits, push or PR. Tests use authored data and disposable in-memory PGlite with injected provider responses.

## Design choice

The earlier prompt already protected many facts, but its target lengths encouraged elaboration; chronological input encouraged a calendar inventory; "warm writer" guidance did not explain where warmth should come from. Keeping everything "open" could imply that an earlier worry remained current. Cross-event object identity and the impulse to explain absent information needed clearer boundaries. The live Chinese sample exposes these risks but does not establish their frequency.

Three approaches were considered: evidence-led personal prose offers specificity with firm factual boundaries; minimal guidance offers freedom but leaves ambiguous relationships and negation underspecified; a grounding-plus-literary-editing approach can improve rhythm but invites manufactured significance. The selected evidence-led approach adds only compact native-language and rhythm guidance. Its expected benefits are factual fidelity, comfort, specificity and structural variety with low instruction overhead and the same JSON contract. These are design expectations, not measured model improvements.

Warmth comes from remembering the cup by the window or the login test. An ordinary afternoon may stay ordinary; enjoyment may simply be enjoyment. Do not assign hidden feelings, advice, recovery or closure. Preserve the actor, negation scope, stated quantity, uncertainty and outcome. Describe an unresolved matter at its recorded time without assuming it persists today. Separate drawings and unnamed friends remain separate unless the text links them. Juxtaposition must not imply cause or identity.

Weekly focuses on a few moments in one to three paragraphs. Monthly has room for more detail across weeks without a prescribed chronology or emotional journey. Coverage belongs in the sentence citations; week labels need not appear in the prose. Removing target lengths does not relax any sentence, paragraph, narrative or evidence limit.

## Native-language standards

| Locale | Editorial standard |
|---|---|
| `en` | Plain contemporary verbs, contractions when natural, varied sentence lengths. Avoid ceremonious reflection openings, psychological interpretation and repeated "you wrote" attribution. |
| `zh-Hans` | Everyday Mandarin in Simplified characters; natural clause order and pauses. Prefer direct phrasing such as 登录页面 and 第二天的演示 when it fits the source; avoid translated English scaffolding and decorative abstractions. |
| `zh-Hant` | Compose idiomatic Traditional Chinese; vocabulary and cadence matter beyond characters. 登入畫面、隔天的 demo、看書 are possible choices, not mandatory substitutions. Follow regional wording evident in the person's text; otherwise use broadly understood written Mandarin, without inventing a Taiwan/Hong Kong identity or adding slang. |

Names and natural code-switching stay recognizable. `report-locale.js` collapses regional variants into `zh-Hant`; the packet cannot guarantee a regional preference absent from the evidence. The examples below use one plausible register, not a universal Traditional Chinese voice. None is injected into the production prompt.

## Before/after reference examples

Before: historical authored test doubles at `d80ab522`, **NOT CLAUDE**. After: **HUMAN-AUTHORED / NOT CLAUDE** is the requested label for editorial reference prose; these alternatives were prepared offline by Codex and have **not** received human editorial acceptance. They illustrate direction, not observed provider improvement.

Same source: `mixed-work` Event 1 explicitly says the bug was fixed, the login screen tested twice, and the next day's demo still worried the person. The shorter alternatives retain those details without explaining an emotional meaning.

| Locale | Before: historical test double | After: offline editorial reference |
|---|---|---|
| en | The fix was done; the worry had not gone anywhere. | You finally fixed the bug and tested the login screen twice, though you were still worried about the next day's demo. |
| zh-Hans | 问题解决了，心里的那件事却没有跟着放下。 | bug 终于修好了，登录页面也测了两遍，不过你还是担心第二天的演示。 |
| zh-Hant | 問題解決了，心裡掛著的那件事卻沒有一起放下。 | bug 終於修好了，登入畫面也測了兩次，不過你還是擔心隔天的 demo。 |

Monthly before: the historical test double ends with "Across these weeks, finished and unfinished things sat side by side" and an abstract summation. Monthly after: the new reference places the cup sketch and the walk in one paragraph with separate citations, the bug/demo in another, and quiet reading with the next-project uncertainty in the last. It spans four weeks without asserting that the sketches are identical or adding a concluding lesson. Complete three-locale reference prose and exact sentence citations are in `test/back/reflection-v2.test.js`.

Actual Claude origin is limited to the preserved [historical live Weekly narrative](REFLECTION_V2.md#real-claude-zh-hans-weekly-v2-acceptance--2026-10-15). Its "这份低落在文字里没有被解释，也没有被收起来" adds artificial interpretation; "这几段记录里没有写" narrates missing information. "这幅画" may join separate objects. The revision addresses those patterns generally; it does not rewrite that output or claim a new live result. Object identity still needs checking against the exact cited Events.

## Compact review rubric

Score each dimension 0 (reject), 1 (revise), or 2 (acceptable for human review). **Any material unsupported claim is an automatic editorial failure, regardless of fluency or total score.** Human acceptance requires approval of all dimensions; a test pass supplies no editorial score.

| Dimension | What the reviewer checks |
|---|---|
| Factual accuracy | Every meaningful clause follows from its cited Events: actor, negation/litotes, quantity, time, object identity, relationship, cause, uncertainty and outcome. A valid alias alone proves none of these. |
| Native naturalness | Reads as directly composed in the locale; idiomatic vocabulary, syntax, rhythm and code-switching; no automatic Simplified-to-Traditional assumptions. |
| Emotional comfort | Feelings stay at the expressed intensity and time; no diagnosis, intrusive interpretation, unsolicited reassurance or compulsory uplift. |
| Personal specificity | Concrete source details make the prose recognizable; no generic insight that could fit any person. |
| Variation | Structure follows the material across outputs; no weekday inventory, repeated attribution, fixed opening or mandatory conclusion. |

## Offline evaluation and limits

The historical `experiments/prompt-first-reflection/` directory is absent from the verified source. Its `mixed-work` and `negation` Events are preserved verbatim in the existing v2 tests and reused here. Localized drawing Events come verbatim from the existing Weekly tests. Historical `AUTHORED` test doubles and all live evidence remain unchanged; the older doubles are not editorial acceptance targets.

| Coverage | Evidence and offline finding |
|---|---|
| English / Simplified / Traditional input | Existing localized drawing pairs: exact-source quotations retain script and provenance; this does not evaluate generated native prose. |
| Mixed-language entries and mixed feelings | `mixed-work`: six new Weekly/Monthly reference outputs retain locale-specific joining and exact per-sentence source IDs. Accomplishment and worry coexist without invented resolution. |
| Ordinary, quiet and happy moments | Quiet drawing, happy meeting with 小林, and enjoyable reading remain concrete. Quiet reading and the visit coexist with explicitly unresolved matters; wholly happy/uneventful periods are not separately represented. |
| Sadness, uncertainty, negation/litotes | The original 12-case matrix still passes structurally. Twelve deliberately false paraphrases also pass, demonstrating the semantic gap. Neither result proves fidelity of future outputs. Isolated sadness remains represented only by the historical live narrative, not a new offline reference. |
| Ambiguous relationships / similar objects | Separate drawing Events do not identify a common sketch or a romantic partner. A deliberately merged sketch/partner sentence passes validation but must fail editorial review. |
| Multiple weeks / sparse evidence | New Monthly references cite all four weeks in nonchronological paragraph order. Three selected Events over two weeks can support one short paragraph covering both weeks. Below-minimum inputs still fail; six-week selection coverage remains in existing Monthly regressions. |

Command (no credentials inherited):

```sh
env -i PATH="$PATH" node --test test/back/reflection-v2.test.js test/back/sonnet-weekly.test.js test/back/opus-monthly.test.js
```

Result: **47 passed, 0 failed, 0 skipped** (8 v2, 16 Weekly, 23 Monthly), Node v24.7.0. After the final object-identity wording adjustment, all **8 v2 tests passed again**. New tests check rendering, evidence attribution, size admission and validator limitations. Existing regressions check default-off behavior, ownership, consent, source changes, mocked persistence, finalized reuse, budgets and no replay. No existing database or one-time ledger is accessed. Dependencies were installed from the local npm cache with `--offline --ignore-scripts`; no package/lockfile change.

Remaining risks: actual adherence to the new instructions, translation-like phrasing, Traditional regional fit, implicit cross-event links, speaker attribution, semantic negation, emotional intensity, repetitive output across periods, and Monthly latency/output bounds. The input is selected EventMemory evidence, not an unlimited record of the person's experience. Shorter prompts and authored examples cannot establish real-model quality.

## Minimum separately approved live evaluation

Before considering any cutover, approve a fresh synthetic evaluation at the exact editorial commit: the existing 12-case `negation`/`mixed-work` × Weekly/Monthly × three locales, using the unchanged Sonnet/Opus models. Specify a budget cap, isolated persistence and a fresh authorized harness; do not reuse or alter the one-time acceptance ledger. One call per case, no retry or repair. Capture tokens, latency, validation/persistence outcome and citations; native reviewers assess every sentence with the rubric before assigning human acceptance.

That 12-call matrix is a minimum regression check, not comprehensive acceptance. Supplement separately with pure-language wholly happy/uneventful periods, sadness, another person's feelings, ambiguous friends/separate drawings and sparse months; those gaps must remain explicit until reviewed. Variation requires comparing multiple outputs, and Opus behavior under the unchanged timeout remains unmeasured. Keep v2 default-off throughout; production approval and any future generation-version change are separate decisions.
