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

test("emotion Worker returns a validated PetalPal mood", async () => {
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
          return { response: { label: "happy", confidence: 0.88 } };
        }
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(receivedInput.response_format.type, "json_schema");
  assert.deepEqual(await response.json(), {
    label: "happy",
    confidence: 0.88,
    model: "@cf/meta/llama-3.1-8b-instruct-fast"
  });
});
