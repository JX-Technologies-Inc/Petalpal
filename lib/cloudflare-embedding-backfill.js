import { CLOUDFLARE_EMBEDDING_PROFILE_KEY, getEmbeddingProfile } from "./embedding-profiles.js";
import { EventEmbeddingService } from "./semantic-retrieval.js";

const profile = getEmbeddingProfile(CLOUDFLARE_EMBEDDING_PROFILE_KEY);
const PRICE_PER_MILLION_INPUT_TOKENS_USD = 0.020;

const eligibleSql = `
  FROM "EventMemory" AS memory
  INNER JOIN "Event" AS event
    ON event."id" = memory."sourceEventId" AND event."ownerId" = memory."ownerId"
  INNER JOIN "User" AS owner ON owner."id" = memory."ownerId"
  INNER JOIN "AiConsent" AS consent ON consent."userId" = memory."ownerId"
  LEFT JOIN "EventMemoryEmbedding" AS candidate
    ON candidate."eventMemoryId" = memory."id"
    AND candidate."ownerId" = memory."ownerId"
    AND candidate."profileKey" = $1
    AND candidate."inputRevision" = memory."embeddingInputRevision"
  WHERE memory."memoryType" = 'EVENT'
    AND event."memoryProcessingAllowed" = true
    AND consent."aiProcessing" = true
    AND consent."personalization" = true
    AND consent."memoryEnabled" = true
    AND (lower(owner."preferredLocale") = 'en' OR lower(owner."preferredLocale") LIKE 'en-%')
    AND ($5::text IS NULL OR memory."ownerId" = $5)
`;

const completeSql = `candidate."status" = 'GENERATED' AND candidate."embedding" IS NOT NULL
  AND candidate."model" = $2 AND candidate."modelRevision" = $3
  AND candidate."inputVersion" = $4`;
const isCompleteSql = `coalesce((${completeSql}), false)`;

export async function candidateBackfillPreflight(prisma, { ownerId = null } = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS eligible,
      count(*) FILTER (WHERE ${isCompleteSql})::int AS complete,
      count(*) FILTER (WHERE candidate."status" = 'FAILED' AND NOT ${isCompleteSql})::int AS failed,
      coalesce(sum(ceil((length(memory."summary") + 24)::numeric / 4))
        FILTER (WHERE NOT ${isCompleteSql}), 0)::int AS estimated_tokens
    ${eligibleSql}
  `, profile.profileKey, profile.model, profile.modelRevision, profile.inputVersion, ownerId);
  const { eligible, complete, failed, estimated_tokens: estimatedInputTokens } = rows[0];
  const estimatedCalls = eligible - complete;
  return Object.freeze({
    profileKey: profile.profileKey,
    eligible,
    alreadyComplete: complete,
    pending: eligible - complete - failed,
    failed,
    toGenerate: estimatedCalls,
    estimatedCalls,
    estimatedInputTokens,
    estimatedCostUsd: Number((estimatedInputTokens * PRICE_PER_MILLION_INPUT_TOKENS_USD / 1_000_000).toFixed(8))
  });
}

export async function runCandidateBackfill({ prisma, provider, max = 25, ownerId = null, afterId = null }) {
  if (provider?.describeProfile?.().profileKey !== profile.profileKey) {
    throw new Error("Candidate backfill requires the explicit Cloudflare embedding profile");
  }
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error("Backfill max must be 1-100");
  const sources = await prisma.$queryRawUnsafe(`
    SELECT memory."id", memory."ownerId"
    ${eligibleSql}
      AND NOT ${isCompleteSql}
      AND ($6::text IS NULL OR memory."id" > $6)
    ORDER BY memory."id" ASC
    LIMIT $7
  `, profile.profileKey, profile.model, profile.modelRevision, profile.inputVersion, ownerId, afterId, max);
  const service = new EventEmbeddingService({ prisma, provider });
  const counts = { selected: sources.length, generated: 0, skipped: 0, failed: 0,
    nextCursor: sources.at(-1)?.id || null };
  for (const source of sources) {
    try {
      const result = await service.generate({ identity: { userId: source.ownerId }, memoryId: source.id });
      if (result.skipped) counts.skipped += 1;
      else counts.generated += 1;
    } catch {
      // Source text, provider details, and owner identifiers never enter operator output.
      counts.failed += 1;
    }
  }
  return Object.freeze(counts);
}
