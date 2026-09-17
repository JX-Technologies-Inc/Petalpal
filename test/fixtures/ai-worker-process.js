import prisma from "../../lib/prisma.js";
import { AiJobWorker, createProductionAiWorker } from "../../lib/ai-worker.js";
import { PrismaAiJobRepository } from "../../lib/ai-jobs.js";

const mode = process.env.AI_WORKER_TEST_MODE || "once";
const workerId = process.env.AI_WORKER_ID || `fixture-${process.pid}`;

async function main() {
  if (mode === "hang-after-claim") {
    const worker = new AiJobWorker({
      repository: new PrismaAiJobRepository(prisma),
      workerId,
      leaseMs: Number(process.env.AI_JOB_LEASE_MS) || 1_000,
      handlers: {
        MEMORY_EXTRACTION: async (job) => {
          process.send?.({ type: "claimed", jobId: job.id, workerId });
          await new Promise(() => {});
        }
      }
    });
    await worker.runOnce();
    return;
  }

  const worker = createProductionAiWorker({ prisma, workerId });
  const result = await worker.runOnce();
  process.send?.({
    type: "result",
    claimed: result.claimed,
    succeeded: result.succeeded,
    jobId: result.job?.id || null
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    process.send?.({ type: "error", message: error.message });
    await prisma.$disconnect();
    process.exit(1);
  });
