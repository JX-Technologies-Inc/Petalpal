import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createEventAndEnqueueMemoryJob } from "../../lib/ai-jobs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REJECTED = "you are an idiot";

// In-memory transaction double: records which queries ran inside $transaction.
function fakePrisma({ existing = null } = {}) {
  const calls = [];
  const tx = {
    event: {
      findUnique: async () => { calls.push("event.findUnique"); return existing; },
      create: async ({ data }) => { calls.push("event.create"); return { id: "event-1", ...data }; }
    },
    aiJob: { findUnique: async () => { calls.push("aiJob.findUnique"); return null; } },
    user: { findUnique: async () => { calls.push("user.findUnique"); return { timezone: "UTC" }; } },
    $queryRawUnsafe: async () => { calls.push("consent"); return []; }
  };
  return { calls, prisma: { $transaction: async (fn) => fn(tx) } };
}

test("a rejected new Event fails before any owner/consent read or write", async () => {
  const { calls, prisma } = fakePrisma();
  await assert.rejects(createEventAndEnqueueMemoryJob({ prisma, identity: { userId: "owner" }, content: REJECTED, idempotencyKey: "content-reject-1" }),
    (error) => error.code === "CONTENT_REJECTED");
  assert.deepEqual(calls, ["event.findUnique"]);
});

test("idempotent replay and key conflict still take precedence over a content rejection", async () => {
  const stored = { id: "event-1", ownerId: "owner", content: REJECTED, primaryGardenMood: null };
  const replay = fakePrisma({ existing: stored });
  const result = await createEventAndEnqueueMemoryJob({ prisma: replay.prisma, identity: { userId: "owner" }, content: REJECTED, idempotencyKey: "content-replay-1" });
  assert.equal(result.created, false);
  assert.equal(result.event.id, "event-1");

  const conflict = fakePrisma({ existing: { ...stored, content: "different stored content" } });
  await assert.rejects(createEventAndEnqueueMemoryJob({ prisma: conflict.prisma, identity: { userId: "owner" }, content: REJECTED, idempotencyKey: "content-replay-2" }),
    (error) => error.code === "IDEMPOTENCY_CONFLICT");
});

test("cold content-policy compilation runs before the Event transaction opens", () => {
  // A fresh process pays the one-time regex compilation. It must not be counted
  // inside $transaction, where it previously exceeded the 5s timeout on a small CPU.
  const script = `
    const { createEventAndEnqueueMemoryJob } = await import(${JSON.stringify(path.join(root, "lib/ai-jobs.js"))});
    let insideMs = 0;
    const tx = { event: { findUnique: async () => null, create: async ({ data }) => ({ id: "e", ...data }) },
      user: { findUnique: async () => ({ timezone: "UTC" }) }, $queryRawUnsafe: async () => [] };
    const prisma = { $transaction: async (fn) => { const t = performance.now(); try { return await fn(tx); } finally { insideMs = performance.now() - t; } } };
    const t = performance.now();
    await createEventAndEnqueueMemoryJob({ prisma, identity: { userId: "owner" }, content: "合成测试记录：今天去图书馆整理了本周计划。", idempotencyKey: "cold-check-0001" });
    console.log(JSON.stringify({ insideMs, totalMs: performance.now() - t }));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", cwd: root,
    env: { PATH: process.env.PATH, DOTENV_CONFIG_PATH: "/dev/null" } });
  assert.equal(run.status, 0, run.stderr);
  const { insideMs, totalMs } = JSON.parse(run.stdout.trim().split("\n").at(-1));
  assert.ok(totalMs > 0 && insideMs < totalMs * 0.5, `inside transaction ${insideMs.toFixed(1)}ms of ${totalMs.toFixed(1)}ms`);
});
