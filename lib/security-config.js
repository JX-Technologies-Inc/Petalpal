const ORIGIN_PATTERN = /^https?:\/\/[^\s/]+(?::\d+)?$/i;

function configuredOrigins(env = process.env) {
  return new Set(
    String(env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => ORIGIN_PATTERN.test(origin))
  );
}

export function isAllowedOrigin(origin, env = process.env) {
  if (!origin) return true;
  return configuredOrigins(env).has(origin);
}

export function trustProxySetting(env = process.env) {
  const value = String(env.TRUST_PROXY || "").trim();
  if (!value || value.toLowerCase() === "false") return false;
  if (value.toLowerCase() === "true") {
    throw new Error("TRUST_PROXY=true is not allowed; use a verified hop count or address list");
  }
  if (/^\d+$/.test(value)) return Number(value);
  if (value.includes("//")) {
    throw new Error("TRUST_PROXY must use proxy addresses, not URLs");
  }
  if (/^[a-z0-9.,:/ -]+$/i.test(value)) return value;
  throw new Error("TRUST_PROXY must be false, true, a hop count, or trusted proxy addresses");
}

export function assertAllowedOrigin(origin, env = process.env) {
  return !origin || isAllowedOrigin(origin, env);
}
