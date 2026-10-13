// MOCK providers for the isolated AI E2E suite. They make no network calls and
// cost nothing. The embedding mock maps a fixed lexical theme table onto
// orthogonal 384d basis vectors, so it exercises real pgvector storage, ordering,
// owner/window filters and provenance, but it is NOT evidence of semantic
// relevance: paraphrases only match when they share a listed keyword.
import { EmbeddingProvider } from "../../lib/embedding-provider.js";
import { TEST_EMBEDDING_384_PROFILE_KEY } from "../../lib/embedding-profiles.js";

export const MOCK_THEME_KEYWORDS = Object.freeze({
  stress: ["deadline", "overwhelmed", "pressure", "exam", "overtime", "stressed"],
  recovery: ["rested", "better", "help", "calmer", "slept"],
  cooking: ["soup", "recipe", "cooking"],
  pottery: ["pottery", "clay"]
});
const THEME_DIMENSION = Object.freeze({ stress: 0, recovery: 1, cooking: 2, pottery: 3, generic: 4 });
const NOISE_OFFSET = 8;

function tokens(text) {
  return new Set(String(text || "").toLowerCase().split(/[^a-z]+/).filter(Boolean));
}

export function mockThemes(text) {
  const words = tokens(text);
  const themes = Object.keys(MOCK_THEME_KEYWORDS).filter((theme) => MOCK_THEME_KEYWORDS[theme].some((word) => words.has(word)));
  return themes.length ? themes : ["generic"];
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function mockThemeVector(text, dimensions = 384) {
  const vector = new Array(dimensions).fill(0);
  for (const theme of mockThemes(text)) vector[THEME_DIMENSION[theme]] = 1;
  // Small, text-stable component so distinct texts never tie exactly.
  vector[NOISE_OFFSET + (fnv1a(text) % (dimensions - NOISE_OFFSET))] += 0.05;
  const norm = Math.hypot(...vector);
  return vector.map((value) => value / norm);
}

export class ThemeMockEmbeddingProvider extends EmbeddingProvider {
  constructor() {
    super(TEST_EMBEDDING_384_PROFILE_KEY);
    this.documentCalls = 0;
    this.queryCalls = 0;
  }

  #result(vectors) {
    return Object.freeze({ vectors: vectors.map((vector) => Object.freeze(vector)), dimensions: this.profile.dimensions,
      modelRevision: this.profile.modelRevision, usage: { inputCount: vectors.length }, cost: { apiCostUsd: 0, basis: "MOCK" } });
  }

  async embedDocuments(texts) {
    if (!Array.isArray(texts)) throw new Error("Embedding documents must be an array");
    this.documentCalls += texts.length;
    return this.#result(texts.map((text) => mockThemeVector(text, this.profile.dimensions)));
  }

  async embedQuery(text) {
    this.queryCalls += 1;
    return this.#result([mockThemeVector(text, this.profile.dimensions)]);
  }
}

// Template narrative: cites stress and recovery evidence it is given. It never
// sees unselected data, so it can only demonstrate the grounding/citation path.
export class TemplateMockNarrativeProvider {
  constructor() {
    this.name = "MOCK_TEMPLATE_NARRATIVE";
    this.model = "mock-template-v1";
    this.calls = 0;
    this.inputs = [];
  }

  async generateNarrative(input) {
    this.calls += 1;
    this.inputs.push(input);
    const { allowedSectionKinds: kinds, selectedEvidence, aggregates } = input.report;
    const refs = (theme) => selectedEvidence.filter((item) => mockThemes(item.summary).includes(theme))
      .map(({ sourceEventId, sourceMemoryId }) => ({ sourceEventId, sourceMemoryId }));
    const stress = refs("stress");
    const recovery = refs("recovery");
    return {
      model: this.model,
      sections: [
        { kind: kinds[0], claim: `You recorded ${aggregates.eventCount} Events in this period.`, evidenceRefs: [], aggregateRefs: ["eventCount"] },
        { kind: kinds[1], claim: "Work and study pressure appeared repeatedly.", evidenceRefs: stress, aggregateRefs: stress.length ? [] : ["topTopics"] },
        { kind: kinds[2], claim: "Later entries mention rest and asking for help.", evidenceRefs: recovery, aggregateRefs: recovery.length ? [] : ["trendSignals"] }
      ]
    };
  }
}

export class FailingMockNarrativeProvider {
  constructor() {
    this.name = "MOCK_FAILING_NARRATIVE";
    this.calls = 0;
  }

  async generateNarrative() {
    this.calls += 1;
    throw new Error("MOCK provider failure");
  }
}
