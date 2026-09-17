import assert from "node:assert/strict";
import { fork } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import pg from "pg";

import {
  AI_JOB_TYPES,
  PrismaAiJobRepository,
  createEventAndEnqueueMemoryJob,
  enqueueEventMemoryEmbeddingBackfill
} from "../../lib/ai-jobs.js";
import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import { PrismaMemoryRepository } from "../../lib/event-memory.js";
import { ReportInputService, WeeklyReportService } from "../../lib/report-foundation.js";
import { REPORT_NARRATIVE_GENERATION_VERSION } from "../../lib/report-narrative.js";
import { PrismaEventEmbeddingRepository, SemanticEventRetrievalService } from "../../lib/semantic-retrieval.js";

const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;
const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/ai-worker-process.js");

function prismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

async function withPrisma(callback) {
  const prisma = prismaClient();
  try {
    return await callback(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedUser(prisma, id, timezone = "UTC") {
  return prisma.user.create({ data: { id, name: id, timezone } });
}

function childMessage(child, expectedType, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Worker child did not emit ${expectedType}`)), timeoutMs);
    child.on("message", (message) => {
      if (message?.type === "error") {
        clearTimeout(timeout);
        reject(new Error(message.message));
      } else if (message?.type === expectedType) {
        clearTimeout(timeout);
        resolve(message);
      }
    });
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Worker child exited with code ${code}`));
      }
    });
  });
}

realTest("real PostgreSQL exposes pgvector, P0 constraints, indexes and triggers", async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const extension = await pool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    assert.equal(extension.rowCount, 1);
    const constraints = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conname IN (
        'EventMemory_sourceEventId_ownerId_fkey',
        'AIEvidence_sourceEventId_ownerId_fkey',
        'AIEvidence_weeklyReportId_ownerId_fkey',
        'AIEvidence_exactly_one_report_check',
        'AIJob_attempts_check',
        'WeeklyReport_period_check'
      )
    `);
    assert.equal(constraints.rowCount, 6);
    const indexes = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('AIJob_status_nextAttemptAt_idx', 'Event_ownerId_idempotencyKey_key')
    `);
    assert.equal(indexes.rowCount, 2);
    const triggers = await pool.query(`
      SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN ('Event_delete_citing_reports', 'AIJob_status_transition')
    `);
    assert.equal(triggers.rowCount, 2);
  } finally {
    await pool.end();
  }
});

realTest("real PostgreSQL enforces tenant, evidence-shape and range constraints and deletes cited reports", async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const suffix = Date.now();
  const alice = `pg-alice-${suffix}`;
  const bob = `pg-bob-${suffix}`;
  const event = `pg-event-${suffix}`;
  const report = `pg-report-${suffix}`;
  try {
    await pool.query(`INSERT INTO "User" (id, name) VALUES ($1, 'Alice'), ($2, 'Bob')`, [alice, bob]);
    await pool.query(`
      INSERT INTO "Event" (id, "ownerId", content, "occurredAt", timezone, "localDate", "idempotencyKey", "memoryProcessingAllowed", "updatedAt")
      VALUES ($1, $2, 'private event', NOW(), 'UTC', '2026-09-14', $3, true, NOW())
    `, [event, alice, `request-${suffix}`]);
    await pool.query(`
      INSERT INTO "WeeklyReport" (id, "ownerId", timezone, "periodKey", "periodStartUtc", "periodEndUtc", "asOf", "eventCount", summary, "updatedAt")
      VALUES ($1, $2, 'UTC', '2026-09-14', '2026-09-14', '2026-09-21', '2026-09-22', 1, 'derived private content', NOW())
    `, [report, alice]);

    await assert.rejects(pool.query(`
      INSERT INTO "EventMemory" (id, "ownerId", "sourceEventId", "memoryType", summary, "eventDate", "updatedAt")
      VALUES ($1, $2, $3, 'EVENT', 'forbidden', NOW(), NOW())
    `, [`cross-memory-${suffix}`, bob, event]), (error) => error.code === "23503");
    await assert.rejects(pool.query(`
      INSERT INTO "AIEvidence" (id, "ownerId", "sourceEventId", "weeklyReportId") VALUES ($1, $2, $3, $4)
    `, [`cross-evidence-${suffix}`, bob, event, report]), (error) => error.code === "23503");
    await assert.rejects(pool.query(`
      INSERT INTO "AIEvidence" (id, "ownerId", "sourceEventId") VALUES ($1, $2, $3)
    `, [`zero-report-${suffix}`, alice, event]), (error) => error.code === "23514");

    const monthly = `pg-monthly-${suffix}`;
    await pool.query(`
      INSERT INTO "MonthlyReport" (id, "ownerId", timezone, "periodKey", "periodStartUtc", "periodEndUtc", "asOf", year, month, "eventCount", "updatedAt")
      VALUES ($1, $2, 'UTC', '2026-09', '2026-09-01', '2026-10-01', '2026-10-02', 2026, 9, 1, NOW())
    `, [monthly, alice]);
    await assert.rejects(pool.query(`
      INSERT INTO "AIEvidence" (id, "ownerId", "sourceEventId", "weeklyReportId", "monthlyReportId") VALUES ($1, $2, $3, $4, $5)
    `, [`two-reports-${suffix}`, alice, event, report, monthly]), (error) => error.code === "23514");

    const memory = `pg-memory-${suffix}`;
    await pool.query(`
      INSERT INTO "EventMemory" (id, "ownerId", "sourceEventId", "memoryType", summary, "eventDate", "importanceScore", "updatedAt")
      VALUES ($1, $2, $3, 'EVENT', 'valid', NOW(), 0.5, NOW())
    `, [memory, alice, event]);
    await pool.query(`
      INSERT INTO "AIEvidence" (id, "ownerId", "sourceEventId", "sourceMemoryId", "weeklyReportId") VALUES ($1, $2, $3, $4, $5)
    `, [`valid-evidence-${suffix}`, alice, event, memory, report]);
    await assert.rejects(pool.query(`
      INSERT INTO "AIEvidence" (id, "ownerId", "sourceEventId", "weeklyReportId") VALUES ($1, $2, $3, $4)
    `, [`duplicate-evidence-${suffix}`, alice, event, report]), (error) => error.code === "23505");
    await assert.rejects(pool.query(`UPDATE "EventMemory" SET "importanceScore" = 1.1 WHERE id = $1`, [memory]), (error) => error.code === "23514");
    await assert.rejects(pool.query(`UPDATE "EventMemory" SET "emotionConfidence" = -0.1 WHERE id = $1`, [memory]), (error) => error.code === "23514");
    await assert.rejects(pool.query(`UPDATE "WeeklyReport" SET "eventCount" = -1 WHERE id = $1`, [report]), (error) => error.code === "23514");
    await assert.rejects(pool.query(`UPDATE "WeeklyReport" SET "periodEndUtc" = "periodStartUtc" WHERE id = $1`, [report]), (error) => error.code === "23514");
    await assert.rejects(pool.query(`UPDATE "MonthlyReport" SET month = 13 WHERE id = $1`, [monthly]), (error) => error.code === "23514");
    await assert.rejects(pool.query(`
      INSERT INTO "AIJob" (id, "ownerId", "jobType", "resourceId", "attemptCount", "maxAttempts", "idempotencyKey", "updatedAt")
      VALUES ($1, $2, 'MEMORY_EXTRACTION', 'invalid-attempts', 4, 3, $3, NOW())
    `, [`invalid-attempts-${suffix}`, alice, `invalid-attempts-${suffix}`]), (error) => error.code === "23514");

    await pool.query(`DELETE FROM "Event" WHERE id = $1`, [event]);
    const lifecycle = await pool.query(`SELECT
      (SELECT count(*)::int FROM "EventMemory" WHERE id = $1) memories,
      (SELECT count(*)::int FROM "AIEvidence" WHERE "sourceEventId" = $2) evidence,
      (SELECT count(*)::int FROM "WeeklyReport" WHERE id = $3) reports
    `, [memory, event, report]);
    assert.deepEqual(lifecycle.rows[0], { memories: 0, evidence: 0, reports: 0 });
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [[alice, bob]]).catch(() => {});
    await pool.end();
  }
});

realTest("real PostgreSQL stores and retrieves owner-scoped 384d Event embeddings across lifecycle changes", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const alice = `pg-vector-alice-${suffix}`;
    const bob = `pg-vector-bob-${suffix}`;
    const first = [1, ...Array(383).fill(0)];
    const query = [0.8, 0.6, ...Array(382).fill(0)];
    await seedUser(prisma, alice);
    await seedUser(prisma, bob);
    await prisma.aiConsent.createMany({ data: [
      { userId: alice, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() },
      { userId: bob, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() }
    ] });
    try {
      const aliceEvent = await prisma.event.create({
        data: { ownerId: alice, content: "Alice internship", occurredAt: new Date(), timezone: "UTC", localDate: "2026-09-17", idempotencyKey: `alice-${suffix}`, memoryProcessingAllowed: true }
      });
      const bobEvent = await prisma.event.create({
        data: { ownerId: bob, content: "Bob private event", occurredAt: new Date(), timezone: "UTC", localDate: "2026-09-17", idempotencyKey: `bob-${suffix}`, memoryProcessingAllowed: true }
      });
      const aliceMemory = await prisma.eventMemory.create({
        data: { ownerId: alice, sourceEventId: aliceEvent.id, memoryType: "EVENT", summary: "Alice internship", eventDate: new Date() }
      });
      const bobMemory = await prisma.eventMemory.create({
        data: { ownerId: bob, sourceEventId: bobEvent.id, memoryType: "EVENT", summary: "Bob private event", eventDate: new Date() }
      });
      const embeddings = new PrismaEventEmbeddingRepository(prisma);
      for (const [ownerId, memoryId] of [[alice, aliceMemory.id], [bob, bobMemory.id]]) {
        const consent = await prisma.aiConsent.findUnique({ where: { userId: ownerId } });
        await embeddings.begin({ identity: { userId: ownerId }, memoryId, inputRevision: 1 });
        await embeddings.store({ identity: { userId: ownerId }, memoryId, inputRevision: 1, vector: first, consentUpdatedAt: consent.updatedAt });
      }

      const aliceConsent = await prisma.aiConsent.findUnique({ where: { userId: alice } });
      const rows = await embeddings.search({ identity: { userId: alice }, vector: query, take: 10, consentUpdatedAt: aliceConsent.updatedAt });
      assert.deepEqual(rows.map((row) => row.id), [aliceMemory.id]);
      assert.equal(rows.some((row) => row.id === bobMemory.id), false);

      const memoryRepository = new PrismaMemoryRepository(prisma);
      const updated = await memoryRepository.saveMemory({
        identity: { userId: alice },
        memory: {
          sourceEventId: aliceEvent.id,
          memoryType: "EVENT",
          summary: "Alice changed internship",
          topics: [],
          people: [],
          eventDate: aliceMemory.eventDate
        }
      });
      assert.equal(updated.embeddingInputRevision, 2);
      assert.equal(updated.embeddingStatus, "NOT_REQUESTED");
      const stored = await prisma.$queryRawUnsafe(`SELECT "embedding" IS NULL AS empty FROM "EventMemory" WHERE "id" = $1`, aliceMemory.id);
      assert.equal(stored[0].empty, true);

      await prisma.event.delete({ where: { id: aliceEvent.id } });
      assert.equal(await prisma.eventMemory.count({ where: { id: aliceMemory.id } }), 0);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    }
  });
});

realTest("real PostgreSQL embedding backfill selects only eligible English missing/stale rows and processes them idempotently", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const owners = {
      alice: `pg-backfill-alice-${suffix}`,
      bob: `pg-backfill-bob-${suffix}`,
      chinese: `pg-backfill-zh-${suffix}`,
      revoked: `pg-backfill-revoked-${suffix}`
    };
    for (const ownerId of Object.values(owners)) await seedUser(prisma, ownerId);
    await prisma.user.update({ where: { id: owners.chinese }, data: { preferredLocale: "zh-Hans" } });
    await prisma.aiConsent.createMany({ data: [
      { userId: owners.alice, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() },
      { userId: owners.bob, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() },
      { userId: owners.chinese, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() },
      { userId: owners.revoked, termsVersion: "v1", aiProcessing: false, personalization: false, memoryEnabled: false, revokedAt: new Date() }
    ] });

    const createMemory = async (id, ownerId, content) => {
      const event = await prisma.event.create({
        data: {
          id: `${id}-event`, ownerId, content, occurredAt: new Date(), timezone: "UTC",
          localDate: "2026-09-17", idempotencyKey: `${id}-request`, memoryProcessingAllowed: true
        }
      });
      const memory = await prisma.eventMemory.create({
        data: { id, ownerId, sourceEventId: event.id, memoryType: "EVENT", summary: content, eventDate: new Date() }
      });
      return { event, memory };
    };

    try {
      const prefix = `bf-${suffix}`;
      const missing = await createMemory(`${prefix}-01-missing`, owners.alice, "Missing English embedding");
      const stale = await createMemory(`${prefix}-02-stale`, owners.bob, "Stale English embedding");
      const current = await createMemory(`${prefix}-03-current`, owners.alice, "Current English embedding");
      const chinese = await createMemory(`${prefix}-04-chinese`, owners.chinese, "中文事件");
      const revoked = await createMemory(`${prefix}-05-revoked`, owners.revoked, "Revoked English event");
      const vector = [1, ...Array(383).fill(0)];
      const embeddings = new PrismaEventEmbeddingRepository(prisma);

      for (const item of [stale, current]) {
        const consent = await prisma.aiConsent.findUnique({ where: { userId: item.memory.ownerId } });
        await embeddings.begin({ identity: { userId: item.memory.ownerId }, memoryId: item.memory.id, inputRevision: 1 });
        await embeddings.store({
          identity: { userId: item.memory.ownerId }, memoryId: item.memory.id,
          inputRevision: 1, vector, consentUpdatedAt: consent.updatedAt
        });
      }
      await prisma.$executeRawUnsafe(`
        UPDATE "EventMemory" SET "embeddingProfileKey" = 'retired-profile' WHERE "id" = $1
      `, stale.memory.id);

      const first = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 1 });
      assert.equal(first.selected, 1);
      assert.equal(first.hasMore, true);
      const repeated = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 1 });
      assert.deepEqual(repeated.jobIds, first.jobIds);

      const second = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 1, afterId: first.nextCursor });
      assert.equal(second.selected, 1);
      const complete = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 1, afterId: second.nextCursor });
      assert.equal(complete.selected, 0);

      const jobs = await prisma.aiJob.findMany({
        where: { resourceId: { in: [missing.memory.id, stale.memory.id, current.memory.id, chinese.memory.id, revoked.memory.id] } },
        orderBy: { resourceId: "asc" }
      });
      assert.deepEqual(jobs.map((job) => [job.ownerId, job.resourceId]), [
        [owners.alice, missing.memory.id],
        [owners.bob, stale.memory.id]
      ]);
      assert.equal(new Set(jobs.map((job) => job.id)).size, 2);
      assert.equal(jobs.every((job) => job.maxAttempts === 3 && job.jobType === AI_JOB_TYPES.EMBEDDING_GENERATION), true);

      let providerCalls = 0;
      const profile = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
      const worker = createProductionAiWorker({
        prisma,
        embeddingProvider: {
          describeProfile() { return profile; },
          async embedDocuments() {
            providerCalls += 1;
            return { vectors: [vector], dimensions: 384, modelRevision: profile.modelRevision };
          }
        },
        logger: { error() {} }
      });
      const runs = [await worker.runOnce(), await worker.runOnce()];
      assert.equal(runs.every((result) => result.claimed && result.succeeded), true);
      assert.equal(providerCalls, 2);

      const completedJobs = await prisma.aiJob.findMany({ where: { id: { in: jobs.map((job) => job.id) } } });
      assert.equal(completedJobs.every((job) => job.status === "SUCCEEDED" && job.attemptCount === 1), true);

      const updated = await prisma.eventMemory.findMany({
        where: { id: { in: [missing.memory.id, stale.memory.id] } },
        orderBy: { id: "asc" }
      });
      assert.equal(updated.every((memory) =>
        memory.embeddingStatus === "GENERATED" &&
        memory.embeddingProfileKey === PRODUCTION_EMBEDDING_PROFILE_KEY &&
        memory.embeddedInputRevision === memory.embeddingInputRevision
      ), true);
      assert.equal((await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 10 })).selected, 0);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: Object.values(owners) } } });
    }
  });
});

realTest("real PostgreSQL builds bounded owner-safe Monthly evidence input from semantic EventMemory retrieval", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const alice = `pg-evidence-alice-${suffix}`;
    const bob = `pg-evidence-bob-${suffix}`;
    const revoked = `pg-evidence-revoked-${suffix}`;
    for (const ownerId of [alice, bob, revoked]) await seedUser(prisma, ownerId);
    await prisma.aiConsent.createMany({ data: [alice, bob, revoked].map((userId) => ({
      userId, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date()
    })) });
    const vectors = {
      exact: [1, ...Array(383).fill(0)],
      close: [0.95, 0.05, ...Array(382).fill(0)],
      related: [0.85, 0.15, ...Array(382).fill(0)],
      other: [0.7, 0.3, ...Array(382).fill(0)]
    };
    const embeddings = new PrismaEventEmbeddingRepository(prisma);
    const createEmbeddedMemory = async ({ id, ownerId, summary, occurredAt, topics, vector }) => {
      const event = await prisma.event.create({
        data: {
          id: `${id}-event`, ownerId, content: summary, occurredAt, timezone: "UTC",
          localDate: occurredAt.toISOString().slice(0, 10), idempotencyKey: `${id}-request`, memoryProcessingAllowed: true
        }
      });
      const memory = await prisma.eventMemory.create({
        data: { id, ownerId, sourceEventId: event.id, memoryType: "EVENT", summary, topics, eventDate: occurredAt }
      });
      const consent = await prisma.aiConsent.findUnique({ where: { userId: ownerId } });
      await embeddings.begin({ identity: { userId: ownerId }, memoryId: memory.id, inputRevision: 1 });
      await embeddings.store({ identity: { userId: ownerId }, memoryId: memory.id, inputRevision: 1, vector, consentUpdatedAt: consent.updatedAt });
      return { event, memory };
    };

    try {
      const prefix = `evidence-${suffix}`;
      const first = await createEmbeddedMemory({ id: `${prefix}-01`, ownerId: alice, summary: "Started a new internship", occurredAt: new Date("2026-09-03T12:00:00Z"), topics: ["career"], vector: vectors.exact });
      await createEmbeddedMemory({ id: `${prefix}-02`, ownerId: alice, summary: "Started a new internship!", occurredAt: new Date("2026-09-04T12:00:00Z"), topics: ["career"], vector: vectors.close });
      const changed = await createEmbeddedMemory({ id: `${prefix}-03`, ownerId: alice, summary: "Changed internship teams and felt supported", occurredAt: new Date("2026-09-20T12:00:00Z"), topics: ["career"], vector: vectors.related });
      const study = await createEmbeddedMemory({ id: `${prefix}-04`, ownerId: alice, summary: "Completed the final exam", occurredAt: new Date("2026-09-10T12:00:00Z"), topics: ["study"], vector: vectors.other });
      await createEmbeddedMemory({ id: `${prefix}-05-outside`, ownerId: alice, summary: "August event outside report", occurredAt: new Date("2026-08-20T12:00:00Z"), topics: ["career"], vector: vectors.exact });
      const bobPrivate = await createEmbeddedMemory({ id: `${prefix}-06-bob`, ownerId: bob, summary: "Bob private event", occurredAt: new Date("2026-09-05T12:00:00Z"), topics: ["career"], vector: vectors.exact });
      await createEmbeddedMemory({ id: `${prefix}-07-revoked`, ownerId: revoked, summary: "Revoked private event", occurredAt: new Date("2026-09-06T12:00:00Z"), topics: ["career"], vector: vectors.exact });
      await prisma.aiConsent.update({
        where: { userId: revoked },
        data: { aiProcessing: false, personalization: false, memoryEnabled: false, grantedAt: null, revokedAt: new Date() }
      });

      let queryCalls = 0;
      const profile = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
      const provider = {
        describeProfile() { return profile; },
        async embedQuery() { queryCalls += 1; return { vectors: [vectors.exact], dimensions: 384, modelRevision: profile.modelRevision }; }
      };
      const semanticRetrieval = new SemanticEventRetrievalService({ prisma, provider });
      const service = new ReportInputService({ prisma, semanticRetrieval });
      const input = await service.buildMonthlyInput({
        identity: { userId: alice }, year: 2026, month: 9, asOf: new Date("2026-10-02T00:00:00Z")
      });

      assert.equal(input.reportType, "MONTHLY");
      assert.equal(input.evidenceSelection.status, "READY");
      assert.equal(input.evidenceSelection.candidateCount, 4);
      assert.equal(input.evidenceSelection.deduplicatedCount, 3);
      assert.equal(input.evidenceSelection.selectedCount, 3);
      assert.deepEqual(new Set(input.evidenceSelection.evidence.map((item) => item.sourceEventId)), new Set([first.event.id, changed.event.id, study.event.id]));
      assert.equal(input.evidenceSelection.evidence.some((item) => item.sourceEventId === bobPrivate.event.id), false);
      assert.equal(input.evidenceSelection.evidence.every((item) => item.provenance.sourceEventId === item.sourceEventId && item.provenance.sourceMemoryId === item.sourceMemoryId), true);
      assert.equal(queryCalls, 1);

      await assert.rejects(
        service.buildMonthlyInput({ identity: { userId: revoked }, year: 2026, month: 9, asOf: new Date("2026-10-02T00:00:00Z") }),
        (error) => error.code === "AI_FORBIDDEN"
      );
      assert.equal(queryCalls, 1);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [alice, bob, revoked] } } });
    }
  });
});

realTest("real PostgreSQL report worker persists grounded narrative and provenance idempotently", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const ownerId = `pg-narrative-owner-${suffix}`;
    await seedUser(prisma, ownerId);
    await prisma.aiConsent.create({
      data: { userId: ownerId, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() }
    });
    try {
      const events = [];
      for (const [index, day] of [15, 16, 20].entries()) {
        const event = await prisma.event.create({
          data: {
            ownerId,
            content: `Grounded report event ${index + 1}`,
            occurredAt: new Date(`2026-09-${day}T12:00:00Z`),
            timezone: "UTC",
            localDate: `2026-09-${day}`,
            idempotencyKey: `grounded-report-${suffix}-${index}`,
            memoryProcessingAllowed: true,
            consentTermsVersion: "v1"
          }
        });
        const memory = await prisma.eventMemory.create({
          data: {
            ownerId,
            sourceEventId: event.id,
            memoryType: "EVENT",
            summary: `Selected evidence ${index + 1}`,
            topics: index === 1 ? ["study"] : ["career"],
            people: [],
            importanceScore: 0.9 - index / 10,
            eventDate: event.occurredAt
          }
        });
        events.push({ event, memory });
      }

      const job = await new PrismaAiJobRepository(prisma).enqueue({
        identity: { userId: ownerId },
        jobType: AI_JOB_TYPES.WEEKLY_REPORT,
        resourceId: "2026-09-14",
        processingVersion: REPORT_NARRATIVE_GENERATION_VERSION
      });
      let providerCalls = 0;
      const profile = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
      const worker = createProductionAiWorker({
        prisma,
        embeddingProvider: {
          describeProfile() { return profile; },
          async embedDocuments() { throw new Error("report job must not embed documents"); }
        },
        semanticRetrieval: {
          async retrieve({ identity, dateFrom, dateTo }) {
            assert.equal(identity.userId, ownerId);
            const memories = await prisma.eventMemory.findMany({
              where: { ownerId, eventDate: { gte: dateFrom, lt: dateTo } },
              orderBy: { eventDate: "asc" }
            });
            return memories.map((memory, index) => ({ ...memory, similarity: 1 - index / 10 }));
          }
        },
        reportNarrativeProvider: {
          async generateNarrative(input) {
            providerCalls += 1;
            return {
              model: "postgres-test-model",
              sections: [{
                kind: "RECENT_MOMENTS",
                claim: "The week included meaningful career and study moments.",
                evidenceRefs: [{ sourceEventId: events[0].event.id, sourceMemoryId: events[0].memory.id }],
                aggregateRefs: ["topTopics"]
              }]
            };
          }
        },
        logger: { error() {} }
      });
      const run = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
      assert.equal(run.succeeded, true);
      assert.equal(run.result.status, "GENERATED");

      const report = await prisma.weeklyReport.findUnique({
        where: { ownerId_periodKey: { ownerId, periodKey: "2026-09-14" } },
        include: { evidence: { orderBy: { sourceEventId: "asc" } } }
      });
      assert.equal(report.narrativeStatus, "GENERATED");
      assert.equal(report.narrativeSections.length, 1);
      assert.equal(report.evidence.length, 3);
      assert.equal(report.evidence.filter((item) => item.claimType === "NARRATIVE_CITED").length, 1);
      assert.equal((await prisma.aiJob.findUnique({ where: { id: job.id } })).status, "SUCCEEDED");

      const replay = await worker.handlers[AI_JOB_TYPES.WEEKLY_REPORT]({ ...job, lockedAt: new Date("2026-09-22T00:00:00Z") });
      assert.equal(replay.skipped, true);
      assert.equal(providerCalls, 1);
      assert.equal(await prisma.weeklyReport.count({ where: { ownerId, periodKey: "2026-09-14" } }), 1);
      assert.equal(await prisma.aiEvidence.count({ where: { ownerId, weeklyReportId: report.id } }), 3);

      await new WeeklyReportService(prisma).generate({
        identity: { userId: ownerId },
        localDate: "2026-09-14",
        asOf: new Date("2026-09-22T00:00:00Z"),
        generationVersion: "deterministic-replay"
      });
      const protectedReport = await prisma.weeklyReport.findUnique({ where: { id: report.id } });
      assert.equal(protectedReport.generationVersion, REPORT_NARRATIVE_GENERATION_VERSION);
      assert.equal(protectedReport.summary, report.summary);
    } finally {
      await prisma.user.delete({ where: { id: ownerId } });
    }
  });
});

realTest("real report regeneration is atomic and leaves only B and C evidence", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const ownerId = `pg-report-owner-${suffix}`;
    await seedUser(prisma, ownerId, "America/Vancouver");
    try {
      const common = { ownerId, timezone: "America/Vancouver", memoryProcessingAllowed: false };
      const eventA = await prisma.event.create({ data: { ...common, content: "A", occurredAt: new Date("2026-09-15T12:00:00Z"), localDate: "2026-09-15", idempotencyKey: `a-${suffix}` } });
      const eventB = await prisma.event.create({ data: { ...common, content: "B", occurredAt: new Date("2026-09-16T12:00:00Z"), localDate: "2026-09-16", idempotencyKey: `b-${suffix}` } });
      const service = new WeeklyReportService(prisma);
      const input = { identity: { userId: ownerId }, localDate: "2026-09-15", asOf: new Date("2026-09-22T12:00:00Z") };
      const first = await service.generate({ ...input, generationVersion: "first" });
      assert.deepEqual((await prisma.aiEvidence.findMany({ where: { weeklyReportId: first.id }, orderBy: { sourceEventId: "asc" } })).map((row) => row.sourceEventId), [eventA.id, eventB.id].sort());

      await prisma.event.update({ where: { id: eventA.id }, data: { occurredAt: new Date("2026-08-15T12:00:00Z"), localDate: "2026-08-15" } });
      const eventC = await prisma.event.create({ data: { ...common, content: "C", occurredAt: new Date("2026-09-17T12:00:00Z"), localDate: "2026-09-17", idempotencyKey: `c-${suffix}` } });
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "reject_c_${suffix}"() RETURNS trigger AS $$ BEGIN IF NEW."sourceEventId" = '${eventC.id}' THEN RAISE EXCEPTION 'forced evidence failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "reject_c_${suffix}" BEFORE INSERT ON "AIEvidence" FOR EACH ROW EXECUTE FUNCTION "reject_c_${suffix}"()`);
      await assert.rejects(service.generate({ ...input, generationVersion: "must-rollback" }), /forced evidence failure/i);
      const rolledBack = await prisma.weeklyReport.findUnique({ where: { id: first.id }, include: { evidence: true } });
      assert.equal(rolledBack.generationVersion, "first");
      assert.deepEqual(rolledBack.evidence.map((row) => row.sourceEventId).sort(), [eventA.id, eventB.id].sort());
      await prisma.$executeRawUnsafe(`DROP TRIGGER "reject_c_${suffix}" ON "AIEvidence"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "reject_c_${suffix}"()`);

      const second = await service.generate({ ...input, generationVersion: "second" });
      const finalEvidence = await prisma.aiEvidence.findMany({ where: { weeklyReportId: second.id }, orderBy: { sourceEventId: "asc" } });
      assert.equal(await prisma.weeklyReport.count({ where: { ownerId, periodKey: second.periodKey } }), 1);
      assert.deepEqual(finalEvidence.map((row) => row.sourceEventId), [eventB.id, eventC.id].sort());
    } finally {
      await prisma.user.delete({ where: { id: ownerId } });
    }
  });
});

realTest("25 independent Prisma connections claim a single lease without duplicates and recover expiry", async () => {
  const ownerId = `pg-job-owner-${Date.now()}`;
  let jobId;
  await withPrisma(async (prisma) => {
    await seedUser(prisma, ownerId);
    const event = await prisma.event.create({ data: { ownerId, content: "claim", occurredAt: new Date(), timezone: "UTC", localDate: "2026-09-14", idempotencyKey: `claim-${Date.now()}`, memoryProcessingAllowed: true } });
    const job = await prisma.aiJob.create({ data: { ownerId, jobType: "MEMORY_EXTRACTION", resourceId: event.id, eventId: event.id, idempotencyKey: `memory:${event.id}:v1` } });
    jobId = job.id;
  });
  const clients = Array.from({ length: 25 }, () => prismaClient());
  try {
    const now = new Date();
    const claims = await Promise.all(clients.map((client, index) => new PrismaAiJobRepository(client).claimNext({ workerId: `pg-worker-${index}`, now, leaseMs: 1_000 })));
    const claimed = claims.filter(Boolean);
    assert.equal(claimed.length, 1);
    assert.equal(new Set(claimed.map((job) => job.id)).size, 1);
    assert.equal(claimed[0].attemptCount, 1);
    const recovery = await new PrismaAiJobRepository(clients[0]).claimNext({ workerId: "pg-recovery", now: new Date(now.getTime() + 1_001), leaseMs: 1_000 });
    assert.equal(recovery.id, jobId);
    assert.equal(recovery.attemptCount, 2);
    assert.equal(recovery.lockedBy, "pg-recovery");
    assert.ok(recovery.lockedAt);
    assert.ok(recovery.leaseExpiresAt > recovery.lockedAt);
    await new PrismaAiJobRepository(clients[0]).markSucceeded({ jobId, workerId: "pg-recovery" });
    await assert.rejects(clients[0].aiJob.update({ where: { id: jobId }, data: { status: "PENDING", completedAt: null } }), /invalid AIJob status transition/i);
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await withPrisma((prisma) => prisma.user.delete({ where: { id: ownerId } }));
  }
});

realTest("Event and memory job intent are atomic, consent-aware and idempotent", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const enabled = `pg-enabled-${suffix}`;
    const disabled = `pg-disabled-${suffix}`;
    await seedUser(prisma, enabled, "America/Vancouver");
    await seedUser(prisma, disabled, "UTC");
    await prisma.aiConsent.createMany({ data: [
      { userId: enabled, termsVersion: "v1", aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() },
      { userId: disabled, termsVersion: "v1", aiProcessing: false, personalization: false, memoryEnabled: false }
    ] });
    try {
      const enabledInput = { prisma, identity: { userId: enabled }, content: "durable", occurredAt: new Date("2026-09-15T06:30:00Z"), idempotencyKey: `enabled-${suffix}` };
      const first = await createEventAndEnqueueMemoryJob(enabledInput);
      const repeated = await createEventAndEnqueueMemoryJob(enabledInput);
      assert.equal(first.created, true);
      assert.equal(repeated.created, false);
      assert.equal(repeated.event.id, first.event.id);
      assert.equal(repeated.job.id, first.job.id);
      assert.equal(await prisma.event.count({ where: { ownerId: enabled } }), 1);
      assert.equal(await prisma.aiJob.count({ where: { ownerId: enabled } }), 1);

      const withoutMemory = await createEventAndEnqueueMemoryJob({ prisma, identity: { userId: disabled }, content: "private only", idempotencyKey: `disabled-${suffix}` });
      assert.ok(withoutMemory.event);
      assert.equal(withoutMemory.job, null);
      assert.equal(await prisma.aiJob.count({ where: { ownerId: disabled } }), 0);

      await prisma.$executeRawUnsafe(`CREATE FUNCTION "reject_jobs_${suffix}"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced job failure'; END; $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "reject_jobs_${suffix}" BEFORE INSERT ON "AIJob" FOR EACH ROW EXECUTE FUNCTION "reject_jobs_${suffix}"()`);
      await assert.rejects(createEventAndEnqueueMemoryJob({ prisma, identity: { userId: enabled }, content: "must rollback", idempotencyKey: `rollback-${suffix}` }), /forced job failure/i);
      assert.equal(await prisma.event.count({ where: { ownerId: enabled, idempotencyKey: `rollback-${suffix}` } }), 0);
      await prisma.$executeRawUnsafe(`DROP TRIGGER "reject_jobs_${suffix}" ON "AIJob"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "reject_jobs_${suffix}"()`);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [enabled, disabled] } } });
    }
  });
});

realTest("actual worker child process survives crash through lease recovery and creates memory", async () => {
  const ownerId = `pg-runtime-${Date.now()}`;
  let jobId;
  await withPrisma(async (prisma) => {
    await seedUser(prisma, ownerId);
    const event = await prisma.event.create({ data: { ownerId, content: "worker runtime", occurredAt: new Date(), timezone: "UTC", localDate: "2026-09-14", idempotencyKey: `runtime-${Date.now()}`, memoryProcessingAllowed: true } });
    jobId = (await prisma.aiJob.create({ data: { ownerId, jobType: "MEMORY_EXTRACTION", resourceId: event.id, eventId: event.id, idempotencyKey: `memory:${event.id}:v1` } })).id;
  });

  const crashing = fork(fixturePath, [], { env: { ...process.env, DATABASE_URL: databaseUrl, AI_WORKER_TEST_MODE: "hang-after-claim", AI_WORKER_ID: "crashing-worker", AI_JOB_LEASE_MS: "1000" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  try {
    const claimed = await childMessage(crashing, "claimed");
    assert.equal(claimed.jobId, jobId);
    crashing.kill("SIGKILL");
    await new Promise((resolve) => crashing.once("exit", resolve));
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const restarted = fork(fixturePath, [], { env: { ...process.env, DATABASE_URL: databaseUrl, AI_WORKER_TEST_MODE: "once", AI_WORKER_ID: "restarted-worker" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    const result = await childMessage(restarted, "result");
    assert.deepEqual({ claimed: result.claimed, succeeded: result.succeeded, jobId: result.jobId }, { claimed: true, succeeded: true, jobId });
    await new Promise((resolve) => restarted.once("exit", resolve));

    await withPrisma(async (prisma) => {
      const job = await prisma.aiJob.findUnique({ where: { id: jobId } });
      assert.equal(job.status, "SUCCEEDED");
      assert.equal(job.attemptCount, 2);
      assert.equal(job.lockedBy, null);
      assert.equal(job.leaseExpiresAt, null);
      assert.ok(job.completedAt);
      assert.equal(await prisma.eventMemory.count({ where: { ownerId } }), 1);
    });
  } finally {
    if (!crashing.killed) crashing.kill("SIGKILL");
    await withPrisma((prisma) => prisma.user.delete({ where: { id: ownerId } })).catch(() => {});
  }
});

realTest("real report SQL uses Vancouver [startUtc, endUtc) across DST", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const ownerId = `pg-timezone-${suffix}`;
    await seedUser(prisma, ownerId, "America/Vancouver");
    try {
      const times = [
        ["start", "2026-03-02T08:00:00Z", "2026-03-02"],
        ["utc-next-day-local-prior", "2026-03-03T07:30:00Z", "2026-03-02"],
        ["before-dst-end", "2026-03-09T06:59:59Z", "2026-03-08"],
        ["exclusive-end", "2026-03-09T07:00:00Z", "2026-03-09"]
      ];
      for (const [label, occurredAt, localDate] of times) {
        await prisma.event.create({ data: { ownerId, content: label, occurredAt: new Date(occurredAt), timezone: "America/Vancouver", localDate, idempotencyKey: `${label}-${suffix}`, memoryProcessingAllowed: false } });
      }
      const report = await new WeeklyReportService(prisma).generate({ identity: { userId: ownerId }, localDate: "2026-03-08", asOf: new Date("2026-03-10T00:00:00Z") });
      assert.equal(report.periodStartUtc.toISOString(), "2026-03-02T08:00:00.000Z");
      assert.equal(report.periodEndUtc.toISOString(), "2026-03-09T07:00:00.000Z");
      assert.equal(report.eventCount, 3);
      const sources = await prisma.aiEvidence.findMany({ where: { weeklyReportId: report.id }, include: { sourceEvent: true } });
      assert.deepEqual(sources.map((row) => row.sourceEvent.content).sort(), ["before-dst-end", "start", "utc-next-day-local-prior"].sort());
    } finally {
      await prisma.user.delete({ where: { id: ownerId } });
    }
  });
});
