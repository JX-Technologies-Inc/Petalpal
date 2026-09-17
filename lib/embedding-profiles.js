export const EMBEDDING_PROFILES = Object.freeze({
  "test-deterministic-v1": Object.freeze({
    profileKey: "test-deterministic-v1",
    environment: "TEST_ONLY",
    provider: "DETERMINISTIC_TEST_DOUBLE",
    model: "deterministic-test-embedding",
    modelRevision: "test-revision-1",
    dimensions: 8,
    metric: "cosine",
    inputVersion: "structured-v1",
    documentEncoding: "document-text-as-canonical-input",
    queryEncoding: "query-text-as-canonical-input",
    maximumInputCharacters: 8_000
  }),
  "eval-all-minilm-l6-v2": Object.freeze({
    profileKey: "eval-all-minilm-l6-v2",
    environment: "EVALUATION",
    provider: "TRANSFORMERS_JS_LOCAL",
    model: "Xenova/all-MiniLM-L6-v2",
    modelRevision: "main",
    dtype: "q8",
    dimensions: 384,
    metric: "cosine",
    inputVersion: "structured-v1",
    documentPrefix: "",
    queryPrefix: "",
    maximumInputCharacters: 8_000
  }),
  "eval-bge-small-en-v1.5": Object.freeze({
    profileKey: "eval-bge-small-en-v1.5",
    environment: "EVALUATION",
    provider: "TRANSFORMERS_JS_LOCAL",
    model: "Xenova/bge-small-en-v1.5",
    modelRevision: "main",
    dtype: "q8",
    dimensions: 384,
    metric: "cosine",
    inputVersion: "structured-v1",
    documentPrefix: "",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    maximumInputCharacters: 8_000
  }),
  "eval-e5-small-v2": Object.freeze({
    profileKey: "eval-e5-small-v2",
    environment: "EVALUATION",
    provider: "TRANSFORMERS_JS_LOCAL",
    model: "Xenova/e5-small-v2",
    modelRevision: "main",
    dtype: "q8",
    dimensions: 384,
    metric: "cosine",
    inputVersion: "structured-v1",
    documentPrefix: "passage: ",
    queryPrefix: "query: ",
    maximumInputCharacters: 8_000
  }),
  "production-bge-small-en-v1.5-v1": Object.freeze({
    profileKey: "production-bge-small-en-v1.5-v1",
    environment: "PRODUCTION",
    provider: "TRANSFORMERS_JS_LOCAL",
    model: "Xenova/bge-small-en-v1.5",
    modelRevision: "main",
    dtype: "q8",
    dimensions: 384,
    metric: "cosine",
    inputVersion: "summary-v1",
    documentPrefix: "",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    maximumInputCharacters: 8_000
  })
});

export const PRODUCTION_EMBEDDING_PROFILE_KEY = "production-bge-small-en-v1.5-v1";
export const PRODUCTION_EMBEDDING_PROFILE_SELECTED = true;

export function getEmbeddingProfile(profileKey) {
  const profile = EMBEDDING_PROFILES[profileKey];
  if (!profile) {
    const error = new Error(`Unknown embedding profile: ${profileKey}`);
    error.code = "UNKNOWN_EMBEDDING_PROFILE";
    throw error;
  }
  return profile;
}

export function assertProfileIsServerSide(profileKey, profile = getEmbeddingProfile(profileKey)) {
  if (profile.profileKey !== profileKey || !["TEST_ONLY", "EVALUATION", "PRODUCTION"].includes(profile.environment)) {
    const error = new Error("Embedding profiles must be selected from the server-side allowlist");
    error.code = "INVALID_EMBEDDING_PROFILE";
    throw error;
  }
  return Object.freeze({ ...profile });
}
