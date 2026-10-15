import assert from "node:assert/strict";
import test from "node:test";

import { createRateLimiter, rateLimiters } from "../../lib/rate-limit.js";

function run(middleware, request, finishStatus = 401) {
  return new Promise((resolve) => {
    const headers = {};
    const finishes = [];
    const response = {
      once(event, callback) { if (event === "finish") finishes.push(callback); },
      set(name, value) {
        if (typeof name === "object") Object.assign(headers, name);
        else headers[name] = value;
        return this;
      },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, headers }); }
    };
    middleware(request, response, () => {
      response.statusCode = finishStatus;
      finishes.forEach(callback => callback());
      resolve({ statusCode: 200, headers });
    });
  });
}

test("rate limiter rejects requests over the limit and resets with headers", async () => {
  let timestamp = 1_000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 10_000,
    key: (req) => req.ip,
    now: () => timestamp
  });

  assert.equal((await run(limiter, { ip: "one" })).statusCode, 200);
  assert.equal((await run(limiter, { ip: "one" })).headers["RateLimit-Remaining"], "0");
  const blocked = await run(limiter, { ip: "one" });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["Retry-After"], "10");
  assert.equal((await run(limiter, { ip: "two" })).statusCode, 200);

  timestamp += 10_000;
  assert.equal((await run(limiter, { ip: "one" })).statusCode, 200);
});

test("configured limiters separate auth IP and authenticated user buckets", async () => {
  const { auth, general, ai } = rateLimiters({
    RATE_LIMIT_WINDOW_MS: "1000",
    RATE_LIMIT_GENERAL_MAX: "1",
    RATE_LIMIT_AUTH_MAX: "1",
    RATE_LIMIT_AI_MAX: "1"
  });
  const first = { ip: "shared", auth: { userId: "user-1" } };
  const second = { ip: "shared", auth: { userId: "user-2" } };

  assert.equal((await run(auth, first)).statusCode, 200);
  assert.equal((await run(auth, second)).statusCode, 429);
  assert.equal((await run(general, first)).statusCode, 200);
  assert.equal((await run(general, second)).statusCode, 200);
  assert.equal((await run(ai, first)).statusCode, 200);
  assert.equal((await run(ai, first)).statusCode, 429);
});


test("auth failures group IPv6 addresses and IPv4-mapped equivalents; forwarded input does not set the bucket", async () => {
  const { auth } = rateLimiters({ RATE_LIMIT_AUTH_MAX: "1" });
  assert.equal((await run(auth, { ip: "2001:db8:abcd:1200::1" })).statusCode, 200);
  assert.equal((await run(auth, { ip: "2001:db8:abcd:12ff::2" })).statusCode, 429);
  assert.equal((await run(auth, { ip: "2001:db8:abcd:1300::1" })).statusCode, 200);
  assert.equal((await run(auth, { ip: "192.0.2.1", headers: { "x-forwarded-for": "fake-one" } })).statusCode, 200);
  assert.equal((await run(auth, { ip: "::ffff:192.0.2.1", headers: { "x-forwarded-for": "fake-two" } })).statusCode, 429);
});

test("successful session setup does not exhaust the shared NAT failure budget", async () => {
  const { auth } = rateLimiters({ RATE_LIMIT_AUTH_MAX: "1" });
  for (let i = 0; i < 4; i++) assert.equal((await run(auth, { ip: "shared-nat" }, 200)).statusCode, 200);
  assert.equal((await run(auth, { ip: "shared-nat" }, 401)).statusCode, 200);
  assert.equal((await run(auth, { ip: "shared-nat" }, 200)).statusCode, 429);
});

test("verified UID session budget survives IP rotation without using submitted account fields", async () => {
  const { authAccount } = rateLimiters({ RATE_LIMIT_AUTH_ACCOUNT_MAX: "1" });
  const first = { ip: "one", firebase: { uid: "verified-one" }, body: { email: "victim@example.test", firebaseUid: "victim" } };
  assert.equal((await run(authAccount, first, 200)).statusCode, 200);
  assert.equal((await run(authAccount, { ...first, ip: "two" }, 200)).statusCode, 429);
  assert.equal((await run(authAccount, { ...first, firebase: { uid: "victim" } }, 200)).statusCode, 200);
});

test("capacity pressure cannot evict an active budget; expired buckets free capacity", async () => {
  let timestamp = 1000;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, key: req => req.ip, now: () => timestamp });
  await run(limiter, { ip: "attacker" }); await run(limiter, { ip: "other" });
  const rejected = await run(limiter, { ip: "new" });
  assert.equal(rejected.statusCode, 429); assert.equal(rejected.headers["Retry-After"], "1");
  assert.equal((await run(limiter, { ip: "attacker" })).statusCode, 429);
  timestamp = 2000;
  assert.equal((await run(limiter, { ip: "new" })).statusCode, 200);
});

test("admission counts successful shared-IP work independently of user/auth quotas", async () => {
  const { admission } = rateLimiters({ RATE_LIMIT_ADMISSION_MAX: "2", RATE_LIMIT_ADMISSION_WINDOW_MS: "5000" });
  const req = { ip: "192.0.2.50", auth: { userId: "one" } };
  assert.equal((await run(admission, req, 200)).statusCode, 200);
  assert.equal((await run(admission, { ...req, auth: { userId: "two" } }, 200)).statusCode, 200);
  const denied = await run(admission, { ...req, auth: { userId: "three" } });
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.headers["Retry-After"], "5");
  assert.equal((await run(admission, { ip: "192.0.2.51" })).statusCode, 200);
});

test("admission uses normalized IPs, ignores submitted identity/headers and groups IPv6 /56", async () => {
  const { admission } = rateLimiters({ RATE_LIMIT_ADMISSION_MAX: "1" });
  assert.equal((await run(admission, { ip: "192.0.2.1" })).statusCode, 200);
  assert.equal((await run(admission, { ip: "::ffff:c000:201", headers: { "x-forwarded-for": "192.0.2.2" }, body: { userId: "other" } })).statusCode, 429);
  assert.equal((await run(admission, { ip: "2001:db8:abcd:1200::1" })).statusCode, 200);
  assert.equal((await run(admission, { ip: "2001:0db8:abcd:12ff:0000:0000:0000:0002" })).statusCode, 429);
  assert.equal((await run(admission, { ip: "2001:db8:abcd:1300::1" })).statusCode, 200);
});

test("admission defaults to 1200/minute independently of the existing quota window", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { admission } = rateLimiters({ RATE_LIMIT_WINDOW_MS: "900000" });
  const first = await run(admission, { ip: "192.0.2.1" });
  assert.equal(first.headers["RateLimit-Limit"], "1200");
  assert.equal(first.headers["RateLimit-Reset"], "61");
  t.mock.timers.tick(60_000);
  assert.equal((await run(admission, { ip: "192.0.2.1" })).headers["RateLimit-Remaining"], "1199");
});

test("admission keeps at most 10000 active keys, retains budgets and reclaims expired capacity", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { admission } = rateLimiters({ RATE_LIMIT_ADMISSION_MAX: "1", RATE_LIMIT_ADMISSION_WINDOW_MS: "1000" });
  for (let i = 0; i < 10_000; i++) {
    assert.equal((await run(admission, { ip: `10.0.${i >> 8}.${i & 255}` })).statusCode, 200);
  }
  assert.equal((await run(admission, { ip: "192.0.2.1" })).statusCode, 429);
  assert.equal((await run(admission, { ip: "10.0.0.0" })).statusCode, 429);
  t.mock.timers.tick(1000);
  assert.equal((await run(admission, { ip: "192.0.2.1" })).statusCode, 200);
  assert.equal((await run(admission, { ip: "10.0.0.0" })).statusCode, 200);
});
