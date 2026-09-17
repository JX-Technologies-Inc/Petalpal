import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app } from "../../server.js";

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
      Authorization: `Bearer ${token}`,
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
    eventFindFirst: prisma.event.findFirst,
    memoryFindFirst: prisma.eventMemory.findFirst,
    weeklyFindFirst: prisma.weeklyReport.findFirst,
    transaction: prisma.$transaction
  };
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
    prisma.event.findFirst = originals.eventFindFirst;
    prisma.eventMemory.findFirst = originals.memoryFindFirst;
    prisma.weeklyReport.findFirst = originals.weeklyFindFirst;
    prisma.$transaction = originals.transaction;
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
});
