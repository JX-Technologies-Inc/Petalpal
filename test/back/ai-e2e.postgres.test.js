// PetalPal AI E2E acceptance T01-T09 against an EPHEMERAL pgvector PostgreSQL.
//
// Runs only with PETALPAL_AI_E2E=1 (see .github/workflows/ai-e2e-postgres.yml).
// Refuses to start unless the server simulated-time gate passes and the target
// database contains no non-fixture users.
//
// REAL components: Express routes, auth middleware (token verifier stubbed),
// simulated-time gate, Prisma + PostgreSQL + pgvector SQL, Event/Flower creation,
// AiJob enqueue/claim/lease, memory extraction, embedding storage, semantic
// retrieval SQL, evidence selection, narrative validation, report write fence,
// AiEvidence persistence, AI cost gate, consent revocation and report APIs.
// MOCK components: Firebase token verifier, 384d lexical-theme embedding
// provider, template narrative provider. MOCK retrieval is plumbing evidence,
// never proof of semantic relevance. Inference calls: 0. Cost: $0.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const enabled = process.env.PETALPAL_AI_E2E === "1";
const e2e = enabled ? test : test.skip;
const manifest = JSON.parse(fs.readFileSync(new URL("../fixtures/ai-e2e-manifest.json", import.meta.url), "utf8"));
const owners = Object.fromEntries(manifest.owners.map((owner) => [owner.key, owner]));
const fixtureOwnerIds = manifest.owners.map((owner) => owner.id);
const CLK = manifest.clocks;
const evidence = [];

let m = null;
if (enabled) {
  const [server, prismaModule, auth, worker, jobs, costGate, retrieval, foundation, narrative, simulated, harness] = await Promise.all([
    import("../../server.js"), import("../../lib/prisma.js"), import("../../lib/auth.js"), import("../../lib/ai-worker.js"),
    import("../../lib/ai-jobs.js"), import("../../lib/ai-cost-gate.js"), import("../../lib/semantic-retrieval.js"),
    import("../../lib/report-foundation.js"), import("../../lib/report-narrative.js"), import("../../lib/simulated-time.js"),
    import("../fixtures/ai-e2e-harness.js")
  ]);
  m = { ...server, ...auth, ...worker, ...jobs, ...costGate, ...retrieval, ...foundation, ...narrative, ...simulated, ...harness, prisma: prismaModule.default };
}

const state = { baseUrl: null, server: null, events: new Map(), flowers: new Map(), memories: new Map(), reports: {} };
let embedding;
let narrativeProvider;
let activeNarrative;
const retrievalLog = [];
const factoryCalls = [];

function record(entry) {
  evidence.push({ provider: "MOCK", timezone: manifest.timezone, inferenceCalls: 0, permittedCostUsd: 0, ...entry });
}

async function api(path, { owner = "A", method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${owners[owner].token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

const ref = (eventId) => [...state.events].find(([, id]) => id === eventId)?.[0] ?? `unknown:${eventId}`;
const refs = (eventIds) => eventIds.map(ref).sort();
const sorted = (values) => [...values].sort();

function workerFor({ reportAsOf = null, provider = activeNarrative } = {}) {
  const real = new m.SemanticEventRetrievalService({ prisma: m.prisma, provider: embedding });
  return m.createProductionAiWorker({
    prisma: m.prisma,
    embeddingProvider: embedding,
    reportNarrativeProvider: provider,
    // Real retrieval; the wrapper only records counts for the evidence log.
    semanticRetrieval: { async retrieve(args) {
      const rows = await real.retrieve(args);
      retrievalLog.push({ ownerId: args.identity.userId, count: rows.length, eventIds: rows.map((row) => row.sourceEventId),
        dateFrom: args.dateFrom?.toISOString?.() ?? null, dateTo: args.dateTo?.toISOString?.() ?? null });
      return rows;
    } },
    costGate: new m.PrismaAiCostGate(m.prisma, { env: {} }),
    reportAsOf,
    logger: { error() {} }
  });
}

async function runJobs(jobType, where = {}) {
  const pending = await m.prisma.aiJob.findMany({
    where: { ownerId: { in: fixtureOwnerIds }, jobType, status: "PENDING", ...where }, orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const worker = workerFor();
  const results = [];
  for (const job of pending) results.push(await worker.runJob({ jobId: job.id, ownerId: job.ownerId, jobType }));
  return { pending, results };
}

async function evidenceFor(field, reportId) {
  return m.prisma.aiEvidence.findMany({ where: { [field]: reportId }, orderBy: { sourceEventId: "asc" } });
}

e2e("T00 preflight: isolated gate, empty non-fixture database, pgvector, fixture owners", async () => {
  const gate = m.simulatedTimeDenial({ firebase: { email: owners.A.email, emailVerified: true } });
  assert.equal(gate, null, `simulated-time gate must pass in the ephemeral runtime (reason: ${gate})`);
  assert.equal(m.simulatedTimeDenial({ firebase: { email: owners.D.email, emailVerified: true } }), "IDENTITY_NOT_ALLOWED");
  const foreignUsers = await m.prisma.user.count({ where: { NOT: { id: { startsWith: "fx-" } } } });
  assert.equal(foreignUsers, 0, "refusing to run: database contains non-fixture users");
  const [vector] = await m.prisma.$queryRawUnsafe(`SELECT count(*)::int AS "count" FROM pg_extension WHERE extname = 'vector'`);
  assert.equal(vector.count, 1);
  // Idempotent rerun on the same ephemeral database: remove only fixture rows.
  await m.prisma.user.deleteMany({ where: { id: { in: fixtureOwnerIds } } });
  await m.prisma.auditEvent.deleteMany({ where: { actorUserId: { in: fixtureOwnerIds } } });
  for (const owner of manifest.owners) {
    await m.prisma.user.create({ data: { id: owner.id, name: owner.id, email: owner.email, firebaseUid: owner.firebaseUid,
      timezone: manifest.timezone, preferredLocale: "en" } });
    await m.prisma.aiConsent.create({ data: { userId: owner.id, termsVersion: "2026-08-25", aiProcessing: true,
      personalization: true, memoryEnabled: true, grantedAt: new Date() } });
  }
  m.setFirebaseTokenVerifierForTests(async (token) => {
    const owner = manifest.owners.find((candidate) => candidate.token === token);
    if (!owner) throw new Error("unknown fixture token");
    return { uid: owner.firebaseUid, email: owner.email, email_verified: true };
  });
  embedding = new m.ThemeMockEmbeddingProvider();
  narrativeProvider = new m.TemplateMockNarrativeProvider();
  activeNarrative = narrativeProvider;
  m.setWeeklyReportWorkerFactoryForTests((options = {}) => {
    factoryCalls.push(options);
    return workerFor({ reportAsOf: options.reportAsOf ?? null });
  });
  state.server = m.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => state.server.once("listening", resolve));
  state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
  const offset = (instant) => new Intl.DateTimeFormat("en-CA", { timeZone: manifest.timezone, timeZoneName: "longOffset" })
    .formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName").value;
  record({ testId: "T00", result: "PASS", runtime: { node: process.version, tzdata: process.versions.tz || null,
    vancouverOffset20261215: offset("2026-12-15T12:00:00Z") }, outputs: "gate open for fixture identity; no non-fixture users; pgvector present" });
});

e2e("T01 simulated Calendar/Event date: denied outside the gate, exact when allowed", async () => {
  const header = (value) => ({ [m.SIMULATED_TIME_HEADER]: value });
  const denied = [];
  denied.push((await api("/events", { owner: "D", method: "POST", headers: { "Idempotency-Key": "fx-ev-d-denied-v1", ...header("2026-10-08") },
    body: { content: "Not allowlisted", primaryGardenMood: "SUNNY_BLOOM" } })).status);
  for (const override of [{ PETALPAL_SIMULATED_TIME: "0" }, { PETALPAL_ENVIRONMENT: "integration" }, { FIREBASE_PROJECT_ID: "petalpal-b212c" }]) {
    const [key] = Object.keys(override);
    const previous = process.env[key];
    process.env[key] = override[key];
    try {
      denied.push((await api("/events", { method: "POST", headers: { "Idempotency-Key": `fx-ev-denied-${key}`, ...header("2026-10-08") },
        body: { content: "Denied", primaryGardenMood: "SUNNY_BLOOM" } })).status);
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
  assert.deepEqual(denied, [403, 403, 403, 403]);
  assert.equal((await api("/events", { method: "POST", headers: { "Idempotency-Key": "fx-ev-invalid-v1", ...header("2026-02-30") },
    body: { content: "Invalid", primaryGardenMood: "SUNNY_BLOOM" } })).status, 400);
  assert.equal((await api("/events", { method: "POST", headers: { "Idempotency-Key": "fx-ev-both-v1", ...header("2026-10-08") },
    body: { content: "Both", primaryGardenMood: "SUNNY_BLOOM", occurredAt: "2026-10-08T00:00:00Z" } })).status, 400);
  assert.equal(await m.prisma.event.count({ where: { ownerId: { in: fixtureOwnerIds } } }), 0, "denied requests created nothing");
  assert.equal(await m.prisma.flower.count({ where: { userId: { in: fixtureOwnerIds } } }), 0);
  record({ testId: "T01", clock: "header-controlled", result: "PASS", inputs: "4 denied contexts, invalid, ambiguous", outputs: { denied, eventsCreated: 0 } });
});

e2e("T02 one Event -> one Flower with the synthetic date, owner and idempotent replay", async () => {
  for (const event of manifest.events) {
    const owner = owners[event.owner];
    const response = await api("/events", { owner: event.owner, method: "POST",
      headers: { "Idempotency-Key": `fx-ev-${event.ref}-v1`, [m.SIMULATED_TIME_HEADER]: event.occurredAtUtc },
      body: { content: event.content, primaryGardenMood: event.mood } });
    assert.equal(response.status, 201, event.ref);
    assert.equal(response.body.event.ownerId, owner.id, event.ref);
    assert.equal(new Date(response.body.event.occurredAt).toISOString(), event.occurredAtUtc, event.ref);
    assert.equal(response.body.event.localDate, event.localDate, event.ref);
    assert.equal(response.body.flower?.sourceEventId, response.body.event.id, event.ref);
    assert.equal(response.body.flower.userId, owner.id, event.ref);
    assert.equal(response.body.memoryJob?.status, "PENDING", event.ref);
    state.events.set(event.ref, response.body.event.id);
    state.flowers.set(event.ref, response.body.flower.id);
  }
  for (const [key, count] of Object.entries(manifest.expected.flowers)) {
    assert.equal(await m.prisma.flower.count({ where: { userId: owners[key].id } }), count, `Flowers for ${key}`);
    assert.equal(await m.prisma.event.count({ where: { ownerId: owners[key].id } }), count, `Events for ${key}`);
  }
  const replay = await api("/events", { method: "POST", headers: { "Idempotency-Key": "fx-ev-a07-v1", [m.SIMULATED_TIME_HEADER]: "2026-10-07T02:00:00.000Z" },
    body: { content: manifest.events.find((event) => event.ref === "a07").content, primaryGardenMood: "FIRE_BLOOM" } });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.event.id, state.events.get("a07"));
  assert.equal(replay.body.flower.id, state.flowers.get("a07"));
  assert.equal((await api("/events", { method: "POST", headers: { "Idempotency-Key": "fx-ev-a07-v1" },
    body: { content: "Different content", primaryGardenMood: "FIRE_BLOOM" } })).status, 409);
  assert.equal(await m.prisma.flower.count({ where: { userId: owners.A.id } }), manifest.expected.flowers.A);
  record({ testId: "T02", clock: "per-fixture UTC instant", result: "PASS",
    outputs: { flowers: manifest.expected.flowers, replay: "same Event/Flower", conflict: 409 },
    refs: Object.fromEntries([...state.events].map(([key, id]) => [key, { eventId: id, flowerId: state.flowers.get(key) }])) });
});

e2e("T03 Event -> EventMemory -> TEST-only embedding lifecycle with job status and provenance", async () => {
  const memory = await runJobs("MEMORY_EXTRACTION");
  assert.equal(memory.pending.length, manifest.events.length);
  assert.ok(memory.results.every((result) => result.claimed && result.succeeded));
  for (const [key, eventId] of state.events) {
    const row = await m.prisma.eventMemory.findFirst({ where: { sourceEventId: eventId } });
    assert.ok(row, `memory for ${key}`);
    assert.equal(row.ownerId, owners[manifest.events.find((event) => event.ref === key).owner].id);
    state.memories.set(key, row.id);
  }
  const b02Memory = state.memories.get("b02");
  const embeddingRun = await runJobs("EMBEDDING_GENERATION", { NOT: { resourceId: b02Memory } });
  assert.equal(embeddingRun.pending.length, manifest.events.length - 1);
  assert.ok(embeddingRun.results.every((result) => result.claimed && result.succeeded));
  assert.equal(embedding.documentCalls, manifest.events.length - 1);
  const rows = await m.prisma.eventMemoryEmbedding.findMany({ where: { ownerId: { in: fixtureOwnerIds } },
    select: { eventMemoryId: true, profileKey: true, status: true, inputRevision: true } });
  assert.equal(rows.length, manifest.events.length - 1);
  assert.ok(rows.every((row) => row.profileKey === manifest.embeddingProfileKey && row.status === "GENERATED" && row.inputRevision === 1));
  assert.ok(!rows.some((row) => row.eventMemoryId === b02Memory));
  for (const ownerId of fixtureOwnerIds) {
    const [legacy] = await m.prisma.$queryRawUnsafe(`SELECT count(*)::int AS "count" FROM "EventMemory" WHERE "ownerId" = $1 AND "embedding" IS NOT NULL`, ownerId);
    assert.equal(legacy.count, 0, "MOCK vectors never use the legacy production column");
  }
  const statuses = await m.prisma.aiJob.groupBy({ by: ["jobType", "status"], where: { ownerId: { in: fixtureOwnerIds } }, _count: { _all: true } });
  const b02Job = await m.prisma.aiJob.findFirst({ where: { resourceId: b02Memory, jobType: "EMBEDDING_GENERATION" } });
  assert.equal(b02Job.status, "PENDING");
  record({ testId: "T03", clock: "real (job claims)", result: "PASS", embeddingProfile: manifest.embeddingProfileKey,
    outputs: { memoryJobs: memory.pending.length, embeddingsGenerated: rows.length, mockDocumentCalls: embedding.documentCalls,
      b02: "memory present, embedding job left PENDING", jobStatuses: statuses.map((item) => ({ jobType: item.jobType, status: item.status, count: item._count._all })) } });
});

e2e("T04 Weekly 2026-10-05: closure, boundaries, previous-week comparison, evidence and citations", async () => {
  const expected = manifest.expected.weekly["W-2026-10-05"];
  const period = manifest.periods["W-2026-10-05"];
  const open = await api("/ai/reports/weekly/trigger", { method: "POST", headers: { [m.SIMULATED_TIME_HEADER]: CLK.CLK_W_OPEN }, body: { localDate: "2026-10-08" } });
  assert.equal(open.status, 400);
  assert.equal(await m.prisma.aiJob.count({ where: { ownerId: owners.A.id, jobType: "WEEKLY_REPORT" } }), 0);
  const queriesBefore = embedding.queryCalls;
  const callsBefore = narrativeProvider.calls;
  const closed = await api("/ai/reports/weekly/trigger", { method: "POST", headers: { [m.SIMULATED_TIME_HEADER]: CLK.CLK_W }, body: { localDate: "2026-10-08" } });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.execution, "COMPLETED");
  assert.equal(closed.body.periodKey, period.periodKey);
  assert.equal(factoryCalls.at(-1).reportAsOf.toISOString(), new Date(CLK.CLK_W).toISOString());
  const report = await m.prisma.weeklyReport.findUnique({ where: { ownerId_periodKey: { ownerId: owners.A.id, periodKey: period.periodKey } } });
  assert.equal(report.periodStartUtc.toISOString(), period.startUtc);
  assert.equal(report.periodEndUtc.toISOString(), period.endUtc);
  assert.equal(report.asOf.toISOString(), new Date(CLK.CLK_W).toISOString());
  assert.equal(report.status, "COMPLETE");
  assert.equal(report.narrativeStatus, "GENERATED");
  assert.equal(report.eventCount, expected.eventCount);
  assert.equal(report.trendSignals.previousEventCount, expected.previousEventCount);
  assert.equal(report.trendSignals.eventCountChange, expected.eventCountChange);
  const retrieved = retrievalLog.at(-1);
  assert.deepEqual([retrieved.ownerId, retrieved.count, retrieved.dateFrom, retrieved.dateTo], [owners.A.id, expected.candidateCount, period.startUtc, period.endUtc]);
  assert.equal(embedding.queryCalls - queriesBefore, 1, "exactly one pgvector query embedding; no other retrieval path");
  assert.equal(narrativeProvider.calls - callsBefore, 1);
  const rows = await evidenceFor("weeklyReportId", report.id);
  assert.deepEqual(refs(rows.map((row) => row.sourceEventId)), sorted(expected.selectedRefs));
  assert.deepEqual(refs(rows.filter((row) => row.claimType === "NARRATIVE_CITED").map((row) => row.sourceEventId)), sorted(expected.citedRefs));
  assert.ok(rows.every((row) => row.ownerId === owners.A.id && row.sourceMemoryId === state.memories.get(ref(row.sourceEventId))));
  const providerEvidence = narrativeProvider.inputs.at(-1).report.selectedEvidence.map((item) => item.sourceEventId);
  assert.deepEqual(refs(providerEvidence), sorted(expected.selectedRefs), "provider saw only selected evidence");
  state.reports.weekly = report.id;
  record({ testId: "T04", clock: CLK.CLK_W, result: "PASS", periodKey: period.periodKey, completion: report.status,
    jobId: closed.body.job.id, reportId: report.id, retrievedCandidates: retrieved.count, selectedEvidence: rows.length,
    provenance: "AiEvidence == selected; cited ⊆ selected; memory/event/owner match", openPeriod: "400 at CLK_W_OPEN" });
});

e2e("T05 October Monthly via test-only job creation: closure, November exclusion, evidence", async () => {
  const expected = manifest.expected.monthly["M-2026-10"];
  const period = manifest.periods["M-2026-10"];
  const inputs = new m.ReportInputService({ prisma: m.prisma, semanticRetrieval: new m.SemanticEventRetrievalService({ prisma: m.prisma, provider: embedding }) });
  await assert.rejects(inputs.buildMonthlyInput({ identity: { userId: owners.A.id }, year: 2026, month: 10, asOf: new Date(CLK.CLK_M_OPEN) }),
    (error) => error.code === "AI_REPORT_PERIOD_OPEN");
  // D-3: no production Monthly trigger; the existing repository + worker are used directly.
  const job = await new m.PrismaAiJobRepository(m.prisma).enqueue({ identity: { userId: owners.A.id }, jobType: "MONTHLY_REPORT",
    resourceId: period.periodKey, processingVersion: m.REPORT_NARRATIVE_GENERATION_VERSION, maxAttempts: 1 });
  const execution = await workerFor({ reportAsOf: new Date(CLK.CLK_M) }).runJob({ jobId: job.id, ownerId: owners.A.id, jobType: "MONTHLY_REPORT" });
  assert.equal(execution.succeeded, true, execution.error?.code);
  const report = await m.prisma.monthlyReport.findUnique({ where: { ownerId_periodKey: { ownerId: owners.A.id, periodKey: period.periodKey } } });
  assert.deepEqual([report.periodStartUtc.toISOString(), report.periodEndUtc.toISOString(), report.asOf.toISOString()],
    [period.startUtc, period.endUtc, new Date(CLK.CLK_M).toISOString()]);
  assert.deepEqual([report.status, report.narrativeStatus, report.eventCount], ["COMPLETE", "GENERATED", expected.eventCount]);
  assert.equal(report.trendSignals.previousEventCount, expected.previousEventCount);
  assert.equal(report.trendSignals.eventCountChange, expected.eventCountChange);
  assert.equal(retrievalLog.at(-1).count, expected.candidateCount);
  const rows = await evidenceFor("monthlyReportId", report.id);
  assert.deepEqual(refs(rows.map((row) => row.sourceEventId)), sorted(expected.selectedRefs));
  assert.deepEqual(refs(rows.filter((row) => row.claimType === "NARRATIVE_CITED").map((row) => row.sourceEventId)), sorted(expected.citedRefs));
  for (const excluded of expected.excludedRefs) assert.ok(!refs(rows.map((row) => row.sourceEventId)).includes(excluded), excluded);
  assert.equal((await m.prisma.aiJob.findUnique({ where: { id: job.id } })).status, "SUCCEEDED");
  state.reports.monthly = report.id;
  record({ testId: "T05", clock: CLK.CLK_M, result: "PASS", periodKey: period.periodKey, completion: report.status, jobId: job.id,
    reportId: report.id, retrievedCandidates: retrievalLog.at(-1).count, selectedEvidence: rows.length,
    provenance: "a14 (Oct 31 local) included; a15 (Nov 1 local) and owner B excluded", openPeriod: "AI_REPORT_PERIOD_OPEN at CLK_M_OPEN" });
});

e2e("T06 pgvector retrieval: MOCK theme ranking, owner/window scope, no fallback without embeddings", async () => {
  const service = new m.SemanticEventRetrievalService({ prisma: m.prisma, provider: embedding });
  const outputs = {};
  for (const [name, expected] of Object.entries(manifest.expected.retrieval)) {
    const before = embedding.queryCalls;
    const window = expected.period ? manifest.periods[expected.period] : null;
    const rows = await service.retrieve({ identity: { userId: owners[expected.owner].id }, query: expected.query, take: expected.take,
      dateFrom: window ? new Date(window.startUtc) : null, dateTo: window ? new Date(window.endUtc) : null });
    assert.equal(embedding.queryCalls - before, 1, name);
    assert.deepEqual(refs(rows.map((row) => row.sourceEventId)), sorted(expected.refs), name);
    assert.ok(rows.every((row) => row.ownerId === owners[expected.owner].id), name);
    outputs[name] = { candidates: rows.length, refs: refs(rows.map((row) => row.sourceEventId)) };
  }
  assert.equal(await m.prisma.eventMemory.count({ where: { ownerId: owners.B.id } }), 2, "b02 memory exists but is not retrievable without its embedding");
  record({ testId: "T06", clock: "n/a", result: "PASS", provider: "MOCK", outputs,
    limitation: "MOCK lexical-theme vectors: validates pgvector ordering/scope/provenance only, NOT semantic relevance" });
});

e2e("T07 owner-scoped isolation across Events, reports, evidence and discovery", async () => {
  assert.equal((await api(`/events/${state.events.get("b01")}`)).status, 404);
  assert.equal((await api(`/events/${state.events.get("a07")}`, { owner: "B" })).status, 404);
  assert.equal((await api(`/ai/reports/weekly/${state.reports.weekly}`, { owner: "B" })).status, 404);
  assert.equal((await api(`/ai/reports/monthly/${state.reports.monthly}`, { owner: "B" })).status, 404);
  assert.equal((await api(`/ai/memories/${state.memories.get("a07")}`, { owner: "B" })).status, 404);
  const listB = await api("/ai/reports", { owner: "B" });
  assert.equal(listB.status, 200);
  assert.equal(listB.body.reports.length, 0);
  assert.equal((await api("/events", { method: "POST", headers: { "Idempotency-Key": "fx-ev-forged-v1" }, body: { content: "x", ownerId: owners.B.id } })).status, 400);
  const foreignEvidence = await m.prisma.aiEvidence.count({ where: { OR: [{ weeklyReportId: state.reports.weekly }, { monthlyReportId: state.reports.monthly }],
    NOT: { ownerId: owners.A.id } } });
  assert.equal(foreignEvidence, 0);
  assert.equal(await m.prisma.aiEvidence.count({ where: { sourceEventId: { in: [state.events.get("b01"), state.events.get("b02")] } } }), 0);
  record({ testId: "T07", clock: "n/a", result: "PASS", outputs: "cross-owner reads 404; B sees no A reports; forged owner 400; no cross-owner evidence" });
});

e2e("T08 insufficient evidence, idempotency, failed provider without retry, consent revocation", async () => {
  const header = (value) => ({ [m.SIMULATED_TIME_HEADER]: value });
  const callsBefore = narrativeProvider.calls;
  const insufficient = await api("/ai/reports/weekly/trigger", { method: "POST", headers: header(CLK.CLK_W_INSUFFICIENT), body: { localDate: "2026-09-24" } });
  assert.equal(insufficient.status, 200, JSON.stringify(insufficient.body));
  const thin = await m.prisma.weeklyReport.findUnique({ where: { ownerId_periodKey: { ownerId: owners.A.id, periodKey: "2026-09-21" } } });
  assert.deepEqual([thin.narrativeStatus, thin.summary, thin.eventCount], ["INSUFFICIENT_EVIDENCE", null, 1]);
  const thinEvidence = await evidenceFor("weeklyReportId", thin.id);
  assert.deepEqual([refs(thinEvidence.map((row) => row.sourceEventId)), thinEvidence.map((row) => row.claimType)], [["a03"], ["NARRATIVE_SELECTED"]]);
  assert.equal(narrativeProvider.calls, callsBefore, "insufficient evidence never calls the narrative provider");

  const replay = await api("/ai/reports/weekly/trigger", { method: "POST", headers: header(CLK.CLK_W), body: { localDate: "2026-10-08" } });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.report.id, state.reports.weekly);
  assert.equal(await m.prisma.aiJob.count({ where: { ownerId: owners.A.id, jobType: "WEEKLY_REPORT", resourceId: "2026-10-05" } }), 1);
  assert.equal(narrativeProvider.calls, callsBefore, "replay is idempotent and buys no inference");

  const failing = new m.FailingMockNarrativeProvider();
  activeNarrative = failing;
  try {
    const failed = await api("/ai/reports/weekly/trigger", { owner: "C", method: "POST", headers: header(CLK.CLK_W), body: { localDate: "2026-10-08" } });
    assert.equal(failed.status, 502);
    assert.equal(failed.body.errorCode, "REPORT_NARRATIVE_PROVIDER_FAILED");
    assert.deepEqual([failed.body.job.status, failed.body.job.attemptCount], ["FAILED", 1]);
    const retried = await api("/ai/reports/weekly/trigger", { owner: "C", method: "POST", headers: header(CLK.CLK_W), body: { localDate: "2026-10-08" } });
    assert.equal(retried.status, 502);
    assert.equal(failing.calls, 1, "no automatic or repeated inference after a failed attempt");
    assert.equal(await m.prisma.weeklyReport.count({ where: { ownerId: owners.C.id } }), 0);
  } finally {
    activeNarrative = narrativeProvider;
  }

  const revoke = await api(`/users/${owners.C.id}/ai-consent`, { owner: "C", method: "PUT", body: { aiProcessing: true, personalization: true, memoryEnabled: false } });
  assert.equal(revoke.status, 200);
  assert.equal(await m.prisma.eventMemory.count({ where: { ownerId: owners.C.id } }), 0);
  assert.equal(await m.prisma.eventMemoryEmbedding.count({ where: { ownerId: owners.C.id } }), 0);
  assert.equal(await m.prisma.event.count({ where: { ownerId: owners.C.id } }), manifest.expected.flowers.C, "source Events are preserved");
  assert.equal(await m.prisma.flower.count({ where: { userId: owners.C.id } }), manifest.expected.flowers.C, "Flowers are preserved");
  assert.equal((await api("/ai/reports/weekly/trigger", { owner: "C", method: "POST", headers: header(CLK.CLK_W), body: { localDate: "2026-10-08" } })).status, 403);
  assert.equal((await api("/ai/reports", { owner: "C" })).status, 403);
  record({ testId: "T08", clock: `${CLK.CLK_W_INSUFFICIENT} / ${CLK.CLK_W}`, result: "PASS", reportId: thin.id, periodKey: "2026-09-21",
    outputs: { insufficient: "INSUFFICIENT_EVIDENCE, 0 narrative calls, 1 selected", replay: "same job/report",
      failedProvider: "502, job FAILED after 1 attempt, 1 provider call total", revokedConsent: "memories/embeddings 0; Events/Flowers kept; 403" } });
});

e2e("T09 saved reports are listed and readable through the Reflection UI contract", async () => {
  const list = await api("/ai/reports?limit=20");
  assert.equal(list.status, 200);
  const summary = list.body.reports.map((report) => `${report.type}:${report.periodKey}:${report.status}`).sort();
  assert.deepEqual(summary, ["monthly:2026-10:COMPLETE", "weekly:2026-09-21:COMPLETE", "weekly:2026-10-05:COMPLETE"]);
  const weekly = await api(`/ai/reports/weekly/${state.reports.weekly}`);
  assert.equal(weekly.status, 200);
  assert.ok(weekly.body.summary?.includes("You recorded 6 Events"));
  assert.equal(weekly.body.narrativeSections.length, 3);
  assert.equal(weekly.body.trendSignals.status, "ok");
  assert.equal(weekly.body.trendSignals.eventCountChange, 4);
  assert.equal(weekly.body.evidence.length, 5);
  const monthly = await api(`/ai/reports/monthly/${state.reports.monthly}`);
  assert.deepEqual([monthly.status, monthly.body.eventCount, monthly.body.trendSignals.eventCountChange, monthly.body.evidence.length], [200, 11, 7, 10]);
  record({ testId: "T09", clock: "n/a", result: "PASS (API contract)", outputs: { list: summary },
    limitation: "reflection.tsx visual rendering NOT RUN (requires an approved browser/device check)" });
});

e2e("T99 evidence log and fixture cleanup", async () => {
  if (process.env.PETALPAL_AI_E2E_EVIDENCE) {
    fs.writeFileSync(process.env.PETALPAL_AI_E2E_EVIDENCE, `${JSON.stringify({ manifestVersion: manifest.manifestVersion, records: evidence,
      mockCalls: { embeddingDocuments: embedding.documentCalls, embeddingQueries: embedding.queryCalls, narrative: narrativeProvider.calls } }, null, 2)}\n`);
  }
  m.setWeeklyReportWorkerFactoryForTests();
  m.setFirebaseTokenVerifierForTests();
  await new Promise((resolve) => state.server.close(resolve));
  await m.prisma.user.deleteMany({ where: { id: { in: fixtureOwnerIds } } });
  await m.prisma.auditEvent.deleteMany({ where: { actorUserId: { in: fixtureOwnerIds } } });
  await m.prisma.$disconnect();
});
