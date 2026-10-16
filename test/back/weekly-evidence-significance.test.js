// OFFLINE ONLY. Opt-in AI_WEEKLY_EVIDENCE_SIGNIFICANCE (requires Selector V2): before/after
// evidence recall on the deterministic stress set, faithfulness, bounds, and input-service
// routing/fences. Review annotations (meaningful/group/outcome) never reach selection.
import assert from "node:assert/strict";
import test from "node:test";
import { ReportInputService, REPORT_EVIDENCE_LIMITS } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2, significanceOrder, weeklySignificanceCandidates } from "../../lib/weekly-evidence-selector-v2.js";
import { CASES, EXTRA_CASES, analyzeWeekly, analyzeMonthly, weeklyArgs, owner, week } from "../../experiments/weekly-selective-reflection-v1/stress.mjs";

const LOCALES = ["en", "zh-Hans"], ALL = [...CASES, ...EXTRA_CASES], LIMITS = REPORT_EVIDENCE_LIMITS.WEEKLY;
const results = Object.fromEntries(ALL.flatMap(c => LOCALES.map(l => [`${c.id}/${l}`, analyzeWeekly(c, l)])));
const ANNOTATIONS = ["meaningful", "group", "outcome"];

test("after: every explicitly meaningful Event is delivered in A-L, both languages, within unchanged limits", () => {
  for (const [key, r] of Object.entries(results)) {
    assert.equal(r.sig.status, "READY", key);
    assert.equal(r.sig.meaningfulDelivered, r.meaningful, `${key} recall`);
    assert.equal(r.sig.droppedBeforeSelector, 0, `${key} upstream pool`);
    assert.equal(r.sig.outcomesDelivered, r.sig.outcomes, `${key} later outcome`);
    assert.ok(r.sig.delivered <= LIMITS.maxEvidence && r.sig.contextCharacters <= LIMITS.maxContextCharacters);
    assert.ok(r.sig.candidates <= LIMITS.candidateTake);
  }
});

test("before/after under the same limits: recorded improvements and no recall regression", () => {
  // [V2 before, significance after] meaningful recall, identical in en and zh-Hans.
  const expected = { A: [0, 3], B: [1, 1], C: [4, 5], D: [4, 4], E: [0, 0], F: [1, 2], H: [3, 3], I: [3, 3], J: [0, 1], K: [1, 3], L: [1, 2] };
  for (const r of Object.values(results)) {
    assert.deepEqual([r.v2.meaningfulDelivered, r.sig.meaningfulDelivered], expected[r.case], `${r.case}/${r.locale}`);
    assert.ok(r.sig.meaningfulDelivered >= r.v1.meaningfulDelivered && r.sig.meaningfulDelivered >= r.v2.meaningfulDelivered);
  }
  for (const l of LOCALES) {
    assert.equal(results[`F/${l}`].droppedBeforeSelector, 1, "before: a meaningful Event is outside the old 32-row cut");
    assert.equal(results[`F/${l}`].sig.droppedBeforeSelector, 0, "after: bounded pool ranks every loaded period row");
    assert.deepEqual(results[`A/${l}`].v2.days, [14, 15, 16]);
    assert.ok(results[`A/${l}`].sig.days.length >= 5, "after: not confined to the first days");
  }
});

test("faithfulness: selected evidence is the exact source text, date, topics and provenance; no annotation leaks", () => {
  for (const c of ALL) for (const locale of LOCALES) {
    const { rows } = weeklyArgs(c, locale), clean = rows.map(({ meaningful, ...row }) => row);
    const pool = weeklySignificanceCandidates(clean, { locale, timezone: "UTC", take: LIMITS.candidateTake });
    for (const row of pool) { assert.ok(clean.includes(row), "pool returns the original row objects"); for (const k of ANNOTATIONS) assert.ok(!(k in row)); }
    const args = { reportType: "WEEKLY", identity: { userId: owner }, ...week, locale, limits: LIMITS, candidates: pool, significance: true };
    const snapshot = JSON.stringify(args), selection = selectWeeklyEvidenceV2(args);
    assert.equal(JSON.stringify(args), snapshot, "inputs are not mutated");
    for (const ev of selection.evidence) {
      const source = clean.find(row => row.sourceEventId === ev.sourceEventId);
      assert.equal(ev.summary, source.summary); assert.equal(+ev.eventDate, +source.eventDate);
      assert.deepEqual(ev.topics, source.topics); assert.equal(ev.sourceMemoryId, source.id); assert.equal(ev.ownerId, owner);
      for (const k of ANNOTATIONS) assert.ok(!(k in ev));
    }
    assert.deepEqual(selectWeeklyEvidenceV2({ ...args, candidates: [...pool].reverse() }), selection, "order-independent");
  }
});

test("corrections and negation survive; repeated routine is deferred, not rewritten or merged", () => {
  for (const l of LOCALES) assert.equal(results[`D/${l}`].sig.meaningfulDelivered, 4, "both sides of each correction delivered");
  const rows = (texts, start = 14) => texts.map((summary, i) => ({ id: `m-${i}`, sourceEventId: `e-${i}`, ownerId: owner, memoryType: "EVENT",
    summary, topics: [], eventDate: new Date(Date.UTC(2026, 8, start + (i % 7), 9 + i)), similarity: 0, importanceScore: null }));
  const ranked = significanceOrder(rows(["I am happy with the plan.", "I am not happy with the plan.", "Bought milk.", "Bought milk again."]),
    { locale: "en", timezone: "UTC" });
  const by = text => ranked.find(item => item.row.summary === text);
  assert.equal(by("I am happy with the plan.").repeated, false); assert.equal(by("I am not happy with the plan.").repeated, false);
  assert.equal(by("Bought milk again.").repeated, true);
});

test("stance signal is polarity-neutral, first-person, and never an emotion lexicon", () => {
  const stance = (summary, locale = "en") => significanceOrder([{ id: "m", sourceEventId: "e", ownerId: owner, memoryType: "EVENT", summary,
    topics: [], eventDate: new Date("2026-09-15T12:00:00Z"), similarity: 0, importanceScore: null }], { locale, timezone: "UTC" })[0].stance;
  for (const text of ["I liked the new opening.", "I'm worried about the rent.", "I haven't decided yet.", "We still haven't decided about the flat.", "Decided to call her."])
    assert.equal(stance(text), true, text);
  for (const text of ["She sounded excited.", "Sad weather.", "Happy hour at work.", "Important meeting moved.", "My cousin got the job."])
    assert.equal(stance(text), false, text);
  for (const text of ["我挺喜欢新开头。", "我担心租金。", "还没决定。", "决定自己来讲。"]) assert.equal(stance(text, "zh-Hans"), true, text);
  for (const text of ["她听起来很兴奋。", "难过的天气。"]) assert.equal(stance(text, "zh-Hans"), false, text);
});

test("shared topic labels do not merge unrelated experiences; label words alone are not a textual link", () => {
  for (const l of LOCALES) {
    const r = results[`I/${l}`];
    assert.equal(r.sig.meaningfulDelivered, 3, "unrelated same-label experiences are not crowded out by the theme cap");
    assert.ok(r.sig.sharedLabelPairs > 0, "residual risk recorded: unrelated same-label records can co-occur in the packet");
  }
});

test("bounds, eligibility and owner fences hold in significance mode", () => {
  const { args } = weeklyArgs(CASES.find(c => c.id === "A"), "en");
  assert.throws(() => selectWeeklyEvidenceV2({ ...args, significance: "true" }), { code: "REPORT_NARRATIVE_INVALID_INPUT" });
  assert.throws(() => selectWeeklyEvidenceV2({ ...args, significance: true, candidates: [{ ...args.candidates[0], ownerId: "synthetic-other-owner" }, ...args.candidates.slice(1)] }),
    { code: "AI_FORBIDDEN" });
  assert.throws(() => selectWeeklyEvidenceV2({ ...args, significance: true, candidates: [{ ...args.candidates[0], memoryProcessingAllowed: false }] }), { code: "AI_FORBIDDEN" });
  const one = selectWeeklyEvidenceV2({ ...args, significance: true, candidates: args.candidates.slice(0, 1) });
  assert.equal(one.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(selectWeeklyEvidenceV2({ ...args, significance: false }).selectedCount, selectWeeklyEvidenceV2(args).selectedCount);
  assert.deepEqual(selectWeeklyEvidenceV2({ ...args, significance: false }), selectWeeklyEvidenceV2(args), "explicit false is the existing V2");
});

// Input-service routing with a synthetic in-memory store (no database).
function service(c, locale, env, mutate = rows => rows) {
  const state = { consent: true, retrievals: 0, sourceReads: 0 };
  const events = c.events.map((ev, i) => ({ id: `stress-${c.id}-event-${i + 1}`, ownerId: owner, memoryProcessingAllowed: true,
    occurredAt: new Date(Date.UTC(2026, 8, ev.day, ev.hour)), updatedAt: new Date("2026-09-21"),
    memory: { id: `stress-${c.id}-memory-${i + 1}`, sourceEventId: `stress-${c.id}-event-${i + 1}`, ownerId: owner, memoryType: "EVENT",
      summary: locale === "en" ? ev.en : ev.zh, topics: [...ev.topics], importanceScore: null, updatedAt: new Date("2026-09-21") } }));
  const foreign = { ...events[0], id: "foreign-event", ownerId: "synthetic-other-owner",
    memory: { ...events[0].memory, id: "foreign-memory", sourceEventId: "foreign-event", ownerId: "synthetic-other-owner" } };
  const prisma = { user: { async findUnique() { return { timezone: "UTC", preferredLocale: locale }; } },
    aiConsent: { async findUnique() { return { aiProcessing: state.consent, personalization: state.consent, memoryEnabled: state.consent, updatedAt: new Date("2026-09-01") }; } },
    event: { async findMany({ where }) { state.sourceReads++; return [...events, foreign].filter(row => row.ownerId === where.ownerId && row.memoryProcessingAllowed &&
      +row.occurredAt >= +where.occurredAt.gte && +row.occurredAt < +where.occurredAt.lt); } } };
  const retrieved = () => events.filter(ev => ev.memoryProcessingAllowed).slice(0, LIMITS.candidateTake)
    .map(ev => ({ ...ev.memory, eventDate: ev.occurredAt, similarity: 0.5 }));
  const svc = new ReportInputService({ prisma, env: { AI_WEEKLY_REFLECTION_CONTRACT: "weekly-reflection-v2", ...env }, localizedWeekly: true, localizedMonthly: true,
    semanticRetrieval: { async retrieve() { state.retrievals++; return mutate(retrieved()); } } });
  return { state, events, svc, weekly: () => svc.buildWeeklyInput({ identity: { userId: owner }, localDate: week.periodKey, asOf: new Date("2026-09-22") }),
    monthly: () => svc.buildMonthlyInput({ identity: { userId: owner }, year: 2026, month: 9, asOf: new Date("2026-10-02") }) };
}
const ON = { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true", AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "true" };
const F = CASES.find(c => c.id === "F");

test("input service: significance draws the bounded pool from all owner-scoped period rows; retrieval cost unchanged", async () => {
  for (const locale of LOCALES) {
    const off = await service(F, locale, { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true" }).weekly();
    const f = service(F, locale, ON), on = await f.weekly();
    assert.equal(f.state.retrievals, locale === "en" ? 1 : 0, "no extra retrieval call");
    // Review annotation (not visible to selection): F's meaningful Events are #2 (early) and #38 (late).
    const meaningful = [f.events[1].id, f.events[37].id], has = (r, id) => r.evidenceSelection.evidence.some(ev => ev.sourceEventId === id);
    assert.ok(meaningful.some(id => !has(off, id)), `${locale} before: one meaningful Event is lost`);
    assert.ok(meaningful.every(id => has(on, id)), `${locale} after: both delivered`);
    assert.ok(on.evidenceSelection.evidence.every(ev => ev.ownerId === owner && !ev.sourceEventId.startsWith("foreign")));
    assert.ok(on.evidenceSelection.candidateCount <= LIMITS.candidateTake);
    assert.deepEqual(on.sourceFence, off.sourceFence, "source fence snapshot is unchanged");
  }
});

test("input service: invalid or incompatible flag fails closed before retrieval; consent revocation stops source access", async () => {
  const c = CASES.find(c => c.id === "A");
  for (const env of [{ AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "true" }, { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "false", AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "true" },
    { ...ON, AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "TRUE" }, { ...ON, AI_WEEKLY_EVIDENCE_SIGNIFICANCE: "1" }]) {
    const f = service(c, "en", env); await assert.rejects(f.weekly, { code: "AI_GATEWAY_CONFIG_INVALID" }); assert.equal(f.state.retrievals, 0);
  }
  const f = service(c, "en", ON); f.state.consent = false;
  await assert.rejects(f.weekly, { code: "AI_FORBIDDEN" }); assert.equal(f.state.sourceReads, 0); assert.equal(f.state.retrievals, 0);
});

test("input service: stale/forged retrieval rows are still refused; opted-out or deleted Events never re-enter", async () => {
  const c = CASES.find(c => c.id === "A");
  for (const mutation of [row => ({ ...row, summary: "Forged synthetic content." }), row => ({ ...row, ownerId: "synthetic-other-owner" }),
    row => ({ ...row, id: "synthetic-stale-memory" }), row => ({ ...row, importanceScore: 1 })]) {
    const f = service(c, "en", ON, rows => rows.map((row, i) => i === 0 ? mutation(row) : row));
    await assert.rejects(f.weekly, { code: "REPORT_SOURCE_STALE" });
  }
  for (const locale of LOCALES) {
    const f = service(c, locale, ON), target = f.events[10];
    target.memoryProcessingAllowed = false; // opt-out: excluded by the owner-scoped period query
    const deleted = f.events.splice(16, 1)[0]; // deletion: no longer stored
    if (locale === "en") { // retrieval returning a no-longer-current row is refused
      const g = service(c, locale, ON, rows => [...rows, { ...deleted.memory, id: "gone-memory", eventDate: deleted.occurredAt, similarity: 1 }]);
      g.events.splice(16, 1); await assert.rejects(g.weekly, { code: "REPORT_SOURCE_STALE" });
    }
    const result = await f.weekly();
    assert.ok(!result.evidenceSelection.evidence.some(ev => ev.sourceEventId === target.id || ev.sourceEventId === deleted.id));
  }
});

test("Monthly input is identical with the Weekly significance flag unset, false, true and invalid; Monthly G unchanged", async () => {
  const c = CASES.find(c => c.id === "F");
  for (const locale of LOCALES) {
    const base = await service(c, locale, {}).monthly();
    for (const value of ["false", "true", "invalid"])
      assert.deepEqual(await service(c, locale, { AI_WEEKLY_EVIDENCE_SELECTOR_V2: "true", AI_WEEKLY_EVIDENCE_SIGNIFICANCE: value }).monthly(), base);
  }
  const g = analyzeMonthly(); assert.equal(g.weeksCovered, g.weeks); assert.equal(g.meaningfulDelivered, g.meaningful);
});
