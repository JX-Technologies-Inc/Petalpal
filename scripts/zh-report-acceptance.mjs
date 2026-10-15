// Owner-run zh-Hans Weekly/Monthly acceptance through the real ReportInputService, worker, cost gate,
// Gateway client, contracts and persistence. Synthetic data, disposable local PostgreSQL only.
//   offline       mocked Gateway response, $0, includes negative cases
//   live-weekly   exactly one real Sonnet call through petalpal-integration (approval required)
//   live-monthly  exactly one real Opus call, only after live-weekly passed in the same database
// Secrets are read from a hidden TTY prompt, never from env, files or arguments, and never printed.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
const DATABASES = { offline: "petalpal_acceptance_offline_test", "live-weekly": "petalpal_acceptance_live_test", "live-monthly": "petalpal_acceptance_live_test" };
const APPROVALS = { "live-weekly": "APPROVE-1-ZH-WEEKLY-SONNET-CALL", "live-monthly": "APPROVE-1-ZH-MONTHLY-OPUS-CALL" };
const GATEWAY_ID = mode === "offline" ? "petalpal-offline" : "petalpal-integration";
const WEEK = "2026-09-14", MONTH = "2026-09", OWNER = "zh-acceptance-alice", OTHER = "zh-acceptance-bob";
const stop = code => { console.log(JSON.stringify({ mode, result: "STOP", code })); process.exit(2); };

// Fail closed before importing any module that can open a database connection.
if (!DATABASES[mode]) stop("USAGE: offline | live-weekly | live-monthly");
if (existsSync(path.join(root, ".env"))) stop("DOTENV_PRESENT");
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL || process.env.NATIVE_SECURITY_TEST ||
    Object.keys(process.env).some(name => name.startsWith("RENDER") || /ANTHROPIC|GATEWAY|OPENAI|FIREBASE/.test(name))) stop("ENVIRONMENT_NOT_ISOLATED");
let dbUrl; try { dbUrl = new URL(process.env.DEV_DATABASE_URL); } catch { stop("DATABASE_URL_INVALID"); }
if (dbUrl.hostname !== "127.0.0.1" || dbUrl.port !== "55432" || dbUrl.pathname !== `/${DATABASES[mode]}`) stop("DATABASE_NOT_DISPOSABLE");
if (mode !== "offline" && process.env.PETALPAL_ZH_ACCEPTANCE_APPROVAL !== APPROVALS[mode]) stop("APPROVAL_REQUIRED");

const { PrismaClient } = await import("../generated/prisma/client.ts");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { createProductionAiWorker } = await import("../lib/ai-worker.js");
const { PrivateReportRepository } = await import("../lib/report-foundation.js");
const { REPORT_NARRATIVE_GENERATION_VERSION } = await import("../lib/report-narrative.js");
const { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } = await import("../lib/embedding-profiles.js");
const { SONNET_WEEKLY_MODEL, WEEKLY_REFLECTION_CONTRACT } = await import("../lib/sonnet-weekly.js");
const { OPUS_MONTHLY_MODEL, MONTHLY_REFLECTION_CONTRACT } = await import("../lib/opus-monthly.js");

// [local date, summary, topics, importance]. Positive and negative synthetic experiences across five weeks.
const ALICE = [
  ["2026-08-20", "暑假最后一次在家画画。", ["画画"], 0.5], ["2026-08-27", "整理了新学期的书单。", ["学习"], 0.4],
  ["2026-09-02", "开学第一周有点紧张。晚上和室友一起散步。", ["学校"], 0.6], ["2026-09-05", "周末去图书馆复习了两个小时。", ["学习"], 0.5],
  ["2026-09-08", "小组作业的分工没谈拢，我有点生气。", ["学习"], 0.7], ["2026-09-11", "给妈妈打了电话，聊了家里的事。", ["家人"], 0.6],
  ["2026-09-14", "今天画完了一幅素描。那个下午很安静。", ["画画"], 0.8], ["2026-09-16", "我把画分享给朋友，聊了彼此的近况。", ["画画", "朋友"], 0.7],
  ["2026-09-18", "考试成绩不太理想，心情有些低落。", ["学习"], 0.8], ["2026-09-20", "和朋友去公园跑步，感觉轻松多了。", ["运动", "朋友"], 0.6],
  ["2026-09-23", "在画室第一次试用了炭笔。", ["画画"], 0.6], ["2026-09-26", "熬夜赶报告，第二天很累。", ["学习"], 0.5],
  ["2026-09-29", "把新画的素描留在了书桌上。", ["画画"], 0.5]
];
const BOB = [["2026-09-15", "另一位用户的合成记录。", ["画画"], 0.9], ["2026-09-17", "另一位用户去了海边。", ["旅行"], 0.9]];

function secret(label) {
  if (!process.stdin.isTTY) stop("TTY_REQUIRED");
  return new Promise(resolve => {
    let value = ""; process.stdout.write(`${label} (hidden): `);
    process.stdin.setRawMode(true); process.stdin.setEncoding("utf8"); process.stdin.resume();
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003") { process.stdin.setRawMode(false); stop("CANCELLED"); }
        value = ch === "\u007f" ? value.slice(0, -1) : value + ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

function reportEnv({ account, token, key, live }) {
  // Live: one Weekly and one Monthly action at most; each report reserves two calls plus provider query liability.
  const usd = live ? "0.25" : "5", calls = live ? "6" : "40", actions = live ? "1" : "10";
  return Object.freeze({
    AI_GATEWAY_ENABLED: "true", AI_GATEWAY_ANTHROPIC_ENABLED: "true", AI_REPORT_SUPPORTED_LOCALES: "zh-Hans",
    CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: account, CLOUDFLARE_AI_GATEWAY_ID: GATEWAY_ID, CLOUDFLARE_AI_GATEWAY_TOKEN: token, ANTHROPIC_API_KEY: key,
    AI_WEEKLY_REPORT_PROVIDER: "anthropic", AI_WEEKLY_REPORT_MODEL: SONNET_WEEKLY_MODEL,
    AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS: "2048", AI_WEEKLY_REPORT_TIMEOUT_MS: "20000",
    AI_MONTHLY_REPORT_PROVIDER: "anthropic", AI_MONTHLY_REPORT_MODEL: OPUS_MONTHLY_MODEL,
    AI_MONTHLY_REPORT_MAX_OUTPUT_TOKENS: "4096", AI_MONTHLY_REPORT_TIMEOUT_MS: "20000",
    AI_USER_DAILY_USD_LIMIT: usd, AI_USER_MONTHLY_USD_LIMIT: usd, AI_GLOBAL_DAILY_USD_LIMIT: usd,
    AI_GLOBAL_MONTHLY_USD_LIMIT: usd, AI_ANTHROPIC_MONTHLY_USD_LIMIT: usd,
    AI_USER_DAILY_CALL_LIMIT: calls, AI_GLOBAL_DAILY_CALL_LIMIT: calls, AI_PROVIDER_DAILY_CALL_LIMIT: calls,
    AI_WEEKLY_REPORT_DAILY_LIMIT: actions, AI_MONTHLY_REPORT_DAILY_LIMIT: actions
  });
}

// Offline only: deterministic contract outputs equivalent to the existing PGlite tests.
function mockOutput(model, packet) {
  if (model === SONNET_WEEKLY_MODEL) return { version: WEEKLY_REFLECTION_CONTRACT, locale: packet.locale, insights: [],
    moments: packet.evidence.filter(item => item.sentences.length).slice(0, 2).map(item => ({ ref: item.ref, quote: item.sentences[0] })) };
  const insights = [];
  for (const kind of ["CROSS_WEEK_TOPIC", "SELECTED_TOPIC_CHANGE"]) {
    const fact = packet.facts.find(item => item.kind === kind); if (fact) insights.push({ kind, factId: fact.id });
  }
  if (!insights.length) { const fact = packet.facts.find(item => item.kind === "CROSS_WEEK_MOMENTS"); if (fact) insights.push({ kind: fact.kind, factId: fact.id }); }
  return { version: MONTHLY_REFLECTION_CONTRACT, locale: packet.locale, overview: "O1", insights, closing: { factId: insights[0].factId, style: "OPEN" } };
}

// Every dispatch is counted before any network access; live mode refuses a second call or an unexpected URL.
function gatewayFetch({ account, live }) {
  const expected = `https://gateway.ai.cloudflare.com/v1/${account}/${GATEWAY_ID}/anthropic/v1/messages`;
  const state = { calls: 0, beforeResponse: null };
  state.impl = async (url, options) => {
    state.calls += 1;
    if (url !== expected || (live && state.calls > 1)) throw new Error("DISPATCH_REFUSED");
    if (live) return fetch(url, options);
    const body = JSON.parse(options.body), packet = JSON.parse(body.messages[0].content);
    if (state.beforeResponse) await state.beforeResponse(packet);
    return Response.json({ model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(mockOutput(body.model, packet)) }], usage: { input_tokens: 600, output_tokens: 150 } });
  };
  return state;
}

async function seedOwner(prisma, ownerId, rows, { memoryEnabled = true } = {}) {
  await prisma.user.create({ data: { id: ownerId, name: `Synthetic ${ownerId}`, preferredLocale: "zh-Hans", timezone: "UTC" } });
  await prisma.aiConsent.create({ data: { userId: ownerId, termsVersion: "synthetic-acceptance", aiProcessing: true,
    personalization: true, memoryEnabled, grantedAt: new Date() } });
  for (const [index, [localDate, summary, topics, importanceScore]] of rows.entries()) {
    const occurredAt = new Date(`${localDate}T12:00:00.000Z`), id = `${ownerId}-event-${index}`;
    await prisma.event.create({ data: { id, ownerId, content: summary, occurredAt, timezone: "UTC", localDate,
      idempotencyKey: `${ownerId}-seed-${index}`, memoryProcessingAllowed: true } });
    await prisma.eventMemory.create({ data: { id: `${ownerId}-memory-${index}`, ownerId, sourceEventId: id, memoryType: "EVENT",
      summary, eventDate: occurredAt, topics, importanceScore } });
  }
}

const reportKind = type => type === "WEEKLY"
  ? { jobType: "WEEKLY_REPORT", periodKey: WEEK, model: SONNET_WEEKLY_MODEL, table: "weeklyReport", evidenceField: "weeklyReportId", read: "getWeeklyReportById" }
  : { jobType: "MONTHLY_REPORT", periodKey: MONTH, model: OPUS_MONTHLY_MODEL, table: "monthlyReport", evidenceField: "monthlyReportId", read: "getMonthlyReportById" };

async function runReport({ prisma, worker, ownerId, type }) {
  const kind = reportKind(type);
  const job = await prisma.aiJob.create({ data: { id: `${ownerId}-${kind.jobType}-${kind.periodKey}`, ownerId, jobType: kind.jobType,
    resourceId: kind.periodKey, idempotencyKey: `${kind.jobType}:${kind.periodKey}:${REPORT_NARRATIVE_GENERATION_VERSION}`, maxAttempts: 1 } });
  return { job, result: await worker.runJob({ jobId: job.id, ownerId, jobType: kind.jobType }) };
}

const reservations = prisma => prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } });

// Saved report, locale/model metadata, owner-scoped evidence, owner-only reads, no re-generation or re-charge.
async function verifyReport({ prisma, worker, gateway, ownerId, type, job }) {
  const kind = reportKind(type), seeded = new Set(ALICE.map((_, index) => `${ownerId}-event-${index}`));
  const row = await prisma[kind.table].findFirst({ where: { ownerId, periodKey: kind.periodKey } });
  assert.ok(row, "report saved");
  assert.equal(row.narrativeStatus, "GENERATED"); assert.equal(row.generationVersion, REPORT_NARRATIVE_GENERATION_VERSION);
  const sections = row.narrativeSections;
  assert.ok(Array.isArray(sections) && sections.length > 0);
  for (const section of sections) {
    assert.equal(section.locale, "zh-Hans"); assert.equal(section.model, kind.model);
    for (const ref of section.evidenceRefs) assert.ok(seeded.has(ref.sourceEventId), "cited evidence is a seeded owner Event");
  }
  const evidence = await prisma.aiEvidence.findMany({ where: { [kind.evidenceField]: row.id } });
  assert.ok(evidence.length >= 2);
  assert.ok(evidence.every(item => item.ownerId === ownerId && seeded.has(item.sourceEventId)), "evidence is owner-scoped");
  const repo = new PrivateReportRepository(prisma), calls = gateway.calls, reserved = await reservations(prisma);
  const first = await repo[kind.read]({ identity: { userId: ownerId }, reportId: row.id });
  const second = await repo[kind.read]({ identity: { userId: ownerId }, reportId: row.id });
  assert.equal(first.id, row.id); assert.deepEqual(second.narrativeSections, first.narrativeSections);
  assert.equal(await repo[kind.read]({ identity: { userId: OTHER }, reportId: row.id }), null, "another owner cannot read it");
  assert.equal((await worker.runJob({ jobId: job.id, ownerId, jobType: kind.jobType })).claimed, false, "completed job is not re-run");
  assert.equal(gateway.calls, calls); assert.equal(await reservations(prisma), reserved, "no new charge on reads or re-run");
  return { type, reportId: row.id, model: kind.model, locale: "zh-Hans", sections: sections.length, evidence: evidence.length,
    narrative: sections.map(section => section.claim) };
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString() }) });
const summary = { mode, database: DATABASES[mode], gateway: GATEWAY_ID, checks: [] };
try {
  const [server] = await prisma.$queryRawUnsafe(`SELECT current_database() AS db, inet_server_addr()::text AS addr`);
  if (server.db !== DATABASES[mode]) stop("DATABASE_IDENTITY_MISMATCH");
  const users = await prisma.user.count(), syntheticUsers = await prisma.user.count({ where: { id: { startsWith: "zh-acceptance-" } } });
  if (users !== syntheticUsers) stop("DATABASE_CONTAINS_NON_SYNTHETIC_USERS");
  if (mode !== "live-monthly" && users !== 0) stop("DATABASE_NOT_FRESH");

  const live = mode !== "offline";
  const account = live ? await secret("Cloudflare account ID") : "0".repeat(32);
  const token = live ? await secret("petalpal-integration Gateway token") : "synthetic-offline-gateway-token";
  const key = live ? await secret("PetalPal-Integration Anthropic API key") : "synthetic-offline-provider-key";
  if (!/^[a-f0-9]{32}$/.test(account) || !token || !key) stop("CONFIG_MISSING");
  const env = reportEnv({ account, token, key, live }), gateway = gatewayFetch({ account, live });
  const embeddingProvider = { describeProfile: () => getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
    embedQuery: () => { throw new Error("NO_CHINESE_EMBEDDING"); }, embedDocuments: () => { throw new Error("NO_EMBEDDING"); } };
  const semanticRetrieval = { retrieve: () => { throw new Error("NO_SEMANTIC_RETRIEVAL_FOR_ZH"); } };
  const worker = createProductionAiWorker({ prisma, env, gatewayFetchImpl: gateway.impl, embeddingProvider, semanticRetrieval,
    workerId: "zh-acceptance-runner", retryDelayMs: 0, logger: { error: (message, meta) => console.log(JSON.stringify({ log: message, code: meta?.code })) } });

  if (mode !== "live-monthly") { await seedOwner(prisma, OWNER, ALICE); await seedOwner(prisma, OTHER, BOB); }
  if (mode === "live-monthly") {
    const weekly = await prisma.weeklyReport.findFirst({ where: { ownerId: OWNER, periodKey: WEEK, narrativeStatus: "GENERATED" } });
    if (!weekly?.narrativeSections?.every(section => section.model === SONNET_WEEKLY_MODEL)) stop("WEEKLY_NOT_PASSED");
  }

  for (const type of mode === "offline" ? ["WEEKLY", "MONTHLY"] : [mode === "live-weekly" ? "WEEKLY" : "MONTHLY"]) {
    const before = gateway.calls, { job, result } = await runReport({ prisma, worker, ownerId: OWNER, type });
    const dispatched = gateway.calls - before;
    if (!result.succeeded || result.skipped) {
      summary.checks.push({ type, result: "FAIL", code: result.error?.code || result.result?.status || "UNKNOWN", dispatched });
      throw new Error("REPORT_FAILED");
    }
    assert.equal(dispatched, 1, "exactly one Gateway dispatch");
    summary.checks.push({ result: "PASS", dispatched, ...(await verifyReport({ prisma, worker, gateway, ownerId: OWNER, type, job })) });
  }

  if (mode === "offline") {
    // Denied memory consent: no dispatch and no report.
    await seedOwner(prisma, "zh-acceptance-carol", ALICE, { memoryEnabled: false });
    let before = gateway.calls;
    await runReport({ prisma, worker, ownerId: "zh-acceptance-carol", type: "WEEKLY" });
    assert.equal(gateway.calls, before); assert.equal(await prisma.weeklyReport.count({ where: { ownerId: "zh-acceptance-carol" } }), 0);
    summary.checks.push({ case: "consent-denied", result: "PASS" });
    // Deletion after dispatch, before the response is accepted: the source fence must reject persistence.
    await seedOwner(prisma, "zh-acceptance-dave", ALICE);
    gateway.beforeResponse = async packet => {
      const ids = (await prisma.eventMemory.findMany({ where: { ownerId: "zh-acceptance-dave", eventDate: { gte: new Date(`${WEEK}T00:00:00Z`) } }, take: 1 })).map(row => row.sourceEventId);
      await prisma.eventMemory.deleteMany({ where: { ownerId: "zh-acceptance-dave", sourceEventId: { in: ids } } });
      await prisma.event.deleteMany({ where: { ownerId: "zh-acceptance-dave", id: { in: ids } } });
      assert.ok(packet && ids.length === 1);
    };
    before = gateway.calls;
    const deleted = await runReport({ prisma, worker, ownerId: "zh-acceptance-dave", type: "WEEKLY" });
    gateway.beforeResponse = null;
    assert.equal(gateway.calls - before, 1); assert.equal(deleted.result.succeeded, false);
    assert.equal(await prisma.weeklyReport.count({ where: { ownerId: "zh-acceptance-dave" } }), 0);
    summary.checks.push({ case: "deleted-source-invalidates", result: "PASS", code: deleted.result.error?.code });
    // Cross-owner: the other owner's Events never appear in this owner's evidence (also asserted per report above).
    assert.equal(await prisma.aiEvidence.count({ where: { ownerId: OWNER, sourceEventId: { startsWith: `${OTHER}-` } } }), 0);
    summary.checks.push({ case: "cross-owner-isolation", result: "PASS" });
  }
  summary.result = "PASS";
} catch (error) {
  summary.result = "FAIL";
  summary.failure = error?.code || (error instanceof assert.AssertionError ? `ASSERTION: ${error.message}` : error?.message === "REPORT_FAILED" ? "REPORT_FAILED" : "UNEXPECTED_ERROR");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  console.log(JSON.stringify(summary, null, 2));
}
