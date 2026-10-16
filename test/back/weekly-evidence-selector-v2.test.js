import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ReportInputService, REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";
import { selectWeeklyEvidenceV2 as previousV2 } from "../../experiments/weekly-evidence-selector-v2/selector.mjs";
import { assertBounds, frozenInputs, owner, period } from "../../experiments/weekly-evidence-selector-v2/benchmark.mjs";
import { compare } from "../../experiments/weekly-evidence-selector-v2-candidate/compare.mjs";

const row = (n, summary, extra = {}) => ({ id: `synthetic-memory-${n}`, sourceEventId: `synthetic-event-${n}`,
  ownerId: owner, memoryType: "EVENT", eventDate: new Date(`2026-09-${14 + Math.min(n, 6)}T12:00:00Z`),
  summary, topics: ["proposal"], similarity: 0, importanceScore: null, ...extra });
const input = (candidates, extra = {}) => ({ reportType: "WEEKLY", identity: { userId: owner }, locale: "en", ...period,
  limits: REPORT_EVIDENCE_LIMITS.WEEKLY, candidates, ...extra });
function checked(args) {
  const snapshot = JSON.stringify(args), result = selectWeeklyEvidenceV2(args);
  assertBounds(args, result); assert.equal(JSON.stringify(args), snapshot);
  assert.deepEqual(selectWeeklyEvidenceV2({ ...args, candidates: [...args.candidates].reverse() }), result);
  return result;
}

const pairs = [
  ["I am feeling calm about the upcoming presentation after reviewing the slides.", "I am not feeling calm about the upcoming presentation after reviewing the slides."],
  ["I was not a little pleased with the result after the long meeting.", "I was a little pleased with the result after the long meeting."],
  ["I did not say I stopped drawing after the exhibition closed.", "I said I stopped drawing after the exhibition closed."],
  ["Alex helped Jo with the bridge proposal.", "Jo helped Alex with the bridge proposal."],
  ["The train left at 10:30, not 11:30.", "The train left at 11:30, not 10:30."],
  ["我今天觉得演示准备得很充分，已经把所有幻灯片都检查过了。", "我今天没有觉得演示准备得很充分，已经把所有幻灯片都检查过了。"],
  ["I met US colleagues after the meeting.", "I met us colleagues after the meeting."]
];
for (const [i, pair] of pairs.entries()) test(`exact dedup preserves changed negation, scope, actor, quantity or case ${i + 1}`, () => {
  const args = input(pair.map((text, i) => row(i + 1, text)), { locale: i === 5 ? "zh-Hans" : "en" });
  const selected = checked(args);
  assert.equal(selected.selectedCount, 2);
  assert.deepEqual(selected.evidence.map(e => e.summary), pair);
});
test("V1 and old V2 lose the near-identical negated correction; corrected V2 retains it", () => {
  const args = input(pairs[0].map((text, i) => row(i + 1, text)));
  assert.equal(selectReportEvidence(args).selectedCount, 1); assert.equal(previousV2(args).selectedCount, 1);
  assert.equal(checked(args).selectedCount, 2);
});
test("same-source repetitions and normalized exact text copies dedup without rewriting selected evidence", () => {
  const a = row(1, "Café notes\n on the bridge proposal."), b = row(2, "Cafe\u0301 notes on the bridge proposal.");
  const c = row(3, "Mina read the bridge proposal and asked about the cost.");
  const selected = checked(input([a, { ...a, similarity: -0.1 }, b, c]));
  assert.equal(selected.selectedCount, 2); assert.equal(selected.deduplicatedCount, 2);
  assert.ok(selected.evidence.some(e => e.summary === a.summary));
});
test("contradictory versions of one source ID fail closed rather than select a stale payload", () => {
  const a = row(1, pairs[0][0]);
  for (const other of [{ ...a, summary: pairs[0][1] }, { ...a, id: "synthetic-other-memory" }, { ...a, topics: ["other"] }]) {
    assert.throws(() => selectWeeklyEvidenceV2(input([a, other])), { code: "REPORT_SOURCE_STALE" });
  }
});
test("backfill rejects unrelated same-topic padding before a lower-ranked meaningful follow-up", () => {
  const args = input([
    row(1, "I sent the bridge proposal to Mina.", { similarity: 0.9 }),
    row(2, "Mina marked the cost section in the bridge proposal.", { similarity: 0.8 }),
    row(3, "An unrelated coupon arrived in my mailbox.", { similarity: 0.7, importanceScore: 1 }),
    row(4, "I rewrote the bridge proposal using Mina's cost notes.", { similarity: 0.6 })
  ], { limits: { ...REPORT_EVIDENCE_LIMITS.WEEKLY, maxEvidence: 3 } });
  assert.ok(previousV2(args).evidence.some(e => e.sourceMemoryId === args.candidates[2].id));
  const selected = checked(args);
  assert.equal(selected.selectedCount, 3);
  assert.ok(selected.evidence.some(e => e.sourceMemoryId === args.candidates[3].id));
  assert.ok(!selected.evidence.some(e => e.sourceMemoryId === args.candidates[2].id));
});
test("spare capacity alone, time words and a shared topic do not justify unrelated records", () => {
  const selected = checked(input([row(1, "Today I sent Mina the bridge proposal."),
    row(2, "Today Mina read the bridge proposal."), row(3, "Today I bought tea and went home.")]));
  assert.equal(selected.selectedCount, 2);
});
test("reordered known sentences do not pad backfill; a negated correction remains new evidence", () => {
  const args = input([row(1, "I revised the bridge proposal. The cost example is clear."),
    row(2, "Mina reviewed the bridge proposal. She marked the cost section."),
    row(3, "The cost example is clear. I revised the bridge proposal."),
    row(4, "The cost example is not clear. I revised the bridge proposal.")]);
  const selected = checked(args);
  assert.equal(selected.selectedCount, 3);
  assert.ok(selected.evidence.some(e => e.sourceMemoryId === args.candidates[3].id));
  assert.ok(!selected.evidence.some(e => e.sourceMemoryId === args.candidates[2].id));
});
test("additions cannot create a transitive chain into unrelated material", () => {
  const selected = checked(input([row(1, "I sent Mina the bridge proposal."),
    row(2, "Mina reviewed the bridge proposal and its cost."),
    row(3, "In the bridge proposal I added river stones beside the path."),
    row(4, "I collected river stones for an unrelated aquarium.")]));
  assert.equal(selected.selectedCount, 3);
});
test("Simplified Chinese content words support backfill without treating weekday/function words as evidence", () => {
  const selected = checked(input([row(1, "周一做的碗，碗口还不太平。"), row(2, "周三老师看了碗，碗口还是不太平。"),
    row(3, "又看了碗，我喜欢那个不太平的碗口，还没烧。"), row(4, "周三在家喝茶，后来又去买水果。")], { locale: "zh-Hans" }));
  assert.equal(selected.selectedCount, 3);
});
test("distinct contradictory experiences and unfinished outcomes remain verbatim", () => {
  const rows = [row(1, "I accepted the bridge proposal and felt excited about its cost plan."),
    row(2, "Mina explained the bridge proposal cost plan."), row(3, "I rejected the bridge proposal cost plan after finding the missing fees.")];
  const selected = checked(input(rows));
  assert.equal(selected.selectedCount, 3); assert.deepEqual(selected.evidence.map(e => e.summary), rows.map(e => e.summary));
});
test("brief negated corrections are not mistaken for unrelated one-word follow-ups", () => {
  for (const [locale, positive, negative] of [["en", "I am happy.", "I am not happy."],
    ["en", "I can draw.", "I can't draw."], ["zh-Hans", "我觉得开心。", "我没有觉得开心。"]]) {
    const selected = checked(input([row(1, positive), row(2, "A separate errand was recorded."), row(3, negative)], { locale }));
    assert.equal(selected.selectedCount, 3);
    assert.ok(selected.evidence.some(e => e.summary === negative));
  }
});
test("a full initial diversity allocation is preserved; empty topics do not create inferred relatedness", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row(i, `${String.fromCharCode(65 + i).repeat(20)} distinct note.`, { topics: [] }));
  const args = input(rows); assert.deepEqual(checked(args), selectReportEvidence(args));
});
test("half-open window, invalid dates, missing IDs and Journal exclusion remain in effect", () => {
  const args = input([row(1, "A start note.", { eventDate: new Date(period.periodStartUtc) }),
    row(2, "A final note.", { eventDate: new Date("2026-09-20T23:59:59.999Z") }),
    row(3, "Outside.", { eventDate: new Date(period.periodEndUtc) }), row(4, "Invalid.", { eventDate: new Date("invalid") }),
    row(5, "Not an Event.", { memoryType: "JOURNAL" }), row(6, "No memory.", { id: "" })]);
  assert.equal(checked(args).selectedCount, 2);
});
test("owner, source opt-out, invalid rank, timezone, type and widened limits fail closed", () => {
  for (const change of [{ ownerId: undefined }, { ownerId: "synthetic-other-owner" }, { memoryProcessingAllowed: false }]) {
    assert.throws(() => selectWeeklyEvidenceV2(input([row(1, "A synthetic note.", change)])), { code: "AI_FORBIDDEN" });
  }
  for (const change of [{ reportType: "MONTHLY" }, { timezone: "invalid-zone" }, { periodEndUtc: "invalid" },
    { candidates: [row(1, "A note.", { similarity: NaN })] },
    ...[{ maxEvidence: 9 }, { maxContextCharacters: 4001 }, { candidateTake: 33 }, { maxPerTheme: 3 }, { minimumEvidence: 1 }]
      .map(limits => ({ limits: { ...REPORT_EVIDENCE_LIMITS.WEEKLY, ...limits } }))]) {
    assert.throws(() => selectWeeklyEvidenceV2(input([], change)), { code: "REPORT_NARRATIVE_INVALID_INPUT" });
  }
});
test("sparse weeks preserve minimum eligibility and stay short without capacity padding", () => {
  for (const count of [0, 1, 2]) {
    const selected = checked(input([row(1, "Returned a library book.", { topics: [] }), row(2, "Sat beside the window with tea.", { topics: [] })].slice(0, count)));
    assert.equal(selected.selectedCount, count); assert.equal(selected.status, count < 2 ? "INSUFFICIENT_EVIDENCE" : "READY");
  }
});
test("character and Unicode-heavy byte admission cannot evict initial sources for enrichment", () => {
  for (const locale of ["en", "zh-Hans"]) {
    const topics = Array.from({ length: 10 }, (_, j) => `${j}${"界".repeat(39)}`);
    const rows = Array.from({ length: 7 }, (_, i) => row(i, `Bridge proposal ${String.fromCharCode(65 + i).repeat(310)}.`, { topics }));
    const args = input(rows, { locale }); const selected = checked(args);
    assert.ok(selected.selectedCount < 7); assert.ok(selected.evidence.some(e => e.sourceMemoryId === rows[0].id));
    assert.ok(selected.evidence.some(e => e.sourceMemoryId === rows[1].id));
    assert.equal(assertBounds(args, selected).actual.packet.evidence.length, selected.selectedCount);
  }
  const args = input([row(1, "Bridge proposal " + "a".repeat(185)), row(2, "Bridge proposal " + "b".repeat(185)),
    row(3, "Bridge proposal revised.")], { limits: { ...REPORT_EVIDENCE_LIMITS.WEEKLY, maxContextCharacters: 500 } });
  assert.ok(checked(args).contextCharacters <= 500);
});

// Load the trusted pinned implementation as an independent reference; no provider
// or private data access. All relative imports point to unchanged local helpers.
async function pinnedService(t) {
  const source = execFileSync("git", ["show", "171dbd555355934b19fb63b1b201db2d1c296a61:lib/report-foundation.js"], { encoding: "utf8" });
  const root = new URL("../../", import.meta.url), dir = mkdtempSync(path.join(tmpdir(), "petalpal-selector-parity-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const rewritten = source.replace(/from "(\.\/[^"\n]+)"/gu, (_, specifier) => `from "${new URL(`lib/${specifier.slice(2)}`, root).href}"`);
  const file = path.join(dir, "pinned.mjs"); writeFileSync(file, rewritten);
  return (await import(pathToFileURL(file).href)).ReportInputService;
}
function serviceFixture(c, flag, Constructor = ReportInputService) {
  const rows = c.args.candidates.map(candidate => ({ id: candidate.sourceEventId, ownerId: owner,
    occurredAt: candidate.eventDate, updatedAt: new Date("2026-09-21"), memoryProcessingAllowed: true,
    memory: { ...candidate, updatedAt: new Date("2026-09-21"), embeddingInputRevision: 1,
      embeddingStatus: "GENERATED", embeddedInputRevision: 1 } }));
  const state = { consent: true, retrievals: 0, sourceReads: 0, mutate: candidates => candidates };
  const prisma = { user: { async findUnique() { return { timezone: "UTC", preferredLocale: c.locale }; } },
    aiConsent: { async findUnique() { return { aiProcessing: state.consent, personalization: state.consent,
      memoryEnabled: state.consent, updatedAt: new Date("2026-09-01") }; } },
    event: { async findMany({ where }) { state.sourceReads++; return rows.filter(row => row.ownerId === where.ownerId && row.memoryProcessingAllowed &&
      +row.occurredAt >= +where.occurredAt.gte && +row.occurredAt < +where.occurredAt.lt); } } };
  const env = flag === undefined ? {} : { AI_WEEKLY_EVIDENCE_SELECTOR_V2: flag, AI_WEEKLY_REFLECTION_CONTRACT: "weekly-reflection-v2" };
  const service = new Constructor({ prisma, env, localizedWeekly: true, localizedMonthly: true,
    semanticRetrieval: { async retrieve({ dateFrom, dateTo }) { state.retrievals++;
      return state.mutate(c.args.candidates.filter(row => +row.eventDate >= +dateFrom && +row.eventDate < +dateTo)); } } });
  return { state, rows, service,
    weekly: () => service.buildWeeklyInput({ identity: { userId: owner }, localDate: period.periodKey, asOf: new Date("2026-09-22") }),
    monthly: () => service.buildMonthlyInput({ identity: { userId: owner }, year: 2026, month: 9, asOf: new Date("2026-10-02") }) };
}
test("default-OFF and explicit false match pinned Weekly input and packets on all 28 frozen cases", async t => {
  const Pinned = await pinnedService(t);
  for (const c of frozenInputs()) await t.test(`${c.id}/${c.locale}`, async () => {
    const prior = await serviceFixture(c, undefined, Pinned).weekly();
    for (const flag of [undefined, "false"]) {
      const current = await serviceFixture(c, flag).weekly(); assert.deepEqual(current, prior);
      assert.deepEqual(assertBounds(c.args, current.evidenceSelection).actual, assertBounds(c.args, prior.evidenceSelection).actual);
    }
  });
});
test("flag ON routes the actual input service to corrected V2 in both locales without altering retrieval", async () => {
  for (const c of frozenInputs()) {
    const f = serviceFixture(c, "true"), result = await f.weekly();
    assert.deepEqual(result.evidenceSelection, selectWeeklyEvidenceV2(c.args));
    assert.equal(f.state.retrievals, c.locale === "en" ? 1 : 0);
  }
});
test("invalid flag values fail closed; revoked consent stops all source access", async () => {
  const c = frozenInputs()[0];
  for (const value of ["TRUE", "1", "", true]) {
    const f = serviceFixture(c, value); await assert.rejects(f.weekly, { code: "AI_GATEWAY_CONFIG_INVALID" }); assert.equal(f.state.retrievals, 0);
  }
  const f = serviceFixture(c, "true"); f.state.consent = false;
  await assert.rejects(f.weekly, { code: "AI_FORBIDDEN" }); assert.equal(f.state.sourceReads, 0); assert.equal(f.state.retrievals, 0);
  const incompatible = serviceFixture(c, "true"); incompatible.service.weeklyReflectionContract = "weekly-reflection-v1";
  await assert.rejects(incompatible.weekly, { code: "AI_GATEWAY_CONFIG_INVALID" }); assert.equal(incompatible.state.retrievals, 0);
});
test("flag ON refuses stale/forged retrieval content before it becomes provider evidence", async () => {
  for (const mutation of [row => ({ ...row, summary: "Forged synthetic content." }), row => ({ ...row, ownerId: "synthetic-other-owner" }),
    row => ({ ...row, id: "synthetic-stale-memory" }), row => ({ ...row, topics: ["forged"] }), row => ({ ...row, importanceScore: 1 })]) {
    const f = serviceFixture(frozenInputs()[0], "true"); f.state.mutate = rows => rows.map(mutation);
    await assert.rejects(f.weekly, { code: "REPORT_SOURCE_STALE" });
  }
});
test("Monthly input matches pinned implementation with OFF, ON and invalid Weekly-only flag values", async t => {
  const Pinned = await pinnedService(t);
  for (const c of frozenInputs().filter(c => c.id === "Q01")) {
    const prior = await serviceFixture(c, undefined, Pinned).monthly();
    for (const flag of [undefined, "false", "true", "invalid"]) assert.deepEqual(await serviceFixture(c, flag).monthly(), prior);
  }
});
test("unlocalized legacy Weekly selection ignores the new flag and matches the pinned route", async t => {
  const Pinned = await pinnedService(t), c = frozenInputs()[0];
  const prior = serviceFixture(c, undefined, Pinned); prior.service.localizedWeekly = false;
  const expected = await prior.weekly();
  for (const flag of ["true", "invalid"]) {
    const current = serviceFixture(c, flag); current.service.localizedWeekly = false;
    assert.deepEqual(await current.weekly(), expected);
  }
});
test("three-way frozen comparison retains all meaningful follow-ups without old V2 routine padding", () => {
  const results = compare();
  assert.deepEqual(results.editorial, { original: { evidence: 44, meaningful: 22, followups: 0 },
    v2: { evidence: 56, meaningful: 32, followups: 10 }, corrected: { evidence: 54, meaningful: 32, followups: 10 } });
  assert.deepEqual(results.semantic.original, results.semantic.corrected);
});
