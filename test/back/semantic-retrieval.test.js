import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditGoldFixture,
  ENGLISH_ONLY_SLICES,
  exactVectorRetrieve,
  keywordRetrieve,
  loadGoldFixture,
  meanReciprocalRank,
  recallAtK,
  runBenchmark,
  splitFixture,
  validateGoldFixture
} from "../../scripts/benchmark-semantic-retrieval.js";

const fixture = await loadGoldFixture();

test("synthetic gold fixture has target scale, valid provenance, and family split", () => {
  validateGoldFixture(fixture);
  assert.equal(fixture.events.length, 300);
  assert.equal(fixture.queries.length, 180);
  const { dev, heldOut } = splitFixture(fixture);
  assert.equal(dev.length + heldOut.length, 180);
  assert.ok(dev.length > 100 && heldOut.length > 20);
  assert.equal(new Set(dev.map((q) => q.scenarioFamily)).intersection?.(new Set(heldOut.map((q) => q.scenarioFamily)))?.size || 0, 0);
  assert.ok(new Set(fixture.queries.map((q) => q.languageSlice)).size >= 8);
  const englishSlices = new Set(ENGLISH_ONLY_SLICES);
  assert.equal(dev.filter((query) => englishSlices.has(query.languageSlice)).length, 84);
  assert.equal(dev.filter((query) => !englishSlices.has(query.languageSlice)).length, 24);
});

test("dev gold labels have objective criteria, complete mappings, and no unresolved cases", () => {
  const audit = auditGoldFixture(fixture);
  assert.equal(audit.status, "PASS");
  assert.equal(audit.split, "dev");
  assert.equal(audit.scope, "english-only");
  assert.equal(audit.queryCount, 84);
  assert.equal(audit.positiveEdgeCount, 78);
  assert.equal(audit.unresolvedCount, 0);
  assert.equal(audit.issueCount, 0);
  assert.equal(audit.scenarioFamilyLeakageCount, 0);
  assert.equal(audit.crossOwnerLeakageCount, 0);
  assert.equal(audit.heldOutFamiliesAudited, false);
  assert.deepEqual(audit.excludedSliceCounts, { "code-switch": 6, "en-zh": 6, "zh-en": 6, "zh-zh": 6 });
  const eventById = new Map(fixture.events.map((event) => [event.eventId, event]));
  const englishSlices = new Set(ENGLISH_ONLY_SLICES);
  for (const query of splitFixture(fixture).dev.filter((item) => englishSlices.has(item.languageSlice))) {
    assert.ok(query.relevantEventIds.every((eventId) => eventById.get(eventId).language === "en"));
  }
});

test("multilingual dev slices remain present, unchanged in shape, and outside English audit", () => {
  const englishSlices = new Set(ENGLISH_ONLY_SLICES);
  const excluded = splitFixture(fixture).dev.filter((query) => !englishSlices.has(query.languageSlice));
  assert.equal(excluded.length, 24);
  assert.ok(excluded.every((query) => query.goldCriteria === undefined));
  const originalCrossLanguage = excluded.find((query) => query.queryId === "q-003");
  assert.equal(originalCrossLanguage.query, "What did I do about internship?");
  assert.deepEqual(originalCrossLanguage.relevantEventIds, ["evt-001"]);
  assert.equal(fixture.events.find((event) => event.eventId === "evt-003").summary, "合成career事件 3：今天完成了project练习。");
});

test("dev gold audit rejects mapping drift and incomplete multi-plausible labels", () => {
  const wrongMapping = structuredClone(fixture);
  const mappedQuery = wrongMapping.queries.find((query) => query.queryId === "q-001");
  mappedQuery.relevantEventIds = ["evt-002"];
  mappedQuery.gradedRelevance = { "evt-002": 2 };
  assert.equal(auditGoldFixture(wrongMapping).status, "INVALID");

  const incomplete = structuredClone(fixture);
  const multiQuery = incomplete.queries.find((query) => query.queryId === "q-011");
  multiQuery.relevantEventIds = multiQuery.relevantEventIds.slice(0, 1);
  multiQuery.gradedRelevance = { [multiQuery.relevantEventIds[0]]: 2 };
  const audit = auditGoldFixture(incomplete);
  assert.ok(audit.sampleIssues.some((issue) => issue.category === "LABEL_MAPPING_MISMATCH"));
});

test("gold validation rejects duplicates, orphan relevance, Journal, and cross-owner relevance", () => {
  assert.throws(() => validateGoldFixture({ ...fixture, events: [...fixture.events, fixture.events[0]] }), /Duplicate/);
  const orphan = structuredClone(fixture); orphan.queries[0].relevantEventIds = ["missing"];
  assert.throws(() => validateGoldFixture(orphan), /Orphan/);
  const journal = structuredClone(fixture); journal.events[0].sourceType = "JOURNAL";
  assert.throws(() => validateGoldFixture(journal), /provenance|owner|Journal/);
  const crossOwner = structuredClone(fixture); crossOwner.queries[0].relevantEventIds = ["evt-010"];
  assert.throws(() => validateGoldFixture(crossOwner), /Cross-owner/);
  const crossFamily = structuredClone(fixture); crossFamily.queries[0].relevantEventIds = ["evt-031"];
  assert.throws(() => validateGoldFixture(crossFamily), /Cross-family/);
  const duplicateQuery = structuredClone(fixture); duplicateQuery.queries[1].queryId = duplicateQuery.queries[0].queryId;
  assert.throws(() => validateGoldFixture(duplicateQuery), /Duplicate/);
  const empty = structuredClone(fixture); empty.queries[0].query = " ";
  assert.throws(() => validateGoldFixture(empty), /Empty/);
});

test("keyword baseline is deterministic and owner-scoped", () => {
  const query = fixture.queries.find((item) => item.languageSlice === "en-en");
  const first = keywordRetrieve(fixture.events, query, 5);
  assert.deepEqual(first, keywordRetrieve(fixture.events, query, 5));
  assert.ok(first.every((id) => fixture.events.find((event) => event.eventId === id).ownerId === query.ownerId));
});

test("exact vector retrieval is exhaustive, owner-filtered before ranking, and tie-stable", async () => {
  const query = fixture.queries.find((item) => item.ownerId === "owner-a");
  const result = await exactVectorRetrieve(fixture.events, query, 10, "summary-v1");
  assert.equal(result.length, 10);
  assert.ok(result.every((id) => fixture.events.find((event) => event.eventId === id).ownerId === query.ownerId));
  const tieEvents = [{ ...fixture.events[0], summary: "same", topics: [], people: [] }, { ...fixture.events[1], summary: "same", topics: [], people: [] }];
  const tieQuery = { ...query, query: "same" };
  assert.deepEqual(await exactVectorRetrieve(tieEvents, tieQuery, 2), ["evt-001", "evt-002"]);
  assert.deepEqual(await exactVectorRetrieve(fixture.events, query, 3, "structured-v1"), await exactVectorRetrieve(fixture.events, query, 3, "structured-v1"));
});

test("Recall@K, MRR, no-answer handling, and repeated benchmark output are deterministic", async () => {
  const queries = [{ queryId: "q1", relevantEventIds: ["a", "b"] }, { queryId: "q2", relevantEventIds: ["c"] }, { queryId: "q3", relevantEventIds: [] }];
  const results = new Map([["q1", ["x", "b", "a"]], ["q2", ["z", "c"]], ["q3", []]]);
  assert.equal(recallAtK(results, queries, 1), 0);
  assert.equal(recallAtK(results, queries, 3), 1);
  assert.equal(meanReciprocalRank(results, queries), 0.5);
  assert.equal(recallAtK(results, [queries[2]], 5), null);
  const first = await runBenchmark({ fixture, strategy: "keyword", split: "dev", k: 5 });
  const second = await runBenchmark({ fixture, strategy: "keyword", split: "dev", k: 5 });
  assert.deepEqual({ ...first, latencyMs: 0 }, { ...second, latencyMs: 0 });
  assert.match(first.note, /INFRASTRUCTURE VALIDATION ONLY/);
  assert.equal(first.goldAudit.status, "PASS");
  assert.ok(first.sliceMetrics["en-en"].queryCount > 0);
  assert.equal(first.scope, "english-only");
  assert.equal(first.queryCount, 84);
});

test("held-out benchmark cannot run under a development/model-selection purpose", async () => {
  await assert.rejects(
    runBenchmark({ fixture, strategy: "keyword", split: "held-out" }),
    /reserved for final evaluation/
  );
});

test("fixture is a JSON artifact and supports both embedding input paths", async () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/semantic-retrieval-gold.json");
  assert.ok((await readFile(file, "utf8")).length > 100_000);
  const query = fixture.queries.find((item) => item.relevantEventIds.length);
  assert.equal((await runBenchmark({ fixture, strategy: "exact-vector", inputVersion: "summary-v1", k: 3 })).inputVersion, "summary-v1");
  assert.equal((await runBenchmark({ fixture, strategy: "exact-vector", inputVersion: "structured-v1", k: 3 })).inputVersion, "structured-v1");
  assert.ok(query);
});
