import { enqueueEventMemoryEmbeddingBackfill } from "../lib/ai-jobs.js";
import prisma from "../lib/prisma.js";

const batchSize = process.env.AI_EMBEDDING_BACKFILL_BATCH_SIZE
  ? Number(process.env.AI_EMBEDDING_BACKFILL_BATCH_SIZE)
  : 100;
const afterId = process.env.AI_EMBEDDING_BACKFILL_AFTER_ID || null;

try {
  const result = await enqueueEventMemoryEmbeddingBackfill({ prisma, batchSize, afterId });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
