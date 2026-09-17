import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app, setEmotionClassifierForTests } from "../../server.js";

const originals = {
  userFindUnique: prisma.user.findUnique,
  gardenFindUnique: prisma.garden.findUnique,
  gardenCreate: prisma.garden.create,
  fairyStateUpsert: prisma.fairyState.upsert,
  checkInFindFirst: prisma.dailyCheckIn.findFirst,
  checkInFindMany: prisma.dailyCheckIn.findMany,
  flowerFindMany: prisma.flower.findMany,
  eventCreate: prisma.event.create,
  aiJobCreate: prisma.aiJob.create,
  transaction: prisma.$transaction
};

let state;
let transactionCalls;
let longTermAiWrites;

function resetState() {
  state = { checkIn: null, journal: null, emotion: null, flower: null, ai: null, fairyState: null };
  transactionCalls = 0;
  longTermAiWrites = 0;
}

const owner = {
  id: "owner-1",
  name: "Bloom",
  avatar: "flower.png",
  timezone: "UTC",
  aiConsent: { aiProcessing: true },
  fairyState: { onboardingStep: "MOOD_SELECTION", onboardingCompleted: false },
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
        dailyLimitEnforced: data.dailyLimitEnforced,
        journal: state.journal,
        emotionResult: state.emotion
      };
      return state.checkIn;
    }
  },
  flower: {
    create: async ({ data }) => {
      state.flower = {
        id: "flower-1",
        ...data,
        dailyCheckIn: state.checkIn,
        messages: []
      };
      return state.flower;
    }
  },
  aiInteractionMetadata: {
    create: async ({ data }) => { state.ai = data; return data; }
  },
  fairyState: {
    upsert: async ({ update }) => {
      state.fairyState = update;
      return update;
    }
  }
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
  prisma.fairyState.upsert = async () => ({ onboardingCompleted: true });
  prisma.dailyCheckIn.findFirst = async () => state.checkIn
    ? { ...state.checkIn, flower: state.flower }
    : null;
  prisma.dailyCheckIn.findMany = async () => state.checkIn
    ? [{ ...state.checkIn, flower: state.flower }]
    : [];
  prisma.flower.findMany = async () => state.flower ? [state.flower] : [];
  prisma.event.create = async () => { longTermAiWrites += 1; throw new Error("Daily Grow must not create Event"); };
  prisma.aiJob.create = async () => { longTermAiWrites += 1; throw new Error("Daily Grow must not create AIJob"); };
  prisma.$transaction = async (callback) => {
    transactionCalls += 1;
    return transactionCalls % 2 === 1 ? callback(transaction) : null;
  };
}

function restorePrisma() {
  prisma.user.findUnique = originals.userFindUnique;
  prisma.garden.findUnique = originals.gardenFindUnique;
  prisma.garden.create = originals.gardenCreate;
  prisma.fairyState.upsert = originals.fairyStateUpsert;
  prisma.dailyCheckIn.findFirst = originals.checkInFindFirst;
  prisma.dailyCheckIn.findMany = originals.checkInFindMany;
  prisma.flower.findMany = originals.flowerFindMany;
  prisma.event.create = originals.eventCreate;
  prisma.aiJob.create = originals.aiJobCreate;
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
    assert.deepEqual(result.body, { error: "Choose a mood; Journal text is private and is never sent to AI" });
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
    assert.deepEqual(result.body.fairyEvent, {
      code: "FIRST_FLOWER",
      dialogueKey: "fairy.first_flower",
      actionKey: "CELEBRATE_FLOWER"
    });
    assert.equal(state.fairyState.lastEvent, "FIRST_FLOWER");
  });

  await t.test("deprecated event alias persists Journal only and never calls AI", async () => {
    resetState();
    setEmotionClassifierForTests(async () => assert.fail("Journal must never call emotion AI"));

    const created = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "SUNNY_BLOOM", event: "A private thankful moment" }
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.secondaryEmotions, []);
    assert.equal(state.journal.content, "A private thankful moment");
    assert.equal(state.ai, null);
    assert.equal(state.emotion.inferencePath, "NO_AI");
    assert.equal(longTermAiWrites, 0);

    const checkIns = await api(baseUrl, `/users/${owner.id}/check-ins`);
    assert.equal(checkIns.status, 200);
    assert.equal(checkIns.body[0].journal.content, "A private thankful moment");

    const ownerGarden = await api(baseUrl, `/users/${owner.id}/garden`);
    assert.equal(ownerGarden.body.flowers[0].event, "A private thankful moment");
    assert.deepEqual(
      ownerGarden.body.flowers[0].dailyCheckIn.emotionResult.secondaryEmotions,
      []
    );

    const socialGarden = await api(baseUrl, `/users/${owner.id}/garden`, { token: "friend-token" });
    const socialFlower = socialGarden.body.flowers[0];
    assert.equal(socialGarden.status, 200);
    for (const field of ["event", "generationSeed", "dailyCheckInId", "dailyCheckIn", "emotionResult"]) {
      assert.equal(Object.hasOwn(socialFlower, field), false);
    }
    assert.equal(socialFlower.name, state.flower.name);
    assert.equal(socialFlower.speciesCode, state.flower.speciesCode);

    const previousValue = process.env.DAILY_GROW_LIMIT_ENABLED;
    process.env.DAILY_GROW_LIMIT_ENABLED = "true";
    try {
      const duplicate = await api(baseUrl, `/users/${owner.id}/flowers`, {
        method: "POST",
        body: { mood: "SUNNY_BLOOM", event: "A private thankful moment" }
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.error, "You have already completed today's check-in");
    } finally {
      if (previousValue === undefined) delete process.env.DAILY_GROW_LIMIT_ENABLED;
      else process.env.DAILY_GROW_LIMIT_ENABLED = previousValue;
    }
  });

  await t.test("canonical journalText remains private even when a classifier is available", async () => {
    resetState();
    setEmotionClassifierForTests(async () => assert.fail("Journal must never call emotion AI"));
    const result = await api(baseUrl, `/users/${owner.id}/flowers`, {
      method: "POST",
      body: { mood: "FIRE_BLOOM", journalText: "Private Journal text" }
    });
    assert.equal(result.status, 201);
    assert.equal(state.journal.content, "Private Journal text");
    assert.equal(state.emotion.inferencePath, "NO_AI");
    assert.equal(state.ai, null);
    assert.equal(state.flower.dailyCheckInId, "checkin-1");
  });

  await t.test("DAILY_GROW_LIMIT_ENABLED=false allows repeated test grows", async () => {
    resetState();
    const previousValue = process.env.DAILY_GROW_LIMIT_ENABLED;
    process.env.DAILY_GROW_LIMIT_ENABLED = "false";

    try {
      const first = await api(baseUrl, `/users/${owner.id}/flowers`, {
        method: "POST",
        body: { mood: "SUNNY_BLOOM", event: "" }
      });
      const second = await api(baseUrl, `/users/${owner.id}/flowers`, {
        method: "POST",
        body: { mood: "SUNNY_BLOOM", event: "" }
      });

      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(state.checkIn.dailyLimitEnforced, false);

      const session = await api(baseUrl, "/session");
      assert.equal(session.status, 200);
      assert.equal(session.body.hasCheckedInToday, true);
      assert.equal(session.body.dailyGrowLimitEnabled, false);
    } finally {
      if (previousValue === undefined) delete process.env.DAILY_GROW_LIMIT_ENABLED;
      else process.env.DAILY_GROW_LIMIT_ENABLED = previousValue;
    }
  });

  await t.test("replay and true 20-request concurrency preserve one Daily Grow", async () => {
    resetState();
    process.env.DAILY_GROW_LIMIT_ENABLED = "true";
    const originalTransaction = prisma.$transaction;
    let queue = Promise.resolve();
    prisma.$transaction = async (callback) => {
      const run = queue.then(async () => {
        if (state.checkIn) {
          const error = new Error("unique daily grow");
          error.code = "P2002";
          throw error;
        }
        return callback(transaction);
      });
      queue = run.catch(() => {});
      return run;
    };
    try {
      const first = await api(baseUrl, `/users/${owner.id}/flowers`, {
        method: "POST", body: { mood: "SUNNY_BLOOM" }
      });
      const replay = await api(baseUrl, `/users/${owner.id}/flowers`, {
        method: "POST", body: { mood: "SUNNY_BLOOM" }
      });
      assert.equal(first.status, 201);
      assert.equal(replay.status, 409);
      resetState();
      queue = Promise.resolve();
      const results = await Promise.all(Array.from({ length: 20 }, () => api(
        baseUrl, `/users/${owner.id}/flowers`, { method: "POST", body: { mood: "SUNNY_BLOOM" } }
      )));
      const statuses = results.reduce((counts, result) => {
        const key = result.status === 201 ? "success" : result.status === 409 ? "conflict" : `unexpected-${result.status}`;
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
      assert.deepEqual(statuses, { success: 1, conflict: 19 });
      assert.equal(state.checkIn.localDate, "2026-09-16");
      assert.equal(state.flower.dailyCheckInId, state.checkIn.id);
      assert.equal(state.journal, null);
      assert.equal(longTermAiWrites, 0);
    } finally {
      prisma.$transaction = originalTransaction;
      delete process.env.DAILY_GROW_LIMIT_ENABLED;
    }
  });
});
