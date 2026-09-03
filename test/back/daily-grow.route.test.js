import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app, setEmotionClassifierForTests } from "../../server.js";

const originals = {
  userFindUnique: prisma.user.findUnique,
  gardenFindUnique: prisma.garden.findUnique,
  gardenCreate: prisma.garden.create,
  checkInFindUnique: prisma.dailyCheckIn.findUnique,
  checkInFindMany: prisma.dailyCheckIn.findMany,
  flowerFindMany: prisma.flower.findMany,
  transaction: prisma.$transaction
};

let state;
let transactionCalls;

function resetState() {
  state = { checkIn: null, journal: null, emotion: null, flower: null, ai: null };
  transactionCalls = 0;
}

const owner = {
  id: "owner-1",
  name: "Bloom",
  avatar: "flower.png",
  timezone: "UTC",
  aiConsent: { aiProcessing: true },
  garden: { id: "garden-1" }
};

const transaction = {
  dailyCheckIn: {
    create: async ({ data }) => {
      state.journal = data.journal?.create
        ? { id: "journal-1", content: data.journal.create.content }
        : null;
      state.emotion = { id: "emotion-1", ...data.emotionResult.create };
      state.checkIn = {
        id: "checkin-1",
        localDate: data.localDate,
        timezone: data.timezone,
        journal: state.journal,
        emotionResult: state.emotion
      };
      return state.checkIn;
    }
  },
  flower: {
    create: async ({ data }) => {
      state.flower = { id: "flower-1", ...data, messages: [] };
      return state.flower;
    }
  },
  aiInteractionMetadata: {
    create: async ({ data }) => { state.ai = data; return data; }
  },
  fairyState: { upsert: async () => ({}) }
};

function installPrismaStub() {
  prisma.user.findUnique = async ({ where }) => {
    if (where.firebaseUid) return { id: where.firebaseUid === "friend-firebase" ? "friend-1" : owner.id };
    return where.id === owner.id ? owner : null;
  };
  prisma.garden.findUnique = async ({ include }) => include
    ? {
        id: "garden-1",
        flowers: state.flower ? [state.flower] : [],
        visitRecords: []
      }
    : { id: "garden-1", ownerId: owner.id };
  prisma.garden.create = async () => ({ id: "garden-1", ownerId: owner.id });
  prisma.dailyCheckIn.findUnique = async () => state.checkIn
    ? { ...state.checkIn, flower: state.flower }
    : null;
  prisma.dailyCheckIn.findMany = async () => state.checkIn
    ? [{ ...state.checkIn, flower: state.flower }]
    : [];
  prisma.flower.findMany = async () => state.flower ? [state.flower] : [];
  prisma.$transaction = async (callback) => {
    transactionCalls += 1;
    return transactionCalls % 2 === 1 ? callback(transaction) : null;
  };
}

function restorePrisma() {
  prisma.user.findUnique = originals.userFindUnique;
  prisma.garden.findUnique = originals.gardenFindUnique;
  prisma.garden.create = originals.gardenCreate;
  prisma.dailyCheckIn.findUnique = originals.checkInFindUnique;
  prisma.dailyCheckIn.findMany = originals.checkInFindMany;
  prisma.flower.findMany = originals.flowerFindMany;
  prisma.$transaction = originals.transaction;
}

async function api(baseUrl, path, { token = "owner-token", method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

test("Daily Grow route preserves the Month 1 vertical-slice contract", async (t) => {
  resetState();
  installPrismaStub();
  setFirebaseTokenVerifierForTests(async (token) => ({
    uid: token === "friend-token" ? "friend-firebase" : "owner-firebase",
    email_verified: true
  }));

  const httpServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => httpServer.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  t.after(async () => {
    setEmotionClassifierForTests();
    setFirebaseTokenVerifierForTests();
    restorePrisma();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  await t.test("rejects an invalid Daily Grow request safely", async () => {
    resetState();
    const result = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "", event: "" }
    });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: "Choose a mood or write an optional journal entry" });
  });

  await t.test("creates a deterministic canonical Flower from Mood only", async () => {
    resetState();
    setEmotionClassifierForTests(async () => assert.fail("Mood-only input must not call AI"));
    const result = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "SUNNY_BLOOM", event: "" }
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.primaryGardenMood, "SUNNY_BLOOM");
    assert.equal(result.body.flower.speciesPoolSource, "PRIMARY_CONFIG");
    assert.ok(["SUNFLOWER", "TULIP"].includes(result.body.flower.species));
    assert.equal(state.journal, null);
    assert.equal(state.emotion.inferencePath, "NO_AI");
  });

  await t.test("persists valid AI analysis and keeps private data owner-only", async () => {
    resetState();
    setEmotionClassifierForTests(async () => ({
      label: "happy",
      confidence: 0.91,
      secondaryEmotions: ["gratitude"],
      intensity: 0.7,
      provider: "CLOUDFLARE_WORKERS_AI",
      model: "test-model",
      inferencePath: "FAST_LLM_FALLBACK",
      latencyMs: 4,
      success: true,
      errorCode: null
    }));

    const created = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "SUNNY_BLOOM", event: "A private thankful moment" }
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.secondaryEmotions, ["gratitude"]);
    assert.equal(created.body.flower.variant.colorAccent, "WARM_GOLD");
    assert.equal(state.journal.content, "A private thankful moment");
    assert.equal(state.ai.provider, "CLOUDFLARE_WORKERS_AI");

    const checkIns = await api(baseUrl, `/users/${owner.id}/check-ins`);
    assert.equal(checkIns.status, 200);
    assert.equal(checkIns.body[0].journal.content, "A private thankful moment");

    const ownerGarden = await api(baseUrl, `/users/${owner.id}/garden`);
    assert.equal(ownerGarden.body.flowers[0].event, "A private thankful moment");

    const socialGarden = await api(baseUrl, `/users/${owner.id}/garden`, { token: "friend-token" });
    const socialFlower = socialGarden.body.flowers[0];
    assert.equal(socialGarden.status, 200);
    for (const field of ["event", "generationSeed", "dailyCheckInId", "emotionResult"]) {
      assert.equal(Object.hasOwn(socialFlower, field), false);
    }
    assert.equal(socialFlower.name, state.flower.name);
    assert.equal(socialFlower.speciesCode, state.flower.speciesCode);

    const duplicate = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "SUNNY_BLOOM", event: "A private thankful moment" }
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, "You have already completed today's check-in");
  });

  await t.test("deterministic AI fallback still completes and persists Daily Grow", async () => {
    resetState();
    setEmotionClassifierForTests(async () => ({
      label: "FIRE_BLOOM",
      confidence: null,
      secondaryEmotions: [],
      intensity: null,
      provider: "DETERMINISTIC",
      model: "keyword-fallback-v1",
      inferencePath: "DETERMINISTIC_FALLBACK",
      latencyMs: 2,
      success: true,
      errorCode: "WORKER_INVALID_OUTPUT"
    }));
    const result = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "FIRE_BLOOM", event: "AI can fail without blocking this flower" }
    });
    assert.equal(result.status, 201);
    assert.equal(state.emotion.inferencePath, "DETERMINISTIC_FALLBACK");
    assert.equal(state.flower.dailyCheckInId, "checkin-1");
  });
});
