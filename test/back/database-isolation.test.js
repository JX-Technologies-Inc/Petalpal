import assert from "node:assert/strict";
import test from "node:test";
import { assertDevelopmentDatabase, resolveDatabaseUrl } from "../../lib/database-isolation.js";

const remote = "postgresql://user:secret@db.prisma.io:5432/postgres";
const local = "postgresql://user:secret@localhost:5432/petalpal_dev";

test("production continues to use only DATABASE_URL", () => {
  assert.equal(resolveDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: remote, DEV_DATABASE_URL: local }), remote);
});

test("development requires a separately named local database", () => {
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: remote }), /Local development database is not configured/);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: remote, DEV_DATABASE_URL: local }), local);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: remote, DEV_DATABASE_URL: remote }), /isolation cannot be confirmed/);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: remote, DEV_DATABASE_URL: "postgresql://user:secret@localhost:5432/postgres" }), /isolation cannot be confirmed/);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: remote, DEV_DATABASE_URL: "postgresql://user:secret@some-remote-host:5432/petalpal_dev" }), /isolation cannot be confirmed/);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "not a URL", DEV_DATABASE_URL: local }), /isolation cannot be confirmed/);
});

test("Emotion Lab writes reject production mode", () => {
  assert.throws(() => assertDevelopmentDatabase({ NODE_ENV: "production", DATABASE_URL: remote, DEV_DATABASE_URL: local }), /disabled in production/);
  assert.equal(assertDevelopmentDatabase({ NODE_ENV: "development", DATABASE_URL: remote, DEV_DATABASE_URL: local }), local);
});
