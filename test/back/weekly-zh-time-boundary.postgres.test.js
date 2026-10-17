import assert from "node:assert/strict";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

import { AI_DISCLOSURE_VERSION } from "../../lib/ai-disclosure.js";
import { AI_JOB_TYPES, PrismaAiJobRepository, createEventAndEnqueueMemoryJob } from "../../lib/ai-jobs.js";
import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import { REFLECTION_V2 } from "../../lib/reflection-v2.js";
import { PrivateReportRepository } from "../../lib/report-foundation.js";
import { REPORT_NARRATIVE_GENERATION_VERSION } from "../../lib/report-narrative.js";

// Plan workflow E1 (docs/testing/TIME_WORKFLOW_TEST_PLAN.md): the hosted TEST zh-Hans
// scenario on disposable PostgreSQL with a mocked Sonnet Gateway and injected worker
// time. Events and memories go through the real pipeline; the Weekly job uses the
// trigger's idempotency key and maxAttempts 1; the env matches the TEST runbook budget.
// Daily budgets are global per database day, so this test needs its own fresh migrated database.
const databaseUrl = process.env.WEEKLY_BOUNDARY_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;
const WEEK = "2026-10-12", LOCAL_DATE = "2026-10-17";
const env = Object.freeze({
  AI_GATEWAY_ENABLED: "true", AI_GATEWAY_ANTHROPIC_ENABLED: "true", AI_REPORT_SUPPORTED_LOCALES: "zh-Hans",
  CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", CLOUDFLARE_AI_GATEWAY_ID: "petalpal-integration",
  CLOUDFLARE_AI_GATEWAY_TOKEN: "synthetic-gateway-token", ANTHROPIC_API_KEY: "synthetic-anthropic-key",
  AI_WEEKLY_REPORT_PROVIDER: "anthropic", AI_WEEKLY_REPORT_MODEL: "claude-sonnet-5-5", AI_WEEKLY_REFLECTION_CONTRACT: REFLECTION_V2.WEEKLY,
  AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS: "2048", AI_WEEKLY_REPORT_TIMEOUT_MS: "20000", AI_ASYNC_EXECUTION_MODE: "manual",
  AI_USER_DAILY_USD_LIMIT: "0.05", AI_USER_MONTHLY_USD_LIMIT: "0.05", AI_GLOBAL_DAILY_USD_LIMIT: "0.05",
  AI_GLOBAL_MONTHLY_USD_LIMIT: "0.05", AI_ANTHROPIC_MONTHLY_USD_LIMIT: "0.05",
  AI_USER_DAILY_CALL_LIMIT: "2", AI_GLOBAL_DAILY_CALL_LIMIT: "2", AI_PROVIDER_DAILY_CALL_LIMIT: "2", AI_WEEKLY_REPORT_DAILY_LIMIT: "1"
});

// Mocked Gateway: quotes the supplied evidence verbatim (grounded), counts calls.
function mockGateway() {
  const state = { calls: 0, owners: [] };
  state.impl = async (_url, options) => {
    state.calls += 1;
    const body = JSON.parse(options.body), packet = JSON.parse(body.messages[0].content);
    state.locale = packet.locale;
    const sentences = packet.evidence.slice(0, 2).map((item) => ({ text: `你写下：“${item.text}”`, refs: [item.ref] }));
    return Response.json({ model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ version: REFLECTION_V2.WEEKLY, locale: packet.locale, paragraphs: [{ sentences }] }) }],
      usage: { input_tokens: 600, output_tokens: 150 } });
  };
  return state;
}

async function seedOwner(prisma, id) {
  await prisma.user.create({ data: { id, name: id, timezone: "UTC", preferredLocale: "zh-Hans" } });
  await prisma.aiConsent.create({ data: { userId: id, termsVersion: AI_DISCLOSURE_VERSION, aiProcessing: true,
    personalization: true, memoryEnabled: true, grantedAt: new Date() } });
}

realTest("zh-Hans Weekly for week 2026-10-12: rejected at 23:59:59Z, generated once at 00:00:00Z, owner-only", async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const suffix = Date.now();
  const [early, ready, other] = ["early", "ready", "other"].map((name) => `zh-boundary-${name}-${suffix}`);
  const gateway = mockGateway();
  const worker = createProductionAiWorker({ prisma, env, gatewayFetchImpl: gateway.impl, retryDelayMs: 0,
    workerId: "zh-boundary-test",
    embeddingProvider: { describeProfile: () => getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
      embedQuery: () => { throw new Error("zh path must not embed"); }, embedDocuments: () => { throw new Error("zh path must not embed"); } },
    semanticRetrieval: { retrieve: () => { throw new Error("zh path must not use semantic retrieval"); } } });
  const repository = new PrismaAiJobRepository(prisma);
  // Same key and maxAttempts as the trigger route. The job's first-eligible time is pinned inside the
  // week so the injected evaluation times below can claim it whenever this test runs (fixture only).
  const enqueueWeekly = async (ownerId) => {
    const job = await repository.enqueue({ identity: { userId: ownerId }, jobType: AI_JOB_TYPES.WEEKLY_REPORT,
      resourceId: WEEK, processingVersion: REPORT_NARRATIVE_GENERATION_VERSION, maxAttempts: 1 });
    if (job.status === "PENDING") await prisma.aiJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date("2026-10-17T06:00:00Z") } });
    return job;
  };
  try {
    assert.equal(await prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } }), 0, "requires a fresh database (global daily budgets)");
    for (const ownerId of [early, ready, other]) {
      await seedOwner(prisma, ownerId);
      // Two Events in the TEST week, through the real Event + memory-job transaction.
      for (const [n, at] of [[1, "2026-10-17T03:00:00Z"], [2, "2026-10-17T05:00:00Z"]]) {
        const { event, job } = await createEventAndEnqueueMemoryJob({ prisma, identity: { userId: ownerId },
          content: `合成测试记录${n}：今天去图书馆整理了本周计划。`, occurredAt: new Date(at), idempotencyKey: `${ownerId}-event-${n}` });
        assert.equal(event.localDate, LOCAL_DATE);
        const memory = await worker.runJob({ jobId: job.id, ownerId, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION });
        assert.equal(memory.succeeded, true);
      }
    }
    assert.equal(await prisma.eventMemory.count({ where: { ownerId: { in: [early, ready, other] } } }), 6);

    // Exactly at the boundary, with the TEST runbook budget: one mocked Sonnet call; grounded zh-Hans report.
    const readyJob = await enqueueWeekly(ready);
    const generated = await worker.runJob({ jobId: readyJob.id, ownerId: ready, jobType: AI_JOB_TYPES.WEEKLY_REPORT, now: new Date("2026-10-19T00:00:00Z") });
    assert.equal(generated.succeeded, true, generated.error?.code);
    assert.equal(gateway.calls, 1);
    assert.equal(gateway.locale, "zh-Hans");
    const report = await prisma.weeklyReport.findUnique({ where: { ownerId_periodKey: { ownerId: ready, periodKey: WEEK } }, include: { evidence: true } });
    assert.equal(report.narrativeStatus, "GENERATED");
    assert.ok(report.evidence.length >= 2);
    assert.ok(report.evidence.every((item) => item.ownerId === ready), "evidence is owner-scoped");

    // One second before the week closes (separate worker with room in the budget, so quota cannot be the
    // cause): the worker's own period check fails the job with no Gateway call. Current behavior: the cost
    // reservation is taken before the period check and is not released, so it still counts for the day.
    const relaxed = createProductionAiWorker({ prisma, gatewayFetchImpl: gateway.impl, retryDelayMs: 0, workerId: "zh-boundary-relaxed",
      env: { ...env, AI_USER_DAILY_CALL_LIMIT: "10", AI_GLOBAL_DAILY_CALL_LIMIT: "10", AI_PROVIDER_DAILY_CALL_LIMIT: "10",
        AI_WEEKLY_REPORT_DAILY_LIMIT: "4", AI_USER_DAILY_USD_LIMIT: "1", AI_USER_MONTHLY_USD_LIMIT: "1",
        AI_GLOBAL_DAILY_USD_LIMIT: "1", AI_GLOBAL_MONTHLY_USD_LIMIT: "1", AI_ANTHROPIC_MONTHLY_USD_LIMIT: "1" },
      embeddingProvider: { describeProfile: () => getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
        embedQuery: () => { throw new Error("zh path must not embed"); }, embedDocuments: () => { throw new Error("zh path must not embed"); } },
      semanticRetrieval: { retrieve: () => { throw new Error("zh path must not use semantic retrieval"); } } });
    const reservedBefore = await prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } });
    const earlyJob = await enqueueWeekly(early);
    const rejected = await relaxed.runJob({ jobId: earlyJob.id, ownerId: early, jobType: AI_JOB_TYPES.WEEKLY_REPORT, now: new Date("2026-10-18T23:59:59Z") });
    assert.equal(rejected.claimed, true);
    assert.equal(rejected.succeeded, false);
    // The Sonnet path wraps input-preparation errors (here AI_REPORT_PERIOD_OPEN) as AI_GATEWAY_INVALID_INPUT;
    // the same data succeeded at 00:00:00Z above, and this is not a quota or budget code.
    assert.equal(rejected.error.code, "AI_GATEWAY_INVALID_INPUT");
    assert.equal((await prisma.aiJob.findUnique({ where: { id: earlyJob.id } })).status, "FAILED");
    assert.equal(gateway.calls, 1, "no provider call for an open week");
    assert.equal(await prisma.weeklyReport.count({ where: { ownerId: early } }), 0);
    assert.equal(await prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } }), reservedBefore + 1,
      "reservation precedes the period check (documented in time.md)");

    // Repeats: same job for the same key, not re-claimed, no second provider call or report.
    assert.equal((await enqueueWeekly(ready)).id, readyJob.id);
    assert.equal((await worker.runJob({ jobId: readyJob.id, ownerId: ready, jobType: AI_JOB_TYPES.WEEKLY_REPORT, now: new Date("2026-10-19T00:05:00Z") })).claimed, false);
    assert.equal(gateway.calls, 1);
    assert.equal(await prisma.weeklyReport.count({ where: { ownerId: ready } }), 1);

    // Owner-only reads.
    const reads = new PrivateReportRepository(prisma);
    assert.ok((await reads.listSavedReports({ identity: { userId: ready }, limit: 20 })).reports.some((r) => r.type === "weekly" && r.periodKey === WEEK));
    assert.equal((await reads.listSavedReports({ identity: { userId: other }, limit: 20 })).reports.length, 0);
    assert.equal(await reads.getWeeklyReportById({ identity: { userId: other }, reportId: report.id }), null);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [early, ready, other] } } });
    await prisma.$disconnect();
  }
});
