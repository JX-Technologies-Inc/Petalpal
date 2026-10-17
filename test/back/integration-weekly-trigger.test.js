import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

// Runs the real script offline. The preload (test-only) reroutes the fixed TEST hosts to a
// local fake and pins Date.now; the script itself accepts no clock or host override.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/integration-weekly-trigger.mjs");
const preload = path.join(mkdtempSync(path.join(tmpdir(), "weekly-trigger-")), "reroute.mjs");
writeFileSync(preload, `const real = globalThis.fetch;
const now = Date.parse(process.env.FAKE_NOW); Date.now = () => now;
globalThis.fetch = (url, init) => { const u = new URL(url);
  if (!['petalpal-backend-test.onrender.com', 'identitytoolkit.googleapis.com'].includes(u.host)) throw new Error('unexpected host ' + u.host);
  return real('http://127.0.0.1:' + process.env.FAKE_PORT + '/' + u.host + u.pathname + u.search, init); };`);
const PROJECT = "petalpal-integration-test";
const SECRET = { email: "tester@jastrevia.com", password: "synthetic-password-not-real", owner: "owner-confirmed-1" };
const AFTER = "2026-10-19T00:00:00.000Z", BEFORE = "2026-10-18T23:59:59.000Z";

function fakeState(overrides = {}) {
  return { userId: SECRET.owner, email: SECRET.email, locale: "zh-Hans", timezone: "UTC", reportsStatus: 200,
    reports: [], triggerStatus: 200, triggerBody: null, requests: [], triggers: [], ...overrides };
}

async function run(state, { phase = "check", now = AFTER, ref = "refs/heads/main", attempt = "1", envOverrides = {} } = {}) {
  const idToken = `h.${Buffer.from(JSON.stringify({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, email_verified: true, email: state.email })).toString("base64url")}.s`;
  state.requests = [];
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const [, host, ...rest] = req.url.split("/");
    const route = "/" + rest.join("/");
    state.requests.push(`${req.method} ${route}`);
    const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };
    if (host === "identitytoolkit.googleapis.com") return send(200, { idToken });
    if (req.headers.authorization !== `Bearer ${idToken}`) return send(401, {});
    if (route === "/session?view=metadata") return send(200, { user: { id: state.userId, preferredLocale: state.locale, timezone: state.timezone } });
    if (route === "/ai/reports?limit=50") return send(state.reportsStatus, state.reportsStatus === 200 ? { reports: state.reports } : {});
    if (route === "/ai/reports/weekly/trigger" && req.method === "POST") {
      state.triggers.push(JSON.parse(raw));
      if (state.triggerStatus === 200) state.reports.push({ type: "weekly", periodKey: "2026-10-12" });
      return send(state.triggerStatus, state.triggerBody ?? { periodKey: "2026-10-12", execution: "COMPLETED",
        report: { id: "report-secret-id", narrativeStatus: "GENERATED" }, job: { status: "SUCCEEDED" } });
    }
    return send(500, {});
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["--import", preload, script], { env: {
    PATH: process.env.PATH, FAKE_PORT: String(server.address().port), FAKE_NOW: now, PHASE: phase,
    GITHUB_REF: ref, GITHUB_RUN_ATTEMPT: attempt,
    EXPO_PUBLIC_FIREBASE_API_KEY: "synthetic-key", EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
    INTEGRATION_TEST_EMAIL: SECRET.email, INTEGRATION_TEST_PASSWORD: SECRET.password, INTEGRATION_WEEKLY_OWNER_ID: SECRET.owner,
    ...envOverrides } });
  let output = ""; child.stdout.on("data", (d) => { output += d; }); child.stderr.on("data", (d) => { output += d; });
  const code = await new Promise((resolve) => child.on("close", resolve));
  await new Promise((resolve) => server.close(resolve));
  for (const value of [idToken, SECRET.email, SECRET.password, SECRET.owner, "report-secret-id", "synthetic-key", "raw provider detail"]) {
    assert.ok(!output.includes(value), `output must not contain ${value.slice(0, 12)}`);
  }
  return { code, output: output.trim() };
}

const READS = ["GET /session", "POST /v1/accounts:signInWithPassword?key=synthetic-key", "GET /session?view=metadata", "GET /ai/reports?limit=50"];

test("check phase is read-only and passes for the confirmed owner", async () => {
  const state = fakeState();
  const { code, output } = await run(state);
  assert.equal(code, 0, output);
  assert.match(output, /CHECK PASS: identity matched; locale zh-Hans; week 2026-10-12/);
  assert.deepEqual(state.requests, READS);
  assert.deepEqual(state.triggers, []);
});

test("identity, locale, consent and existing-report problems stop before any trigger", async () => {
  const cases = [
    [{ userId: "someone-else" }, /identity mismatch/],
    [{ email: "other@jastrevia.com" }, /not the stored, verified TEST identity/],
    [{ locale: "en" }, /owner Weekly locale is en/],
    [{ locale: "zh-Hant" }, /not zh-Hans/],
    [{ timezone: "Not/AZone" }, /does not map to week 2026-10-12/],
    [{ reportsStatus: 403 }, /memory consent not confirmed \(report list status 403\)/],
    [{ reports: [{ type: "weekly", periodKey: "2026-10-12" }] }, /already exists for week 2026-10-12; no trigger/],
  ];
  for (const [overrides, pattern] of cases) {
    for (const phase of ["check", "trigger"]) {
      const state = fakeState(overrides);
      const { code, output } = await run(state, { phase });
      assert.equal(code, 2, output);
      assert.match(output, pattern);
      assert.deepEqual(state.triggers, []);
    }
  }
});

test("trigger refuses before the week closes, off main, on a re-run or without secrets, sending nothing", async () => {
  const cases = [
    [{ now: BEFORE }, /still open/],
    [{ ref: "refs/heads/feature" }, /only from main/],
    [{ attempt: "2" }, /only on the first attempt/],
    [{ envOverrides: { INTEGRATION_WEEKLY_OWNER_ID: "" } }, /missing INTEGRATION_WEEKLY_OWNER_ID/],
    [{ envOverrides: { EXPO_PUBLIC_FIREBASE_PROJECT_ID: "petalpal-b212c" } }, /not the TEST Firebase project/],
    [{ envOverrides: { PHASE: "generate" } }, /PHASE must be check or trigger/],
  ];
  for (const [options, pattern] of cases) {
    const state = fakeState();
    const { code, output } = await run(state, { phase: "trigger", ...options });
    assert.equal(code, 2, output);
    assert.match(output, pattern);
    assert.deepEqual(state.requests, [], "no network request at all");
  }
});

test("trigger sends exactly one request for the fixed target, and a repeat run stops", async () => {
  const state = fakeState();
  const first = await run(state, { phase: "trigger" });
  assert.equal(first.code, 0, first.output);
  assert.deepEqual(state.triggers, [{ localDate: "2026-10-17" }]);
  assert.match(first.output, /TRIGGER: status 200; execution COMPLETED; errorCode none; report present; narrative GENERATED; period 2026-10-12/);
  const repeat = await run(state, { phase: "trigger" });
  assert.equal(repeat.code, 2);
  assert.match(repeat.output, /already exists for week 2026-10-12/);
  assert.equal(state.triggers.length, 1);
});

test("a failed trigger is reported with allowlisted codes only and never retried", async () => {
  for (const [status, body, expected] of [
    [502, { periodKey: "2026-10-12", execution: "FAILED", errorCode: "AI_GATEWAY_TIMEOUT", report: null, message: "raw provider detail" }, /status 502; execution FAILED; errorCode AI_GATEWAY_TIMEOUT; report absent/],
    [429, { errorCode: "AI_QUOTA_EXCEEDED" }, /status 429; execution none; errorCode AI_QUOTA_EXCEEDED/],
    [500, { errorCode: "SOMETHING raw provider detail" }, /status 500; execution none; errorCode OTHER/],
  ]) {
    const state = fakeState({ triggerStatus: status, triggerBody: body });
    const { code, output } = await run(state, { phase: "trigger" });
    assert.equal(code, 1, output);
    assert.match(output, expected);
    assert.equal(state.triggers.length, 1, "exactly one request, no retry");
  }
});

test("workflow keeps authorization in protected environments, not inputs", () => {
  const workflow = parse(readFileSync(path.join(root, ".github/workflows/integration-weekly-trigger.yml"), "utf8"));
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), ["phase"]);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.phase.options, ["check", "trigger"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(workflow.jobs.trigger.environment, "petalpal-weekly-trigger");
  assert.match(workflow.jobs.trigger.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow.jobs.trigger.if, /github\.run_attempt == 1/);
  assert.match(workflow.jobs.check.if, /github\.ref == 'refs\/heads\/main'/);
  for (const job of Object.values(workflow.jobs)) {
    const step = job.steps.at(-1);
    assert.equal(step.run, "node scripts/integration-weekly-trigger.mjs");
    assert.ok(Object.values(step.env).every((value) => !/inputs\./.test(String(value))), "no secret comes from inputs");
  }
});
