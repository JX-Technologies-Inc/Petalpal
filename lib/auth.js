import prisma from "./prisma.js";
import { verifyFirebaseIdToken } from "./firebase-admin.js";
import { logServerError } from "./security-log.js";
import { emitSecurityEvent } from "./security-events.js";

let tokenVerifier = verifyFirebaseIdToken;

export function setFirebaseTokenVerifierForTests(verifier) {
  tokenVerifier = verifier || verifyFirebaseIdToken;
}

function readBearerToken(header) {
  if (typeof header !== "string") return null;
  return header.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

function safeTokenMetadata(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1].length > 16_384) return { malformed: true };
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      issuer: typeof claims.iss === "string" && claims.iss.length <= 256 ? claims.iss : null,
      audience: typeof claims.aud === "string" && claims.aud.length <= 128 ? claims.aud : null,
      expirationTimestamp: Number.isSafeInteger(claims.exp) ? claims.exp : null
    };
  } catch {
    return { malformed: true };
  }
}

function tokenFailureReason(error, metadata, expectedProjectId) {
  if (error?.code === "app/invalid-credential" || error?.code === "auth/insufficient-permission") return "admin_credential_unavailable";
  if (error?.code === "FIREBASE_ADMIN_PROJECT_MISMATCH") return "admin_project_mismatch";
  if (metadata.malformed) return "malformed_token";
  if (metadata.audience && metadata.audience !== expectedProjectId) return "wrong_audience";
  if (metadata.issuer && metadata.issuer !== `https://securetoken.google.com/${expectedProjectId}`) return "wrong_issuer";
  if (metadata.expirationTimestamp && metadata.expirationTimestamp <= Math.floor(Date.now() / 1000)) return "expired_token";
  if (error?.code === "auth/id-token-expired") return "expired_token";
  if (error?.code === "auth/id-token-revoked") return "revoked_token";
  if (error?.code === "auth/invalid-id-token" || error?.code === "auth/argument-error") return "invalid_token";
  return "verification_error";
}

function safeFirebaseError(error, token) {
  const code = typeof error?.code === "string" && /^[a-z][a-z0-9/-]{0,80}$/i.test(error.code)
    ? error.code
    : null;
  const message = String(error?.message || "Firebase verification failed")
    .replaceAll(token.length > 16 ? token : "\u0000", "[redacted-token]")
    .replace(/AIza[\w-]{20,}/g, "[redacted-api-key]")
    .replace(/(?:oobCode|password|refreshToken|private_key)=\S+/gi, "[redacted-credential]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted-private-key]")
    .slice(0, 500);
  return { code, message };
}

export async function authenticateFirebaseIdentity(req, res, next) {
  const token = readBearerToken(req.get("authorization"));
  if (!token) {
    emitSecurityEvent({ eventType: "authentication_failure", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: "missing_token" });
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = await tokenVerifier(token);
    req.firebase = {
      uid: decoded.uid,
      email: decoded.email || null,
      emailVerified: decoded.email_verified === true,
      name: decoded.name || null,
      picture: decoded.picture || null,
      provider: decoded.firebase?.sign_in_provider || null
    };
    return next();
  } catch (error) {
    const expectedProjectId = process.env.FIREBASE_PROJECT_ID || "petalpal-b212c";
    const metadata = safeTokenMetadata(token);
    const reason = tokenFailureReason(error, metadata, expectedProjectId);
    const firebaseError = safeFirebaseError(error, token);
    console.info("Firebase token verification failed", { ...metadata, expectedProjectId, reason, firebaseErrorCode: firebaseError.code, firebaseErrorMessage: firebaseError.message });
    emitSecurityEvent({ eventType: "authentication_failure", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: reason });
    const diagnostics = process.env.FIREBASE_AUTH_DIAGNOSTICS === "1" ? {
      firebaseErrorCode: firebaseError.code,
      firebaseErrorMessage: firebaseError.message,
      reason
    } : {};
    if (reason === "admin_credential_unavailable" || reason === "admin_project_mismatch") {
      return res.status(503).json({ error: "Authentication service unavailable", ...diagnostics });
    }
    return res.status(401).json({ error: "Invalid or expired Firebase token", ...diagnostics });
  }
}

export async function authenticateRequest(req, res, next) {
  return authenticateFirebaseIdentity(req, res, async () => {
    try {
      if (!req.firebase.emailVerified) {
        emitSecurityEvent({ eventType: "authentication_failure", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: "email_unverified" });
        return res.status(403).json({ error: "Verified email required" });
      }
      const user = await prisma.user.findUnique({
        where: { firebaseUid: req.firebase.uid },
        select: { id: true }
      });
      if (!user) {
        emitSecurityEvent({ eventType: "authentication_failure", outcome: "denied", correlationId: req.requestId, routeClass: req.path, safeReason: "profile_not_found" });
        return res.status(403).json({ error: "PetalPal profile setup required" });
      }
      req.auth = { userId: user.id, firebaseUid: req.firebase.uid };
      return next();
    } catch (error) {
      logServerError("Authentication profile lookup failed", error);
      return res.status(503).json({ error: "Authentication service unavailable" });
    }
  });
}

export async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token ||
    readBearerToken(socket.handshake.headers.authorization);
  if (!token) return next(new Error("Authentication required"));

  try {
    const decoded = await tokenVerifier(token);
    if (decoded.email_verified !== true) {
      return next(new Error("Verified email required"));
    }
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true }
    });
    if (!user) return next(new Error("PetalPal profile setup required"));
    socket.data.currentUserId = user.id;
    socket.data.firebaseUid = decoded.uid;
    return next();
  } catch {
    return next(new Error("Invalid or expired Firebase token"));
  }
}

export function requireOwnUser(req, res, userId) {
  if (String(req.auth?.userId || "") !== String(userId || "")) {
    emitSecurityEvent({ eventType: "authorization_denial", outcome: "denied", correlationId: req.requestId, routeClass: req.path, resourceClass: "owner_resource", safeReason: "owner_mismatch", actorId: req.auth?.userId });
    res.status(403).json({ error: "You are not authorized to modify this user" });
    return false;
  }
  return true;
}
