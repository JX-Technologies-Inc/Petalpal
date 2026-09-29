import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

import { executeAiJobById, listDispatchableAiJobs } from "../../lib/ai-async-dispatch.js";
import { AI_JOB_TYPES, PrismaAiJobRepository } from "../../lib/ai-jobs.js";
import { AiJobWorker, createProductionAiWorker } from "../../lib/ai-worker.js";

const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;

async function withPrisma(callback) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try { return await callback(prisma); }
  finally { await prisma.$disconnect(); }
}

async function seed(prisma, ownerId, { maxAttempts = 3 } = {}) {
  await prisma.user.create({ data: { id: ownerId, name: ownerId } });
  await prisma.aiConsent.create({ data: {
    userId: ownerId, termsVersion: "test", aiProcessing: true,
    personalization: true, memoryEnabled: true, grantedAt: new Date()
  } });
  const event = await prisma.event.create({ data: {
    ownerId, content: "Synthetic quiet day", occurredAt: new Date(), timezone: "UTC",
    localDate: "2026-09-28", idempotencyKey: `async-${ownerId}`,
    memoryProcessingAllowed: true
  } });
  const job = await prisma.aiJob.create({ data: {
    ownerId, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION, resourceId: event.id,
    eventId: event.id, idempotencyKey: `async-memory:${event.id}`,
    maxAttempts, nextAttemptAt: new Date(Date.now() - 1_000)
  } });
  return { event, job };
}

realTest("reconciliation finds stranded due jobs only for the selected shadow owner", async () => {
  await withPrisma(async (prisma) => {
    const suffix = Date.now();
    const firstOwner = `async-shadow-${suffix}`;
    const secondOwner = `async-other-${suffix}`;
    try {
      const first = await seed(prisma, firstOwner);
      const second = await seed(prisma, secondOwner);
      const rows = await listDispatchableAiJobs(prisma, {
        env: { AI_ASYNC_EXECUTION_MODE: "shadow", AI_ASYNC_SHADOW_OWNER_ID: firstOwner }
      });
      assert.ok(rows.some((row) => row.jobId === first.job.id));
      assert.ok(rows.every((row) => row.jobId !== second.job.id));
      assert.ok(rows.length <= 5);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [firstOwner, secondOwner] } } });
    }
  });
});

realTest("duplicate delivery is a no-op and a healthy lease blocks concurrent execution", async () => {
  await withPrisma(async (prisma) => {
    const ownerId = `async-lease-${Date.now()}`;
    try {
      const { job } = await seed(prisma, ownerId);
      const repository = new PrismaAiJobRepository(prisma);
      let executions = 0;
      const workerFactory = () => new AiJobWorker({
        repository, workerId: `async-worker-${ownerId}`, leaseMs: 1_000,
        handlers: { [AI_JOB_TYPES.MEMORY_EXTRACTION]: async () => { executions++; return {}; } },
        logger: { error() {} }
      });
      const env = { AI_ASYNC_EXECUTION_MODE: "shadow", AI_ASYNC_SHADOW_OWNER_ID: ownerId };
      const claimedAt = new Date();
      await repository.claimById({ jobId: job.id, ownerId, jobType: job.jobType, workerId: "first-lease", now: claimedAt, leaseMs: 1_000 });
      const leased = await executeAiJobById({ prisma, jobId: job.id, workerFactory, env, now: claimedAt });
      assert.equal(leased.outcome, "LEASED");
      assert.equal(executions, 0);
      const recovered = await executeAiJobById({ prisma, jobId: job.id, workerFactory, env,
        now: new Date(claimedAt.getTime() + 1_001) });
      assert.equal(recovered.outcome, "SUCCEEDED");
      assert.equal(executions, 1);
      assert.equal((await executeAiJobById({ prisma, jobId: job.id, workerFactory, env })).outcome, "SUCCEEDED");
      assert.equal(executions, 1);
      assert.equal((await prisma.aiJob.findUnique({ where: { id: job.id } })).attemptCount, 2);
    } finally { await prisma.user.delete({ where: { id: ownerId } }); }
  });
});

realTest("expired exhausted job becomes terminal FAILED without rerunning", async () => {
  await withPrisma(async (prisma) => {
    const ownerId = `async-exhausted-${Date.now()}`;
    try {
      const { job } = await seed(prisma, ownerId, { maxAttempts: 1 });
      const repository = new PrismaAiJobRepository(prisma);
      const claimedAt = new Date();
      await repository.claimById({ jobId: job.id, ownerId, jobType: job.jobType, workerId: "lost-worker", now: claimedAt, leaseMs: 1_000 });
      const result = await executeAiJobById({ prisma, jobId: job.id,
        env: { AI_ASYNC_EXECUTION_MODE: "shadow", AI_ASYNC_SHADOW_OWNER_ID: ownerId },
        now: new Date(claimedAt.getTime() + 1_001),
        workerFactory: () => new AiJobWorker({ repository, workerId: "recovery-worker", leaseMs: 1_000,
          handlers: { [AI_JOB_TYPES.MEMORY_EXTRACTION]: () => { throw new Error("must not run"); } } })
      });
      assert.equal(result.outcome, "FAILED");
      const stored = await prisma.aiJob.findUnique({ where: { id: job.id } });
      assert.equal(stored.attemptCount, 1);
      assert.equal(stored.lockedBy, null);
    } finally { await prisma.user.delete({ where: { id: ownerId } }); }
  });
});

realTest("consent revoked after enqueue cancels targeted work without EventMemory", async () => {
  await withPrisma(async (prisma) => {
    const ownerId = `async-revoke-${Date.now()}`;
    try {
      const { event, job } = await seed(prisma, ownerId);
      await prisma.aiConsent.update({ where: { userId: ownerId }, data: {
        aiProcessing: false, personalization: false, memoryEnabled: false, revokedAt: new Date()
      } });
      const result = await executeAiJobById({ prisma, jobId: job.id,
        env: { AI_ASYNC_EXECUTION_MODE: "shadow", AI_ASYNC_SHADOW_OWNER_ID: ownerId },
        workerFactory: () => createProductionAiWorker({ prisma, logger: { error() {} } })
      });
      assert.equal(result.outcome, "CANCELLED");
      assert.equal(await prisma.eventMemory.count({ where: { sourceEventId: event.id } }), 0);
    } finally { await prisma.user.delete({ where: { id: ownerId } }); }
  });
});
