import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { AI_JOB_TYPES } from "../../lib/ai-jobs.js";
import { app, setWeeklyReportWorkerFactoryForTests } from "../../server.js";

function fixture() {
  const events = [];
  const jobs = [];
  const users = {
    alice: {
      id: "alice",
      timezone: "America/Vancouver",
      aiConsent: { termsVersion: "2026-09", aiProcessing: true, personalization: true, memoryEnabled: true }
    },
    bob: {
      id: "bob",
      timezone: "UTC",
      aiConsent: { termsVersion: "2026-09", aiProcessing: false, personalization: false, memoryEnabled: false }
    }
  };
  const tx = {
    user: { findUnique: async ({ where }) => users[where.id] || null },
    event: {
      findUnique: async ({ where }) => events.find((event) =>
        event.ownerId === where.ownerId_idempotencyKey.ownerId &&
        event.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }) => {
        const event = { id: `event-${events.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        events.push(event);
        return event;
      }
    },
    aiJob: {
      findUnique: async ({ where }) => jobs.find((job) =>
        job.ownerId === where.ownerId_idempotencyKey.ownerId &&
        job.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }) => {
        const job = { id: `job-${jobs.length + 1}`, status: "PENDING", ...data };
        jobs.push(job);
        return job;
      }
    }
  };
  return { events, jobs, users, tx };
}

async function request(baseUrl, path, { token = "alice-token", method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

test("authenticated Event API derives ownership and keeps Event, Memory and Report reads private", async (t) => {
  const state = fixture();
  const originals = {
    userFindUnique: prisma.user.findUnique,
    aiJobFindUnique: prisma.aiJob.findUnique,
    aiJobFindFirst: prisma.aiJob.findFirst,
    aiJobCreate: prisma.aiJob.create,
    eventFindFirst: prisma.event.findFirst,
    memoryFindFirst: prisma.eventMemory.findFirst,
    weeklyFindFirst: prisma.weeklyReport.findFirst,
    weeklyFindUnique: prisma.weeklyReport.findUnique,
    transaction: prisma.$transaction
  };
  const finalizedReports = new Map();
  const workerCalls = [];
  prisma.user.findUnique = async ({ where }) => {
    if (where.firebaseUid) return { id: where.firebaseUid === "firebase-alice" ? "alice" : "bob" };
    return state.users[where.id] || null;
  };
  prisma.event.findFirst = async ({ where }) => state.events.find((event) => event.id === where.id && event.ownerId === where.ownerId) || null;
  prisma.eventMemory.findFirst = async ({ where }) => where.id === "memory-alice" && where.ownerId === "alice"
    ? { id: "memory-alice", ownerId: "alice", sourceEventId: "event-1" }
    : null;
  prisma.weeklyReport.findFirst = async ({ where }) => where.id === "report-alice" && where.ownerId === "alice"
    ? { id: "report-alice", ownerId: "alice", evidence: [] }
    : null;
  prisma.weeklyReport.findUnique = async ({ where }) => {
    const key = where.ownerId_periodKey;
    return key ? finalizedReports.get(`${key.ownerId}:${key.periodKey}`) || null : null;
  };
  prisma.aiJob.findUnique = async ({ where }) => {
    const key = where.ownerId_idempotencyKey;
    return key ? state.jobs.find((job) => job.ownerId === key.ownerId && job.idempotencyKey === key.idempotencyKey) || null : null;
  };
  prisma.aiJob.create = async ({ data }) => {
    const job = { id: `job-${state.jobs.length + 1}`, status: "PENDING", attemptCount: 0, completedAt: null, ...data };
    state.jobs.push(job);
    return job;
  };
  prisma.aiJob.findFirst = async ({ where }) => state.jobs.find((job) =>
    job.id === where.id && job.ownerId === where.ownerId && job.jobType === where.jobType) || null;
  setWeeklyReportWorkerFactoryForTests(() => ({
    async runJob(input) {
      workerCalls.push(input);
      const job = state.jobs.find((candidate) =>
        candidate.id === input.jobId &&
        candidate.ownerId === input.ownerId &&
        candidate.jobType === input.jobType);
      if (!job || job.status === "SUCCEEDED") return { claimed: false };
      const reportKey = `${input.ownerId}:${job.resourceId}`;
      const existing = finalizedReports.get(reportKey);
      job.status = "SUCCEEDED";
      job.attemptCount += 1;
      job.completedAt = new Date();
      if (existing) return { claimed: true, succeeded: true, result: { skipped: true, report: existing } };
      const report = {
        id: `weekly-${finalizedReports.size + 1}`,
        ownerId: input.ownerId,
        periodKey: job.resourceId,
        narrativeStatus: "GENERATED",
        generationVersion: "grounded-narrative-v1",
        summary: "Grounded owner report"
      };
      finalizedReports.set(reportKey, report);
      return { claimed: true, succeeded: true, result: { skipped: false, report } };
    }
  }));
  prisma.$transaction = async (callback) => callback(state.tx);
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "alice-token" ? "firebase-alice" : "firebase-bob",
    email_verified: true
  }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.aiJob.findUnique = originals.aiJobFindUnique;
    prisma.aiJob.findFirst = originals.aiJobFindFirst;
    prisma.aiJob.create = originals.aiJobCreate;
    prisma.event.findFirst = originals.eventFindFirst;
    prisma.eventMemory.findFirst = originals.memoryFindFirst;
    prisma.weeklyReport.findFirst = originals.weeklyFindFirst;
    prisma.weeklyReport.findUnique = originals.weeklyFindUnique;
    prisma.$transaction = originals.transaction;
    setWeeklyReportWorkerFactoryForTests();
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  const forged = await request(baseUrl, "/events", {
    method: "POST",
    headers: { "Idempotency-Key": "mobile-forged-1" },
    body: { ownerId: "bob", content: "forged" }
  });
  assert.equal(forged.status, 400);
  assert.equal(state.events.length, 0);

  const created = await request(baseUrl, "/events", {
    method: "POST",
    headers: { "Idempotency-Key": "mobile-event-1" },
    body: { content: "Late Vancouver Event", occurredAt: "2026-09-15T06:30:00.000Z" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.event.ownerId, "alice");
  assert.equal(created.body.event.localDate, "2026-09-14");
  assert.equal(created.body.memoryJob.status, "PENDING");
  assert.equal(state.events.length, 1);
  assert.equal(state.jobs.length, 1);

  const noConsent = await request(baseUrl, "/events", {
    token: "bob-token",
    method: "POST",
    headers: { "Idempotency-Key": "mobile-event-bob-1" },
    body: { content: "Stored without memory processing" }
  });
  assert.equal(noConsent.status, 201);
  assert.equal(noConsent.body.event.ownerId, "bob");
  assert.equal(noConsent.body.event.memoryProcessingAllowed, false);
  assert.equal(noConsent.body.memoryJob, null);
  assert.equal(state.jobs.length, 1);

  const retried = await request(baseUrl, "/events", {
    method: "POST",
    headers: { "Idempotency-Key": "mobile-event-1" },
    body: { content: "Late Vancouver Event" }
  });
  assert.equal(retried.status, 200);
  assert.equal(state.events.length, 2);
  assert.equal(state.jobs.length, 1);

  assert.equal((await request(baseUrl, "/events/event-1", { token: "bob-token" })).status, 404);
  assert.equal((await request(baseUrl, "/events/event-1")).status, 200);
  assert.equal((await request(baseUrl, "/ai/memories/memory-alice", { token: "bob-token" })).status, 404);
  assert.equal((await request(baseUrl, "/ai/memories/memory-alice")).status, 200);
  assert.equal((await request(baseUrl, "/ai/reports/weekly/report-alice", { token: "bob-token" })).status, 404);
  assert.equal((await request(baseUrl, "/ai/reports/weekly/report-alice")).status, 200);

  const unauthenticated = await request(baseUrl, "/ai/reports/weekly/trigger", {
    token: null,
    method: "POST",
    body: { localDate: "2026-09-08" }
  });
  assert.equal(unauthenticated.status, 401);

  const jobsBeforeTrigger = state.jobs.length;
  const forgedOwner = await request(baseUrl, "/ai/reports/weekly/trigger", {
    method: "POST",
    body: { localDate: "2026-09-08", ownerId: "bob" }
  });
  assert.equal(forgedOwner.status, 400);
  assert.equal(state.jobs.length, jobsBeforeTrigger);

  const arbitraryJob = await request(baseUrl, "/ai/reports/weekly/trigger", {
    method: "POST",
    body: { localDate: "2026-09-08", jobType: AI_JOB_TYPES.MONTHLY_REPORT }
  });
  assert.equal(arbitraryJob.status, 400);
  assert.equal(workerCalls.length, 0);

  const triggered = await request(baseUrl, "/ai/reports/weekly/trigger", {
    method: "POST",
    body: { localDate: "2026-09-08" }
  });
  assert.equal(triggered.status, 200);
  assert.equal(triggered.body.periodKey, "2026-09-07");
  assert.equal(triggered.body.job.status, "SUCCEEDED");
  assert.equal(triggered.body.report.narrativeStatus, "GENERATED");
  assert.deepEqual(
    { ownerId: workerCalls[0].ownerId, jobType: workerCalls[0].jobType },
    { ownerId: "alice", jobType: AI_JOB_TYPES.WEEKLY_REPORT }
  );
  assert.equal(state.jobs.length, jobsBeforeTrigger + 1);

  const duplicate = await request(baseUrl, "/ai/reports/weekly/trigger", {
    method: "POST",
    body: { localDate: "2026-09-08" }
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.job.id, triggered.body.job.id);
  assert.equal(state.jobs.length, jobsBeforeTrigger + 1);
  assert.equal(finalizedReports.size, 1);

  const protectedReport = {
    id: "weekly-finalized",
    ownerId: "alice",
    periodKey: "2026-08-31",
    narrativeStatus: "GENERATED",
    generationVersion: "grounded-narrative-v2",
    summary: "Trusted finalized report"
  };
  finalizedReports.set("alice:2026-08-31", protectedReport);
  const finalizedReplay = await request(baseUrl, "/ai/reports/weekly/trigger", {
    method: "POST",
    body: { localDate: "2026-09-01" }
  });
  assert.equal(finalizedReplay.status, 200);
  assert.equal(finalizedReplay.body.report.id, "weekly-finalized");
  assert.equal(finalizedReports.get("alice:2026-08-31").summary, "Trusted finalized report");
  assert.equal(finalizedReports.get("alice:2026-08-31").generationVersion, "grounded-narrative-v2");
});
