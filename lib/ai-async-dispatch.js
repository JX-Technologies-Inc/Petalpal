import { timingSafeEqual } from "node:crypto";

const MODES = new Set(["manual", "shadow", "cloudflare_queue"]);
const JOB_ID = /^[A-Za-z0-9_-]{8,191}$/;
const RECONCILE_LIMIT = 5;

export function aiAsyncExecutionMode(env = process.env) {
  const mode = env.AI_ASYNC_EXECUTION_MODE || "manual";
  if (!MODES.has(mode)) throw new Error("Unsupported AI async execution mode");
  return mode;
}

export function aiJobServiceAuthorized(header, env = process.env) {
  const expected = env.AI_JOB_EXECUTOR_TOKEN;
  if (!expected || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const secret = Buffer.from(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}

export function aiJobDispatchAllowed(job, env = process.env) {
  const mode = aiAsyncExecutionMode(env);
  if (mode === "cloudflare_queue") return true;
  return mode === "shadow" && Boolean(env.AI_ASYNC_SHADOW_OWNER_ID) &&
    job?.ownerId === env.AI_ASYNC_SHADOW_OWNER_ID;
}

export async function dispatchAiJob(job, { env = process.env, fetchImpl = fetch } = {}) {
  if (!job || !JOB_ID.test(job.id || "")) throw new Error("A valid AiJob is required for dispatch");
  if (!aiJobDispatchAllowed(job, env)) return { dispatched: false, reason: "MANUAL_MODE" };
  if (job.status !== "PENDING") return { dispatched: false, reason: "NOT_PENDING" };
  const base = env.AI_JOB_DISPATCH_URL;
  const token = env.AI_JOB_DISPATCH_TOKEN;
  if (!base || !token || !/^https:\/\//.test(base)) throw new Error("AI job dispatch is not configured");
  const response = await fetchImpl(`${base.replace(/\/$/, "")}/v1/ai-jobs/dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: job.id }),
    signal: AbortSignal.timeout(5_000)
  });
  if (response.body) await response.body.cancel();
  if (response.status !== 202) throw new Error(`AI job dispatch returned HTTP ${response.status}`);
  return { dispatched: true };
}

export async function listDispatchableAiJobs(prisma, { env = process.env, now = new Date() } = {}) {
  const mode = aiAsyncExecutionMode(env);
  if (mode === "manual" || (mode === "shadow" && !env.AI_ASYNC_SHADOW_OWNER_ID)) return [];
  const ownerId = mode === "shadow" ? env.AI_ASYNC_SHADOW_OWNER_ID : null;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id"
    FROM "AIJob"
    WHERE ($2::text IS NULL OR "ownerId" = $2)
      AND (("status" = 'PENDING' AND "nextAttemptAt" <= $1 AND "attemptCount" < "maxAttempts")
        OR ("status" = 'RUNNING' AND "leaseExpiresAt" <= $1))
    ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
    LIMIT $3
  `, now, ownerId, RECONCILE_LIMIT);
  return rows.map(({ id }) => ({ jobId: id }));
}

export async function executeAiJobById({ prisma, jobId, workerFactory, env = process.env, now = new Date() }) {
  if (!JOB_ID.test(jobId || "")) return { outcome: "INVALID_JOB_ID" };
  const job = await prisma.aiJob.findUnique({
    where: { id: jobId },
    select: { id: true, ownerId: true, jobType: true, status: true, nextAttemptAt: true, leaseExpiresAt: true }
  });
  if (!job) return { outcome: "MISSING" };
  if (!aiJobDispatchAllowed(job, env)) return { outcome: "NOT_SELECTED" };
  if (["SUCCEEDED", "CANCELLED", "FAILED"].includes(job.status)) return { outcome: job.status };
  if (job.status === "PENDING" && job.nextAttemptAt > now) return { outcome: "DEFERRED" };
  if (job.status === "RUNNING" && job.leaseExpiresAt > now) return { outcome: "LEASED" };
  const execution = await workerFactory().runJob({ jobId: job.id, ownerId: job.ownerId, jobType: job.jobType, now });
  const stored = await prisma.aiJob.findUnique({ where: { id: job.id }, select: { status: true } });
  const outcome = stored?.status || "MISSING";
  const nextJobId = execution?.succeeded && execution.result?.embeddingJob?.id;
  return {
    outcome,
    ...(nextJobId && JOB_ID.test(nextJobId) ? { nextJobId } : {})
  };
}
