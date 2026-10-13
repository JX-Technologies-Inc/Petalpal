// T01/T02 route boundary for the TEST-only simulated clock. In-memory Prisma stubs;
// no database, Firebase, provider or network access.
import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { AI_JOB_TYPES } from "../../lib/ai-jobs.js";
import { SIMULATED_TIME_HEADER } from "../../lib/simulated-time.js";
import { app, setWeeklyReportWorkerFactoryForTests } from "../../server.js";

const GATE_ENV = {
  PETALPAL_SIMULATED_TIME: "1",
  FIREBASE_PROJECT_ID: "petalpal-ai-e2e-test",
  PETALPAL_SIMULATED_TIME_EMAILS: "alice@example.test"
};
const consent = { termsVersion: "2026-08-25", aiProcessing: true, personalization: true, memoryEnabled: true };

function memoryState() {
  const events = [];
  const jobs = [];
  const users = {
    alice: { id: "alice", timezone: "America/Vancouver", aiConsent: consent },
    bob: { id: "bob", timezone: "America/Vancouver", aiConsent: consent }
  };
  const findJob = ({ where }) => jobs.find((job) => job.ownerId === where.ownerId_idempotencyKey.ownerId &&
    job.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null;
  const tx = {
    $queryRawUnsafe: async (_query, ownerId) => (users[ownerId] ? [{ userId: ownerId, ...users[ownerId].aiConsent }] : []),
    user: { findUnique: async ({ where }) => users[where.id] || null },
    event: {
      findUnique: async ({ where }) => events.find((event) => event.ownerId === where.ownerId_idempotencyKey.ownerId &&
        event.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }) => {
        const event = { id: `event-${events.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        events.push(event);
        return event;
      }
    },
    aiJob: {
      findUnique: async (args) => findJob(args),
      create: async ({ data }) => {
        const job = { id: `job-${jobs.length + 1}`, status: "PENDING", attemptCount: 0, createdAt: new Date(), nextAttemptAt: new Date(), ...data };
        jobs.push(job);
        return job;
      },
      createMany: async ({ data }) => {
        for (const item of data) if (!findJob({ where: { ownerId_idempotencyKey: item } })) await tx.aiJob.create({ data: item });
        return { count: data.length };
      }
    }
  };
  return { events, jobs, users, tx };
}

async function request(baseUrl, path, { token = "alice-token", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function setEnv(values) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => setEnv(previous);
}

test("simulated Event time and report asOf are rejected unless the isolated server gate passes", async (t) => {
  const state = memoryState();
  const originals = { user: prisma.user.findUnique, transaction: prisma.$transaction, jobFindFirst: prisma.aiJob.findFirst,
    weeklyFindUnique: prisma.weeklyReport.findUnique };
  const factoryOptions = [];
  prisma.user.findUnique = async ({ where }) => (where.firebaseUid ? { id: where.firebaseUid.replace("firebase-", "") } : state.users[where.id] || null);
  prisma.$transaction = async (callback) => callback(state.tx);
  prisma.aiJob.findFirst = async ({ where }) => state.jobs.find((job) => job.id === where.id && job.ownerId === where.ownerId) || null;
  prisma.weeklyReport.findUnique = async () => null;
  setFirebaseTokenVerifierForTests(async (token) => {
    const name = token.replace("-token", "");
    return { uid: `firebase-${name}`, email: `${name}@example.test`, email_verified: true };
  });
  setWeeklyReportWorkerFactoryForTests((options = {}) => {
    factoryOptions.push(options);
    return { async runJob({ jobId }) {
      const job = state.jobs.find((candidate) => candidate.id === jobId);
      job.status = "SUCCEEDED";
      job.attemptCount += 1;
      return { claimed: true, succeeded: true };
    } };
  });
  const restoreGate = setEnv({ PETALPAL_SIMULATED_TIME: undefined, PETALPAL_SIMULATED_TIME_EMAILS: undefined,
    AI_ASYNC_EXECUTION_MODE: "manual", PETALPAL_ENVIRONMENT: undefined });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originals.user;
    prisma.$transaction = originals.transaction;
    prisma.aiJob.findFirst = originals.jobFindFirst;
    prisma.weeklyReport.findUnique = originals.weeklyFindUnique;
    setFirebaseTokenVerifierForTests();
    setWeeklyReportWorkerFactoryForTests();
    restoreGate();
    await new Promise((resolve) => server.close(resolve));
  });
  const event = (key, headers = {}, body = {}) => request(baseUrl, "/events", {
    headers: { "Idempotency-Key": key, ...headers }, body: { content: "Synthetic route Event", ...body } });
  const trigger = (headers = {}, body = { localDate: "2026-10-08" }, token) => request(baseUrl, "/ai/reports/weekly/trigger", { token, headers, body });

  // Default (and production) configuration: header alone is refused before any write.
  assert.equal((await event("route-sim-0001", { [SIMULATED_TIME_HEADER]: "2026-10-08" })).status, 403);
  assert.equal((await trigger({ [SIMULATED_TIME_HEADER]: "2026-10-12T19:00:00Z" })).status, 403);
  assert.equal(state.events.length, 0);
  assert.equal(state.jobs.length, 0);

  const restoreEnabled = setEnv(GATE_ENV);
  try {
    const midday = await event("route-sim-0002", { [SIMULATED_TIME_HEADER]: "2026-10-08" });
    assert.equal(midday.status, 201);
    assert.equal(midday.body.event.ownerId, "alice");
    assert.equal(new Date(midday.body.event.occurredAt).toISOString(), "2026-10-08T19:00:00.000Z");
    assert.equal(midday.body.event.localDate, "2026-10-08");
    const boundary = await event("route-sim-0003", { [SIMULATED_TIME_HEADER]: "2026-10-12T06:45:00.000Z" });
    assert.equal(boundary.status, 201);
    assert.equal(boundary.body.event.localDate, "2026-10-11");
    const eventsAfterAllowed = state.events.length;

    assert.equal((await event("route-sim-0004", { [SIMULATED_TIME_HEADER]: "2026-10-08" }, { occurredAt: "2026-10-08T00:00:00Z" })).status, 400);
    assert.equal((await event("route-sim-0005", { [SIMULATED_TIME_HEADER]: "2026-02-30" })).status, 400);
    assert.equal((await request(baseUrl, "/events", { token: "bob-token", headers: { "Idempotency-Key": "route-sim-0006", [SIMULATED_TIME_HEADER]: "2026-10-08" },
      body: { content: "Not allowlisted" } })).status, 403);
    for (const hosted of [{ PETALPAL_ENVIRONMENT: "integration" }, { FIREBASE_PROJECT_ID: "petalpal-b212c" }, { AI_ASYNC_EXECUTION_MODE: "shadow" }]) {
      const restore = setEnv(hosted);
      try {
        assert.equal((await event(`route-sim-h-${Object.keys(hosted)[0]}`, { [SIMULATED_TIME_HEADER]: "2026-10-08" })).status, 403);
      } finally {
        restore();
      }
    }
    assert.equal(state.events.length, eventsAfterAllowed, "denied requests write nothing");
    assert.equal(state.jobs.filter((job) => job.jobType === AI_JOB_TYPES.WEEKLY_REPORT).length, 0);

    // Period closure is still enforced, against the simulated clock.
    const open = await trigger({ [SIMULATED_TIME_HEADER]: "2026-10-11T19:00:00Z" });
    assert.equal(open.status, 400);
    assert.equal(state.jobs.filter((job) => job.jobType === AI_JOB_TYPES.WEEKLY_REPORT).length, 0);
    const closed = await trigger({ [SIMULATED_TIME_HEADER]: "2026-10-12T19:00:00Z" });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.periodKey, "2026-10-05");
    assert.equal(factoryOptions.at(-1).reportAsOf.toISOString(), "2026-10-12T19:00:00.000Z");
    // Default period derives from the simulated "now": previous closed week.
    const defaulted = await trigger({ [SIMULATED_TIME_HEADER]: "2026-10-21T19:00:00Z" }, {});
    assert.equal(defaulted.status, 200);
    assert.equal(defaulted.body.periodKey, "2026-10-12");
    assert.equal((await trigger({ [SIMULATED_TIME_HEADER]: "2026-10-12T19:00:00Z" }, { localDate: "2026-10-08" }, "bob-token")).status, 403);
  } finally {
    restoreEnabled();
  }
  // Without the header, the production path never receives an injected clock.
  const real = await trigger({}, { localDate: "2026-09-08" });
  assert.equal(real.status, 200);
  assert.equal(factoryOptions.at(-1).reportAsOf, undefined);
});
