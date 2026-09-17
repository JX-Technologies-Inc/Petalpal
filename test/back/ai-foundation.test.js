import assert from "node:assert/strict";
import test from "node:test";

import {
  DeterministicMemoryExtractor,
  EventMemoryPipeline,
  PrismaMemoryRepository
} from "../../lib/event-memory.js";
import {
  AI_JOB_TYPES,
  MAX_EMBEDDING_BACKFILL_BATCH_SIZE,
  PrismaAiJobRepository,
  createEventAndEnqueueMemoryJob,
  embeddingJobProcessingVersion,
  enqueueEventMemoryEmbeddingBackfill
} from "../../lib/ai-jobs.js";
import { AiJobWorker, createProductionAiWorker } from "../../lib/ai-worker.js";
import {
  REPORT_EVIDENCE_LIMITS,
  PrivateReportRepository,
  ReportInputService,
  buildMonthlyReport,
  buildWeeklyReport,
  selectReportEvidence
} from "../../lib/report-foundation.js";
import {
  CloudflareWorkersReportNarrativeProvider,
  GroundedReportNarrativeService,
  REPORT_NARRATIVE_LIMITS,
  buildGroundedNarrativeInput,
  configuredCloudflareReportNarrativeProvider
} from "../../lib/report-narrative.js";
import { TrendAnalyzer } from "../../lib/trend-analyzer.js";
import { HybridRetrieval, RetrievalStrategyContract, yearlyQueryRouter } from "../../lib/yearly-query-router.js";
import { buildEmbeddingInput, EMBEDDING_INPUT_VERSIONS } from "../../lib/embedding-input.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY, PRODUCTION_EMBEDDING_PROFILE_SELECTED } from "../../lib/embedding-profiles.js";
import { DeterministicEmbeddingProvider, TransformersJsEmbeddingProvider } from "../../lib/embedding-provider.js";
import { EventEmbeddingService, SemanticEventRetrievalService } from "../../lib/semantic-retrieval.js";

const alice = { userId: "user-alice" };
const bob = { userId: "user-bob" };

function memoryPrisma() {
  const rows = [];
  const prisma = {
    rows,
    event: { async findFirst({ where }) { return where.ownerId === alice.userId ? { id: where.id, ownerId: where.ownerId } : null; } },
    eventMemory: {
      async findUnique({ where }) { return rows.find((row) => row.sourceEventId === where.sourceEventId) || null; },
      async create({ data }) { const row = { id: `memory-${rows.length + 1}`, embeddingInputRevision: 1, ...data }; rows.push(row); return row; },
      async update({ where, data }) {
        const row = rows.find((item) => item.id === where.id);
        const next = { ...data };
        if (next.embeddingInputRevision?.increment) {
          row.embeddingInputRevision += next.embeddingInputRevision.increment;
          delete next.embeddingInputRevision;
        }
        Object.assign(row, next);
        return row;
      },
      async findFirst({ where }) {
        return rows.find((row) =>
          row.ownerId === where.ownerId &&
          (where.id === undefined || row.id === where.id) &&
          (where.sourceEventId === undefined || row.sourceEventId === where.sourceEventId)
        ) || null;
      },
      async findMany({ where }) {
        return rows.filter((row) => row.ownerId === where.ownerId &&
          (!where.memoryType || row.memoryType === where.memoryType));
      },
      async updateMany({ where, data }) {
        const matching = rows.filter((row) => row.id === where.id && row.ownerId === where.ownerId);
        matching.forEach((row) => Object.assign(row, data));
        return { count: matching.length };
      }
    },
    async $executeRawUnsafe() { rows.forEach((row) => { row.embedding = null; }); return []; }
  };
  prisma.$transaction = async (callback) => callback(prisma);
  return prisma;
}

test("Event-only memory pipeline stores provenance before asynchronous embedding", async () => {
  const prisma = memoryPrisma();
  const pipeline = new EventMemoryPipeline({
    extractor: new DeterministicMemoryExtractor(),
    memoryRepository: new PrismaMemoryRepository(prisma)
  });

  const result = await pipeline.processEvent({
    identity: alice,
    event: { kind: "EVENT", id: "event-1", ownerId: alice.userId, content: "Started an internship", topics: ["career"], eventDate: new Date("2026-09-01") }
  });

  assert.equal(result.memory.sourceEventId, "event-1");
  assert.equal(prisma.rows[0].ownerId, alice.userId);
  assert.equal(prisma.rows[0].embeddingInputRevision, 1);
});

test("Journal cannot enter the long-term AI pipeline or invoke embedding", async () => {
  let extractorCalls = 0;
  const pipeline = new EventMemoryPipeline({
    extractor: { async extract() { extractorCalls += 1; } },
    memoryRepository: { async saveMemory() { throw new Error("must not save Journal"); } }
  });

  await assert.rejects(
    pipeline.processEvent({ identity: alice, event: { kind: "JOURNAL", id: "journal-1", content: "private" } }),
    (error) => error.code === "AI_SOURCE_NOT_ALLOWED"
  );
  assert.equal(extractorCalls, 0);
});

test("Memory repository is owner-scoped before retrieval", async () => {
  const prisma = memoryPrisma();
  const repository = new PrismaMemoryRepository(prisma);
  await repository.saveMemory({
    identity: alice,
    memory: { sourceEventId: "event-1", summary: "career milestone", topics: ["career"], people: [], eventDate: new Date() }
  });

  assert.equal((await repository.getMemoryById({ identity: bob, memoryId: "memory-1" })), null);
  assert.deepEqual(await repository.searchMemoriesForUser({ identity: bob, query: "career" }), []);
  await assert.rejects(
    repository.saveMemory({ identity: bob, memory: { ownerId: alice.userId, sourceEventId: "event-1", summary: "forged", eventDate: new Date() } }),
    (error) => error.code === "AI_FORBIDDEN"
  );
});

test("EventMemory summary changes invalidate the vector revision while non-input changes do not", async () => {
  const prisma = memoryPrisma();
  const repository = new PrismaMemoryRepository(prisma);
  const base = { sourceEventId: "event-1", summary: "career milestone", topics: ["career"], people: [], eventDate: new Date("2026-09-01") };
  const created = await repository.saveMemory({ identity: alice, memory: base });
  Object.assign(created, {
    embedding: [1],
    embeddingStatus: "GENERATED",
    embeddingModel: "Xenova/bge-small-en-v1.5",
    embeddingProfileKey: "production-bge-small-en-v1.5-v1",
    embeddingModelRevision: "main",
    embeddingInputVersion: "summary-v1",
    embeddedInputRevision: 1
  });

  const unchangedInput = await repository.saveMemory({
    identity: alice,
    memory: { ...base, topics: ["career", "work"] }
  });
  assert.equal(unchangedInput.embeddingInputRevision, 1);
  assert.equal(unchangedInput.embeddingStatus, "GENERATED");

  const changedInput = await repository.saveMemory({
    identity: alice,
    memory: { ...base, summary: "started a new internship" }
  });
  assert.equal(changedInput.embeddingInputRevision, 2);
  assert.equal(changedInput.embeddingStatus, "NOT_REQUESTED");
  assert.equal(changedInput.embeddingProfileKey, null);
  assert.equal(changedInput.embedding, null);
});

test("embedding generation skips current inputs and marks bounded provider failures", async () => {
  const updatedAt = new Date("2026-09-17T12:00:00Z");
  const prisma = {
    aiConsent: { async findUnique() { return { aiProcessing: true, personalization: true, memoryEnabled: true, updatedAt }; } }
  };
  let providerCalls = 0;
  const current = {
    id: "memory-1", sourceEventId: "event-1", summary: "current", topics: [], people: [],
    embeddingStatus: "GENERATED", embeddingInputRevision: 1
  };
  const repository = {
    profile: getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
    async getSource() { return current; },
    isCurrent() { return true; }
  };
  const skipped = await new EventEmbeddingService({
    prisma,
    repository,
    provider: { async embedDocuments() { providerCalls += 1; } }
  }).generate({ identity: alice, memoryId: current.id });
  assert.equal(skipped.skipped, true);
  assert.equal(providerCalls, 0);

  let failed = 0;
  const failingRepository = {
    ...repository,
    isCurrent() { return false; },
    async begin() {},
    async markFailed() { failed += 1; }
  };
  const service = new EventEmbeddingService({
    prisma,
    repository: failingRepository,
    timeoutMs: 10,
    provider: { async embedDocuments() { return new Promise(() => {}); } }
  });
  await assert.rejects(service.generate({ identity: alice, memoryId: current.id }), (error) => error.code === "EMBEDDING_TIMEOUT");
  assert.equal(failed, 1);
});

test("production memory worker durably enqueues the selected embedding revision", async () => {
  const jobs = [];
  const memories = [];
  const event = {
    id: "event-1",
    ownerId: alice.userId,
    content: "Started an internship",
    occurredAt: new Date("2026-09-01"),
    memoryProcessingAllowed: true
  };
  const prisma = {
    event: { async findFirst({ where }) { return where.id === event.id && where.ownerId === event.ownerId ? event : null; } },
    eventMemory: {
      async findFirst() { return null; },
      async create({ data }) {
        const row = { id: "memory-1", embeddingInputRevision: 1, ...data };
        memories.push(row);
        return row;
      }
    },
    aiJob: {
      async findUnique({ where }) {
        return jobs.find((job) => job.ownerId === where.ownerId_idempotencyKey.ownerId && job.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null;
      },
      async create({ data }) {
        const row = { id: `job-${jobs.length + 1}`, status: "PENDING", ...data };
        jobs.push(row);
        return row;
      }
    }
  };
  const embeddingProvider = {
    describeProfile() { return getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY); },
    async embedDocuments() { throw new Error("memory handler must not embed inline"); }
  };
  const worker = createProductionAiWorker({ prisma, embeddingProvider, logger: { error() {} } });
  const result = await worker.handlers[AI_JOB_TYPES.MEMORY_EXTRACTION]({ ownerId: alice.userId, eventId: event.id });
  assert.equal(memories.length, 1);
  assert.equal(result.embeddingJob.jobType, AI_JOB_TYPES.EMBEDDING_GENERATION);
  assert.equal(result.embeddingJob.resourceId, "memory-1");
  assert.equal(result.embeddingJob.eventId, "event-1");
  assert.equal(result.embeddingJob.idempotencyKey, "EMBEDDING_GENERATION:memory-1:production-bge-small-en-v1.5-v1.1");
});

test("embedding backfill is bounded, owner-preserving, cursor-based, and idempotent", async () => {
  const memories = [
    { id: "memory-1", ownerId: "owner-a", sourceEventId: "event-1", embeddingInputRevision: 1 },
    { id: "memory-2", ownerId: "owner-b", sourceEventId: "event-2", embeddingInputRevision: 2 },
    { id: "memory-3", ownerId: "owner-c", sourceEventId: "event-3", embeddingInputRevision: 1 }
  ];
  const jobs = [];
  const prisma = {
    async $queryRawUnsafe(_sql, afterId, _profileKey, _model, _modelRevision, _inputVersion, limit) {
      return memories.filter((memory) => afterId === null || memory.id > afterId).slice(0, limit);
    },
    aiJob: {
      async findUnique({ where }) {
        const key = where.ownerId_idempotencyKey;
        return jobs.find((job) => job.ownerId === key.ownerId && job.idempotencyKey === key.idempotencyKey) || null;
      },
      async create({ data }) {
        const job = { id: `job-${jobs.length + 1}`, status: "PENDING", ...data };
        jobs.push(job);
        return job;
      }
    }
  };

  const first = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 2 });
  assert.deepEqual(first, {
    profileKey: PRODUCTION_EMBEDDING_PROFILE_KEY,
    selected: 2,
    jobIds: ["job-1", "job-2"],
    nextCursor: "memory-2",
    hasMore: true
  });
  assert.deepEqual(jobs.map((job) => [job.ownerId, job.resourceId, job.eventId]), [
    ["owner-a", "memory-1", "event-1"],
    ["owner-b", "memory-2", "event-2"]
  ]);

  const repeated = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 2 });
  assert.deepEqual(repeated.jobIds, first.jobIds);
  assert.equal(jobs.length, 2);

  const second = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: 2, afterId: first.nextCursor });
  assert.equal(second.selected, 1);
  assert.equal(second.jobIds[0], "job-3");
  assert.equal(second.hasMore, false);
  assert.equal(embeddingJobProcessingVersion(2), "production-bge-small-en-v1.5-v1.2");
  await assert.rejects(
    enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize: MAX_EMBEDDING_BACKFILL_BATCH_SIZE + 1 }),
    /batchSize/
  );
});

test("backfilled embedding jobs retain the existing bounded retry lifecycle", async () => {
  const job = {
    id: "embedding-job-1",
    ownerId: alice.userId,
    jobType: AI_JOB_TYPES.EMBEDDING_GENERATION,
    resourceId: "memory-1",
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 3
  };
  const repository = {
    async claimNext() {
      if (job.status !== "PENDING") return null;
      job.status = "RUNNING";
      job.attemptCount += 1;
      return { ...job };
    },
    async markSucceeded() { throw new Error("failing provider must not succeed"); },
    async markFailed() {
      job.status = job.attemptCount >= job.maxAttempts ? "FAILED" : "PENDING";
      return { ...job };
    }
  };
  const worker = new AiJobWorker({
    repository,
    handlers: { [AI_JOB_TYPES.EMBEDDING_GENERATION]: async () => { throw new Error("provider unavailable"); } },
    retryDelayMs: 0,
    logger: { error() {} }
  });

  const attempts = [];
  for (let index = 0; index < 3; index += 1) attempts.push(await worker.runOnce());
  assert.deepEqual(attempts.map((result) => result.succeeded), [false, false, false]);
  assert.equal(job.attemptCount, 3);
  assert.equal(job.status, "FAILED");
  assert.equal((await worker.runOnce()).claimed, false);
});

test("semantic retrieval derives owner identity, embeds once, and delegates owner-filtered Top-K", async () => {
  const updatedAt = new Date("2026-09-17T12:00:00Z");
  const prisma = {
    aiConsent: { async findUnique({ where }) { return where.userId === alice.userId ? { aiProcessing: true, personalization: true, memoryEnabled: true, updatedAt } : null; } }
  };
  const calls = [];
  const provider = {
    async embedQuery(text) { calls.push(text); return { vectors: [Array(384).fill(0.25)] }; }
  };
  const repository = {
    async search(args) {
      assert.equal(args.identity, alice);
      assert.equal(args.consentUpdatedAt, updatedAt);
      assert.equal(args.vector.length, 384);
      assert.equal(args.take, 3);
      return [{ id: "memory-1", summary: "private owner result" }];
    }
  };
  const rows = await new SemanticEventRetrievalService({ prisma, provider, repository }).retrieve({
    identity: alice,
    query: " internship progress ",
    take: 3
  });
  assert.deepEqual(calls, ["internship progress"]);
  assert.deepEqual(rows.map((row) => row.id), ["memory-1"]);
  await assert.rejects(
    new SemanticEventRetrievalService({ prisma, provider, repository }).retrieve({ identity: bob, query: "private" }),
    (error) => error.code === "AI_FORBIDDEN"
  );
  assert.deepEqual(calls, ["internship progress"]);
});

test("report evidence selection filters window/source, suppresses near-duplicates, preserves changes, and is stable", () => {
  const limits = { candidateTake: 10, maxEvidence: 3, maxContextCharacters: 2_000, maxPerTheme: 2, minimumEvidence: 2 };
  const periodStartUtc = new Date("2026-09-01T00:00:00Z");
  const periodEndUtc = new Date("2026-10-01T00:00:00Z");
  const candidates = [
    { id: "memory-1", ownerId: alice.userId, sourceEventId: "event-1", memoryType: "EVENT", summary: "Started a new internship", topics: ["career"], eventDate: new Date("2026-09-03"), similarity: 0.95, importanceScore: 0.8 },
    { id: "memory-2", ownerId: alice.userId, sourceEventId: "event-2", memoryType: "EVENT", summary: "Started a new internship!", topics: ["career"], eventDate: new Date("2026-09-04"), similarity: 0.94, importanceScore: 0.7 },
    { id: "memory-3", ownerId: alice.userId, sourceEventId: "event-3", memoryType: "EVENT", summary: "Changed internship teams and felt more supported", topics: ["career"], eventDate: new Date("2026-09-20"), similarity: 0.85, importanceScore: 0.9 },
    { id: "memory-4", ownerId: alice.userId, sourceEventId: "event-4", memoryType: "EVENT", summary: "Completed the final exam", topics: ["study"], eventDate: new Date("2026-09-10"), similarity: 0.8, importanceScore: 0.8 },
    { id: "memory-old", ownerId: alice.userId, sourceEventId: "event-old", memoryType: "EVENT", summary: "Outside period", topics: ["career"], eventDate: new Date("2026-08-31"), similarity: 1 },
    { id: "journal-1", ownerId: alice.userId, sourceEventId: "journal-1", memoryType: "JOURNAL", summary: "Journal must not enter", topics: [], eventDate: new Date("2026-09-12"), similarity: 1 }
  ];
  const first = selectReportEvidence({ identity: alice, candidates, periodStartUtc, periodEndUtc, limits });
  const repeated = selectReportEvidence({ identity: alice, candidates: [...candidates].reverse(), periodStartUtc, periodEndUtc, limits });

  assert.equal(first.status, "READY");
  assert.equal(first.candidateCount, 4);
  assert.equal(first.deduplicatedCount, 3);
  assert.equal(first.selectedCount, 3);
  assert.equal(first.evidence.every((item) => item.ownerId === alice.userId), true);
  assert.deepEqual(first.evidence.map((item) => item.sourceEventId), repeated.evidence.map((item) => item.sourceEventId));
  assert.deepEqual(new Set(first.evidence.map((item) => item.sourceEventId)), new Set(["event-1", "event-3", "event-4"]));
  assert.equal(first.evidence.find((item) => item.sourceEventId === "event-3").selectionReason, "REPEATED_OR_CHANGING_THEME");
  assert.deepEqual(first.evidence[0].provenance, { sourceEventId: first.evidence[0].sourceEventId, sourceMemoryId: first.evidence[0].sourceMemoryId });
  assert.ok(first.contextCharacters <= limits.maxContextCharacters);
  assert.throws(() => selectReportEvidence({
    identity: alice,
    candidates: [{ ...candidates[0], ownerId: bob.userId }],
    periodStartUtc,
    periodEndUtc,
    limits
  }), /does not belong to the authenticated owner/);
});

test("report evidence selection reports insufficiency and enforces count/context bounds", () => {
  const periodStartUtc = new Date("2026-09-01T00:00:00Z");
  const periodEndUtc = new Date("2026-10-01T00:00:00Z");
  const limits = { candidateTake: 10, maxEvidence: 1, maxContextCharacters: 220, maxPerTheme: 1, minimumEvidence: 2 };
  const candidates = [
    { id: "memory-1", ownerId: alice.userId, sourceEventId: "event-1", memoryType: "EVENT", summary: "A".repeat(100), topics: ["career"], eventDate: new Date("2026-09-03"), similarity: 0.9 },
    { id: "memory-2", ownerId: alice.userId, sourceEventId: "event-2", memoryType: "EVENT", summary: "B".repeat(100), topics: ["study"], eventDate: new Date("2026-09-04"), similarity: 0.8 }
  ];
  const result = selectReportEvidence({ identity: alice, candidates, periodStartUtc, periodEndUtc, limits });
  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.reason, "BELOW_MINIMUM_EVIDENCE");
  assert.equal(result.selectedCount, 1);
  assert.ok(result.contextCharacters <= limits.maxContextCharacters);

  const empty = selectReportEvidence({ identity: alice, candidates: [], periodStartUtc, periodEndUtc, limits });
  assert.equal(empty.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(empty.reason, "NO_ELIGIBLE_EVIDENCE");
});

test("Weekly and Monthly report inputs reuse period aggregates and semantic retrieval with distinct bounds", async () => {
  const eventRows = [
    { id: "event-1", ownerId: alice.userId, occurredAt: new Date("2026-09-03"), memory: { id: "memory-1", topics: ["career"], importanceScore: 0.8 } },
    { id: "event-2", ownerId: alice.userId, occurredAt: new Date("2026-09-10"), memory: { id: "memory-2", topics: ["study"], importanceScore: 0.6 } },
    { id: "event-3", ownerId: alice.userId, occurredAt: new Date("2026-09-20"), memory: { id: "memory-3", topics: ["career"], importanceScore: 0.9 } }
  ];
  const prisma = {
    user: { async findUnique() { return { timezone: "UTC" }; } },
    event: {
      async findMany({ where }) {
        return eventRows.filter((event) => event.occurredAt >= where.occurredAt.gte && event.occurredAt < where.occurredAt.lt);
      }
    }
  };
  const calls = [];
  const semanticRetrieval = {
    async retrieve(args) {
      calls.push(args);
      const within = eventRows.filter((event) => event.occurredAt >= args.dateFrom && event.occurredAt < args.dateTo);
      return within.map((event, index) => ({
        id: event.memory.id,
        ownerId: alice.userId,
        sourceEventId: event.id,
        memoryType: "EVENT",
        summary: `Evidence ${event.id}`,
        topics: event.memory.topics,
        eventDate: event.occurredAt,
        importanceScore: event.memory.importanceScore,
        similarity: 1 - index / 10
      }));
    }
  };
  const service = new ReportInputService({ prisma, semanticRetrieval });
  const weekly = await service.buildWeeklyInput({ identity: alice, localDate: "2026-09-03", asOf: new Date("2026-10-02") });
  const monthly = await service.buildMonthlyInput({ identity: alice, year: 2026, month: 9, asOf: new Date("2026-10-02") });

  assert.equal(weekly.reportType, "WEEKLY");
  assert.equal(monthly.reportType, "MONTHLY");
  assert.equal(calls[0].take, REPORT_EVIDENCE_LIMITS.WEEKLY.candidateTake);
  assert.equal(calls[1].take, REPORT_EVIDENCE_LIMITS.MONTHLY.candidateTake);
  assert.equal(weekly.evidenceSelection.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(monthly.evidenceSelection.status, "READY");
  assert.equal(monthly.aggregates.eventCount, 3);
  assert.equal(monthly.evidenceSelection.evidence.every((item) => item.sourceEventId && item.sourceMemoryId), true);
});

function narrativeReportInput(reportType = "WEEKLY", status = "READY") {
  const monthly = reportType === "MONTHLY";
  const period = monthly
    ? { periodKey: "2026-09", periodStartUtc: new Date("2026-09-01T00:00:00Z"), periodEndUtc: new Date("2026-10-01T00:00:00Z") }
    : { periodKey: "2026-W36", periodStartUtc: new Date("2026-09-01T00:00:00Z"), periodEndUtc: new Date("2026-09-08T00:00:00Z") };
  const evidenceCount = monthly ? 3 : 2;
  const evidence = Array.from({ length: evidenceCount }, (_, index) => {
    const number = index + 1;
    return {
      ownerId: alice.userId,
      sourceEventId: `event-${number}`,
      sourceMemoryId: `memory-${number}`,
      eventDate: new Date(`2026-09-0${number + 1}T12:00:00Z`),
      summary: number === 1 ? "Started a new internship" : number === 2 ? "Completed an important exam" : "Changed teams at the internship",
      topics: number === 2 ? ["study"] : ["career"],
      importanceScore: 0.8,
      similarity: 0.9 - index / 10,
      selectionReason: index === 2 ? "REPEATED_OR_CHANGING_THEME" : "SEMANTIC_RELEVANCE",
      theme: number === 2 ? "study" : "career",
      provenance: { sourceEventId: `event-${number}`, sourceMemoryId: `memory-${number}` },
      rawEventText: "must never reach provider"
    };
  });
  return {
    reportType,
    ownerId: alice.userId,
    period,
    database: "must never reach provider",
    aggregates: {
      ownerId: alice.userId,
      ...period,
      eventCount: evidenceCount,
      topTopics: [{ topic: "career", count: monthly ? 2 : 1 }, { topic: "study", count: 1 }],
      importantEventIds: ["event-1", "event-2"],
      trendSignals: {
        status: "ok",
        currentEventCount: evidenceCount,
        previousEventCount: 1,
        eventCountChange: evidenceCount - 1,
        importantEventCount: 2,
        topicFrequency: [{ topic: "career", count: monthly ? 2 : 1 }, { topic: "study", count: 1 }],
        topicChanges: [{ topic: "career", currentCount: monthly ? 2 : 1, previousCount: 1, change: monthly ? 1 : 0 }]
      },
      journalContent: "must never reach provider"
    },
    evidenceSelection: {
      ownerId: alice.userId,
      status,
      reason: status === "READY" ? null : "BELOW_MINIMUM_EVIDENCE",
      selectedCount: evidence.length,
      contextCharacters: evidence.reduce((total, item) => total + item.summary.length + 96, 0),
      evidence
    }
  };
}

function narrativeProviderOutput(reportType, options = {}) {
  const first = reportType === "WEEKLY" ? "RECENT_MOMENTS" : "MAJOR_EXPERIENCES";
  const second = reportType === "WEEKLY" ? "RECURRING_THEMES" : "BROADER_RECURRING_THEMES";
  return {
    model: "test-report-model",
    sections: [
      {
        kind: first,
        claim: reportType === "WEEKLY" ? "The week included a new internship start." : "The month included a new internship and an important exam.",
        evidenceRefs: [{ sourceEventId: "event-1", sourceMemoryId: "memory-1" }],
        aggregateRefs: []
      },
      {
        kind: second,
        claim: "Career was a recurring theme in the selected evidence.",
        evidenceRefs: [{ sourceEventId: "event-1", sourceMemoryId: "memory-1" }],
        aggregateRefs: ["topTopics"]
      }
    ],
    ...options
  };
}

test("grounded adapter generates distinct Weekly and Monthly narratives", async () => {
  const calls = [];
  const provider = {
    name: "test-provider",
    async generateNarrative(input) {
      calls.push(input);
      return narrativeProviderOutput(input.report.reportType);
    }
  };
  const service = new GroundedReportNarrativeService({ provider, maxAttempts: 1 });
  const weekly = await service.generate(narrativeReportInput("WEEKLY"));
  const monthly = await service.generate(narrativeReportInput("MONTHLY"));

  assert.equal(weekly.status, "GENERATED");
  assert.equal(monthly.status, "GENERATED");
  assert.equal(weekly.sections[0].kind, "RECENT_MOMENTS");
  assert.equal(monthly.sections[0].kind, "MAJOR_EXPERIENCES");
  assert.equal(calls.length, 2);
});

test("Cloudflare report provider sends the bounded contract with shared-secret authentication", async () => {
  const input = buildGroundedNarrativeInput(narrativeReportInput("WEEKLY"));
  let request;
  const provider = new CloudflareWorkersReportNarrativeProvider({
    env: {
      CLOUDFLARE_WORKER_AI_URL: "https://petalpal.example.workers.dev/",
      CLOUDFLARE_WORKER_AI_TOKEN: "shared-secret"
    },
    async fetchImpl(url, options) {
      request = { url, options };
      return Response.json(narrativeProviderOutput("WEEKLY"));
    }
  });

  const output = await provider.generateNarrative(input);
  assert.equal(request.url, "https://petalpal.example.workers.dev/v1/report-narrative");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer shared-secret");
  assert.deepEqual(JSON.parse(request.options.body), input);
  assert.deepEqual(output, narrativeProviderOutput("WEEKLY"));
  assert.equal(provider.name, "CLOUDFLARE_WORKERS_AI");
});

test("Cloudflare report provider rejects HTTP failures, invalid JSON, and preserves aborts", async () => {
  const input = buildGroundedNarrativeInput(narrativeReportInput("WEEKLY"));
  const cases = [
    {
      fetchImpl: async () => Response.json({ error: "private provider detail" }, { status: 502 }),
      expectedCode: "REPORT_NARRATIVE_PROVIDER_FAILED"
    },
    {
      fetchImpl: async () => new Response("not-json", { status: 200 }),
      expectedCode: "REPORT_NARRATIVE_INVALID_OUTPUT"
    }
  ];
  for (const item of cases) {
    const provider = new CloudflareWorkersReportNarrativeProvider({
      env: { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "secret" },
      fetchImpl: item.fetchImpl
    });
    await assert.rejects(provider.generateNarrative(input), (error) => error.code === item.expectedCode);
  }

  const aborted = new CloudflareWorkersReportNarrativeProvider({
    env: { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "secret" },
    fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); }
  });
  await assert.rejects(aborted.generateNarrative(input), (error) => error.name === "AbortError");
});

test("Cloudflare report provider is enabled only when URL and shared secret are configured", () => {
  assert.equal(configuredCloudflareReportNarrativeProvider({ env: {}, fetchImpl: async () => {} }), null);
  assert.ok(configuredCloudflareReportNarrativeProvider({
    env: { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "secret" },
    fetchImpl: async () => Response.json({})
  }));
});

test("grounded adapter skips the provider for insufficient evidence", async () => {
  let calls = 0;
  const service = new GroundedReportNarrativeService({
    provider: { async generateNarrative() { calls += 1; } }
  });
  const result = await service.generate(narrativeReportInput("WEEKLY", "INSUFFICIENT_EVIDENCE"));
  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.narrative, null);
  assert.equal(result.attempts, 0);
  assert.equal(calls, 0);
});

test("grounded narrative provider input contains only bounded aggregates and selected evidence", async () => {
  let received;
  const service = new GroundedReportNarrativeService({
    maxAttempts: 1,
    provider: {
      async generateNarrative(input) {
        received = input;
        return narrativeProviderOutput("WEEKLY");
      }
    }
  });
  await service.generate(narrativeReportInput("WEEKLY"));
  const serialized = JSON.stringify(received);
  assert.deepEqual(Object.keys(received), ["instructions", "report"]);
  assert.deepEqual(Object.keys(received.report.aggregates), ["eventCount", "topTopics", "trendSignals"]);
  assert.equal(serialized.includes(alice.userId), false);
  assert.equal(serialized.includes("must never reach provider"), false);
  assert.ok(serialized.length <= REPORT_NARRATIVE_LIMITS.WEEKLY.maxInputCharacters);
});

test("grounded adapter rejects cross-owner aggregate or evidence before provider invocation", async () => {
  let calls = 0;
  const service = new GroundedReportNarrativeService({
    provider: { async generateNarrative() { calls += 1; } }
  });
  const aggregateMismatch = narrativeReportInput("WEEKLY");
  aggregateMismatch.aggregates.ownerId = bob.userId;
  await assert.rejects(service.generate(aggregateMismatch), (error) => error.code === "AI_FORBIDDEN");

  const evidenceMismatch = narrativeReportInput("WEEKLY");
  evidenceMismatch.evidenceSelection.evidence[0].ownerId = bob.userId;
  await assert.rejects(service.generate(evidenceMismatch), (error) => error.code === "AI_FORBIDDEN");
  assert.equal(calls, 0);
});

test("grounded narrative result preserves selected and claim-level provenance", async () => {
  const input = narrativeReportInput("MONTHLY");
  const service = new GroundedReportNarrativeService({
    maxAttempts: 1,
    provider: { async generateNarrative() { return narrativeProviderOutput("MONTHLY"); } }
  });
  const result = await service.generate(input);
  assert.equal(result.provenance.selectedEvidence.length, 3);
  assert.deepEqual(result.provenance.citedEvidence, [{ ownerId: alice.userId, sourceEventId: "event-1", sourceMemoryId: "memory-1" }]);
  assert.deepEqual(result.provenance.aggregateRefs, ["topTopics"]);
  assert.deepEqual(result.sections[0].evidenceRefs, [{ sourceEventId: "event-1", sourceMemoryId: "memory-1" }]);
});

test("grounded adapter retries bounded provider failures and never fabricates a fallback", async () => {
  let retryCalls = 0;
  const recovered = await new GroundedReportNarrativeService({
    maxAttempts: 2,
    provider: {
      async generateNarrative() {
        retryCalls += 1;
        if (retryCalls === 1) throw new Error("temporary provider failure");
        return narrativeProviderOutput("WEEKLY");
      }
    }
  }).generate(narrativeReportInput("WEEKLY"));
  assert.equal(recovered.status, "GENERATED");
  assert.equal(recovered.attempts, 2);

  const failed = await new GroundedReportNarrativeService({
    maxAttempts: 2,
    provider: { async generateNarrative() { throw new Error("provider unavailable"); } }
  }).generate(narrativeReportInput("WEEKLY"));
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.errorCode, "REPORT_NARRATIVE_PROVIDER_FAILED");
  assert.equal(failed.narrative, null);
  assert.equal(failed.attempts, 2);
});

test("grounded adapter reports bounded provider timeouts", async () => {
  let calls = 0;
  const result = await new GroundedReportNarrativeService({
    timeoutMs: 5,
    maxAttempts: 2,
    provider: { async generateNarrative() { calls += 1; return new Promise(() => {}); } }
  }).generate(narrativeReportInput("WEEKLY"));
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorCode, "REPORT_NARRATIVE_TIMEOUT");
  assert.equal(result.narrative, null);
  assert.equal(calls, 2);
});

test("grounded adapter rejects malformed or unselected provider citations", async () => {
  const malformed = await new GroundedReportNarrativeService({
    maxAttempts: 1,
    provider: { async generateNarrative() { return "not-json"; } }
  }).generate(narrativeReportInput("WEEKLY"));
  assert.equal(malformed.status, "FAILED");
  assert.equal(malformed.errorCode, "REPORT_NARRATIVE_INVALID_OUTPUT");

  const unselected = narrativeProviderOutput("WEEKLY");
  unselected.sections[0].evidenceRefs = [{ sourceEventId: "event-bob", sourceMemoryId: "memory-bob" }];
  const invalidCitation = await new GroundedReportNarrativeService({
    maxAttempts: 1,
    provider: { async generateNarrative() { return unselected; } }
  }).generate(narrativeReportInput("WEEKLY"));
  assert.equal(invalidCitation.status, "FAILED");
  assert.equal(invalidCitation.errorCode, "REPORT_NARRATIVE_INVALID_OUTPUT");
});

test("grounded narrative input is deterministic, bounded, and does not retrieve additional data", () => {
  const input = narrativeReportInput("MONTHLY");
  Object.defineProperty(input, "prisma", { get() { throw new Error("narrative adapter must not access a database"); } });
  const first = buildGroundedNarrativeInput(input);
  const second = buildGroundedNarrativeInput(input);
  assert.deepEqual(first, second);
  assert.ok(JSON.stringify(first).length <= REPORT_NARRATIVE_LIMITS.MONTHLY.maxInputCharacters);
});

test("Weekly and monthly reports are owner-scoped before access", async () => {
  const calls = [];
  const repository = new PrivateReportRepository({
    weeklyReport: { async findFirst(args) { calls.push(args); return args.where.ownerId === alice.userId ? { id: args.where.id } : null; } },
    monthlyReport: { async findFirst(args) { calls.push(args); return args.where.ownerId === alice.userId ? { id: args.where.id } : null; } },
    yearlyReport: { async findFirst(args) { calls.push(args); return args.where.ownerId === alice.userId ? { id: args.where.id } : null; } }
  });
  assert.deepEqual(await repository.getWeeklyReportById({ identity: alice, reportId: "report-1" }), { id: "report-1" });
  assert.equal(await repository.getMonthlyReportById({ identity: bob, reportId: "report-1" }), null);
  assert.equal(calls[1].where.ownerId, bob.userId);
});

test("Weekly and monthly aggregation is deterministic and evidence-backed", () => {
  const current = [
    { id: "event-1", ownerId: alice.userId, topics: ["career", "study"], importanceScore: 0.9 },
    { id: "event-2", ownerId: alice.userId, topics: ["career"], importanceScore: 0.4 }
  ];
  const previous = [{ id: "event-0", ownerId: alice.userId, topics: ["study"], importanceScore: 0.5 }];
  const weekly = buildWeeklyReport({ identity: alice, periodStart: new Date("2026-09-07"), periodEnd: new Date("2026-09-14"), currentEvents: current, previousEvents: previous });
  const monthly = buildMonthlyReport({ identity: alice, year: 2026, month: 9, currentEvents: current, previousEvents: previous });

  assert.equal(weekly.eventCount, 2);
  assert.deepEqual(weekly.importantEventIds, ["event-1"]);
  assert.equal(weekly.trendSignals.topicChanges.find((topic) => topic.topic === "career").change, 2);
  assert.deepEqual(monthly.turningPointEventIds, ["event-1"]);
  assert.equal(Object.hasOwn(monthly, "evidenceEventIds"), false);
  assert.throws(() => buildWeeklyReport({ identity: alice, currentEvents: [{ id: "event-bob", ownerId: bob.userId }] }), /does not belong/);
});

test("Trend analysis reports insufficient data instead of inventing a trend", () => {
  const result = new TrendAnalyzer().analyzeWeekly({ currentEvents: [], previousEvents: [{ id: "old" }] });
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.currentEventCount, 0);
  assert.equal(result.eventCountChange, -1);
});

test("AI jobs are version-idempotent and Event plus processing intent are atomic", async () => {
  const jobs = [];
  const events = [];
  const tx = {
    user: {
      async findUnique() {
        return {
          timezone: "America/Vancouver",
          aiConsent: { termsVersion: "2026-09", aiProcessing: true, personalization: true, memoryEnabled: true }
        };
      }
    },
    event: {
      async findUnique({ where }) {
        return events.find((event) => event.ownerId === where.ownerId_idempotencyKey.ownerId && event.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null;
      },
      async create({ data }) {
        const event = { id: `event-${events.length + 1}`, ...data };
        events.push(event);
        return event;
      }
    },
    aiJob: {
      async findUnique({ where }) { return jobs.find((job) => job.ownerId === where.ownerId_idempotencyKey.ownerId && job.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null; },
      async create({ data }) { const job = { id: `job-${jobs.length + 1}`, status: "PENDING", ...data }; jobs.push(job); return job; }
    }
  };
  const prisma = {
    ...tx,
    async $transaction(callback) { return callback(tx); }
  };
  const repository = new PrismaAiJobRepository(prisma);
  const first = await repository.enqueue({ identity: alice, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION, resourceId: "event-existing" });
  const second = await repository.enqueue({ identity: alice, jobType: AI_JOB_TYPES.MEMORY_EXTRACTION, resourceId: "event-existing" });
  assert.equal(first.id, second.id);
  assert.equal(jobs.length, 1);

  const result = await createEventAndEnqueueMemoryJob({
    prisma,
    identity: alice,
    content: "A durable Event",
    occurredAt: new Date("2026-09-15T06:30:00Z"),
    idempotencyKey: "mobile-request-1"
  });
  assert.equal(result.event.id, "event-1");
  assert.equal(result.event.localDate, "2026-09-14");
  assert.equal(result.job.eventId, result.event.id);
  assert.equal(events.length, 1);
  assert.equal(jobs.length, 2);

  const retry = await createEventAndEnqueueMemoryJob({
    prisma,
    identity: alice,
    content: "A durable Event",
    idempotencyKey: "mobile-request-1"
  });
  assert.equal(retry.created, false);
  assert.equal(events.length, 1);
});

test("Yearly router selects simple retrieval strategies and hybrid retrieval preserves owner context", async () => {
  assert.equal(yearlyQueryRouter.route("Who appeared most this year?").strategy, "SQL_RETRIEVAL");
  assert.equal(yearlyQueryRouter.route("When did I first record internship?").strategy, "KEYWORD_RETRIEVAL");
  assert.equal(yearlyQueryRouter.route("When did I feel more confident?").strategy, "VECTOR_SEMANTIC_RETRIEVAL");

  class FakeStrategy extends RetrievalStrategyContract {
    async retrieve({ identity }) { return [{ id: identity.userId, source: this.name }]; }
  }
  const retrieval = new HybridRetrieval([new FakeStrategy("SQL"), new FakeStrategy("VECTOR")]);
  assert.deepEqual(await retrieval.retrieve({ identity: alice, query: "confidence" }), [{ id: alice.userId, source: "VECTOR" }]);
});

test("embedding canonicalization is deterministic, normalized, and excludes private/non-provenance fields", () => {
  const memory = {
    sourceType: "EVENT", sourceEventId: "event-1", summary: "  Café\r\nnotes  ",
    topics: ["zeta", "é", "zeta"], people: ["Bob", "Alice", "Bob"],
    ownerId: "must-not-embed", rawEventText: "must-not-embed", emotion: "must-not-embed"
  };
  const first = buildEmbeddingInput(memory, EMBEDDING_INPUT_VERSIONS.STRUCTURED_V1);
  const second = buildEmbeddingInput({ ...memory, topics: ["é", "zeta"], people: ["Alice", "Bob"] }, EMBEDDING_INPUT_VERSIONS.STRUCTURED_V1);
  assert.deepEqual(first, second);
  assert.match(first.canonicalText, /Café\\nnotes/);
  assert.match(first.canonicalText, /"topics":\["é","zeta"\]/);
  assert.equal(first.canonicalText.includes("must-not-embed"), false);
  assert.equal(first.inputHash.length, 64);
  assert.notEqual(first.inputHash, buildEmbeddingInput(memory, EMBEDDING_INPUT_VERSIONS.SUMMARY_V1).inputHash);
});

test("embedding input rejects invalid, oversized, Journal, alias, and unprovenanced inputs", () => {
  assert.throws(() => buildEmbeddingInput({ sourceType: "EVENT", sourceEventId: "event-1", summary: "" }), /must not be empty/);
  assert.throws(() => buildEmbeddingInput({ sourceType: "EVENT", sourceEventId: "event-1", summary: "x".repeat(8001) }), /exceeds/);
  for (const sourceType of ["JOURNAL", "LEGACY_EVENT_ALIAS", undefined]) {
    assert.throws(() => buildEmbeddingInput({ sourceType, sourceEventId: "event-1", summary: "private" }), /provenance|Only/);
  }
});

test("embedding profiles are fixed server-side and unknown profiles are rejected", () => {
  assert.equal(PRODUCTION_EMBEDDING_PROFILE_SELECTED, true);
  assert.equal(PRODUCTION_EMBEDDING_PROFILE_KEY, "production-bge-small-en-v1.5-v1");
  const production = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
  assert.equal(production.environment, "PRODUCTION");
  assert.equal(production.dimensions, 384);
  assert.equal(production.inputVersion, "summary-v1");
  const profile = getEmbeddingProfile("test-deterministic-v1");
  assert.deepEqual(Object.keys(profile), ["profileKey", "environment", "provider", "model", "modelRevision", "dimensions", "metric", "inputVersion", "documentEncoding", "queryEncoding", "maximumInputCharacters"]);
  assert.equal(profile.dimensions, 8);
  assert.throws(() => getEmbeddingProfile("client-selected-model"), /Unknown embedding profile/);
});

test("local production embedding provider applies role-specific encoding and validates 384 dimensions", async () => {
  const calls = [];
  const pipelineFactory = async () => async (texts, options) => {
    calls.push({ texts, options });
    return { data: new Float32Array(texts.length * 384).fill(0.25), dims: [texts.length, 384] };
  };
  const provider = new TransformersJsEmbeddingProvider(PRODUCTION_EMBEDDING_PROFILE_KEY, { pipelineFactory });
  const documents = await provider.embedDocuments(["document one", "document two"]);
  const queries = await provider.embedQueries(["find my event"]);
  assert.equal(documents.vectors.length, 2);
  assert.equal(documents.dimensions, 384);
  assert.equal(queries.vectors.length, 1);
  assert.equal(calls[0].texts[0], "document one");
  assert.match(calls[1].texts[0], /^Represent this sentence for searching relevant passages: find my event$/);
  assert.deepEqual(calls[0].options, { pooling: "mean", normalize: true });
  assert.equal(queries.cost.apiCostUsd, 0);
});

test("embedding provider preserves batch order, separates query/document contracts, and rejects invalid vectors/revisions", async () => {
  const provider = new DeterministicEmbeddingProvider();
  const documents = await provider.embedDocuments(["first", "second"]);
  assert.equal(documents.vectors.length, 2);
  assert.notDeepEqual(documents.vectors[0], documents.vectors[1]);
  const query = await provider.embedQuery("query");
  assert.equal(query.vectors.length, 1);
  assert.equal(query.dimensions, 8);
  for (const behavior of [{ invalid: "wrong-dimensions" }, { invalid: "NaN" }, { invalid: "Infinity" }, { modelRevision: "other" }]) {
    await assert.rejects(new DeterministicEmbeddingProvider("test-deterministic-v1", behavior).embedDocuments(["x"]), /invalid|revision/i);
  }
  for (const failure of ["timeout", "429", "5xx"]) {
    await assert.rejects(new DeterministicEmbeddingProvider("test-deterministic-v1", { failure }).embedDocuments(["x"]), /timed out|rate limited|failed/i);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(provider.embedDocuments(["x"], { signal: controller.signal }), /aborted/i);
});
