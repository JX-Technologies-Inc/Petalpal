import { logServerError } from "./security-log.js";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const MAX_JSON_DEPTH = 20;
const MAX_JSON_KEYS = 1000;
const MAX_JSON_ARRAY_LENGTH = 1000;

function exceedsJsonComplexity(value) {
  const stack = [{ value, depth: 0 }];
  let keys = 0;

  while (stack.length > 0) {
    const { value: current, depth } = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (depth >= MAX_JSON_DEPTH) return true;
    if (Array.isArray(current)) {
      if (current.length > MAX_JSON_ARRAY_LENGTH) return true;
      for (const item of current) stack.push({ value: item, depth: depth + 1 });
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      keys += 1;
      if (keys > MAX_JSON_KEYS) return true;
      stack.push({ value: child, depth: depth + 1 });
    }
  }

  return false;
}

export function requireJsonObject(req, res, next) {
  if (BODY_METHODS.has(req.method) && req.body === undefined) {
    req.body = {};
  }
  if (
    BODY_METHODS.has(req.method) &&
    req.is("application/json") &&
    req.body !== undefined &&
    (req.body === null || Array.isArray(req.body) || typeof req.body !== "object")
  ) {
    return res.status(400).json({ error: "JSON body must be an object" });
  }
  if (BODY_METHODS.has(req.method) && exceedsJsonComplexity(req.body)) {
    return res.status(413).json({ error: "JSON body is too complex" });
  }
  return next();
}

export function endpointNotFound(_req, res) {
  return res.status(404).json({ error: "Endpoint not found" });
}

export function handleHttpError(error, _req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  logServerError("Unhandled request error", error);
  return res.status(500).json({ error: "Internal server error" });
}
