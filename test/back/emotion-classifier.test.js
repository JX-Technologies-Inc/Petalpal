import test from "node:test";
import assert from "node:assert/strict";

import { classifyEmotion, classifyWithCloudflare } from "../../lib/emotion-classifier.js";

const env = {
  CLOUDFLARE_WORKER_AI_URL: "https://emotion.example.workers.dev/",
  CLOUDFLARE_WORKER_AI_TOKEN: "shared-secret",
  AI_REQUEST_TIMEOUT_MS: "100"
};

test("classifyWithCloudflare sends the secret and validates structured output", async () => {
  const result = await classifyWithCloudflare("I had a wonderful day", {
    env,
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://emotion.example.workers.dev/v1/emotion");
      assert.equal(options.headers.Authorization, "Bearer shared-secret");
      assert.deepEqual(JSON.parse(options.body), { text: "I had a wonderful day" });
      return Response.json({
        label: "happy",
        confidence: 0.91,
        model: "test-model"
      });
    }
  });

  assert.deepEqual(result, {
    label: "happy",
    confidence: 0.91,
    provider: "CLOUDFLARE_WORKERS_AI",
    model: "test-model"
  });
});

test("classifyEmotion falls back to the local classifier when the Worker fails", async () => {
  const result = await classifyEmotion("A quiet day", {
    env,
    fetchImpl: async () => Response.json({ error: "offline" }, { status: 503 }),
    localPredictor: async () => "calm"
  });

  assert.equal(result.label, "calm");
  assert.equal(result.provider, "LOCAL");
  assert.equal(result.model, "natural-mood-classifier");
  assert.equal(result.errorCode, "WORKER_HTTP_503");
});

test("classifyEmotion uses a deterministic final fallback", async () => {
  const result = await classifyEmotion("I feel exhausted and drained", {
    env: {},
    localPredictor: async () => {
      throw new Error("model unavailable");
    }
  });

  assert.equal(result.label, "tired");
  assert.equal(result.provider, "DETERMINISTIC");
  assert.equal(result.errorCode, "WORKER_NOT_CONFIGURED_LOCAL_FAILED");
});
