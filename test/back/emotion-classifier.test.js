import test from "node:test";
import assert from "node:assert/strict";

import { classifyEmotion, classifyWithCloudflare } from "../../lib/emotion-classifier.js";

const env = {
  CLOUDFLARE_WORKER_AI_URL: "https://emotion.example.workers.dev/",
  CLOUDFLARE_WORKER_AI_TOKEN: "shared-secret",
  AI_REQUEST_TIMEOUT_MS: "100",
  EMOTION_LLM_FALLBACK_THRESHOLD: "0.75",
  EMOTION_CLASSIFIER_AMBIGUITY_MARGIN: "0.20"
};

test("classifyWithCloudflare validates at most two secondary emotions", async () => {
  const result = await classifyWithCloudflare("A complicated day", {
    env,
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer shared-secret");
      return Response.json({
        label: "stressed", confidence: 0.81,
        secondaryEmotions: ["sad", "tired", "calm"], intensity: 0.8, model: "test-model"
      });
    }
  });
  assert.deepEqual(result.secondaryEmotions, ["sad", "tired"]);
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
  assert.deepEqual(result.secondaryEmotions, ["happy"]);
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
        label: "sad", confidence: 0.7, secondaryEmotions: ["tired", "stressed"],
        intensity: 0.6, provider: "CLOUDFLARE_WORKERS_AI", model: "fast-test"
      })
    });
    assert.equal(result.inferencePath, "FAST_LLM_FALLBACK");
    assert.deepEqual(result.secondaryEmotions, ["tired", "stressed"]);
  });
}

test("Fast Llama failure preserves selected mood and never blocks Daily Grow", async () => {
  const result = await classifyEmotion("I am exhausted", {
    env,
    userSelectedMood: "happy",
    localClassifier: async () => { throw new Error("offline"); },
    fastClassifier: async () => { throw Object.assign(new Error("offline"), { code: "WORKER_TIMEOUT" }); }
  });
  assert.equal(result.label, "happy");
  assert.equal(result.inferencePath, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(result.secondaryEmotions, []);
  assert.equal(result.confidence, null);
});
