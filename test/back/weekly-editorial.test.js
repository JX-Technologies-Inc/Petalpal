import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { corpus, targets, locales, inputFor, selectorArgs } from "../../experiments/weekly-editorial-quality-v1/fixtures.mjs";
import { CANDIDATE_INSTRUCTIONS } from "../../experiments/weekly-editorial-quality-v1/candidate.mjs";
import { frozenInputs, servicePacket } from "../../experiments/weekly-evidence-selector-v2/benchmark.mjs";
import { selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";
import { buildWeeklyReflectionV2Packet, validateWeeklyReflectionV2 } from "../../lib/sonnet-weekly.js";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { weeklyEditorialSettings, weeklyEditorialInstructions, weeklyEditorialPacket,
  WEEKLY_RETROSPECTIVE_INSTRUCTIONS } from "../../lib/weekly-editorial.js";

globalThis.fetch = () => { throw Error("OFFLINE_ONLY"); };
const factors = [false, true].flatMap(recordDaysSeparated => [false, true].map(retrospective => ({ recordDaysSeparated, retrospective })));
const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const body = (packet, settings, maxOutputTokens = 2048) => ({ model: "claude-sonnet-5-5",
  system: weeklyEditorialInstructions(settings), messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: maxOutputTokens,
  output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } });
const restore = packet => packet.evidence.map(e => ({ ref: e.ref,
  day: e.day ?? packet.recordDays.find(d => d.ref === e.ref).day, text: e.text,
  ...(e.topics ? { topics: e.topics } : {}), ...(e.clipped ? { clipped: e.clipped } : {}) }));

async function pinnedWeekly(t) {
  const root = new URL("../../", import.meta.url);
  const source = execFileSync("git", ["show", "4fa694727caf86bb4b480021995c898ea9fe64f5:lib/sonnet-weekly.js"], { cwd: root, encoding: "utf8" });
  const dir = mkdtempSync(path.join(tmpdir(), "petalpal-editorial-parity-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "pinned.mjs");
  writeFileSync(file, source.replace(/from "\.\/(.*?)"/gu, (_match, file) => `from "${new URL(`lib/${file}`, root).href}"`));
  return import(pathToFileURL(file).href);
}

test("both editorial flags default OFF, accept only literal booleans and require Weekly v2 for opt-in", () => {
  assert.deepEqual(weeklyEditorialSettings({}, REFLECTION_V2.WEEKLY), factors[0]);
  assert.deepEqual(weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED: "false",
    AI_WEEKLY_REFLECTION_RETROSPECTIVE: "false" }, "weekly-reflection-v1"), factors[0]);
  for (const flag of ["AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED", "AI_WEEKLY_REFLECTION_RETROSPECTIVE"]) {
    for (const value of ["TRUE", "1", "", true, false, null]) assert.throws(() => weeklyEditorialSettings({ [flag]: value }, REFLECTION_V2.WEEKLY), { code: "AI_GATEWAY_CONFIG_INVALID" });
    assert.throws(() => weeklyEditorialSettings({ [flag]: "true" }, "weekly-reflection-v1"), { code: "AI_GATEWAY_CONFIG_INVALID" });
  }
});

test("default-OFF packets and instructions match independent pinned implementation across realistic and historical cases", async t => {
  const pinned = await pinnedWeekly(t);
  const inputs = corpus.cases.flatMap(c => locales.map(locale => inputFor(c, locale)));
  for (const c of frozenInputs()) {
    const selection = selectWeeklyEvidenceV2(c.args);
    inputs.push({ reportType: "WEEKLY", ownerId: c.args.identity.userId, locale: c.locale,
      period: c.args, aggregates: { ownerId: c.args.identity.userId, eventCount: c.args.candidates.length, topTopics: [] },
      evidenceSelection: selection, sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [] } });
  }
  for (const input of inputs) {
    const old = pinned.buildWeeklyReflectionV2Packet(input), current = buildWeeklyReflectionV2Packet(input);
    assert.deepEqual(current, old);
    for (const env of [{}, { AI_WEEKLY_REFLECTION_RECORD_DAYS_SEPARATED: "false", AI_WEEKLY_REFLECTION_RETROSPECTIVE: "false" }]) {
      const settings = weeklyEditorialSettings(env, REFLECTION_V2.WEEKLY);
      assert.strictEqual(weeklyEditorialPacket(current, settings, 2048), current);
      assert.deepEqual(body(current.packet, settings), { ...body(old.packet, factors[0]), system: REFLECTION_V2_INSTRUCTIONS.WEEKLY });
    }
  }
});

for (const c of corpus.cases) for (const locale of locales) test(`${c.id}/${locale}: independent factors preserve V1/V2 sources, privacy and byte admission`, () => {
  for (const select of [selectReportEvidence, selectWeeklyEvidenceV2]) {
    const selection = select(selectorArgs(c, locale)), input = inputFor(c, locale, selection);
    const snapshot = structuredClone(input), original = buildWeeklyReflectionV2Packet(input);
    assert.equal(original.packet.evidence.length, selection.selectedCount);
    for (const settings of factors) {
      const built = weeklyEditorialPacket(original, settings, 2048);
      assert.deepEqual(restore(built.packet), original.packet.evidence);
      assert.strictEqual(built.refs, original.refs);
      assert.equal(Boolean(built.packet.recordDays), settings.recordDaysSeparated, "all nine frozen cases fit requested format");
      assert.equal(body(built.packet, settings).system, settings.retrospective ? CANDIDATE_INSTRUCTIONS : REFLECTION_V2_INSTRUCTIONS.WEEKLY);
      assert.ok(bytes(body(built.packet, settings)) + 1024 <= 8192);
      assert.deepEqual(input, snapshot);
      for (const e of built.packet.evidence) assert.ok(Object.keys(e).every(k => ["ref", "day", "text", "topics", "clipped"].includes(k)));
      for (const hidden of [input.ownerId, "sourceEventId", "sourceMemoryId", "review", "failures", "importanceScore", "selectionReason"]) assert.equal(JSON.stringify(built.packet).includes(hidden), false);
    }
  }
});

test("all handcrafted targets including provisionally approved E03 pass unchanged validator under all four runtime combinations", () => {
  for (const target of targets.targets) {
    const input = inputFor(corpus.cases.find(c => c.id === target.caseId), target.locale);
    const original = buildWeeklyReflectionV2Packet(input);
    const output = { version: target.version, locale: target.locale, paragraphs: target.paragraphs };
    const expected = validateWeeklyReflectionV2(output, input, original);
    for (const settings of factors) assert.deepEqual(validateWeeklyReflectionV2(output, input,
      weeklyEditorialPacket(original, settings, 2048)), expected);
  }
});

test("new runtime format preserves the accepted Selector V2 10/10 meaningful follow-ups", () => {
  const accepted = JSON.parse(readFileSync(new URL("../../experiments/weekly-evidence-selector-v2-candidate/results.json", import.meta.url), "utf8"));
  let retained = 0;
  for (const c of frozenInputs().filter(c => c.category === "editorial")) {
    const selection = selectWeeklyEvidenceV2(c.args), original = servicePacket(c.args, selection);
    const sourceRefs = selection.evidence.map(row => `E${c.args.candidates.findIndex(candidate => candidate.sourceEventId === row.sourceEventId) + 1}`);
    assert.deepEqual(sourceRefs, accepted.cases.find(row => row.id === c.id && row.locale === c.locale).corrected.visibleRefs);
    for (const settings of factors) {
      const built = weeklyEditorialPacket(original, settings, 2048);
      assert.deepEqual(restore(built.packet), original.packet.evidence);
      assert.strictEqual(built.refs, original.refs);
      assert.equal(built.packet.evidence.length, selection.selectedCount);
    }
    retained += c.followupRefs.filter(ref => sourceRefs.includes(ref)).length;
  }
  assert.equal(retained, 10);
});

test("composition growth fits the existing builder's 512-byte framing allowance for every supported output cap", () => {
  assert.equal(WEEKLY_RETROSPECTIVE_INSTRUCTIONS, CANDIDATE_INSTRUCTIONS);
  const original = REFLECTION_V2_INSTRUCTIONS.WEEKLY.split("\n\n"), proposed = WEEKLY_RETROSPECTIVE_INSTRUCTIONS.split("\n\n");
  assert.equal(original.length, 4); assert.equal(proposed.length, 4);
  for (const i of [0, 1, 3]) assert.equal(proposed[i], original[i]);
  const packet = buildWeeklyReflectionV2Packet(inputFor(corpus.cases[8], "en")).packet;
  const growth = bytes(WEEKLY_RETROSPECTIVE_INSTRUCTIONS) - bytes(REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  assert.ok(WEEKLY_RETROSPECTIVE_INSTRUCTIONS.length <= 4000);
  for (const maxTokens of [1, 2048, 4096]) {
    const framing = bytes(body(packet, factors[0], maxTokens)) - bytes(REFLECTION_V2_INSTRUCTIONS.WEEKLY) - bytes(wireSchema) - bytes(JSON.stringify(packet));
    assert.ok(framing + growth <= 512, "candidate prompt fits unchanged packet budget without additional trimming or rejection");
  }
});

test("production oversized packets keep existing deterministic trimming instead of the offline experiment's rejection", async t => {
  const pinned = await pinnedWeekly(t);
  let trimmed = 0;
  for (const count of [3, 4, 5, 6, 8]) for (const size of [180, 300, Math.min(490, Math.floor(4000 / count) - 96)]) {
    const input = inputFor(corpus.cases[0], "zh-Hans");
    const template = input.evidenceSelection.evidence[0];
    input.evidenceSelection.evidence = Array.from({ length: count }, (_, i) => ({ ...template,
      sourceEventId: `synthetic-event-${i}`, sourceMemoryId: `synthetic-memory-${i}`,
      provenance: { sourceEventId: `synthetic-event-${i}`, sourceMemoryId: `synthetic-memory-${i}` }, summary: "证".repeat(size - 1) + "。" }));
    const old = pinned.buildWeeklyReflectionV2Packet(input), current = buildWeeklyReflectionV2Packet(input);
    assert.deepEqual(current, old);
    if (current.packet.evidence.length < count) trimmed++;
    for (const settings of factors) {
      const built = weeklyEditorialPacket(current, settings, 4096);
      assert.deepEqual(restore(built.packet), old.packet.evidence);
      assert.strictEqual(built.refs, current.refs);
      assert.ok(bytes(body(built.packet, settings, 4096)) + 1024 <= 8192);
    }
  }
  assert.ok(trimmed > 0);
});

test("format overhead at the exact Gateway byte boundary falls back without changing prompt choice or refs", () => {
  for (const retrospective of [false, true]) {
    const settings = { recordDaysSeparated: true, retrospective };
    const original = structuredClone(buildWeeklyReflectionV2Packet(inputFor(corpus.cases[8], "en")));
    // Direct synthetic Gateway-boundary probe. The normal builder is more
    // conservative; this also protects availability if its framing evolves.
    const remaining = 8192 - 1024 - bytes(body(original.packet, settings, 4096));
    original.packet.evidence[0].text += "x".repeat(remaining);
    assert.equal(bytes(body(original.packet, settings, 4096)) + 1024, 8192);
    const snapshot = structuredClone(original);
    assert.strictEqual(weeklyEditorialPacket(original, settings, 4096), original);
    assert.deepEqual(original, snapshot);
    assert.equal(weeklyEditorialInstructions(settings), retrospective ? WEEKLY_RETROSPECTIVE_INSTRUCTIONS : REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  }
});

test("valid eight-source V2 input near the production budget keeps all sources when the optional format cannot fit", () => {
  const args = selectorArgs(corpus.cases[0], "zh-Hans"), template = args.candidates[0];
  args.candidates = Array.from({ length: 8 }, (_, i) => ({ ...template,
    id: `synthetic-memory-${i}`, sourceEventId: `synthetic-event-${i}`,
    topics: [`budget-topic-${i}`], summary: "证".repeat(159) + String(i) + "。" }));
  const selected = selectWeeklyEvidenceV2(args), built = servicePacket(args, selected);
  assert.equal(selected.selectedCount, 8); assert.equal(built.packet.evidence.length, 8);
  const settings = { recordDaysSeparated: true, retrospective: true };
  assert.equal(weeklyEditorialPacket(built, settings, 4096) === built, true, "format falls back without dropping an admitted source");
  assert.equal(body(built.packet, settings, 4096).system, WEEKLY_RETROSPECTIVE_INSTRUCTIONS);
  assert.ok(bytes(body(built.packet, settings, 4096)) + 1024 <= 8192);
});

test("failed JSON/ref/quotation validation remains a rejection with no output repair in any combination", () => {
  const target = targets.targets.find(t => t.caseId === "E03" && t.locale === "en"), input = inputFor(corpus.cases[2], "en");
  for (const settings of factors) for (const change of [
    d => { d.paragraphs[0].sentences[0].refs = ["E8"]; },
    d => { d.extra = "SYNTHETIC_PRIVATE_PLAN"; },
    d => { d.paragraphs[0].sentences[0].text = "“You finished the final edition.”"; }
  ]) {
    const output = structuredClone({ version: target.version, locale: target.locale, paragraphs: target.paragraphs }); change(output);
    const snapshot = structuredClone(output), built = weeklyEditorialPacket(buildWeeklyReflectionV2Packet(input), settings, 2048);
    assert.throws(() => validateWeeklyReflectionV2(output, input, built), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
    assert.deepEqual(output, snapshot);
  }
});
