// Synthetic, read-only comparison. No model calls, writes, historical-artifact
// access, credentials, live mode or production import of the candidate.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { semanticCases, editorialCases, locales } from "../reflection-editorial-bottleneck/fixtures.mjs";
import { REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { buildWeeklyReflectionV2Packet } from "../../lib/sonnet-weekly.js";
import { REFLECTION_V2_INSTRUCTIONS, REFLECTION_V2_SCHEMAS } from "../../lib/reflection-v2.js";
import { compileGatewaySchema } from "../../lib/ai-gateway-schema.js";
import { GATEWAY_TASK_LIMITS } from "../../lib/ai-gateway-config.js";
import { selectWeeklyEvidenceV2, packetForSelection } from "./selector.mjs";

globalThis.fetch = () => { throw Error("OFFLINE_ONLY"); };
export const owner = "synthetic-weekly-selector-owner";
export const period = { timezone: "UTC", periodKey: "2026-09-14",
  periodStartUtc: "2026-09-14T00:00:00Z", periodEndUtc: "2026-09-21T00:00:00Z" };
const followups = { Q01: ["E5", "E7"], Q02: ["E6"], Q05: ["E4"], Q06: ["E5"] };

export function frozenInputs() {
  return [...semanticCases, ...editorialCases].flatMap(c => locales.map(locale => ({
    id: c.id, category: c.category, locale, meaningfulRefs: c.review?.meaningfulRefs ?? c.targetRefs,
    followupRefs: followups[c.id] ?? [],
    args: { reportType: "WEEKLY", identity: { userId: owner }, locale, timezone: "UTC", ...period,
      limits: REPORT_EVIDENCE_LIMITS.WEEKLY, candidates: c.evidence[locale].map((summary, i) => ({
        id: `synthetic-${c.id}-memory-${i + 1}`, sourceEventId: `synthetic-${c.id}-event-${i + 1}`,
        ownerId: owner, memoryType: "EVENT", summary, topics: c.themes ? [c.themes[i]] : [],
        eventDate: new Date(`2026-09-${c.days?.[i] ?? (c.id === "S08" ? [16, 18][i] : [14, 18][i])}T12:00:00Z`),
        // Neutral supplied ranks: review/salience labels never influence selection.
        similarity: 0, importanceScore: null
      })) }
  })));
}

export function servicePacket(args, selection) {
  return buildWeeklyReflectionV2Packet({ reportType: "WEEKLY", ownerId: args.identity.userId,
    locale: args.locale, period: { ...period, timezone: args.timezone,
      periodStartUtc: args.periodStartUtc, periodEndUtc: args.periodEndUtc },
    aggregates: { ownerId: args.identity.userId, eventCount: args.candidates.length, topTopics: [] },
    evidenceSelection: selection, sourceFence: { evidencePolicy: "weekly-localized-v1", sources: [] } });
}

export function assertBounds(args, selection) {
  assert.ok(selection.selectedCount <= args.limits.maxEvidence);
  assert.ok(selection.contextCharacters <= args.limits.maxContextCharacters);
  assert.equal(selection.contextCharacters, selection.evidence.reduce((sum, row) => sum + row.summary.length + 96, 0));
  assert.equal(new Set(selection.evidence.map(e => e.sourceEventId)).size, selection.selectedCount);
  assert.equal(new Set(selection.evidence.map(e => e.sourceMemoryId)).size, selection.selectedCount);
  for (const row of selection.evidence) {
    const candidate = args.candidates.find(c => c.id === row.sourceMemoryId && c.sourceEventId === row.sourceEventId);
    assert.ok(candidate && candidate.memoryType === "EVENT" && candidate.ownerId === args.identity.userId);
    assert.equal(row.ownerId, args.identity.userId);
    assert.equal(row.summary, candidate.summary);
    assert.deepEqual(row.topics, candidate.topics);
    assert.equal(+row.eventDate, +new Date(candidate.eventDate));
    assert.ok(+row.eventDate >= +new Date(args.periodStartUtc) && +row.eventDate < +new Date(args.periodEndUtc));
    assert.deepEqual(row.provenance, { sourceEventId: row.sourceEventId, sourceMemoryId: row.sourceMemoryId });
  }
  if (selection.status !== "READY") return null;
  const actual = servicePacket(args, selection), predicted = packetForSelection(args, selection.evidence);
  assert.deepEqual(predicted, actual, "candidate's byte admission must match the real Weekly adapter");
  const { wireSchema } = compileGatewaySchema(REFLECTION_V2_SCHEMAS.WEEKLY);
  const body = { model: "claude-sonnet-5-5", system: REFLECTION_V2_INSTRUCTIONS.WEEKLY,
    messages: [{ role: "user", content: JSON.stringify(actual.packet) }], max_tokens: 2048,
    output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } } };
  const requestBytesWithReserve = Buffer.byteLength(JSON.stringify(body)) + 1024;
  assert.ok(requestBytesWithReserve <= GATEWAY_TASK_LIMITS.WEEKLY_REPORT.input);
  for (const marker of [owner, "ownerId", "sourceEventId", "sourceMemoryId", "meaningfulRefs", "followupRefs"]) {
    assert.equal(JSON.stringify(actual.packet).includes(marker), false);
  }
  return { actual, requestBytesWithReserve };
}

function metrics(c, selection) {
  const budget = assertBounds(c.args, selection);
  const bySource = new Map(c.args.candidates.map((row, i) => [row.sourceEventId, `E${i + 1}`]));
  const selectedRefs = selection.evidence.map(row => bySource.get(row.sourceEventId));
  const visibleRefs = [...budget.actual.refs.values()].map(row => bySource.get(row.source.sourceEventId));
  const themes = new Map();
  for (const row of selection.evidence) themes.set(row.theme, (themes.get(row.theme) ?? 0) + 1);
  return { selectedRefs, visibleRefs, candidateCount: selection.candidateCount, deduplicatedCount: selection.deduplicatedCount,
    selectedCount: selection.selectedCount, evidenceCoverage: selection.selectedCount / selection.deduplicatedCount,
    meaningfulRetained: c.meaningfulRefs.filter(ref => visibleRefs.includes(ref)),
    followupsRetained: c.followupRefs.filter(ref => visibleRefs.includes(ref)),
    distinctThemes: themes.size, largestThemeShare: Math.max(...themes.values()) / selection.selectedCount,
    contextCharacters: selection.contextCharacters, requestBytesWithReserve: budget.requestBytesWithReserve };
}

export function compareFrozen() {
  return frozenInputs().map(c => {
    const snapshot = structuredClone(c.args), original = selectReportEvidence(c.args), v2 = selectWeeklyEvidenceV2(c.args);
    assert.deepEqual(c.args, snapshot, "selectors must not mutate the pool or limits");
    for (const item of original.evidence) assert.deepEqual(v2.evidence.find(e => e.sourceMemoryId === item.sourceMemoryId), item);
    for (let offset = 0; offset < c.args.candidates.length; offset++) {
      const rows = c.args.candidates, rotated = [...rows.slice(offset), ...rows.slice(0, offset)];
      for (const candidates of [rotated, [...rotated].reverse()]) {
        assert.deepEqual(selectReportEvidence({ ...c.args, candidates }), original);
        assert.deepEqual(selectWeeklyEvidenceV2({ ...c.args, candidates }), v2);
      }
    }
    const before = metrics(c, original), after = metrics(c, v2);
    assert.deepEqual(after.visibleRefs, after.selectedRefs, "no final packet may silently trim the V2 selection");
    assert.ok(after.distinctThemes >= before.distinctThemes);
    return { id: c.id, category: c.category, locale: c.locale, meaningfulTotal: c.meaningfulRefs.length,
      followupTotal: c.followupRefs.length, original: before, v2: after,
      addedRefs: after.selectedRefs.filter(ref => !before.selectedRefs.includes(ref)), deterministic: true, budgetCompliant: true };
  });
}

export function benchmark() {
  const cases = compareFrozen();
  const summarize = category => {
    const rows = cases.filter(c => c.category === category);
    const sum = (selector, field) => rows.reduce((n, c) => n + (Array.isArray(c[selector][field]) ? c[selector][field].length : c[selector][field]), 0);
    return { cases: rows.length, eligibleEvidence: sum("original", "deduplicatedCount"),
      meaningfulTotal: rows.reduce((n, c) => n + c.meaningfulTotal, 0), followupTotal: rows.reduce((n, c) => n + c.followupTotal, 0),
      original: { selected: sum("original", "selectedCount"), meaningful: sum("original", "meaningfulRetained"), followups: sum("original", "followupsRetained") },
      v2: { selected: sum("v2", "selectedCount"), meaningful: sum("v2", "meaningfulRetained"), followups: sum("v2", "followupsRetained") } };
  };
  return { status: "OFFLINE_BENCHMARK_PASS", providerCalls: 0, writes: 0,
    rankPolicy: "neutral existing scores; review labels used only for measurement",
    semantic: summarize("semantic"), editorial: summarize("editorial"), cases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) { console.error("Offline comparison only; no execution flags accepted."); process.exitCode = 2; }
  else console.log(JSON.stringify(benchmark(), null, 2));
}
