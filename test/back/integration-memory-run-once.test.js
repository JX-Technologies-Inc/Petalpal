import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memoryRunPreflight, verifyIntegrationMarker, MEMORY_RUN_PHRASE } from "../../scripts/integration-memory-run-once.mjs";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/integration-memory-run-once.mjs");
const valid = () => ({ AUTHORIZATION_PHRASE: MEMORY_RUN_PHRASE, OWNER_ID: "owner_test-1",
  DATABASE_URL: "postgresql://u:p@db.example.test:5432/postgres?sslmode=require" });

test("memory runner preflight requires the phrase, one owner and a TEST database URL with no provider credentials", () => {
  assert.equal(memoryRunPreflight(valid()), null);
  assert.match(memoryRunPreflight({ ...valid(), AUTHORIZATION_PHRASE: "" }), /authorization phrase/);
  for (const owner of [undefined, "", "a b", "x".repeat(65), "owner;drop"]) {
    assert.match(memoryRunPreflight({ ...valid(), OWNER_ID: owner }), /OWNER_ID/);
  }
  assert.match(memoryRunPreflight({ ...valid(), DATABASE_URL: "not a url" }), /DATABASE_URL/);
  assert.match(memoryRunPreflight({ ...valid(), DATABASE_URL: "prisma+postgres://accelerate.example/" }), /DATABASE_URL/);
  assert.match(memoryRunPreflight({ ...valid(), DEV_DATABASE_URL: "postgresql://localhost/dev" }), /DEV_DATABASE_URL/);
  for (const name of ["ANTHROPIC_API_KEY", "CLOUDFLARE_AI_GATEWAY_TOKEN", "CLOUDFLARE_WORKER_AI_URL", "AI_JOB_EXECUTOR_TOKEN"]) {
    assert.match(memoryRunPreflight({ ...valid(), [name]: "x" }), new RegExp(name));
  }
});

test("marker verification is read-only and accepts only the single integration marker", async () => {
  const run = async (hasMarker, rows) => {
    const statements = [];
    const ok = await verifyIntegrationMarker(async text => {
      statements.push(text);
      return /to_regclass/.test(text) ? [{ hasMarker }] : rows;
    });
    assert.ok(statements.every(text => /^\s*SELECT/i.test(text)), "only SELECT statements");
    return ok;
  };
  assert.equal(await run(true, [{ environment: "integration" }]), true);
  assert.equal(await run(false, []), false);
  assert.equal(await run(true, []), false);
  assert.equal(await run(true, [{ environment: "integration" }, { environment: "integration" }]), false);
  assert.equal(await run(true, [{ environment: "production" }]), false);
});

test("without authorization the runner stops before connecting and prints no URL", () => {
  const secretUrl = "postgresql://user:do-not-print@db.example.test:5432/postgres";
  const result = spawnSync(process.execPath, [script], { encoding: "utf8",
    env: { PATH: process.env.PATH, OWNER_ID: "owner-1", DATABASE_URL: secretUrl } });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /STOP: authorization phrase missing; nothing was connected/);
  assert.ok(!(result.stdout + result.stderr).includes("do-not-print"));
});
