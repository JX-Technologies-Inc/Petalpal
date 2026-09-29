import assert from "node:assert/strict";
import test from "node:test";
import { BenchmarkCloudflareBge, compareQueries } from "../../scripts/benchmark-cloudflare-bge.js";

test("benchmark adapter sends explicit mean pooling and the production query prefix", async () => {
  const calls = [];
  const provider = new BenchmarkCloudflareBge({
    accountId: "test-account",
    apiToken: "test-token",
    fetchImpl: async (_url, options) => {
      calls.push({ body: JSON.parse(options.body), authorization: options.headers.Authorization });
      return Response.json({ success: true, result: { pooling: "mean", shape: [1, 384], data: [Array(384).fill(1 / Math.sqrt(384))] } });
    }
  });
  const vectors = await provider.embed(["summary-v1:{\"summary\":\"test\"}"], "query");
  assert.equal(vectors[0].length, 384);
  assert.equal(calls[0].body.pooling, "mean");
  assert.match(calls[0].body.text[0], /^Represent this sentence for searching relevant passages: /);
  assert.equal(calls[0].authorization, "Bearer test-token");
  assert.equal(provider.calls, 1);
});

test("benchmark adapter rejects non-finite vectors", async () => {
  const provider = new BenchmarkCloudflareBge({
    accountId: "test-account",
    apiToken: "test-token",
    fetchImpl: async () => Response.json({ success: true, result: { shape: [1, 384], data: [Array(384).fill(null)] } })
  });
  await assert.rejects(provider.embed(["test"], "document"), /invalid embedding/);
});

test("benchmark adapter counts a retry after a transient API failure", async () => {
  let attempts = 0;
  const provider = new BenchmarkCloudflareBge({
    accountId: "test-account",
    apiToken: "test-token",
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response(null, { status: 429 });
      return Response.json({ success: true, result: { shape: [1, 384], data: [Array(384).fill(0.1)] } });
    }
  });
  await provider.embed(["test"], "document");
  assert.deepEqual([provider.calls, provider.failures, provider.retries], [2, 1, 1]);
});

test("query comparison reports ranking changes by benchmark ID", () => {
  const queries = [{ queryId: "q-1", languageSlice: "paraphrase", relevantEventIds: ["e-2"] }];
  const local = new Map([["q-1", ["e-1", "e-2"]]]);
  const cloudflare = new Map([["q-1", ["e-2", "e-1"]]]);
  assert.deepEqual(compareQueries(local, cloudflare, queries).improved.map((item) => item.queryId), ["q-1"]);
});
