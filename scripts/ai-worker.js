import prisma from "../lib/prisma.js";
import { createProductionAiWorker } from "../lib/ai-worker.js";
import { configuredCloudflareReportNarrativeProvider } from "../lib/report-narrative.js";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => controller.abort());
}

const worker = createProductionAiWorker({
  prisma,
  reportNarrativeProvider: configuredCloudflareReportNarrativeProvider(),
  workerId: process.env.AI_WORKER_ID,
  leaseMs: Number(process.env.AI_JOB_LEASE_MS) || 60_000,
  pollIntervalMs: Number(process.env.AI_JOB_POLL_INTERVAL_MS) || 1_000,
  retryDelayMs: Number(process.env.AI_JOB_RETRY_DELAY_MS) || 1_000
});

try {
  await worker.start({ signal: controller.signal });
} finally {
  await prisma.$disconnect();
}
