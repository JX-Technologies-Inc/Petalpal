import { randomUUID } from "node:crypto";
import { requireAiIdentity } from "./ai-identity.js";
import { requireLockedMemoryConsent } from "./semantic-retrieval.js";

// Reservations live in the existing non-cascading AuditEvent table. Never
// refund an attempted/ambiguous call: reclaim, retry or deletion must not buy
// another inference. Reports reserve both retrieval and one narrative call.
export const AI_COST_ACTIONS = Object.freeze({
  WEEKLY_REPORT: { daily: 4, calls: 2 },
  MONTHLY_REPORT: { daily: 2, calls: 2 },
  EMBEDDING_GENERATION: { daily: 200, calls: 1 },
  EVENT_EMOTION: { daily: 100, calls: 1 },
  SPEECH_TRANSCRIPTION: { daily: 20, calls: 1 }
});
const EVENT_TYPE = "AI_COST_RESERVED";
const PROVIDER = "CLOUDFLARE_WORKERS_AI";
const messages = {
  AI_QUOTA_EXCEEDED: "AI usage limit reached. Try again after the daily window resets.",
  AI_INFERENCE_ALREADY_RESERVED: "This AI operation was already attempted; automatic inference replay is blocked.",
  AI_BUDGET_UNAVAILABLE: "AI usage authorization is temporarily unavailable.",
  AI_JOB_LEASE_LOST: "AI job claim is no longer current.",
  AI_FORBIDDEN: "AI processing is not currently authorized."
};
export function aiCostError(code) {
  const error = new Error(messages[code] || messages.AI_BUDGET_UNAVAILABLE);
  error.code = Object.hasOwn(messages, code) ? code : "AI_BUDGET_UNAVAILABLE";
  return error;
}
export function aiCostHttpStatus(code) {
  return code === "AI_QUOTA_EXCEEDED" ? 429 : code === "AI_INFERENCE_ALREADY_RESERVED" ? 409 : 503;
}
export function isAiCostError(error) { return Object.hasOwn(messages, error?.code); }
function limit(env, name, fallback) {
  if (env[name] === undefined) return fallback;
  const value = String(env[name]);
  if (!/^\d{1,7}$/.test(value) || Number(value) > 1_000_000) throw aiCostError("AI_BUDGET_UNAVAILABLE");
  return Number(value); // zero is an explicit fail-closed kill switch
}

export class PrismaAiCostGate {
  constructor(prisma, { env = process.env } = {}) { this.prisma = prisma; this.env = env; }

  async reserve({ identity, action, key = null, job = null, workerId = null }) {
    try {
      const ownerId = requireAiIdentity(identity), policy = AI_COST_ACTIONS[action];
      if (!Object.hasOwn(AI_COST_ACTIONS, action) || !policy || ownerId.length > 128) throw aiCostError("AI_FORBIDDEN");
      if (key !== null && (typeof key !== "string" || !key || key.length > 191)) throw aiCostError("AI_FORBIDDEN");
      if (["WEEKLY_REPORT", "MONTHLY_REPORT", "EMBEDDING_GENERATION"].includes(action) && (!job || !key)) throw aiCostError("AI_FORBIDDEN");
      const reservationId = key === null ? randomUUID() : JSON.stringify(["ai-cost-v1", ownerId, action, key]);
      const actionLimit = limit(this.env, `AI_${action}_DAILY_LIMIT`, policy.daily);
      const userLimit = limit(this.env, "AI_USER_DAILY_CALL_LIMIT", 300);
      const globalLimit = limit(this.env, "AI_GLOBAL_DAILY_CALL_LIMIT", 10_000);
      const providerLimit = limit(this.env, "AI_PROVIDER_DAILY_CALL_LIMIT", 10_000);
      return await this.prisma.$transaction(async tx => {
        // One short shared DB critical section for all instances/actions.
        // This fixed advisory-lock namespace is not a process-local limiter.
        const [lock] = await tx.$queryRawUnsafe(`/* ai-cost:lock */
          SELECT pg_advisory_xact_lock(73001604)::text AS "locked"`);
        // Read the clock only after obtaining the lock (including UTC midnight).
        const [time] = await tx.$queryRawUnsafe(`/* ai-cost:clock */ SELECT clock_timestamp() AS "now"`);
        if (!lock || !time?.now) throw aiCostError("AI_BUDGET_UNAVAILABLE");
        const owners = await tx.$queryRawUnsafe(`/* ai-cost:owner */ SELECT "id" FROM "User" WHERE "id" = $1 FOR SHARE`, ownerId);
        if (owners.length !== 1) throw aiCostError("AI_FORBIDDEN");
        if (job) {
          if (job.ownerId !== ownerId || job.jobType !== action || key !== job.idempotencyKey || !workerId) throw aiCostError("AI_FORBIDDEN");
          await requireLockedMemoryConsent(tx, identity);
          const rows = await tx.$queryRawUnsafe(`/* ai-cost:claim */
            SELECT "id" FROM "AIJob"
            WHERE "id" = $1 AND "ownerId" = $2 AND "lockedBy" = $3
              AND "attemptCount" = $4 AND "lockedAt" = $5
              AND "jobType"::text = $6 AND "resourceId" = $7 AND "idempotencyKey" = $8
              AND "status" = 'RUNNING' AND "leaseExpiresAt" > clock_timestamp()
            FOR SHARE`, job.id, ownerId, workerId, job.attemptCount, job.lockedAt, action, job.resourceId, key);
          if (rows.length !== 1) throw aiCostError("AI_JOB_LEASE_LOST");
        }
        const existing = await tx.$queryRawUnsafe(`/* ai-cost:duplicate */ SELECT "id" FROM "AuditEvent" WHERE "id" = $1`, reservationId);
        if (existing.length) throw aiCostError("AI_INFERENCE_ALREADY_RESERVED");
        const now = new Date(time.now);
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const [usage] = await tx.$queryRawUnsafe(`/* ai-cost:usage */
          SELECT COUNT(*) FILTER (WHERE "actorUserId" = $2 AND "actionCode" = $3)::integer AS "action",
            COALESCE(SUM("reasonCode"::integer) FILTER (WHERE "actorUserId" = $2), 0)::integer AS "user",
            COALESCE(SUM("reasonCode"::integer), 0)::integer AS "global",
            COALESCE(SUM("reasonCode"::integer) FILTER (WHERE "targetClass" = $4), 0)::integer AS "provider"
          FROM "AuditEvent" WHERE "eventType" = 'AI_COST_RESERVED' AND "createdAt" >= $1`, start, ownerId, action, PROVIDER);
        if (!usage || ![usage.action, usage.user, usage.global, usage.provider].every(Number.isSafeInteger)) throw aiCostError("AI_BUDGET_UNAVAILABLE");
        if (usage.action >= actionLimit || usage.user + policy.calls > userLimit ||
            usage.global + policy.calls > globalLimit || usage.provider + policy.calls > providerLimit) throw aiCostError("AI_QUOTA_EXCEEDED");
        await tx.$queryRawUnsafe(`/* ai-cost:reserve */
          INSERT INTO "AuditEvent" ("id", "createdAt", "eventType", "outcome", "actorUserId", "targetClass", "actionCode", "reasonCode")
          VALUES ($1, $2, $3, 'RESERVED', $4, $5, $6, $7) RETURNING "id"`, reservationId, now, EVENT_TYPE, ownerId, PROVIDER, action, String(policy.calls));
        return { reserved: true };
      });
    } catch (error) { throw aiCostError(error?.code); }
  }
}
