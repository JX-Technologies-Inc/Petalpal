// OFFLINE ONLY. Deterministic stress set A-H. Characterizes (1) what the existing
// selectors deliver and (2) what the unchanged output contract permits or cannot detect.
// No provider call. Handwritten outputs are contract probes, not writing-quality evidence.
import assert from "node:assert/strict";
import test from "node:test";
import { CASES, analyzeWeekly, analyzeMonthly, weeklyArgs, MONTH } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";
import { REFLECTION_V2, REFLECTION_V2_SCHEMAS, validateReflectionV2 } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";
import { SONNET_WEEKLY_MODEL } from "../../lib/sonnet-weekly.js";
import { weeklyEditorialSettings, weeklyEditorialInstructions, weeklyEditorialPacket } from "../../lib/weekly-editorial.js";

const LOCALES = ["en", "zh-Hans"], ON = weeklyEditorialSettings({ AI_WEEKLY_REFLECTION_NARRATIVE_THREAD: "true" }, REFLECTION_V2.WEEKLY);
const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
const fits = (packet, maxTokens) => Buffer.byteLength(JSON.stringify({ model: SONNET_WEEKLY_MODEL, system: weeklyEditorialInstructions(ON),
  messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: maxTokens,
  output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } })) + 1024 <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input;
const results = Object.fromEntries(CASES.flatMap(c => LOCALES.map(l => [`${c.id}/${l}`, analyzeWeekly(c, l)])));
const ref = (r, selector, text) => { const i = r[selector].ids.findIndex(id => CASES.find(c => c.id === r.case).events[+id.split("-").pop() - 1][r.locale === "en" ? "en" : "zh"] === text); return `E${i + 1}`; };
const out = (locale, ...sentences) => ({ version: REFLECTION_V2.WEEKLY, locale, paragraphs: [{ sentences: sentences.map(([text, ...refs]) => ({ text, refs })) }] });
const check = (r, selector, output) => validateReflectionV2(output, { type: "WEEKLY", locale: r.locale, built: r[selector].built, model: SONNET_WEEKLY_MODEL });

test("Q1 selection coverage is recorded exactly for A-F and H in both languages and both selectors", () => {
  // [delivered, meaningful delivered] for v1 then v2; identical in en and zh unless noted.
  const expected = { A: [[8, 0], [8, 0]], B: [[3, 1], [8, 1]], C: [[6, 3], [7, 4]], D: [[5, 4], [5, 4]], E: [[3, 0], [3, 0]], F: [[8, 1], [8, 1]], H: [[4, 3], [4, 3]] };
  for (const [key, r] of Object.entries(results)) {
    const [v1, v2] = expected[r.case];
    assert.deepEqual([r.v1.delivered, r.v1.meaningfulDelivered], v1, `${key} v1`);
    assert.deepEqual([r.v2.delivered, r.v2.meaningfulDelivered], v2, `${key} v2`);
    assert.equal(r.v1.status, "READY"); assert.equal(r.v2.status, "READY");
  }
});

test("A (severe): with no relevance/importance signal both selectors keep the earliest Events; all three significant mid/late-week Events are absent", () => {
  for (const l of LOCALES) {
    const r = results[`A/${l}`];
    assert.deepEqual(r.v2.days, [14, 15, 16]); assert.deepEqual(r.v1.days, [14, 15, 16]);
    assert.equal(r.v2.meaningfulDelivered, 0, "selection limitation, not a prompt failure");
  }
  // The selector already honours importanceScore; the missing input is upstream (never populated in production).
  const c = CASES.find(c => c.id === "A"), { args, rows } = weeklyArgs(c, "en"), sig = new Set(rows.filter(r => r.meaningful).map(r => r.sourceEventId));
  args.candidates = args.candidates.map(row => ({ ...row, importanceScore: sig.has(row.sourceEventId) ? 0.9 : 0.2 }));
  assert.equal(selectWeeklyEvidenceV2(args).evidence.filter(ev => sig.has(ev.sourceEventId)).length, 3);
});

test("B: the distinctive quiet positive moment reaches the model despite repeated work stress", () => {
  for (const l of LOCALES) for (const s of ["v1", "v2"]) assert.equal(results[`B/${l}`][s].meaningfulDelivered, 1);
});

test("C: maxPerTheme plus the lexical backfill gate drops the late unresolved project entry; limits are unchanged", () => {
  for (const l of LOCALES) {
    const r = results[`C/${l}`], c = CASES.find(c => c.id === "C");
    const missing = c.events.filter((ev, i) => ev.meaningful && !r.v2.ids.includes(`stress-C-event-${i + 1}`)).map(ev => l === "en" ? ev.en : ev.zh);
    assert.deepEqual(missing, [l === "en" ? "Still haven't decided on the kitchen paint colour." : "厨房墙面的颜色还没定。"]);
  }
});

test("D: corrections, negation, attribution and changed outcomes are all delivered verbatim; digits and quotations stay enforced", () => {
  for (const l of LOCALES) {
    const r = results[`D/${l}`], c = CASES.find(c => c.id === "D"), texts = r.v2.built.packet.evidence.map(e => e.text);
    for (const ev of c.events.filter(ev => ev.meaningful)) assert.ok(texts.includes(l === "en" ? ev.en : ev.zh));
  }
  const r = results["D/en"], test30 = ref(r, "v2", "I didn't pass the driving theory test; I misread the email. Retaking it on the 30th.");
  const reunion = ref(r, "v2", "Mia isn't coming to the reunion after all; it was her brother who said yes.");
  assert.doesNotThrow(() => check(r, "v2", out("en", ["You hadn't passed the theory test after all and are retaking it on the 30th.", test30], ["Mia isn't coming to the reunion; her brother said yes.", reunion])));
  assert.throws(() => check(r, "v2", out("en", ["You're retaking the theory test on the 31st.", test30], ["Mia isn't coming.", reunion])), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  assert.throws(() => check(r, "v2", out("en", ["You wrote “Mia is coming to the reunion”.", reunion], ["Retake on the 30th.", test30])), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  // Validator-blind: an unquoted negation flip passes structure; only the prompt and human review guard it.
  assert.doesNotThrow(() => check(r, "v2", out("en", ["Mia is coming to the reunion after all.", reunion], ["You passed the theory test.", test30])));
});

test("F (blocker): high volume loses a meaningful Event before the selector (zh keeps the last 32) and within it (earliest-first)", () => {
  const zh = results["F/zh-Hans"], en = results["F/en"];
  assert.equal(zh.candidates, 32); assert.equal(zh.droppedBeforeSelector, 1, "early offer-accepted Event never reaches the selector");
  assert.equal(zh.v2.meaningfulDelivered, 1);
  // English uses BGE retrieval (not reproducible offline); the bounded approximation only shows the same 8-of-32 earliest-first cut.
  assert.equal(en.v2.meaningfulDelivered, 1); assert.deepEqual(en.v2.days, [14, 15]);
});

test("E and H: sparse and colloquial evidence reaches the model byte-exact; the contract allows a brief, unforced reflection", () => {
  for (const l of LOCALES) {
    for (const id of ["E", "H"]) {
      const r = results[`${id}/${l}`], c = CASES.find(c => c.id === id);
      assert.deepEqual(r.v2.built.packet.evidence.map(e => e.text), c.events.map(ev => l === "en" ? ev.en : ev.zh));
    }
  }
  const e = results["E/en"];
  assert.doesNotThrow(() => check(e, "v2", out("en", ["You cleaned the bathroom and made toast.", "E1", "E3"])));
  const h = results["H/en"], gig = ref(h, "v2", "Honestly gutted the gig got pulled last minute."), flat = ref(h, "v2", "Absolutely buzzing — we got the flat!");
  assert.doesNotThrow(() => check(h, "v2", out("en", ["“Honestly gutted the gig got pulled last minute.”", gig], ["Then you got the flat, and you were buzzing.", flat])));
  assert.throws(() => check(h, "v2", out("en", ["“Devastated the gig got pulled.”", gig], ["You got the flat.", flat])), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
  // Validator-blind: unquoted intensity inflation passes; prompt + human review only.
  assert.doesNotThrow(() => check(h, "v2", out("en", ["You were devastated about the gig.", gig], ["You got the flat.", flat])));
});

test("Q2 contract: selective output citing a subset passes; a lone distinctive moment still needs a second cited Event; forced links are validator-blind", () => {
  const b = results["B/en"], quiet = ref(b, "v2", "The neighbour's little girl waved from her balcony holding a drawing of my dog. It made my whole evening.");
  assert.doesNotThrow(() => check(b, "v2", out("en", ["The neighbour's little girl waved from her balcony with a drawing of your dog, and it made your whole evening.", quiet],
    ["Work was mostly long budget meetings.", "E1"])));
  assert.throws(() => check(b, "v2", out("en", ["The neighbour's little girl waved with a drawing of your dog, and it made your whole evening.", quiet])), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" },
    "existing Weekly rule: at least two cited Events");
  const a = results["A/en"];
  assert.doesNotThrow(() => check(a, "v2", out("en", ["Buying milk and doing the laundry were part of the same effort to get your life in order.", "E1", "E4"])));
});

test("all stress packets fit native admission with the candidate prompt at both output caps; packets equal default OFF", () => {
  for (const r of Object.values(results)) for (const s of ["v1", "v2"]) {
    assert.equal(weeklyEditorialPacket(r[s].built, ON, 2048), r[s].built);
    for (const cap of [2048, GATEWAY_TASK_LIMITS.WEEKLY_REPORT.output]) assert.ok(fits(r[s].built.packet, cap), `${r.case}/${r.locale}/${s}/${cap}`);
  }
});

test("G Monthly: unchanged selector covers every week and delivers the unresolved decision and recurring theme", () => {
  const g = analyzeMonthly();
  assert.equal(g.status, "READY"); assert.equal(MONTH.periodKey, "2026-09");
  assert.equal(g.weeks, 5); assert.equal(g.weeksCovered, 5); assert.equal(g.meaningfulDelivered, g.meaningful);
  assert.ok(g.selection.evidence.filter(ev => ev.topics.includes("running")).length >= 2, "recurring theme retained, bounded by maxPerTheme");
  assert.deepEqual(g.selection.coverage.missingWeeks, []);
});
