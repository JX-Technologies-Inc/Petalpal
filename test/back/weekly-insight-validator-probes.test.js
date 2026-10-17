// OFFLINE ONLY. Handwritten probes of what a "deep insight" Weekly prompt tends to write,
// run through the unchanged Reflection v2 validator on realistic week O (zh-Hans):
// offer in the morning, can't sleep at night, a low day, a walk with a friend.
// Characterizes what the code rejects and what only the prompt and human review can stop.
import assert from "node:assert/strict";
import test from "node:test";
import { REFLECTION_V2, validateReflectionV2 } from "../../lib/reflection-v2.js";
import { SONNET_WEEKLY_MODEL } from "../../lib/sonnet-weekly.js";
import { REALISTIC_CASES } from "../../experiments/weekly-selective-reflection-v1/realistic.mjs";
import { analyzeWeekly } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";

const built = analyzeWeekly(REALISTIC_CASES.find((c) => c.id === "O"), "zh-Hans").v2.built;
// E1 offer (morning), E2 can't sleep (night), E3 groceries, E4 stayed in bed, E5 walk with Lin.
const out = (...sentences) => ({ version: REFLECTION_V2.WEEKLY, locale: "zh-Hans",
  paragraphs: [{ sentences: sentences.map(([text, ...refs]) => ({ text, refs })) }] });
const grounded = ["拿到实习offer的那天，你高兴地给认识的人都打了电话，到了夜里却担心自己不够好。", "E1", "E2"];
const passes = (output) => { validateReflectionV2(output, { type: "WEEKLY", locale: "zh-Hans", built, model: SONNET_WEEKLY_MODEL }); return true; };
const rejected = (output) => { assert.throws(() => passes(output), (error) => error.code === "REPORT_NARRATIVE_GROUNDING_FAILED"); return true; };

test("the validator rejects invented counts, fake quotations, markdown headings and uncited claims", () => {
  assert.ok(passes(out(grounded, ["后来有一天你大部分时间都躺在床上，小林拉你出去走了走。", "E4", "E5"])));
  assert.ok(rejected(out(grounded, ["这周你一共记录了5条心情。", "E1", "E3"])), "record counts are unsupported digits");
  assert.ok(rejected(out(grounded, ["你说：“我很开心”。", "E1"])), "a quotation must be copied exactly from a cited Event");
  assert.ok(rejected(out(["# 本周状态总览", "E1"], grounded)), "markdown headings are refused");
  assert.ok(rejected(out(["这周只有一件事让你在意。", "E1"])), "a Weekly reflection must cite at least two Events");
});

test("the validator cannot detect speculation, diagnosis, advice or a number-free section title", () => {
  // These pass schema, citation, quotation and digit checks. Only the prompt's exclusions
  // and human editorial review stop them, which is why the candidate prompt forbids them.
  assert.ok(passes(out(grounded, ["这反映出你习惯性地自我怀疑，内心深处可能一直害怕被否定。", "E2", "E4"])), "hidden motive / trait");
  assert.ok(passes(out(grounded, ["持续卧床和回避社交提示你可能存在抑郁风险。", "E4", "E5"])), "diagnosis-like risk");
  assert.ok(passes(out(grounded, ["下周建议你规律作息，多出门走走。", "E4", "E5"])), "advice");
  assert.ok(passes(out(["一、周期整体状态总览：起伏很大。", "E1", "E4"], grounded)), "Chinese numbered section title has no digit");
});
