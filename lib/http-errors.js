import { logServerError } from "./security-log.js";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const MAX_JSON_DEPTH = 20;
const MAX_JSON_KEYS = 1000;
const MAX_JSON_ARRAY_LENGTH = 1000;

export function jsonObjectIssue(value) {
  const stack = [{ value, depth: 0 }];
  let keys = 0;
  let dangerous = false;

  while (stack.length > 0) {
    const { value: current, depth } = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (depth >= MAX_JSON_DEPTH) return "TOO_COMPLEX";
    if (Array.isArray(current)) {
      if (current.length > MAX_JSON_ARRAY_LENGTH) return "TOO_COMPLEX";
      for (const item of current) stack.push({ value: item, depth: depth + 1 });
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) dangerous = true;
      keys += 1;
      if (keys > MAX_JSON_KEYS) return "TOO_COMPLEX";
      stack.push({ value: child, depth: depth + 1 });
    }
  }

  return dangerous ? "DANGEROUS_KEYS" : null;
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
  const issue = jsonObjectIssue(req.body);
  if (issue === "TOO_COMPLEX") {
    return res.status(413).json({ error: "JSON body is too complex" });
  }
  if (issue === "DANGEROUS_KEYS") {
    return res.status(400).json({ error: "Unsafe JSON object keys" });
  }
  return next();
}

// Opt-in strict bodies only: legacy endpoints retain explicit field selection.
export function allowBodyFields(fields) {
  const allowed = new Set(fields);
  return (req, res, next) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
        Object.keys(req.body).some(key => !allowed.has(key))) {
      return res.status(400).json({ error: "Unexpected request fields" });
    }
    return next();
  };
}

export function endpointNotFound(_req, res) {
  return res.status(404).json({ error: "Endpoint not found" });
}

export function handleHttpError(error, _req, res, next) {
  if (res.headersSent) return next(error);

  // Express rejects malformed percent-encoded route parameters with status 400.
  if (error instanceof URIError && error.status === 400) {
    return res.status(400).json({ error: "Invalid request path" });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  logServerError("Unhandled request error", error);
  return res.status(500).json({ error: "Internal server error" });
}
