import test from "node:test";
import assert from "node:assert/strict";

import { resolveDailyFlowerEmotion } from "../../lib/daily-flower-input.js";
import {
  CANONICAL_PRIMARY_GARDEN_MOODS,
  LEGACY_PRIMARY_MOODS
} from "../../lib/flower-variant-config.js";

test("all canonical Primary Bloom codes survive Daily Grow normalization", async () => {
  for (const mood of CANONICAL_PRIMARY_GARDEN_MOODS) {
    const result = await resolveDailyFlowerEmotion({
      event: "", mood, aiProcessingAllowed: true, classify: async () => assert.fail()
    });
    assert.equal(result.mood, mood);
  }
});

test("existing legacy moods retain case-insensitive lowercase compatibility", async () => {
  for (const mood of LEGACY_PRIMARY_MOODS) {
    const result = await resolveDailyFlowerEmotion({
      event: "", mood: mood.toUpperCase(), aiProcessingAllowed: true, classify: async () => assert.fail()
    });
    assert.equal(result.mood, mood);
  }
});

test("no journal is NO_AI and never invokes a classifier", async () => {
  let called = false;
  const result = await resolveDailyFlowerEmotion({
    event: "", mood: "CALM", aiProcessingAllowed: true,
    classify: async () => { called = true; }
  });
  assert.equal(called, false);
  assert.equal(result.mood, "calm");
  assert.equal(result.classification.inferencePath, "NO_AI");
});

test("journal plus selected mood runs cheap routing but preserves user primary", async () => {
  let options;
  const result = await resolveDailyFlowerEmotion({
    event: "I presented my project", mood: "happy", aiProcessingAllowed: true,
    classify: async (_text, received) => {
      options = received;
      return { label: "stressed", secondaryEmotions: ["stressed"], inferencePath: "LOCAL_CLASSIFIER" };
    }
  });
  assert.equal(options.userSelectedMood, "happy");
  assert.equal(result.mood, "happy");
  assert.equal(result.emotionSource, "USER");
});

test("selected mood without AI consent still plants with NO_AI", async () => {
  const result = await resolveDailyFlowerEmotion({
    event: "Private journal", mood: "sad", aiProcessingAllowed: false,
    classify: async () => { throw new Error("not expected"); }
  });
  assert.equal(result.mood, "sad");
  assert.equal(result.classification.inferencePath, "NO_AI");
});

test("journal-only classification still requires consent", async () => {
  await assert.rejects(resolveDailyFlowerEmotion({
    event: "A complicated day", mood: "", aiProcessingAllowed: false, classify: async () => ({})
  }), (error) => error.status === 403);
});

test("journal-only classification supplies the primary mood", async () => {
  const result = await resolveDailyFlowerEmotion({
    event: "I am exhausted", mood: "", aiProcessingAllowed: true,
    classify: async () => ({ label: "tired", secondaryEmotions: [], inferencePath: "LOCAL_CLASSIFIER" })
  });
  assert.equal(result.mood, "tired");
  assert.equal(result.emotionSource, "MODEL");
});
