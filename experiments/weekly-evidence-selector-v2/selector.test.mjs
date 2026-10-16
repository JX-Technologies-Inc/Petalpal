import assert from "node:assert/strict";
import test from "node:test";
import { ReportInputService, REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2 } from "./selector.mjs";
import { assertBounds, benchmark, owner, period } from "./benchmark.mjs";

const candidate = (n, summary, extra = {}) => ({ id: `synthetic-memory-${n}`, sourceEventId: `synthetic-event-${n}`,
  ownerId: owner, memoryType: "EVENT", eventDate: new Date(`2026-09-${14 + (n % 7)}T12:00:00Z`),
  summary, topics: ["shared"], similarity: 0, importanceScore: null, ...extra });
const input = (candidates, limits = {}) => ({ reportType: "WEEKLY", identity: { userId: owner }, locale: "en", ...period,
  candidates, limits: { ...REPORT_EVIDENCE_LIMITS.WEEKLY, ...limits } });
function compare(args) {
  const snapshot = JSON.stringify(args), before = selectReportEvidence(args), after = selectWeeklyEvidenceV2(args);
  // Node 24 deepStrictEqual treats cloned invalid Date objects as unequal.
  assert.equal(JSON.stringify(args), snapshot);
  for (const item of before.evidence) assert.deepEqual(after.evidence.find(e => e.sourceMemoryId === item.sourceMemoryId), item);
  assertBounds(args, after);
  assert.deepEqual(selectWeeklyEvidenceV2({ ...args, candidates: [...args.candidates].reverse() }), after);
  return { before, after, ids: after.evidence.map(e => e.sourceEventId) };
}

const results = benchmark();
const expected = { Q01: [4, 7], Q02: [5, 6], Q03: [4, 4], Q04: [2, 2], Q05: [3, 4], Q06: [4, 5] };
for (const c of results.cases) test(`frozen ${c.id}/${c.locale}: coverage, provenance, diversity, admission and permutation stability`, () => {
  assert.deepEqual([c.original.selectedCount, c.v2.selectedCount], expected[c.id] ?? [2, 2]);
  assert.equal(c.v2.meaningfulRetained.length, c.meaningfulTotal);
  assert.equal(c.v2.followupsRetained.length, c.followupTotal);
  assert.equal(c.original.distinctThemes, c.v2.distinctThemes);
  assert.equal(c.budgetCompliant, true); assert.equal(c.deterministic, true);
});
test("separate frozen category totals do not imply prose or semantic accuracy improvements", () => {
  assert.deepEqual(results.editorial, { cases: 12, eligibleEvidence: 56, meaningfulTotal: 32, followupTotal: 10,
    original: { selected: 44, meaningful: 22, followups: 0 }, v2: { selected: 56, meaningful: 32, followups: 10 } });
  assert.equal(results.semantic.original.selected, 32); assert.deepEqual(results.semantic.original, results.semantic.v2);
});

test("backfill uses supplied relevance ranks before importance; irrelevant admitted text can still occupy spare capacity", () => {
  const rows = [candidate(1, "I sent the bridge proposal to Pat.", { similarity: 0.9 }),
    candidate(2, "Pat marked the missing explanation on the cost sheet.", { similarity: 0.8 }),
    candidate(3, "I revised that explanation using Pat's cost notes.", { similarity: 0.7 }),
    candidate(4, "An unrelated coupon was in my mailbox.", { similarity: 0.01, importanceScore: 1 })];
  const { before, after } = compare(input(rows));
  assert.equal(before.selectedCount, 2); assert.equal(after.selectedCount, 4);
  const constrained = compare(input(rows, { maxEvidence: 3 })).after;
  assert.ok(constrained.evidence.some(e => e.sourceMemoryId === rows[2].id));
  assert.ok(!constrained.evidence.some(e => e.sourceMemoryId === rows[3].id));
  // Known trade-off: without a pool relevance guarantee or additional threshold,
  // low relevance does not mean ineligible. Do not claim the full fill is cleaner.
  assert.ok(after.evidence.some(e => e.sourceMemoryId === rows[3].id));
});

test("exact repetitions, near duplicates and repeated source/memory IDs do not reenter through backfill", () => {
  const a = candidate(1, "Started a new internship"), b = candidate(2, "Changed teams and now work on the maps."),
    c = candidate(3, "I presented the revised plan to the committee.");
  const { before, after } = compare(input([a, { ...a }, candidate(4, "Started a new internship!"), b, c,
    { ...b, id: "synthetic-other-memory", similarity: -0.2 }, { ...c, sourceEventId: "synthetic-other-event", similarity: -0.1 }]));
  assert.equal(before.deduplicatedCount, 3); assert.equal(after.selectedCount, 3);
});

test("distinct contradictory records stay separate, verbatim and attributed", () => {
  const rows = [candidate(1, "I accepted the invitation and felt excited about going."),
    candidate(2, "I wrote down the venue address beside the calendar."),
    candidate(3, "Later I cancelled; the journey felt exhausting and I no longer wanted to attend.")];
  const { after } = compare(input(rows));
  assert.equal(after.selectedCount, 3);
  assert.deepEqual(after.evidence.map(e => e.summary).sort(), rows.map(e => e.summary).sort());
});

test("existing lexical dedup can suppress a near-identical negated correction; V2 inherits this limitation", () => {
  const a = candidate(1, "I am feeling calm about the upcoming presentation after reviewing the slides.", { eventDate: new Date("2026-09-14") });
  const b = candidate(2, "I am not feeling calm about the upcoming presentation after reviewing the slides.", { eventDate: new Date("2026-09-15") });
  const c = candidate(3, "I picked up some rice and vegetables for supper.");
  const { before, after } = compare(input([a, b, c]));
  assert.equal(before.deduplicatedCount, 2); assert.equal(after.selectedCount, 2);
  assert.ok(!after.evidence.some(e => e.sourceMemoryId === b.id));
});

test("half-open window, invalid dates, absent provenance IDs and Journal records remain excluded", () => {
  const args = input([
    candidate(1, "A note exactly at the start.", { eventDate: new Date(period.periodStartUtc) }),
    candidate(2, "A middle note about the proposal."),
    candidate(3, "A final note before midnight.", { eventDate: new Date("2026-09-20T23:59:59.999Z") }),
    candidate(4, "Too early.", { eventDate: new Date("2026-09-13T23:59:59.999Z") }),
    candidate(5, "At the exclusive end.", { eventDate: new Date(period.periodEndUtc) }),
    candidate(6, "Invalid date.", { eventDate: new Date("invalid") }),
    candidate(7, "Synthetic forbidden Journal.", { memoryType: "JOURNAL" }),
    candidate(8, "Missing memory ID.", { id: "" }), candidate(9, "Missing Event ID.", { sourceEventId: "" })
  ]);
  const { after } = compare(args);
  assert.equal(after.candidateCount, 3); assert.equal(after.selectedCount, 3);
});

test("foreign/missing owner and explicit opt-out fail closed even outside the period", () => {
  const row = candidate(1, "Synthetic note.");
  for (const extra of [{ ownerId: "synthetic-other-owner" }, { ownerId: undefined }, { memoryProcessingAllowed: false }]) {
    assert.throws(() => selectWeeklyEvidenceV2(input([{ ...row, ...extra, eventDate: new Date("2020-01-01") }])), /OFFLINE_POOL_NOT_AUTHORIZED/);
  }
  assert.throws(() => selectWeeklyEvidenceV2({ ...input([row]), identity: null }), { code: "AI_AUTH_REQUIRED" });
});

test("unchanged upstream consent denies access before candidate retrieval or selection", async () => {
  for (const flag of ["aiProcessing", "personalization", "memoryEnabled"]) {
    let queries = 0;
    const prisma = { aiConsent: { async findUnique() { return { aiProcessing: true, personalization: true, memoryEnabled: true, [flag]: false }; } },
      user: { async findUnique() { queries++; throw Error("UNEXPECTED_SOURCE_ACCESS"); } },
      event: { async findMany() { queries++; throw Error("UNEXPECTED_SOURCE_ACCESS"); } } };
    const service = new ReportInputService({ prisma, localizedWeekly: true,
      semanticRetrieval: { async retrieve() { queries++; throw Error("UNEXPECTED_RETRIEVAL"); } } });
    await assert.rejects(() => service.buildWeeklyInput({ identity: { userId: owner }, localDate: "2026-09-14" }), { code: "AI_FORBIDDEN" });
    assert.equal(queries, 0);
  }
});

test("a full initial eight-source selection is never displaced by enrichment", () => {
  const rows = Array.from({ length: 8 }, (_, i) => candidate(i + 1, `Distinct entry ${String.fromCharCode(65 + i).repeat(20)}.`, { topics: [`topic-${i}`] }));
  rows.push(candidate(10, "A further follow-up on a represented topic.", { topics: ["topic-0"] }));
  const { before, after } = compare(input(rows));
  assert.equal(after.selectedCount, 8); assert.deepEqual(after, before);
});

test("backfill skips an item that cannot fit and can recover a later short item without exceeding context", () => {
  const rows = [candidate(1, "a".repeat(200), { eventDate: new Date("2026-09-14") }),
    candidate(2, "b".repeat(200), { eventDate: new Date("2026-09-15") }),
    candidate(3, "c".repeat(50), { eventDate: new Date("2026-09-16") }), candidate(4, "d".repeat(50))];
  const { before, after } = compare(input(rows, { maxContextCharacters: 500 }));
  assert.equal(before.selectedCount, 1); assert.equal(after.selectedCount, 2);
  assert.equal(after.contextCharacters, 442); assert.equal(after.status, "READY");
});

test("backfill can recover short eligible sources even when both initial topic slots were too large", () => {
  const rows = [candidate(1, "a".repeat(500), { eventDate: new Date("2026-09-14") }),
    candidate(2, "b".repeat(500), { eventDate: new Date("2026-09-15") }),
    candidate(3, "c".repeat(50), { eventDate: new Date("2026-09-16") }),
    candidate(4, "d".repeat(50), { eventDate: new Date("2026-09-17") })];
  const { before, after } = compare(input(rows, { maxContextCharacters: 500 }));
  assert.equal(before.selectedCount, 0); assert.equal(after.selectedCount, 2);
  assert.equal(after.contextCharacters, 292); assert.equal(after.status, "READY");
});

test("byte admission prevents enrichment from evicting an initial source through downstream trimming", () => {
  for (const locale of ["en", "zh-Hans"]) {
    const topics = Array.from({ length: 10 }, (_, i) => `${i}${"界".repeat(39)}`);
    const rows = Array.from({ length: 8 }, (_, i) => candidate(i + 1, String.fromCharCode(65 + i).repeat(350), { topics }));
    const args = { ...input(rows), locale }, { before, after } = compare(args);
    assert.equal(before.selectedCount, 2);
    assert.ok(after.selectedCount < 8);
    assert.ok(after.contextCharacters < args.limits.maxContextCharacters);
    const budget = assertBounds(args, after);
    assert.equal(budget.actual.packet.evidence.length, after.selectedCount);
    assert.ok(budget.requestBytesWithReserve <= 8192);
  }
});

test("an original selection that already trims receives no enrichment or changed failure behavior", () => {
  const rows = Array.from({ length: 6 }, (_, i) => candidate(i + 1, String.fromCharCode(65 + i).repeat(350), {
    topics: Array.from({ length: 10 }, (_, j) => `${j === 0 ? i % 2 : 9}${"界".repeat(39)}`)
  }));
  const args = input(rows), { before, after } = compare(args);
  assert.equal(before.selectedCount, 4); assert.deepEqual(after, before);
  assert.ok(assertBounds(args, after).actual.packet.evidence.length < after.selectedCount);
});

test("sparse and empty pools retain the two-Event generation minimum", () => {
  for (const rows of [[], [candidate(1, "A single brief note.")]]) {
    const { after } = compare(input(rows));
    assert.equal(after.status, "INSUFFICIENT_EVIDENCE");
    assert.equal(after.selectedCount, rows.length);
  }
});

test("Weekly-only bounds cannot be widened or silently change the initial per-theme policy", () => {
  const args = input([candidate(1, "Synthetic note.")]);
  assert.throws(() => selectWeeklyEvidenceV2({ ...args, reportType: "MONTHLY" }), /OFFLINE_WEEKLY_INPUT_INVALID/);
  for (const limits of [{ maxEvidence: 9 }, { maxContextCharacters: 4001 }, { candidateTake: 33 }, { maxPerTheme: 3 }, { minimumEvidence: 1 }]) {
    assert.throws(() => selectWeeklyEvidenceV2({ ...args, limits: { ...args.limits, ...limits } }), /OFFLINE_WEEKLY_INPUT_INVALID/);
  }
  assert.throws(() => selectWeeklyEvidenceV2(input(Array.from({ length: 33 }, (_, i) => candidate(i, `Entry ${i}.`)))), /OFFLINE_WEEKLY_INPUT_INVALID/);
});

test("nonfinite ranks and conflicting equal-rank versions are refused rather than chosen by input order", () => {
  const row = candidate(1, "The invitation was accepted.");
  assert.throws(() => selectWeeklyEvidenceV2(input([row, { ...row, summary: "The invitation was declined." }])), /OFFLINE_AMBIGUOUS_DUPLICATE/);
  for (const score of [NaN, Infinity, "0.9"]) assert.throws(() => selectWeeklyEvidenceV2(input([{ ...row, similarity: score }])), /OFFLINE_RANK_INVALID/);
});
