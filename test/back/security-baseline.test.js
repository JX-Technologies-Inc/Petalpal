import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { logServerError } from "../../lib/security-log.js";
import { app } from "../../server.js";

async function request(baseUrl, path, { token, method = "GET", body, rawBody } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((body !== undefined || rawBody !== undefined) ? { "Content-Type": "application/json" } : {})
    },
    ...((body !== undefined || rawBody !== undefined)
      ? { body: rawBody ?? JSON.stringify(body) }
      : {})
  });
  return { status: response.status, body: await response.json() };
}

test("Month 1 HTTP security boundary protects private resources and rejects unsafe input", async (t) => {
  const originals = {
    userFindUnique: prisma.user.findUnique,
    transaction: prisma.$transaction
  };
  prisma.user.findUnique = async ({ where }) => {
    if (where.firebaseUid) {
      return { id: where.firebaseUid === "firebase-owner" ? "owner-1" : "other-1" };
    }
    if (where.id === "owner-1") {
      return {
        id: "owner-1",
        timezone: "UTC",
        aiConsent: { aiProcessing: true },
        fairyState: { onboardingStep: "MOOD_SELECTION", onboardingCompleted: false }
      };
    }
    return null;
  };
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "owner-token" ? "firebase-owner" : "firebase-other",
    email_verified: true
  }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.$transaction = originals.transaction;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  const unauthenticated = await request(baseUrl, "/session");
  assert.deepEqual(unauthenticated, {
    status: 401,
    body: { error: "Authentication required" }
  });

  const crossUserJournalRead = await request(baseUrl, "/users/owner-1/check-ins", {
    token: "other-token"
  });
  assert.equal(crossUserJournalRead.status, 403);

  const oversizedJournal = await request(baseUrl, "/users/owner-1/flowers", {
    token: "owner-token",
    method: "POST",
    body: { mood: "SUNNY_BLOOM", event: "x".repeat(2001) }
  });
  assert.deepEqual(oversizedJournal, {
    status: 413,
    body: { error: "Journal must be 2000 characters or fewer" }
  });

  const malformed = await request(baseUrl, "/users/owner-1/flowers", {
    token: "owner-token",
    method: "POST",
    rawBody: "{"
  });
  assert.deepEqual(malformed, {
    status: 400,
    body: { error: "Invalid JSON body" }
  });

  const complexBody = await request(baseUrl, "/users/owner-1/flowers", {
    token: "owner-token",
    method: "POST",
    body: Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`field${index}`, true]))
  });
  assert.deepEqual(complexBody, {
    status: 413,
    body: { error: "JSON body is too complex" }
  });

  prisma.$transaction = async () => {
    throw new Error("SQL password=secret at /private/internal/path stack trace");
  };
  const internalFailure = await request(baseUrl, "/users/owner-1", {
    token: "owner-token",
    method: "DELETE"
  });
  assert.deepEqual(internalFailure, {
    status: 500,
    body: { error: "Failed to delete user" }
  });
  assert.doesNotMatch(JSON.stringify(internalFailure.body), /SQL|password|secret|private|stack/i);
});

test("safe server logging excludes exception messages, stacks, tokens and journal text", () => {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    const error = new Error("Bearer private-jwt journal=very-private SQL password=secret");
    error.stack = "/private/server/path";
    error.code = "P2002";
    logServerError("safe context", error, { latencyMs: 12 });
  } finally {
    console.error = original;
  }
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /safe context|P2002|latencyMs/);
  assert.doesNotMatch(serialized, /private-jwt|very-private|password=|server\/path/);
});
