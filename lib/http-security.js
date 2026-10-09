import { isWebShellRequest } from "./web-shell.js";
import path from "node:path";

const PRIVATE_PREFIX = /^\/(?:auth|session|users|ai|events|speech|internal|api|dev|friends|reports|analyze-mood|visit|leave|register|login|legacy-register-disabled|legacy-login-disabled)(?:\/|$)/i;

export function securityHeaders(req, env = process.env) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
  if (env.NODE_ENV !== "production") return headers;
  // Render terminates TLS. Read its HTTPS signal only on that platform,
  // without widening Express's trust-proxy/authentication boundary.
  if (req.secure || req.socket?.encrypted ||
      (env.RENDER === "true" && req.headers?.["x-forwarded-proto"] === "https")) {
    headers["Strict-Transport-Security"] = "max-age=15552000";
  }
  let websocketOrigin = "";
  try {
    const origin = new URL(`https://${req.headers.host}`);
    if (/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(req.headers.host) &&
        origin.host === req.headers.host && !origin.username && !origin.password) {
      websocketOrigin = `wss://${origin.host}`;
    }
  } catch { /* Invalid hosts cannot expand the policy. */ }
  // Production Expo scripts/assets and API are same-origin. Firebase Auth
  // loads Google API scripts and its project iframe. React uses inline styles.
  headers["Content-Security-Policy"] = [
    "default-src 'self'",
    `script-src 'self'${isWebShellRequest(req) ? " 'wasm-unsafe-eval'" : ""} https://apis.google.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self' ${websocketOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://petalpal-b212c.firebaseapp.com`,
    "frame-src https://petalpal-b212c.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
  return headers;
}

export function privateResponse(req) {
  const pathname = req.path;
  return PRIVATE_PREFIX.test(pathname) || pathname === "/finish-sign-in" ||
    (!["GET", "HEAD"].includes(req.method)) ||
    (pathname !== "/" && !path.extname(pathname));
}

export function httpSecurity(req, res, next) {
  res.set(securityHeaders(req));
  if (privateResponse(req)) res.set("Cache-Control", "no-store");
  next();
}
