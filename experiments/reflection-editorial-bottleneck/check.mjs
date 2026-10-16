// Offline only. No provider client, execution mode, credential input, writes,
// ledger helper, environment loading, or model-generated scoring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locales, semanticCases, editorialCases } from "./fixtures.mjs";
import { REFLECTION_V2, REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS,
  buildReflectionV2, validateReflectionV2 } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";

globalThis.fetch = () => { throw Error("OFFLINE_ONLY"); };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const owner = "synthetic-bottleneck-owner";
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const allCases = [...semanticCases, ...editorialCases];
export const views = ["current", "permuted", "days-separated", "permuted-days-separated"];

function itemsFor(c, locale) {
  return c.evidence[locale].map((text, i) => ({ text, topics: c.themes ? [c.themes[i]] : [],
    eventDate: new Date(`2026-09-${c.days?.[i] ?? (c.id === "S08" ? [16, 18][i] : [14, 18][i])}T12:00:00Z`),
    week: null, previous: false,
    source: { sourceEventId: `synthetic-${c.id}-event-${i + 1}`, sourceMemoryId: `synthetic-${c.id}-memory-${i + 1}` }
  }));
}
function build(c, locale) {
  return buildReflectionV2({ type: "WEEKLY", locale, timezone: "UTC", items: itemsFor(c, locale) });
}

// Four controlled, information-preserving input views for later review.
// Stable aliases retain the exact source mapping; no invented themes or summaries.
// Array permutation leaves alias/chronology correlation in place: see proposal.
export function inputView(packet, view) {
  assert.ok(views.includes(view));
  const result = structuredClone(packet);
  if (view.startsWith("permuted")) {
    result.evidence = [...result.evidence.filter((_, i) => i % 2 === 1),
      ...result.evidence.filter((_, i) => i % 2 === 0)];
  }
  if (view.endsWith("days-separated")) {
    const byRef = new Map(result.evidence.map(e => [e.ref, e.day]));
    result.evidence = result.evidence.map(({ day, ...e }) => e);
    // Fixed alias order avoids changing this factor with evidence-array order.
    result.recordDays = [...byRef].sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, day]) => ({ ref, day }));
  }
  return result;
}
const output = (locale, sentences) => ({ version: REFLECTION_V2.WEEKLY, locale,
  paragraphs: [{ sentences: sentences.map(([text, refs]) => ({ text, refs })) }] });
const validate = (data, locale, built) => validateReflectionV2(data, { type: "WEEKLY", locale, built, model: "offline-authored-witness" });

function upstreamProbe(c, locale) {
  const candidates = itemsFor(c, locale).map((item, i) => ({ ...item.source, id: item.source.sourceMemoryId,
    ownerId: owner, memoryType: "EVENT", summary: item.text, topics: item.topics,
    eventDate: item.eventDate, similarity: 0, importanceScore: c.review.meaningfulRefs.includes(`E${i + 1}`) ? 0.9 : 0.1 }));
  const selection = selectReportEvidence({ identity: { userId: owner }, candidates,
    periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z",
    limits: REPORT_EVIDENCE_LIMITS.WEEKLY });
  const refs = selection.evidence.map(item => `E${candidates.findIndex(row => row.id === item.sourceMemoryId) + 1}`);
  return { selectedRefs: refs, omittedMeaningfulRefs: c.review.meaningfulRefs.filter(ref => !refs.includes(ref)) };
}

function sparseAdmission() {
  return [0, 1].map(count => {
    const candidates = itemsFor(editorialCases.find(c => c.id === "Q04"), "en").slice(0, count).map(item => ({
      id: item.source.sourceMemoryId, sourceEventId: item.source.sourceEventId, ownerId: owner,
      memoryType: "EVENT", summary: item.text, topics: item.topics, eventDate: item.eventDate
    }));
    const selection = selectReportEvidence({ identity: { userId: owner }, candidates,
      periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z",
      limits: REPORT_EVIDENCE_LIMITS.WEEKLY });
    assert.equal(selection.status, "INSUFFICIENT_EVIDENCE");
    return { candidateCount: count, selectionStatus: selection.status };
  });
}

function historicalDiagnostics() {
  // Only these four already-validated synthetic outputs; never rejected content,
  // private Journals, general logs or provider envelopes. Ledgers are not opened.
  const shared = path.resolve(root, "../petalpal-appstore-release.git/petalpal-acceptance");
  const samples = [
    ["UNV", "C01", "reflection-v2-weekly-unv-c2c4f6e7"],
    ["UNV", "C04", "reflection-v2-weekly-unv-c2c4f6e7"],
    ["FINAL", "C01", "reflection-v2-weekly-final-e5c16b70-c01-en"],
    ["FINAL", "C04", "reflection-v2-weekly-final-e5c16b70-c04-zh-hans"]
  ];
  const firstPackets = new Map();
  return samples.map(([label, id, dir]) => {
    const review = path.join(shared, dir, "review");
    const data = JSON.parse(readFileSync(path.join(review, "claims", `${id}-${label}.json`), "utf8"));
    const packet = JSON.parse(readFileSync(path.join(review, "evidence", `${id}.json`), "utf8")).packet;
    if (firstPackets.has(id)) assert.deepEqual(packet, firstPackets.get(id), "compare identical preserved evidence only");
    else firstPackets.set(id, packet);
    const prose = readFileSync(path.join(review, "prose", `${id}-${label}.txt`), "utf8");
    const sentences = data.paragraphs.flatMap(p => p.sentences);
    const cited = [...new Set(sentences.flatMap(s => s.refs))];
    const packetRefs = packet.evidence.map(e => e.ref);
    return { label, id, evidenceCount: packet.evidence.length,
      sourceTextCharacters: packet.evidence.reduce((sum, e) => sum + e.text.length, 0),
      sentenceObjects: sentences.length, crossEventSentenceObjects: sentences.filter(s => s.refs.length > 1).length,
      sentenceObjectsWithWeekday: sentences.filter(s => /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|midweek|周[一二三四五六日天]/iu.test(s.text)).length,
      firstUseRefs: cited, usesEveryEvent: packetRefs.every(ref => cited.includes(ref)),
      firstUseInSourceOrder: cited.every((ref, i) => i === 0 || packetRefs.indexOf(cited[i - 1]) < packetRefs.indexOf(ref)),
      proseCharacters: prose.length };
  });
}

export function check() {
  let preparedViews = 0, semanticPairs = 0;
  const upstream = [];
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  for (const c of allCases) for (const locale of locales) {
    const items = itemsFor(c, locale), built = build(c, locale);
    assert.ok(items.length >= 2 && items.length <= REPORT_EVIDENCE_LIMITS.WEEKLY.maxEvidence);
    assert.ok(items.every(e => e.text.length < 500), "realistic EventMemory bound; no hidden clipping");
    assert.ok(items.reduce((sum, e) => sum + e.text.length + 96, 0) <= REPORT_EVIDENCE_LIMITS.WEEKLY.maxContextCharacters);
    assert.deepEqual(built.packet.evidence.map(e => e.text), c.evidence[locale], "fixture must survive packet admission intact");
    for (const view of views) {
      const packet = inputView(built.packet, view);
      const restored = packet.evidence.map(e => ({ ...e, day: e.day ?? packet.recordDays.find(d => d.ref === e.ref).day }))
        .sort((a, b) => a.ref.localeCompare(b.ref));
      assert.deepEqual(restored, [...built.packet.evidence].sort((a, b) => a.ref.localeCompare(b.ref)));
      assert.deepEqual([...built.refs.keys()], built.packet.evidence.map(e => e.ref));
      const body = { model: "claude-sonnet-5-5", system: REFLECTION_V2_INSTRUCTIONS.WEEKLY,
        messages: [{ role: "user", content: JSON.stringify(packet) }], max_tokens: 2048,
        output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
      assert.ok(bytes(body) + 1024 <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input, "existing byte admission");
      for (const hidden of [owner, "sourceEventId", "sourceMemoryId", "meaningfulRefs", "allowed", "forbidden", "faithful", "misleading"]) {
        assert.equal(JSON.stringify(packet).includes(hidden), false, `packet excludes ${hidden}`);
      }
      preparedViews++;
    }
    if (c.category === "semantic") {
      const refs = c.id === "S07" ? ["E1", "E2"] : ["E1"];
      // A known-wrong paraphrase can pass structural validation. This must remain
      // an explicit human-review boundary, never a validator acceptance gold set.
      for (const text of [c.faithful[locale], c.misleading[locale]]) {
        validate(output(locale, [[text, refs], [c.evidence[locale][1], ["E2"]]]), locale, built);
      }
      semanticPairs++;
    } else upstream.push({ id: c.id, locale, ...upstreamProbe(c, locale) });
  }

  // Capability witnesses: unchanged validator allows reverse narrative order,
  // synthesis across Events, one paragraph, and omission of selected Events.
  for (const locale of locales) {
    const rich = build(editorialCases[0], locale);
    const sentences = locale === "en" ? [
      ["You were pleased with the revised proposal, though presenting it still made you nervous.", ["E7"]],
      ["You used Mina's specific feedback to replace the dense cost opening with an example you found easier to follow.", ["E3", "E5"]]
    ] : [
      ["你对改好的提案挺满意，但想到要做展示，还是紧张。", ["E7"]],
      ["你照着小敏指出的问题，把费用说明里绕来绕去的开头换成了一个更好懂的例子。", ["E3", "E5"]]
    ];
    validate(output(locale, sentences), locale, rich);
    const sparse = build(editorialCases.find(c => c.id === "Q04"), locale);
    const brief = output(locale, [[locale === "en" ? "You returned a library book and later sat by the window with tea." : "回家路上还了书，后来又泡了杯茶，在窗边坐了一会儿。", ["E1", "E2"]]]);
    validate(brief, locale, sparse);
    for (const mutate of [
      d => { d.paragraphs[0].sentences[0].refs = ["E8"]; },
      d => { d.paragraphs[0].sentences[0].refs = ["E1"]; },
      d => { d.paragraphs[0].sentences[0].text = "2027"; },
      d => {
        d.paragraphs[0].sentences[0].text = `“${sparse.packet.evidence[0].text}”`;
        d.paragraphs[0].sentences[0].refs = ["E2"];
        d.paragraphs[0].sentences.push({ text: sparse.packet.evidence[0].text, refs: ["E1"] });
      }
    ]) {
      const bad = structuredClone(brief); mutate(bad);
      assert.throws(() => validate(bad, locale, sparse), { code: "REPORT_NARRATIVE_GROUNDING_FAILED" });
    }
  }
  for (const row of upstream.filter(r => r.id === "Q01")) {
    assert.deepEqual(row.selectedRefs, ["E1", "E2", "E3", "E4"]);
    assert.deepEqual(row.omittedMeaningfulRefs, ["E5", "E7"]);
  }
  return { status: "OFFLINE_CHECK_PASS", providerCalls: 0, writes: 0,
    semanticCases: semanticCases.length * locales.length,
    editorialCases: editorialCases.length * locales.length,
    inputViewsChecked: preparedViews, semanticContrastPairsStructurallyAccepted: semanticPairs,
    capabilityWitnesses: 4, rejectedBoundaryMutations: 8,
    editorialQuality: "UNMEASURED — authored fixtures and witnesses are not model results",
    sparseAdmission: sparseAdmission(), upstreamSyntheticSelection: upstream, preservedOutputDiagnostics: historicalDiagnostics() };
}

const args = process.argv.slice(2);
if (!args.length || (args.length === 1 && args[0] === "check")) {
  console.log(JSON.stringify(check(), null, 2));
} else if (args.length === 4 && args[0] === "view") {
  const [, id, locale, view] = args, c = allCases.find(c => c.id === id);
  assert.ok(c && locales.includes(locale) && views.includes(view));
  console.log(JSON.stringify(inputView(build(c, locale).packet, view), null, 2));
} else {
  console.error("Offline only: check | view <S01..S08|Q01..Q06> <en|zh-Hans> <current|permuted|days-separated|permuted-days-separated>");
  process.exitCode = 2;
}
