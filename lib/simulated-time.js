import { aiAsyncExecutionMode } from "./ai-async-dispatch.js";
import { localMidnightToUtc, normalizeIanaTimezone } from "./ai-periods.js";
import { resolveDatabaseUrl } from "./database-isolation.js";
import { PRODUCTION_FIREBASE_PROJECT } from "./integration-environment.js";

// TEST-only logical clock for isolated local/ephemeral-CI runs. It assigns
// synthetic Event timestamps and Weekly report `asOf` values; it never changes
// the OS clock or global Date. Every check below must pass on every request, so
// a client flag or header alone is never sufficient. Production (NODE_ENV=
// production), hosted integration (PETALPAL_ENVIRONMENT) and Render runtimes are
// rejected before any other condition is evaluated.
export const SIMULATED_TIME_HEADER = "X-PetalPal-Simulated-Time";

const HOSTED_RUNTIME_VARIABLES = ["PETALPAL_ENVIRONMENT", "RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL"];
const TEST_DATABASE_NAME = /(?:^|[_-])test(?:$|[_-])/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;
const EARLIEST = Date.UTC(2020, 0, 1);
const LATEST = Date.UTC(2100, 0, 1);

function testDatabaseName(env) {
  try {
    return TEST_DATABASE_NAME.test(decodeURIComponent(new URL(env.DEV_DATABASE_URL).pathname.slice(1)).toLowerCase());
  } catch {
    return false;
  }
}

// Returns null when allowed, otherwise a non-sensitive reason code.
export function simulatedTimeDenial({ env = process.env, firebase = null } = {}) {
  if (env.PETALPAL_SIMULATED_TIME !== "1") return "DISABLED";
  if (env.NODE_ENV === "production") return "PRODUCTION_RUNTIME";
  if (HOSTED_RUNTIME_VARIABLES.some((name) => env[name] !== undefined)) return "HOSTED_RUNTIME";
  if (env.NATIVE_SECURITY_TEST !== undefined) return "OTHER_TEST_HARNESS";
  // Same resolver lib/prisma.js uses: localhost only, never DATABASE_URL.
  try {
    resolveDatabaseUrl(env);
  } catch {
    return "DATABASE_NOT_ISOLATED";
  }
  if (!testDatabaseName(env)) return "DATABASE_NOT_ISOLATED";
  if (!env.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID === PRODUCTION_FIREBASE_PROJECT) return "FIREBASE_NOT_ISOLATED";
  try {
    if (aiAsyncExecutionMode(env) !== "manual") return "ASYNC_DISPATCH_ENABLED";
  } catch {
    return "ASYNC_DISPATCH_ENABLED";
  }
  const allowed = new Set(String(env.PETALPAL_SIMULATED_TIME_EMAILS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  const email = typeof firebase?.email === "string" ? firebase.email.trim().toLowerCase() : "";
  if (!email || firebase?.emailVerified !== true || !allowed.has(email)) return "IDENTITY_NOT_ALLOWED";
  return null;
}

function invalidSimulatedTime() {
  const error = new Error("Simulated time must be YYYY-MM-DD or a UTC ISO-8601 instant");
  error.code = "INVALID_SIMULATED_TIME";
  return error;
}

// YYYY-MM-DD resolves to local midday in the owner's IANA timezone; a UTC
// instant (trailing Z) is used exactly, for period-boundary fixtures.
export function parseSimulatedTime(value, timezone) {
  const text = typeof value === "string" ? value.trim() : "";
  let instant;
  if (DATE_ONLY.test(text)) {
    const zone = normalizeIanaTimezone(timezone);
    if (!zone) throw invalidSimulatedTime();
    try {
      instant = new Date(localMidnightToUtc(text, zone).getTime() + 12 * 60 * 60 * 1000);
    } catch {
      throw invalidSimulatedTime();
    }
  } else if (UTC_INSTANT.test(text)) {
    instant = new Date(text);
    if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 16) !== text.slice(0, 16)) throw invalidSimulatedTime();
  } else {
    throw invalidSimulatedTime();
  }
  if (Number.isNaN(instant.getTime()) || instant.getTime() < EARLIEST || instant.getTime() >= LATEST) throw invalidSimulatedTime();
  return instant;
}
