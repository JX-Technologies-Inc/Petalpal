import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { candidateBackfillPreflight, runCandidateBackfill } from "../../lib/cloudflare-embedding-backfill.js";
import { CLOUDFLARE_EMBEDDING_PROFILE_KEY, getEmbeddingProfile } from "../../lib/embedding-profiles.js";

const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;

realTest("candidate backfill is bounded, profile-isolated, resumable, and consent-aware", async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerId = `candidate-backfill-${suffix}`;
  let calls = 0;
  const provider = {
    describeProfile: () => getEmbeddingProfile(CLOUDFLARE_EMBEDDING_PROFILE_KEY),
    embedDocuments: async () => { calls += 1; return { vectors: [Array.from({ length: 384 }, (_, i) => i === 0 ? 1 : 0)] }; }
  };
  try {
    await prisma.user.create({ data: { id: ownerId, name: "Synthetic test", preferredLocale: "en" } });
    await prisma.aiConsent.create({ data: { userId: ownerId, termsVersion: "v1",
      aiProcessing: true, personalization: true, memoryEnabled: true, grantedAt: new Date() } });
    const memories = [];
    for (let index = 0; index < 2; index += 1) {
      const event = await prisma.event.create({ data: { ownerId, content: "Synthetic test event",
        occurredAt: new Date("2026-09-20T12:00:00Z"), timezone: "UTC", localDate: "2026-09-20",
        idempotencyKey: `candidate-${suffix}-${index}`, memoryProcessingAllowed: true } });
      memories.push(await prisma.eventMemory.create({ data: { ownerId, sourceEventId: event.id,
        memoryType: "EVENT", summary: `Synthetic summary ${index}`, eventDate: event.occurredAt } }));
    }
    const before = await candidateBackfillPreflight(prisma, { ownerId });
    assert.equal(before.eligible, 2);
    const first = await runCandidateBackfill({ prisma, provider, max: 1, ownerId });
    assert.equal(first.generated, 1);
    assert.equal(first.selected, 1);
    const second = await runCandidateBackfill({ prisma, provider, max: 100, ownerId });
    assert.ok(second.generated >= 1);
    const again = await runCandidateBackfill({ prisma, provider, max: 100, ownerId });
    assert.equal(again.generated, 0);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count, min(vector_dims("embedding")) AS dimensions
      FROM "EventMemoryEmbedding" WHERE "ownerId" = $1 AND "profileKey" = $2 AND "status" = 'GENERATED'
    `, ownerId, CLOUDFLARE_EMBEDDING_PROFILE_KEY);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].dimensions, 384);
    const local = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "EventMemory"
      WHERE "ownerId" = $1 AND "embedding" IS NOT NULL`, ownerId);
    assert.equal(local[0].count, 0);
    assert.ok(calls >= 2);
    await prisma.aiConsent.update({ where: { userId: ownerId }, data: { memoryEnabled: false } });
    assert.equal((await runCandidateBackfill({ prisma, provider, max: 1, ownerId })).selected, 0);
    await prisma.event.deleteMany({ where: { ownerId } });
    const orphan = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "EventMemoryEmbedding" WHERE "ownerId" = $1`, ownerId);
    assert.equal(orphan[0].count, 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: ownerId } });
    await prisma.$disconnect();
  }
});
