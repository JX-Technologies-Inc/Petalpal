import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs the real Phase A script offline: a preload reroutes its fixed TEST hosts to a
// local fake that mirrors the backend's validation order. No network.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/integration-weekly-acceptance.mjs");
const preload = path.join(mkdtempSync(path.join(tmpdir(), "weekly-preflight-")), "reroute.mjs");
writeFileSync(preload, `const real = globalThis.fetch;
globalThis.fetch = (url, init) => { const u = new URL(url);
  if (!['petalpal-backend-test.onrender.com', 'identitytoolkit.googleapis.com'].includes(u.host)) throw new Error('unexpected host ' + u.host);
  return real('http://127.0.0.1:' + process.env.FAKE_PORT + '/' + u.host + u.pathname + u.search, init); };`);
const PROJECT = "petalpal-integration-test";
const SECRET = { email: "tester@jastrevia.com", password: "synthetic-password-not-real" };
const TOKEN = `h.${Buffer.from(JSON.stringify({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, email_verified: true })).toString("base64url")}.s`;

async function run({ consent = false, acceptsOwnerField = false } = {}) {
  const state = { requests: [], enqueued: 0 };
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const [, host, ...rest] = req.url.split("/");
    const route = "/" + rest.join("/");
    state.requests.push(`${req.method} ${route.split("?")[0]}`);
    const send = (status) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end("{}"); };
    if (host === "identitytoolkit.googleapis.com") { res.writeHead(200); return res.end(JSON.stringify({ idToken: TOKEN })); }
    if (route === "/session") return send(200);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401);
    if (/^\/users\/[^/]+\/ai-consent$/.test(route)) return send(403);
    if (route === "/ai/reports/weekly/trigger") {
      if (Object.keys(body).some(k => k !== "localDate") && !acceptsOwnerField) return send(400);
      if (body.localDate && new Date(body.localDate) > new Date()) return send(400);
      state.enqueued++; return send(consent ? 502 : 403); // would reach the consent transaction
    }
    if (route.startsWith("/ai/reports?")) return send(consent ? 200 : 403);
    if (route.startsWith("/ai/reports/weekly/")) return send(consent ? 404 : 403);
    return send(500);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["--import", preload, script], { env: {
    PATH: process.env.PATH, FAKE_PORT: String(server.address().port),
    EXPO_PUBLIC_FIREBASE_API_KEY: "synthetic-key", EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
    INTEGRATION_TEST_EMAIL: SECRET.email, INTEGRATION_TEST_PASSWORD: SECRET.password } });
  let output = ""; child.stdout.on("data", d => { output += d; }); child.stderr.on("data", d => { output += d; });
  const code = await new Promise(resolve => child.on("close", resolve));
  await new Promise(resolve => server.close(resolve));
  for (const value of [TOKEN, SECRET.email, SECRET.password]) assert.ok(!output.includes(value), "secrets must never be printed");
  return { code, output, state };
}

for (const consent of [false, true]) {
  test(`Phase A passes read-only with consent ${consent ? "granted" : "not granted"}: no write method, no accepted trigger`, async () => {
    const { code, output, state } = await run({ consent });
    assert.equal(code, 0, output);
    assert.match(output, new RegExp(`8/8 checks passed; memory consent ${consent ? "granted" : "not granted"}; writes 0; provider calls 0`));
    assert.equal(state.enqueued, 0, "no authenticated trigger may pass validation");
    assert.ok(!state.requests.some(r => /^(PUT|DELETE|PATCH) /.test(r) || r === "POST /events"));
  });
}

test("a backend that accepts caller ownership fields fails the preflight", async () => {
  const { code, output } = await run({ acceptsOwnerField: true });
  assert.equal(code, 1);
  assert.match(output, /FAIL trigger rejects caller-chosen ownership fields/);
});
