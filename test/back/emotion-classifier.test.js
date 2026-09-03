import test from "node:test";
import assert from "node:assert/strict";

import { classifyEmotion, classifyWithCloudflare } from "../../lib/emotion-classifier.js";
import { resolveDailyFlowerEmotion } from "../../lib/daily-flower-input.js";
import { selectFlowerSecondaryEmotions } from "../../lib/secondary-emotion-selector.js";

const env = {
  CLOUDFLARE_WORKER_AI_URL: "https://emotion.example.workers.dev/",
  CLOUDFLARE_WORKER_AI_TOKEN: "shared-secret",
  AI_REQUEST_TIMEOUT_MS: "100",
  EMOTION_LLM_FALLBACK_THRESHOLD: "0.75",
  EMOTION_CLASSIFIER_AMBIGUITY_MARGIN: "0.20"
};

test("classifyWithCloudflare normalizes valid 21-label secondary emotions", async () => {
  const result = await classifyWithCloudflare("A complicated day", {
    env,
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer shared-secret");
      return Response.json({
        label: "STRESSED", confidence: 0.81,
        secondaryEmotions: [" Gratitude ", "LOVE"], intensity: 0.8, model: "test-model"
      });
    }
  });
  assert.equal(result.label, "stressed");
  assert.deepEqual(result.secondaryEmotions, ["gratitude", "love"]);
  assert.deepEqual(selectFlowerSecondaryEmotions({
    primaryGardenMood: "SUNNY_BLOOM",
    candidates: result.secondaryEmotions
  }).map(({ label }) => label), ["gratitude"]);
});

test("high routing score and margin use local classifier without Fast Llama", async () => {
  let fastCalled = false;
  const result = await classifyEmotion("A wonderful day", {
    env,
    userSelectedMood: "calm",
    localClassifier: async () => ({ label: "happy", confidence: 0.82, margin: 0.44 }),
    fastClassifier: async () => { fastCalled = true; throw new Error("unexpected"); }
  });
  assert.equal(fastCalled, false);
  assert.equal(result.inferencePath, "LOCAL_CLASSIFIER");
  assert.deepEqual(result.secondaryEmotions, []);
  assert.equal(result.intensity, null);
});

for (const [name, local] of [
  ["low routing score", { label: "sad", confidence: 0.6, margin: 0.4 }],
  ["ambiguous margin", { label: "sad", confidence: 0.8, margin: 0.1 }],
  ["invalid local output", { label: "unknown", confidence: 0.9, margin: 0.5 }]
]) {
  test(`${name} invokes Fast Llama fallback`, async () => {
    const result = await classifyEmotion("Mixed feelings", {
      env,
      localClassifier: async () => local,
      fastClassifier: async () => ({
        label: "sad", confidence: 0.7, secondaryEmotions: ["disappointment", "remorse"],
        intensity: 0.6, provider: "CLOUDFLARE_WORKERS_AI", model: "fast-test"
      })
    });
    assert.equal(result.inferencePath, "FAST_LLM_FALLBACK");
    assert.deepEqual(result.secondaryEmotions, ["disappointment", "remorse"]);
  });
}

test("Fast Llama failure preserves selected mood and never blocks Daily Grow", async () => {
  const result = await classifyEmotion("I am exhausted", {
    env,
    userSelectedMood: "SUNNY_BLOOM",
    localClassifier: async () => { throw new Error("offline"); },
    fastClassifier: async () => { throw Object.assign(new Error("offline"), { code: "WORKER_TIMEOUT" }); }
  });
  assert.equal(result.label, "SUNNY_BLOOM");
  assert.equal(result.inferencePath, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(result.secondaryEmotions, []);
  assert.equal(result.confidence, null);
});

test("invalid Fast Llama taxonomy falls back and Daily Grow still completes", async () => {
  const result = await resolveDailyFlowerEmotion({
    event: "A complicated day",
    mood: "GENTLE_BLOOM",
    aiProcessingAllowed: true,
    classify: (text, options) => classifyEmotion(text, {
      ...options,
      env,
      localClassifier: async () => ({ label: "sad", confidence: 0.2, margin: 0.1 }),
      fastClassifier: async () => ({
        label: "sad",
        confidence: 0.9,
        secondaryEmotions: ["tired"]
      })
    })
  });
  assert.equal(result.mood, "GENTLE_BLOOM");
  assert.equal(result.classification.inferencePath, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(result.classification.secondaryEmotions, []);
});
