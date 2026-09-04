import test from "node:test";
import assert from "node:assert/strict";

import worker from "../../cloudflare-worker/src/index.js";

const endpoint = "https://petalpal-emotion-ai.example.workers.dev/v1/emotion";

test("emotion Worker rejects callers without the shared secret", async () => {
  const response = await worker.fetch(
    new Request(endpoint, {
      method: "POST",
      body: JSON.stringify({ text: "hello" })
    }),
    { RENDER_SHARED_SECRET: "secret" }
  );

  assert.equal(response.status, 401);
});

test("emotion Worker returns a legacy primary fallback plus 21-label secondary emotions", async () => {
  let receivedInput;
  const response = await worker.fetch(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret"
      },
      body: JSON.stringify({ text: "I am excited about today" })
    }),
    {
      RENDER_SHARED_SECRET: "secret",
      AI: {
        run: async (_model, input) => {
          receivedInput = input;
          return {
            response: {
              label: "happy",
              secondaryEmotions: ["gratitude", "love"],
              intensity: 0.77,
              confidence: 0.88
            }
          };
        }
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(receivedInput.response_format.type, "json_schema");
  assert.deepEqual(await response.json(), {
    label: "happy",
    secondaryEmotions: ["gratitude", "love"],
    intensity: 0.77,
    confidence: 0.88,
    model: "@cf/meta/llama-3.1-8b-instruct-fast"
  });
  assert.ok(receivedInput.response_format.json_schema.properties.secondaryEmotions.items.enum.includes("remorse"));
});

for (const { name, response, expectedCode } of [
  {
    name: "AI inference failure",
    response: () => { throw new Error("provider detail"); },
    expectedCode: "AI_RUN_FAILED"
  },
  {
    name: "invalid JSON",
    response: () => ({ response: "not-json" }),
    expectedCode: "JSON_PARSE_FAILED"
  },
  {
    name: "schema validation failure",
    response: () => ({ response: { privateOutput: "must-not-log" } }),
    expectedCode: "SCHEMA_VALIDATION_FAILED"
  }
]) {
  test(`emotion Worker reports sanitized ${name}`, async (t) => {
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args));

    const result = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret"
        },
        body: JSON.stringify({ text: "private journal must-not-log" })
      }),
      {
        RENDER_SHARED_SECRET: "secret",
        AI: { run: response }
      }
    );

    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), {
      error: "Emotion inference failed",
      code: expectedCode
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0].code, expectedCode);
    assert.doesNotMatch(JSON.stringify(logs), /private journal|must-not-log|secret|provider detail/);
  });
}
