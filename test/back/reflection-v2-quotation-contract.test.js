// Offline synthetic boundaries, not target prose or a model-quality evaluation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS,
  buildReflectionV2, validateReflectionV2 } from "../../lib/reflection-v2.js";
import { reflectionV2ValidationCode, REFLECTION_V2_VALIDATION_CODES as C } from "../../scripts/reflection-v2-validation-diagnostics.mjs";

const TEXTS = ["I tested the login screen twice, but I'm still worried about the demo.",
  "I finished a sketch.", "我不是不想去，只是还没决定。", "我沒有覺得事情變好了。"];
const MARKS = [["“", "”"], ["「", "」"], ["『", "』"], ['"', '"'], ["＂", "＂"]];
function fixture(locale) {
  const built = buildReflectionV2({ type: "WEEKLY", locale, timezone: "UTC", items: TEXTS.map((text, i) => ({
    text, topics: [], previous: false, week: null, eventDate: new Date("2026-09-14T12:00:00Z"),
    source: { sourceEventId: `synthetic-event-${i}`, sourceMemoryId: `synthetic-memory-${i}` }
  })) });
  const context = { type: "WEEKLY", locale, built, model: "synthetic-model" };
  const output = { version: REFLECTION_V2.WEEKLY, locale, paragraphs: [{ sentences: [
    { text: locale === "en" ? "You tested the login screen twice and were still worried about the demo."
      : "你试了两遍登录页，但还在担心演示。", refs: ["E1"] },
    { text: locale === "en" ? "You finished a sketch." : "你画完了一幅素描。", refs: ["E2"] }
  ] }] };
  return { context, output, first: output.paragraphs[0].sentences[0] };
}
function reject(f, code) {
  const before = structuredClone(f.output);
  assert.throws(() => validateReflectionV2(f.output, f.context), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  assert.equal(reflectionV2ValidationCode(f.output, f.context), code);
  assert.deepEqual(f.output, before, "no repair, removal of quotation marks or output mutation");
}

for (const locale of ["en", "zh-Hans"]) {
  test(`${locale}: natural paraphrases, ordinary punctuation and English apostrophes do not become quotations`, () => {
    const variants = locale === "en" ? [
      "You'd tested the login screen twice, but you're still worried about the demo.",
      "You’d tested the login screen twice; you’re still worried about the demo.",
      "The login screen: you tested it twice (and were still worried about the demo)."
    ] : ["你试了两遍登录页；你还在担心演示。", "登录页试了两遍——你仍在担心演示。", "你还在担心演示（登录页试了两遍）。"];
    for (const text of variants) {
      const f = fixture(locale); f.first.text = text;
      assert.ok(validateReflectionV2(f.output, f.context).narrative.includes(text));
    }
  });

  test(`${locale}: complete literal quotations and clause boundaries remain supported with every recognized delimiter`, () => {
    for (const [open, close] of MARKS) for (const text of [TEXTS[0], "but I'm still worried about the demo."]) {
      const f = fixture(locale); f.first.text = `${open}${text}${close}`;
      assert.ok(validateReflectionV2(f.output, f.context));
    }
  });

  test(`${locale}: quotation marks around a paraphrase or emphasis invoke the exact-copy contract`, () => {
    for (const [open, close] of MARKS) {
      const f = fixture(locale);
      f.first.text = `${open}${f.first.text}${close}`;
      reject(f, C.QUOTE_UNSUPPORTED);
      f.first.text = locale === "en" ? `You were ${open}still worried${close} about the demo.`
        : `你对演示${open}仍然担心${close}。`;
      reject(f, C.QUOTE_UNSUPPORTED);
    }
  });

  test(`${locale}: partial quotations, omitted negation, fabricated quotations and wrong-source quotations fail closed`, () => {
    for (const [text, refs] of [
      ["“still worried about the demo.”", ["E1"]],
      ["「我想去，只是还没决定。」", ["E3"]],
      ["“The demo succeeded.”", ["E1"]],
      [`“${TEXTS[0]}”`, ["E2"]]
    ]) {
      const f = fixture(locale); Object.assign(f.first, { text, refs }); reject(f, C.QUOTE_UNSUPPORTED);
    }
    const empty = fixture(locale); empty.first.text = "Empty: “”."; reject(empty, C.QUOTE_EMPTY);
  });

  test(`${locale}: cross-language and script-converted paraphrases can pass; translated quotations cannot`, () => {
    const f = fixture(locale);
    f.first.refs = ["E3"]; f.first.text = locale === "en" ? "You hadn't decided whether to go." : "你还没决定要不要去。";
    assert.ok(validateReflectionV2(f.output, f.context));
    f.first.text = `“${f.first.text}”`; reject(f, C.QUOTE_UNSUPPORTED);
    f.first.refs = ["E4"]; f.first.text = locale === "en" ? "You didn't feel things had gotten better." : "你并没有觉得事情变好了。";
    assert.ok(validateReflectionV2(f.output, f.context));
    f.first.text = "「我没有觉得事情变好了。」"; reject(f, C.QUOTE_UNSUPPORTED);
    f.first.text = `「${TEXTS[3]}」`; assert.ok(validateReflectionV2(f.output, f.context));
  });

  test(`${locale}: removing quotation marks does not bypass numeric facts or evidence-reference guards`, () => {
    const f = fixture(locale); f.first.text = locale === "en" ? "You tested it 999 times." : "你测试了999次。";
    reject(f, C.DIGIT_UNSUPPORTED);
    f.first.text = locale === "en" ? "You finished a sketch." : "你画完了一幅素描。";
    f.first.refs = ["E8"]; reject(f, C.REF_NOT_SUPPLIED);
  });
}

test("only Weekly instructions change: Monthly, validators, schemas, diagnostics and two-language contract stay frozen", () => {
  const root = new URL("../../", import.meta.url), revision = "ab52399656904f4f698c5f2d731f9b98d9b658ff";
  const frozen = file => execFileSync("git", ["show", `${revision}:${file}`], { cwd: root, encoding: "utf8" });
  const source = readFileSync(new URL("lib/reflection-v2.js", root), "utf8"), old = frozen("lib/reflection-v2.js");
  assert.equal(source.slice(source.indexOf("const monthly =")), old.slice(old.indexOf("const monthly =")));
  assert.equal(readFileSync(new URL("scripts/reflection-v2-validation-diagnostics.mjs", root), "utf8"), frozen("scripts/reflection-v2-validation-diagnostics.mjs"));
  for (const schema of Object.values(REFLECTION_V2_SCHEMAS)) assert.deepEqual(schema.properties.locale.enum, ["en", "zh-Hans"]);
  const oldWeekly = old.slice(old.indexOf("const weekly = `") + "const weekly = `".length, old.indexOf("`;", old.indexOf("const weekly = `")));
  assert.ok(Buffer.byteLength(JSON.stringify(REFLECTION_V2_INSTRUCTIONS.WEEKLY)) <= Buffer.byteLength(JSON.stringify(oldWeekly)),
    "clarifying quotation syntax must not shrink the existing packet allowance");
});
