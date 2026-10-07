import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { classifyEventEmotion, classifyEventSecondaryEmotions, emotionClassifierEnabled } from "../../lib/event-emotion.js";
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

test("Event LLM adapter sends only Primary Mood and Event text and validates ordered Product-18 output", async () => {
  const env = { CLOUDFLARE_WORKER_AI_URL: "https://worker.example/", CLOUDFLARE_WORKER_AI_TOKEN: "secret" };
  let request;
  const classify = (output, primaryGardenMood = "SUNNY_BLOOM") => classifyEventSecondaryEmotions({
    text: "A friend helped me.", primaryGardenMood, env,
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => output }; }
  });
  assert.deepEqual((await classify({ e: [] })).labels, []);
  assert.equal(request.url, "https://worker.example/v1/event-emotion");
  assert.deepEqual(JSON.parse(request.options.body), { p: "SUNNY_BLOOM", e: "A friend helped me." });
  assert.deepEqual((await classify({ e: ["gratitude"] })).labels, ["gratitude"]);
  assert.deepEqual((await classify({ e: ["gratitude", "fear"] })).labels, ["gratitude", "fear"]);
  assert.deepEqual((await classify({ e: ["gratitude", "fear", "surprise"] })).labels, ["gratitude", "fear"]);
  assert.deepEqual((await classify({ e: ["fake", "gratitude", "approval", "fear"] })).labels, ["gratitude", "fear"]);
  assert.deepEqual((await classify({ e: ["gratitude", "gratitude", "fear"] })).labels, ["gratitude", "fear"]);
  assert.deepEqual((await classify({ e: ["joy", "gratitude"] })).labels, ["gratitude"]);
  for (const pair of [["gratitude", "caring"], ["caring", "love"], ["fear", "annoyance"]]) {
    assert.deepEqual((await classify({ e: pair })).labels, pair);
  }
  for (const pair of [["joy", "excitement"], ["joy", "optimism"]]) {
    assert.deepEqual((await classify({ e: pair }, "HEALING_BLOOM")).labels, pair);
    assert.deepEqual((await classify({ e: pair })).labels, [pair[1]]);
  }
  assert.deepEqual((await classify({ e: "gratitude" })).labels, []);
  assert.deepEqual((await classify({})).labels, []);
  assert.deepEqual((await classify({ e: null })).labels, []);
  assert.deepEqual((await classify({ e: [null, 1, "gratitude"] })).labels, ["gratitude"]);
  const malformed = await classifyEventSecondaryEmotions({ text: "event", primaryGardenMood: "SUNNY_BLOOM", env,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }) });
  assert.equal(malformed.status, "FAILED");
  assert.deepEqual(malformed.labels, []);
  const providerError = await classifyEventSecondaryEmotions({ text: "event", primaryGardenMood: "SUNNY_BLOOM", env,
    fetchImpl: async () => { throw new Error("network"); } });
  assert.deepEqual(providerError.labels, []);
  const httpError = await classifyEventSecondaryEmotions({ text: "event", primaryGardenMood: "SUNNY_BLOOM", env,
    fetchImpl: async () => ({ ok: false, status: 502 }) });
  assert.deepEqual(httpError.labels, []);
  const timedOut = await classifyEventSecondaryEmotions({ text: "event", primaryGardenMood: "SUNNY_BLOOM",
    env: { ...env, AI_REQUEST_TIMEOUT_MS: "5" }, fetchImpl: () => new Promise(() => {}) });
  assert.equal(timedOut.fallbackReason, "TIMEOUT");
  assert.deepEqual(timedOut.labels, []);
});

test("Emotion Lab diagnostics distinguish Worker output, filtering, and safe failures", async () => {
  const env = { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "secret" };
  const classify = (output, fetchImpl = async () => ({ ok: true, json: async () => output })) =>
    classifyEventSecondaryEmotions({ text: "Synthetic Event", primaryGardenMood: "SUNNY_BLOOM", env, fetchImpl, includeDiagnostics: true });

  const empty = await classify({ e: [] });
  assert.equal(empty.status, "SUCCESS");
  assert.deepEqual(empty.diagnostics, { attempted: true, status: "SUCCESS", fallbackReason: null,
    workerLabels: [], productLabels: [], validatedLabels: [], removedLabels: [] });

  const valid = await classify({ e: ["gratitude", "fear"] });
  assert.deepEqual(valid.diagnostics.workerLabels, ["gratitude", "fear"]);
  assert.deepEqual(valid.diagnostics.productLabels, ["gratitude", "fear"]);
  assert.deepEqual(valid.diagnostics.validatedLabels, ["gratitude", "fear"]);

  const redundant = await classify({ e: ["joy", "gratitude"] });
  assert.deepEqual(redundant.diagnostics.workerLabels, ["joy", "gratitude"]);
  assert.deepEqual(redundant.diagnostics.validatedLabels, ["gratitude"]);
  assert.deepEqual(redundant.diagnostics.removedLabels, [{ label: "joy", reason: "PRIMARY_REDUNDANT" }]);

  const invalid = await classify({ e: ["fake", "gratitude"] });
  assert.deepEqual(invalid.diagnostics.workerLabels, ["fake", "gratitude"]);
  assert.deepEqual(invalid.diagnostics.productLabels, ["gratitude"]);
  assert.deepEqual(invalid.diagnostics.validatedLabels, ["gratitude"]);
  assert.deepEqual(invalid.diagnostics.removedLabels, [{ label: "fake", reason: "INVALID_TAXONOMY" }]);

  const duplicate = await classify({ e: ["gratitude", "gratitude"] });
  assert.deepEqual(duplicate.diagnostics.validatedLabels, ["gratitude"]);
  assert.deepEqual(duplicate.diagnostics.removedLabels, [{ label: "gratitude", reason: "DUPLICATE" }]);
  const capped = await classify({ e: ["gratitude", "fear", "curiosity"] });
  assert.deepEqual(capped.diagnostics.removedLabels, [{ label: "curiosity", reason: "MAX_2_CAP" }]);
  const cooccurring = await classify({ e: ["gratitude", "caring"] });
  assert.deepEqual(cooccurring.diagnostics.workerLabels, ["gratitude", "caring"]);
  assert.deepEqual(cooccurring.diagnostics.validatedLabels, ["gratitude", "caring"]);
  assert.deepEqual(cooccurring.diagnostics.removedLabels, []);

  for (const [fetchImpl, reason] of [
    [async () => { throw new Error("network details must stay hidden"); }, "NETWORK_ERROR"],
    [async () => ({ ok: false, status: 502 }), "HTTP_ERROR"]
  ]) {
    const failed = await classify(null, fetchImpl);
    assert.equal(failed.status, "FAILED");
    assert.deepEqual(failed.labels, []);
    assert.equal(failed.diagnostics.attempted, true);
    assert.equal(failed.diagnostics.status, "PROVIDER_ERROR");
    assert.equal(failed.diagnostics.fallbackReason, reason);
    assert.doesNotMatch(JSON.stringify(failed.diagnostics), /network details must stay hidden/);
  }
  const malformedJson = await classify(null, async () => ({ ok: true, json: async () => { throw new SyntaxError("private body"); } }));
  assert.equal(malformedJson.diagnostics.status, "INVALID_RESPONSE");
  assert.equal(malformedJson.diagnostics.fallbackReason, "MALFORMED_JSON");
  assert.deepEqual(malformedJson.labels, []);
  const malformedOutput = await classify({ e: "gratitude" });
  assert.equal(malformedOutput.diagnostics.status, "INVALID_RESPONSE");
  assert.equal(malformedOutput.diagnostics.fallbackReason, "INVALID_MODEL_OUTPUT");
  assert.deepEqual(malformedOutput.labels, []);

  const productionShape = await classifyEventSecondaryEmotions({ text: "Synthetic Event", primaryGardenMood: "SUNNY_BLOOM", env,
    fetchImpl: async () => ({ ok: true, json: async () => ({ e: ["gratitude"] }) }) });
  assert.deepEqual(productionShape, { status: "SUCCESS", labels: ["gratitude"], latencyMs: productionShape.latencyMs });
  assert.equal(Object.hasOwn(productionShape, "diagnostics"), false);
});

test("Event save and dev preview share adapter, preserve ownership, and never duplicate Flower", async (t) => {
  const originalEnv = { url: process.env.CLOUDFLARE_WORKER_AI_URL, token: process.env.CLOUDFLARE_WORKER_AI_TOKEN, mode: process.env.NODE_ENV, testEmail: process.env.AUTH_E2E_TEST_EMAIL };
  const original = {
    transaction: prisma.$transaction, userFind: prisma.user.findUnique,
    eventFind: prisma.event.findFirst, eventUpdate: prisma.event.update,
    gardenFind: prisma.garden.findUnique, gardenCreate: prisma.garden.create,
    flowerFindMany: prisma.flower.findMany, flowerFindUnique: prisma.flower.findUnique,
    flowerUpsert: prisma.flower.upsert, memoryUpdate: prisma.eventMemory.updateMany
  };
  const events = [];
  const flowers = [];
  const reservations = [];
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
    $queryRawUnsafe: async (_query, ownerId, ...args) => {
      if (_query.includes("ai-cost:lock") || _query.includes("ai-cost:clock")) return [{ now: new Date() }];
      if (_query.includes("ai-cost:owner")) return users[ownerId] ? [{ id: ownerId }] : [];
      if (_query.includes("ai-cost:duplicate")) return reservations.filter(row => row.id === ownerId);
      if (_query.includes("ai-cost:usage")) return [{ action: reservations.length, user: reservations.length, global: reservations.length, provider: reservations.length }];
      if (_query.includes("ai-cost:reserve")) { reservations.push({ id: ownerId }); return [{ id: ownerId }]; }
      const consent = users[ownerId]?.aiConsent;
      return consent ? [{ ...consent }] : [];
    },
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
    if (originalEnv.url === undefined) delete process.env.CLOUDFLARE_WORKER_AI_URL;
    else process.env.CLOUDFLARE_WORKER_AI_URL = originalEnv.url;
    if (originalEnv.token === undefined) delete process.env.CLOUDFLARE_WORKER_AI_TOKEN;
    else process.env.CLOUDFLARE_WORKER_AI_TOKEN = originalEnv.token;
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
  delete process.env.CLOUDFLARE_WORKER_AI_URL;
  delete process.env.CLOUDFLARE_WORKER_AI_TOKEN;
  const off = await request("/events", { key: "off-event-1", body: eventBody });
  assert.equal(off.status, 201);
  assert.equal(calls, 0);
  assert.deepEqual(off.data.emotion.labels, []);
  assert.equal(off.data.event.emotionOutcome, "SKIPPED");
  assert.ok(off.data.flower);
  process.env.CLOUDFLARE_WORKER_AI_URL = "https://worker.example";
  process.env.CLOUDFLARE_WORKER_AI_TOKEN = "secret";
  users.alice.aiConsent.aiProcessing = true;
  const preview = await request("/dev/emotion-preview", { body: { text: eventBody.content, primaryGardenMood: eventBody.primaryGardenMood } });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.data.labels, ["gratitude"]);
  assert.equal(preview.data.diagnostics.attempted, true);
  assert.equal(preview.data.diagnostics.status, "SUCCESS");
  assert.equal(preview.data.diagnostics.provider, "Cloudflare Workers AI");
  assert.equal(preview.data.diagnostics.model, "cf/meta/llama-3.1-8b-instruct-fast");
  assert.equal(Object.hasOwn(preview.data, "probabilities"), false);
  assert.equal(events.length, 1);
  assert.equal(flowers.length, 1);
  setEventEmotionClassifierForTests((input) => classifyEventSecondaryEmotions({ ...input,
    fetchImpl: async () => ({ ok: true, json: async () => ({ e: ["joy", "gratitude"] }) }) }));
  const tracedPreview = await request("/dev/emotion-preview", { body: { text: eventBody.content, primaryGardenMood: eventBody.primaryGardenMood } });
  assert.deepEqual(tracedPreview.data.diagnostics.workerLabels, ["joy", "gratitude"]);
  assert.deepEqual(tracedPreview.data.diagnostics.productLabels, ["joy", "gratitude"]);
  assert.deepEqual(tracedPreview.data.diagnostics.validatedLabels, ["gratitude"]);
  assert.deepEqual(tracedPreview.data.diagnostics.removedLabels, [{ label: "joy", reason: "PRIMARY_REDUNDANT" }]);
  setEventEmotionClassifierForTests((input) => classifyEventSecondaryEmotions({ ...input,
    fetchImpl: async () => ({ ok: true, json: async () => ({ e: ["gratitude", "caring"] }) }) }));
  const cooccurringPreview = await request("/dev/emotion-preview", { body: { text: eventBody.content, primaryGardenMood: eventBody.primaryGardenMood } });
  assert.deepEqual(cooccurringPreview.data.labels, ["gratitude", "caring"]);
  assert.deepEqual(cooccurringPreview.data.diagnostics.workerLabels, ["gratitude", "caring"]);
  assert.deepEqual(cooccurringPreview.data.diagnostics.validatedLabels, ["gratitude", "caring"]);
  assert.deepEqual(cooccurringPreview.data.diagnostics.removedLabels, []);
  assert.equal(cooccurringPreview.data.flower.visualEffect, "GENTLE_GLOW");
  assert.equal(events.length, 1);
  setEventEmotionClassifierForTests(async () => { calls += 1; return { status: "SUCCESS", labels: responseLabels, probabilities: responseProbabilities, latencyMs: 2 }; });
  const saved = await request("/events", { key: "on-event-1", body: eventBody });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.data.emotion.labels, preview.data.labels);
  assert.equal(Object.hasOwn(saved.data.emotion, "diagnostics"), false);
  assert.equal(Object.hasOwn(saved.data.event, "diagnostics"), false);
  assert.equal(saved.data.flower.colorAccent, preview.data.flower.colorAccent);
  assert.equal(saved.data.event.primaryGardenMood, "SUNNY_BLOOM");
  assert.equal(saved.data.event.emotionOutcome, "INFERRED_1");
  assert.equal(saved.data.event.emotionProvenance, "INFERRED_UNCONFIRMED");
  assert.equal(saved.data.event.emotionModelStatus, "production");
  assert.equal(events[1].emotionProbabilities, null);
  assert.ok(["SUNFLOWER", "TULIP"].includes(saved.data.flower.speciesCode));
  const retry = await request("/events", { key: "on-event-1", body: eventBody });
  assert.equal(retry.status, 200);
  assert.equal(calls, 2);
  assert.equal(flowers.length, 2);
  responseLabels = [];
  responseProbabilities = {};
  const abstained = await request("/events", { key: "abstained-event-1", body: eventBody });
  assert.equal(abstained.data.event.emotionOutcome, "ABSTAINED");
  assert.deepEqual(abstained.data.event.secondaryEmotions, []);
  assert.equal(abstained.data.flower.colorAccent, null);
  responseLabels = ["gratitude", "fear"];
  const two = await request("/events", { key: "two-event-1", body: eventBody });
  assert.equal(two.data.event.emotionOutcome, "INFERRED_2");
  assert.deepEqual(two.data.event.secondaryEmotions, ["gratitude", "fear"]);
  assert.equal(two.data.flower.colorAccent, "WARM_GOLD");
  assert.equal(two.data.flower.visualEffect, "SUBTLE_MIST");
  assert.ok(["SUNFLOWER", "TULIP"].includes(two.data.flower.speciesCode));
  responseLabels = ["gratitude", "caring"];
  const cooccurringSave = await request("/events", { key: "cooccurring-event-1", body: eventBody });
  assert.equal(cooccurringSave.status, 201);
  assert.deepEqual(cooccurringSave.data.event.secondaryEmotions, ["gratitude", "caring"]);
  assert.equal(cooccurringSave.data.event.emotionOutcome, "INFERRED_2");
  assert.equal(cooccurringSave.data.event.primaryGardenMood, "SUNNY_BLOOM");
  assert.equal(cooccurringSave.data.flower.visualEffect, "GENTLE_GLOW");
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
  setEventEmotionClassifierForTests(async () => { calls += 1; return { status: "SUCCESS", labels: ["gratitude"], latencyMs: 2 }; });
  users.alice.aiConsent.aiProcessing = false;
  const callsBeforeNoConsent = calls;
  const noConsentPreview = await request("/dev/emotion-preview", { body: { text: eventBody.content, primaryGardenMood: eventBody.primaryGardenMood } });
  assert.equal(noConsentPreview.status, 200);
  assert.deepEqual(noConsentPreview.data.labels, []);
  assert.equal(noConsentPreview.data.classifierEnabled, false);
  assert.equal(noConsentPreview.data.diagnostics.attempted, false);
  assert.equal(noConsentPreview.data.diagnostics.status, "SKIPPED");
  assert.equal(noConsentPreview.data.diagnostics.fallbackReason, "AI_CONSENT_DISABLED");
  const noConsentSave = await request("/events", { key: "no-consent-event-1", body: eventBody });
  assert.equal(noConsentSave.status, 201);
  assert.equal(noConsentSave.data.event.primaryGardenMood, "SUNNY_BLOOM");
  assert.deepEqual(noConsentSave.data.event.secondaryEmotions, []);
  assert.equal(noConsentSave.data.flower.colorAccent, null);
  assert.equal(calls, callsBeforeNoConsent);
  users.alice.aiConsent.aiProcessing = true;
  const consentSave = await request("/events", { key: "consent-event-1", body: eventBody });
  assert.equal(consentSave.status, 201);
  assert.deepEqual(consentSave.data.event.secondaryEmotions, ["gratitude"]);
  assert.equal(calls, callsBeforeNoConsent + 1);
  const extracted = await new DeterministicMemoryExtractor().extract({ ...events[1], kind: "EVENT" });
  assert.equal(extracted.primaryMood, "SUNNY_BLOOM");
  assert.deepEqual(extracted.secondaryEmotions, ["gratitude"]);
  assert.equal(extracted.emotionProvenance, "INFERRED_UNCONFIRMED");
  assert.equal(extracted.emotionModelStatus, "production");
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
  assert.equal(savedMemory.emotionProbabilities ?? null, null);
  const forged = await request("/events", { key: "forged-event-1", body: { ...eventBody, ownerId: "bob" } });
  assert.equal(forged.status, 400);
  const bobRead = await fetch(base + `/events/${saved.data.event.id}`, { headers: { Authorization: "Bearer bob-token" } });
  assert.equal(bobRead.status, 404);
  const bobPreview = await request("/dev/emotion-preview", { token: "bob-token", body: { text: eventBody.content, ownerId: "alice" } });
  assert.equal(bobPreview.status, 403);
  process.env.NODE_ENV = "production";
  const blocked = await request("/dev/emotion-preview", { body: { text: eventBody.content } });
  assert.equal(blocked.status, 404);
  setEventEmotionClassifierForTests(async () => ({ status: "SUCCESS", labels: ["gratitude"], latencyMs: 2 }));
  const productionEvent = await request("/events", { key: "production-llm-1", body: eventBody });
  assert.equal(productionEvent.status, 201);
  assert.equal(productionEvent.data.event.emotionOutcome, "INFERRED_1");
  assert.equal(productionEvent.data.event.primaryGardenMood, "SUNNY_BLOOM");
  const previousLimit = process.env.AI_EVENT_EMOTION_DAILY_LIMIT;
  t.after(() => { if (previousLimit === undefined) delete process.env.AI_EVENT_EMOTION_DAILY_LIMIT; else process.env.AI_EVENT_EMOTION_DAILY_LIMIT = previousLimit; });
  process.env.AI_EVENT_EMOTION_DAILY_LIMIT = "0";
  setEventEmotionClassifierForTests(async () => { calls++; throw Error("private provider detail"); });
  const beforeQuota = calls;
  const quotaEvent = await request("/events", { key: "quota-event-1", body: eventBody });
  assert.equal(quotaEvent.status, 201, "source Event still saves when AI is unavailable");
  assert.equal(quotaEvent.data.emotion.fallbackReason, "AI_QUOTA_EXCEEDED");
  assert.equal(calls, beforeQuota, "no provider call after shared quota denial");
  assert.equal(JSON.stringify(quotaEvent.data).includes("private provider detail"), false);
});

test("dev client routes through authenticated API only and has no model credentials", async () => {
  const source = await readFile(new URL("../../client/src/Dev/EmotionLab.jsx", import.meta.url), "utf8");
  assert.match(source, /apiRequest\(path/);
  assert.match(source, /run\("\/dev\/emotion-preview"/);
  assert.match(source, /run\("\/events"/);
  assert.match(source, /diagnostic\.diagnostics\.workerLabels/);
  assert.doesNotMatch(source, /probabilities/);
  assert.doesNotMatch(source, /CLOUDFLARE_WORKER_AI_TOKEN|model-fp32\.onnx|Authorization/);
});
