// Synthetic data only. Diagnostics classify rejection; they never validate prose.
import assert from "node:assert/strict";
import test from "node:test";
import { buildReflectionV2, validateReflectionV2, REFLECTION_V2 } from "../../lib/reflection-v2.js";
import { reflectionV2ValidationCode, REFLECTION_V2_VALIDATION_CODES as C } from "../../scripts/reflection-v2-validation-diagnostics.mjs";

const TEXTS = ["I tested the login screen twice, but I'm still worried.", "I was not a little happy about the result.",
  "我不是不想去，只是还没决定。", "我沒有覺得事情變好了。"];
function fixture(type = "WEEKLY", locale = "en") {
  const items = TEXTS.map((text, i) => ({ text, topics: [], eventDate: new Date(`2026-09-${14 + i}T12:00:00Z`),
    week: type === "MONTHLY" ? `W${i + 1}` : null, previous: type === "MONTHLY" && i === 3,
    source: { sourceEventId: `synthetic-event-${i}`, sourceMemoryId: `synthetic-memory-${i}` } }));
  const context = { type, locale, model: "synthetic-model", built: buildReflectionV2({ type, locale, timezone: "UTC", items }) };
  const output = { version: REFLECTION_V2[type], locale, paragraphs: [{ sentences: TEXTS.slice(0, 3).map((text, i) => ({ text, refs: [`E${i + 1}`] })) }] };
  return { context, output };
}
const first = output => output.paragraphs[0].sentences[0];
const reject = (output, context, expected) => {
  assert.throws(() => validateReflectionV2(output, context), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  assert.equal(reflectionV2ValidationCode(output, context), expected);
};

const rejections = [
  ["root type", () => null, C.SCHEMA_TYPE],
  ["required property", o => { delete o.version; }, C.SCHEMA_REQUIRED],
  ["additional property", o => { o.SYNTHETIC_PRIVATE_PROPERTY = "SYNTHETIC_PRIVATE_VALUE"; }, C.SCHEMA_ADDITIONAL_PROPERTY],
  ["wrong version", o => { o.version = "wrong"; }, C.VERSION_MISMATCH],
  ["unsupported locale", o => { o.locale = "zh-TW"; }, C.LOCALE_UNSUPPORTED],
  ["wrong supported locale", o => { o.locale = o.locale === "en" ? "zh-Hant" : "en"; }, C.LOCALE_MISMATCH],
  ["array below minimum", o => { o.paragraphs = []; }, C.SCHEMA_MIN_ITEMS],
  ["array above maximum", o => { o.paragraphs = Array.from({ length: 5 }, () => structuredClone(o.paragraphs[0])); }, C.SCHEMA_MAX_ITEMS],
  ["text below minimum", o => { first(o).text = "x"; }, C.SCHEMA_MIN_LENGTH],
  ["text above maximum", o => { first(o).text = "x".repeat(401); }, C.SCHEMA_MAX_LENGTH],
  ["reference outside schema enum", o => { first(o).refs = ["E99"]; }, C.REF_OUT_OF_RANGE],
  ["whitespace-only text", o => { first(o).text = "  "; }, C.EMPTY_SENTENCE],
  ["duplicate refs", o => { first(o).refs = ["E1", "E1"]; }, C.REFS_DUPLICATE],
  ["reference absent from packet", o => { first(o).refs = ["E8"]; }, C.REF_NOT_SUPPLIED],
  ["control character", o => { first(o).text += "\n"; first(o).text = "You\nworked."; }, C.CONTROL_CHARACTER],
  ["invisible format character", o => { first(o).text += "\u200b"; }, C.CONTROL_CHARACTER],
  ["alias in prose", o => { first(o).text += " E1"; }, C.ALIAS_IN_TEXT],
  ["lowercase alias in prose", o => { first(o).text += " e1"; }, C.ALIAS_IN_TEXT],
  ["HTTP URL in prose", o => { first(o).text += " HTTPS://example.invalid"; }, C.URL_IN_TEXT],
  ["www URL in prose", o => { first(o).text += " www.example.invalid"; }, C.URL_IN_TEXT],
  ["markup prefix", o => { first(o).text = "# Heading"; }, C.MARKUP_PREFIX],
  ["unsupported digit", o => { first(o).text = "You tested it 2 times."; }, C.DIGIT_UNSUPPORTED],
  ["unsupported fullwidth digit", o => { first(o).text = "你測了２次。"; }, C.DIGIT_UNSUPPORTED],
  ["empty quotation", o => { first(o).text = "You wrote “”."; }, C.QUOTE_EMPTY],
  ["quote from wrong source", o => { first(o).text = `“${TEXTS[1]}”`; }, C.QUOTE_UNSUPPORTED],
  ["quote drops negation", o => { first(o).text = "You wrote “a little happy about the result.”"; first(o).refs = ["E2"]; }, C.QUOTE_UNSUPPORTED],
  ["quote is not clause aligned", o => { first(o).text = "You wrote “not a little happy”."; first(o).refs = ["E2"]; }, C.QUOTE_UNSUPPORTED],
  ["converted Traditional quotation", o => { first(o).text = "你寫下：「我不是不想去，只是還沒決定。」"; first(o).refs = ["E3"]; }, C.QUOTE_UNSUPPORTED],
  ["paragraph exceeds combined bound", o => { o.paragraphs[0].sentences = [
    { text: "x".repeat(360), refs: ["E1"] }, { text: "y".repeat(360), refs: ["E2", "E3"] }
  ]; }, C.PARAGRAPH_TOO_LONG],
  ["narrative exceeds combined bound", o => { o.paragraphs = Array.from({ length: 3 }, () => ({ sentences: [
    { text: "x".repeat(310), refs: ["E1"] }, { text: "y".repeat(310), refs: ["E2", "E3"] }
  ] })); }, C.NARRATIVE_TOO_LONG]
];

for (const type of ["WEEKLY", "MONTHLY"]) for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
  test(`${type}/${locale}: diagnostic codes match authoritative rejections without changing output`, () => {
    const { context, output } = fixture(type, locale);
    const before = structuredClone(output), rendered = validateReflectionV2(output, context);
    assert.ok(rendered.narrative); assert.equal(reflectionV2ValidationCode(output, context), C.UNKNOWN);
    assert.deepEqual(output, before);
    for (const [, mutate, expected] of rejections) {
      let invalid = structuredClone(output);
      const replacement = mutate(invalid); if (replacement === null) invalid = replacement;
      const saved = structuredClone(invalid); reject(invalid, context, expected); assert.deepEqual(invalid, saved);
    }
    const missingCoverage = structuredClone(output);
    for (const p of missingCoverage.paragraphs) for (const s of p.sentences) s.refs = ["E1"];
    reject(missingCoverage, context, type === "WEEKLY" ? C.WEEKLY_EVENT_COVERAGE : C.MONTHLY_WEEK_COVERAGE);
    if (type === "MONTHLY") {
      const previousOnly = structuredClone(output); first(previousOnly).refs = ["E4"];
      reject(previousOnly, context, C.PREVIOUS_ONLY_SENTENCE);
    }
    const quote = structuredClone(output); first(quote).text = `“${TEXTS[0]}”`;
    assert.doesNotThrow(() => validateReflectionV2(quote, context));
    assert.equal(reflectionV2ValidationCode(quote, context), C.UNKNOWN);
  });
}

test("clipped-fragment quotations remain rejected and repeated quotations use the same clause boundaries", () => {
  const { context, output } = fixture();
  const text = "A complete sentence. ".repeat(30) + "An unfinished final clause";
  const built = buildReflectionV2({ type: "WEEKLY", locale: "en", timezone: "UTC", items: [text, TEXTS[1]].map((text, i) => ({
    text, topics: [], eventDate: new Date("2026-09-14T12:00:00Z"), week: null, previous: false,
    source: { sourceEventId: `event-${i}`, sourceMemoryId: `memory-${i}` }
  })) });
  context.built = built; output.paragraphs[0].sentences.length = 2;
  first(output).text = "You wrote “An unfinished final clause”.";
  reject(output, context, C.QUOTE_UNSUPPORTED);
  first(output).text = "You wrote “A complete sentence.”";
  assert.doesNotThrow(() => validateReflectionV2(output, context));
  assert.equal(reflectionV2ValidationCode(output, context), C.UNKNOWN);
});

test("supported digits, normalization and paragraph/narrative boundaries keep existing acceptance", () => {
  const { context, output } = fixture();
  context.built.refs.get("E1").digits.add("2"); first(output).text = "你測了２次。";
  assert.doesNotThrow(() => validateReflectionV2(output, context));
  assert.equal(reflectionV2ValidationCode(output, context), C.UNKNOWN);
  for (const locale of ["en", "zh-Hant"]) {
    const f = fixture("WEEKLY", locale);
    const space = locale === "en" ? 1 : 0;
    f.output.paragraphs = [{ sentences: [{ text: "x".repeat(350), refs: ["E1"] }, { text: "y".repeat(350 - space), refs: ["E2"] }] }];
    assert.doesNotThrow(() => validateReflectionV2(f.output, f.context));
    assert.equal(reflectionV2ValidationCode(f.output, f.context), C.UNKNOWN);
    f.output.paragraphs[0].sentences[1].text += "y";
    reject(f.output, f.context, C.PARAGRAPH_TOO_LONG);
    f.output.paragraphs = Array.from({ length: 3 }, (_, i) => ({ sentences: [
      { text: "x".repeat(300), refs: ["E1"] }, { text: "y".repeat(300 - space - (i < 2 ? 1 : 2)), refs: ["E2"] }
    ] }));
    assert.equal(validateReflectionV2(f.output, f.context).narrative.length, 1800);
    assert.equal(reflectionV2ValidationCode(f.output, f.context), C.UNKNOWN);
    f.output.paragraphs[2].sentences[1].text += "y";
    reject(f.output, f.context, C.NARRATIVE_TOO_LONG);
  }
});

test("diagnostics return only fixed codes and suppress unexpected exception messages and causes", () => {
  const marker = "SYNTHETIC_DO_NOT_LOG_SECRET_OR_PERSONAL_CONTENT";
  const { context, output } = fixture(); first(output).text = marker + " 999";
  const diagnosis = reflectionV2ValidationCode(output, context);
  assert.equal(diagnosis, C.DIGIT_UNSUPPORTED); assert.equal(diagnosis.includes(marker), false);
  const poisoned = { ...context, built: { get refs() { throw Object.assign(Error(marker), { code: marker, cause: marker }); } } };
  assert.equal(reflectionV2ValidationCode(output, poisoned), C.UNKNOWN);
  for (const value of Object.values(C)) assert.match(value, /^REFLECTION_V2_[A-Z_]+$/);
});
