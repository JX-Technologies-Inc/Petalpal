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

async function beginProfileRow(tx, profile, ownerId, memoryId, inputRevision) {
  await tx.$queryRawUnsafe(`
    UPDATE "EventMemoryEmbedding"
    SET "status" = 'NOT_REQUESTED', "embedding" = NULL, "embeddedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "eventMemoryId" = $1 AND "ownerId" = $2 AND "profileKey" = $3
      AND "inputRevision" <> $4 AND "status" = 'GENERATED'
  `, memoryId, ownerId, profile.profileKey, inputRevision);
  const rows = await tx.$queryRawUnsafe(`
    INSERT INTO "EventMemoryEmbedding" (
      "eventMemoryId", "ownerId", "profileKey", "model", "modelRevision",
      "inputVersion", "inputRevision", "status", "updatedAt"
    )
    SELECT memory."id", memory."ownerId", $1, $2, $3, $4, $5, 'GENERATING', CURRENT_TIMESTAMP
    FROM "EventMemory" AS memory
    WHERE memory."id" = $6 AND memory."ownerId" = $7 AND memory."embeddingInputRevision" = $5
      AND EXISTS (
        SELECT 1 FROM "Event" AS event
        WHERE event."id" = memory."sourceEventId" AND event."ownerId" = $7
          AND event."memoryProcessingAllowed" = true
      )
    ON CONFLICT ("eventMemoryId", "profileKey", "inputRevision") DO UPDATE SET
      "model" = EXCLUDED."model", "modelRevision" = EXCLUDED."modelRevision",
      "inputVersion" = EXCLUDED."inputVersion",
      "status" = 'GENERATING', "embedding" = NULL, "embeddedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "eventMemoryId"
  `, profile.profileKey, profile.model, profile.modelRevision, profile.inputVersion,
  inputRevision, memoryId, ownerId);
  if (rows.length !== 1) throw staleEmbedding();
}

async function storeProfileRow(tx, profile, ownerId, memoryId, inputRevision, literal) {
  const rows = await tx.$queryRawUnsafe(`
    UPDATE "EventMemoryEmbedding" AS embedding
    SET "embedding" = $1::vector, "status" = 'GENERATED',
        "embeddedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE embedding."eventMemoryId" = $2 AND embedding."ownerId" = $3
      AND embedding."profileKey" = $4 AND embedding."model" = $5
      AND embedding."modelRevision" = $6 AND embedding."inputVersion" = $7
      AND embedding."inputRevision" = $8
      AND EXISTS (
        SELECT 1 FROM "EventMemory" AS memory
        INNER JOIN "Event" AS event
          ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
        WHERE memory."id" = $2 AND memory."ownerId" = $3
          AND memory."embeddingInputRevision" = $8
          AND event."memoryProcessingAllowed" = true
      )
    RETURNING embedding."eventMemoryId", embedding."profileKey", embedding."status"
  `, literal, memoryId, ownerId, profile.profileKey, profile.model,
  profile.modelRevision, profile.inputVersion, inputRevision);
  if (rows.length !== 1) throw staleEmbedding();
  return rows[0];
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

export async function requireLockedMemoryConsent(tx, identity) {
  const ownerId = requireAiIdentity(identity);
  const rows = await tx.$queryRawUnsafe(`
    SELECT "userId", "aiProcessing", "personalization", "memoryEnabled"
    FROM "AiConsent"
    WHERE "userId" = $1
    FOR SHARE
  `, ownerId);
  if (rows.length !== 1 || !rows[0].aiProcessing || !rows[0].personalization || !rows[0].memoryEnabled) {
    throw forbidden();
  }
  return ownerId;
}

export class PrismaEventEmbeddingRepository {
  constructor(prisma, profileKey = PRODUCTION_EMBEDDING_PROFILE_KEY) {
    this.prisma = prisma;
    this.profile = getEmbeddingProfile(profileKey);
    this.legacyLocalProfile = profileKey === PRODUCTION_EMBEDDING_PROFILE_KEY;
    if (!["PRODUCTION", "MIGRATION_CANDIDATE"].includes(this.profile.environment) || this.profile.dimensions !== 384) {
      throw new Error("Event embedding storage requires a registered 384-dimensional production or migration profile");
    }
  }

  async getSource({ identity, memoryId }) {
    const ownerId = requireAiIdentity(identity);
    const memory = await this.prisma.eventMemory.findFirst({
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
    if (!memory || this.legacyLocalProfile) return memory;
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT "status", "model", "modelRevision", "inputVersion", "inputRevision"
      FROM "EventMemoryEmbedding"
      WHERE "eventMemoryId" = $1 AND "ownerId" = $2 AND "profileKey" = $3
        AND "inputRevision" = $4
    `, memoryId, ownerId, this.profile.profileKey, memory.embeddingInputRevision);
    return { ...memory, profileEmbedding: rows[0] || null };
  }

  isCurrent(memory) {
    if (!this.legacyLocalProfile) {
      const row = memory?.profileEmbedding;
      return Boolean(row && row.status === "GENERATED" && row.model === this.profile.model &&
        row.modelRevision === this.profile.modelRevision && row.inputVersion === this.profile.inputVersion &&
        row.inputRevision === memory.embeddingInputRevision);
    }
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
    return this.prisma.$transaction(async (tx) => {
      await requireLockedMemoryConsent(tx, identity);
      if (!this.legacyLocalProfile) {
        await beginProfileRow(tx, this.profile, ownerId, memoryId, inputRevision);
        return;
      }
      const rows = await tx.$queryRawUnsafe(`
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
        AND EXISTS (
          SELECT 1 FROM "Event" AS event
          WHERE event."id" = "EventMemory"."sourceEventId"
            AND event."ownerId" = $6
            AND event."memoryProcessingAllowed" = true
        )
        RETURNING "id"
      `, this.profile.model, this.profile.profileKey, this.profile.modelRevision,
      this.profile.inputVersion, memoryId, ownerId, inputRevision);
      if (rows.length !== 1) throw staleEmbedding();
      await beginProfileRow(tx, this.profile, ownerId, memoryId, inputRevision);
    });
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
      if (!this.legacyLocalProfile) {
        await storeProfileRow(tx, this.profile, ownerId, memoryId, inputRevision, literal);
        return { id: memoryId, ownerId, embeddingStatus: "GENERATED", embeddingProfileKey: this.profile.profileKey, embeddedInputRevision: inputRevision };
      }
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
          AND EXISTS (
            SELECT 1 FROM "Event" AS event
            WHERE event."id" = "EventMemory"."sourceEventId"
              AND event."ownerId" = $8
              AND event."memoryProcessingAllowed" = true
          )
        RETURNING "id", "ownerId", "sourceEventId", "embeddingStatus",
                  "embeddingProfileKey", "embeddedInputRevision", "embeddedAt"
      `, literal, this.profile.model, this.profile.profileKey, this.profile.modelRevision,
      this.profile.inputVersion, inputRevision, memoryId, ownerId);
      if (rows.length !== 1) throw staleEmbedding();
      await storeProfileRow(tx, this.profile, ownerId, memoryId, inputRevision, literal);
      return rows[0];
    });
  }

  async markFailed({ identity, memoryId, inputRevision }) {
    const ownerId = requireAiIdentity(identity);
    await this.prisma.$transaction(async (tx) => {
      await requireLockedMemoryConsent(tx, identity);
      await tx.$queryRawUnsafe(`
        UPDATE "EventMemoryEmbedding" AS embedding
        SET "embedding" = NULL, "status" = 'FAILED', "embeddedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE embedding."eventMemoryId" = $1 AND embedding."ownerId" = $2
          AND embedding."profileKey" = $3 AND embedding."inputRevision" = $4
          AND EXISTS (
            SELECT 1 FROM "EventMemory" AS memory
            INNER JOIN "Event" AS event
              ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
            WHERE memory."id" = $1 AND memory."ownerId" = $2
              AND memory."embeddingInputRevision" = $4
              AND event."memoryProcessingAllowed" = true
          )
      `, memoryId, ownerId, this.profile.profileKey, inputRevision);
      if (!this.legacyLocalProfile) return;
      await tx.$queryRawUnsafe(`
        UPDATE "EventMemory"
      SET "embedding" = NULL,
          "embeddingStatus" = 'FAILED',
          "embeddedInputRevision" = NULL,
          "embeddedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1 AND "ownerId" = $2 AND "embeddingInputRevision" = $3
        AND EXISTS (
          SELECT 1 FROM "Event" AS event
          WHERE event."id" = "EventMemory"."sourceEventId"
            AND event."ownerId" = $2
            AND event."memoryProcessingAllowed" = true
        )
        RETURNING "id"
      `, memoryId, ownerId, inputRevision);
    });
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
      if (!this.legacyLocalProfile) {
        return tx.$queryRawUnsafe(`
          SELECT memory."id", memory."ownerId", memory."sourceEventId", memory."summary",
                 event."occurredAt" AS "eventDate", memory."memoryType", memory."topics",
                 memory."people", memory."importanceScore",
                 1 - (embedding."embedding" <=> $1::vector) AS "similarity"
          FROM "EventMemory" AS memory
          INNER JOIN "Event" AS event
            ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
          INNER JOIN "User" AS owner ON owner."id" = memory."ownerId"
          INNER JOIN "EventMemoryEmbedding" AS embedding
            ON embedding."eventMemoryId" = memory."id" AND embedding."ownerId" = memory."ownerId"
          WHERE memory."ownerId" = $2
            AND memory."memoryType" = 'EVENT'
            AND event."memoryProcessingAllowed" = true
            AND (lower(owner."preferredLocale") = 'en' OR lower(owner."preferredLocale") LIKE 'en-%')
            AND embedding."status" = 'GENERATED'
            AND embedding."profileKey" = $3
            AND embedding."model" = $4
            AND embedding."modelRevision" = $5
            AND embedding."inputVersion" = $6
            AND embedding."inputRevision" = memory."embeddingInputRevision"
            AND ($7::timestamp IS NULL OR event."occurredAt" >= $7)
            AND ($8::timestamp IS NULL OR event."occurredAt" < $8)
          ORDER BY embedding."embedding" <=> $1::vector ASC, event."occurredAt" ASC, memory."id" ASC
          LIMIT $9
        `, literal, ownerId, this.profile.profileKey, this.profile.model,
        this.profile.modelRevision, this.profile.inputVersion, start, end, safeTake);
      }
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
    if (this.repository instanceof PrismaEventEmbeddingRepository &&
        provider.describeProfile?.().profileKey !== this.repository.profile.profileKey) {
      throw new Error("Embedding provider and storage profile must match");
    }
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
    if (this.repository instanceof PrismaEventEmbeddingRepository &&
        provider.describeProfile?.().profileKey !== this.repository.profile.profileKey) {
      throw new Error("Query and document embedding profiles must match");
    }
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
