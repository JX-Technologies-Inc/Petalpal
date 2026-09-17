import { performance } from "node:perf_hooks";
import { TransformersJsEmbeddingProvider } from "../lib/embedding-provider.js";
import { buildEmbeddingInput } from "../lib/embedding-input.js";
import {
  ENGLISH_ONLY_SLICES,
  auditGoldFixture,
  keywordRetrieve,
  loadGoldFixture,
  meanReciprocalRank,
  recallAtK,
  runBenchmark,
  splitFixture
} from "./benchmark-semantic-retrieval.js";

const CANDIDATE_PROFILE_KEYS = Object.freeze([
  "eval-all-minilm-l6-v2",
  "eval-bge-small-en-v1.5",
  "eval-e5-small-v2"
]);
const INPUT_VERSIONS = Object.freeze(["summary-v1", "structured-v1"]);
const englishSlices = new Set(ENGLISH_ONLY_SLICES);

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

function metricSummary(results, queries) {
  return {
    recallAt1: recallAtK(results, queries, 1),
    recallAt3: recallAtK(results, queries, 3),
    recallAt5: recallAtK(results, queries, 5),
    recallAt10: recallAtK(results, queries, 10),
    mrr: meanReciprocalRank(results, queries)
  };
}

function sliceMetrics(results, queries) {
  return Object.fromEntries([...new Set(queries.map((query) => query.languageSlice))].sort().map((slice) => {
    const scopedQueries = queries.filter((query) => query.languageSlice === slice);
    const scopedResults = new Map(scopedQueries.map((query) => [query.queryId, results.get(query.queryId)]));
    return [slice, { queryCount: scopedQueries.length, ...metricSummary(scopedResults, scopedQueries) }];
  }));
}

function compareSlices(candidateSlices, baselineSlices) {
  const regressions = [];
  for (const [slice, candidate] of Object.entries(candidateSlices)) {
    const baseline = baselineSlices[slice];
    if (!baseline || candidate.recallAt5 === null || baseline.recallAt5 === null) continue;
    if (candidate.recallAt5 < baseline.recallAt5 || candidate.mrr < baseline.mrr) {
      regressions.push({
        slice,
        recallAt5Delta: candidate.recallAt5 - baseline.recallAt5,
        mrrDelta: candidate.mrr - baseline.mrr
      });
    }
  }
  return regressions;
}

async function evaluateConfiguration({ provider, events, queries, inputVersion, baseline }) {
  const documentInputs = events.map((event) => buildEmbeddingInput({ ...event, sourceType: "EVENT", sourceEventId: event.eventId }, inputVersion).canonicalText);
  const queryInputs = queries.map((query) => buildEmbeddingInput({ sourceType: "EVENT", sourceEventId: "query", summary: query.query, topics: [], people: [] }, inputVersion).canonicalText);

  const documentStarted = performance.now();
  const documentResult = await provider.embedDocuments(documentInputs);
  const documentEmbeddingMs = performance.now() - documentStarted;
  const queryStarted = performance.now();
  const queryResult = await provider.embedQueries(queryInputs);
  const queryEmbeddingMs = performance.now() - queryStarted;

  const rankingStarted = performance.now();
  const results = new Map();
  for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    const query = queries[queryIndex];
    const ranked = events
      .map((event, eventIndex) => ({ event, eventIndex }))
      .filter(({ event }) => event.ownerId === query.ownerId)
      .map(({ event, eventIndex }) => ({ id: event.eventId, score: cosine(documentResult.vectors[eventIndex], queryResult.vectors[queryIndex]) }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, 10)
      .map((item) => item.id);
    results.set(query.queryId, ranked);
  }
  const rankingMs = performance.now() - rankingStarted;
  const overall = metricSummary(results, queries);
  const slices = sliceMetrics(results, queries);
  return {
    inputVersion,
    overall,
    sliceMetrics: slices,
    sliceRegressionsVsKeyword: compareSlices(slices, baseline.sliceMetrics),
    latencyMs: {
      documentEmbedding: Math.round(documentEmbeddingMs),
      queryEmbedding: Math.round(queryEmbeddingMs),
      ranking: Math.round(rankingMs),
      total: Math.round(documentEmbeddingMs + queryEmbeddingMs + rankingMs),
      perQueryWarm: Number(((queryEmbeddingMs + rankingMs) / queries.length).toFixed(2))
    }
  };
}

const fixture = await loadGoldFixture();
const audit = auditGoldFixture(fixture);
if (audit.status !== "PASS" || audit.scope !== "english-only") throw new Error("English-only dev gold audit must pass before candidate benchmarking");
const queries = splitFixture(fixture).dev.filter((query) => englishSlices.has(query.languageSlice));
const devFamilies = new Set(queries.map((query) => query.scenarioFamily));
const events = fixture.events.filter((event) => event.language === "en" && devFamilies.has(event.scenarioFamily));
const baseline = await runBenchmark({ fixture, strategy: "keyword", split: "dev", k: 10 });

const candidates = [];
for (const profileKey of CANDIDATE_PROFILE_KEYS) {
  const provider = new TransformersJsEmbeddingProvider(profileKey);
  const loadStarted = performance.now();
  await provider.initialize();
  const modelLoadMs = performance.now() - loadStarted;
  const warmupStarted = performance.now();
  await provider.embedQuery("PetalPal embedding benchmark warmup");
  const warmupMs = performance.now() - warmupStarted;
  const configurations = [];
  for (const inputVersion of INPUT_VERSIONS) {
    configurations.push(await evaluateConfiguration({ provider, events, queries, inputVersion, baseline }));
  }
  candidates.push({
    profileKey,
    model: provider.profile.model,
    modelRevision: provider.profile.modelRevision,
    dtype: provider.profile.dtype,
    dimensions: provider.profile.dimensions,
    metric: provider.profile.metric,
    cost: { apiCostUsd: 0, infrastructure: "local CPU time; not separately priced" },
    deploymentPracticality: "Node.js + Transformers.js ONNX q8; no external API or per-call fee; model assets require deployment caching",
    modelLoadMs: Math.round(modelLoadMs),
    warmupMs: Math.round(warmupMs),
    configurations
  });
}

console.log(JSON.stringify({
  benchmarkVersion: fixture.benchmarkVersion,
  scope: "english-only-dev",
  heldOutUsed: false,
  multilingualUsed: false,
  queryCount: queries.length,
  eventCount: events.length,
  candidateProfileKeys: CANDIDATE_PROFILE_KEYS,
  inputVersions: INPUT_VERSIONS,
  baseline: {
    strategy: "keyword",
    overall: baseline.overall,
    sliceMetrics: baseline.sliceMetrics,
    latencyMs: baseline.latencyMs
  },
  candidates
}, null, 2));
