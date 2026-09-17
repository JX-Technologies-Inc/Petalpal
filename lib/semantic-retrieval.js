import { requireAiIdentity } from "./ai-identity.js";
import { buildEmbeddingInput } from "./embedding-input.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "./embedding-profiles.js";

const DEFAULT_EMBEDDING_TIMEOUT_MS = 30_000;

function forbidden(message = "AI memory processing is not currently authorized") {
  const error = new Error(message);
  error.code = "AI_FORBIDDEN";
  return error;
}

function staleEmbedding() {
  const error = new Error("EventMemory changed while its embedding was being generated");
  error.code = "EMBEDDING_SOURCE_CHANGED";
  return error;
}

function vectorLiteral(vector, dimensions) {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    const error = new Error(`Embedding vector must contain exactly ${dimensions} finite values`);
    error.code = "INVALID_EMBEDDING_VECTOR";
    throw error;
  }
  return `[${vector.join(",")}]`;
}

function assertLockedConsent(rows, expectedUpdatedAt, changedMessage) {
  const consent = rows[0];
  const actualTime = new Date(consent?.updatedAt).getTime();
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  if (
    rows.length !== 1 ||
    !consent.aiProcessing ||
    !consent.personalization ||
    !consent.memoryEnabled ||
    !Number.isFinite(actualTime) ||
    actualTime !== expectedTime
  ) {
    throw forbidden(changedMessage);
  }
}

function optionalInstant(value, field) {
  if (value === undefined || value === null) return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    const error = new Error(`${field} must be a valid timestamp`);
    error.code = "INVALID_RETRIEVAL_WINDOW";
    throw error;
  }
  return instant;
}

async function runBoundedEmbedding(operation, timeoutMs) {
  const safeTimeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, 120_000)
    : DEFAULT_EMBEDDING_TIMEOUT_MS;
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error("Embedding provider timed out");
      error.code = "EMBEDDING_TIMEOUT";
      reject(error);
    }, safeTimeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function requireMemoryConsent(prisma, identity) {
  const ownerId = requireAiIdentity(identity);
  const consent = await prisma.aiConsent.findUnique({
    where: { userId: ownerId },
    select: { aiProcessing: true, personalization: true, memoryEnabled: true, updatedAt: true }
  });
  if (!consent?.aiProcessing || !consent.personalization || !consent.memoryEnabled) throw forbidden();
  return Object.freeze({ ownerId, updatedAt: consent.updatedAt });
}

export class PrismaEventEmbeddingRepository {
  constructor(prisma, profileKey = PRODUCTION_EMBEDDING_PROFILE_KEY) {
    this.prisma = prisma;
    this.profile = getEmbeddingProfile(profileKey);
    if (this.profile.environment !== "PRODUCTION" || this.profile.dimensions !== 384) {
      throw new Error("Event embedding storage requires the selected 384-dimensional production profile");
    }
  }

  async getSource({ identity, memoryId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.eventMemory.findFirst({
      where: { id: memoryId, ownerId },
      select: {
        id: true,
        ownerId: true,
        sourceEventId: true,
        summary: true,
        topics: true,
        people: true,
        embeddingStatus: true,
        embeddingModel: true,
        embeddingProfileKey: true,
        embeddingModelRevision: true,
        embeddingInputVersion: true,
        embeddingInputRevision: true,
        embeddedInputRevision: true
      }
    });
  }

  isCurrent(memory) {
    return Boolean(
      memory &&
      memory.embeddingStatus === "GENERATED" &&
      memory.embeddingProfileKey === this.profile.profileKey &&
      memory.embeddingModel === this.profile.model &&
      memory.embeddingModelRevision === this.profile.modelRevision &&
      memory.embeddingInputVersion === this.profile.inputVersion &&
      memory.embeddedInputRevision === memory.embeddingInputRevision
    );
  }

  async begin({ identity, memoryId, inputRevision }) {
    const ownerId = requireAiIdentity(identity);
    const rows = await this.prisma.$queryRawUnsafe(`
      UPDATE "EventMemory"
      SET "embedding" = NULL,
          "embeddingStatus" = 'GENERATING',
          "embeddingModel" = $1,
          "embeddingProfileKey" = $2,
          "embeddingModelRevision" = $3,
          "embeddingInputVersion" = $4,
          "embeddedInputRevision" = NULL,
          "embeddedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $5 AND "ownerId" = $6 AND "embeddingInputRevision" = $7
      RETURNING "id"
    `, this.profile.model, this.profile.profileKey, this.profile.modelRevision,
    this.profile.inputVersion, memoryId, ownerId, inputRevision);
    if (rows.length !== 1) throw staleEmbedding();
  }

  async store({ identity, memoryId, inputRevision, vector, consentUpdatedAt }) {
    const ownerId = requireAiIdentity(identity);
    const literal = vectorLiteral(vector, this.profile.dimensions);
    return this.prisma.$transaction(async (tx) => {
      const consentRows = await tx.$queryRawUnsafe(`
        SELECT "userId", "aiProcessing", "personalization", "memoryEnabled", "updatedAt"
        FROM "AiConsent"
        WHERE "userId" = $1
        FOR SHARE
      `, ownerId);
      assertLockedConsent(consentRows, consentUpdatedAt, "AI memory consent changed during embedding generation");
      const rows = await tx.$queryRawUnsafe(`
        UPDATE "EventMemory"
        SET "embedding" = $1::vector,
            "embeddingStatus" = 'GENERATED',
            "embeddingModel" = $2,
            "embeddingProfileKey" = $3,
            "embeddingModelRevision" = $4,
            "embeddingInputVersion" = $5,
            "embeddedInputRevision" = $6,
            "embeddedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $7
          AND "ownerId" = $8
          AND "embeddingInputRevision" = $6
        RETURNING "id", "ownerId", "sourceEventId", "embeddingStatus",
                  "embeddingProfileKey", "embeddedInputRevision", "embeddedAt"
      `, literal, this.profile.model, this.profile.profileKey, this.profile.modelRevision,
      this.profile.inputVersion, inputRevision, memoryId, ownerId);
      if (rows.length !== 1) throw staleEmbedding();
      return rows[0];
    });
  }

  async markFailed({ identity, memoryId, inputRevision }) {
    const ownerId = requireAiIdentity(identity);
    await this.prisma.$queryRawUnsafe(`
      UPDATE "EventMemory"
      SET "embedding" = NULL,
          "embeddingStatus" = 'FAILED',
          "embeddedInputRevision" = NULL,
          "embeddedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1 AND "ownerId" = $2 AND "embeddingInputRevision" = $3
      RETURNING "id"
    `, memoryId, ownerId, inputRevision);
  }

  async search({ identity, vector, take = 10, dateFrom = null, dateTo = null, consentUpdatedAt }) {
    const ownerId = requireAiIdentity(identity);
    const literal = vectorLiteral(vector, this.profile.dimensions);
    const safeTake = Math.max(1, Math.min(100, Number(take) || 10));
    const start = optionalInstant(dateFrom, "dateFrom");
    const end = optionalInstant(dateTo, "dateTo");
    if (start && end && start >= end) {
      const error = new Error("Semantic retrieval requires dateFrom before dateTo");
      error.code = "INVALID_RETRIEVAL_WINDOW";
      throw error;
    }
    return this.prisma.$transaction(async (tx) => {
      const consentRows = await tx.$queryRawUnsafe(`
        SELECT "userId", "aiProcessing", "personalization", "memoryEnabled", "updatedAt"
        FROM "AiConsent"
        WHERE "userId" = $1
        FOR SHARE
      `, ownerId);
      assertLockedConsent(consentRows, consentUpdatedAt, "AI memory consent changed during retrieval");
      return tx.$queryRawUnsafe(`
        SELECT memory."id", memory."ownerId", memory."sourceEventId", memory."summary",
               event."occurredAt" AS "eventDate", memory."memoryType", memory."topics",
               memory."people", memory."importanceScore",
               1 - (memory."embedding" <=> $1::vector) AS "similarity"
        FROM "EventMemory" AS memory
        INNER JOIN "Event" AS event
          ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
        INNER JOIN "User" AS owner ON owner."id" = memory."ownerId"
        WHERE memory."ownerId" = $2
          AND memory."memoryType" = 'EVENT'
          AND event."memoryProcessingAllowed" = true
          AND (lower(owner."preferredLocale") = 'en' OR lower(owner."preferredLocale") LIKE 'en-%')
          AND memory."embeddingStatus" = 'GENERATED'
          AND memory."embeddingProfileKey" = $3
          AND memory."embeddingModel" = $4
          AND memory."embeddingModelRevision" = $5
          AND memory."embeddingInputVersion" = $6
          AND memory."embeddedInputRevision" = memory."embeddingInputRevision"
          AND ($7::timestamp IS NULL OR event."occurredAt" >= $7)
          AND ($8::timestamp IS NULL OR event."occurredAt" < $8)
        ORDER BY memory."embedding" <=> $1::vector ASC, event."occurredAt" ASC, memory."id" ASC
        LIMIT $9
      `, literal, ownerId, this.profile.profileKey, this.profile.model,
      this.profile.modelRevision, this.profile.inputVersion, start, end, safeTake);
    });
  }
}

export class EventEmbeddingService {
  constructor({ prisma, provider, repository = null, timeoutMs = DEFAULT_EMBEDDING_TIMEOUT_MS }) {
    this.prisma = prisma;
    this.provider = provider;
    this.repository = repository || new PrismaEventEmbeddingRepository(prisma, provider.describeProfile().profileKey);
    this.timeoutMs = timeoutMs;
  }

  async generate({ identity, memoryId }) {
    const consent = await requireMemoryConsent(this.prisma, identity);
    const memory = await this.repository.getSource({ identity, memoryId });
    if (!memory) throw forbidden("EventMemory is not available to the authenticated owner");
    if (this.repository.isCurrent(memory)) return { skipped: true, memoryId: memory.id };

    const input = buildEmbeddingInput({ ...memory, sourceType: "EVENT" }, this.repository.profile.inputVersion);
    await this.repository.begin({ identity, memoryId, inputRevision: memory.embeddingInputRevision });
    try {
      const result = await runBoundedEmbedding(
        (signal) => this.provider.embedDocuments([input.canonicalText], { signal }),
        this.timeoutMs
      );
      const stored = await this.repository.store({
        identity,
        memoryId,
        inputRevision: memory.embeddingInputRevision,
        vector: result.vectors[0],
        consentUpdatedAt: consent.updatedAt
      });
      return { skipped: false, memory: stored };
    } catch (error) {
      await this.repository.markFailed({ identity, memoryId, inputRevision: memory.embeddingInputRevision });
      throw error;
    }
  }
}

export class SemanticEventRetrievalService {
  constructor({ prisma, provider, repository = null, timeoutMs = DEFAULT_EMBEDDING_TIMEOUT_MS }) {
    this.prisma = prisma;
    this.provider = provider;
    this.repository = repository || new PrismaEventEmbeddingRepository(prisma, provider.describeProfile().profileKey);
    this.timeoutMs = timeoutMs;
  }

  async retrieve({ identity, query, take = 10, dateFrom = null, dateTo = null }) {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    if (!normalizedQuery) {
      const error = new Error("A non-empty semantic retrieval query is required");
      error.code = "INVALID_RETRIEVAL_QUERY";
      throw error;
    }
    const consent = await requireMemoryConsent(this.prisma, identity);
    const result = await runBoundedEmbedding(
      (signal) => this.provider.embedQuery(normalizedQuery, { signal }),
      this.timeoutMs
    );
    return this.repository.search({
      identity,
      vector: result.vectors[0],
      take,
      dateFrom,
      dateTo,
      consentUpdatedAt: consent.updatedAt
    });
  }
}
