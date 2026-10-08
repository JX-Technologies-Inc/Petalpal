import { randomUUID } from "node:crypto";
import { securityMetrics } from './security-metrics.js';

const EVENT_TYPES = new Set([
  "authentication_failure", "authorization_denial", "rate_limit_exceeded",
  "server_error", "account_deletion", "ai_consent_changed", "ai_provider_failure",
  "database_failure"
]);
const OUTCOMES = new Set(["denied", "failed", "allowed", "completed", "observed"]);
const MAX = 128;

function boundedString(value) {
  return typeof value === "string" && value.length <= MAX ? value : undefined;
}

// Express route patterns are registered by the app; URL paths/parameters are untrusted.
// Global middleware runs before a route is matched, so use a fixed fallback there.
export function securityRouteClass(req) {
  return boundedString(req.route?.path) ?? "unmatched";
}

export function requestId() { return randomUUID(); }

export function emitSecurityEvent(input = {}) {
  try {
    const counter = { authentication_failure: 'auth_rejected', authorization_denial: 'authorization_rejected',
      rate_limit_exceeded: 'security_rate_limited' }[input.eventType];
    if (counter) securityMetrics.increment(counter);
    const event = {
      timestamp: new Date().toISOString(),
      eventType: EVENT_TYPES.has(input.eventType) ? input.eventType : "server_error",
      outcome: OUTCOMES.has(input.outcome) ? input.outcome : "observed"
    };
    for (const key of ["correlationId", "routeClass", "resourceClass", "safeReason", "safeErrorCode", "actorId", "targetClass"]) {
      const value = boundedString(input[key]);
      if (value !== undefined) event[key] = value;
    }
    if (Number.isInteger(input.count) && input.count >= 0 && input.count <= 10000) event.count = input.count;
    for (const key of ["fallbackUsed", "success"]) if (typeof input[key] === "boolean") event[key] = input[key];
    console.log(JSON.stringify(event));
  } catch {
    // Security telemetry is fail-open and must never affect the protected operation.
  }
}
