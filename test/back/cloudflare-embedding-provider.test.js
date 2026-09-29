import assert from "node:assert/strict";
import test from "node:test";
import { CloudflareWorkersEmbeddingProvider } from "../../lib/embedding-provider.js";
import { CLOUDFLARE_EMBEDDING_PROFILE_KEY } from "../../lib/embedding-profiles.js";

const vector = Array.from({ length: 384 }, (_, index) => index / 384);
const environment = { CLOUDFLARE_WORKER_AI_URL: "https://worker.example", CLOUDFLARE_WORKER_AI_TOKEN: "test-secret" };

test("Cloudflare provider preserves document/query formatting without initializing local ONNX", async () => {
  const requests = [];
  const provider = new CloudflareWorkersEmbeddingProvider(CLOUDFLARE_EMBEDDING_PROFILE_KEY, {
    env: environment,
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return Response.json({ vector, model: "@cf/baai/bge-small-en-v1.5", pooling: "mean", dimensions: 384 });
    }
  });
  const document = await provider.embedDocuments(['summary-v1:{"summary":"A synthetic walk"}']);
  const query = await provider.embedQuery("walk");
  assert.equal(document.vectors[0].length, 384);
  assert.equal(query.vectors[0].length, 384);
  assert.deepEqual(requests.map((item) => item.body), [
    { text: 'summary-v1:{"summary":"A synthetic walk"}' },
    { text: "Represent this sentence for searching relevant passages: walk" }
  ]);
  assert.ok(requests.every((item) => item.url === "https://worker.example/v1/embedding"));
  assert.ok(requests.every((item) => item.options.headers.Authorization === "Bearer test-secret"));
  assert.equal(provider.extractorPromise, undefined);
});

test("Cloudflare provider rejects wrong dimensions and classifies failures safely", async () => {
  const makeProvider = (response) => new CloudflareWorkersEmbeddingProvider(CLOUDFLARE_EMBEDDING_PROFILE_KEY, {
    env: environment, fetchImpl: async () => response
  });
  await assert.rejects(makeProvider(Response.json({ vector: [1], model: "@cf/baai/bge-small-en-v1.5", pooling: "mean", dimensions: 384 }))
    .embedDocuments(["synthetic"]), { code: "INVALID_EMBEDDING_VECTOR" });
  await assert.rejects(makeProvider(new Response(null, { status: 429 })).embedQuery("synthetic"),
    { code: "EMBEDDING_RATE_LIMITED" });
  await assert.rejects(makeProvider(new Response(null, { status: 503 })).embedQuery("synthetic"),
    { code: "EMBEDDING_PROVIDER_ERROR" });
});
