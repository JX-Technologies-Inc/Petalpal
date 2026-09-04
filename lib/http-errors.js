const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

export function requireJsonObject(req, res, next) {
  if (
    BODY_METHODS.has(req.method) &&
    req.is("application/json") &&
    req.body !== undefined &&
    (req.body === null || Array.isArray(req.body) || typeof req.body !== "object")
  ) {
    return res.status(400).json({ error: "JSON body must be an object" });
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

  console.error("Unhandled request error:", error);
  return res.status(500).json({ error: "Internal server error" });
}
