import assert from "node:assert/strict";
import test from "node:test";
import { emitSecurityEvent } from "../../lib/security-events.js";
import { app } from "../../server.js";

function capture() {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));
  return { lines, restore: () => { console.log = original; } };
}

test("security events use an allowlist and exclude sensitive input", () => {
  const log = capture();
  try {
    emitSecurityEvent({
      eventType: "authentication_failure", outcome: "denied", correlationId: "req-1",
      routeClass: "/session", token: "secret-token", Authorization: "Bearer secret",
      body: { journal: "private journal", nested: { secret: "x" } },
      message: "private error", stack: "private stack", password: "pw",
      safeReason: "invalid", count: 10001, arbitrary: { leak: true }
    });
    assert.equal(log.lines.length, 1);
    const event = JSON.parse(log.lines[0]);
    assert.deepEqual(event, {
      timestamp: event.timestamp, eventType: "authentication_failure", outcome: "denied",
      correlationId: "req-1", routeClass: "/session", safeReason: "invalid"
    });
    for (const forbidden of ["token", "Authorization", "body", "message", "stack", "password", "arbitrary"]) {
      assert.equal(Object.hasOwn(event, forbidden), false);
    }
  } finally { log.restore(); }
});

test("security event fields are bounded and failure-isolated", () => {
  const log = capture();
  try {
    emitSecurityEvent({ eventType: "rate_limit_exceeded", outcome: "denied", routeClass: "x".repeat(129), count: -1, success: "yes", nested: {} });
    const event = JSON.parse(log.lines[0]);
    assert.equal(Object.hasOwn(event, "routeClass"), false);
    assert.equal(Object.hasOwn(event, "count"), false);
    assert.equal(Object.hasOwn(event, "success"), false);
  } finally { log.restore(); }
  const original = console.log;
  console.log = () => { throw new Error("logger unavailable"); };
  assert.doesNotThrow(() => emitSecurityEvent({ eventType: "server_error" }));
  console.log = original;
});

test("requests receive server-generated correlation IDs and emit the same ID", async (t) => {
  const log = capture();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => { log.restore(); await new Promise((resolve) => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/session`, { headers: { "X-Request-ID": "client-controlled" } });
  assert.equal(response.status, 401);
  const id = response.headers.get("x-request-id");
  assert.ok(id);
  assert.notEqual(id, "client-controlled");
  await new Promise((resolve) => setImmediate(resolve));
  const authEvent = log.lines.map((line) => JSON.parse(line)).find((event) => event.eventType === "authentication_failure");
  assert.equal(authEvent.correlationId, id);
});
