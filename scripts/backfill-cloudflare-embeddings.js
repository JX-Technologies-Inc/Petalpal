import prisma from "../lib/prisma.js";
import { CloudflareWorkersEmbeddingProvider } from "../lib/embedding-provider.js";
import { CLOUDFLARE_EMBEDDING_PROFILE_KEY, LOCAL_EMBEDDING_PROFILE_KEY } from "../lib/embedding-profiles.js";
import { candidateBackfillPreflight, runCandidateBackfill } from "../lib/cloudflare-embedding-backfill.js";

const execute = process.argv.includes("--execute");
const dryRun = process.argv.includes("--dry-run");
const production = process.argv.includes("--production");
const maxArgument = process.argv.find((argument) => argument.startsWith("--max="));
const max = maxArgument ? Number(maxArgument.slice(6)) : 25;
const afterArgument = process.argv.find((argument) => argument.startsWith("--after-id="));
const afterId = afterArgument ? afterArgument.slice(11) : null;

try {
  if (execute === dryRun) throw new Error("Specify exactly one of --dry-run or --execute");
  if (production !== (process.env.NODE_ENV === "production")) {
    throw new Error("--production must match NODE_ENV=production");
  }
  if (LOCAL_EMBEDDING_PROFILE_KEY === CLOUDFLARE_EMBEDDING_PROFILE_KEY) {
    throw new Error("Cloudflare and local embedding profiles must remain separate");
  }
  const before = await candidateBackfillPreflight(prisma);
  console.log(JSON.stringify({ phase: "preflight", ...before }));
  if (execute) {
    const provider = new CloudflareWorkersEmbeddingProvider(CLOUDFLARE_EMBEDDING_PROFILE_KEY);
    const result = await runCandidateBackfill({ prisma, provider, max, afterId });
    console.log(JSON.stringify({ phase: "run", ...result }));
    console.log(JSON.stringify({ phase: "postflight", ...await candidateBackfillPreflight(prisma) }));
    if (result.failed) process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
