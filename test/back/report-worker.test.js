import assert from "node:assert/strict";
import test from "node:test";

import cloudflareWorker, { DEFAULT_REPORT_NARRATIVE_MODEL } from "../../cloudflare-worker/src/index.js";
import { AI_JOB_TYPES } from "../../lib/ai-jobs.js";
import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import {
  CloudflareWorkersReportNarrativeProvider,
  REPORT_NARRATIVE_GENERATION_VERSION
} from "../../lib/report-narrative.js";

const ownerId = "report-owner";
const otherOwnerId = "other-owner";

function embeddingProvider() {
  return {
    describeProfile() { return getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY); },
    async embedDocuments() { throw new Error("report tests must not embed documents"); },
    async embedQuery() { throw new Error("injected report retrieval must handle queries"); }
  };
}

function reportEvents() {
  return [
    { id: "event-1", ownerId, occurredAt: new Date("2026-09-15T12:00:00Z"), memory: { id: "memory-1", topics: ["career"], importanceScore: 0.9 } },
    { id: "event-2", ownerId, occurredAt: new Date("2026-09-16T12:00:00Z"), memory: { id: "memory-2", topics: ["study"], importanceScore: 0.8 } },
    { id: "event-3", ownerId, occurredAt: new Date("2026-09-20T12:00:00Z"), memory: { id: "memory-3", topics: ["career"], importanceScore: 0.7 } },
    { id: "event-previous", ownerId, occurredAt: new Date("2026-09-10T12:00:00Z"), memory: { id: "memory-previous", topics: ["study"], importanceScore: 0.5 } }
  ];
}

function createReportPrisma() {
  const state = {
    events: reportEvents(),
    weeklyReports: [],
    monthlyReports: [],
    evidence: [],
    failEvidence: false
  };

  function rowsFor(type) {
    return type === "WEEKLY" ? state.weeklyReports : state.monthlyReports;
  }

  function reportFor(type, where) {
    const rows = rowsFor(type);
    const key = where.ownerId_periodKey || where.ownerId_year_month;
    return rows.find((row) => row.ownerId === key.ownerId && (
      type === "WEEKLY"
        ? row.periodKey === key.periodKey
        : row.year === key.year && row.month === key.month
    )) || null;
  }

  function model(type) {
    const reportField = type === "WEEKLY" ? "weeklyReportId" : "monthlyReportId";
    return {
      async findFirst({ where, include }) {
        const row = rowsFor(type).find((item) =>
          item.ownerId === where.ownerId &&
          item.periodKey === where.periodKey &&
          (!where.narrativeStatus || item.narrativeStatus !== where.narrativeStatus.not)
        ) || null;
        return row && include?.evidence
          ? { ...row, evidence: state.evidence.filter((item) => item[reportField] === row.id) }
          : row;
      },
      async findUnique({ where }) { return reportFor(type, where); },
      async upsert({ where, update, create }) {
        const existing = reportFor(type, where);
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        const row = { id: `${type.toLowerCase()}-${rowsFor(type).length + 1}`, ...create };
        rowsFor(type).push(row);
        return { ...row };
      }
    };
  }

  const prisma = {
    state,
    user: {
      async findUnique({ where }) { return where.id === ownerId ? { timezone: "UTC" } : null; }
    },
    event: {
      async findMany({ where }) {
        return state.events.filter((event) =>
          event.ownerId === where.ownerId &&
          event.occurredAt >= where.occurredAt.gte &&
          event.occurredAt < where.occurredAt.lt
        );
      }
    },
    weeklyReport: model("WEEKLY"),
    monthlyReport: model("MONTHLY"),
    aiEvidence: {
      async deleteMany({ where }) {
        for (let index = state.evidence.length - 1; index >= 0; index -= 1) {
          const item = state.evidence[index];
          if (item.ownerId === where.ownerId && Object.entries(where).every(([key, value]) => key === "ownerId" || item[key] === value)) {
            state.evidence.splice(index, 1);
          }
        }
      },
      async createMany({ data }) {
        if (state.failEvidence) throw new Error("forced evidence persistence failure");
        state.evidence.push(...data.map((item, index) => ({ id: `evidence-${state.evidence.length + index + 1}`, ...item })));
      }
    },
    async $transaction(callback) {
      const snapshot = structuredClone({
        weeklyReports: state.weeklyReports,
        monthlyReports: state.monthlyReports,
        evidence: state.evidence
      });
      try {
        return await callback(prisma);
      } catch (error) {
        state.weeklyReports.splice(0, state.weeklyReports.length, ...snapshot.weeklyReports);
        state.monthlyReports.splice(0, state.monthlyReports.length, ...snapshot.monthlyReports);
        state.evidence.splice(0, state.evidence.length, ...snapshot.evidence);
        throw error;
      }
    }
  };
  return prisma;
}

function semanticRetrieval(prisma, { take = Infinity, candidateOwnerId = ownerId } = {}) {
  return {
    async retrieve({ identity, dateFrom, dateTo }) {
      assert.equal(identity.userId, ownerId);
      return prisma.state.events
        .filter((event) => event.ownerId === ownerId && event.occurredAt >= dateFrom && event.occurredAt < dateTo)
        .slice(0, take)
        .map((event, index) => ({
          id: event.memory.id,
          ownerId: candidateOwnerId,
          sourceEventId: event.id,
          memoryType: "EVENT",
          summary: `Selected evidence for ${event.id}`,
          topics: event.memory.topics,
          eventDate: event.occurredAt,
          importanceScore: event.memory.importanceScore,
          similarity: 1 - index / 10
        }));
    }
  };
}

function validProviderOutput(reportType) {
  return {
    model: "test-grounded-model",
    sections: [{
      kind: reportType === "WEEKLY" ? "RECENT_MOMENTS" : "MAJOR_EXPERIENCES",
      claim: reportType === "WEEKLY" ? "The week included meaningful career and study moments." : "The month included meaningful career and study experiences.",
      evidenceRefs: [{ sourceEventId: "event-1", sourceMemoryId: "memory-1" }],
      aggregateRefs: ["topTopics"]
    }]
  };
}

function reportJob(jobType, resourceId, overrides = {}) {
  return {
    id: `job-${jobType.toLowerCase()}`,
    ownerId,
    jobType,
    resourceId,
    idempotencyKey: `${jobType}:${resourceId}:${REPORT_NARRATIVE_GENERATION_VERSION}`,
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 3,
    ...overrides
  };
}

function jobRepository(job) {
  return {
    job,
    async claimNext({ workerId, now }) {
      if (job.status !== "PENDING") return null;
      job.status = "RUNNING";
      job.lockedBy = workerId;
      job.lockedAt = now;
      job.attemptCount += 1;
      return { ...job };
    },
    async claimById({ jobId, ownerId: claimedOwnerId, jobType, workerId, now }) {
      if (
        job.status !== "PENDING" ||
        job.id !== jobId ||
        job.ownerId !== claimedOwnerId ||
        job.jobType !== jobType
      ) return null;
      job.status = "RUNNING";
      job.lockedBy = workerId;
      job.lockedAt = now;
      job.attemptCount += 1;
      return { ...job };
    },
    async markSucceeded() {
      job.status = "SUCCEEDED";
      job.lockedBy = null;
      return { count: 1 };
    },
    async markFailed() {
      job.status = job.attemptCount >= job.maxAttempts ? "FAILED" : "PENDING";
      job.lockedBy = null;
      return { ...job };
    }
  };
}

function reportWorker({ prisma, job, provider, retrieval = semanticRetrieval(prisma), timeoutMs = 100 }) {
  const worker = createProductionAiWorker({
    prisma,
    embeddingProvider: embeddingProvider(),
    semanticRetrieval: retrieval,
    reportNarrativeProvider: provider,
    reportNarrativeTimeoutMs: timeoutMs,
    logger: { error() {} },
    retryDelayMs: 0
  });
  worker.repository = jobRepository(job);
  return worker;
}

test("Weekly report worker generates and atomically persists grounded narrative evidence", async () => {
  const prisma = createReportPrisma();
  let providerCalls = 0;
  let aiCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14");
  const liveSmoke = process.env.PETALPAL_REAL_REPORT_SMOKE === "1";
  const provider = new CloudflareWorkersReportNarrativeProvider({
    env: { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "secret" },
    async fetchImpl(url, options) {
      providerCalls += 1;
      if (liveSmoke) {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        if (!accountId || !apiToken) throw new Error("Real report smoke requires Cloudflare account credentials");
        return cloudflareWorker.fetch(new Request(url, options), {
          RENDER_SHARED_SECRET: "secret",
          REPORT_NARRATIVE_MODEL: DEFAULT_REPORT_NARRATIVE_MODEL,
          AI: {
            async run(model, input) {
              aiCalls += 1;
              const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
                body: JSON.stringify(input)
              });
              const envelope = await response.json();
              if (!response.ok || envelope.success !== true) {
                const error = new Error("Cloudflare Workers AI smoke inference failed");
                error.code = envelope.errors?.[0]?.code || response.status;
                throw error;
              }
              return envelope.result;
            }
          }
        });
      }
      const input = JSON.parse(options.body);
      return Response.json(validProviderOutput(input.report.reportType));
    }
  });
  const worker = reportWorker({
    prisma,
    job,
    provider
  });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });

  assert.equal(result.succeeded, true);
  assert.equal(result.result.status, "GENERATED");
  assert.equal(job.status, "SUCCEEDED");
  assert.equal(providerCalls, 1);
  assert.equal(aiCalls, liveSmoke ? 1 : 0);
  assert.equal(prisma.state.weeklyReports.length, 1);
  assert.equal(prisma.state.weeklyReports[0].narrativeStatus, "GENERATED");
  assert.equal(prisma.state.weeklyReports[0].narrativeSections.length, 1);
  assert.equal(prisma.state.evidence.length, 3);
  assert.equal(prisma.state.evidence.filter((item) => item.claimType === "NARRATIVE_CITED").length, 1);
});

test("targeted Weekly execution cannot claim another owner or arbitrary job type", async () => {
  const prisma = createReportPrisma();
  let providerCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14");
  const worker = reportWorker({
    prisma,
    job,
    provider: {
      async generateNarrative(input) {
        providerCalls += 1;
        return validProviderOutput(input.report.reportType);
      }
    }
  });
  const now = new Date("2026-09-22T00:00:00Z");

  assert.deepEqual(await worker.runJob({
    jobId: job.id,
    ownerId: otherOwnerId,
    jobType: AI_JOB_TYPES.WEEKLY_REPORT,
    now
  }), { claimed: false });
  assert.deepEqual(await worker.runJob({
    jobId: job.id,
    ownerId,
    jobType: AI_JOB_TYPES.MONTHLY_REPORT,
    now
  }), { claimed: false });
  assert.equal(providerCalls, 0);

  const result = await worker.runJob({
    jobId: job.id,
    ownerId,
    jobType: AI_JOB_TYPES.WEEKLY_REPORT,
    now
  });
  assert.equal(result.succeeded, true);
  assert.equal(providerCalls, 1);
  assert.equal(job.status, "SUCCEEDED");
});

test("Monthly report worker generates and atomically persists grounded narrative evidence", async () => {
  const prisma = createReportPrisma();
  const job = reportJob(AI_JOB_TYPES.MONTHLY_REPORT, "2026-09");
  const worker = reportWorker({
    prisma,
    job,
    provider: { async generateNarrative(input) { return validProviderOutput(input.report.reportType); } }
  });
  const result = await worker.runOnce({ now: new Date("2026-10-02T00:00:00Z") });

  assert.equal(result.succeeded, true);
  assert.equal(prisma.state.monthlyReports.length, 1);
  assert.equal(prisma.state.monthlyReports[0].narrativeStatus, "GENERATED");
  assert.equal(prisma.state.monthlyReports[0].periodKey, "2026-09");
  assert.equal(prisma.state.evidence.length, 4);
  assert.equal(new Set(prisma.state.evidence.map((item) => item.sourceEventId)).size, 4);
});

test("INSUFFICIENT_EVIDENCE is persisted without calling the provider", async () => {
  const prisma = createReportPrisma();
  let providerCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14");
  const worker = reportWorker({
    prisma,
    job,
    retrieval: semanticRetrieval(prisma, { take: 1 }),
    provider: { async generateNarrative() { providerCalls += 1; } }
  });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });

  assert.equal(result.succeeded, true);
  assert.equal(result.result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(providerCalls, 0);
  assert.equal(prisma.state.weeklyReports[0].narrativeStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(prisma.state.weeklyReports[0].summary, null);
  assert.deepEqual(prisma.state.weeklyReports[0].narrativeSections, []);
  assert.equal(prisma.state.evidence.length, 1);
});

test("provider failure and timeout use the existing bounded job failure lifecycle", async () => {
  for (const behavior of [
    async () => { throw new Error("provider unavailable"); },
    async () => new Promise(() => {})
  ]) {
    const prisma = createReportPrisma();
    const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14", { maxAttempts: 1 });
    const worker = reportWorker({ prisma, job, timeoutMs: 5, provider: { generateNarrative: behavior } });
    const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
    assert.equal(result.succeeded, false);
    assert.equal(job.status, "FAILED");
    assert.equal(prisma.state.weeklyReports.length, 0);
    assert.equal(prisma.state.evidence.length, 0);
  }
});

test("malformed provider output fails the job without persisting a report", async () => {
  const prisma = createReportPrisma();
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14", { maxAttempts: 1 });
  const worker = reportWorker({ prisma, job, provider: { async generateNarrative() { return "not-json"; } } });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
  assert.equal(result.succeeded, false);
  assert.equal(result.error.code, "REPORT_NARRATIVE_INVALID_OUTPUT");
  assert.equal(job.status, "FAILED");
  assert.equal(prisma.state.weeklyReports.length, 0);
});

test("persistence failure rolls back report status, claims, and provenance together", async () => {
  const prisma = createReportPrisma();
  prisma.state.failEvidence = true;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14");
  const worker = reportWorker({
    prisma,
    job,
    provider: { async generateNarrative(input) { return validProviderOutput(input.report.reportType); } }
  });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
  assert.equal(result.succeeded, false);
  assert.equal(job.status, "PENDING");
  assert.equal(prisma.state.weeklyReports.length, 0);
  assert.equal(prisma.state.evidence.length, 0);
});

test("job retry and replay are idempotent and do not duplicate report claims or provenance", async () => {
  const prisma = createReportPrisma();
  let providerCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14", { maxAttempts: 2 });
  const worker = reportWorker({
    prisma,
    job,
    provider: {
      async generateNarrative(input) {
        providerCalls += 1;
        if (providerCalls === 1) throw new Error("temporary failure");
        return validProviderOutput(input.report.reportType);
      }
    }
  });
  const now = new Date("2026-09-22T00:00:00Z");
  assert.equal((await worker.runOnce({ now })).succeeded, false);
  assert.equal((await worker.runOnce({ now })).succeeded, true);
  assert.equal(job.attemptCount, 2);
  assert.equal(prisma.state.weeklyReports.length, 1);
  assert.equal(prisma.state.evidence.length, 3);

  const replay = await worker.handlers[AI_JOB_TYPES.WEEKLY_REPORT]({ ...job, status: "RUNNING", lockedAt: now });
  assert.equal(replay.skipped, true);
  assert.equal(providerCalls, 2);
  assert.equal(prisma.state.weeklyReports.length, 1);
  assert.equal(prisma.state.weeklyReports[0].narrativeSections.length, 1);
  assert.equal(prisma.state.evidence.length, 3);
});

test("cross-owner evidence is rejected across the worker path", async () => {
  const prisma = createReportPrisma();
  let providerCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14", { maxAttempts: 1 });
  const worker = reportWorker({
    prisma,
    job,
    retrieval: semanticRetrieval(prisma, { candidateOwnerId: otherOwnerId }),
    provider: { async generateNarrative() { providerCalls += 1; } }
  });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
  assert.equal(result.succeeded, false);
  assert.equal(job.status, "FAILED");
  assert.equal(providerCalls, 0);
  assert.equal(prisma.state.weeklyReports.length, 0);
});

test("stale report jobs are successful no-ops and cannot overwrite a finalized result", async () => {
  const prisma = createReportPrisma();
  prisma.state.weeklyReports.push({
    id: "weekly-newer",
    ownerId,
    periodKey: "2026-09-14",
    narrativeStatus: "GENERATED",
    narrativeSections: [{ kind: "RECENT_MOMENTS", claim: "Trusted newer result" }],
    summary: "Trusted newer result",
    generationVersion: "grounded-narrative-v2"
  });
  let providerCalls = 0;
  const job = reportJob(AI_JOB_TYPES.WEEKLY_REPORT, "2026-09-14", {
    idempotencyKey: `${AI_JOB_TYPES.WEEKLY_REPORT}:2026-09-14:grounded-narrative-v0`
  });
  const worker = reportWorker({
    prisma,
    job,
    provider: { async generateNarrative() { providerCalls += 1; return validProviderOutput("WEEKLY"); } }
  });
  const result = await worker.runOnce({ now: new Date("2026-09-22T00:00:00Z") });
  assert.equal(result.succeeded, true);
  assert.equal(result.result.status, "STALE_JOB");
  assert.equal(providerCalls, 0);
  assert.equal(prisma.state.weeklyReports[0].summary, "Trusted newer result");
  assert.equal(prisma.state.weeklyReports.length, 1);
});
