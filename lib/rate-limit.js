function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

import { ipKeyGenerator } from "express-rate-limit";
import { emitSecurityEvent } from "./security-events.js";

export function createRateLimiter({
  limit,
  windowMs,
  key = (req) => req.auth?.userId || req.ip,
  now = Date.now,
  maxKeys = 10_000,
  skipSuccessfulRequests = false
}) {
  const requests = new Map();

  return (req, res, next) => {
    const timestamp = now();
    const identifier = String(key(req) || "unknown");
    let entry = requests.get(identifier);

    if (!entry && requests.size >= maxKeys) {
      for (const [storedKey, stored] of requests) {
        if (timestamp >= stored.resetAt) requests.delete(storedKey);
      }
      if (requests.size >= maxKeys) {
        // Never reset an active attacker's budget to make room for another key.
        const resetAt = Math.min(...Array.from(requests.values(), stored => stored.resetAt));
        res.set("Retry-After", String(Math.max(1, Math.ceil((resetAt - timestamp) / 1000))));
        emitSecurityEvent({ eventType: "rate_limit_exceeded", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: "rate_limit", resourceClass: "rate_limiter" });
        return res.status(429).json({ error: "Too many requests. Try again later." });
      }
    }

    if (!entry || timestamp >= entry.resetAt) {
      entry = { count: 0, resetAt: timestamp + windowMs };
      requests.set(identifier, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000));
    res.set({
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(remaining),
      "RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000))
    });

    if (entry.count > limit) {
      emitSecurityEvent({ eventType: "rate_limit_exceeded", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: "rate_limit", resourceClass: "rate_limiter", count: entry.count });
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    if (skipSuccessfulRequests) {
      res.once("finish", () => {
        if (res.statusCode < 400 && requests.get(identifier) === entry) {
          entry.count = Math.max(0, entry.count - 1);
          if (entry.count === 0) requests.delete(identifier);
        }
      });
    }

    // ponytail: in-process limits fit the current single-instance MVP; use a shared
    // store when Render runs multiple instances or limits must survive restarts.
    return next();
  };
}

export function rateLimiters(env = process.env) {
  const windowMs = positiveInteger(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  return {
    general: createRateLimiter({
      limit: positiveInteger(env.RATE_LIMIT_GENERAL_MAX, 300),
      windowMs
    }),
    auth: createRateLimiter({
      limit: positiveInteger(env.RATE_LIMIT_AUTH_MAX, 20),
      windowMs,
      key: (req) => ipKeyGenerator(req.ip),
      skipSuccessfulRequests: true
    }),
    authAccount: createRateLimiter({
      limit: positiveInteger(env.RATE_LIMIT_AUTH_ACCOUNT_MAX, 20),
      windowMs,
      // Call only after token verification. Never trust a submitted email/UID.
      key: (req) => req.firebase.uid
    }),
    ai: createRateLimiter({
      limit: positiveInteger(env.RATE_LIMIT_AI_MAX, 30),
      windowMs
    })
  };
}
