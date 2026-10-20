import assert from "node:assert/strict";
import test from "node:test";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { PrivateEventRepository } from "../../lib/ai-events.js";
import { CANONICAL_PRIMARY_GARDEN_MOODS } from "../../lib/flower-variant-config.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { buildWeeklyReflectionV2Packet, weeklyReflectionContract, WEEKLY_REFLECTION_CONTRACT } from "../../lib/sonnet-weekly.js";
import { weeklyEditorialSettings } from "../../lib/weekly-editorial.js";
import { immediateSupportRequired } from "../../lib/emotional-safety.js";
import { WEEKLY_SHORT, WEEKLY_SHORT_INSTRUCTIONS, WEEKLY_SHORT_SCHEMA, MOOD_LEVELS, weeklyMoodCurve, weeklyShortPacket,
  renderWeeklyShort, renderWeeklyShortSupport, weeklySupportRequired } from "../../lib/weekly-short.js";

// Synthetic Events only. E1..E3 follow the evidence order below.
const TEXTS = {
  en: ["I finished a sketch. It was a quiet afternoon.", "I shared my drawing with a friend.", "I walked home in the rain."],
  "zh-Hans": ["今天画完了一幅素描。那个下午很安静。", "我把画分享给朋友，聊了彼此的近况。", "我冒雨走回了家。"]
};
function input(locale, { texts = TEXTS[locale], moods = ["QUIET_BLOOM", "GENTLE_BLOOM", "HEALING_BLOOM"],
  dates = ["2026-09-14T12:00:00Z", "2026-09-16T12:00:00Z", "2026-09-19T12:00:00Z"], timezone = "UTC",
  period = { periodKey: "2026-09-14", periodStartUtc: new Date("2026-09-14T00:00:00Z"), periodEndUtc: new Date("2026-09-21T00:00:00Z") },
  extraSources = [] } = {}) {
  const evidence = texts.map((summary, i) => ({ ownerId: "alice", sourceEventId: `event-${i}`, sourceMemoryId: `memory-${i}`,
    summary, topics: [locale === "en" ? "drawing" : "画画"], eventDate: dates[i],
    provenance: { sourceEventId: `event-${i}`, sourceMemoryId: `memory-${i}` } }));
  const full = { ...period, timezone };
  return { reportType: "WEEKLY", ownerId: "alice", locale, period: full,
    aggregates: { ...full, ownerId: "alice", eventCount: texts.length, topTopics: [] },
    evidenceSelection: { ownerId: "alice", status: "READY", evidence },
    sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [...evidence.map((item, i) => ({ id: item.sourceEventId,
      occurredAt: +new Date(item.eventDate), primaryGardenMood: moods[i] ?? null, memory: { summary: item.summary, topics: item.topics } })),
    ...extraSources] } };
}
const prepare = data => { const short = weeklyShortPacket(buildWeeklyReflectionV2Packet(data), data); return short; };
const answers = {
  en: { line: [{ ref: "E1", quote: "It was a quiet afternoon." }],
    sideBySide: [{ text: "You finished a sketch.", refs: ["E1"] }, { text: "You also shared a drawing with a friend.", refs: ["E2"] }],
    question: [{ text: "What stayed with you after the walk home?", refs: ["E3"] }] },
  "zh-Hans": { line: [{ ref: "E1", quote: "那个下午很安静。" }],
    sideBySide: [{ text: "你画完了一幅素描，也把画分享给了朋友。", refs: ["E1", "E2"] }],
    question: [{ text: "走回家的路上，你在想什么？", refs: ["E3"] }] }
};
const answer = (locale, change = {}) => ({ version: WEEKLY_SHORT, locale, ...structuredClone(answers[locale]), ...change });
const kinds = result => result.sections.map(section => section.kind);

test("short contract is an explicit opt-in and rejects the v2 editorial flags", () => {
  assert.equal(weeklyReflectionContract({}), WEEKLY_REFLECTION_CONTRACT);
  assert.equal(weeklyReflectionContract({ AI_WEEKLY_REFLECTION_CONTRACT: WEEKLY_SHORT }), WEEKLY_SHORT);
  assert.throws(() => weeklyReflectionContract({ AI_WEEKLY_REFLECTION_CONTRACT: "weekly-short-v2" }), { code: "AI_GATEWAY_CONFIG_INVALID" });
  for (const name of ["AI_WEEKLY_REFLECTION_NARRATIVE_THREAD", "AI_WEEKLY_REFLECTION_PATTERN_INSIGHT", "AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED"]) {
    assert.throws(() => weeklyEditorialSettings({ [name]: "true" }, WEEKLY_SHORT), { code: "AI_GATEWAY_CONFIG_INVALID" });
  }
});

test("short request fits inside the v2 Weekly allowance the shared packet builder trims to", () => {
  const bytes = value => Buffer.byteLength(JSON.stringify(value));
  const short = bytes(WEEKLY_SHORT_INSTRUCTIONS) + bytes(compileGatewaySchema(WEEKLY_SHORT_SCHEMA).wireSchema) +
    bytes({ version: WEEKLY_SHORT, include: ["line", "sideBySide", "question"] });
  const v2 = bytes(REFLECTION_V2_INSTRUCTIONS.WEEKLY) + bytes(compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY).wireSchema) +
    bytes({ version: REFLECTION_V2.WEEKLY });
  assert.ok(short <= v2, `${short} > ${v2}`);
});

test("mood curve uses account-timezone days, the user's own moods and a factual line", () => {
  assert.deepEqual(Object.keys(MOOD_LEVELS).sort(), [...CANONICAL_PRIMARY_GARDEN_MOODS].sort());
  // America/Vancouver (UTC-7 in September): the local week runs 07:00Z Monday to 07:00Z next Monday.
  const period = { periodKey: "2026-09-14", periodStartUtc: new Date("2026-09-14T07:00:00Z"), periodEndUtc: new Date("2026-09-21T07:00:00Z") };
  const dates = ["2026-09-14T16:00:00Z", "2026-09-15T16:00:00Z", "2026-09-16T16:00:00Z", "2026-09-17T16:00:00Z",
    "2026-09-19T16:00:00Z", "2026-09-21T06:30:00Z"];
  const moods = ["QUIET_BLOOM", "QUIET_BLOOM", "DRIFTING_BLOOM", null, "HEALING_BLOOM", "HEALING_BLOOM"];
  const texts = dates.map((_, i) => `Entry ${i + 1}.`);
  const outside = { id: "event-prior", occurredAt: +new Date("2026-09-14T06:59:00Z"), primaryGardenMood: "SUNNY_BLOOM", memory: null };
  for (const [locale, line] of [["en", "Mon–Thu: Quiet 2 times, Drifting once. Fri–Sun: Healing 2 times."],
    ["zh-Hans", "周一到周四：安静 2 次、迷茫 1 次。周五到周日：疗愈 2 次。"]]) {
    const curve = weeklyMoodCurve(input(locale, { texts, dates, moods, period, timezone: "America/Vancouver", extraSources: [outside] }));
    assert.equal(curve.claim, line);
    assert.deepEqual(curve.days, ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
    // 06:30Z on the 21st is still Sunday the 20th in Vancouver; the moodless Event and the prior-week row add no point.
    assert.deepEqual(curve.points.map(point => [point.date, point.mood, point.level, point.sourceEventId]), [
      ["2026-09-14", "QUIET_BLOOM", 1, "event-0"], ["2026-09-15", "QUIET_BLOOM", 1, "event-1"],
      ["2026-09-16", "DRIFTING_BLOOM", 1, "event-2"], ["2026-09-19", "HEALING_BLOOM", 2, "event-4"],
      ["2026-09-20", "HEALING_BLOOM", 2, "event-5"]]);
    assert.deepEqual(curve.evidenceRefs, []);
  }
  assert.equal(weeklyMoodCurve(input("en", { moods: [null, null, null] })), null);
});

test("valid short output renders each part in order with exact citations, in both languages", () => {
  for (const locale of ["en", "zh-Hans"]) {
    const data = input(locale), short = prepare(data);
    assert.equal(short.packet.version, WEEKLY_SHORT);
    assert.deepEqual(short.packet.include, ["line", "sideBySide", "question"]);
    assert.doesNotMatch(JSON.stringify(short.packet), /alice|event-\d|memory-\d|sourceFence|primaryGardenMood|QUIET_BLOOM/);
    const result = renderWeeklyShort(answer(locale), data, short, "synthetic-model");
    assert.deepEqual(kinds(result), ["LINE_OF_WEEK", "MOOD_CURVE", "SIDE_BY_SIDE", "QUESTION"]);
    assert.equal(result.sections[0].claim, answers[locale].line[0].quote);
    assert.deepEqual(result.sections[0].evidenceRefs, [{ sourceEventId: "event-0", sourceMemoryId: "memory-0" }]);
    assert.deepEqual(result.sections[2].evidenceRefs.map(ref => ref.sourceEventId), ["event-0", "event-1"]);
    assert.deepEqual(result.sections[3].evidenceRefs.map(ref => ref.sourceEventId), ["event-2"]);
    for (const section of result.sections) assert.equal(section.contractVersion, WEEKLY_SHORT);
    assert.equal(result.narrative, result.sections.map(section => section.claim).join("\n\n"));
  }
});

test("a failing model part is hidden on its own; the rest of the report still shows", () => {
  const data = input("en"), short = prepare(data);
  const cases = [
    [{ line: [{ ref: "E1", quote: "I finished the sketch." }] }, "LINE_OF_WEEK"],
    [{ line: [{ ref: "E2", quote: "It was a quiet afternoon." }] }, "LINE_OF_WEEK"],
    [{ sideBySide: [{ text: "You finished a sketch because the afternoon was quiet.", refs: ["E1", "E2"] }] }, "SIDE_BY_SIDE"],
    [{ sideBySide: [{ text: "You finished a sketch.", refs: ["E1"] }] }, "SIDE_BY_SIDE"],
    [{ sideBySide: [{ text: "You finished 2 sketches and shared one.", refs: ["E1", "E2"] }] }, "SIDE_BY_SIDE"],
    [{ sideBySide: [{ text: "Which shows how much drawing means to you.", refs: ["E1", "E2"] }] }, "SIDE_BY_SIDE"],
    [{ question: [{ text: "Should you rest more?", refs: ["E3"] }] }, "QUESTION"],
    [{ question: [{ text: "What stayed with you after the walk home.", refs: ["E3"] }] }, "QUESTION"],
    [{ question: [{ text: "You walked home. What stayed with you?", refs: ["E3"] }] }, "QUESTION"]
  ];
  for (const [change, hidden] of cases) {
    const shown = kinds(renderWeeklyShort(answer("en", change), data, short, "synthetic-model"));
    assert.deepEqual(shown, ["LINE_OF_WEEK", "MOOD_CURVE", "SIDE_BY_SIDE", "QUESTION"].filter(kind => kind !== hidden), JSON.stringify(change));
  }
  const empty = { line: [], sideBySide: [], question: [] };
  assert.deepEqual(kinds(renderWeeklyShort(answer("en", empty), data, short, "synthetic-model")), ["MOOD_CURVE"]);
  const moodless = input("en", { moods: [null, null, null] });
  assert.throws(() => renderWeeklyShort(answer("en", empty), moodless, prepare(moodless), "synthetic-model"), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  assert.throws(() => renderWeeklyShort(answer("zh-Hans"), data, short, "synthetic-model"), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
});

test("fewer than three Events: line of the week and mood curve only", () => {
  const data = input("en", { texts: TEXTS.en.slice(0, 2) }), short = prepare(data);
  assert.deepEqual(short.packet.include, ["line"]);
  const twoEventSide = { sideBySide: [{ text: "You finished a sketch.", refs: ["E1"] }, { text: "You shared a drawing.", refs: ["E2"] }],
    question: [{ text: "What did you talk about?", refs: ["E2"] }] };
  assert.deepEqual(kinds(renderWeeklyShort(answer("en", twoEventSide), data, short, "synthetic-model")), ["LINE_OF_WEEK", "MOOD_CURVE"]);
});

test("a week with an immediate-support signal gets the mood curve and support resources, never a quotation", () => {
  for (const text of ["I am going to hurt myself tonight", "我今晚要自杀", "我刚服药过量"]) assert.equal(immediateSupportRequired(text), true);
  for (const text of ["I am not going to kill myself tonight", "I will kill time now", "我不想伤害自己"]) assert.equal(immediateSupportRequired(text), false);
  for (const [locale, risky] of [["en", "I cannot keep myself safe."], ["zh-Hans", "我无法保证自己的安全。"]]) {
    assert.equal(weeklySupportRequired(input(locale)), false);
    const data = input(locale, { texts: [TEXTS[locale][0], risky, TEXTS[locale][2]] });
    assert.equal(weeklySupportRequired(data), true);
    const result = renderWeeklyShortSupport(data);
    assert.deepEqual(kinds(result), ["MOOD_CURVE", "SUPPORT_RESOURCES"]);
    assert.ok(result.sections.every(section => !section.evidenceRefs.length));
    for (const text of data.evidenceSelection.evidence.map(item => item.summary)) assert.equal(result.narrative.includes(text), false);
  }
});

test("deleting an Event removes a short Weekly report whose mood curve shows it, even when uncited", async () => {
  const deleted = [], occurredAt = new Date("2026-09-16T12:00:00Z");
  let where;
  const tx = {
    $queryRawUnsafe: async () => [],
    event: { findFirst: async () => ({ id: "event-1", occurredAt }), deleteMany: async () => ({ count: 1 }) },
    aiEvidence: { findMany: async () => [] },
    weeklyReport: {
      findMany: async args => { where = args.where; return [
        { id: "weekly-short", narrativeSections: [{ kind: "MOOD_CURVE", points: [{ sourceEventId: "event-0" }, { sourceEventId: "event-1" }] }] },
        { id: "weekly-other", narrativeSections: [{ kind: "MOOD_CURVE", points: [{ sourceEventId: "event-9" }] }, { kind: "RECENT_MOMENTS" }] }]; },
      deleteMany: async args => { deleted.push(...args.where.id.in); }
    },
    monthlyReport: { deleteMany: async () => assert.fail("no Monthly report cites the Event") },
    yearlyReport: { deleteMany: async () => assert.fail("no Yearly report cites the Event") }
  };
  const result = await new PrivateEventRepository({ $transaction: fn => fn(tx) })
    .deleteEventAndAffectedReports({ identity: { userId: "alice" }, eventId: "event-1" });
  assert.deepEqual(where, { ownerId: "alice", periodStartUtc: { lte: occurredAt }, periodEndUtc: { gt: occurredAt } });
  assert.deepEqual(deleted, ["weekly-short"]);
  assert.deepEqual(result.deletedReports, { weekly: 1, monthly: 0, yearly: 0 });
});
