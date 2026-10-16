// Owner-run zh-Hans Reflection v2 Weekly acceptance (Claude Sonnet 5.5) through the real ReportInputService,
// worker, cost gate, Gateway client, weekly-reflection-v2 contract and persistence. Weekly only: Monthly/Opus
// stays unconfigured. Synthetic data, fresh disposable local PostgreSQL only.
//   offline      mocked Gateway response, $0, includes fail-closed and negative cases
//   live-weekly  exactly one real Sonnet call through petalpal-integration. NOT authorized by this file: it needs
//                a separate APPROVE-1-ZH-WEEKLY-V2-SONNET-CALL approval naming the exact commit and budget cap.
// Secrets are read from a hidden TTY prompt, never from env, files or arguments, and never printed.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATABASES, MAX_BUDGET_USD, MODEL, QUOTE, costFromUsage, dispatchGuard, gitState, preflight } from "./zh-reflection-v2-weekly-gates.mjs";
import { AI_DISCLOSURE_VERSION } from "../lib/ai-disclosure.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2], live = mode === "live-weekly";
const GATEWAY_ID = live ? "petalpal-integration" : "petalpal-offline";
const WEEK = "2026-09-14", OWNER = "zh-acceptance-alice", OTHER = "zh-acceptance-bob";
const stop = code => { console.log(JSON.stringify({ mode, result: "STOP", code, providerCalls: 0 })); process.exit(2); };

// Fail closed before importing any module that can open a database connection or reach a provider.
const git = live ? gitState(root) : null;
const blocked = preflight({ mode, env: process.env, dotenv: existsSync(path.join(root, ".env")), git });
if (blocked) stop(blocked);
const dbUrl = new URL(process.env.DEV_DATABASE_URL);
const cap = live ? process.env.PETALPAL_ZH_ACCEPTANCE_BUDGET_USD : MAX_BUDGET_USD;

const { PrismaClient } = await import("../generated/prisma/client.ts");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { createProductionAiWorker } = await import("../lib/ai-worker.js");
const { PrivateReportRepository } = await import("../lib/report-foundation.js");
const { REPORT_NARRATIVE_GENERATION_VERSION } = await import("../lib/report-narrative.js");
const { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } = await import("../lib/embedding-profiles.js");
const { SONNET_WEEKLY_MODEL } = await import("../lib/sonnet-weekly.js");
const { REFLECTION_V2 } = await import("../lib/reflection-v2.js");
if (SONNET_WEEKLY_MODEL !== MODEL) stop("MODEL_PIN_MISMATCH");

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

// Weekly v2 only; no AI_MONTHLY_* name is ever set, so the worker builds no Opus service.
// "single" limits admit exactly one Weekly report per fresh database: 2 calls (retrieval + narrative), one
// Weekly action and a USD cap that covers one full reservation but not two.
function reportEnv({ account, token, key, single }) {
  const usd = single ? cap : "5", calls = single ? "2" : "40", actions = single ? "1" : "10";
  return Object.freeze({
    AI_GATEWAY_ENABLED: "true", AI_GATEWAY_ANTHROPIC_ENABLED: "true", AI_REPORT_SUPPORTED_LOCALES: "zh-Hans",
    CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: account, CLOUDFLARE_AI_GATEWAY_ID: GATEWAY_ID, CLOUDFLARE_AI_GATEWAY_TOKEN: token, ANTHROPIC_API_KEY: key,
    AI_WEEKLY_REPORT_PROVIDER: "anthropic", AI_WEEKLY_REPORT_MODEL: MODEL, AI_WEEKLY_REFLECTION_CONTRACT: REFLECTION_V2.WEEKLY,
    AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS: String(QUOTE.maxOutputTokens), AI_WEEKLY_REPORT_TIMEOUT_MS: "20000", AI_ASYNC_EXECUTION_MODE: "manual",
    AI_USER_DAILY_USD_LIMIT: usd, AI_USER_MONTHLY_USD_LIMIT: usd, AI_GLOBAL_DAILY_USD_LIMIT: usd,
    AI_GLOBAL_MONTHLY_USD_LIMIT: usd, AI_ANTHROPIC_MONTHLY_USD_LIMIT: usd,
    AI_USER_DAILY_CALL_LIMIT: calls, AI_GLOBAL_DAILY_CALL_LIMIT: calls, AI_PROVIDER_DAILY_CALL_LIMIT: calls, AI_WEEKLY_REPORT_DAILY_LIMIT: actions
  });
}

// Offline only: deterministic weekly-reflection-v2 output quoting whole cited Events, like test/back/sonnet-weekly.test.js.
// "ungrounded" adds a digit absent from every source, which the v2 validator must reject without any repair call.
function mockOutput(packet, { ungrounded = false } = {}) {
  const sentences = packet.evidence.slice(0, 3).map(item => ({ text: `你写下：“${item.text}”`, refs: [item.ref] }));
  if (ungrounded) sentences[0] = { text: "这周你画了7幅素描。", refs: [packet.evidence[0].ref] };
  return { version: REFLECTION_V2.WEEKLY, locale: packet.locale, paragraphs: [{ sentences }] };
}
function mockSend(state) {
  return async (url, options) => {
    const body = JSON.parse(options.body), packet = JSON.parse(body.messages[0].content);
    assert.equal(body.model, MODEL); assert.equal(body.max_tokens, QUOTE.maxOutputTokens); assert.equal(packet.version, REFLECTION_V2.WEEKLY);
    assert.equal(options.headers["cf-aig-max-attempts"], "1", "no Gateway retries");
    if (state.beforeResponse) await state.beforeResponse(packet);
    return Response.json({ model: body.model, type: "message", role: "assistant", stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(mockOutput(packet, state)) }], usage: { input_tokens: 600, output_tokens: 150 } });
  };
}

async function seedOwner(prisma, ownerId, rows, { memoryEnabled = true } = {}) {
  await prisma.user.create({ data: { id: ownerId, name: `Synthetic ${ownerId}`, preferredLocale: "zh-Hans", timezone: "UTC" } });
  await prisma.aiConsent.create({ data: { userId: ownerId, termsVersion: AI_DISCLOSURE_VERSION, aiProcessing: true,
    personalization: true, memoryEnabled, grantedAt: new Date() } });
  for (const [index, [localDate, summary, topics, importanceScore]] of rows.entries()) {
    const occurredAt = new Date(`${localDate}T12:00:00.000Z`), id = `${ownerId}-event-${index}`;
    await prisma.event.create({ data: { id, ownerId, content: summary, occurredAt, timezone: "UTC", localDate,
      idempotencyKey: `${ownerId}-seed-${index}`, memoryProcessingAllowed: true } });
    await prisma.eventMemory.create({ data: { id: `${ownerId}-memory-${index}`, ownerId, sourceEventId: id, memoryType: "EVENT",
      summary, eventDate: occurredAt, topics, importanceScore } });
  }
}

async function runReport({ prisma, worker, ownerId, jobType = "WEEKLY_REPORT", periodKey = WEEK, maxAttempts = 1 }) {
  const job = await prisma.aiJob.create({ data: { id: `${ownerId}-${jobType}-${periodKey}`, ownerId, jobType,
    resourceId: periodKey, idempotencyKey: `${jobType}:${periodKey}:${REPORT_NARRATIVE_GENERATION_VERSION}`, maxAttempts } });
  return { job, result: await worker.runJob({ jobId: job.id, ownerId, jobType }) };
}

const reservations = prisma => prisma.auditEvent.count({ where: { eventType: "AI_COST_RESERVED" } });
const reportCount = (prisma, ownerId) => prisma.weeklyReport.count({ where: { ownerId } });

// Saved v2 report, locale/model/contract metadata, owner-scoped cited evidence, owner-only reads, finalized reuse.
async function verifyReport({ prisma, worker, gateway, ownerId, job }) {
  const seeded = new Set(ALICE.map((_, index) => `${ownerId}-event-${index}`));
  const row = await prisma.weeklyReport.findFirst({ where: { ownerId, periodKey: WEEK } });
  assert.ok(row, "report saved");
  assert.equal(row.narrativeStatus, "GENERATED"); assert.equal(row.generationVersion, REPORT_NARRATIVE_GENERATION_VERSION);
  const sections = row.narrativeSections;
  assert.ok(Array.isArray(sections) && sections.length > 0);
  for (const section of sections) {
    assert.equal(section.contractVersion, REFLECTION_V2.WEEKLY, "weekly-reflection-v2 contract");
    assert.equal(section.locale, "zh-Hans"); assert.equal(section.model, MODEL);
    assert.ok(section.claims.every(claim => claim.evidenceRefs.length > 0), "every sentence cites evidence");
    for (const ref of section.evidenceRefs) assert.ok(seeded.has(ref.sourceEventId), "cited evidence is a seeded owner Event");
  }
  const evidence = await prisma.aiEvidence.findMany({ where: { weeklyReportId: row.id } });
  assert.ok(evidence.length >= 2);
  assert.ok(evidence.every(item => item.ownerId === ownerId && seeded.has(item.sourceEventId) &&
    ["NARRATIVE_CITED", "NARRATIVE_SELECTED"].includes(item.claimType)), "evidence is owner-scoped");
  // Selected-but-uncited provenance is NARRATIVE_SELECTED; cited rows must equal exactly what the sentences cite.
  const citedRows = new Set(evidence.filter(item => item.claimType === "NARRATIVE_CITED").map(item => item.sourceEventId));
  const citedRefs = new Set(sections.flatMap(section => section.evidenceRefs.map(ref => ref.sourceEventId)));
  assert.ok(citedRows.size >= 2, "Weekly cites at least two Events");
  assert.deepEqual([...citedRows].sort(), [...citedRefs].sort(), "cited evidence rows match sentence citations");
  const repo = new PrivateReportRepository(prisma), calls = gateway.calls, reserved = await reservations(prisma);
  const first = await repo.getWeeklyReportById({ identity: { userId: ownerId }, reportId: row.id });
  const second = await repo.getWeeklyReportById({ identity: { userId: ownerId }, reportId: row.id });
  assert.equal(first.id, row.id); assert.deepEqual(second.narrativeSections, first.narrativeSections);
  assert.equal(await repo.getWeeklyReportById({ identity: { userId: OTHER }, reportId: row.id }), null, "another owner cannot read it");
  assert.equal((await worker.runJob({ jobId: job.id, ownerId, jobType: "WEEKLY_REPORT" })).claimed, false, "completed job is not re-run");
  assert.equal(gateway.calls, calls); assert.equal(await reservations(prisma), reserved, "no new charge on reads or re-run");
  return { reportId: row.id, model: MODEL, contract: REFLECTION_V2.WEEKLY, locale: "zh-Hans", sections: sections.length,
    evidence: evidence.length, narrative: sections.map(section => section.claim) };
}

// Sanitized cost from the production cost ledger: recorded liability (never refunded) and list-rate usage cost.
async function cost(prisma, ownerId) {
  const rows = await prisma.auditEvent.findMany({ where: { actorUserId: ownerId, eventType: { in: ["AI_GATEWAY_USD_RESERVED", "AI_GATEWAY_USAGE"] } } });
  const liability = rows.filter(row => row.eventType === "AI_GATEWAY_USD_RESERVED").reduce((sum, row) => sum + Number(row.reasonCode), 0);
  const usage = rows.filter(row => row.eventType === "AI_GATEWAY_USAGE").map(row => costFromUsage(row.reasonCode));
  return { liabilityNanoUsd: liability, usage };
}

let gateway = null;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString() }) });
const summary = { mode, database: DATABASES[mode], gateway: GATEWAY_ID, model: MODEL, contract: "weekly-reflection-v2",
  budgetCapUsd: cap, reservationUsd: QUOTE.reservedNanoUsd / 1e9, ...(live ? { commit: git.head } : {}), checks: [] };
try {
  const [server] = await prisma.$queryRawUnsafe(`SELECT current_database() AS db`);
  if (server.db !== DATABASES[mode]) throw Object.assign(new Error(), { code: "DATABASE_IDENTITY_MISMATCH" });
  if (await prisma.user.count() !== 0 || await prisma.auditEvent.count() !== 0) throw Object.assign(new Error(), { code: "DATABASE_NOT_FRESH" });

  const account = live ? await secret("Cloudflare account ID") : "0".repeat(32);
  const token = live ? await secret("petalpal-integration Gateway token") : "synthetic-offline-gateway-token";
  const key = live ? await secret("PetalPal-Integration Anthropic API key") : "synthetic-offline-provider-key";
  if (!/^[a-f0-9]{32}$/.test(account) || !token || !key) throw Object.assign(new Error(), { code: "CONFIG_MISSING" });
  const expectedUrl = `https://gateway.ai.cloudflare.com/v1/${account}/${GATEWAY_ID}/anthropic/v1/messages`;
  const mock = { beforeResponse: null, ungrounded: false };
  gateway = dispatchGuard({ expectedUrl, live, ledgerFile: live ? git.ledger : null,
    run: live ? { commit: git.head, budgetCapUsd: cap, model: MODEL, contract: REFLECTION_V2.WEEKLY } : {},
    send: live ? (url, options) => fetch(url, options) : mockSend(mock) });
  const embeddingProvider = { describeProfile: () => getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY),
    embedQuery: () => { throw new Error("NO_CHINESE_EMBEDDING"); }, embedDocuments: () => { throw new Error("NO_EMBEDDING"); } };
  const semanticRetrieval = { retrieve: () => { throw new Error("NO_SEMANTIC_RETRIEVAL_FOR_ZH"); } };
  const logger = { error: (message, meta) => console.log(JSON.stringify({ log: message, code: meta?.code })) };
  const makeWorker = single => {
    const env = reportEnv({ account, token, key, single });
    assert.ok(!Object.keys(env).some(name => name.startsWith("AI_MONTHLY_")), "Monthly/Opus is not configured");
    return createProductionAiWorker({ prisma, env, gatewayFetchImpl: gateway.impl, embeddingProvider, semanticRetrieval,
      workerId: "zh-v2-weekly-acceptance-runner", retryDelayMs: 0, logger });
  };
  // Live and the primary offline report use identical single-report limits.
  const worker = makeWorker(true);

  await seedOwner(prisma, OWNER, ALICE); await seedOwner(prisma, OTHER, BOB);
  const { job, result } = await runReport({ prisma, worker, ownerId: OWNER });
  const dispatched = gateway.calls;
  if (!result.succeeded || result.skipped) {
    summary.checks.push({ type: "WEEKLY", result: "FAIL", code: result.error?.code || result.result?.status || "UNKNOWN", dispatched });
    throw new Error("REPORT_FAILED");
  }
  assert.equal(dispatched, 1, "exactly one Gateway dispatch");
  summary.checks.push({ type: "WEEKLY", result: "PASS", dispatched, ...(await verifyReport({ prisma, worker, gateway, ownerId: OWNER, job })) });
  const spent = await cost(prisma, OWNER);
  assert.ok(spent.liabilityNanoUsd > 0 && spent.liabilityNanoUsd <= QUOTE.reservedNanoUsd, "recorded liability within the reservation and cap");
  summary.cost = { liabilityUsd: spent.liabilityNanoUsd / 1e9, usage: spent.usage.map(item => item && { ...item, usd: item.nanoUsd / 1e9 }) };

  if (!live) {
    // Single-report limits: a second Weekly in the same database is refused before any dispatch.
    const second = await runReport({ prisma, worker, ownerId: OTHER });
    assert.equal(gateway.calls, 1, "second report not dispatched"); assert.equal(second.result.succeeded, false);
    assert.equal(await reportCount(prisma, OTHER), 0);
    summary.checks.push({ case: "single-call-budget-refuses-second-report", result: "PASS", code: second.result.error?.code });
    // Monthly/Opus stays disabled: no Monthly provider, no dispatch, no report, no reservation.
    const reserved = await reservations(prisma);
    const monthly = await runReport({ prisma, worker, ownerId: OWNER, jobType: "MONTHLY_REPORT", periodKey: "2026-09" });
    assert.equal(gateway.calls, 1); assert.equal(monthly.result.succeeded, false);
    assert.equal(await prisma.monthlyReport.count(), 0); assert.equal(await reservations(prisma), reserved);
    summary.checks.push({ case: "monthly-opus-disabled", result: "PASS", code: monthly.result.error?.code });

    // Remaining negative cases use relaxed offline limits so each owner can be admitted.
    const relaxed = makeWorker(false);
    await seedOwner(prisma, "zh-acceptance-carol", ALICE, { memoryEnabled: false });
    let before = gateway.calls;
    await runReport({ prisma, worker: relaxed, ownerId: "zh-acceptance-carol" });
    assert.equal(gateway.calls, before); assert.equal(await reportCount(prisma, "zh-acceptance-carol"), 0);
    summary.checks.push({ case: "consent-denied", result: "PASS" });
    // Deletion after dispatch, before the response is accepted: the source fence must reject persistence.
    await seedOwner(prisma, "zh-acceptance-dave", ALICE);
    mock.beforeResponse = async packet => {
      const ids = (await prisma.eventMemory.findMany({ where: { ownerId: "zh-acceptance-dave",
        eventDate: { gte: new Date(`${WEEK}T00:00:00Z`), lt: new Date("2026-09-21T00:00:00Z") } },
        orderBy: { eventDate: "asc" }, take: 1 })).map(row => row.sourceEventId);
      await prisma.eventMemory.deleteMany({ where: { ownerId: "zh-acceptance-dave", sourceEventId: { in: ids } } });
      await prisma.event.deleteMany({ where: { ownerId: "zh-acceptance-dave", id: { in: ids } } });
      assert.ok(packet && ids.length === 1);
    };
    before = gateway.calls;
    const deleted = await runReport({ prisma, worker: relaxed, ownerId: "zh-acceptance-dave" });
    mock.beforeResponse = null;
    assert.equal(gateway.calls - before, 1); assert.equal(deleted.result.succeeded, false);
    assert.equal(await reportCount(prisma, "zh-acceptance-dave"), 0);
    summary.checks.push({ case: "deleted-source-invalidates", result: "PASS", code: deleted.result.error?.code });
    // Ungrounded output (unsupported digit): rejected, nothing saved, no retry or repair call, re-run cannot re-buy.
    await seedOwner(prisma, "zh-acceptance-erin", ALICE);
    mock.ungrounded = true; before = gateway.calls;
    const ungrounded = await runReport({ prisma, worker: relaxed, ownerId: "zh-acceptance-erin", maxAttempts: 2 });
    assert.equal(gateway.calls - before, 1, "no repair or retry call"); assert.equal(ungrounded.result.succeeded, false);
    assert.equal(await reportCount(prisma, "zh-acceptance-erin"), 0);
    // The job allows a second attempt, so the worker reschedules it (terminal jobs are immutable by DB trigger).
    // The scheduler re-run is blocked by the deterministic cost reservation before any dispatch.
    assert.equal(ungrounded.result.rescheduled, true, "failed attempt rescheduled by the worker");
    const replay = await relaxed.runJob({ jobId: ungrounded.job.id, ownerId: "zh-acceptance-erin", jobType: "WEEKLY_REPORT" });
    mock.ungrounded = false;
    assert.equal(replay.claimed, true); assert.equal(replay.succeeded, false);
    assert.equal(gateway.calls - before, 1, "replay blocked before dispatch"); assert.equal(await reportCount(prisma, "zh-acceptance-erin"), 0);
    summary.checks.push({ case: "ungrounded-output-no-repair-no-replay", result: "PASS", code: ungrounded.result.error?.code, replayCode: replay.error?.code });
    // Cross-owner: the other owner's Events never appear in this owner's evidence (also asserted per report above).
    assert.equal(await prisma.aiEvidence.count({ where: { ownerId: OWNER, sourceEventId: { startsWith: `${OTHER}-` } } }), 0);
    summary.checks.push({ case: "cross-owner-isolation", result: "PASS" });
  }
  summary.result = "PASS";
} catch (error) {
  summary.result = "FAIL";
  // Synthetic-only messages; assertion text names the failed check.
  summary.failure = error instanceof assert.AssertionError ? `ASSERTION: ${String(error.message).split("\n")[0].slice(0, 200)}`
    : error?.code || (error?.message === "REPORT_FAILED" ? "REPORT_FAILED" : `UNEXPECTED_ERROR:${String(error?.name || "Error").slice(0, 40)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  // Paid provider calls are only possible in live mode; offline dispatches all hit the in-process mock.
  summary.providerCalls = live ? gateway?.calls ?? 0 : 0;
  if (!live) summary.mockDispatches = gateway?.calls ?? 0;
  if (gateway?.ledger) {
    gateway.ledger.write({ entry: "summary", result: summary.result, failure: summary.failure, liabilityUsd: summary.cost?.liabilityUsd, productionEligible: false });
    gateway.ledger.close();
  }
  console.log(JSON.stringify(summary, null, 2));
}
