import assert from "node:assert/strict";
import test from "node:test";

import { endpointNotFound } from "../../lib/http-errors.js";
import { app } from "../../server.js";

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

test("HTTP boundary returns consistent JSON errors without changing business errors", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const malformed = await request(baseUrl, "/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.deepEqual(malformed, { status: 400, body: { error: "Invalid JSON body" } });

  const nonObject = await request(baseUrl, "/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "[]"
  });
  assert.deepEqual(nonObject, {
    status: 400,
    body: { error: "JSON body must be an object" }
  });

  const oversized = await request(baseUrl, "/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(33 * 1024) })
  });
  assert.deepEqual(oversized, {
    status: 413,
    body: { error: "Request body is too large" }
  });

  let missing;
  endpointNotFound({}, {
    status(status) { missing = { status }; return this; },
    json(body) { missing.body = body; }
  });
  assert.deepEqual(missing, { status: 404, body: { error: "Endpoint not found" } });

  const existingBusinessError = await request(baseUrl, "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.deepEqual(existingBusinessError, {
    status: 410,
    body: { error: "Use Firebase Authentication to log in" }
  });
});
