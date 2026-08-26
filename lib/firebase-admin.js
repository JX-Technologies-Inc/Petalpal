import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

export function readFirebaseAdminConfig(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || "petalpal-b212c";
  const rawServiceAccount = env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawServiceAccount) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON");
    }
    serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
    return { projectId, serviceAccount };
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (clientEmail || privateKey) {
    if (!clientEmail || !privateKey) {
      throw new Error("FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be configured together");
    }
    return {
      projectId,
      serviceAccount: {
        project_id: projectId,
        client_email: clientEmail,
        private_key: normalizePrivateKey(privateKey)
      }
    };
  }

  return { projectId, serviceAccount: null };
}

function firebaseApp() {
  if (getApps().length) return getApps()[0];

  const { projectId, serviceAccount } = readFirebaseAdminConfig();

  if (serviceAccount) {
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  return initializeApp({ projectId });
}

export async function verifyFirebaseIdToken(token) {
  return getAuth(firebaseApp()).verifyIdToken(token, true);
}
