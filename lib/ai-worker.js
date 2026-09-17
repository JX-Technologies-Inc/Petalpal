import { randomUUID } from "node:crypto";

import {
  AI_JOB_TYPES,
  PrismaAiJobRepository,
  embeddingJobProcessingVersion
} from "./ai-jobs.js";
import { PRODUCTION_EMBEDDING_PROFILE_KEY } from "./embedding-profiles.js";
import { TransformersJsEmbeddingProvider } from "./embedding-provider.js";
import {
  DeterministicMemoryExtractor,
  EventMemoryPipeline,
  PrismaMemoryRepository
} from "./event-memory.js";
import { GroundedReportPersistenceService, ReportInputService } from "./report-foundation.js";
import {
  GroundedReportNarrativeService,
  REPORT_NARRATIVE_GENERATION_VERSION
} from "./report-narrative.js";
import { EventEmbeddingService, SemanticEventRetrievalService } from "./semantic-retrieval.js";

function abortableDelay(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export class AiJobWorker {
  constructor({
    repository,
    handlers,
    workerId = `ai-worker-${randomUUID()}`,
    leaseMs = 60_000,
    pollIntervalMs = 1_000,
    retryDelayMs = 1_000,
    logger = console
  }) {
    if (!repository) throw new Error("AiJobWorker requires a job repository");
    if (!handlers || typeof handlers !== "object") throw new Error("AiJobWorker requires job handlers");
    this.repository = repository;
    this.handlers = handlers;
    this.workerId = workerId;
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this.retryDelayMs = retryDelayMs;
    this.logger = logger;
  }

  async runOnce({ now = new Date() } = {}) {
    const job = await this.repository.claimNext({ workerId: this.workerId, now, leaseMs: this.leaseMs });
    if (!job) return { claimed: false };

    const handler = this.handlers[job.jobType];
    try {
      if (typeof handler !== "function") throw new Error(`No handler is configured for ${job.jobType}`);
      const result = await handler(job, { workerId: this.workerId });
      const completed = await this.repository.markSucceeded({
        jobId: job.id,
        workerId: this.workerId,
        now: new Date()
      });
      if ((completed?.count ?? 0) !== 1) {
        const error = new Error(`Worker ${this.workerId} lost the lease for job ${job.id}`);
        error.code = "AI_JOB_LEASE_LOST";
        throw error;
      }
      return { claimed: true, succeeded: true, job, result };
    } catch (error) {
      const failed = await this.repository.markFailed({
        jobId: job.id,
        workerId: this.workerId,
        error,
        now: new Date(),
        retryDelayMs: this.retryDelayMs
      });
      this.logger?.error?.("AI job failed", { jobId: job.id, workerId: this.workerId, error: error.message });
      return { claimed: true, succeeded: false, job, error, rescheduled: Boolean(failed) };
    }
  }

  async start({ signal } = {}) {
    while (!signal?.aborted) {
      const result = await this.runOnce();
      if (!result.claimed) await abortableDelay(this.pollIntervalMs, signal);
    }
  }
}

function reportJobInput(job) {
  if (job.jobType === AI_JOB_TYPES.WEEKLY_REPORT && /^\d{4}-\d{2}-\d{2}$/.test(job.resourceId)) {
    return { reportType: "WEEKLY", args: { localDate: job.resourceId } };
  }
  const monthly = /^(\d{4})-(\d{2})$/.exec(job.resourceId || "");
  if (job.jobType === AI_JOB_TYPES.MONTHLY_REPORT && monthly) {
    return { reportType: "MONTHLY", args: { year: Number(monthly[1]), month: Number(monthly[2]) } };
  }
  const error = new Error("Report job resourceId does not match its Weekly or Monthly period");
  error.code = "INVALID_REPORT_JOB";
  throw error;
}

function reportJobIdempotencyKey(job) {
  return `${job.jobType}:${job.resourceId}:${REPORT_NARRATIVE_GENERATION_VERSION}`;
}

function reportFailure(result) {
  const error = new Error(`Grounded report generation failed: ${result.errorCode || "REPORT_NARRATIVE_PROVIDER_FAILED"}`);
  error.code = result.errorCode || "REPORT_NARRATIVE_PROVIDER_FAILED";
  return error;
}

export function createProductionAiWorker({
  prisma,
  embeddingProvider = new TransformersJsEmbeddingProvider(PRODUCTION_EMBEDDING_PROFILE_KEY),
  reportNarrativeProvider = null,
  reportNarrativeTimeoutMs = 20_000,
  semanticRetrieval = null,
  ...options
}) {
  const jobRepository = new PrismaAiJobRepository(prisma);
  const memoryPipeline = new EventMemoryPipeline({
    extractor: new DeterministicMemoryExtractor(),
    memoryRepository: new PrismaMemoryRepository(prisma)
  });
  const embeddingService = new EventEmbeddingService({ prisma, provider: embeddingProvider });
  const reportInputService = new ReportInputService({
    prisma,
    semanticRetrieval: semanticRetrieval || new SemanticEventRetrievalService({ prisma, provider: embeddingProvider })
  });
  const reportNarrativeService = reportNarrativeProvider
    ? new GroundedReportNarrativeService({ provider: reportNarrativeProvider, timeoutMs: reportNarrativeTimeoutMs, maxAttempts: 1 })
    : null;
  const reportPersistence = new GroundedReportPersistenceService(prisma);

  const processReport = async (job) => {
    if (job.idempotencyKey !== reportJobIdempotencyKey(job)) {
      return { skipped: true, status: "STALE_JOB" };
    }
    const { reportType, args } = reportJobInput(job);
    const identity = { userId: job.ownerId };
    const finalized = await reportPersistence.findFinalized({ identity, reportType, periodKey: job.resourceId });
    if (finalized) return { skipped: true, status: finalized.narrativeStatus, report: finalized };
    if (!reportNarrativeService) {
      const error = new Error("Grounded report narrative provider is not configured");
      error.code = "REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED";
      throw error;
    }
    const asOf = job.lockedAt instanceof Date ? job.lockedAt : new Date(job.lockedAt || Date.now());
    const reportInput = reportType === "WEEKLY"
      ? await reportInputService.buildWeeklyInput({ identity, ...args, asOf })
      : await reportInputService.buildMonthlyInput({ identity, ...args, asOf });
    if (reportInput.period.periodKey !== job.resourceId) {
      const error = new Error("Report job resourceId must be the canonical report period key");
      error.code = "INVALID_REPORT_JOB";
      throw error;
    }
    const narrativeResult = await reportNarrativeService.generate(reportInput);
    if (narrativeResult.status === "FAILED") throw reportFailure(narrativeResult);
    const persistence = await reportPersistence.persist({
      identity,
      reportInput,
      narrativeResult,
      generationVersion: REPORT_NARRATIVE_GENERATION_VERSION
    });
    return { skipped: persistence.skipped, status: persistence.outcome, report: persistence.report };
  };

  return new AiJobWorker({
    repository: jobRepository,
    handlers: {
      [AI_JOB_TYPES.MEMORY_EXTRACTION]: async (job) => {
        const event = await prisma.event.findFirst({
          where: { id: job.eventId, ownerId: job.ownerId, memoryProcessingAllowed: true }
        });
        if (!event) throw new Error("The source Event is unavailable or memory processing is disabled");
        const result = await memoryPipeline.processEvent({
          identity: { userId: job.ownerId },
          event: { ...event, kind: "EVENT" }
        });
        const embeddingJob = await jobRepository.enqueue({
          identity: { userId: job.ownerId },
          jobType: AI_JOB_TYPES.EMBEDDING_GENERATION,
          resourceId: result.memory.id,
          eventId: event.id,
          processingVersion: embeddingJobProcessingVersion(result.memory.embeddingInputRevision)
        });
        return { ...result, embeddingJob };
      },
      [AI_JOB_TYPES.EMBEDDING_GENERATION]: async (job) => {
        return embeddingService.generate({
          identity: { userId: job.ownerId },
          memoryId: job.resourceId
        });
      },
      [AI_JOB_TYPES.WEEKLY_REPORT]: processReport,
      [AI_JOB_TYPES.MONTHLY_REPORT]: processReport
    },
    ...options
  });
}
