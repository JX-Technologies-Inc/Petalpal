import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs the real script offline: a preload reroutes its fixed TEST hosts to a local
// fake that mirrors the TEST backend's manual-mode Weekly behavior. No network.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/integration-weekly-acceptance.mjs");
const preload = path.join(mkdtempSync(path.join(tmpdir(), "weekly-acceptance-")), "reroute.mjs");
writeFileSync(preload, `const real = globalThis.fetch;
globalThis.fetch = (url, init) => { const u = new URL(url);
  if (!['petalpal-backend-test.onrender.com', 'identitytoolkit.googleapis.com'].includes(u.host)) throw new Error('unexpected host ' + u.host);
  return real('http://127.0.0.1:' + process.env.FAKE_PORT + '/' + u.host + u.pathname + u.search, init); };`);
const PROJECT = "petalpal-integration-test";
const SECRET = { email: "tester@jastrevia.com", password: "synthetic-password-not-real" };
const jwt = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const TOKEN = jwt({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, email_verified: true });

async function run({ phrase = "WRITE-TEST-WEEKLY-ACCEPTANCE", consent = false, triggerWithConsent = { status: 502, errorCode: "REPORT_NARRATIVE_PROVIDER_NOT_CONFIGURED" } } = {}) {
  const state = { consent, requests: [], events: 0 };
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const [, host, ...rest] = req.url.split("/");
    const route = "/" + rest.join("/");
    state.requests.push(`${req.method} ${route.split("?")[0]}`);
    const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };
    if (host === "identitytoolkit.googleapis.com") return send(200, { idToken: TOKEN });
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;
    if (route === "/session") return send(200, {});
    if (!authed) return send(401, { error: "Sign in" });
    if (route === "/auth/session") return send(200, { needsProfile: false });
    if (route === "/session?view=metadata") return send(200, { user: { id: "owner-1" } });
    const consentOwner = route.match(/^\/users\/([^/]+)\/ai-consent$/)?.[1];
    if (consentOwner) {
      if (consentOwner !== "owner-1") return send(403, {});
      if (req.method === "PUT") state.consent = body.aiProcessing === true && body.memoryEnabled === true && body.disclosureVersion === "ai-2026-10-15";
      return send(200, { aiProcessing: state.consent, personalization: state.consent, memoryEnabled: state.consent });
    }
    if (route === "/events") { state.events++; return send(201, { emotion: { status: "SKIPPED" }, memoryJob: state.consent ? { status: "PENDING" } : null }); }
    if (route === "/ai/reports/weekly/trigger") {
      if (!state.consent) return send(403, {});
      const { status, errorCode } = triggerWithConsent;
      return send(status, { periodKey: "2026-W41", job: { status: status === 502 ? "FAILED" : "SUCCEEDED" }, report: status === 502 ? null : { id: "r1" }, errorCode });
    }
    if (route.startsWith("/ai/reports?")) return send(200, { reports: [], nextCursor: null });
    if (route.startsWith("/ai/reports/weekly/")) return send(404, {});
    return send(500, {});
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["--import", preload, script], { env: {
    PATH: process.env.PATH, FAKE_PORT: String(server.address().port), AUTHORIZATION_PHRASE: phrase,
    EXPO_PUBLIC_FIREBASE_API_KEY: "synthetic-key", EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
    INTEGRATION_TEST_EMAIL: SECRET.email, INTEGRATION_TEST_PASSWORD: SECRET.password } });
  let output = ""; child.stdout.on("data", d => { output += d; }); child.stderr.on("data", d => { output += d; });
  const code = await new Promise(resolve => child.on("close", resolve));
  await new Promise(resolve => server.close(resolve));
  for (const value of [TOKEN, SECRET.email, SECRET.password]) assert.ok(!output.includes(value), "secrets must never be printed");
  return { code, output, state };
}

test("Weekly acceptance passes when the TEST trigger fails closed, and restores revoked consent", async () => {
  const { code, output, state } = await run();
  assert.equal(code, 0, output);
  assert.match(output, /12\/12 checks passed; provider calls attempted by this script: 0/);
  assert.equal(state.consent, false);
  assert.equal(state.events, 2);
});

test("a TEST trigger that generates a report (provider path present) fails, and consent is still revoked", async () => {
  const { code, output, state } = await run({ triggerWithConsent: { status: 200 } });
  assert.equal(code, 1);
  assert.match(output, /FAIL Weekly trigger fails closed before any provider call/);
  assert.equal(state.consent, false);
});

test("an unexpected granted-consent baseline stops before any write", async () => {
  const { code, output, state } = await run({ consent: true });
  assert.equal(code, 1);
  assert.match(output, /BLOCKED: expected revoked AI consent baseline/);
  assert.ok(!state.requests.some(r => r.startsWith("PUT") || r === "POST /events"));
  // Only the anonymous rejection probe, sent before the baseline read.
  assert.equal(state.requests.filter(r => r === "POST /ai/reports/weekly/trigger").length, 1);
});

test("without the write authorization phrase nothing is sent", async () => {
  const { code, output, state } = await run({ phrase: "" });
  assert.equal(code, 1);
  assert.match(output, /write authorization phrase missing/);
  assert.deepEqual(state.requests, []);
});
