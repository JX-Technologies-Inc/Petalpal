import { randomUUID } from "node:crypto";

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

export function requestId() { return randomUUID(); }

export function emitSecurityEvent(input = {}) {
  try {
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
