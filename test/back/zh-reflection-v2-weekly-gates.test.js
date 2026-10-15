// Offline, $0: fail-closed gates for the single live zh-Hans Reflection v2 Weekly (Sonnet 5.5) acceptance call.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GATEWAY_MODELS } from "../../lib/ai-gateway-config.js";
import { APPROVAL, DATABASES, GATEWAY_ATTESTATION, LEDGER_NAME, MAX_BUDGET_USD, MODEL, QUOTE, costFromUsage, dispatchGuard, gitState, preflight }
  from "../../scripts/zh-reflection-v2-weekly-gates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runner = path.join(root, "scripts/zh-reflection-v2-weekly-acceptance.mjs");
const COMMIT = "a".repeat(40);
const url = db => `postgresql://acceptance:acceptance-local-only@127.0.0.1:55432/${db}`;
const offlineEnv = { NODE_ENV: "test", DEV_DATABASE_URL: url(DATABASES.offline) };
const liveEnv = { NODE_ENV: "test", DEV_DATABASE_URL: url(DATABASES["live-weekly"]), PETALPAL_ZH_ACCEPTANCE_APPROVAL: APPROVAL,
  PETALPAL_ZH_ACCEPTANCE_COMMIT: COMMIT, PETALPAL_ZH_ACCEPTANCE_BUDGET_USD: MAX_BUDGET_USD,
  PETALPAL_ZH_ACCEPTANCE_NO_RETRY_ATTESTATION: GATEWAY_ATTESTATION };
const cleanGit = { head: COMMIT, clean: true, ledgerExists: false };
const live = (env = {}, git = cleanGit) => preflight({ mode: "live-weekly", env: { ...liveEnv, ...env }, dotenv: false, git });

test("budget: one full Sonnet 5.5 Weekly reservation fits the US$0.05 cap and a second does not", () => {
  assert.equal(MODEL, "claude-sonnet-5-5");
  assert.deepEqual([QUOTE.model, QUOTE.inputTokens, QUOTE.maxOutputTokens], [MODEL, 8192, 2048]);
  const { inputRate, outputRate } = GATEWAY_MODELS[MODEL];
  assert.equal(QUOTE.reservedNanoUsd, Math.ceil(8192 * inputRate * 1.25) + 2048 * outputRate);
  assert.equal(QUOTE.reservedNanoUsd, 40_960_000); // US$0.04096
  assert.ok(QUOTE.reservedNanoUsd <= 50_000_000 && 2 * QUOTE.reservedNanoUsd > 50_000_000);
  assert.deepEqual(costFromUsage("600:150:0"), { inputTokens: 600, outputTokens: 150, cachedInputTokens: 0, nanoUsd: 600 * inputRate + 150 * outputRate });
  assert.equal(costFromUsage("x:1:0"), null);
});

test("preflight: offline needs an isolated env and the disposable offline database only", () => {
  assert.equal(preflight({ mode: "offline", env: offlineEnv, dotenv: false }), null);
  assert.match(preflight({ mode: "live-monthly", env: offlineEnv, dotenv: false }), /^USAGE/);
  assert.match(preflight({ mode: undefined, env: offlineEnv, dotenv: false }), /^USAGE/);
  assert.equal(preflight({ mode: "offline", env: offlineEnv, dotenv: true }), "DOTENV_PRESENT");
  assert.equal(preflight({ mode: "offline", env: { ...offlineEnv, NODE_ENV: "production" }, dotenv: false }), "ENVIRONMENT_NOT_ISOLATED");
  for (const name of ["DATABASE_URL", "NATIVE_SECURITY_TEST", "RENDER_SERVICE_ID", "ANTHROPIC_API_KEY", "CLOUDFLARE_AI_GATEWAY_TOKEN",
    "CLOUDFLARE_API_TOKEN", "OPENAI_API_KEY", "FIREBASE_PROJECT_ID", "AI_WEEKLY_REPORT_PROVIDER", "AI_MONTHLY_REPORT_PROVIDER"]) {
    assert.equal(preflight({ mode: "offline", env: { ...offlineEnv, [name]: "x" }, dotenv: false }), "ENVIRONMENT_NOT_ISOLATED", name);
  }
  assert.equal(preflight({ mode: "offline", env: { NODE_ENV: "test" }, dotenv: false }), "DATABASE_URL_INVALID");
  for (const bad of [url(DATABASES["live-weekly"]), url("petalpal"), url(DATABASES.offline).replace("127.0.0.1", "localhost"),
    url(DATABASES.offline).replace("55432", "5432"), url(DATABASES.offline).replace("postgresql:", "mysql:")]) {
    assert.equal(preflight({ mode: "offline", env: { ...offlineEnv, DEV_DATABASE_URL: bad }, dotenv: false }), "DATABASE_NOT_DISPOSABLE", bad);
  }
});

test("preflight: live needs the exact v2 approval, approved clean commit, cap <= US$0.05, unconsumed ledger and no CI", () => {
  assert.equal(live(), null);
  assert.equal(live({ DEV_DATABASE_URL: url(DATABASES.offline) }), "DATABASE_NOT_DISPOSABLE");
  assert.equal(live({ CI: "true" }), "LIVE_FORBIDDEN_IN_CI");
  assert.equal(live({ GITHUB_ACTIONS: "true" }), "LIVE_FORBIDDEN_IN_CI");
  for (const token of [undefined, "", "APPROVE-1-ZH-WEEKLY-SONNET-CALL", "APPROVE-1-ZH-MONTHLY-OPUS-CALL", `${APPROVAL} `, APPROVAL.toLowerCase()]) {
    assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_APPROVAL: token }), "APPROVAL_REQUIRED", String(token));
  }
  for (const commit of [undefined, "", "beebea0c", COMMIT.toUpperCase(), `${COMMIT}0`]) {
    assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_COMMIT: commit }), "APPROVED_COMMIT_REQUIRED", String(commit));
  }
  assert.equal(live({}, { ...cleanGit, head: "b".repeat(40) }), "APPROVED_COMMIT_MISMATCH");
  assert.equal(live({}, null), "APPROVED_COMMIT_MISMATCH");
  assert.equal(live({}, { ...cleanGit, clean: false }), "WORKTREE_NOT_CLEAN");
  for (const value of [undefined, "", "$0.05", "0.05 ", "-1", "five"]) {
    assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_BUDGET_USD: value }), "BUDGET_CAP_REQUIRED", String(value));
  }
  for (const value of ["0.050000001", "0.06", "1"]) assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_BUDGET_USD: value }), "BUDGET_CAP_EXCEEDS_AUTHORIZED_MAXIMUM", value);
  for (const value of ["0", "0.04"]) assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_BUDGET_USD: value }), "BUDGET_CAP_BELOW_RESERVATION", value);
  assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_BUDGET_USD: "0.04096" }), null);
  for (const value of [undefined, "", "true", "verified"]) {
    assert.equal(live({ PETALPAL_ZH_ACCEPTANCE_NO_RETRY_ATTESTATION: value }), "GATEWAY_NO_RETRY_UNVERIFIED", String(value));
  }
  assert.equal(live({}, { ...cleanGit, ledgerExists: true }), "LEDGER_CONSUMED");
});

test("dispatch guard: live sends once, fsyncs the attempt before the send, never resumes a ledger and records no secrets", async t => {
  const dir = mkdtempSync(path.join(tmpdir(), "zh-v2-gates-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ledgerFile = path.join(dir, "petalpal-acceptance", LEDGER_NAME), expectedUrl = "https://gateway.example/v1/messages";
  const options = { method: "POST", headers: { "cf-aig-authorization": "Bearer synthetic-secret-token", "x-api-key": "synthetic-secret-key" }, body: "{\"synthetic\":true}" };
  let sends = 0;
  const guard = dispatchGuard({ expectedUrl, live: true, ledgerFile, run: { commit: COMMIT }, send: async () => {
    sends += 1;
    const lines = readFileSync(ledgerFile, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(lines.map(line => line.entry), ["run", "attempt"], "attempt durable before the send");
    return new Response("{}", { status: 200 });
  } });
  assert.equal((await guard.impl(expectedUrl, options)).status, 200);
  await assert.rejects(guard.impl(expectedUrl, options), /DISPATCH_REFUSED/);
  assert.equal(sends, 1); assert.equal(guard.calls, 2);
  guard.ledger.close();
  const text = readFileSync(ledgerFile, "utf8");
  assert.deepEqual(text.trim().split("\n").map(line => JSON.parse(line).entry), ["run", "attempt", "response"]);
  assert.doesNotMatch(text, /synthetic-secret|Bearer|synthetic":true/);

  // An existing ledger (here: the one just written) blocks any later process before the send.
  const again = dispatchGuard({ expectedUrl, live: true, ledgerFile, send: async () => { sends += 1; return new Response("{}"); } });
  await assert.rejects(again.impl(expectedUrl, options), /LEDGER_UNAVAILABLE/);
  writeFileSync(path.join(dir, "empty.jsonl"), "");
  const empty = dispatchGuard({ expectedUrl, live: true, ledgerFile: path.join(dir, "empty.jsonl"), send: async () => { sends += 1; return new Response("{}"); } });
  await assert.rejects(empty.impl(expectedUrl, options), /LEDGER_UNAVAILABLE/);
  assert.equal(sends, 1);

  // Uncertain outcome (transport throws / timeout / crash after send): the attempt stays recorded and blocks reruns.
  const uncertainFile = path.join(dir, "uncertain", LEDGER_NAME);
  const uncertain = dispatchGuard({ expectedUrl, live: true, ledgerFile: uncertainFile, send: async () => { sends += 1; throw new Error("socket hang up"); } });
  await assert.rejects(uncertain.impl(expectedUrl, options), /socket hang up/);
  assert.deepEqual(readFileSync(uncertainFile, "utf8").trim().split("\n").map(line => JSON.parse(line).entry), ["run", "attempt"]);
  uncertain.ledger.close();
  const rerun = dispatchGuard({ expectedUrl, live: true, ledgerFile: uncertainFile, send: async () => { sends += 1; return new Response("{}"); } });
  await assert.rejects(rerun.impl(expectedUrl, options), /LEDGER_UNAVAILABLE/);
  assert.equal(sends, 2);
  sends = 1;

  // Unexpected URL or a missing ledger path is refused before the send.
  const other = path.join(dir, "other.jsonl");
  await assert.rejects(dispatchGuard({ expectedUrl, live: true, ledgerFile: other, send: async () => { sends += 1; } }).impl("https://api.anthropic.com/v1/messages", options), /DISPATCH_REFUSED/);
  await assert.rejects(dispatchGuard({ expectedUrl, live: true, send: async () => { sends += 1; } }).impl(expectedUrl, options), /DISPATCH_REFUSED/);
  assert.equal(sends, 1); assert.equal(existsSync(other), false);
});

test("dispatch guard: offline counts mock dispatches and never writes a ledger", async () => {
  let sends = 0;
  const guard = dispatchGuard({ expectedUrl: "https://mock", live: false, send: async () => { sends += 1; return new Response("{}"); } });
  await guard.impl("https://mock", {}); await guard.impl("https://mock", {});
  assert.equal(sends, 2); assert.equal(guard.ledger, null);
  await assert.rejects(guard.impl("https://elsewhere", {}), /DISPATCH_REFUSED/);
});

test("git state names a ledger under the Git common directory, not HOME", () => {
  const state = gitState(root);
  assert.ok(state, "git metadata available");
  assert.match(state.head, /^[0-9a-f]{40}$/);
  assert.equal(typeof state.clean, "boolean");
  assert.equal(path.basename(state.ledger), LEDGER_NAME);
  assert.equal(path.basename(path.dirname(state.ledger)), "petalpal-acceptance");
  assert.ok(!state.ledger.startsWith(path.join(process.env.HOME || "/nonexistent", "petalpal-acceptance")));
});

test("runner CLI stops before any database or provider access when a gate fails", () => {
  const base = { PATH: process.env.PATH, HOME: process.env.HOME };
  const cli = (args, env) => {
    const result = spawnSync(process.execPath, [runner, ...args], { cwd: root, env: { ...base, ...env }, encoding: "utf8", input: "", timeout: 30_000 });
    return { status: result.status, out: JSON.parse(result.stdout.trim().split("\n").at(-1)) };
  };
  const cases = [
    [["live-monthly"], offlineEnv, /^USAGE/],
    [["offline"], { ...offlineEnv, ANTHROPIC_API_KEY: "synthetic" }, /^ENVIRONMENT_NOT_ISOLATED$/],
    [["offline"], { ...offlineEnv, DEV_DATABASE_URL: url("petalpal") }, /^DATABASE_NOT_DISPOSABLE$/],
    [["live-weekly"], { ...liveEnv, CI: "true" }, /^LIVE_FORBIDDEN_IN_CI$/],
    [["live-weekly"], { ...liveEnv, PETALPAL_ZH_ACCEPTANCE_APPROVAL: "APPROVE-1-ZH-WEEKLY-SONNET-CALL" }, /^APPROVAL_REQUIRED$/],
    [["live-weekly"], liveEnv, /^APPROVED_COMMIT_MISMATCH$/]
  ];
  for (const [args, env, code] of cases) {
    const { status, out } = cli(args, env);
    assert.equal(status, 2); assert.equal(out.result, "STOP"); assert.match(out.code, code); assert.equal(out.providerCalls, 0);
  }
});

test("offline workflow references no secrets and never invokes the live mode", () => {
  const workflow = readFileSync(path.join(root, ".github/workflows/zh-reflection-v2-weekly-offline.yml"), "utf8");
  assert.doesNotMatch(workflow, /secrets\.|acceptance\.mjs\s+live|PETALPAL_ZH_ACCEPTANCE_|ANTHROPIC|GATEWAY_TOKEN/);
  assert.equal(workflow.match(/zh-reflection-v2-weekly-acceptance\.mjs/g).length, 1);
  assert.match(workflow, /zh-reflection-v2-weekly-acceptance\.mjs offline/);
  assert.match(workflow, /permissions:\n {2}contents: read/);
});
