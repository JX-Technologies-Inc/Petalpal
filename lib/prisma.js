import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "./database-isolation.js";

const adapter = new PrismaPg({
  connectionString: resolveDatabaseUrl(),
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
