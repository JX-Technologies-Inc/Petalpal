import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import {
  CLOUDFLARE_EMBEDDING_PROFILE_KEY,
  PRODUCTION_EMBEDDING_PROFILE_KEY,
  getEmbeddingProfile
} from "../../lib/embedding-profiles.js";
import { PrismaMemoryRepository } from "../../lib/event-memory.js";
import { EventEmbeddingService, PrismaEventEmbeddingRepository, SemanticEventRetrievalService } from "../../lib/semantic-retrieval.js";

const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;
const axis = (index) => Array.from({ length: 384 }, (_, offset) => offset === index ? 1 : 0);

async function withDatabase(callback) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try { return await callback(prisma); }
  finally { await prisma.$disconnect(); }
}

async function seed(prisma, ownerId, label, { eligible = true, consent = true } = {}) {
  await prisma.user.create({ data: { id: ownerId, name: ownerId, preferredLocale: "en" } });
  await prisma.aiConsent.create({ data: {
    userId: ownerId, termsVersion: "v1", aiProcessing: consent,
    personalization: consent, memoryEnabled: consent, grantedAt: new Date()
  } });
  const event = await prisma.event.create({ data: {
    ownerId, content: `Synthetic ${label}`, occurredAt: new Date("2026-09-20T12:00:00Z"),
    timezone: "UTC", localDate: "2026-09-20", idempotencyKey: `embedding-${label}`,
    memoryProcessingAllowed: eligible
  } });
  const memory = await prisma.eventMemory.create({ data: {
    ownerId, sourceEventId: event.id, memoryType: "EVENT", summary: `Synthetic ${label}`,
    eventDate: event.occurredAt
  } });
  return { event, memory };
}

async function store(prisma, repository, ownerId, memoryId, vector) {
  const identity = { userId: ownerId };
  const consent = await prisma.aiConsent.findUnique({ where: { userId: ownerId } });
  await repository.begin({ identity, memoryId, inputRevision: 1 });
  return repository.store({ identity, memoryId, inputRevision: 1, vector, consentUpdatedAt: consent.updatedAt });
}

function retrieval(prisma, profileKey) {
  return new SemanticEventRetrievalService({
    prisma,
    provider: {
      describeProfile: () => getEmbeddingProfile(profileKey),
      embedQuery: async () => ({ vectors: [axis(0)] })
    }
  });
}

test("provider and repository profiles cannot be mixed", () => {
  const repository = new PrismaEventEmbeddingRepository({}, PRODUCTION_EMBEDDING_PROFILE_KEY);
  const provider = { describeProfile: () => getEmbeddingProfile(CLOUDFLARE_EMBEDDING_PROFILE_KEY) };
  assert.throws(() => new SemanticEventRetrievalService({ prisma: {}, provider, repository }), /profiles must match/);
  assert.throws(() => new EventEmbeddingService({ prisma: {}, provider, repository }), /profile must match/);
});

realTest("local and candidate vectors coexist, isolate owners, cut over and roll back without loss", async () => {
  await withDatabase(async (prisma) => {
    const suffix = Date.now();
    const alice = `embedding-alice-${suffix}`;
    const bob = `embedding-bob-${suffix}`;
    const local = new PrismaEventEmbeddingRepository(prisma, PRODUCTION_EMBEDDING_PROFILE_KEY);
    const candidate = new PrismaEventEmbeddingRepository(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY);
    try {
      const first = await seed(prisma, alice, `first-${suffix}`);
      const secondEvent = await prisma.event.create({ data: {
        ownerId: alice, content: "Synthetic second", occurredAt: new Date("2026-09-21T12:00:00Z"),
        timezone: "UTC", localDate: "2026-09-21", idempotencyKey: `second-${suffix}`,
        memoryProcessingAllowed: true
      } });
      const second = await prisma.eventMemory.create({ data: {
        ownerId: alice, sourceEventId: secondEvent.id, memoryType: "EVENT", summary: "Synthetic second",
        eventDate: secondEvent.occurredAt
      } });
      const other = await seed(prisma, bob, `other-${suffix}`);
      await store(prisma, local, alice, first.memory.id, axis(0));
      await store(prisma, local, alice, second.id, axis(1));
      await store(prisma, local, bob, other.memory.id, axis(0));

      await store(prisma, candidate, alice, first.memory.id, axis(1));
      await candidate.begin({ identity: { userId: alice }, memoryId: second.id, inputRevision: 1 });
      const partial = await prisma.$queryRawUnsafe(`
        SELECT count(*)::int AS count FROM "EventMemoryEmbedding"
        WHERE "eventMemoryId" = $1 AND "status" = 'GENERATING'
      `, second.id);
      assert.equal(partial[0].count, 1);
      assert.deepEqual((await retrieval(prisma, PRODUCTION_EMBEDDING_PROFILE_KEY).retrieve({ identity: { userId: alice }, query: "synthetic" })).map((row) => row.id), [first.memory.id, second.id]);
      await store(prisma, candidate, alice, second.id, axis(0));
      await store(prisma, candidate, alice, first.memory.id, axis(1)); // idempotent upsert
      await store(prisma, candidate, bob, other.memory.id, axis(0));

      const count = await prisma.$queryRawUnsafe(`
        SELECT count(*)::int AS count, min(vector_dims("embedding")) AS min_dimensions,
               max(vector_dims("embedding")) AS max_dimensions
        FROM "EventMemoryEmbedding" WHERE "status" = 'GENERATED'
          AND "eventMemoryId" IN ($1, $2, $3)
      `, first.memory.id, second.id, other.memory.id);
      assert.deepEqual(count[0], { count: 6, min_dimensions: 384, max_dimensions: 384 });

      const excludedEvent = await prisma.event.create({ data: {
        ownerId: alice, content: "Synthetic excluded", occurredAt: new Date("2026-09-22T12:00:00Z"),
        timezone: "UTC", localDate: "2026-09-22", idempotencyKey: `excluded-${suffix}`,
        memoryProcessingAllowed: false
      } });
      const excludedMemory = await prisma.eventMemory.create({ data: {
        ownerId: alice, sourceEventId: excludedEvent.id, memoryType: "EVENT",
        summary: "Synthetic excluded", eventDate: excludedEvent.occurredAt
      } });
      const profile = getEmbeddingProfile(CLOUDFLARE_EMBEDDING_PROFILE_KEY);
      await prisma.$queryRawUnsafe(`
        INSERT INTO "EventMemoryEmbedding" (
          "eventMemoryId", "ownerId", "profileKey", "model", "modelRevision",
          "inputVersion", "inputRevision", "status", "embedding", "embeddedAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, 'GENERATED', $7::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, excludedMemory.id, alice, profile.profileKey, profile.model,
      profile.modelRevision, profile.inputVersion, `[${axis(0).join(",")}]`);

      let activeProfileKey = PRODUCTION_EMBEDDING_PROFILE_KEY;
      const activeSearch = () => retrieval(prisma, activeProfileKey).retrieve({ identity: { userId: alice }, query: "synthetic" });
      const localRows = await activeSearch();
      activeProfileKey = CLOUDFLARE_EMBEDDING_PROFILE_KEY;
      const candidateRows = await activeSearch();
      assert.equal(localRows[0].id, first.memory.id);
      assert.equal(candidateRows[0].id, second.id);
      assert.equal(localRows.some((row) => row.ownerId === bob), false);
      assert.equal(candidateRows.some((row) => row.ownerId === bob), false);
      assert.equal(candidateRows.some((row) => row.id === excludedMemory.id), false);
      const scoped = await retrieval(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY).retrieve({
        identity: { userId: alice }, query: "synthetic", take: 1,
        dateFrom: new Date("2026-09-21T00:00:00Z")
      });
      assert.deepEqual(scoped.map((row) => row.id), [second.id]);
      await prisma.user.update({ where: { id: bob }, data: { preferredLocale: "zh" } });
      assert.deepEqual(await retrieval(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY).retrieve({ identity: { userId: bob }, query: "synthetic" }), []);
      activeProfileKey = PRODUCTION_EMBEDDING_PROFILE_KEY;
      assert.equal((await activeSearch())[0].id, first.memory.id);

      // An old application instance can still write only the legacy slot after expansion.
      const legacyEvent = await prisma.event.create({ data: {
        ownerId: alice, content: "Synthetic legacy writer", occurredAt: new Date("2026-09-23T12:00:00Z"),
        timezone: "UTC", localDate: "2026-09-23", idempotencyKey: `legacy-${suffix}`,
        memoryProcessingAllowed: true
      } });
      const legacyMemory = await prisma.eventMemory.create({ data: {
        ownerId: alice, sourceEventId: legacyEvent.id, memoryType: "EVENT",
        summary: "Synthetic legacy writer", eventDate: legacyEvent.occurredAt
      } });
      const localProfile = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
      await prisma.$executeRawUnsafe(`
        UPDATE "EventMemory" SET "embedding" = $1::vector, "embeddingStatus" = 'GENERATED',
          "embeddingModel" = $2, "embeddingProfileKey" = $3,
          "embeddingModelRevision" = $4, "embeddingInputVersion" = $5,
          "embeddedInputRevision" = 1, "embeddedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $6
      `, `[${axis(0).join(",")}]`, localProfile.model, localProfile.profileKey,
      localProfile.modelRevision, localProfile.inputVersion, legacyMemory.id);
      assert.equal((await retrieval(prisma, PRODUCTION_EMBEDDING_PROFILE_KEY).retrieve({ identity: { userId: alice }, query: "synthetic" })).some((row) => row.id === legacyMemory.id), true);
      assert.equal((await retrieval(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY).retrieve({ identity: { userId: alice }, query: "synthetic" })).some((row) => row.id === legacyMemory.id), false);

      const changed = await new PrismaMemoryRepository(prisma).saveMemory({
        identity: { userId: alice },
        memory: { sourceEventId: secondEvent.id, summary: "Synthetic second revised",
          topics: [], people: [], eventDate: second.eventDate }
      });
      assert.equal(changed.embeddingInputRevision, 2);
      const refreshedConsent = await prisma.aiConsent.findUnique({ where: { userId: alice } });
      await candidate.begin({ identity: { userId: alice }, memoryId: second.id, inputRevision: 2 });
      await candidate.store({ identity: { userId: alice }, memoryId: second.id,
        inputRevision: 2, vector: axis(0), consentUpdatedAt: refreshedConsent.updatedAt });
      const revisions = await prisma.$queryRawUnsafe(`
        SELECT "inputRevision", "status", "embedding" IS NULL AS empty
        FROM "EventMemoryEmbedding" WHERE "eventMemoryId" = $1 AND "profileKey" = $2
        ORDER BY "inputRevision"
      `, second.id, CLOUDFLARE_EMBEDDING_PROFILE_KEY);
      assert.deepEqual(revisions, [
        { inputRevision: 1, status: "NOT_REQUESTED", empty: true },
        { inputRevision: 2, status: "GENERATED", empty: false }
      ]);
      await assert.rejects(prisma.$executeRawUnsafe(`
        UPDATE "EventMemoryEmbedding"
        SET "status" = 'GENERATED', "embedding" = $1::vector,
            "embeddedAt" = CURRENT_TIMESTAMP
        WHERE "eventMemoryId" = $2 AND "profileKey" = $3 AND "inputRevision" = 1
      `, `[${axis(0).join(",")}]`, second.id, CLOUDFLARE_EMBEDDING_PROFILE_KEY), /unique|duplicate/i);

      await prisma.event.delete({ where: { id: first.event.id } });
      const orphan = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "EventMemoryEmbedding" WHERE "eventMemoryId" = $1`, first.memory.id);
      assert.equal(orphan[0].count, 0);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    }
  });
});

realTest("candidate failure, bad dimensions, revoke and deletion leave local vectors safe", async () => {
  await withDatabase(async (prisma) => {
    const suffix = Date.now();
    const owner = `embedding-failure-${suffix}`;
    const local = new PrismaEventEmbeddingRepository(prisma, PRODUCTION_EMBEDDING_PROFILE_KEY);
    const candidate = new PrismaEventEmbeddingRepository(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY);
    try {
      const source = await seed(prisma, owner, `failure-${suffix}`);
      await store(prisma, local, owner, source.memory.id, axis(0));
      const service = new EventEmbeddingService({ prisma, provider: {
        describeProfile: () => getEmbeddingProfile(CLOUDFLARE_EMBEDDING_PROFILE_KEY),
        embedDocuments: async () => { throw new Error("synthetic HTTP failure"); }
      } });
      await assert.rejects(service.generate({ identity: { userId: owner }, memoryId: source.memory.id }), /synthetic HTTP failure/);
      const failed = await prisma.$queryRawUnsafe(`
        SELECT "status", "embedding" IS NULL AS empty FROM "EventMemoryEmbedding"
        WHERE "eventMemoryId" = $1 AND "profileKey" = $2
      `, source.memory.id, CLOUDFLARE_EMBEDDING_PROFILE_KEY);
      assert.deepEqual(failed[0], { status: "FAILED", empty: true });
      service.provider.embedDocuments = async () => ({ vectors: [[1, 2]] });
      await assert.rejects(service.generate({ identity: { userId: owner }, memoryId: source.memory.id }), /384 finite values/);
      service.provider.embedDocuments = async () => ({ vectors: [[NaN, ...Array(383).fill(0)]] });
      await assert.rejects(service.generate({ identity: { userId: owner }, memoryId: source.memory.id }), /384 finite values/);
      service.provider.embedDocuments = async () => ({});
      await assert.rejects(service.generate({ identity: { userId: owner }, memoryId: source.memory.id }), /undefined/);
      const legacy = await prisma.$queryRawUnsafe(`SELECT "embedding" IS NOT NULL AS present FROM "EventMemory" WHERE "id" = $1`, source.memory.id);
      assert.equal(legacy[0].present, true);

      const consent = await prisma.aiConsent.findUnique({ where: { userId: owner } });
      await candidate.begin({ identity: { userId: owner }, memoryId: source.memory.id, inputRevision: 1 });
      await prisma.aiConsent.update({ where: { userId: owner }, data: { aiProcessing: false, personalization: false, memoryEnabled: false } });
      await assert.rejects(candidate.store({ identity: { userId: owner }, memoryId: source.memory.id, inputRevision: 1, vector: axis(0), consentUpdatedAt: consent.updatedAt }), (error) => error.code === "AI_FORBIDDEN");
      await assert.rejects(retrieval(prisma, CLOUDFLARE_EMBEDDING_PROFILE_KEY).retrieve({ identity: { userId: owner }, query: "synthetic" }), (error) => error.code === "AI_FORBIDDEN");
      const stillLocal = await prisma.$queryRawUnsafe(`SELECT "embedding" IS NOT NULL AS present FROM "EventMemory" WHERE "id" = $1`, source.memory.id);
      assert.equal(stillLocal[0].present, true);
      await prisma.aiConsent.update({ where: { userId: owner }, data: { aiProcessing: true, personalization: true, memoryEnabled: true } });
      const restoredConsent = await prisma.aiConsent.findUnique({ where: { userId: owner } });
      await candidate.begin({ identity: { userId: owner }, memoryId: source.memory.id, inputRevision: 1 });
      await prisma.event.delete({ where: { id: source.event.id } });
      await assert.rejects(candidate.store({ identity: { userId: owner }, memoryId: source.memory.id, inputRevision: 1, vector: axis(0), consentUpdatedAt: restoredConsent.updatedAt }), (error) => error.code === "EMBEDDING_SOURCE_CHANGED");
      const orphan = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "EventMemoryEmbedding" WHERE "eventMemoryId" = $1`, source.memory.id);
      assert.equal(orphan[0].count, 0);
    } finally {
      await prisma.user.deleteMany({ where: { id: owner } });
    }
  });
});
