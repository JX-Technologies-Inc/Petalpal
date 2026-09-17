import { getEmbeddingProfile, assertProfileIsServerSide } from "./embedding-profiles.js";

export class EmbeddingProvider {
  constructor(profileKey) {
    this.profile = assertProfileIsServerSide(profileKey);
  }

  describeProfile() {
    return this.profile;
  }

  async embedDocuments(_texts, _options = {}) {
    throw new Error("EmbeddingProvider.embedDocuments must be implemented by a provider");
  }

  async embedQuery(_text, _options = {}) {
    throw new Error("EmbeddingProvider.embedQuery must be implemented by a provider");
  }

  async embedQueries(texts, options = {}) {
    if (!Array.isArray(texts)) throw new Error("Embedding queries must be an array");
    const results = [];
    for (const text of texts) results.push((await this.embedQuery(text, options)).vectors[0]);
    return makeResult(this.profile, results, texts.length, options);
  }
}

function assertFiniteVector(vector, dimensions) {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    const error = new Error("Embedding provider returned invalid vector dimensions or values");
    error.code = "INVALID_EMBEDDING_VECTOR";
    throw error;
  }
}

function makeResult(profile, vectors, count, options = {}) {
  vectors.forEach((vector) => assertFiniteVector(vector, profile.dimensions));
  if (vectors.length !== count) throw new Error("Embedding provider returned the wrong batch size");
  if (options.modelRevision && options.modelRevision !== profile.modelRevision) {
    const error = new Error("Embedding provider model revision does not match the selected profile");
    error.code = "EMBEDDING_MODEL_REVISION_MISMATCH";
    throw error;
  }
  return Object.freeze({
    vectors: vectors.map((vector) => Object.freeze([...vector])),
    dimensions: profile.dimensions,
    modelRevision: profile.modelRevision,
    usage: options.usage || null,
    cost: options.cost || null
  });
}

export class DeterministicEmbeddingProvider extends EmbeddingProvider {
  constructor(profileKey = "test-deterministic-v1", behavior = {}) {
    super(profileKey);
    this.behavior = behavior;
  }

  #check(options) {
    const failure = this.behavior.failure;
    if (failure === "timeout") {
      const error = new Error("Embedding provider timed out");
      error.code = "EMBEDDING_TIMEOUT";
      throw error;
    }
    if (failure === "429") {
      const error = new Error("Embedding provider rate limited the request");
      error.code = "EMBEDDING_RATE_LIMITED";
      throw error;
    }
    if (failure === "5xx") {
      const error = new Error("Embedding provider failed");
      error.code = "EMBEDDING_PROVIDER_ERROR";
      throw error;
    }
    if (options.signal?.aborted) {
      const error = new Error("Embedding request was aborted");
      error.code = "EMBEDDING_ABORTED";
      throw error;
    }
  }

  #vector(text, index) {
    if (this.behavior.invalid === "NaN") return [NaN, ...Array(this.profile.dimensions - 1).fill(0)];
    if (this.behavior.invalid === "Infinity") return [Infinity, ...Array(this.profile.dimensions - 1).fill(0)];
    if (this.behavior.invalid === "wrong-dimensions") return [index, 0];
    const seed = [...String(text)].reduce((sum, character) => sum + character.codePointAt(0), index);
    return Array.from({ length: this.profile.dimensions }, (_, offset) => ((seed + offset) % 997) / 997);
  }

  async embedDocuments(texts, options = {}) {
    if (!Array.isArray(texts)) throw new Error("Embedding documents must be an array");
    this.#check(options);
    const vectors = texts.map((text, index) => this.#vector(text, index));
    return makeResult(this.profile, vectors, texts.length, {
      ...options,
      modelRevision: this.behavior.modelRevision || this.profile.modelRevision,
      usage: { inputCount: texts.length }
    });
  }

  async embedQuery(text, options = {}) {
    this.#check(options);
    const result = await this.embedDocuments([text], options);
    return Object.freeze({ ...result, vectors: Object.freeze([result.vectors[0]]) });
  }
}

export class TransformersJsEmbeddingProvider extends EmbeddingProvider {
  constructor(profileKey, { pipelineFactory = null } = {}) {
    super(profileKey);
    if (this.profile.provider !== "TRANSFORMERS_JS_LOCAL") {
      throw new Error("TransformersJsEmbeddingProvider requires a local Transformers.js profile");
    }
    this.pipelineFactory = pipelineFactory;
    this.extractorPromise = null;
  }

  async initialize() {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const factory = this.pipelineFactory || (await import("@huggingface/transformers")).pipeline;
        return factory("feature-extraction", this.profile.model, {
          dtype: this.profile.dtype,
          revision: this.profile.modelRevision
        });
      })();
    }
    return this.extractorPromise;
  }

  #format(text, role) {
    const normalized = String(text).slice(0, this.profile.maximumInputCharacters);
    return `${role === "query" ? this.profile.queryPrefix : this.profile.documentPrefix}${normalized}`;
  }

  async #encode(texts, role, options = {}) {
    if (!Array.isArray(texts)) throw new Error(`Embedding ${role}s must be an array`);
    if (options.signal?.aborted) {
      const error = new Error("Embedding request was aborted");
      error.code = "EMBEDDING_ABORTED";
      throw error;
    }
    if (!texts.length) return makeResult(this.profile, [], 0, options);
    const extractor = await this.initialize();
    const formatted = texts.map((text) => this.#format(text, role));
    const output = await extractor(formatted, { pooling: "mean", normalize: true });
    const flat = Array.from(output.data);
    const vectors = formatted.map((_, index) => flat.slice(index * this.profile.dimensions, (index + 1) * this.profile.dimensions));
    return makeResult(this.profile, vectors, texts.length, {
      ...options,
      modelRevision: this.profile.modelRevision,
      usage: { inputCount: texts.length, inputCharacters: formatted.reduce((sum, text) => sum + text.length, 0) },
      cost: { apiCostUsd: 0, basis: "local-inference" }
    });
  }

  async embedDocuments(texts, options = {}) {
    return this.#encode(texts, "document", options);
  }

  async embedQueries(texts, options = {}) {
    return this.#encode(texts, "query", options);
  }

  async embedQuery(text, options = {}) {
    const result = await this.embedQueries([text], options);
    return Object.freeze({ ...result, vectors: Object.freeze([result.vectors[0]]) });
  }
}

export function resolveEmbeddingProfile(profileKey) {
  return getEmbeddingProfile(profileKey);
}
