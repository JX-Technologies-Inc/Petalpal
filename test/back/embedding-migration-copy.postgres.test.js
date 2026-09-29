import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl ? test : test.skip;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationRoot = path.join(root, "prisma/migrations");
const newMigration = "202609280001_multi_profile_event_memory_embeddings";

realTest("expand migration copies complete local generations and leaves legacy vectors intact", async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `embedding_copy_${Date.now()}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < newMigration)
      .map((entry) => entry.name).sort();
    for (const migration of migrations) {
      await client.query(await readFile(path.join(migrationRoot, migration, "migration.sql"), "utf8"));
    }
    const vector = `[${[1, ...Array(383).fill(0)].join(",")}]`;
    await client.query(`
      INSERT INTO "User" ("id", "name") VALUES ('copy-owner', 'Synthetic owner');
      INSERT INTO "Event" (
        "id", "ownerId", "content", "occurredAt", "timezone", "localDate",
        "idempotencyKey", "memoryProcessingAllowed", "updatedAt"
      ) VALUES
        ('copy-event', 'copy-owner', 'Synthetic Event', NOW(), 'UTC', '2026-09-28', 'copy-one', true, NOW()),
        ('copy-empty-event', 'copy-owner', 'Synthetic empty Event', NOW(), 'UTC', '2026-09-28', 'copy-two', true, NOW());
    `);
    await client.query(`
      INSERT INTO "EventMemory" (
        "id", "ownerId", "sourceEventId", "memoryType", "summary", "eventDate",
        "embeddingStatus", "embeddingModel", "embeddingProfileKey", "embeddingModelRevision",
        "embeddingInputVersion", "embeddingInputRevision", "embeddedInputRevision",
        "embedding", "embeddedAt", "updatedAt"
      ) VALUES
        ('copy-memory', 'copy-owner', 'copy-event', 'EVENT', 'Synthetic Event', NOW(),
         'GENERATED', 'Xenova/bge-small-en-v1.5', 'production-bge-small-en-v1.5-v1',
         'main', 'summary-v1', 3, 3, $1::vector, NOW(), NOW()),
        ('copy-empty-memory', 'copy-owner', 'copy-empty-event', 'EVENT', 'Synthetic empty Event', NOW(),
         'NOT_REQUESTED', NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NOW())
    `, [vector]);

    await client.query(await readFile(path.join(migrationRoot, newMigration, "migration.sql"), "utf8"));
    const copied = await client.query(`
      SELECT embedding."profileKey", embedding."model", embedding."modelRevision",
             embedding."inputVersion", embedding."inputRevision", embedding."status",
             vector_dims(embedding."embedding") AS dimensions,
             embedding."embedding" = memory."embedding" AS same_vector,
             memory."embedding" IS NOT NULL AS legacy_present
      FROM "EventMemoryEmbedding" AS embedding
      INNER JOIN "EventMemory" AS memory ON memory."id" = embedding."eventMemoryId"
    `);
    assert.equal(copied.rowCount, 1);
    assert.deepEqual(copied.rows[0], {
      profileKey: "production-bge-small-en-v1.5-v1",
      model: "Xenova/bge-small-en-v1.5",
      modelRevision: "main",
      inputVersion: "summary-v1",
      inputRevision: 3,
      status: "GENERATED",
      dimensions: 384,
      same_vector: true,
      legacy_present: true
    });
    const legacy = await client.query(`SELECT count(*)::int AS count FROM "EventMemory"`);
    assert.equal(legacy.rows[0].count, 2);
  } finally {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
