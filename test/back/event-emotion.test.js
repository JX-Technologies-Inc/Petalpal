import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { classifyEventEmotion, emotionClassifierEnabled } from "../../lib/event-emotion.js";
import { DeterministicMemoryExtractor, PrismaMemoryRepository } from "../../lib/event-memory.js";
import { app, setEventEmotionClassifierForTests } from "../../server.js";

const labels = ["admiration", "amusement", "anger", "annoyance", "caring", "confusion", "curiosity", "disappointment", "disgust", "excitement", "fear", "gratitude", "joy", "love", "optimism", "remorse", "sadness", "surprise"];

test("frozen adapter uses canonical Product-18 selector and bounded fallback", async () => {
  const probabilities = Object.fromEntries(labels.map((label) => [label, 0.01]));
  probabilities.joy = 0.95;
  probabilities.gratitude = 0.9;
  probabilities.love = 0.85;
  const enabled = { EMOTION_CLASSIFIER_ENABLED: "true", NODE_ENV: "test", AI_REQUEST_TIMEOUT_MS: "10" };
  const success = await classifyEventEmotion({ userId: "alice", text: "my event", primaryGardenMood: "SUNNY_BLOOM", env: enabled, infer: async () => probabilities });
  assert.equal(success.status, "SUCCESS");
  assert.deepEqual(success.labels, ["gratitude"]); // Joy is Primary redundant; love shares gratitude's cluster.
  const off = await classifyEventEmotion({ userId: "alice", text: "my event", env: {}, infer: () => { throw new Error("should not run"); } });
  assert.equal(off.status, "SKIPPED");
  assert.deepEqual(off.labels, []);
  const timedOut = await classifyEventEmotion({ userId: "alice", text: "my event", env: enabled, infer: () => new Promise(() => {}) });
  assert.equal(timedOut.fallbackReason, "TIMEOUT");
  const exception = await classifyEventEmotion({ userId: "alice", text: "my event", env: enabled, infer: () => { throw new Error("unavailable"); } });
  assert.equal(exception.fallbackReason, "RUNTIME_UNAVAILABLE");
  const invalid = await classifyEventEmotion({ userId: "alice", text: "my event", env: enabled, infer: async () => ({ ...probabilities, fake: 0.9 }) });
  assert.equal(invalid.fallbackReason, "INVALID_MODEL_OUTPUT");
  assert.deepEqual(invalid.labels, []);
  assert.equal(emotionClassifierEnabled({ EMOTION_CLASSIFIER_ENABLED: "true", NODE_ENV: "production" }), false);
  assert.equal(emotionClassifierEnabled({ EMOTION_CLASSIFIER_ENABLED: "true", NODE_ENV: "staging" }), false);
  const blocked = await classifyEventEmotion({ userId: "alice", text: "my event", env: { EMOTION_CLASSIFIER_ENABLED: "true", NODE_ENV: "production" }, infer: () => { throw new Error("must not run"); } });
  assert.equal(blocked.status, "SKIPPED");
  assert.equal(blocked.fallbackReason, "RESEARCH_ONLY_CONTEXT");
});

test("Event save and dev preview share adapter, preserve ownership, and never duplicate Flower", async (t) => {
  const originalEnv = { flag: process.env.EMOTION_CLASSIFIER_ENABLED, mode: process.env.NODE_ENV, testEmail: process.env.AUTH_E2E_TEST_EMAIL };
  const original = {
    transaction: prisma.$transaction, userFind: prisma.user.findUnique,
    eventFind: prisma.event.findFirst, eventUpdate: prisma.event.update,
    gardenFind: prisma.garden.findUnique, gardenCreate: prisma.garden.create,
    flowerFindMany: prisma.flower.findMany, flowerFindUnique: prisma.flower.findUnique,
    flowerUpsert: prisma.flower.upsert, memoryUpdate: prisma.eventMemory.updateMany
  };
  const events = [];
  const flowers = [];
  let calls = 0;
  let responseLabels = ["gratitude"];
  let responseProbabilities = { gratitude: 0.9 };
  let failNextPersistence = false;
  const users = {
    alice: { id: "alice", timezone: "UTC", aiConsent: { aiProcessing: false, personalization: false, memoryEnabled: false } },
    bob: { id: "bob", timezone: "UTC", aiConsent: { aiProcessing: false, personalization: false, memoryEnabled: false } }
  };
  prisma.user.findUnique = async ({ where }) => where.firebaseUid
    ? users[where.firebaseUid === "firebase-alice" ? "alice" : "bob"] : users[where.id] || null;
  prisma.$transaction = async (callback) => callback({
    user: { findUnique: async ({ where }) => users[where.id] || null },
    aiJob: { findUnique: async () => null },
    event: {
      findUnique: async ({ where }) => events.find((event) => event.ownerId === where.ownerId_idempotencyKey.ownerId && event.idempotencyKey === where.ownerId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }) => { const event = { id: `event-${events.length + 1}`, ...data }; events.push(event); return event; }
    }
  });
  prisma.event.findFirst = async ({ where }) => events.find((event) => event.id === where.id && event.ownerId === where.ownerId) || null;
  prisma.event.update = async ({ where, data }) => {
    if (failNextPersistence) { failNextPersistence = false; throw new Error("write failed"); }
    return Object.assign(events.find((event) => event.id === where.id && event.ownerId === where.ownerId), data);
  };
  prisma.garden.findUnique = async () => ({ id: "garden-alice" });
  prisma.garden.create = async () => { throw new Error("unexpected garden creation"); };
  prisma.flower.findMany = async () => [];
  prisma.flower.findUnique = async ({ where }) => flowers.find((flower) => flower.sourceEventId === where.sourceEventId) || null;
  prisma.flower.upsert = async ({ where, create }) => {
    const existing = flowers.find((flower) => flower.sourceEventId === where.sourceEventId);
    if (existing) return existing;
    const flower = { id: `flower-${flowers.length + 1}`, ...create };
    flowers.push(flower);
    return flower;
  };
  prisma.eventMemory.updateMany = async () => ({ count: 0 });
  setFirebaseTokenVerifierForTests(async (token) => ({ uid: token === "alice-token" ? "firebase-alice" : "firebase-bob", email: token === "alice-token" ? "alice-e2e@example.com" : "bob@example.com", email_verified: true }));
  setEventEmotionClassifierForTests(async () => { calls += 1; return { status: "SUCCESS", labels: responseLabels, probabilities: responseProbabilities, latencyMs: 2 }; });
  process.env.NODE_ENV = "test";
  process.env.AUTH_E2E_TEST_EMAIL = "alice-e2e@example.com";
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    process.env.EMOTION_CLASSIFIER_ENABLED = originalEnv.flag;
    process.env.NODE_ENV = originalEnv.mode;
    if (originalEnv.testEmail === undefined) delete process.env.AUTH_E2E_TEST_EMAIL;
    else process.env.AUTH_E2E_TEST_EMAIL = originalEnv.testEmail;
    prisma.$transaction = original.transaction;
    prisma.user.findUnique = original.userFind;
    prisma.event.findFirst = original.eventFind;
    prisma.event.update = original.eventUpdate;
    prisma.garden.findUnique = original.gardenFind;
    prisma.garden.create = original.gardenCreate;
    prisma.flower.findMany = original.flowerFindMany;
    prisma.flower.findUnique = original.flowerFindUnique;
    prisma.flower.upsert = original.flowerUpsert;
    prisma.eventMemory.updateMany = original.memoryUpdate;
    setFirebaseTokenVerifierForTests();
    setEventEmotionClassifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { token = "alice-token", key, body } = {}) {
    const result = await fetch(base + path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
    return { status: result.status, data: await result.json() };
  }
  const eventBody = { content: "A friend helped me.", primaryGardenMood: "SUNNY_BLOOM" };
  process.env.EMOTION_CLASSIFIER_ENABLED = "false";
  const off = await request("/events", { key: "off-event-1", body: eventBody });
  assert.equal(off.status, 201);
  assert.equal(calls, 0);
  assert.deepEqual(off.data.emotion.labels, []);
  assert.equal(off.data.event.emotionOutcome, "SKIPPED");
  assert.ok(off.data.flower);
  process.env.EMOTION_CLASSIFIER_ENABLED = "true";
  const preview = await request("/dev/emotion-preview", { body: { text: eventBody.content, primaryGardenMood: eventBody.primaryGardenMood } });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.data.labels, ["gratitude"]);
  assert.equal(events.length, 1);
  assert.equal(flowers.length, 1);
  const saved = await request("/events", { key: "on-event-1", body: eventBody });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.data.emotion.labels, preview.data.labels);
  assert.equal(saved.data.flower.colorAccent, preview.data.flower.colorAccent);
  assert.equal(saved.data.event.primaryGardenMood, "SUNNY_BLOOM");
  assert.equal(saved.data.event.emotionOutcome, "INFERRED_1");
  assert.equal(saved.data.event.emotionProvenance, "INFERRED_UNCONFIRMED");
  assert.equal(saved.data.event.emotionModelStatus, "research_only");
  assert.deepEqual(events[1].emotionProbabilities, { gratitude: 0.9 });
  const retry = await request("/events", { key: "on-event-1", body: eventBody });
  assert.equal(retry.status, 200);
  assert.equal(calls, 2);
  assert.equal(flowers.length, 2);
  responseLabels = [];
  responseProbabilities = {};
  const abstained = await request("/events", { key: "abstained-event-1", body: eventBody });
  assert.equal(abstained.data.event.emotionOutcome, "ABSTAINED");
  assert.deepEqual(abstained.data.event.secondaryEmotions, []);
  responseLabels = ["gratitude", "fear"];
  const two = await request("/events", { key: "two-event-1", body: eventBody });
  assert.equal(two.data.event.emotionOutcome, "INFERRED_2");
  assert.deepEqual(two.data.event.secondaryEmotions, ["gratitude", "fear"]);
  failNextPersistence = true;
  const persistenceFailure = await request("/events", { key: "write-failure-1", body: eventBody });
  assert.equal(persistenceFailure.data.event.emotionOutcome, "FAILED");
  assert.equal(persistenceFailure.data.emotion.fallbackReason, "PERSISTENCE_FAILED");
  assert.equal(events.at(-1).emotionStatus, "FAILED");
  responseLabels = ["fake", "joy", "gratitude"];
  const invalid = await request("/events", { key: "invalid-event-1", body: eventBody });
  assert.equal(invalid.status, 201);
  assert.deepEqual(invalid.data.emotion.labels, []);
  assert.equal(invalid.data.emotion.fallbackReason, "INVALID_MODEL_OUTPUT");
  setEventEmotionClassifierForTests(async () => ({ status: "FAILED", labels: [], fallbackReason: "TIMEOUT", latencyMs: 3 }));
  const timeoutSave = await request("/events", { key: "timeout-event-1", body: eventBody });
  assert.equal(timeoutSave.status, 201);
  assert.equal(timeoutSave.data.emotion.fallbackReason, "TIMEOUT");
  assert.deepEqual(timeoutSave.data.emotion.labels, []);
  assert.equal(timeoutSave.data.event.emotionOutcome, "FAILED");
  setEventEmotionClassifierForTests(async () => { throw new Error("runtime unavailable"); });
  const exceptionSave = await request("/events", { key: "exception-event-1", body: eventBody });
  assert.equal(exceptionSave.status, 201);
  assert.equal(exceptionSave.data.emotion.fallbackReason, "RUNTIME_UNAVAILABLE");
  const extracted = await new DeterministicMemoryExtractor().extract({ ...events[1], kind: "EVENT" });
  assert.equal(extracted.primaryMood, "SUNNY_BLOOM");
  assert.deepEqual(extracted.secondaryEmotions, ["gratitude"]);
  assert.equal(extracted.emotionProvenance, "INFERRED_UNCONFIRMED");
  assert.equal(extracted.emotionModelStatus, "research_only");
  let savedMemory;
  const memoryRepository = new PrismaMemoryRepository({
    event: { findFirst: async () => events[1] },
    eventMemory: {
      findFirst: async () => null,
      create: async ({ data }) => { savedMemory = data; return data; }
    }
  });
  await memoryRepository.saveMemory({ identity: { userId: "alice" }, memory: extracted });
  assert.equal(savedMemory.emotionProvenance, "INFERRED_UNCONFIRMED");
  assert.equal(savedMemory.emotionModelId, events[1].emotionModelId);
  assert.deepEqual(savedMemory.emotionProbabilities, events[1].emotionProbabilities);
  const forged = await request("/events", { key: "forged-event-1", body: { ...eventBody, ownerId: "bob" } });
  assert.equal(forged.status, 400);
  const bobRead = await fetch(base + `/events/${saved.data.event.id}`, { headers: { Authorization: "Bearer bob-token" } });
  assert.equal(bobRead.status, 404);
  const bobPreview = await request("/dev/emotion-preview", { token: "bob-token", body: { text: eventBody.content, ownerId: "alice" } });
  assert.equal(bobPreview.status, 403);
  process.env.NODE_ENV = "production";
  const blocked = await request("/dev/emotion-preview", { body: { text: eventBody.content } });
  assert.equal(blocked.status, 404);
  const productionEvent = await request("/events", { key: "production-blocked-1", body: eventBody });
  assert.equal(productionEvent.data.event.emotionOutcome, "SKIPPED");
  assert.equal(productionEvent.data.emotion.fallbackReason, "RESEARCH_ONLY_CONTEXT");
});

test("dev client routes through authenticated API only and has no model credentials", async () => {
  const source = await readFile(new URL("../../client/src/Dev/EmotionLab.jsx", import.meta.url), "utf8");
  assert.match(source, /apiRequest\(path/);
  assert.match(source, /run\("\/dev\/emotion-preview"/);
  assert.match(source, /run\("\/events"/);
  assert.doesNotMatch(source, /CLOUDFLARE_WORKER_AI_TOKEN|model-fp32\.onnx|Authorization/);
});
