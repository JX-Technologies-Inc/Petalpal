import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "./database-isolation.js";
import { createDatabasePool, DATABASE_TRANSACTION_OPTIONS } from "./database-resources.js";
import { logServerError } from "./security-log.js";

const adapter = new PrismaPg(createDatabasePool(resolveDatabaseUrl()), {
  disposeExternalPool: true,
  onPoolError: error => logServerError("Database pool connection error", error),
});

const prisma = new PrismaClient({
  adapter,
  transactionOptions: DATABASE_TRANSACTION_OPTIONS,
});

export default prisma;
