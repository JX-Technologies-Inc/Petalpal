import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "petalpal-b212c";

const FIREBASE_ISSUER =
  `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Firebase ID token is required");
  }

  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ["RS256"]
  });

  if (!payload.sub || !payload.email) {
    throw new Error("Firebase token is missing identity claims");
  }

  return payload;
}
