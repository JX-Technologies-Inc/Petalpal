import { compositionMockResponse, developmentSources } from '../fixtures/native-composition.js';
import { nativeMockResponse } from "../fixtures/native-reflection.js";
import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createProductionAiWorker } from "../../lib/ai-worker.js";
import { ReportInputService } from "../../lib/report-foundation.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";
import { REPORT_NARRATIVE_GENERATION_VERSION } from "../../lib/report-narrative.js";
import { weeklyReportLocale } from "../../lib/report-locale.js";
import { PrismaAiCostGate } from "../../lib/ai-cost-gate.js";
import { assertReportSources } from "../../lib/report-write-fence.js";
import { buildWeeklyReflectionPacket, validateWeeklyReflection, weeklyReportProvider,
  WEEKLY_REFLECTION_CONTRACT, SONNET_WEEKLY_MODEL, SonnetWeeklyReflectionService } from "../../lib/sonnet-weekly.js";

const enabled = { AI_WEEKLY_REPORT_PROVIDER: "anthropic", AI_WEEKLY_REPORT_MODEL: SONNET_WEEKLY_MODEL,
  AI_GATEWAY_ENABLED: "true", AI_GATEWAY_ANTHROPIC_ENABLED: "true",
  CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_AI_GATEWAY_ID: "synthetic-weekly",
  CLOUDFLARE_AI_GATEWAY_TOKEN: "synthetic-gateway", ANTHROPIC_API_KEY: "synthetic-provider",
  AI_USER_DAILY_USD_LIMIT: "10", AI_USER_MONTHLY_USD_LIMIT: "10", AI_GLOBAL_DAILY_USD_LIMIT: "10",
  AI_GLOBAL_MONTHLY_USD_LIMIT: "10", AI_ANTHROPIC_MONTHLY_USD_LIMIT: "10" };
const summaries = locale => locale === "en" ? ["I finished a sketch. It was a quiet afternoon.", "I shared my drawing with a friend."]
  : locale === "zh-Hant" ? ["今天畫完了一幅素描。那個下午很安靜。", "我把畫分享給朋友，聊了彼此的近況。"]
    : ["今天画完了一幅素描。那个下午很安静。", "我把画分享给朋友，聊了彼此的近况。"];
function output(packet) {
  return { version: WEEKLY_REFLECTION_CONTRACT, locale: packet.locale,
    moments: packet.evidence.filter(item => item.sentences.length).slice(0, 2).map(item => ({ ref: item.ref, quote: item.sentences[0] })), insights: [] };
}
const native = data => ({ model: SONNET_WEEKLY_MODEL, type: "message", role: "assistant", stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(data) }], usage: { input_tokens: 300, output_tokens: 100 } });

function contractInput(locale = "zh-Hans") {
  const evidence = summaries(locale).map((summary, i) => ({ ownerId: "alice", sourceEventId: `event-${i}`, sourceMemoryId: `memory-${i}`,
    summary, topics: [locale === "en" ? "drawing" : "画画"], eventDate: `2026-09-${15 + i}T00:00:00Z`,
    provenance: { sourceEventId: `event-${i}`, sourceMemoryId: `memory-${i}` } }));
  const period = { periodKey: "2026-09-14", periodStartUtc: new Date("2026-09-14"), periodEndUtc: new Date("2026-09-21") };
  return { reportType: "WEEKLY", ownerId: "alice", locale, period, aggregates: { ...period, ownerId: "alice", eventCount: 2, topTopics: [] },
    evidenceSelection: { ownerId: "alice", status: "READY", evidence },
    sourceFence: { evidencePolicy: "weekly-localized-v1", sources: evidence.map(item => ({ id: item.sourceEventId,
      occurredAt: +new Date(item.eventDate), memory: { topics: item.topics } })) } };
}

// Disposable SQL engine and synthetic fixtures only; no real models, production
// schema/migrations, accounts or external connections. SQL rollback is real;
// independent-connection PostgreSQL row-lock scheduling is not simulated here.
async function fixture(t, { locale = "zh-CN", count = 2 } = {}) {
  const pg = new PGlite({ parsers: { 1114: value => new Date(`${value}Z`) } }); t.after(() => pg.close());
  await pg.exec(`CREATE TYPE "AIJobType" AS ENUM ('WEEKLY_REPORT','MONTHLY_REPORT');
    CREATE TYPE "AIJobStatus" AS ENUM ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED');
    CREATE TABLE "User" ("id" text PRIMARY KEY,"timezone" text,"preferredLocale" text);
    CREATE TABLE "AiConsent" ("userId" text PRIMARY KEY,"aiProcessing" boolean,"personalization" boolean,"memoryEnabled" boolean,"updatedAt" timestamp(3));
    INSERT INTO "AiConsent" VALUES ('alice',true,true,true,'2000-01-01'),('bob',true,true,true,'2000-01-01');
    CREATE TABLE "Event" ("id" text PRIMARY KEY,"ownerId" text,"occurredAt" timestamp(3),"updatedAt" timestamp(3),"memoryProcessingAllowed" boolean);
    CREATE TABLE "EventMemory" ("id" text PRIMARY KEY,"ownerId" text,"sourceEventId" text REFERENCES "Event" ON DELETE CASCADE,
      "updatedAt" timestamp(3),"embeddingInputRevision" integer,"memoryType" text,"summary" text,"topics" json,"importanceScore" double precision,
      "embeddingStatus" text,"embeddedInputRevision" integer);
    CREATE TABLE "AIJob" ("id" text PRIMARY KEY,"ownerId" text,"jobType" "AIJobType","resourceId" text,"idempotencyKey" text,
      "status" "AIJobStatus","attemptCount" integer,"maxAttempts" integer,"lockedAt" timestamp(3),"lockedBy" text,"leaseExpiresAt" timestamp(3),
      "startedAt" timestamp(3),"completedAt" timestamp(3),"createdAt" timestamp(3),"updatedAt" timestamp(3),"nextAttemptAt" timestamp(3),"lastError" text);
    INSERT INTO "AIJob" VALUES ('job-1','alice','WEEKLY_REPORT','2026-09-14','WEEKLY_REPORT:2026-09-14:grounded-narrative-v1',
      'PENDING',0,3,NULL,NULL,NULL,NULL,NULL,now(),now(),'2000-01-01',NULL);
    CREATE TABLE "AuditEvent" ("id" text PRIMARY KEY,"createdAt" timestamp NOT NULL DEFAULT now(),"eventType" varchar(64),"outcome" varchar(32),
      "actorUserId" varchar(128),"targetClass" varchar(64),"targetSafeId" varchar(128),"actionCode" varchar(64),"reasonCode" varchar(64));
    CREATE TABLE "WeeklyReport" ("id" text PRIMARY KEY,"ownerId" text,"periodKey" text,"document" jsonb,UNIQUE("ownerId","periodKey"));
    CREATE TABLE "AIEvidence" ("id" serial PRIMARY KEY,"ownerId" text,"sourceEventId" text REFERENCES "Event" ON DELETE CASCADE,
      "sourceMemoryId" text,"weeklyReportId" text REFERENCES "WeeklyReport" ON DELETE CASCADE,"claimType" text);`);
  await pg.query('INSERT INTO "User" VALUES (\'alice\',\'UTC\',$1),(\'bob\',\'UTC\',\'en\')', [locale]);
  const normalized = weeklyReportLocale(locale);
  for (let i = 0; i < count; i++) {
    await pg.query('INSERT INTO "Event" VALUES ($1,\'alice\',$2,\'2026-09-21\',true)', [`event-${i}`, new Date(`2026-09-${15 + i}`)]);
    await pg.query('INSERT INTO "EventMemory" VALUES ($1,\'alice\',$2,\'2026-09-21\',1,\'EVENT\',$3,$4,0.8,\'GENERATED\',1)',
      [`memory-${i}`, `event-${i}`, summaries(normalized)[i % 2], JSON.stringify([normalized === "en" ? "drawing" : "画画"])]);
  }
  let response = packet => Response.json(native(output(packet))), retrievalHook, failEvidence = false, expireCompletion = false;
  const calls = [], logs = []; let retrievalCalls = 0, legacyCalls = 0;
  const adapt = db => {
    const query = async (sql, ...args) => (await db.query(sql, args)).rows;
    const jobWhere = where => {
      const params = [];
      const sql = Object.entries(where).map(([key, value]) => {
        params.push(value && typeof value === "object" && !(value instanceof Date) ? value.gt : value);
        return `"${key}"${value && typeof value === "object" && !(value instanceof Date) ? ">" : "="}$${params.length}`;
      }).join(" AND "); return { sql, params };
    };
    const report = row => row ? { id: row.id, ...row.document } : null;
    return {
      $queryRawUnsafe: async (sql, ...args) => {
        if (expireCompletion && sql.includes('UPDATE "AIJob" SET "status" = \'SUCCEEDED\'')) {
          await query('UPDATE "AIJob" SET "leaseExpiresAt"=\'2000-01-01\'');
        }
        return query(sql, ...args);
      },
      user: { findUnique: async ({ where }) => (await query('SELECT * FROM "User" WHERE "id"=$1', where.id))[0] },
      aiConsent: { findUnique: async ({ where }) => (await query('SELECT * FROM "AiConsent" WHERE "userId"=$1', where.userId))[0] },
      event: { findMany: async ({ where }) => query(`SELECT event.*, row_to_json(memory) AS memory FROM "Event" event
        LEFT JOIN "EventMemory" memory ON memory."sourceEventId"=event."id" AND memory."ownerId"=event."ownerId"
        WHERE event."ownerId"=$1 AND event."memoryProcessingAllowed"=true AND event."occurredAt">=$2 AND event."occurredAt"<$3 ORDER BY event."id"`,
      where.ownerId, where.occurredAt.gte, where.occurredAt.lt) },
      aiJob: {
        findUnique: async ({ where }) => (await query('SELECT * FROM "AIJob" WHERE "id"=$1', where.id))[0],
        updateMany: async ({ where, data }) => {
          const w = jobWhere(where), changes = Object.entries(data);
          const set = changes.map(([key], i) => `"${key}"=$${w.params.length + i + 1}`).join(",");
          return { count: (await query(`UPDATE "AIJob" SET ${set} WHERE ${w.sql} RETURNING "id"`, ...w.params, ...changes.map(([, value]) => value))).length };
        }
      },
      weeklyReport: {
        findFirst: async ({ where }) => {
          const row = report((await query('SELECT * FROM "WeeklyReport" WHERE "ownerId"=$1 AND "periodKey"=$2', where.ownerId, where.periodKey))[0]);
          return row && (!where.narrativeStatus || row.narrativeStatus !== where.narrativeStatus.not) ? row : null;
        },
        findUnique: async ({ where }) => report((await query('SELECT * FROM "WeeklyReport" WHERE "ownerId"=$1 AND "periodKey"=$2',
          where.ownerId_periodKey.ownerId, where.ownerId_periodKey.periodKey))[0]),
        upsert: async ({ create }) => {
          const rows = await query('INSERT INTO "WeeklyReport" VALUES (\'report-1\',$1,$2,$3) ON CONFLICT ("ownerId","periodKey") DO UPDATE SET "document"=EXCLUDED."document" RETURNING *',
            create.ownerId, create.periodKey, JSON.stringify(create)); return report(rows[0]);
        }
      },
      aiEvidence: {
        deleteMany: async ({ where }) => query('DELETE FROM "AIEvidence" WHERE "ownerId"=$1 AND "weeklyReportId"=$2', where.ownerId, where.weeklyReportId),
        createMany: async ({ data }) => {
          if (failEvidence) throw Error("SYNTHETIC_PRIVATE_WRITE_ERROR");
          for (const item of data) await query('INSERT INTO "AIEvidence" ("ownerId","sourceEventId","sourceMemoryId","weeklyReportId","claimType") VALUES ($1,$2,$3,$4,$5)',
            item.ownerId, item.sourceEventId, item.sourceMemoryId, item.weeklyReportId, item.claimType);
        }
      }
    };
  };
  const db = { ...adapt(pg), $transaction: fn => pg.transaction(tx => fn(adapt(tx))) };
  const retrieval = { retrieve: async ({ identity, dateFrom, dateTo }) => {
    retrievalCalls++; if (retrievalHook) await retrievalHook();
    return (await db.event.findMany({ where: { ownerId: identity.userId, occurredAt: { gte: dateFrom, lt: dateTo } } }))
      .filter(event => event.memory).map(event => ({ ...event.memory, eventDate: event.occurredAt, similarity: 0.9 }));
  } };
  const fetchImpl = async (url, options) => {
    assert.equal(url, `https://gateway.ai.cloudflare.com/v1/${"a".repeat(32)}/synthetic-weekly/anthropic/v1/messages`);
    const body = JSON.parse(options.body), packet = JSON.parse(body.messages[0].content);
    calls.push({ body, packet, options }); return response(packet, options);
  };
  const embeddingProvider = { describeProfile: () => getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
    embedQuery: () => assert.fail("injected retrieval only"), embedDocuments: () => assert.fail("no embedding inference") };
  const make = (env = enabled) => createProductionAiWorker({ prisma: db, env, gatewayFetchImpl: fetchImpl, embeddingProvider, semanticRetrieval: retrieval,
    workerId: "worker-1", retryDelayMs: 0, logger: { error: (...args) => logs.push(args) },
    reportNarrativeProvider: { async generateNarrative() { legacyCalls++; return { sections: [{ kind: "RECENT_MOMENTS",
      claim: summaries("en")[0], evidenceRefs: [{ sourceEventId: "event-0", sourceMemoryId: "memory-0" }], aggregateRefs: [] }] }; } } });
  const run = (env = enabled) => make(env).runJob({ jobId: "job-1", ownerId: "alice", jobType: "WEEKLY_REPORT" });
  return { pg, db, calls, logs, run, make, get retrievalCalls() { return retrievalCalls; }, get legacyCalls() { return legacyCalls; },
    respond: fn => { response = fn; }, retrievalHook: fn => { retrievalHook = fn; }, failEvidence: () => { failEvidence = true; },
    expireCompletion: () => { expireCompletion = true; }, rows: table => db.$queryRawUnsafe(`SELECT * FROM "${table}"`) };
}

test("versioned localized contract renders concise grounded English and Chinese with cited overview/insights", () => {
  for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
    const input = contractInput(locale), packet = buildWeeklyReflectionPacket(input), raw = output(packet);
    raw.insights = [{ kind: "RECURRING_TOPIC", topic: packet.evidence[0].topics[0], refs: ["E1", "E2"] }];
    const result = validateWeeklyReflection(raw, input, packet);
    assert.equal(result.sections.length, 2); assert.equal(result.sections[0].evidenceRefs.length, 2);
    assert.equal(result.sections[0].contractVersion, WEEKLY_REFLECTION_CONTRACT);
    for (const moment of raw.moments) assert.ok(result.narrative.includes(moment.quote));
    if (locale !== "en") assert.ok([...result.narrative].length >= 100 && [...result.narrative].length <= 180);
  }
  assert.equal(weeklyReportLocale("en-CA"), "en"); assert.equal(weeklyReportLocale("zh-TW"), "zh-Hant");
  assert.equal(weeklyReportLocale("zh-CN"), "zh-Hans"); assert.throws(() => weeklyReportLocale("ja"));
  for (const [locale, quote] of [["en", "I ran 3.5 kilometres, not a marathon."], ["zh-Hans", "我跑了３公里，没有参加比赛。"]]) {
    const input = contractInput(locale); input.evidenceSelection.evidence[0].summary = quote;
    const packet = buildWeeklyReflectionPacket(input);
    assert.ok(validateWeeklyReflection(output(packet), input, packet).narrative.includes(quote));
  }
});

test("Chinese and English grounding rejects fabricated facts, partial negation, numerals, unsupported insights and output fields", () => {
  for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
    const input = contractInput(locale), packet = buildWeeklyReflectionPacket(input), valid = output(packet);
    for (const mutate of [data => { data.version = "invented-v2"; }, data => { data.locale = "ja"; },
      data => { data.overview = "You are improving emotionally / 你的情绪越来越好"; },
      data => { data.moments[0].quote = "我升职了，收入增加了三倍。"; }, data => { data.moments[0].quote = "你完成了２次治疗。"; },
      data => { data.moments[0].quote = "I received a promotion."; }, data => { data.moments[0].ref = "event-bob"; },
      data => { data.moments[1] = data.moments[0]; }, data => { data.moments.push(data.moments[0]); },
      data => { data.insights = [{ kind: "EMOTIONAL_PROGRESS", topic: "成长", refs: ["E1", "E2"] }]; },
      data => { data.insights = [{ kind: "RECURRING_TOPIC", topic: "unsupported", refs: ["E1", "E2"] }]; },
      data => { data.insights = [{ kind: "RECURRING_TOPIC", topic: packet.evidence[0].topics[0], refs: ["E1", "E1"] }]; }]) {
      const raw = structuredClone(valid); mutate(raw); assert.throws(() => validateWeeklyReflection(raw, input, packet));
    }
  }
  for (const [locale, summary, invented] of [["en", "I did not travel to Paris.", "travel to Paris"],
    ["zh-Hans", "我没有升职，也没有加薪。", "升职，也没有加薪。"]]) {
    const input = contractInput(locale); input.evidenceSelection.evidence[0].summary = summary;
    const packet = buildWeeklyReflectionPacket(input), raw = output(packet); raw.moments[0].quote = invented;
    assert.throws(() => validateWeeklyReflection(raw, input, packet));
  }
});

test("Sonnet stays off by default; existing Weekly provider, generation key and semantic route remain", async t => {
  assert.equal(weeklyReportProvider({}), "workers-ai");
  assert.equal(JSON.stringify(new SonnetWeeklyReflectionService({ env: enabled })), "{}");
  const f = await fixture(t, { locale: "en" }), result = await f.run({});
  assert.equal(result.succeeded, true, result.error?.stack); assert.equal(f.legacyCalls, 1); assert.equal(f.calls.length, 0);
  assert.equal(f.retrievalCalls, 1); assert.equal((await f.rows("WeeklyReport"))[0].document.generationVersion, REPORT_NARRATIVE_GENERATION_VERSION);
});

test("English Sonnet runs after durable admission, reuses semantic RAG and atomically saves evidence/completion", async t => {
  const f = await fixture(t, { locale: "en" });
  f.retrievalHook(async () => assert.equal((await f.rows("AuditEvent")).filter(row => row.eventType === "AI_COST_RESERVED").length, 1));
  const result = await f.run();
  assert.equal(result.succeeded, true, result.error?.stack); assert.equal(f.retrievalCalls, 1); assert.equal(f.calls.length, 1);
  assert.equal(f.legacyCalls, 0); assert.equal((await f.rows("AIJob"))[0].status, "SUCCEEDED");
  assert.equal((await f.rows("AIEvidence")).length, 2);
  const report = (await f.rows("WeeklyReport"))[0].document;
  assert.equal(report.eventCount, 2); assert.equal(report.narrativeSections[0].model, SONNET_WEEKLY_MODEL);
  const ledger = await f.rows("AuditEvent");
  assert.equal(ledger.length, 4); assert.equal(ledger.find(row => row.eventType === "AI_COST_RESERVED").reasonCode, "2");
  assert.equal(ledger.find(row => row.eventType === "AI_RETRIEVAL_RESERVED").targetClass, "CLOUDFLARE_WORKERS_AI");
  const { packet, body, options } = f.calls[0];
  assert.equal(options.headers["cf-aig-collect-log-payload"], "false"); assert.equal(options.headers["cf-aig-max-attempts"], "1");
  assert.equal(body.model, SONNET_WEEKLY_MODEL); assert.doesNotMatch(JSON.stringify(packet), /alice|bob|event-0|memory-0|Journal|sourceFence/);
});

test("Chinese Weekly uses owned period memories without embedding Chinese; no Journal or cross-owner source", async t => {
  const f = await fixture(t, { locale: "zh-TW" });
  const result = await f.run();
  assert.equal(result.succeeded, true, result.error?.stack); assert.equal(f.retrievalCalls, 0); assert.equal(f.calls.length, 1);
  const report = (await f.rows("WeeklyReport"))[0].document;
  assert.ok([...report.summary].length >= 100 && [...report.summary].length <= 180);
  assert.equal(report.narrativeSections[0].locale, "zh-Hant"); assert.ok(report.summary.includes("這週"));
  assert.equal(report.eventCount, 2); assert.equal(f.legacyCalls, 0);
  const input = await new ReportInputService({ prisma: f.db, semanticRetrieval: { retrieve: () => assert.fail("no Chinese query") }, localizedWeekly: true })
    .buildWeeklyInput({ identity: { userId: "alice" }, localDate: "2026-09-14" });
  await assert.rejects(f.db.$transaction(tx => assertReportSources(tx, "alice", {
    ...input, sourceFence: { ...input.sourceFence, evidencePolicy: undefined }
  })), { code: "REPORT_SOURCE_STALE" }, "legacy source policy still excludes Chinese evidence");
});

test("explicit invalid route/model/flags/config never switches to legacy or starts retrieval", async t => {
  for (const change of [{ AI_WEEKLY_REPORT_PROVIDER: "openai" }, { AI_WEEKLY_REPORT_MODEL: "claude-opus-5-5" },
    { AI_GATEWAY_ENABLED: undefined }, { AI_GATEWAY_ANTHROPIC_ENABLED: undefined }, { AI_USER_DAILY_USD_LIMIT: undefined },
    { AI_WEEKLY_REPORT_TIMEOUT_MS: "20001" }, { AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS: "4097" }, { AI_REPORT_SUPPORTED_LOCALES: "en,ja" }]) {
    const f = await fixture(t, { locale: "en" }), result = await f.run({ ...enabled, ...change });
    assert.equal(result.succeeded, false); assert.equal(f.calls.length, 0); assert.equal(f.retrievalCalls, 0); assert.equal(f.legacyCalls, 0);
  }
});

test("zero USD/shared call budgets deny before query embedding or narrative and roll back admission", async t => {
  const f = await fixture(t, { locale: "en" });
  for (const name of ["AI_USER_DAILY_USD_LIMIT", "AI_GLOBAL_MONTHLY_USD_LIMIT", "AI_ANTHROPIC_MONTHLY_USD_LIMIT", "AI_WEEKLY_REPORT_DAILY_LIMIT"]) {
    const result = await f.run({ ...enabled, [name]: "0" });
    assert.equal(result.error.code, "AI_QUOTA_EXCEEDED");
    await f.pg.exec(`UPDATE "AIJob" SET "status"='PENDING',"attemptCount"=0,"nextAttemptAt"='2000-01-01'`);
  }
  assert.equal(f.calls.length, 0); assert.equal(f.retrievalCalls, 0); assert.equal((await f.rows("AuditEvent")).length, 0);
  await f.pg.exec(`INSERT INTO "AuditEvent" ("id","eventType","actorUserId","targetClass","actionCode","reasonCode")
    VALUES ('prior-cf-calls','AI_COST_RESERVED','bob','CLOUDFLARE_WORKERS_AI','SPEECH_TRANSCRIPTION','100')`);
  const blocked = await f.run({ ...enabled, AI_PROVIDER_DAILY_CALL_LIMIT: "100" });
  assert.equal(blocked.error.code, "AI_QUOTA_EXCEEDED"); assert.equal(f.retrievalCalls, 0); assert.equal(f.calls.length, 0);
  assert.equal((await f.rows("AuditEvent")).length, 1, "no partial Sonnet or retrieval admission");
  await f.pg.exec('DELETE FROM "AuditEvent"');
  assert.equal((await f.run()).succeeded, true);
  await assert.rejects(new PrismaAiCostGate(f.db, { env: { AI_PROVIDER_DAILY_CALL_LIMIT: "1" } }).reserve({
    identity: { userId: "alice" }, action: "EVENT_EMOTION", key: "legacy-provider-cap" }), { code: "AI_QUOTA_EXCEEDED" });
});

test("insufficient evidence produces truthful empty report with deterministic statistics and no inference", async t => {
  for (const count of [1, 2]) {
    const f = await fixture(t, { count });
    if (count === 2) await f.pg.exec(`UPDATE "EventMemory" SET "summary"="id"||repeat('这是完整而不能截断的长句',10)`);
    const result = await f.run();
    assert.equal(result.succeeded, true, result.error?.stack); assert.equal(result.result.status, "INSUFFICIENT_EVIDENCE");
    const report = (await f.rows("WeeklyReport"))[0].document;
    assert.equal(report.summary, null); assert.equal(report.eventCount, count); assert.equal(f.calls.length, 0);
    assert.equal((await f.rows("AIJob"))[0].status, "SUCCEEDED");
  }
});

test("malformed/refused/unselected/ungrounded responses retain liability and cannot replay paid inference", async t => {
  for (const response of [() => new Response("invalid", { headers: { "content-type": "application/json" } }),
    packet => Response.json({ ...native(output(packet)), stop_reason: "refusal" }),
    packet => Response.json(native({ ...output(packet), overview: "你的情绪明显改善。" })),
    () => new Response("SYNTHETIC_PRIVATE_MARKER", { status: 503 })]) {
    const f = await fixture(t); f.respond(response);
    const first = await f.run(); assert.equal(first.succeeded, false);
    const second = await f.run(); assert.equal(second.error.code, "AI_INFERENCE_ALREADY_RESERVED");
    assert.equal(f.calls.length, 1); assert.equal(f.legacyCalls, 0); assert.equal((await f.rows("WeeklyReport")).length, 0);
    assert.equal(JSON.stringify(f.logs).includes("SYNTHETIC_PRIVATE_MARKER"), false);
  }
});

test("timeout during retrieval prevents late Gateway dispatch and keeps duplicate-query tombstone", async t => {
  const f = await fixture(t, { locale: "en" }); let release;
  f.retrievalHook(() => new Promise(resolve => { release = resolve; }));
  const result = await f.run({ ...enabled, AI_WEEKLY_REPORT_TIMEOUT_MS: "250" });
  assert.equal(result.error.code, "AI_GATEWAY_TIMEOUT"); release();
  await new Promise(setImmediate); await new Promise(setImmediate);
  assert.equal(f.calls.length, 0); assert.equal(f.retrievalCalls, 1);
  assert.equal((await f.run()).error.code, "AI_INFERENCE_ALREADY_RESERVED"); assert.equal(f.retrievalCalls, 1);
});

test("late noncooperative Sonnet fetch cannot validate or persist after timeout", async t => {
  const f = await fixture(t); let release, packet;
  f.respond(value => { packet = value; return new Promise(resolve => { release = resolve; }); });
  const result = await f.run({ ...enabled, AI_WEEKLY_REPORT_TIMEOUT_MS: "250" });
  assert.equal(result.error.code, "AI_GATEWAY_TIMEOUT");
  const response = Response.json(native(output(packet))), reader = t.mock.method(response.body, "getReader");
  release(response); await new Promise(setImmediate); await new Promise(setImmediate);
  assert.equal(reader.mock.callCount(), 0); assert.equal((await f.rows("WeeklyReport")).length, 0);
  assert.equal((await f.rows("AuditEvent")).length, 3);
});

test("consent revocation/regrant, Event deletion, memory change and locale change reject late results", async t => {
  for (const mutation of ["revoke", "epoch", "delete", "memory", "locale"]) {
    const f = await fixture(t);
    f.respond(async packet => {
      if (mutation === "revoke") await f.pg.exec('UPDATE "AiConsent" SET "memoryEnabled"=false');
      if (mutation === "epoch") await f.pg.exec('UPDATE "AiConsent" SET "updatedAt"=\'2099-01-01\'');
      if (mutation === "delete") await f.pg.exec('DELETE FROM "Event" WHERE "id"=\'event-0\'');
      if (mutation === "memory") await f.pg.exec('UPDATE "EventMemory" SET "summary"=\'Changed source\'');
      if (mutation === "locale") await f.pg.exec('UPDATE "User" SET "preferredLocale"=\'en\'');
      return Response.json(native(output(packet)));
    });
    const result = await f.run();
    assert.ok(result.succeeded === false || result.result?.status === "CONSENT_INELIGIBLE");
    assert.equal((await f.rows("WeeklyReport")).length, 0); assert.equal((await f.rows("AuditEvent")).length, 4);
  }
});

test("duplicate execution completes only once and preserves finalized reflection across provider selection", async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.run(), f.run()]);
  assert.equal(results.filter(item => item.succeeded).length, 1); assert.equal(f.calls.length, 1);
  assert.equal((await f.run()).claimed, false);
  await f.pg.exec(`UPDATE "AIJob" SET "status"='PENDING',"attemptCount"=0,"nextAttemptAt"='2000-01-01'`);
  const existing = await f.run({});
  assert.equal(existing.result.skipped, true); assert.equal(f.calls.length, 1); assert.equal(f.legacyCalls, 0);
});

test("evidence write failure and lease expiry roll back report/evidence/completion together", async t => {
  for (const stage of ["evidence", "completion"]) {
    const f = await fixture(t); if (stage === "evidence") f.failEvidence(); else f.expireCompletion();
    const result = await f.run(); assert.equal(result.succeeded, false);
    assert.equal((await f.rows("WeeklyReport")).length, 0); assert.equal((await f.rows("AIEvidence")).length, 0);
    assert.notEqual((await f.rows("AIJob"))[0].status, "SUCCEEDED"); assert.equal((await f.rows("AuditEvent")).length, 4);
  }
});

test("localized source policy rejects wrong owners, Journal memories, unsupported locale and period changes", async t => {
  for (const change of ["owner", "journal", "locale", "period", "job-period"]) {
    const f = await fixture(t);
    if (change === "owner") await f.pg.exec('UPDATE "EventMemory" SET "ownerId"=\'bob\'');
    if (change === "journal") await f.pg.exec('UPDATE "EventMemory" SET "memoryType"=\'JOURNAL\'');
    if (change === "locale") await f.pg.exec('UPDATE "User" SET "preferredLocale"=\'ja\'');
    if (change === "period") await f.pg.exec('UPDATE "Event" SET "occurredAt"=\'2026-10-01\'');
    if (change === "job-period") await f.pg.exec(`UPDATE "AIJob" SET "resourceId"='2026-09-16',"idempotencyKey"='WEEKLY_REPORT:2026-09-16:grounded-narrative-v1'`);
    const result = await f.run();
    assert.equal(f.calls.length, 0); assert.equal(f.retrievalCalls, 0);
    assert.ok(result.succeeded === false || result.result?.status === "INSUFFICIENT_EVIDENCE");
  }
});


for (const contract of ['native-reflection-v2', 'native-reflection-v2.1']) {
  const nativeEnv = { ...enabled, AI_REPORT_REFLECTION_CONTRACT: contract };
  const responseFor = contract === 'native-reflection-v2' ? nativeMockResponse : compositionMockResponse;
  async function contractFixture(t, options) {
    const f = await fixture(t, options);
    if (contract === 'native-reflection-v2.1') {
      const rows = (await f.pg.query('SELECT "id" FROM "EventMemory" WHERE "ownerId"=\'alice\' ORDER BY "id"')).rows;
      for (const [i, row] of rows.entries()) await f.pg.query('UPDATE "EventMemory" SET "summary"=$1,"topics"=\'[]\' WHERE "id"=$2', [row.id.startsWith('prior-') ? 'I drew in my sketchbook.' : developmentSources[i % developmentSources.length], row.id]);
    }
    return f;
  }
test(`${contract} Weekly uses existing Gateway, admission and atomic persistence in all three locales`, async t => {
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const f = await contractFixture(t, { locale });
    f.respond(packet => Response.json(native(responseFor(packet))));
    const result = await f.run(nativeEnv);
    assert.equal(result.succeeded, true, result.error?.code);
    assert.equal(f.calls.length, 1); assert.equal(f.legacyCalls, 0);
    const report = (await f.rows("WeeklyReport"))[0].document;
    assert.equal(report.narrativeSections[0].contractVersion, contract);
    assert.deepEqual(report.narrativeSections[0][contract === "native-reflection-v2" ? "nativeBlocks" : "nativeParagraphs"], responseFor(f.calls[0].packet)[contract === "native-reflection-v2" ? "blocks" : "paragraphs"]);
    assert.ok((await f.rows("AIEvidence")).length >= 2);
    assert.equal((await f.rows("AIJob"))[0].status, "SUCCEEDED");
    assert.equal((await f.rows("AuditEvent")).length, 4);
    assert.doesNotMatch(JSON.stringify(f.calls[0].packet), /alice|bob|event-0|memory-0|sourceFence/);
    assert.equal(f.retrievalCalls, locale === "en" ? 1 : 0);
  }
});

test(`${contract} Weekly rejects unsupported prose and refusal without repair, v1 fallback or paid replay`, async t => {
  const sparse = await contractFixture(t);
  await sparse.pg.exec('DELETE FROM "EventMemory" WHERE "id"<>\'memory-0\'');
  const sparseResult = await sparse.run(nativeEnv);
  assert.equal(sparseResult.succeeded, true); assert.equal(sparseResult.result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(sparse.calls.length, 0); assert.equal(sparse.legacyCalls, 0);
  for (const mode of ["ungrounded", "refusal", "truncated", "malformed"]) {
    const f = await contractFixture(t);
    f.respond(packet => {
      if (mode === "malformed") return new Response("invalid");
      const output = responseFor(packet);
      if (mode === "ungrounded") (output.paragraphs?.[0] || output.blocks[0].clauses[0]).text = "Drawing cured your anxiety / 你的情绪已经好转";
      const envelope = native(output);
      if (mode === "refusal") envelope.stop_reason = "refusal";
      if (mode === "truncated") envelope.stop_reason = "max_tokens";
      return Response.json(envelope);
    });
    assert.equal((await f.run(nativeEnv)).succeeded, false);
    assert.equal((await f.run({ ...enabled, AI_REPORT_REFLECTION_CONTRACT: "v1" })).error.code, "AI_INFERENCE_ALREADY_RESERVED");
    assert.equal(f.calls.length, 1); assert.equal(f.legacyCalls, 0); assert.equal((await f.rows("WeeklyReport")).length, 0);
  }
});

test(`${contract} Weekly consent, owner, cost and contract denial prevents dispatch`, async t => {
  for (const mode of ["consent", "owner", "cost", "contract"]) {
    const f = await contractFixture(t, { locale: "en" });
    if (mode === "consent") await f.pg.exec('UPDATE "AiConsent" SET "memoryEnabled"=false');
    const env = { ...nativeEnv, ...(mode === "cost" ? { AI_USER_DAILY_USD_LIMIT: "0" } : {}),
      ...(mode === "contract" ? { AI_REPORT_REFLECTION_CONTRACT: "unreviewed" } : {}) };
    if (mode === "owner") assert.equal((await f.make(env).runJob({ jobId: "job-1", ownerId: "bob", jobType: "WEEKLY_REPORT" })).claimed, false);
    else { const result = await f.run(env); assert.ok(!result.succeeded || result.result?.status === "CONSENT_INELIGIBLE"); }
    assert.equal(f.calls.length, 0); assert.equal(f.retrievalCalls, 0); assert.equal(f.legacyCalls, 0);
  }
});

test(`${contract} Weekly stale sources, revocation and evidence-write failure cannot persist returned prose`, async t => {
  for (const stage of ["delete", "revoke", "epoch", "evidence", "revision"]) {
    const f = await contractFixture(t); if (stage === "evidence") f.failEvidence();
    f.respond(async packet => {
      if (stage === "delete") await f.pg.exec('DELETE FROM "Event" WHERE "id"=\'event-0\'');
      if (stage === "revoke") await f.pg.exec('UPDATE "AiConsent" SET "memoryEnabled"=false');
      if (stage === "epoch") await f.pg.exec('UPDATE "AiConsent" SET "updatedAt"=\'2099-01-01\'');
      if (stage === "revision") await f.pg.exec('UPDATE "EventMemory" SET "embeddingInputRevision"=2 WHERE "id"=\'memory-0\'');
      return Response.json(native(responseFor(packet)));
    });
    const result = await f.run(nativeEnv);
    assert.ok(result.succeeded === false || result.result?.status === "CONSENT_INELIGIBLE");
    assert.equal((await f.rows("WeeklyReport")).length, 0); assert.equal((await f.rows("AIEvidence")).length, 0);
    assert.equal((await f.rows("AuditEvent")).length, 4);
  }
});

test(`${contract} Weekly late fetch ignores AbortSignal safely and finalized results stay immutable under v1 selection`, async t => {
  const f = await contractFixture(t); let release, packet;
  f.respond(value => { packet = value; return new Promise(resolve => { release = resolve; }); });
  const result = await f.run({ ...nativeEnv, AI_WEEKLY_REPORT_TIMEOUT_MS: "250" });
  assert.equal(result.error.code, "AI_GATEWAY_TIMEOUT");
  const response = Response.json(native(responseFor(packet))), reader = t.mock.method(response.body, "getReader");
  release(response); await new Promise(setImmediate); await new Promise(setImmediate);
  assert.equal(reader.mock.callCount(), 0); assert.equal((await f.rows("WeeklyReport")).length, 0);
  const saved = await contractFixture(t); saved.respond(value => Response.json(native(responseFor(value))));
  const concurrent = await Promise.all([saved.run(nativeEnv), saved.run(nativeEnv)]);
  assert.equal(concurrent.filter(item => item.succeeded).length, 1); assert.equal(saved.calls.length, 1);
  const before = (await saved.rows("WeeklyReport"))[0].document;
  for (const selectedContract of ['v1', 'native-reflection-v2', 'native-reflection-v2.1']) {
    await saved.pg.exec(`UPDATE "AIJob" SET "status"='PENDING',"attemptCount"=0,"nextAttemptAt"='2000-01-01'`);
    assert.equal((await saved.run({ ...enabled, AI_REPORT_REFLECTION_CONTRACT: selectedContract })).result.skipped, true);
    assert.deepEqual((await saved.rows("WeeklyReport"))[0].document, before); assert.equal(saved.calls.length, 1);
  }
  const v1 = await fixture(t);
  assert.equal((await v1.run(enabled)).succeeded, true);
  assert.equal(v1.calls.length, 1);
  const original = (await v1.rows("WeeklyReport"))[0].document;
  await v1.pg.exec(`UPDATE "AIJob" SET "status"='PENDING',"attemptCount"=0,"nextAttemptAt"='2000-01-01'`);
  assert.equal((await v1.run(nativeEnv)).result.skipped, true);
  assert.deepEqual((await v1.rows("WeeklyReport"))[0].document, original); assert.equal(v1.calls.length, 1);
});

}
