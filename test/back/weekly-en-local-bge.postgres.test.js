import assert from "node:assert/strict";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

import { AI_DISCLOSURE_VERSION } from "../../lib/ai-disclosure.js";
import { AI_JOB_TYPES, PrismaAiJobRepository, createEventAndEnqueueMemoryJob } from "../../lib/ai-jobs.js";
import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { TransformersJsEmbeddingProvider } from "../../lib/embedding-provider.js";
import { REFLECTION_V2 } from "../../lib/reflection-v2.js";
import { PrivateReportRepository } from "../../lib/report-foundation.js";
import { REPORT_NARRATIVE_GENERATION_VERSION } from "../../lib/report-narrative.js";
import { SemanticEventRetrievalService } from "../../lib/semantic-retrieval.js";
import { EN_PIPELINE_EVENTS, LOCAL_BGE_PROFILE, WEEK, WEEK_CLOSED_AT, runbookEnv } from "../../experiments/weekly-selective-reflection-v1/en-pipeline-week.mjs";

// The en counterpart of weekly-zh-time-boundary (E1): the full English Weekly pipeline on
// disposable PostgreSQL + pgvector, with real local BGE embeddings instead of hosted Cloudflare BGE.
// Event → memory job → embedding job (local BGE, same model, pooling and summary-v1 input as the
// production profile) → pgvector retrieval → selection → mocked Sonnet Gateway → grounding →
// persistence → owner-only read. No provider is called. The first run downloads
// Xenova/bge-small-en-v1.5 (q8) into the Transformers.js cache; later runs are offline.
// Needs its own fresh migrated database (daily budgets are global per database day).
const databaseUrl = process.env.WEEKLY_EN_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;
const LOCAL_DATE_PATTERN = /^2026-10-1[3-7]$/;
const env = runbookEnv(), EVENTS = EN_PIPELINE_EVENTS;

// Mocked Gateway: quotes the supplied evidence verbatim (grounded), records the packet.
function mockGateway() {
  const state = { calls: 0 };
  state.impl = async (_url, options) => {
    state.calls += 1;
    const body = JSON.parse(options.body), packet = JSON.parse(body.messages[0].content);
    state.packet = packet;
    const sentences = packet.evidence.slice(0, 2).map((item) => ({ text: `You wrote: “${item.text}”`, refs: [item.ref] }));
    return Response.json({ model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ version: REFLECTION_V2.WEEKLY, locale: packet.locale, paragraphs: [{ sentences }] }) }],
      usage: { input_tokens: 600, output_tokens: 150 } });
  };
  return state;
}

// Real local BGE, wrapped only to count document and query encodings.
function countingProvider(local) {
  const counts = { documents: 0, queries: [] };
  return { counts, describeProfile: () => local.describeProfile(),
    embedDocuments: (texts, options) => { counts.documents += texts.length; return local.embedDocuments(texts, options); },
    embedQuery: (text, options) => { counts.queries.push(text); return local.embedQuery(text, options); } };
}

async function seedOwner(prisma, id) {
  await prisma.user.create({ data: { id, name: id, timezone: "UTC", preferredLocale: "en" } });
  await prisma.aiConsent.create({ data: { userId: id, termsVersion: AI_DISCLOSURE_VERSION, aiProcessing: true,
    personalization: true, memoryEnabled: true, grantedAt: new Date() } });
}

realTest("en Weekly for week 2026-10-12 with local BGE: embeds, retrieves via pgvector, generated once at 00:00:00Z, owner-only", { timeout: 600_000 }, async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const suffix = Date.now();
  const [owner, other] = ["owner", "other"].map((name) => `en-bge-${name}-${suffix}`);
  const local = new TransformersJsEmbeddingProvider(LOCAL_BGE_PROFILE);
  await local.initialize(); // load (or download) the model before bounded embedding timeouts apply
  const provider = countingProvider(local);
  const gateway = mockGateway();
  const worker = createProductionAiWorker({ prisma, env, gatewayFetchImpl: gateway.impl, retryDelayMs: 0,
    workerId: "en-bge-test", embeddingProvider: provider });
  const repository = new PrismaAiJobRepository(prisma);
  try {
    assert.equal(await prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } }), 0, "requires a fresh database (global daily budgets)");
    for (const ownerId of [owner, other]) {
      await seedOwner(prisma, ownerId);
      for (const [n, [at, content]] of EVENTS.entries()) {
        const { event, job } = await createEventAndEnqueueMemoryJob({ prisma, identity: { userId: ownerId },
          content, occurredAt: new Date(at), idempotencyKey: `${ownerId}-event-${n}` });
        assert.match(event.localDate, LOCAL_DATE_PATTERN);
        const memory = await worker.runJob({ jobId: job.id, ownerId, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION });
        assert.equal(memory.succeeded, true, memory.error?.code);
      }
      // The memory job enqueues one embedding job per memory; run them with local BGE.
      const embeddingJobs = await prisma.aiJob.findMany({ where: { ownerId, jobType: AI_JOB_TYPES.EMBEDDING_GENERATION, status: "PENDING" } });
      assert.equal(embeddingJobs.length, EVENTS.length);
      for (const job of embeddingJobs) {
        const result = await worker.runJob({ jobId: job.id, ownerId, jobType: AI_JOB_TYPES.EMBEDDING_GENERATION });
        assert.equal(result.succeeded, true, result.error?.code);
      }
    }
    assert.equal(provider.counts.documents, 2 * EVENTS.length);
    const rows = await prisma.$queryRawUnsafe(`SELECT "ownerId", "status", vector_dims("embedding") AS dims FROM "EventMemoryEmbedding" WHERE "profileKey" = $1 AND "ownerId" IN ($2, $3)`,
      LOCAL_BGE_PROFILE, owner, other);
    assert.equal(rows.length, 2 * EVENTS.length);
    assert.ok(rows.every((row) => row.status === "GENERATED" && Number(row.dims) === 384), "every memory has a 384-dimension BGE vector");

    // Real semantic ranking, owner-scoped: a paraphrase finds the matching Event first.
    const retrieval = new SemanticEventRetrievalService({ prisma, provider: local });
    const top = await retrieval.retrieve({ identity: { userId: owner }, query: "worried I am not qualified for the new job", take: 3 });
    assert.match(top[0].summary, /not good enough/);
    assert.ok(top.every((row) => row.ownerId === owner));
    const family = await retrieval.retrieve({ identity: { userId: owner }, query: "my mother's medical results", take: 1 });
    assert.match(family[0].summary, /Mum called/);

    // Exactly at the boundary, TEST runbook budget: retrieval embeds the report query, one mocked Sonnet call.
    const job = await repository.enqueue({ identity: { userId: owner }, jobType: AI_JOB_TYPES.WEEKLY_REPORT,
      resourceId: WEEK, processingVersion: REPORT_NARRATIVE_GENERATION_VERSION, maxAttempts: 1 });
    await prisma.aiJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date("2026-10-17T06:00:00Z") } });
    const queriesBefore = provider.counts.queries.length;
    const generated = await worker.runJob({ jobId: job.id, ownerId: owner, jobType: AI_JOB_TYPES.WEEKLY_REPORT, now: new Date(WEEK_CLOSED_AT) });
    assert.equal(generated.succeeded, true, generated.error?.code);
    assert.equal(provider.counts.queries.length, queriesBefore + 1, "the en path ranks evidence with one BGE query embedding");
    assert.equal(gateway.calls, 1);
    assert.equal(gateway.packet.locale, "en");
    const sent = gateway.packet.evidence.map((item) => item.text).join("\n");
    for (const [, content] of EVENTS.filter(([, text]) => text.length > 20)) assert.ok(sent.includes(content), `meaningful Event reaches the writer: ${content.slice(0, 30)}`);
    const report = await prisma.weeklyReport.findUnique({ where: { ownerId_periodKey: { ownerId: owner, periodKey: WEEK } }, include: { evidence: true } });
    assert.equal(report.narrativeStatus, "GENERATED");
    assert.ok(report.evidence.length >= 2);
    assert.ok(report.evidence.every((item) => item.ownerId === owner), "evidence is owner-scoped");

    // Repeat: not re-claimed, no second provider call or report.
    assert.equal((await worker.runJob({ jobId: job.id, ownerId: owner, jobType: AI_JOB_TYPES.WEEKLY_REPORT, now: new Date("2026-10-19T00:05:00Z") })).claimed, false);
    assert.equal(gateway.calls, 1);
    assert.equal(await prisma.weeklyReport.count({ where: { ownerId: owner } }), 1);

    // Owner-only reads.
    const reads = new PrivateReportRepository(prisma);
    assert.ok((await reads.listSavedReports({ identity: { userId: owner }, limit: 20 })).reports.some((r) => r.type === "weekly" && r.periodKey === WEEK));
    assert.equal((await reads.listSavedReports({ identity: { userId: other }, limit: 20 })).reports.length, 0);
    assert.equal(await reads.getWeeklyReportById({ identity: { userId: other }, reportId: report.id }), null);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
    await prisma.$disconnect();
  }
});
