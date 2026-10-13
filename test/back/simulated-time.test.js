// T01 server gate + fixture-manifest self-checks. Pure: no database, network or provider.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { localDateForInstant, monthlyPeriodFor, previousMonthlyPeriod, previousWeeklyPeriod, weeklyPeriodForLocalDate } from "../../lib/ai-periods.js";
import { createProductionEmbeddingProvider } from "../../lib/embedding-provider.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY, TEST_EMBEDDING_384_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import { buildMonthlyReport, buildWeeklyReport, REPORT_EVIDENCE_LIMITS, selectReportEvidence } from "../../lib/report-foundation.js";
import { PrismaEventEmbeddingRepository } from "../../lib/semantic-retrieval.js";
import { parseSimulatedTime, simulatedTimeDenial } from "../../lib/simulated-time.js";
import { mockThemes, mockThemeVector, TemplateMockNarrativeProvider, ThemeMockEmbeddingProvider } from "../fixtures/ai-e2e-harness.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../fixtures/ai-e2e-manifest.json", import.meta.url), "utf8"));
const isolated = Object.freeze({
  PETALPAL_SIMULATED_TIME: "1",
  NODE_ENV: "test",
  DEV_DATABASE_URL: "postgresql://ci:ci-disposable@127.0.0.1:5432/petalpal_ai_e2e_test",
  FIREBASE_PROJECT_ID: "petalpal-ai-e2e-test",
  AI_ASYNC_EXECUTION_MODE: "manual",
  PETALPAL_SIMULATED_TIME_EMAILS: "fx-owner-a@example.test, fx-owner-b@example.test"
});
const allowedIdentity = Object.freeze({ email: "FX-Owner-A@example.test", emailVerified: true });

test("T01 gate: only an explicitly isolated local/ephemeral runtime with an allowlisted verified identity passes", () => {
  assert.equal(simulatedTimeDenial({ env: isolated, firebase: allowedIdentity }), null);
  const cases = [
    [{ PETALPAL_SIMULATED_TIME: undefined }, "DISABLED"],
    [{ PETALPAL_SIMULATED_TIME: "true" }, "DISABLED"],
    [{ NODE_ENV: "production" }, "PRODUCTION_RUNTIME"],
    // A production-shaped process stays closed even if every test flag is mistakenly set.
    [{ NODE_ENV: "production", DATABASE_URL: "postgres://user:pw@db.prisma.io:5432/postgres?sslmode=require", DEV_DATABASE_URL: undefined }, "PRODUCTION_RUNTIME"],
    [{ PETALPAL_ENVIRONMENT: "integration" }, "HOSTED_RUNTIME"],
    [{ RENDER: "true" }, "HOSTED_RUNTIME"],
    [{ RENDER_EXTERNAL_URL: "https://petalpal-backend-test.onrender.com" }, "HOSTED_RUNTIME"],
    [{ NATIVE_SECURITY_TEST: "1" }, "OTHER_TEST_HARNESS"],
    [{ DEV_DATABASE_URL: undefined }, "DATABASE_NOT_ISOLATED"],
    [{ DEV_DATABASE_URL: "postgresql://ci:ci@db.prisma.io:5432/petalpal_test" }, "DATABASE_NOT_ISOLATED"],
    [{ DEV_DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/petalpal_dev" }, "DATABASE_NOT_ISOLATED"],
    [{ DATABASE_URL: isolated.DEV_DATABASE_URL }, "DATABASE_NOT_ISOLATED"],
    [{ FIREBASE_PROJECT_ID: undefined }, "FIREBASE_NOT_ISOLATED"],
    [{ FIREBASE_PROJECT_ID: "petalpal-b212c" }, "FIREBASE_NOT_ISOLATED"],
    [{ AI_ASYNC_EXECUTION_MODE: "shadow" }, "ASYNC_DISPATCH_ENABLED"],
    [{ AI_ASYNC_EXECUTION_MODE: "cloudflare_queue" }, "ASYNC_DISPATCH_ENABLED"],
    [{ AI_ASYNC_EXECUTION_MODE: "unknown" }, "ASYNC_DISPATCH_ENABLED"],
    [{ PETALPAL_SIMULATED_TIME_EMAILS: undefined }, "IDENTITY_NOT_ALLOWED"]
  ];
  for (const [override, reason] of cases) {
    const env = { ...isolated, ...override };
    for (const key of Object.keys(override)) if (override[key] === undefined) delete env[key];
    assert.equal(simulatedTimeDenial({ env, firebase: allowedIdentity }), reason, JSON.stringify(Object.keys(override)));
  }
  for (const firebase of [null, {}, { email: "fx-owner-d@example.test", emailVerified: true }, { email: "fx-owner-a@example.test", emailVerified: false }]) {
    assert.equal(simulatedTimeDenial({ env: isolated, firebase }), "IDENTITY_NOT_ALLOWED");
  }
  assert.equal(simulatedTimeDenial({ env: {}, firebase: allowedIdentity }), "DISABLED");
});

test("T01 parser: date-only is owner-local midday; UTC instants are exact; everything else is rejected", () => {
  const zone = manifest.timezone;
  assert.equal(parseSimulatedTime("2026-10-08", zone).toISOString(), "2026-10-08T19:00:00.000Z");
  assert.equal(localDateForInstant(parseSimulatedTime("2026-10-08", zone), zone), "2026-10-08");
  assert.equal(localDateForInstant(parseSimulatedTime("2026-11-01", zone), zone), "2026-11-01", "DST end day stays on its local date");
  assert.equal(parseSimulatedTime("2026-10-12T06:45:00.000Z", zone).toISOString(), "2026-10-12T06:45:00.000Z");
  assert.equal(parseSimulatedTime("2026-10-12T06:45Z").toISOString(), "2026-10-12T06:45:00.000Z");
  for (const value of ["2026-02-30", "2026-02-30T00:00:00Z", "2026-13-01T00:00Z", "2026-10-08T19:00:00+02:00",
    "2026-10-08T19:00:00", "1999-12-31", "2100-01-01T00:00:00Z", "", " ", "tomorrow", undefined, 1760000000000]) {
    assert.throws(() => parseSimulatedTime(value, zone), (error) => error.code === "INVALID_SIMULATED_TIME", String(value));
  }
  assert.throws(() => parseSimulatedTime("2026-10-08", "Not/AZone"), (error) => error.code === "INVALID_SIMULATED_TIME");
  assert.throws(() => parseSimulatedTime("2026-10-08", undefined), (error) => error.code === "INVALID_SIMULATED_TIME");
});

test("injected report clock is validated and refused in any production process", () => {
  const prisma = {};
  const embeddingProvider = new ThemeMockEmbeddingProvider();
  assert.throws(() => createProductionAiWorker({ prisma, embeddingProvider, reportAsOf: "2026-10-12T19:00:00Z" }), /valid Date/);
  assert.throws(() => createProductionAiWorker({ prisma, embeddingProvider, reportAsOf: new Date("invalid") }), /valid Date/);
  assert.ok(createProductionAiWorker({ prisma, embeddingProvider, reportAsOf: new Date("2026-10-12T19:00:00Z") }));
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => createProductionAiWorker({ prisma, reportAsOf: new Date("2026-10-12T19:00:00Z") }), /unavailable in production/);
    assert.ok(createProductionAiWorker({ prisma }), "production worker without an injected clock is unchanged");
    assert.throws(() => createProductionAiWorker({ prisma, embeddingProvider }), /384-dimensional/, "TEST_ONLY vectors cannot be stored by a production process");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("TEST-only 384d embedding profile is isolated from production selection and storage", () => {
  const profile = getEmbeddingProfile(TEST_EMBEDDING_384_PROFILE_KEY);
  assert.deepEqual([profile.environment, profile.dimensions, profile.inputVersion], ["TEST_ONLY", 384, "summary-v1"]);
  assert.notEqual(PRODUCTION_EMBEDDING_PROFILE_KEY, TEST_EMBEDDING_384_PROFILE_KEY);
  assert.equal(createProductionEmbeddingProvider({ env: {} }).describeProfile().profileKey, PRODUCTION_EMBEDDING_PROFILE_KEY);
  assert.equal(new PrismaEventEmbeddingRepository({}, TEST_EMBEDDING_384_PROFILE_KEY).legacyLocalProfile, false);
  assert.throws(() => new PrismaEventEmbeddingRepository({}, "test-deterministic-v1"), /384-dimensional/);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => new PrismaEventEmbeddingRepository({}, TEST_EMBEDDING_384_PROFILE_KEY), /384-dimensional/);
    assert.ok(new PrismaEventEmbeddingRepository({}));
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

// Manifest self-checks use the real period, aggregate and evidence-selection code
// with MOCK vectors in memory. They validate the fixture expectations only; the
// pgvector suite (ai-e2e.postgres.test.js) is the executable acceptance.
const owners = Object.fromEntries(manifest.owners.map((owner) => [owner.key, owner]));
const inPeriod = (event, period) => event.occurredAtUtc >= period.startUtc && event.occurredAtUtc < period.endUtc;
const candidate = (event) => ({ id: `memory-${event.ref}`, ownerId: owners[event.owner].id, sourceEventId: event.ref,
  summary: event.content, eventDate: event.occurredAtUtc, memoryType: "EVENT", topics: [], importanceScore: null });
const cosine = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
function retrieve({ owner, query, period = null, take, embedded = (event) => event.ref !== "b02" }) {
  const vector = mockThemeVector(query);
  return manifest.events.filter((event) => event.owner === owner && embedded(event) && (!period || inPeriod(event, manifest.periods[period])))
    .map((event) => ({ ...candidate(event), similarity: cosine(vector, mockThemeVector(event.content)) }))
    .sort((left, right) => right.similarity - left.similarity || left.eventDate.localeCompare(right.eventDate) || left.id.localeCompare(right.id))
    .slice(0, take);
}

test("fixture manifest: local dates, period boundaries and membership match the real period code", () => {
  const zone = manifest.timezone;
  for (const [key, period] of Object.entries(manifest.periods)) {
    const actual = period.type === "WEEKLY"
      ? weeklyPeriodForLocalDate(period.periodKey, zone)
      : monthlyPeriodFor({ year: Number(period.periodKey.slice(0, 4)), month: Number(period.periodKey.slice(5)), timezone: zone });
    assert.deepEqual([actual.periodStartUtc.toISOString(), actual.periodEndUtc.toISOString()], [period.startUtc, period.endUtc], key);
  }
  assert.equal(new Set(manifest.events.map((event) => event.ref)).size, manifest.events.length);
  for (const event of manifest.events) {
    assert.equal(localDateForInstant(event.occurredAtUtc, zone), event.localDate, event.ref);
    const membership = Object.keys(manifest.periods).filter((key) => inPeriod(event, manifest.periods[key])).sort();
    assert.deepEqual(membership, [...event.membership].sort(), event.ref);
    assert.ok(mockThemes(event.content).includes(event.theme), `${event.ref} MOCK theme`);
  }
  for (const [owner, count] of Object.entries(manifest.expected.flowers)) {
    assert.equal(manifest.events.filter((event) => event.owner === owner && event.mood).length, count, owner);
  }
});

function expectedReport(type, key, expected) {
  const period = manifest.periods[key];
  const owner = owners[expected.owner];
  const zone = manifest.timezone;
  const actual = type === "WEEKLY" ? weeklyPeriodForLocalDate(period.periodKey, zone)
    : monthlyPeriodFor({ year: Number(period.periodKey.slice(0, 4)), month: Number(period.periodKey.slice(5)), timezone: zone });
  const previous = type === "WEEKLY" ? previousWeeklyPeriod(actual)
    : previousMonthlyPeriod({ year: Number(period.periodKey.slice(0, 4)), month: Number(period.periodKey.slice(5)), timezone: zone });
  const ownerEvents = manifest.events.filter((event) => event.owner === expected.owner);
  const within = (window) => ownerEvents.filter((event) => event.occurredAtUtc >= window.periodStartUtc.toISOString() && event.occurredAtUtc < window.periodEndUtc.toISOString())
    .map((event) => ({ id: event.ref, ownerId: owner.id }));
  const build = type === "WEEKLY" ? buildWeeklyReport : buildMonthlyReport;
  const aggregates = build({ identity: { userId: owner.id }, ...actual, asOf: new Date(manifest.clocks[expected.clock]), status: "COMPLETE",
    currentEvents: within(actual), previousEvents: within(previous) });
  const candidates = retrieve({ owner: expected.owner, query: "Meaningful events, changes, progress, challenges, and repeated themes.",
    period: key, take: REPORT_EVIDENCE_LIMITS[type].candidateTake });
  const selection = selectReportEvidence({ identity: { userId: owner.id }, candidates, periodStartUtc: actual.periodStartUtc,
    periodEndUtc: actual.periodEndUtc, limits: REPORT_EVIDENCE_LIMITS[type] });
  return { aggregates, selection };
}

test("fixture manifest: expected Weekly/Monthly counts, comparisons, evidence and citations", async () => {
  for (const [type, group] of [["WEEKLY", manifest.expected.weekly], ["MONTHLY", manifest.expected.monthly]]) {
    for (const [key, expected] of Object.entries(group)) {
      const { aggregates, selection } = expectedReport(type, key, expected);
      assert.equal(aggregates.eventCount, expected.eventCount, key);
      if (expected.previousEventCount !== undefined) {
        assert.equal(aggregates.trendSignals.previousEventCount, expected.previousEventCount, key);
        assert.equal(aggregates.trendSignals.eventCountChange, expected.eventCountChange, key);
      }
      assert.equal(selection.candidateCount, expected.candidateCount, key);
      assert.deepEqual(selection.evidence.map((item) => item.sourceEventId).sort(), [...expected.selectedRefs].sort(), key);
      assert.equal(selection.status, expected.narrativeStatus === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "READY", key);
      for (const ref of expected.excludedRefs || []) assert.ok(!expected.selectedRefs.includes(ref), `${key} excludes ${ref}`);
      if (selection.status === "READY") {
        const narrative = new TemplateMockNarrativeProvider();
        const output = await narrative.generateNarrative({ report: { allowedSectionKinds: ["k1", "k2", "k3"],
          selectedEvidence: selection.evidence, aggregates: { eventCount: aggregates.eventCount } } });
        const cited = output.sections.flatMap((section) => section.evidenceRefs.map((ref) => ref.sourceEventId));
        assert.deepEqual([...new Set(cited)].sort(), [...expected.citedRefs].sort(), `${key} MOCK citations`);
      }
    }
  }
});

test("fixture manifest: MOCK retrieval expectations are owner/window scoped and need generated embeddings", () => {
  for (const [name, expected] of Object.entries(manifest.expected.retrieval)) {
    const rows = retrieve(expected);
    assert.deepEqual(rows.map((row) => row.sourceEventId).sort(), [...expected.refs].sort(), name);
    const next = retrieve({ ...expected, take: expected.take + 1 })[expected.take];
    if (next) assert.ok(rows.at(-1).similarity - next.similarity > 0.5, `${name} has a clear MOCK theme margin`);
  }
  const vector = mockThemeVector("anything");
  assert.equal(vector.length, 384);
  assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-9);
});
