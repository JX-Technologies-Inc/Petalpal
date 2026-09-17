import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeterministicEmbeddingProvider } from "../lib/embedding-provider.js";
import { buildEmbeddingInput } from "../lib/embedding-input.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedSlices = new Set(["en-en", "zh-zh", "en-zh", "zh-en", "code-switch", "paraphrase", "hard-negative", "proper-noun", "short-vague", "no-answer", "multi-plausible", "cross-owner"]);
export const ENGLISH_ONLY_SLICES = Object.freeze(["en-en", "paraphrase", "hard-negative", "proper-noun", "short-vague", "no-answer", "multi-plausible", "cross-owner"]);
const englishOnlySliceSet = new Set(ENGLISH_ONLY_SLICES);

export async function loadGoldFixture(fixturePath = path.join(root, "test/fixtures/semantic-retrieval-gold.json")) {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

export function validateGoldFixture(fixture) {
  if (!fixture || fixture.benchmarkVersion !== "semantic-retrieval-gold-v1") throw new Error("Unsupported benchmark fixture");
  const events = fixture.events || [], queries = fixture.queries || [];
  const eventIds = new Set();
  for (const event of events) {
    if (!event.eventId || eventIds.has(event.eventId)) throw new Error("Duplicate or missing Event ID");
    if (event.sourceType !== "EVENT" || !event.ownerId || !event.scenarioFamily) throw new Error("Invalid Event provenance or owner");
    if (event.kind === "JOURNAL" || event.sourceType === "JOURNAL" || event.sourceType === "LEGACY_EVENT_ALIAS") throw new Error("Journal/legacy source in gold fixture");
    eventIds.add(event.eventId);
  }
  const queryIds = new Set();
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  for (const query of queries) {
    if (!query.queryId || queryIds.has(query.queryId)) throw new Error("Duplicate or missing query ID");
    if (typeof query.query !== "string" || !query.query.trim()) throw new Error("Empty query");
    if (!allowedSlices.has(query.languageSlice) || !/^family-\d{2}$/.test(query.scenarioFamily)) throw new Error("Invalid query slice or family");
    if (!Array.isArray(query.relevantEventIds) || new Set(query.relevantEventIds).size !== query.relevantEventIds.length) throw new Error("Duplicate relevance ID");
    for (const id of query.relevantEventIds) {
      if (!eventIds.has(id)) throw new Error("Orphan relevance ID");
      const event = eventById.get(id);
      if (event.ownerId !== query.ownerId) throw new Error("Cross-owner relevance leakage");
      if (event.scenarioFamily !== query.scenarioFamily) throw new Error("Cross-family relevance leakage");
    }
    queryIds.add(query.queryId);
  }
  return fixture;
}

function normalizeAuditText(value) {
  return String(value).normalize("NFC").toLocaleLowerCase();
}

function eventMatchesGoldCriteria(event, query, criteria) {
  if (event.language !== "en" || event.ownerId !== query.ownerId || event.scenarioFamily !== query.scenarioFamily) return false;
  const eventIds = new Set(criteria.eventIds || []);
  if (eventIds.size && !eventIds.has(event.eventId)) return false;
  const topics = new Set(event.topics || []);
  const people = new Set(event.people || []);
  if (!(criteria.topicsAll || []).every((topic) => topics.has(topic))) return false;
  if ((criteria.topicsNone || []).some((topic) => topics.has(topic))) return false;
  if ((criteria.peopleAny || []).length && !(criteria.peopleAny || []).some((person) => people.has(person))) return false;
  return true;
}

export function auditGoldFixture(fixture, { split = "dev", sampleLimit = 20 } = {}) {
  validateGoldFixture(fixture);
  if (split !== "dev") throw new Error("Gold label auditing is dev-only until the held-out evaluation is explicitly opened");
  const allDevQueries = splitFixture(fixture).dev;
  const queries = allDevQueries.filter((query) => englishOnlySliceSet.has(query.languageSlice));
  const excludedQueries = allDevQueries.filter((query) => !englishOnlySliceSet.has(query.languageSlice));
  const issues = [];
  let unresolvedCount = 0;
  let positiveEdgeCount = 0;
  for (const query of queries) {
    positiveEdgeCount += query.relevantEventIds.length;
    const criteria = query.goldCriteria;
    if (!criteria || !Array.isArray(criteria.queryCues) || !Number.isInteger(criteria.expectedCount) || typeof criteria.rationale !== "string" || !criteria.rationale.trim()) {
      unresolvedCount += 1;
      issues.push({ queryId: query.queryId, languageSlice: query.languageSlice, category: "UNRESOLVED_MISSING_OBJECTIVE_CRITERIA" });
      continue;
    }
    const missingQueryCues = criteria.queryCues.filter((cue) => !normalizeAuditText(query.query).includes(normalizeAuditText(cue)));
    if (missingQueryCues.length) {
      issues.push({ queryId: query.queryId, languageSlice: query.languageSlice, category: "QUERY_CRITERIA_DRIFT", missingQueryCues });
    }
    const expectedIds = fixture.events
      .filter((event) => eventMatchesGoldCriteria(event, query, criteria))
      .map((event) => event.eventId)
      .sort();
    if (expectedIds.length !== criteria.expectedCount) {
      issues.push({ queryId: query.queryId, languageSlice: query.languageSlice, category: "CRITERIA_CARDINALITY_MISMATCH", expectedCount: criteria.expectedCount, actualCount: expectedIds.length });
    }
    const actualIds = [...query.relevantEventIds].sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
      issues.push({ queryId: query.queryId, languageSlice: query.languageSlice, category: "LABEL_MAPPING_MISMATCH", expectedIds, actualIds });
    }
    const gradedIds = Object.keys(query.gradedRelevance || {}).sort();
    if (JSON.stringify(gradedIds) !== JSON.stringify(actualIds)) {
      issues.push({ queryId: query.queryId, languageSlice: query.languageSlice, category: "GRADED_RELEVANCE_MISMATCH" });
    }
  }
  const issuesBySlice = Object.fromEntries(
    [...new Set(issues.map((issue) => issue.languageSlice))].sort().map((slice) => [slice, issues.filter((issue) => issue.languageSlice === slice).length])
  );
  return Object.freeze({
    benchmarkVersion: fixture.benchmarkVersion,
    fixtureHash: createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),
    auditVersion: "dev-objective-criteria-audit-v2",
    scope: "english-only",
    status: issues.length || unresolvedCount ? "INVALID" : "PASS",
    split,
    queryCount: queries.length,
    positiveEdgeCount,
    unresolvedCount,
    issueCount: issues.length,
    issuesBySlice,
    scenarioFamilyLeakageCount: 0,
    crossOwnerLeakageCount: 0,
    heldOutFamiliesAudited: false,
    excludedQueryCount: excludedQueries.length,
    excludedSliceCounts: Object.fromEntries(
      [...new Set(excludedQueries.map((query) => query.languageSlice))].sort().map((slice) => [slice, excludedQueries.filter((query) => query.languageSlice === slice).length])
    ),
    sampleIssues: issues.slice(0, sampleLimit)
  });
}

export function splitFixture(fixture) {
  const heldOut = new Set(fixture.split.heldOutFamilies);
  return {
    dev: fixture.queries.filter((query) => !heldOut.has(query.scenarioFamily)),
    heldOut: fixture.queries.filter((query) => heldOut.has(query.scenarioFamily))
  };
}

function tokens(text) { return String(text).toLocaleLowerCase().normalize("NFC").match(/[\p{L}\p{N}]+/gu) || []; }
export function keywordRetrieve(events, query, k = 10) {
  const q = new Set(tokens(query.query));
  return events.filter((event) => event.ownerId === query.ownerId).map((event) => {
    const fields = [event.summary, ...(event.topics || []), ...(event.people || [])].join(" ");
    const score = tokens(fields).filter((token) => q.has(token)).length;
    return { id: event.eventId, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k).map((item) => item.id);
}

function cosine(a, b) { const dot=a.reduce((sum,v,i)=>sum+v*b[i],0), na=Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)), nb=Math.sqrt(b.reduce((sum,v)=>sum+v*v,0)); return na && nb ? dot/(na*nb) : 0; }
export async function exactVectorRetrieve(events, query, k = 10, inputVersion = "structured-v1") {
  const provider = new DeterministicEmbeddingProvider();
  const documents = events.filter((event) => event.ownerId === query.ownerId);
  const inputs = documents.map((event) => buildEmbeddingInput({ ...event, sourceType: "EVENT", sourceEventId: event.eventId }, inputVersion).canonicalText);
  const queryText = buildEmbeddingInput({ sourceType: "EVENT", sourceEventId: "query", summary: query.query, topics: [], people: [] }, inputVersion).canonicalText;
  const [docResult, queryResult] = await Promise.all([provider.embedDocuments(inputs), provider.embedQuery(queryText)]);
  return documents.map((event, i) => ({ id: event.eventId, score: cosine(docResult.vectors[i], queryResult.vectors[0]) }))
    .sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id)).slice(0,k).map((item)=>item.id);
}

export function recallAtK(results, queries, k) {
  const answered = queries.filter((query) => query.relevantEventIds.length > 0);
  if (!answered.length) return null;
  return answered.reduce((sum, query) => {
    const relevant = new Set(query.relevantEventIds);
    const hits = results.get(query.queryId).slice(0, k).filter((id) => relevant.has(id)).length;
    return sum + hits / query.relevantEventIds.length;
  }, 0) / answered.length;
}

export function meanReciprocalRank(results, queries) {
  const answered = queries.filter((query) => query.relevantEventIds.length > 0);
  if (!answered.length) return null;
  return answered.reduce((sum, query) => { const relevant=new Set(query.relevantEventIds), rank=results.get(query.queryId).findIndex((id)=>relevant.has(id)); return sum+(rank<0?0:1/(rank+1)); },0)/answered.length;
}

export async function runBenchmark({ fixture, strategy = "keyword", split = "dev", k = 10, inputVersion = "structured-v1", evaluationPurpose = "development" }) {
  if (split === "held-out" && evaluationPurpose !== "final-evaluation") {
    throw new Error("Held-out queries are reserved for final evaluation and cannot be used for tuning or model selection");
  }
  validateGoldFixture(fixture); const partitions=splitFixture(fixture), queries=partitions[split === "held-out" ? "heldOut" : split].filter((query) => englishOnlySliceSet.has(query.languageSlice));
  const candidateEvents = fixture.events.filter((event) => event.language === "en");
  const results=new Map(); const started=Date.now();
  for (const query of queries) results.set(query.queryId, strategy === "keyword" ? keywordRetrieve(candidateEvents, query, k) : await exactVectorRetrieve(candidateEvents, query, k, inputVersion));
  const noAnswer=queries.filter((query)=>query.relevantEventIds.length===0);
  const sliceMetrics = Object.fromEntries([...new Set(queries.map((query) => query.languageSlice))].sort().map((slice) => {
    const sliceQueries = queries.filter((query) => query.languageSlice === slice);
    const sliceResults = new Map(sliceQueries.map((query) => [query.queryId, results.get(query.queryId)]));
    return [slice, { queryCount: sliceQueries.length, noAnswerCount: sliceQueries.filter((query) => !query.relevantEventIds.length).length, recallAt5: recallAtK(sliceResults, sliceQueries, 5), mrr: meanReciprocalRank(sliceResults, sliceQueries) }];
  }));
  const goldAudit = split === "dev" ? auditGoldFixture(fixture, { split }) : null;
  const note = goldAudit?.status === "INVALID"
    ? "MODEL SELECTION BLOCKED — DEV GOLD LABEL AUDIT FAILED"
    : "INFRASTRUCTURE VALIDATION ONLY — NOT MODEL QUALITY EVIDENCE";
  const summary={benchmarkVersion:fixture.benchmarkVersion,fixtureHash:createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),scope:"english-only",strategy,inputVersion,split,k,overall:{recallAt1:recallAtK(results,queries,1),recallAt3:recallAtK(results,queries,3),recallAt5:recallAtK(results,queries,5),recallAt10:recallAtK(results,queries,10),mrr:meanReciprocalRank(results,queries)},sliceMetrics,queryCount:queries.length,noAnswerCount:noAnswer.length,goldAudit:goldAudit?{status:goldAudit.status,positiveEdgeCount:goldAudit.positiveEdgeCount,unresolvedCount:goldAudit.unresolvedCount,issueCount:goldAudit.issueCount,issuesBySlice:goldAudit.issuesBySlice,scenarioFamilyLeakageCount:goldAudit.scenarioFamilyLeakageCount,crossOwnerLeakageCount:goldAudit.crossOwnerLeakageCount}:null,latencyMs:Date.now()-started,note};
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixture=validateGoldFixture(await loadGoldFixture());
  if (process.argv[2] === "audit") {
    console.log(JSON.stringify(auditGoldFixture(fixture), null, 2));
  } else {
    console.log(JSON.stringify(await runBenchmark({fixture,strategy:process.argv[2]||"keyword",split:process.argv[3]||"dev",evaluationPurpose:process.argv[4]||"development"}),null,2));
  }
}
