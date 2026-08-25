import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be set to a random value of at least 32 characters"
  );
}

const JWT_ISSUER = "petalpal-api";
const JWT_AUDIENCE = "petalpal-client";

export function createAccessToken(user) {
  return jwt.sign(
    { name: user.name },
    JWT_SECRET,
    {
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "2h",
      algorithm: "HS256"
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ["HS256"]
  });
}

function readBearerToken(header) {
  if (typeof header !== "string") {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export function authenticateRequest(req, res, next) {
  const token = readBearerToken(req.get("authorization"));

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

export function authenticateSocket(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    readBearerToken(socket.handshake.headers.authorization);

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const payload = verifyAccessToken(token);
    socket.data.currentUserId = payload.sub;
    return next();
  } catch {
    return next(new Error("Invalid or expired access token"));
  }
}

export function requireOwnUser(req, res, userId) {
  if (String(req.auth?.userId || "") !== String(userId || "")) {
    res.status(403).json({ error: "You are not authorized to modify this user" });
    return false;
  }

  return true;
}
