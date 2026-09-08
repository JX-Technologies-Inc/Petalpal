import prisma from "./prisma.js";
import { verifyFirebaseIdToken } from "./firebase-admin.js";
import { logServerError } from "./security-log.js";

let tokenVerifier = verifyFirebaseIdToken;

export function setFirebaseTokenVerifierForTests(verifier) {
  tokenVerifier = verifier || verifyFirebaseIdToken;
}

function readBearerToken(header) {
  if (typeof header !== "string") return null;
  return header.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export async function authenticateFirebaseIdentity(req, res, next) {
  const token = readBearerToken(req.get("authorization"));
  if (!token) return res.status(401).json({ error: "Authentication required" });

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
  } catch {
    return res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
}

export async function authenticateRequest(req, res, next) {
  return authenticateFirebaseIdentity(req, res, async () => {
    try {
      if (!req.firebase.emailVerified) {
        return res.status(403).json({ error: "Verified email required" });
      }
      const user = await prisma.user.findUnique({
        where: { firebaseUid: req.firebase.uid },
        select: { id: true }
      });
      if (!user) {
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
    res.status(403).json({ error: "You are not authorized to modify this user" });
    return false;
  }
  return true;
}
