import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { app } from "../../server.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { apiDocsEnabled } from "../../lib/security-config.js";

test("production API docs are fail-closed and development docs remain enabled", () => {
  assert.equal(apiDocsEnabled({ NODE_ENV: "production" }), false);
  assert.equal(apiDocsEnabled({ NODE_ENV: "production", API_DOCS_ENABLED: "true" }), true);
  assert.equal(apiDocsEnabled({ NODE_ENV: "development" }), true);
});

test("owner-only matrix rejects forged path identity and ignores server-controlled mutation fields", async (t) => {
  const originals = {
    findUnique: prisma.user.findUnique,
    update: prisma.user.update,
    transaction: prisma.$transaction,
    aiUpsert: prisma.aiConsent.upsert,
    fairyFind: prisma.fairyState.findUnique,
    fairyUpsert: prisma.fairyState.upsert
  };
  const calls = [];
  prisma.user.findUnique = async ({ where }) =>
    where.firebaseUid ? { id: where.firebaseUid === "a-firebase" ? "user-a" : "user-b" } : null;
  prisma.user.update = async ({ where, data }) => {
    calls.push({ kind: "user", where, data });
    return { id: "user-a", accountId: "a", name: "A", email: "a@example.com", avatar: null, timezone: "UTC", preferredLocale: data.preferredLocale };
  };
  prisma.aiConsent.upsert = async ({ where, update, create }) => {
    calls.push({ kind: "consent", where, update, create });
    return { userId: "user-a", ...update };
  };
  prisma.$transaction = async (callback) => callback({
    aiConsent: { upsert: prisma.aiConsent.upsert },
    aiJob: { updateMany: async () => ({ count: 0 }) }
  });
  prisma.fairyState.findUnique = async () => ({ userId: "user-a", onboardingCompleted: false, onboardingStep: "EMPTY_GARDEN", unlockedFeatures: [] });
  prisma.fairyState.upsert = async ({ where, update, create }) => {
    calls.push({ kind: "fairy", where, update, create });
    return { userId: "user-a", onboardingCompleted: false, onboardingStep: "MOOD_SELECTION", unlockedFeatures: [], ...update };
  };
  setFirebaseTokenVerifierForTests(async (token) => ({ uid: token === "a-token" ? "a-firebase" : "b-firebase", email_verified: true }));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    prisma.user.findUnique = originals.findUnique;
    prisma.user.update = originals.update;
    prisma.$transaction = originals.transaction;
    prisma.aiConsent.upsert = originals.aiUpsert;
    prisma.fairyState.findUnique = originals.fairyFind;
    prisma.fairyState.upsert = originals.fairyUpsert;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  const headers = { Authorization: "Bearer a-token", "Content-Type": "application/json" };
  let response = await fetch(`${base}/users/user-b/profile`, { method: "PUT", headers, body: JSON.stringify({ preferredLocale: "en-CA", userId: "user-b", ownerId: "user-b", role: "admin", isAdmin: true, premium: true }) });
  assert.equal(response.status, 403);
  response = await fetch(`${base}/users/user-a/profile`, { method: "PUT", headers, body: JSON.stringify({ preferredLocale: "en-CA", userId: "user-b", ownerId: "user-b", role: "admin", isAdmin: true, vip: true, premium: true, owner: "user-b", admin: true }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((c) => c.kind === "user").data, { preferredLocale: "en-CA" });

  response = await fetch(`${base}/users/user-b/ai-consent`, { method: "PUT", headers, body: JSON.stringify({ aiProcessing: true, personalization: true, memoryEnabled: true, userId: "user-b", ownerId: "user-b", role: "admin", premium: true }) });
  assert.equal(response.status, 403);
  response = await fetch(`${base}/users/user-a/ai-consent`, { method: "PUT", headers, body: JSON.stringify({ aiProcessing: true, personalization: true, memoryEnabled: true, userId: "user-b", ownerId: "user-b", role: "admin", premium: true }) });
  assert.equal(response.status, 200);
  const consent = calls.find((c) => c.kind === "consent");
  assert.equal(Object.hasOwn(consent.update, "userId"), false);
  assert.equal(Object.hasOwn(consent.update, "ownerId"), false);

  response = await fetch(`${base}/users/user-b/fairy-state`, { method: "PUT", headers, body: JSON.stringify({ onboardingStep: "MOOD_SELECTION", unlockedFeatures: [], userId: "user-b", ownerId: "user-b", role: "admin", vip: true }) });
  assert.equal(response.status, 403);
  response = await fetch(`${base}/users/user-a/fairy-state`, { method: "PUT", headers, body: JSON.stringify({ onboardingStep: "MOOD_SELECTION", unlockedFeatures: [], userId: "user-b", ownerId: "user-b", role: "admin", vip: true }) });
  assert.equal(response.status, 200);
  const fairy = calls.find((c) => c.kind === "fairy");
  assert.equal(Object.hasOwn(fairy.update, "userId"), false);
  assert.equal(Object.hasOwn(fairy.update, "ownerId"), false);
});
