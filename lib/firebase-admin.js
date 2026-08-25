import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function firebaseApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || "petalpal-b212c";
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawServiceAccount) {
    const serviceAccount = JSON.parse(rawServiceAccount);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  return initializeApp({ projectId });
}

export async function verifyFirebaseIdToken(token) {
  return getAuth(firebaseApp()).verifyIdToken(token, true);
}
