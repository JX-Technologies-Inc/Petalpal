import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { TransformersJsEmbeddingProvider } from "../lib/embedding-provider.js";
import { buildEmbeddingInput } from "../lib/embedding-input.js";
import { getEmbeddingProfile, PRODUCTION_EMBEDDING_PROFILE_KEY } from "../lib/embedding-profiles.js";
import {
  ENGLISH_ONLY_SLICES,
  auditGoldFixture,
  loadGoldFixture,
  meanReciprocalRank,
  recallAtK,
  splitFixture
} from "./benchmark-semantic-retrieval.js";

const MODEL = "@cf/baai/bge-small-en-v1.5";
const BATCH_SIZE = 32;
const PROFILE = getEmbeddingProfile(PRODUCTION_EMBEDDING_PROFILE_KEY);
const PRICE_PER_MILLION_TOKENS_USD = 0.020;

function assertVectors(vectors, count) {
  if (!Array.isArray(vectors) || vectors.length !== count || vectors.some((vector) =>
    !Array.isArray(vector) || vector.length !== PROFILE.dimensions ||
    vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
  )) throw new Error("Cloudflare returned invalid embedding dimensions, batch size, or values");
  return vectors;
}

export class BenchmarkCloudflareBge {
  constructor({ accountId, apiToken, fetchImpl = fetch }) {
    if (!accountId || !apiToken) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
    this.url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
    this.apiToken = apiToken;
    this.fetchImpl = fetchImpl;
    this.calls = 0;
    this.failures = 0;
    this.retries = 0;
  }

  async embed(texts, role) {
    const prefix = role === "query" ? PROFILE.queryPrefix : PROFILE.documentPrefix;
    const formatted = texts.map((text) => `${prefix}${String(text).slice(0, PROFILE.maximumInputCharacters)}`);
    const vectors = [];
    for (let offset = 0; offset < formatted.length; offset += BATCH_SIZE) {
      const batch = formatted.slice(offset, offset + BATCH_SIZE);
      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        this.calls += 1;
        try {
          response = await this.fetchImpl(this.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: batch, pooling: "mean" }),
            signal: AbortSignal.timeout(30_000)
          });
        } catch {
          this.failures += 1;
          if (attempt === 0) { this.retries += 1; continue; }
          throw new Error("Cloudflare embedding request failed");
        }
        if (response.ok) break;
        this.failures += 1;
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          this.retries += 1;
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw new Error(`Cloudflare embedding HTTP ${response.status}`);
      }
      const body = await response.json();
      if (body.success !== true || !body.result) throw new Error("Cloudflare embedding response was unsuccessful");
      if (body.result.pooling && body.result.pooling !== "mean") throw new Error("Cloudflare returned unexpected pooling");
      const rows = assertVectors(body.result.data, batch.length);
      if (body.result.shape && (body.result.shape[0] !== batch.length || body.result.shape[1] !== PROFILE.dimensions)) {
        throw new Error("Cloudflare returned unexpected embedding shape");
      }
      vectors.push(...rows);
    }
    return vectors;
  }
}

function cosine(left, right) {
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function vectorNorms(vectors) {
  const norms = vectors.map((vector) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)));
  return { min: Math.min(...norms), max: Math.max(...norms) };
}

function rank(events, queries, documentVectors, queryVectors) {
  const results = new Map();
  for (let q = 0; q < queries.length; q += 1) {
    const candidates = events.flatMap((event, i) => event.ownerId === queries[q].ownerId
      ? [{ id: event.eventId, score: cosine(documentVectors[i], queryVectors[q]) }] : []);
    candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    results.set(queries[q].queryId, candidates.slice(0, 10).map((item) => item.id));
  }
  return results;
}

function metrics(results, queries) {
  return {
    recallAt1: recallAtK(results, queries, 1),
    recallAt3: recallAtK(results, queries, 3),
    recallAt5: recallAtK(results, queries, 5),
    recallAt10: recallAtK(results, queries, 10),
    mrr: meanReciprocalRank(results, queries)
  };
}

function relevantRank(ids, query) {
  const relevant = new Set(query.relevantEventIds);
  const index = ids.findIndex((id) => relevant.has(id));
  return index < 0 ? null : index + 1;
}

export function compareQueries(local, cloudflare, queries) {
  const improved = [], regressed = [], mixed = [], top1Changed = [], majorRankChanges = [];
  for (const query of queries) {
    const localIds = local.get(query.queryId), cloudflareIds = cloudflare.get(query.queryId);
    const localRank = relevantRank(localIds, query), cloudflareRank = relevantRank(cloudflareIds, query);
    if (localIds[0] !== cloudflareIds[0]) top1Changed.push(query.queryId);
    if (!query.relevantEventIds.length) continue;
    const reciprocalRankDelta = (cloudflareRank ? 1 / cloudflareRank : 0) - (localRank ? 1 / localRank : 0);
    const relevant = new Set(query.relevantEventIds);
    const hitsAt5 = (ids) => ids.slice(0, 5).filter((id) => relevant.has(id)).length / relevant.size;
    const recallAt5Delta = hitsAt5(cloudflareIds) - hitsAt5(localIds);
    const item = { queryId: query.queryId, slice: query.languageSlice, localRank, cloudflareRank, recallAt5Delta };
    if (reciprocalRankDelta >= 0 && recallAt5Delta >= 0 && (reciprocalRankDelta > 0 || recallAt5Delta > 0)) improved.push(item);
    if (reciprocalRankDelta <= 0 && recallAt5Delta <= 0 && (reciprocalRankDelta < 0 || recallAt5Delta < 0)) regressed.push(item);
    if (reciprocalRankDelta * recallAt5Delta < 0) mixed.push(item);
    if ((localRank ?? 11) - (cloudflareRank ?? 11) >= 3 || (cloudflareRank ?? 11) - (localRank ?? 11) >= 3) majorRankChanges.push(item);
  }
  return { improved, regressed, mixed, top1Changed, majorRankChanges };
}

async function main() {
  const productionQuery = process.argv.includes("--production-query");
  const fixture = await loadGoldFixture();
  const audit = auditGoldFixture(fixture);
  if (audit.status !== "PASS" || audit.scope !== "english-only") throw new Error("English dev gold audit failed");
  const queries = splitFixture(fixture).dev.filter((query) => ENGLISH_ONLY_SLICES.includes(query.languageSlice));
  const families = new Set(queries.map((query) => query.scenarioFamily));
  const events = fixture.events.filter((event) => event.language === "en" && families.has(event.scenarioFamily));
  const documents = events.map((event) => buildEmbeddingInput({ ...event, sourceType: "EVENT", sourceEventId: event.eventId }, "summary-v1").canonicalText);
  const queryTexts = queries.map((query) => productionQuery
    ? query.query.trim()
    : buildEmbeddingInput({ sourceType: "EVENT", sourceEventId: "query", summary: query.query }, "summary-v1").canonicalText);
  const local = new TransformersJsEmbeddingProvider(PRODUCTION_EMBEDDING_PROFILE_KEY);
  const localStart = performance.now();
  const localDocs = (await local.embedDocuments(documents)).vectors;
  const localQueries = (await local.embedQueries(queryTexts)).vectors;
  const localResults = rank(events, queries, localDocs, localQueries);
  const localTimeMs = performance.now() - localStart;
  const localSummary = { metrics: metrics(localResults, queries), wallClockMs: Math.round(localTimeMs), norms: vectorNorms([...localDocs, ...localQueries]) };
  if (process.argv.includes("--local-only")) {
    console.log(JSON.stringify({ queryPreprocessing: productionQuery ? "trimmed-raw" : "benchmark-canonical", queryCount: queries.length, documentCount: events.length, noAnswerCount: queries.filter((q) => !q.relevantEventIds.length).length, local: localSummary }, null, 2));
    return;
  }

  const cloudflare = new BenchmarkCloudflareBge({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, apiToken: process.env.CLOUDFLARE_API_TOKEN });
  const cloudflareStart = performance.now();
  const cloudflareDocs = await cloudflare.embed(documents, "document");
  const cloudflareQueries = await cloudflare.embed(queryTexts, "query");
  const cloudflareResults = rank(events, queries, cloudflareDocs, cloudflareQueries);
  const cloudflareTimeMs = performance.now() - cloudflareStart;
  const approximateTokens = Math.ceil((documents.reduce((sum, value) => sum + value.length + PROFILE.documentPrefix.length, 0) +
    queryTexts.reduce((sum, value) => sum + value.length + PROFILE.queryPrefix.length, 0)) / 4);
  console.log(JSON.stringify({
    queryPreprocessing: productionQuery ? "trimmed-raw" : "benchmark-canonical",
    queryCount: queries.length,
    documentCount: events.length,
    noAnswerCount: queries.filter((q) => !q.relevantEventIds.length).length,
    local: localSummary,
    cloudflare: {
      metrics: metrics(cloudflareResults, queries),
      wallClockMs: Math.round(cloudflareTimeMs),
      norms: vectorNorms([...cloudflareDocs, ...cloudflareQueries]),
      calls: cloudflare.calls, failures: cloudflare.failures, retries: cloudflare.retries,
      approximateTokens,
      approximateCostUsd: approximateTokens * PRICE_PER_MILLION_TOKENS_USD / 1_000_000
    },
    queryDifferences: compareQueries(localResults, cloudflareResults, queries)
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
