import assert from "node:assert/strict";
import test from "node:test";

import { createRateLimiter, rateLimiters } from "../../lib/rate-limit.js";

function run(middleware, request) {
  return new Promise((resolve) => {
    const headers = {};
    const response = {
      set(name, value) {
        if (typeof name === "object") Object.assign(headers, name);
        else headers[name] = value;
        return this;
      },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, headers }); }
    };
    middleware(request, response, () => resolve({ statusCode: 200, headers }));
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
