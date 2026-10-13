// Fail-closed target check for the AI E2E workflow, run before `prisma migrate deploy`
// and before the suite. Accepts only the disposable CI service database. Prints
// reason codes only; never connection strings or values.
import { resolveDatabaseUrl } from "../lib/database-isolation.js";

const EXPECTED = { protocol: "postgresql:", hostname: "127.0.0.1", port: "5432", database: "petalpal_ai_e2e_test" };
const phase = process.argv[2];
const fail = (reason) => { console.error(`AI E2E database target REJECTED: ${reason}`); process.exit(78); };

if (!["pre-migrate", "post-migrate"].includes(phase)) fail("unknown phase");
if (process.env.GITHUB_ACTIONS !== "true") fail("must run inside the disposable GitHub Actions job");
if (process.env.NODE_ENV !== "test") fail("NODE_ENV must be test");
for (const name of ["DATABASE_URL", "PETALPAL_ENVIRONMENT", "RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL", "NATIVE_SECURITY_TEST"]) {
  if (process.env[name] !== undefined) fail(`${name} must be unset`);
}
let url;
try { url = new URL(process.env.DEV_DATABASE_URL); } catch { fail("DEV_DATABASE_URL is not a URL"); }
const actual = { protocol: url.protocol, hostname: url.hostname, port: url.port, database: decodeURIComponent(url.pathname.slice(1)) };
for (const key of Object.keys(EXPECTED)) if (actual[key] !== EXPECTED[key]) fail(`unexpected ${key}`);
// The same resolver used by prisma.config.ts and lib/prisma.js must select this URL.
try {
  if (resolveDatabaseUrl(process.env) !== process.env.DEV_DATABASE_URL) fail("application resolver selects a different database");
} catch { fail("application resolver rejected the database"); }

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DEV_DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const [state] = (await client.query(`SELECT current_database() AS "database",
    (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS "tables",
    (SELECT count(*)::int FROM pg_available_extensions WHERE name = 'vector') AS "vector"`)).rows;
  if (state.database !== EXPECTED.database) fail("connected database name mismatch");
  if (state.vector !== 1) fail("pgvector extension unavailable");
  if (phase === "pre-migrate" && state.tables !== 0) fail("database is not freshly created (public tables exist)");
  if (phase === "post-migrate") {
    const [users] = (await client.query(`SELECT count(*)::int AS "count" FROM "User"`)).rows;
    if (users.count !== 0) fail("migrated database already contains users");
  }
  console.log(`AI E2E database target verified (${phase}): disposable ${EXPECTED.database} on loopback`);
} catch (error) {
  fail(`database check failed (${error?.code || "error"})`);
} finally {
  await client.end().catch(() => {});
}
