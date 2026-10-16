import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { buildMonthlyReport, REPORT_EVIDENCE_LIMITS } from "../../lib/report-foundation.js";
import { reportSourceSnapshot } from "../../lib/report-write-fence.js";
import { monthlyPeriodFor } from "../../lib/ai-periods.js";
import { selectMonthlyEvidence, MONTHLY_EVIDENCE_POLICY } from "../../lib/monthly-evidence.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { buildWeeklyReflectionV2Packet, validateWeeklyReflectionV2, weeklyReflectionContract, WEEKLY_REFLECTION_CONTRACT } from "../../lib/sonnet-weekly.js";
import { buildMonthlyReflectionV2Packet, validateMonthlyReflectionV2, monthlyReflectionContract, MONTHLY_REFLECTION_CONTRACT } from "../../lib/opus-monthly.js";
import { CANDIDATE, MIXED_NEGATION, ORDINARY } from "../../scripts/reflection-v2-editorial-plan.mjs";

// Authored synthetic Events reused verbatim from the Prompt-First v2 acceptance
// matrix (Draft #51 experiments/prompt-first-reflection/fixtures.mjs). The
// reflections below are authored offline test doubles, NOT Claude output; passing
// these checks shows traceability, not factual or editorial quality.
const SCENARIOS = {
  "mixed-work": ["I finally fixed the bug today, but I'm still worried about tomorrow's demo. I tested the login screen twice; the demo has not happened yet.",
    "今天画了窗边的杯子，画到一半觉得有点烦，还是把没完成的素描放在桌上。没有继续画。",
    "週末和朋友小林散步，聊到那張未完成的素描。我很開心見到她，但沒有決定何時再畫。",
    "I spent Sunday reading at home. It was quiet and I enjoyed it. I still do not know how the next project will go."],
  negation: ["I was not a little happy about the result.", "我不是不想去，只是还没决定。", "I did not say I stopped drawing.", "我沒有覺得事情變好了。"]
};
const OWNER = "synthetic-owner";
function weeklyInput(locale, texts, days = ["15", "18"]) {
  const evidence = texts.map((summary, i) => ({ ownerId: OWNER, sourceEventId: `event-${i + 1}`, sourceMemoryId: `memory-${i + 1}`, summary, topics: [],
    eventDate: new Date(`2026-09-${days[i]}T12:00:00Z`), importanceScore: null, provenance: { sourceEventId: `event-${i + 1}`, sourceMemoryId: `memory-${i + 1}` } }));
  const period = { timezone: "UTC", periodKey: "2026-09-14", periodStartUtc: new Date("2026-09-14T00:00:00Z"), periodEndUtc: new Date("2026-09-21T00:00:00Z") };
  return { reportType: "WEEKLY", ownerId: OWNER, locale, period, aggregates: { ...period, ownerId: OWNER, eventCount: texts.length, topTopics: [] },
    evidenceSelection: { ownerId: OWNER, status: "READY", evidence }, sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [] } };
}
function source(id, date, summary, topics = []) {
  return { id, ownerId: OWNER, occurredAt: new Date(date), updatedAt: new Date("2026-10-01"), memoryProcessingAllowed: true,
    memory: { id: `memory-${id}`, ownerId: OWNER, sourceEventId: id, updatedAt: new Date("2026-10-01"), embeddingInputRevision: 1,
      memoryType: "EVENT", summary, topics, importanceScore: 0.8, embeddingStatus: "GENERATED", embeddedInputRevision: 1 } };
}
function monthlyInput(locale, texts, dates = ["02", "09", "16", "27"].map(day => `2026-09-${day}T12:00:00Z`), previous = []) {
  const identity = { userId: OWNER }, period = monthlyPeriodFor({ year: 2026, month: 9, timezone: "UTC" });
  const events = texts.map((text, i) => source(`event-${i + 1}`, dates[i], text));
  const previousEvents = previous.map((text, i) => source(`previous-${i + 1}`, "2026-08-20T12:00:00Z", text));
  const aggregates = buildMonthlyReport({ identity, ...period, year: 2026, month: 9, currentEvents: events, previousEvents, status: "COMPLETE" });
  return { reportType: "MONTHLY", ownerId: OWNER, locale, period, aggregates,
    evidenceSelection: selectMonthlyEvidence({ identity, period, events, previousEvents, limits: REPORT_EVIDENCE_LIMITS.MONTHLY }),
    sourceFence: { evidencePolicy: MONTHLY_EVIDENCE_POLICY, sources: reportSourceSnapshot([...events, ...previousEvents]) } };
}
const plan = (locale, type, paragraphs) => ({ version: REFLECTION_V2[type], locale,
  paragraphs: paragraphs.map(sentences => ({ sentences: sentences.map(([text, refs]) => ({ text, refs })) })) });

const AUTHORED = {
  WEEKLY: {
    "mixed-work": {
      en: [[["You finally fixed the bug and tested the login screen twice, yet tomorrow's demo was still ahead of you and still on your mind.", ["E1"]],
        ["The fix was done; the worry had not gone anywhere.", ["E1"]]],
      [["On Friday, drawing the cup by the window turned a little irritating halfway through.", ["E2"]],
        ["You left the unfinished sketch on the table and did not pick it up again.", ["E2"]],
        ["In what you wrote, both stayed open: a demo that had not happened yet, and a sketch left halfway.", ["E1", "E2"]]]],
      "zh-Hans": [[["你终于修好了那个 bug，登录页面也测了两遍，可明天的演示还没到，担心也还在。", ["E1"]],
        ["问题解决了，心里的那件事却没有跟着放下。", ["E1"]]],
      [["周五画窗边的杯子，画到一半有点烦。", ["E2"]], ["你还是把没画完的素描放在了桌上，没有再接着画。", ["E2"]],
        ["这一周写下的两件事都还没有落定：演示还没发生，素描也停在了一半。", ["E1", "E2"]]]],
      "zh-Hant": [[["你終於修好了那個 bug，登入頁面也測了兩次，但明天的 demo 還沒到，擔心也還在。", ["E1"]],
        ["問題解決了，心裡掛著的那件事卻沒有一起放下。", ["E1"]]],
      [["週五畫窗邊的杯子，畫到一半覺得有點煩。", ["E2"]], ["你還是把沒畫完的素描留在桌上，沒有再繼續。", ["E2"]],
        ["這週寫下的兩件事都還沒落定：demo 還沒發生，素描也停在一半。", ["E1", "E2"]]]]
    },
    negation: {
      en: [[["The result pleased you, and not in a small way.", ["E1"]],
        ["Later in the week, going was still an open question: it wasn't that you didn't want to go, you just hadn't decided.", ["E2"]]]],
      "zh-Hans": [[["对那个结果，你是真的高兴，而且不是一点点。", ["E1"]], ["至于去不去，你写下的是：“我不是不想去，只是还没决定。”", ["E2"]],
        ["想去的心是有的，决定还悬着。", ["E2"]]]],
      "zh-Hant": [[["那個結果讓你很高興，而且不只是一點點。", ["E1"]], ["至於去不去，你並不是不想去，只是還沒決定。", ["E2"]], ["決定仍然懸著。", ["E2"]]]]
    }
  },
  MONTHLY: {
    "mixed-work": {
      en: [[["Early in the month you finally fixed the bug and tested the login screen twice, but tomorrow's demo still worried you, and it had not happened yet when you wrote.", ["E1"]],
        ["A week later, drawing the cup by the window grew a little irritating halfway, and you left the unfinished sketch on the table without going on.", ["E2"]]],
      [["On a weekend walk with your friend 小林, you talked about the unfinished sketch.", ["E3"]],
        ["You were very happy to see her, though you had not decided when you would draw again.", ["E3"]]],
      [["Near the end of the month, you spent a quiet Sunday reading at home and enjoyed it.", ["E4"]],
        ["Even then, how the next project will go was still unknown to you.", ["E4"]],
        ["Across these weeks, finished and unfinished things sat side by side: a fix next to a worry, a sketch set down with no date to pick it up.", ["E1", "E2", "E3"]]]],
      "zh-Hans": [[["月初，你终于修好了那个 bug，登录页面也测了两遍；写下这些时，明天的演示还没发生，担心也还在。", ["E1"]],
        ["隔了一周，画窗边的杯子画到一半有点烦，你还是把没完成的素描放在桌上，没有继续画。", ["E2"]]],
      [["后来一个周末，你和朋友小林散步，聊到了那张未完成的素描。", ["E3"]], ["见到她你很开心，只是什么时候再画，还没有决定。", ["E3"]]],
      [["月底的一个周日，你在家读书，很安静，也很享受。", ["E4"]], ["不过下一个项目会怎么样，你还是不知道。", ["E4"]],
        ["这个月写下的事里，有做成的，也有还悬着的：问题修好了，担心还在；素描停在一半，什么时候再画也还没定。", ["E1", "E2", "E3"]]]],
      "zh-Hant": [[["月初，你終於修好了那個 bug，登入頁面也測了兩次；寫下這些時，明天的 demo 還沒發生，擔心也還在。", ["E1"]],
        ["隔了一週，你畫窗邊的杯子，畫到一半覺得有點煩，最後還是把沒完成的素描放在桌上，沒有再畫下去。", ["E2"]]],
      [["某個週末，你和朋友小林散步，聊到那張未完成的素描。", ["E3"]], ["你很開心見到她，但什麼時候再畫，還沒有決定。", ["E3"]]],
      [["月底的一個星期天，你在家看書，很安靜，也很享受。", ["E4"]], ["只是下一個專案會怎麼走，你仍然不知道。", ["E4"]],
        ["這個月寫下的事，有完成的，也有還懸著的：問題修好了，擔心還在；素描停在一半，再畫的時間也還沒定。", ["E1", "E2", "E3"]]]]
    },
    negation: {
      en: [[["Early in the month, a result made you genuinely happy, and not just a little.", ["E1"]],
        ["The next week, going was still undecided: it was not that you didn't want to go; you simply had not made up your mind.", ["E2"]]],
      [["In the third week you wrote, “I did not say I stopped drawing.”", ["E3"]], ["It says only what you did not say, not whether you are still drawing.", ["E3"]]],
      [["Near the end of the month, you wrote that you did not feel things had gotten better.", ["E4"]],
        ["The month holds both: a result that clearly pleased you, and, weeks later, no sense that things had improved.", ["E1", "E4"]]]],
      "zh-Hans": [[["月初，那个结果让你很高兴，而且不是一点点。", ["E1"]], ["过了一周，你写道：“我不是不想去，只是还没决定。”", ["E2"]]],
      [["第三周你写的是：你没有说过自己不再画画。", ["E3"]], ["这句话只说明你没这样说过，并没有说明你还在不在画。", ["E3"]]],
      [["临近月底，你写下自己没有觉得事情变好了。", ["E4"]], ["这个月既有一个让你实实在在高兴的结果，也有几周后并不觉得事情变好的时候。", ["E1", "E4"]]]],
      "zh-Hant": [[["月初，那個結果讓你很高興，而且不只是一點點。", ["E1"]], ["過了一週，你寫到自己不是不想去，只是還沒決定。", ["E2"]]],
      [["第三週，你寫下：你沒有說過自己不再畫畫。", ["E3"]], ["這句話只說明你沒這麼說過，並沒有交代你現在還畫不畫。", ["E3"]]],
      [["接近月底時，你寫下：「我沒有覺得事情變好了。」", ["E4"]], ["這個月有一個讓你很高興的結果，也有幾週後並不覺得事情變好的時候，兩者都在。", ["E1", "E4"]]]]
    }
  }
};
const LOCALES = ["en", "zh-Hans", "zh-Hant"];
const cases = () => ["WEEKLY", "MONTHLY"].flatMap(type => Object.keys(SCENARIOS).flatMap(scenario => LOCALES.map(locale => {
  const input = type === "WEEKLY" ? weeklyInput(locale, SCENARIOS[scenario].slice(0, 2)) : monthlyInput(locale, SCENARIOS[scenario]);
  const validate = type === "WEEKLY" ? validateWeeklyReflectionV2 : validateMonthlyReflectionV2;
  const built = type === "WEEKLY" ? buildWeeklyReflectionV2Packet(input) : buildMonthlyReflectionV2Packet(input);
  return { type, scenario, locale, input, built, valid: plan(locale, type, AUTHORED[type][scenario][locale]),
    check: output => type === "WEEKLY" ? validate(output, input, built) : validate(output, input) };
})));

test("v2 packets carry Event text, weekday and week labels without identifiers, counts or truncation in every locale", () => {
  for (const { type, scenario, locale, built } of cases()) {
    const { packet } = built, serialized = JSON.stringify(packet);
    assert.equal(packet.version, REFLECTION_V2[type]); assert.equal(packet.locale, locale);
    for (const hidden of [OWNER, "event-", "memory-", "eventCount", "ownerId"]) assert.equal(serialized.includes(hidden), false, hidden);
    const texts = type === "WEEKLY" ? SCENARIOS[scenario].slice(0, 2) : SCENARIOS[scenario];
    assert.deepEqual(packet.evidence.map(item => item.text), texts);
    assert.deepEqual(packet.evidence.map(item => item.day), type === "WEEKLY" ? ["Tue", "Fri"] : ["Wed", "Wed", "Wed", "Sun"]);
    if (type === "MONTHLY") assert.deepEqual(packet.evidence.map(item => item.week), ["W1", "W2", "W3", "W4"]);
  }
});

test("historical authored Prompt-First references render verbatim with sentence evidence, without proving editorial quality", () => {
  const all = cases(); assert.equal(all.length, 12);
  for (const { type, locale, valid, check } of all) {
    const result = check(structuredClone(valid));
    assert.equal(result.sections.length, valid.paragraphs.length);
    assert.equal(result.narrative, valid.paragraphs.map(p => p.sentences.map(s => s.text).join(locale === "en" ? " " : "")).join("\n\n"));
    for (const section of result.sections) {
      assert.equal(section.contractVersion, REFLECTION_V2[type]); assert.deepEqual(section.aggregateRefs, []);
      assert.ok(section.claims.every(claim => claim.evidenceRefs.length && claim.evidenceRefs.every(ref => ref.sourceEventId.startsWith("event-"))));
    }
    // No application-authored template text is added to Claude's prose.
    for (const template of ["You recorded", "Looking back", "这周，你留下了", "這週，你留下了", "selected", "所选", "所選"]) assert.equal(result.narrative.includes(template), false);
  }
});

// HUMAN-AUTHORED / NOT CLAUDE: requested label for offline editorial reference
// prose, prepared by Codex; human editorial acceptance is still pending.
// These shorter alternatives reuse the existing mixed-work Events verbatim.
// They are contract examples, never samples of model performance or few-shots.
const EDITORIAL = {
  en: [
    "You finally fixed the bug and tested the login screen twice, though you were still worried about the next day's demo.",
    "You got a little annoyed halfway through drawing the cup by the window and left the unfinished sketch on the table.",
    "On a weekend walk with your friend 小林, you were happy to see her and talked about an unfinished sketch, without deciding when to draw again.",
    "You enjoyed a quiet Sunday reading at home, and still did not know how the next project would go."
  ],
  "zh-Hans": [
    "bug 终于修好了，登录页面也测了两遍，不过你还是担心第二天的演示。",
    "窗边的杯子画到一半，你觉得有点烦，把没画完的素描放在了桌上，没有继续画。",
    "周末和朋友小林散步，见到她你很开心，也聊起了未完成的素描，但还没决定什么时候再画。",
    "周日在家安静地读书，你很享受，只是还不知道下一个项目会怎么样。"
  ],
  "zh-Hant": [
    "bug 終於修好了，登入畫面也測了兩次，不過你還是擔心隔天的 demo。",
    "畫窗邊的杯子時，你畫到一半覺得有點煩，把沒完成的素描留在桌上，沒有繼續畫。",
    "週末和朋友小林散步，你很開心見到她，也聊起了未完成的素描，但還沒決定什麼時候再畫。",
    "週日在家安靜地看書，你很享受，只是還不知道下一個專案會怎麼樣。"
  ]
};

test("short editorial references preserve locale rendering and per-sentence provenance with flexible Weekly and Monthly structure", () => {
  for (const locale of LOCALES) {
    const sentence = i => [EDITORIAL[locale][i], [`E${i + 1}`]];
    for (const type of ["WEEKLY", "MONTHLY"]) {
      const input = type === "WEEKLY" ? weeklyInput(locale, SCENARIOS["mixed-work"].slice(0, 2)) : monthlyInput(locale, SCENARIOS["mixed-work"]);
      // Monthly spans all four weeks in three paragraphs without following the
      // packet's chronological order or claiming the two sketches are identical.
      const order = type === "WEEKLY" ? [[0], [1]] : [[1, 2], [0], [3]];
      const output = plan(locale, type, order.map(indices => indices.map(sentence)));
      const result = type === "WEEKLY" ? validateWeeklyReflectionV2(output, input) : validateMonthlyReflectionV2(output, input);
      assert.equal(result.narrative, order.map(indices => indices.map(i => EDITORIAL[locale][i]).join(locale === "en" ? " " : "")).join("\n\n"));
      assert.deepEqual(result.sections.flatMap(section => section.claims.map(claim => claim.evidenceRefs)),
        order.flat().map(i => [{ sourceEventId: `event-${i + 1}`, sourceMemoryId: `memory-${type === "MONTHLY" ? "event-" : ""}${i + 1}` }]));
    }
  }
});

// Existing localized drawing Events from sonnet-weekly.test.js. They never
// identify the shared drawing as the finished sketch, or the friend as a partner.
const DRAWINGS = {
  en: ["I finished a sketch. It was a quiet afternoon.", "I shared my drawing with a friend."],
  "zh-Hans": ["今天画完了一幅素描。那个下午很安静。", "我把画分享给朋友，聊了彼此的近况。"],
  "zh-Hant": ["今天畫完了一幅素描。那個下午很安靜。", "我把畫分享給朋友，聊了彼此的近況。"]
};

test("pure-language and sparse existing Events allow short paragraphs without relaxing evidence minimums", () => {
  for (const locale of LOCALES) {
    const texts = DRAWINGS[locale], input = weeklyInput(locale, texts);
    // Exact-source quotations exercise script and source preservation, not voice.
    const output = plan(locale, "WEEKLY", [texts.map((text, i) => [`“${text}”`, [`E${i + 1}`]])]);
    assert.equal(validateWeeklyReflectionV2(output, input).sections.length, 1);
    assert.throws(() => buildWeeklyReflectionV2Packet(weeklyInput(locale, texts.slice(0, 1))), { code: "REPORT_NARRATIVE_INVALID_INPUT" });

    const monthly = monthlyInput(locale, SCENARIOS["mixed-work"].slice(0, 3), ["02", "09", "10"].map(day => `2026-09-${day}T12:00:00Z`));
    const brief = plan(locale, "MONTHLY", [[
      [EDITORIAL[locale][0], ["E1"]], [EDITORIAL[locale][1], ["E2"]]
    ]]);
    // Existing contract: select >=3 current Events across >=2 weeks; output
    // cites every represented week, not necessarily every selected Event.
    assert.equal(validateMonthlyReflectionV2(brief, monthly).sections.length, 1);
    assert.throws(() => buildMonthlyReflectionV2Packet(monthlyInput(locale, SCENARIOS.negation.slice(0, 2))),
      { code: "REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE" });
  }
});

test("unsupported editorial counterexamples can pass deterministic validation and still require human rejection", () => {
  // Deliberately wrong paraphrases, NOT target prose. Citations are necessary
  // traceability, never semantic entailment. Do not turn these into allowlists.
  for (const { type, scenario, locale, valid, check } of cases()) {
    const output = structuredClone(valid);
    output.paragraphs[0].sentences[0].text = scenario === "mixed-work"
      ? ({ en: "The demo went well and you stopped worrying.", "zh-Hans": "演示很顺利，你不再担心了。", "zh-Hant": "demo 很順利，你不再擔心了。" })[locale]
      : ({ en: "You were unhappy about the result.", "zh-Hans": "你对结果不高兴。", "zh-Hant": "你對結果不高興。" })[locale];
    assert.doesNotThrow(() => check(output), `${type}/${scenario}/${locale}: requires semantic review`);
  }
  const input = weeklyInput("en", DRAWINGS.en);
  const merged = plan("en", "WEEKLY", [[["You shared the sketch you finished with your partner.", ["E1", "E2"]]]]);
  assert.doesNotThrow(() => validateWeeklyReflectionV2(merged, input), "object identity and relationship are not proved by refs");
});

test("v2 validation rejects unknown aliases, alias text, unsupported digits, fragment quotes, wrong-source quotes and missing coverage", () => {
  for (const { type, scenario, locale, valid, check } of cases()) {
    const first = valid.paragraphs[0].sentences[0];
    const mutations = [o => { o.version = WEEKLY_REFLECTION_CONTRACT; }, o => { o.locale = locale === "en" ? "zh-Hans" : "en"; }, o => { o.overview = "extra"; },
      o => { o.paragraphs[0].sentences[0].refs = ["E9"]; }, o => { o.paragraphs[0].sentences[0].refs = ["E1", "E1"]; },
      o => { o.paragraphs[0].sentences[0].text += " (E1)"; },
      o => { o.paragraphs[0].sentences[0].text = locale === "en" ? "You recorded 2 Events this week." : "你这周留下了2条记录。"; },
      o => { o.paragraphs[0].sentences[0].text = locale === "en" ? "You tested it 3 times, see https://example.com." : "你测了３次。"; },
      o => { o.paragraphs[0].sentences[0].text = scenario === "negation" ? "You wrote “a little happy about the result.”" : "You wrote “still worried about tomorrow's demo.”"; },
      o => { o.paragraphs[0].sentences[0] = { text: `“${SCENARIOS[scenario][1]}”`, refs: ["E1"] }; },
      o => { o.paragraphs[0].sentences.push({ ...first, text: "x".repeat(400) }, { ...first, text: "y".repeat(400) }); },
      o => { for (const p of o.paragraphs) for (const s of p.sentences) s.refs = s.refs.filter(ref => ref !== "E2").length ? s.refs.filter(ref => ref !== "E2") : ["E1"]; }];
    if (type === "WEEKLY") mutations.push(o => { o.paragraphs[0].sentences[0].refs = ["E5"]; });
    for (const mutate of mutations) {
      const output = structuredClone(valid); mutate(output);
      assert.throws(() => check(output), error => ["REPORT_NARRATIVE_GROUNDING_FAILED"].includes(error.code), `${type}/${scenario}/${locale}: ${mutate}`);
    }
  }
  // A Monthly sentence may cite last month only together with this month's evidence.
  const input = monthlyInput("en", SCENARIOS.negation, undefined, ["I was not a little happy about the result."]);
  const { packet } = buildMonthlyReflectionV2Packet(input), previous = packet.evidence.find(item => item.scope === "previous").ref;
  const current = packet.evidence.filter(item => item.week).map(item => item.ref);
  const valid = plan("en", "MONTHLY", [current.map(ref => ["A recorded moment stayed as written.", [ref]])]);
  assert.ok(validateMonthlyReflectionV2(valid, input));
  const comparison = structuredClone(valid); comparison.paragraphs[0].sentences[0].refs.push(previous);
  assert.ok(validateMonthlyReflectionV2(comparison, input));
  const alone = structuredClone(valid); alone.paragraphs[0].sentences.push({ text: "Last month stood alone.", refs: [previous] });
  assert.throws(() => validateMonthlyReflectionV2(alone, input), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
});

test("v2 trimming stays inside the unchanged Gateway admission without truncating or dropping required weeks", () => {
  const long = i => `第${i}段：${"今天很安静，我把没写完的东西留在桌上，没有决定明天要不要继续。".repeat(12)}`.slice(0, 420) + "。";
  // Seven 421-character Chinese Events stay within the existing 4,000-character Weekly context bound.
  const weekly = weeklyInput("zh-Hans", Array.from({ length: 7 }, (_, i) => long(i)), ["14", "15", "16", "17", "18", "19", "20"]);
  const monthly = monthlyInput("zh-Hant", Array.from({ length: 12 }, (_, i) => long(i)),
    Array.from({ length: 12 }, (_, i) => `2026-09-${String([1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24][i]).padStart(2, "0")}T12:00:00Z`));
  for (const [type, input, build] of [["WEEKLY", weekly, buildWeeklyReflectionV2Packet], ["MONTHLY", monthly, buildMonthlyReflectionV2Packet]]) {
    const { packet } = build(input), selected = input.evidenceSelection.evidence.map(item => item.summary);
    const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS[type]);
    const body = { model: "claude-model-id", system: REFLECTION_V2_INSTRUCTIONS[type], messages: [{ role: "user", content: JSON.stringify(packet) }],
      max_tokens: 8192, output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
    assert.ok(Buffer.byteLength(JSON.stringify(body)) + 1024 <= GATEWAY_TASK_LIMITS[`${type}_REPORT`].input, type);
    assert.ok(packet.evidence.length >= 2 && packet.evidence.length < selected.length, type);
    assert.ok(packet.evidence.every(item => selected.includes(item.text)), "whole texts only");
    assert.deepEqual(packet.evidence.map(item => item.ref), packet.evidence.map((_, i) => `E${i + 1}`));
    if (type === "MONTHLY") assert.deepEqual([...new Set(packet.evidence.map(item => item.week))], ["W1", "W2", "W3", "W4"]);
  }
});

test("contract selection defaults to v1, accepts only the exact v2 opt-in and keeps the compact prompt within Gateway bounds", () => {
  assert.equal(weeklyReflectionContract({}), WEEKLY_REFLECTION_CONTRACT); assert.equal(monthlyReflectionContract({}), MONTHLY_REFLECTION_CONTRACT);
  assert.equal(weeklyReflectionContract({ AI_WEEKLY_REFLECTION_CONTRACT: REFLECTION_V2.WEEKLY }), REFLECTION_V2.WEEKLY);
  assert.equal(monthlyReflectionContract({ AI_MONTHLY_REFLECTION_CONTRACT: REFLECTION_V2.MONTHLY }), REFLECTION_V2.MONTHLY);
  for (const value of ["", "v2", "weekly-reflection-v3", REFLECTION_V2.MONTHLY]) {
    assert.throws(() => weeklyReflectionContract({ AI_WEEKLY_REFLECTION_CONTRACT: value }), { code: "AI_GATEWAY_CONFIG_INVALID" });
  }
  assert.throws(() => monthlyReflectionContract({ AI_MONTHLY_REFLECTION_CONTRACT: REFLECTION_V2.WEEKLY }), { code: "AI_GATEWAY_CONFIG_INVALID" });
  // Do not reduce the packet's byte allowance relative to the verified d80ab522
  // prompts. This guards a real cost/evidence tradeoff, not particular wording.
  for (const [type, baselineBytes] of [["WEEKLY", 2614], ["MONTHLY", 2889]]) {
    assert.ok(Buffer.byteLength(JSON.stringify(REFLECTION_V2_INSTRUCTIONS[type])) <= baselineBytes, type);
  }
});

// Editorial R2 references authored offline by Codex, NOT Claude output and NOT
// human editorial acceptance. Reuse frozen Stage 1 evidence without invoking the
// paired runner (which must continue to reject a modified candidate checkout).
function stage1Input(id) {
  const ordinary = id === "C04", locale = ({ C01: "en", C04: "zh-Hans", C05: "zh-Hant" })[id];
  return weeklyInput(locale, ordinary ? ORDINARY[locale] : MIXED_NEGATION,
    ordinary ? ["14", "16", "18", "20"] : ["14", "15", "16", "18", "20"]);
}
const R2_REFERENCES = {
  C01: [
    [["You finally fixed the bug and tested the login screen twice, though you were still worried about the next day's demo.", ["E1"]],
      ["You were very happy about a result.", ["E2"]]],
    [["You hadn't decided whether to go; it wasn't that you didn't want to.", ["E3"]],
      ["You hadn't said you'd stopped drawing.", ["E4"]], ["You didn't feel things had improved.", ["E5"]]]
  ],
  C04: [
    [["你在一个安静的下午画完了一幅素描。", ["E1"]], ["在画室，你试用了炭笔。", ["E3"]]],
    [["和朋友分享画时，你们聊了聊彼此的近况。", ["E2"]]]
  ],
  C05: [
    [["你終於修好了 bug，登入畫面也測了兩次，不過當時還在擔心隔天的 demo。", ["E1"]],
      ["有個結果讓你很高興。", ["E2"]]],
    [["你並不是不想去，只是還沒決定。", ["E3"]],
      ["你沒有說過自己不再畫畫。", ["E4"]], ["你沒有覺得事情好轉了。", ["E5"]]]
  ]
};

test("R2 C01/C04/C05 authored references render requested locales and exact sentence provenance", () => {
  for (const id of Object.keys(R2_REFERENCES)) {
    const input = stage1Input(id), built = buildWeeklyReflectionV2Packet(input);
    const texts = id === "C04" ? ORDINARY["zh-Hans"] : MIXED_NEGATION;
    assert.deepEqual(built.packet.evidence.map(e => e.text), texts, "frozen evidence stays whole and in order");
    const output = plan(input.locale, "WEEKLY", R2_REFERENCES[id]);
    const result = validateWeeklyReflectionV2(output, input, built);
    assert.equal(result.narrative, output.paragraphs.map(p => p.sentences.map(s => s.text).join(input.locale === "en" ? " " : "")).join("\n\n"));
    assert.deepEqual(result.sections.flatMap(s => s.claims.map(c => c.evidenceRefs)),
      output.paragraphs.flatMap(p => p.sentences.map(s => s.refs.map(ref => ({
        sourceEventId: `event-${ref.slice(1)}`, sourceMemoryId: `memory-${ref.slice(1)}`
      })))));
    const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
    const body = { model: "claude-sonnet-5-5", system: REFLECTION_V2_INSTRUCTIONS.WEEKLY,
      messages: [{ role: "user", content: JSON.stringify(built.packet) }], max_tokens: 2048,
      output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
    assert.ok(Buffer.byteLength(JSON.stringify(body)) + 1024 <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input);
  }
});

test("Traditional locale echo and quote provenance are separate: native paraphrases pass, converted quotations fail", () => {
  const input = stage1Input("C05"), valid = plan("zh-Hant", "WEEKLY", R2_REFERENCES.C05);
  assert.ok(validateWeeklyReflectionV2(valid, input));
  const exact = structuredClone(valid);
  exact.paragraphs[1].sentences[0].text = "你寫下：「我不是不想去，只是还没决定。」";
  assert.ok(validateWeeklyReflectionV2(exact, input), "an exact source quote may retain Simplified characters");
  const converted = structuredClone(valid);
  converted.paragraphs[1].sentences[0].text = "你寫下：「我不是不想去，只是還沒決定。」";
  assert.throws(() => validateWeeklyReflectionV2(converted, input), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" },
    "natural Traditional rendering belongs in paraphrase, not a silently converted direct quote");
});

test("C05 realistic structural failures remain rejected without repair or fallback", async t => {
  const input = stage1Input("C05"), valid = plan("zh-Hant", "WEEKLY", R2_REFERENCES.C05);
  // Plausible failure modes, NOT a reconstruction of the lost baseline response.
  const mutations = {
    "regional locale instead of canonical locale": o => { o.locale = "zh-TW"; },
    "wrong locale echo": o => { o.locale = "zh-Hans"; },
    "missing version": o => { delete o.version; },
    "extra heading property": o => { o.paragraphs[0].heading = "本週回顧"; },
    "unknown alias": o => { o.paragraphs[0].sentences[0].refs = ["E6"]; },
    "duplicate alias": o => { o.paragraphs[0].sentences[0].refs = ["E1", "E1"]; },
    "only one Event cited": o => { for (const p of o.paragraphs) for (const s of p.sentences) s.refs = ["E1"]; },
    "unsupported fullwidth digit": o => { o.paragraphs[0].sentences[0].text = "你測了２次登入畫面。"; },
    "negation removed inside quote": o => { o.paragraphs[1].sentences[2].text = "你寫下：「覺得事情變好了。」"; },
    "quote assigned to wrong Event": o => { o.paragraphs[1].sentences[2].text = "你寫下：「我沒有覺得事情變好了。」"; o.paragraphs[1].sentences[2].refs = ["E1"]; },
    "invisible format control": o => { o.paragraphs[0].sentences[0].text += "\u200b"; },
    "paragraph over existing 700-character bound": o => { o.paragraphs[0].sentences = [
      { text: "你還沒決定。".repeat(60), refs: ["E3"] }, { text: "你沒有覺得事情好轉。".repeat(35), refs: ["E5"] }
    ]; }
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, () => {
    const output = structuredClone(valid); mutate(output);
    assert.throws(() => validateWeeklyReflectionV2(output, input), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  });
});

test("Stage 1 insufficient evidence and nonexistent packet refs fail closed", () => {
  for (const id of ["C01", "C04", "C05"]) {
    const input = stage1Input(id), output = plan(input.locale, "WEEKLY", R2_REFERENCES[id]);
    const empty = structuredClone(output); empty.paragraphs = [];
    assert.throws(() => validateWeeklyReflectionV2(empty, input), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
    const built = buildWeeklyReflectionV2Packet(input); built.refs.delete("E2");
    assert.throws(() => validateWeeklyReflectionV2(output, input, built), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
    for (const count of [0, 1]) {
      const sparse = structuredClone(input); sparse.evidenceSelection.evidence.length = count;
      assert.throws(() => buildWeeklyReflectionV2Packet(sparse), error =>
        ["REPORT_NARRATIVE_INVALID_INPUT", "REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE"].includes(error.code));
    }
  }
});

test("semantic and script errors still require editorial review even when structural validation passes", () => {
  // These are explicit rejection examples for reviewers, never target prose.
  // Passing here documents the validator's limits; it does not approve them.
  for (const [id, text, refs] of [
    ["C01", "You were unhappy about the result.", ["E2"]],
    ["C01", "You decided to go.", ["E3"]],
    ["C01", "You had stopped drawing.", ["E4"]],
    ["C01", "The successful demo put your worries to rest.", ["E1"]],
    ["C01", "The bug fix made you happy about the result.", ["E1", "E2"]],
    ["C04", "你第一次在画室试用了炭笔。", ["E3"]],
    ["C05", "你终于修好了问题。", ["E1"]]
  ]) {
    const input = stage1Input(id), output = plan(input.locale, "WEEKLY", R2_REFERENCES[id]);
    output.paragraphs[0].sentences[0] = { text, refs };
    assert.doesNotThrow(() => validateWeeklyReflectionV2(output, input), "human review must reject this structurally valid error");
  }
});

test("R2 keeps Monthly instructions and all schema/packet/validator code identical to the frozen candidate", () => {
  const root = new URL("../../", import.meta.url);
  const frozen = execFileSync("git", ["show", `${CANDIDATE}:lib/reflection-v2.js`], { cwd: root, encoding: "utf8" });
  const current = readFileSync(new URL("lib/reflection-v2.js", root), "utf8");
  const end = frozen.indexOf("\nfunction schemaFor(type)");
  const block = frozen.slice(frozen.indexOf("const shared = type =>"), end)
    .replace("export const REFLECTION_V2_INSTRUCTIONS", "const REFLECTION_V2_INSTRUCTIONS");
  const prompts = runInNewContext(`${block}\nREFLECTION_V2_INSTRUCTIONS`, Object.create(null), { timeout: 100 });
  assert.equal(REFLECTION_V2_INSTRUCTIONS.MONTHLY, prompts.MONTHLY);
  assert.notEqual(REFLECTION_V2_INSTRUCTIONS.WEEKLY, prompts.WEEKLY);
  assert.ok(Buffer.byteLength(JSON.stringify(REFLECTION_V2_INSTRUCTIONS.WEEKLY)) <= Buffer.byteLength(JSON.stringify(prompts.WEEKLY)),
    "Weekly revision must not reduce the packet byte allowance");
  assert.equal(current.slice(current.indexOf("\nfunction schemaFor(type)")), frozen.slice(end));
});
