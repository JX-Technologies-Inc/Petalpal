// OFFLINE ONLY. Default-OFF pattern-insight Weekly candidate: configuration safety,
// byte-identical evidence/contract stages, and Gateway admission over stress cases A-L
// and realistic weeks M-Q in both languages. Not writing-quality evidence.
import assert from "node:assert/strict";
import test from "node:test";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";
import { SONNET_WEEKLY_MODEL } from "../../lib/sonnet-weekly.js";
import { WEEKLY_PATTERN_INSIGHT_COMPOSITION, WEEKLY_PATTERN_INSIGHT_INSTRUCTIONS, weeklyEditorialInstructions,
  weeklyEditorialSettings } from "../../lib/weekly-editorial.js";
import { CASES, EXTRA_CASES, analyzeWeekly } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";
import { REALISTIC_CASES } from "../../experiments/weekly-selective-reflection-v1/realistic.mjs";

const ON = { AI_WEEKLY_REFLECTION_PATTERN_INSIGHT: "true" };

test("default OFF keeps the existing settings shape and instructions exactly", () => {
  const off = weeklyEditorialSettings({}, REFLECTION_V2.WEEKLY);
  assert.deepEqual(off, { recordDaysSeparated: false, retrospective: false });
  assert.equal(weeklyEditorialInstructions(off), REFLECTION_V2_INSTRUCTIONS.WEEKLY);
  assert.deepEqual(weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_PATTERN_INSIGHT: "false" }, REFLECTION_V2.WEEKLY), off);
});

test("ON replaces only the composition paragraph; evidence safeguards and the JSON contract are byte-identical", () => {
  const settings = weeklyEditorialSettings(ON, REFLECTION_V2.WEEKLY);
  assert.equal(settings.patternInsight, true);
  assert.equal(weeklyEditorialInstructions(settings), WEEKLY_PATTERN_INSIGHT_INSTRUCTIONS);
  const base = REFLECTION_V2_INSTRUCTIONS.WEEKLY.split("\n\n"), candidate = WEEKLY_PATTERN_INSIGHT_INSTRUCTIONS.split("\n\n");
  assert.deepEqual([candidate[0], candidate[1], candidate[3]], [base[0], base[1], base[3]]);
  assert.equal(candidate[2], WEEKLY_PATTERN_INSIGHT_COMPOSITION);
  // The speculative parts of the brief stay excluded.
  assert.match(WEEKLY_PATTERN_INSIGHT_COMPOSITION, /Infer no unstated thoughts, worries, motives, traits, risks, diagnoses, growth or advice\./);
});

test("invalid, ambiguous or non-v2 configurations fail closed", () => {
  for (const env of [{ AI_WEEKLY_REFLECTION_PATTERN_INSIGHT: "yes" },
    { ...ON, AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, { ...ON, AI_WEEKLY_REFLECTION_RETROSPECTIVE: "true" }]) {
    assert.throws(() => weeklyEditorialSettings(env, REFLECTION_V2.WEEKLY), (error) => error.code === "AI_GATEWAY_CONFIG_INVALID");
  }
  assert.throws(() => weeklyEditorialSettings(ON, "weekly-reflection-v1"), (error) => error.code === "AI_GATEWAY_CONFIG_INVALID");
});

test("every stress and realistic week still fits Gateway admission with the candidate prompt", () => {
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  const system = weeklyEditorialInstructions(weeklyEditorialSettings(ON, REFLECTION_V2.WEEKLY));
  let checked = 0;
  for (const c of [...CASES, ...EXTRA_CASES, ...REALISTIC_CASES]) {
    for (const locale of ["en", "zh-Hans"]) {
      const built = analyzeWeekly(c, locale).v2.built;
      if (!built) continue; // abstaining weeks send nothing
      const bytes = Buffer.byteLength(JSON.stringify({ model: SONNET_WEEKLY_MODEL, system,
        messages: [{ role: "user", content: JSON.stringify(built.packet) }], max_tokens: 2048,
        output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } })) + 1024;
      assert.ok(bytes <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input, `${c.id}/${locale}: ${bytes}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30);
});
