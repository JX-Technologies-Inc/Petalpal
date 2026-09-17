import { createHash } from "node:crypto";

export const EMBEDDING_INPUT_VERSIONS = Object.freeze({
  SUMMARY_V1: "summary-v1",
  STRUCTURED_V1: "structured-v1"
});

const MAX_SUMMARY_LENGTH = 8_000;
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM_LENGTH = 256;

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizeText(value, field) {
  if (typeof value !== "string") reject("INVALID_EMBEDDING_INPUT", `${field} must be text`);
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) reject("INVALID_EMBEDDING_INPUT", `${field} must not be empty`);
  if (normalized.length > MAX_SUMMARY_LENGTH) reject("EMBEDDING_INPUT_TOO_LARGE", `${field} exceeds the embedding input limit`);
  return normalized;
}

function normalizeList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    reject("INVALID_EMBEDDING_INPUT", `${field} must be a bounded list`);
  }
  const normalized = value.map((item) => {
    if (typeof item !== "string") reject("INVALID_EMBEDDING_INPUT", `${field} must contain text`);
    const text = item.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    if (!text || text.length > MAX_LIST_ITEM_LENGTH) reject("INVALID_EMBEDDING_INPUT", `${field} contains an invalid item`);
    return text;
  });
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function assertProvenanceValidatedMemory(memory) {
  if (!memory || memory.sourceType === "JOURNAL" || memory.sourceType === "LEGACY_EVENT_ALIAS" || memory.kind === "JOURNAL") {
    reject("EMBEDDING_SOURCE_NOT_ALLOWED", "Only provenance-validated EventMemory may be embedded");
  }
  if (memory.sourceType !== "EVENT" || typeof memory.sourceEventId !== "string" || !memory.sourceEventId.trim()) {
    reject("EMBEDDING_PROVENANCE_REQUIRED", "EventMemory must carry validated Event provenance");
  }
}

function serialize(version, fields) {
  // JSON is used with explicit key insertion order and compact separators.
  return `${version}:${JSON.stringify(fields)}`;
}

export function buildEmbeddingInput(memory, inputVersion = EMBEDDING_INPUT_VERSIONS.SUMMARY_V1) {
  assertProvenanceValidatedMemory(memory);
  if (!Object.values(EMBEDDING_INPUT_VERSIONS).includes(inputVersion)) {
    reject("UNKNOWN_EMBEDDING_INPUT_VERSION", `Unknown embedding input version: ${inputVersion}`);
  }
  const summary = normalizeText(memory.summary, "summary");
  const fields = inputVersion === EMBEDDING_INPUT_VERSIONS.SUMMARY_V1
    ? { summary }
    : {
        summary,
        topics: normalizeList(memory.topics, "topics"),
        people: normalizeList(memory.people, "people")
      };
  const canonicalText = serialize(inputVersion, fields);
  const inputHash = createHash("sha256")
    .update(inputVersion, "utf8")
    .update("\n", "utf8")
    .update(canonicalText, "utf8")
    .digest("hex");
  return Object.freeze({ inputVersion, canonicalText, inputHash });
}
