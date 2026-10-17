import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs the real script offline: a preload reroutes its fixed TEST hosts to a local fake.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/integration-test-locale.mjs");
const preload = path.join(mkdtempSync(path.join(tmpdir(), "test-locale-")), "reroute.mjs");
writeFileSync(preload, `const real = globalThis.fetch;
globalThis.fetch = (url, init) => { const u = new URL(url);
  if (!['petalpal-backend-test.onrender.com', 'identitytoolkit.googleapis.com'].includes(u.host)) throw new Error('unexpected host ' + u.host);
  return real('http://127.0.0.1:' + process.env.FAKE_PORT + '/' + u.host + u.pathname + u.search, init); };`);
const PROJECT = "petalpal-integration-test";
const SECRET = { email: "tester@jastrevia.com", password: "synthetic-password-not-real", owner: "owner-secret-id" };
const token = (claims) => `h.${Buffer.from(JSON.stringify({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, email_verified: true, ...claims })).toString("base64url")}.s`;

async function run({ target = "zh-Hans", locale = "en", phrase = "SET-TEST-OWNER-LOCALE", project = PROJECT, claims = {}, needsProfile = false, putStatus = 200, signIn = null } = {}) {
  const state = { locale, requests: [], puts: [] };
  const idToken = token(claims);
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const [, host, ...rest] = req.url.split("/");
    const route = "/" + rest.join("/");
    state.requests.push(`${req.method} ${route.split("?")[0].replace(SECRET.owner, ":id")}`);
    const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };
    if (host === "identitytoolkit.googleapis.com") {
      if (!signIn) return send(200, { idToken });
      res.writeHead(signIn.status, { "Content-Type": "application/json" }); return res.end(signIn.raw ?? JSON.stringify(signIn.body));
    }
    if (req.headers.authorization !== `Bearer ${idToken}`) return send(401, {});
    if (route === "/auth/session") return send(200, { needsProfile });
    if (route === "/session?view=metadata") return send(200, { user: { id: SECRET.owner, preferredLocale: state.locale } });
    if (route === `/users/${SECRET.owner}/profile` && req.method === "PUT") {
      const body = JSON.parse(raw); state.puts.push(body);
      if (putStatus !== 200) return send(putStatus, {});
      state.locale = body.preferredLocale; return send(200, { user: { id: SECRET.owner, preferredLocale: state.locale } });
    }
    return send(404, {});
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["--import", preload, script], { env: {
    PATH: process.env.PATH, FAKE_PORT: String(server.address().port), AUTHORIZATION_PHRASE: phrase, TARGET_LOCALE: target,
    EXPO_PUBLIC_FIREBASE_API_KEY: "synthetic-key", EXPO_PUBLIC_FIREBASE_PROJECT_ID: project,
    INTEGRATION_TEST_EMAIL: SECRET.email, INTEGRATION_TEST_PASSWORD: SECRET.password } });
  let output = ""; child.stdout.on("data", (d) => { output += d; }); child.stderr.on("data", (d) => { output += d; });
  const code = await new Promise((resolve) => child.on("close", resolve));
  await new Promise((resolve) => server.close(resolve));
  for (const value of [idToken, SECRET.email, SECRET.password, SECRET.owner]) assert.ok(!output.includes(value), "no secrets or owner id in output");
  return { code, output: output.trim(), state };
}

test("switches en -> zh-Hans with exactly one profile update and one read-back", async () => {
  const { code, output, state } = await run();
  assert.equal(code, 0, output);
  assert.equal(output, "PASS: preferredLocale en -> zh-Hans (update 200, read-back 200)");
  assert.deepEqual(state.puts, [{ preferredLocale: "zh-Hans" }]);
  assert.deepEqual(state.requests, ["POST /v1/accounts:signInWithPassword", "POST /auth/session", "GET /session", "PUT /users/:id/profile", "GET /session"]);
});

test("restores zh-Hans -> en the same way", async () => {
  const { code, output, state } = await run({ target: "en", locale: "zh-Hans" });
  assert.equal(code, 0, output);
  assert.deepEqual(state.puts, [{ preferredLocale: "en" }]);
});

test("no write when already at the target or at an unexpected locale", async () => {
  const same = await run({ locale: "zh-Hans" });
  assert.equal(same.code, 0);
  assert.match(same.output, /NO CHANGE: preferredLocale is already zh-Hans; no write/);
  assert.deepEqual(same.state.puts, []);
  const other = await run({ locale: "fr-CA" });
  assert.equal(other.code, 2);
  assert.match(other.output, /STOP: preferredLocale is fr-CA, expected en; no write/);
  assert.deepEqual(other.state.puts, []);
});

test("nothing is sent without the phrase, a valid target or the TEST project", async () => {
  for (const options of [{ phrase: "" }, { target: "zh-Hant" }, { project: "petalpal-b212c" }]) {
    const { code, output, state } = await run(options);
    assert.equal(code, 2);
    assert.match(output, /nothing was sent/);
    assert.deepEqual(state.requests, []);
  }
});

test("no write for an unverified identity or a missing profile", async () => {
  for (const options of [{ claims: { email_verified: false } }, { claims: { aud: "petalpal-b212c" } }, { needsProfile: true }]) {
    const { code, output, state } = await run(options);
    assert.equal(code, 2);
    assert.match(output, /no write/);
    assert.deepEqual(state.puts, []);
  }
});

test("a failed update is reported once and never retried", async () => {
  const { code, output, state } = await run({ putStatus: 500 });
  assert.equal(code, 1);
  assert.match(output, /^FAIL: preferredLocale en -> zh-Hans \(update 500, read-back 200, now unconfirmed\)$/);
  assert.equal(state.puts.length, 1);
  assert.equal(state.locale, "en");
});

test("sign-in failures print only an allowlisted Firebase code and send nothing to the backend", async () => {
  const cases = [
    [{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT",
      details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }] } }, "API_KEY_INVALID"],
    [{ error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" } }, "INVALID_LOGIN_CREDENTIALS"],
    [{ error: { code: 400, message: "USER_DISABLED" } }, "USER_DISABLED"],
    [{ error: { code: 400, message: "TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled" } }, "TOO_MANY_ATTEMPTS_TRY_LATER"],
    [{ error: { code: 400, message: "SOMETHING_NEW for tester@jastrevia.com" } }, "UNKNOWN"],
    [null, "UNKNOWN", "not json"],
  ];
  for (const [body, code, raw] of cases) {
    const { code: exit, output, state } = await run({ signIn: { status: 400, body, raw } });
    assert.equal(exit, 2);
    assert.equal(output, `STOP: TEST Firebase sign-in failed (HTTP 400 ${code}); no write`);
    assert.deepEqual(state.requests, ["POST /v1/accounts:signInWithPassword"], "no backend request after a failed sign-in");
    assert.doesNotMatch(output, /API key not valid|Access to this account|SOMETHING_NEW|not json/);
  }
});
