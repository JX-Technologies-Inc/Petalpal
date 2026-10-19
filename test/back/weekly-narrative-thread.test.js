// OFFLINE ONLY. Narrative-thread candidate contract, OFF parity, byte admission and
// per-dimension screening. Exemplars/foils are handcrafted test doubles, not Claude output.
import assert from "node:assert/strict";
import test from "node:test";
import { corpus, targets, locales, inputFor, selectorArgs } from "../../experiments/weekly-editorial-quality-v1/fixtures.mjs";
import { exemplars, foils, score, CLASS } from "../../experiments/weekly-narrative-thread-v1/fixtures.mjs";
import { selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";
import { buildWeeklyReflectionV2Packet, SONNET_WEEKLY_MODEL } from "../../lib/sonnet-weekly.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";
import { weeklyEditorialSettings, weeklyEditorialInstructions, weeklyEditorialPacket, WEEKLY_RETROSPECTIVE_INSTRUCTIONS,
  WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS, WEEKLY_NARRATIVE_THREAD_COMPOSITION } from "../../lib/weekly-editorial.js";

const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const body = (settings, packet, maxTokens = 2048) => ({ model: SONNET_WEEKLY_MODEL, system: weeklyEditorialInstructions(settings),
  messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: maxTokens,
  output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } });
const fits = request => bytes(request) + 1024 <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input;
const THREAD = { recordDaysSeparated: false, retrospective: false, narrativeThread: true };
const OFF = { recordDaysSeparated: false, retrospective: false };
// Fixture records carry review metadata (caseId). Only the contract fields are a model
// response; the Weekly v2 schema (additionalProperties: false) correctly rejects the rest.
const response = x => ({ version: x.version, locale: x.locale, paragraphs: x.paragraphs });

test("candidate replaces only the composition paragraph with concrete decisions and carries no benchmark content", () => {
  const original = REFLECTION_V2_INSTRUCTIONS.WEEKLY.split("\n\n"), candidate = WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS.split("\n\n");
  assert.equal(candidate.length, 4);
  for (const i of [0, 1, 3]) assert.equal(candidate[i], original[i], `stage ${i} unchanged`);
  assert.equal(candidate[2], WEEKLY_NARRATIVE_THREAD_COMPOSITION);
  // Owner-specified paragraph with the 2026-10-19 voice fixes, verbatim.
  assert.equal(WEEKLY_NARRATIVE_THREAD_COMPOSITION, "Treat Events as candidates, not a checklist. Select moments with stated significance: " +
    "a wish, concern, choice, change, unresolved issue, or small valued detail. One distinctive moment may outweigh routine entries; " +
    "do not favor distress, recency, or equal coverage per day. Link Events only on textual evidence, not shared tags or dates; keep " +
    "unrelated moments separate and omit filler. Organize by meaning, not weekdays. Keep open outcomes and stated intensity; infer no " +
    "hidden motives, traits, diagnoses, lessons, growth, or whole-period trends. Address the reader as you (你), never the user (用户); " +
    "add no gender the Events lack; never remark on what the records omit. Paraphrase naturally without quotation marks, stock " +
    "reassurance, or forced themes.");
  const benchmark = corpus.cases.flatMap(c => c.events.flatMap(e => [e.en, e["zh-Hans"]]));
  for (const word of ["crane", "harbour", "Jo ", "Sam", "residency", "studio", "起重机", "港口"]) assert.ok(!WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS.includes(word));
  assert.ok(benchmark.every(text => !WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS.includes(text)));
  // Builder reserves 512 bytes for framing beyond its own prompt; delta + real framing must fit.
  const delta = bytes(WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS) - bytes(REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  assert.equal(delta, 329);
  assert.equal(bytes(WEEKLY_NARRATIVE_THREAD_COMPOSITION), 759, "serialized paragraph bytes");
  for (const maxTokens of [1, 2048, GATEWAY_TASK_LIMITS.WEEKLY_REPORT.output]) {
    const b = body(OFF, { x: 1 }, maxTokens);
    const framing = bytes(b) - bytes(b.system) - bytes(wireSchema) - bytes(b.messages[0].content);
    assert.ok(framing + delta <= 512, `framing ${framing} + delta ${delta}`);
  }
});

test("flag is strict, default OFF with the original settings shape, exclusive with retrospective and v2-only", () => {
  assert.deepEqual(weeklyEditorialSettings({}, REFLECTION_V2.WEEKLY), OFF);
  assert.deepEqual(weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "false" }, REFLECTION_V2.WEEKLY), OFF);
  assert.deepEqual(weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, REFLECTION_V2.WEEKLY), THREAD);
  assert.deepEqual(weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true", AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED: "true" },
    REFLECTION_V2.WEEKLY), { ...THREAD, recordDaysSeparated: true });
  for (const value of ["TRUE", "1", "", "yes", true, false, null]) assert.throws(() =>
    weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: value }, REFLECTION_V2.WEEKLY), { code: "AI_GATEWAY_CONFIG_INVALID" });
  assert.throws(() => weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, "weekly-reflection-v1"), { code: "AI_GATEWAY_CONFIG_INVALID" });
  assert.throws(() => weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true", AI_WEEKLY_REFLECTION_RETROSPECTIVE: "true" },
    REFLECTION_V2.WEEKLY), { code: "AI_GATEWAY_CONFIG_INVALID" });
  assert.equal(weeklyEditorialInstructions(OFF), REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  assert.equal(weeklyEditorialInstructions({ ...OFF, retrospective: true }), WEEKLY_RETROSPECTIVE_INSTRUCTIONS);
  assert.equal(weeklyEditorialInstructions(THREAD), WEEKLY_NARRATIVE_THREAD_INSTRUCTIONS);
});

test("E01-E09 × en/zh-Hans × both selectors: identical packet to OFF, admission fits, optional separation never falls back", () => {
  let views = 0;
  for (const c of corpus.cases) for (const locale of locales) for (const select of [selectReportEvidence, selectWeeklyEvidenceV2]) {
    const base = buildWeeklyReflectionV2Packet(inputFor(c, locale, select(selectorArgs(c, locale))));
    const packet = weeklyEditorialPacket(base, THREAD, 2048);
    assert.equal(packet, base, "presentation unchanged: same object as OFF");
    assert.ok(fits(body(THREAD, packet.packet)) && fits(body(THREAD, packet.packet, GATEWAY_TASK_LIMITS.WEEKLY_REPORT.output)));
    const separated = weeklyEditorialPacket(base, { ...THREAD, recordDaysSeparated: true }, 2048);
    assert.ok(Array.isArray(separated.packet.recordDays)); assert.equal(separated.refs, base.refs);
    views++;
  }
  assert.equal(views, 36);
});

test("worst-case packets at the unchanged builder budget still fit with the candidate prompt", () => {
  // Same valid eight-source near-budget construction as the existing editorial test.
  for (const locale of locales) {
    const args = selectorArgs(corpus.cases[0], locale), template = args.candidates[0];
    args.candidates = Array.from({ length: 8 }, (_, i) => ({ ...template, id: `synthetic-memory-${i}`, sourceEventId: `synthetic-event-${i}`,
      topics: [`budget-topic-${i}`], summary: (locale === "en" ? "w" : "证").repeat(159) + String(i) + (locale === "en" ? "." : "。") }));
    const selected = selectWeeklyEvidenceV2(args);
    const base = buildWeeklyReflectionV2Packet(inputFor(corpus.cases[0], locale, selected));
    assert.equal(base.packet.evidence.length, 8);
    for (const maxTokens of [2048, GATEWAY_TASK_LIMITS.WEEKLY_REPORT.output]) {
      assert.ok(fits(body(OFF, base.packet, maxTokens))); assert.ok(fits(body(THREAD, base.packet, maxTokens)), `${locale}/${maxTokens}`);
    }
  }
});

test("all 18 narrative exemplars pass the unchanged validator and every screening dimension", () => {
  assert.equal(exemplars.length, 18);
  assert.deepEqual(new Set(exemplars.map(e => `${e.caseId}/${e.locale}`)).size, 18);
  for (const e of exemplars) {
    const c = corpus.cases.find(c => c.id === e.caseId);
    for (const select of [undefined, selectWeeklyEvidenceV2]) {
      const built = buildWeeklyReflectionV2Packet(inputFor(c, e.locale, select?.(selectorArgs(c, e.locale))));
      assert.equal(built.packet.evidence.length, c.events.length, "all Events retained for these cases");
      const result = score(response(e), { caseId: e.caseId, locale: e.locale, built });
      for (const [dimension, value] of Object.entries(result)) assert.notEqual(value, false, `${e.caseId}/${e.locale}: ${dimension}`);
      assert.equal(result.synthesis, ["thread", "mixed"].includes(CLASS[e.caseId]) ? true : null);
    }
  }
});

test("foils fail their targeted dimensions; most pass the structural validator, showing what it cannot detect", () => {
  let validatorBlind = 0;
  for (const f of foils) {
    const c = corpus.cases.find(c => c.id === f.caseId), built = buildWeeklyReflectionV2Packet(inputFor(c, f.locale));
    const result = score({ version: REFLECTION_V2.WEEKLY, locale: f.locale, paragraphs: f.paragraphs }, { caseId: f.caseId, locale: f.locale, built });
    for (const [dimension, expected] of Object.entries(f.expect)) assert.equal(result[dimension], expected, `${f.id} ${dimension}`);
    if (result.validator) validatorBlind++;
  }
  assert.equal(validatorBlind, foils.length - 1, "only the reworded quotation is caught by the validator");
});

test("existing provisional targets remain valid under the candidate's unchanged packet", () => {
  for (const t of targets.targets) {
    const c = corpus.cases.find(c => c.id === t.caseId), built = buildWeeklyReflectionV2Packet(inputFor(c, t.locale));
    assert.equal(score(response(t), { caseId: t.caseId, locale: t.locale, built }).validator, true, `${t.caseId}/${t.locale}`);
  }
});

test("regression: fixture metadata is not a valid response, and the all-quoted E03/en double exceeds the claim bound", () => {
  const e03 = corpus.cases.find(c => c.id === "E03"), exemplar = exemplars.find(e => e.caseId === "E03" && e.locale === "en");
  const built = buildWeeklyReflectionV2Packet(inputFor(e03, "en", selectWeeklyEvidenceV2(selectorArgs(e03, "en"))));
  // Requires real ajv: an unknown top-level property must fail the unchanged schema.
  assert.equal(score(exemplar, { caseId: "E03", locale: "en", built }).validator, false, "extra caseId must be rejected");
  assert.equal(score(response(exemplar), { caseId: "E03", locale: "en", built }).validator, true);
  // Quoting all four delivered E03/en Events in one paragraph is 709 > 700 maxClaimCharacters,
  // so the sonnet-weekly quotedV2 double is not a valid OFF baseline for selector=true.
  const quoted = { version: REFLECTION_V2.WEEKLY, locale: "en",
    paragraphs: [{ sentences: built.packet.evidence.map(item => ({ text: `“${item.text}”`, refs: [item.ref] })) }] };
  assert.equal(built.packet.evidence.length, 4);
  assert.equal(quoted.paragraphs[0].sentences.map(s => s.text).join(" ").length, 709);
  assert.equal(score(quoted, { caseId: "E03", locale: "en", built }).validator, false);
});
