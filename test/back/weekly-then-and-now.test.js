import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { selectThenAndNow, THEN_AND_NOW } from "../../lib/weekly-then-and-now.js";
import { PrismaEventEmbeddingRepository } from "../../lib/semantic-retrieval.js";
import { LOCAL_EMBEDDING_PROFILE_KEY, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import { weeklyLookbackStart, weeklyPeriodForLocalDate } from "../../lib/ai-periods.js";

// Synthetic Events only. The week under report is 2026-10-05 .. 2026-10-12 (UTC).
let n = 0;
const entry = (date, text) => ({ eventId: `event-${++n}`, memoryId: `memory-${n}`, occurredAt: +new Date(date), text });

test("Chinese: a repeated phrase pairs whole sentences at least seven days apart, with a factual count", () => {
  const now = entry("2026-10-08T21:00:00Z", "今天加班到很晚。晚上又睡不着觉，脑子停不下来。");
  const close = entry("2026-10-03T21:00:00Z", "周五晚上睡不着觉。"); // five days before: too close to be "then"
  const then = entry("2026-09-20T21:00:00Z", "搬家以后一直睡不着觉。周末去了公园。");
  const third = entry("2026-09-14T21:00:00Z", "又是睡不着觉的一晚。");
  const result = selectThenAndNow({ locale: "zh-Hans", timezone: "Asia/Shanghai", current: [now], earlier: [close, then, third] });
  assert.equal(result.match, "REPEAT");
  assert.equal(result.phrase, "睡不着觉");
  assert.deepEqual(result.now, { sourceEventId: now.eventId, date: "2026-10-09", quote: "晚上又睡不着觉，脑子停不下来。" });
  assert.deepEqual(result.then, { sourceEventId: then.eventId, date: "2026-09-21", quote: "搬家以后一直睡不着觉。" });
  assert.equal(result.count, 4); // every entry in the five weeks that contains the phrase
});

test("everyday filler, short overlaps, long sentences and clipped endings never make a pair", () => {
  const now = entry("2026-10-08T12:00:00Z", "我今天又去了一趟超市。");
  const filler = entry("2026-09-20T12:00:00Z", "我今天又去了一趟银行。");
  assert.equal(selectThenAndNow({ locale: "zh-Hans", timezone: "UTC", current: [now], earlier: [filler] }), null);
  const long = "睡不着觉" + "然后一直想着工作上的事情".repeat(6) + "。";
  assert.equal(selectThenAndNow({ locale: "zh-Hans", timezone: "UTC",
    current: [entry("2026-10-08T12:00:00Z", long)], earlier: [entry("2026-09-20T12:00:00Z", "睡不着觉。")] }), null);
  const clippedNow = entry("2026-10-08T12:00:00Z", "我散了步。".repeat(98) + "最后还是一样睡不着觉"); // 500 chars, no ending mark
  assert.equal(clippedNow.text.length, 500);
  assert.equal(selectThenAndNow({ locale: "zh-Hans", timezone: "UTC", current: [clippedNow],
    earlier: [entry("2026-09-20T12:00:00Z", "还是睡不着觉。")] }), null);
  assert.equal(selectThenAndNow({ locale: "en", timezone: "UTC", current: [entry("2026-10-08T12:00:00Z", "I went to the shop today.")],
    earlier: [entry("2026-09-20T12:00:00Z", "I went to the bank today.")] }), null);
});

test("English: a change in wording (stored-vector similarity, no shared phrase) outranks a repeated phrase", () => {
  const now = entry("2026-10-07T18:00:00Z", "Slept through the whole night for once.");
  const changed = entry("2026-09-18T18:00:00Z", "Awake again at 3am, staring at the ceiling.");
  const repeated = entry("2026-09-22T18:00:00Z", "The whole night felt long. Slept through the alarm.");
  const similar = new Map([[now.memoryId, new Map([[changed.memoryId, 0.91], [repeated.memoryId, 0.7]])]]);
  const result = selectThenAndNow({ locale: "en", timezone: "UTC", current: [now], earlier: [repeated, changed], similar });
  assert.equal(result.match, "CHANGE"); assert.equal(result.phrase, null); assert.equal(result.count, null);
  assert.equal(result.then.quote, changed.text); assert.equal(result.now.quote, now.text);
  // Below the threshold, the repeated phrase is used instead, quoting the sentence that contains it.
  const weaker = new Map([[now.memoryId, new Map([[changed.memoryId, THEN_AND_NOW.minSimilarity - 0.01]])]]);
  const fallback = selectThenAndNow({ locale: "en", timezone: "UTC", current: [now], earlier: [repeated, changed], similar: weaker });
  assert.equal(fallback.match, "REPEAT"); assert.equal(fallback.phrase, "slept through");
  assert.equal(fallback.then.quote, "Slept through the alarm."); assert.equal(fallback.count, null);
});

test("the lookback is four whole account-timezone weeks, exact across a DST change", () => {
  // America/Vancouver leaves DST on 2026-11-01; the five-week span holds one 169-hour week.
  const period = weeklyPeriodForLocalDate("2026-11-16", "America/Vancouver");
  assert.equal(weeklyLookbackStart(period).toISOString(), "2026-10-19T07:00:00.000Z");
  assert.equal(weeklyLookbackStart(weeklyPeriodForLocalDate("2026-10-05", "UTC")).toISOString(), "2026-09-07T00:00:00.000Z");
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
async function migrated() {
  const database = new PGlite({ extensions: { vector } });
  const names = (await readdir(path.join(root, "prisma/migrations"), { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
  for (const name of names) await database.exec(await readFile(path.join(root, "prisma/migrations", name, "migration.sql"), "utf8"));
  return database;
}
const raw = database => {
  const adapt = client => ({ $queryRawUnsafe: async (sql, ...params) => (await client.query(sql, params)).rows });
  return { ...adapt(database), $transaction: callback => database.transaction(tx => callback(adapt(tx))) };
};
const unit = (a, b = 0) => [a, b, ...Array(382).fill(0)];

for (const profileKey of [LOCAL_EMBEDDING_PROFILE_KEY, PRODUCTION_EMBEDDING_PROFILE_KEY]) {
  test(`stored-vector search finds the owner's earlier Events without new inference (${profileKey})`, async () => {
    const database = await migrated();
    try {
      await database.exec(`
        INSERT INTO "User" ("id", "name", "timezone", "preferredLocale") VALUES ('alice', 'Alice', 'UTC', 'en'), ('bob', 'Bob', 'UTC', 'en');
        INSERT INTO "AiConsent" ("id", "userId", "termsVersion", "aiProcessing", "personalization", "memoryEnabled", "updatedAt")
        VALUES ('consent-alice', 'alice', 'ai-2026-10-15', true, true, true, '2026-09-01T00:00:00Z'), ('consent-bob', 'bob', 'ai-2026-10-15', true, true, true, '2026-09-01T00:00:00Z');
        INSERT INTO "Event" ("id", "ownerId", "content", "occurredAt", "timezone", "localDate", "idempotencyKey", "memoryProcessingAllowed", "updatedAt") VALUES
          ('e-now', 'alice', 'synthetic now', '2026-10-07T12:00:00Z', 'UTC', '2026-10-07', 'k1', true, CURRENT_TIMESTAMP),
          ('e-close', 'alice', 'synthetic close', '2026-09-20T12:00:00Z', 'UTC', '2026-09-20', 'k2', true, CURRENT_TIMESTAMP),
          ('e-far', 'alice', 'synthetic far', '2026-09-22T12:00:00Z', 'UTC', '2026-09-22', 'k3', true, CURRENT_TIMESTAMP),
          ('e-none', 'alice', 'synthetic none', '2026-09-23T12:00:00Z', 'UTC', '2026-09-23', 'k4', true, CURRENT_TIMESTAMP),
          ('e-bob', 'bob', 'synthetic bob', '2026-09-21T12:00:00Z', 'UTC', '2026-09-21', 'k5', true, CURRENT_TIMESTAMP);
        INSERT INTO "EventMemory" ("id", "ownerId", "sourceEventId", "memoryType", "summary", "eventDate", "updatedAt") VALUES
          ('m-now', 'alice', 'e-now', 'EVENT', 'synthetic now', '2026-10-07T12:00:00Z', CURRENT_TIMESTAMP),
          ('m-close', 'alice', 'e-close', 'EVENT', 'synthetic close', '2026-09-20T12:00:00Z', CURRENT_TIMESTAMP),
          ('m-far', 'alice', 'e-far', 'EVENT', 'synthetic far', '2026-09-22T12:00:00Z', CURRENT_TIMESTAMP),
          ('m-none', 'alice', 'e-none', 'EVENT', 'synthetic none', '2026-09-23T12:00:00Z', CURRENT_TIMESTAMP),
          ('m-bob', 'bob', 'e-bob', 'EVENT', 'synthetic bob', '2026-09-21T12:00:00Z', CURRENT_TIMESTAMP);`);
      const repository = new PrismaEventEmbeddingRepository(raw(database), profileKey);
      const consentUpdatedAt = new Date((await database.query(`SELECT "updatedAt" FROM "AiConsent" WHERE "userId" = 'alice'`)).rows[0].updatedAt);
      for (const [userId, memoryId, values] of [["alice", "m-now", unit(1)], ["alice", "m-close", unit(0.9, Math.sqrt(1 - 0.81))],
        ["alice", "m-far", unit(0, 1)], ["bob", "m-bob", unit(1)]]) {
        const granted = new Date((await database.query(`SELECT "updatedAt" FROM "AiConsent" WHERE "userId" = $1`, [userId])).rows[0].updatedAt);
        await repository.begin({ identity: { userId }, memoryId, inputRevision: 1 });
        await repository.store({ identity: { userId }, memoryId, inputRevision: 1, vector: values, consentUpdatedAt: granted });
      }
      const rows = await repository.similarToMemory({ identity: { userId: "alice" }, memoryId: "m-now", take: 10,
        dateFrom: new Date("2026-09-07T00:00:00Z"), dateTo: new Date("2026-09-30T12:00:00Z"), consentUpdatedAt });
      assert.deepEqual(rows.map(row => row.id), ["m-close", "m-far"]); // owner-scoped, embedded only, inside the window
      assert.ok(Math.abs(Number(rows[0].similarity) - 0.9) < 1e-6);
      assert.deepEqual(await repository.similarToMemory({ identity: { userId: "alice" }, memoryId: "m-none", consentUpdatedAt }), []);
      assert.deepEqual(await repository.similarToMemory({ identity: { userId: "alice" }, memoryId: "m-bob", consentUpdatedAt }), []);
    } finally {
      await database.close();
    }
  });
}
