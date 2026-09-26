import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, deleteApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const statePath = path.join(root, ".auth-e2e-state.local.json");
const expected = {
  projectId: "petalpal-b212c",
  authDomain: "petalpal-b212c.firebaseapp.com",
  appId: "1:879846854472:web:02b860eacfaf5bb7616d7d",
  projectNumber: "879846854472"
};
const frontendOrigin = "http://localhost:5173";
const disallowedEmails = new Set((process.env.AUTH_E2E_PROTECTED_EMAILS || "")
  .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
const startedServices = [];

async function serviceReady(url, kind) {
  try {
    if (kind === "backend") {
      const response = await fetch(`${url}/auth/session`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(1_000)
      });
      const data = await response.json().catch(() => null);
      return response.status === 401 && data?.error === "Authentication required";
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.status === 200 && (await response.text()).includes('id="root"');
  } catch {
    return false;
  }
}

async function ensureLocalServices() {
  const services = [
    { kind: "frontend", url: frontendOrigin, command: process.execPath, args: [path.join(root, "client/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"], cwd: path.join(root, "client") },
    { kind: "backend", url: "http://localhost:3000", command: process.execPath, args: ["--input-type=module", "-e", 'import { server } from "./server.js"; server.listen(3000, "127.0.0.1")'], cwd: root }
  ];
  for (const service of services) {
    if (await serviceReady(service.url, service.kind)) continue;
    const child = spawn(service.command, service.args, { cwd: service.cwd, env: process.env, stdio: "ignore" });
    startedServices.push(child);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await serviceReady(service.url, service.kind)) { ready = true; break; }
      if (child.exitCode !== null) break;
      await delay(500);
    }
    if (!ready) throw new Error(`Local ${service.url === frontendOrigin ? "frontend" : "backend"} did not start`);
  }
  output("LOCAL_SERVICES", "PASS");
}

function stopStartedServices() {
  for (const child of startedServices) child.kill("SIGTERM");
}

process.once("SIGINT", () => { stopStartedServices(); process.exit(130); });
process.once("SIGTERM", () => { stopStartedServices(); process.exit(143); });

function output(step, result, detail = "") {
  console.log(`${step}: ${result}${detail ? ` — ${detail}` : ""}`);
}

function safeError(error, secrets = []) {
  let message = String(error?.message || "Unknown error");
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  message = message
    .replace(/AIza[\w-]{20,}/g, "[redacted-api-key]")
    .replace(/(?:oobCode|idToken|refreshToken|password)=[^\s&]+/gi, "[redacted-credential]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted-private-key]");
  return `${error?.code || "UNKNOWN"}: ${message.slice(0, 400)}`;
}

function readState() {
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function writeState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function testCredentials() {
  const email = process.env.AUTH_E2E_TEST_EMAIL?.trim().toLowerCase();
  const password = process.env.AUTH_E2E_TEST_PASSWORD;
  if (!email || !password) {
    output("PREFLIGHT", "BLOCKED", "Set AUTH_E2E_TEST_EMAIL and AUTH_E2E_TEST_PASSWORD in the Git-ignored .env.auth-e2e.local file.");
    process.exitCode = 2;
    return null;
  }
  if (email === "your-dedicated-test-email@example.com" || password === "replace-with-dedicated-test-password") {
    throw new Error("Replace the example placeholders before starting the E2E workflow");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || disallowedEmails.has(email)) {
    throw new Error("AUTH_E2E_TEST_EMAIL must be a dedicated test address, distinct from the old accounts");
  }
  if (password.length < 6) throw new Error("AUTH_E2E_TEST_PASSWORD must meet Firebase's minimum length");
  return { email, password };
}

async function preflight() {
  const credentials = testCredentials();
  if (!credentials) return null;
  const env = loadEnv("development", path.join(root, "client"), "VITE_");
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    projectId: env.VITE_FIREBASE_PROJECT_ID || expected.projectId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || expected.authDomain,
    appId: env.VITE_FIREBASE_APP_ID || expected.appId
  };
  if (!config.apiKey || config.projectId !== expected.projectId || config.authDomain !== expected.authDomain || config.appId !== expected.appId) {
    throw new Error("Frontend Firebase Web App configuration does not match the confirmed petalpal-b212c project");
  }
  const apiBase = new URL(env.VITE_API_BASE_URL || "http://localhost:3000");
  if (!(["localhost", "127.0.0.1"].includes(apiBase.hostname) && apiBase.protocol === "http:" && apiBase.port === "3000")) {
    throw new Error("VITE_API_BASE_URL must point to the local backend on port 3000 for this E2E workflow");
  }
  const configResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(config.apiKey)}`);
  const publicConfig = await configResponse.json();
  if (!configResponse.ok || String(publicConfig.projectId) !== expected.projectNumber || !publicConfig.authorizedDomains?.includes("localhost")) {
    throw new Error("Firebase API key project or localhost Authorized Domain does not match the expected project");
  }
  output("FRONTEND_PROJECT", "PASS", expected.projectId);
  output("AUTHORIZED_DOMAIN", "PASS", "localhost");

  const { readFirebaseAdminConfig } = await import("../../lib/firebase-admin.js");
  const adminConfig = readFirebaseAdminConfig();
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultAdc = path.join(process.env.HOME || "", ".config/gcloud/application_default_credentials.json");
  const adminConfigured = Boolean(adminConfig.serviceAccount || (adcPath && existsSync(adcPath)) || existsSync(defaultAdc));
  output("FIREBASE_ADMIN", adminConfigured ? "CONFIGURED" : "ADMIN_BLOCKED", adminConfigured ? "Credential mechanism found; live verification follows after email verification." : "No local service account or ADC credential found.");
  const { assertDevelopmentDatabase } = await import("../../lib/database-isolation.js");
  assertDevelopmentDatabase();
  return { ...credentials, config, apiBase: apiBase.origin, adminConfigured };
}

async function prismaClient() {
  const { default: prisma } = await import("../../lib/prisma.js");
  return prisma;
}

async function assertNoOtherUserData(prisma, id) {
  const garden = await prisma.garden.findUnique({ where: { ownerId: id }, select: { id: true } });
  const flowerIds = garden
    ? (await prisma.flower.findMany({ where: { gardenId: garden.id }, select: { id: true } })).map((flower) => flower.id)
    : [];
  const authoredMessageIds = (await prisma.message.findMany({ where: { userId: id }, select: { id: true } })).map((message) => message.id);
  const counts = await Promise.all([
    prisma.friendship.count({ where: { OR: [{ userId: id }, { friendId: id }] } }),
    prisma.friendRequest.count({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
    prisma.report.count({ where: { reportedUserId: id, reporterId: { not: id } } }),
    flowerIds.length ? prisma.message.count({ where: { flowerId: { in: flowerIds }, OR: [{ userId: { not: id } }, { userId: null }] } }) : 0,
    garden ? prisma.visitRecord.count({ where: { gardenId: garden.id, visitorId: { not: id } } }) : 0,
    authoredMessageIds.length ? prisma.report.count({ where: { messageId: { in: authoredMessageIds }, reporterId: { not: id } } }) : 0
  ]);
  if (counts.some(Boolean)) throw new Error("Test account has relationships or content involving other users; cleanup stopped without changing data");
}

async function removeExistingTestAccount(auth, settings, prisma) {
  const dbUser = await prisma.user.findUnique({ where: { email: settings.email } });
  let firebaseUser = null;
  let adminAvailable = settings.adminConfigured;
  if (adminAvailable) {
    try {
      const { findFirebaseUserByEmail } = await import("../../lib/firebase-admin.js");
      firebaseUser = await findFirebaseUserByEmail(settings.email);
    } catch (error) {
      if (error?.code !== "app/invalid-credential") throw error;
      adminAvailable = false;
      output("FIREBASE_ADMIN", "ADMIN_BLOCKED", "Configured credential could not obtain an access token.");
    }
  }
  if (!adminAvailable) {
    try {
      const credential = await signInWithEmailAndPassword(auth, settings.email, settings.password);
      firebaseUser = credential.user;
    } catch (error) {
      if (dbUser) throw new Error("Existing Prisma test account cannot be safely cleaned without working Firebase Admin credentials or the test password");
      if (!["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-login-credentials"].includes(error?.code)) throw error;
    }
  }
  if (firebaseUser && firebaseUser.email?.trim().toLowerCase() !== settings.email) {
    throw new Error("Firebase account email does not exactly match AUTH_E2E_TEST_EMAIL");
  }
  if (dbUser && (!firebaseUser || dbUser.firebaseUid !== firebaseUser.uid || dbUser.email?.trim().toLowerCase() !== settings.email)) {
    throw new Error("Prisma test account email/UID cannot be matched exactly to the Firebase account");
  }
  if (dbUser) {
    await assertNoOtherUserData(prisma, dbUser.id);
    const { deleteAccountDataInTransaction } = await import("../../lib/account-deletion.js");
    await prisma.$transaction((tx) => deleteAccountDataInTransaction(tx, {
      id: dbUser.id, expectedEmail: settings.email, expectedFirebaseUid: firebaseUser.uid
    }));
    if (await prisma.user.findUnique({ where: { id: dbUser.id } })) throw new Error("Prisma test account still exists after cleanup");
    output("EXACT_PRISMA_CLEANUP", "PASS");
  }
  if (firebaseUser) {
    if (adminAvailable) {
      const { deleteFirebaseUser } = await import("../../lib/firebase-admin.js");
      await deleteFirebaseUser(firebaseUser.uid);
    } else {
      await deleteUser(firebaseUser);
    }
    output("EXACT_FIREBASE_CLEANUP", "PASS");
  }
  return { adminAvailable };
}

async function start(settings, auth) {
  const prisma = await prismaClient();
  let awaitingState = null;
  try {
    const priorState = readState();
    if (priorState && priorState.email !== settings.email) throw new Error("Existing local E2E state belongs to a different email; stopped before any cleanup");
    await removeExistingTestAccount(auth, settings, prisma);
    let user;
    try {
      user = (await createUserWithEmailAndPassword(auth, settings.email, settings.password)).user;
    } catch (error) {
      output("SIGNUP", "FAIL", safeError(error, [settings.password, settings.config.apiKey, settings.email]));
      process.exitCode = 1;
      return;
    }
    if (user.email?.trim().toLowerCase() !== settings.email || user.emailVerified !== false) {
      throw new Error("New Firebase user email or initial verification state did not match the test account");
    }
    const createdAt = new Date().toISOString();
    writeState({ email: settings.email, firebaseUid: user.uid, createdAt, stage: "created" });
    output("SIGNUP", "SIGNUP_PASS");
    try {
      await sendEmailVerification(user, { url: frontendOrigin });
      awaitingState = { email: settings.email, firebaseUid: user.uid, createdAt, stage: "awaiting_email" };
      writeState(awaitingState);
      output("VERIFICATION_EMAIL_SEND", "VERIFICATION_EMAIL_SEND_PASS");
    } catch (error) {
      output("VERIFICATION_EMAIL_SEND", "FAIL", safeError(error, [settings.password, settings.config.apiKey, settings.email]));
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
  if (awaitingState) await resume(settings, auth, awaitingState);
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function resume(settings, auth, state) {
  const user = auth.currentUser?.uid === state.firebaseUid
    ? auth.currentUser
    : (await signInWithEmailAndPassword(auth, settings.email, settings.password)).user;
  if (user.email?.trim().toLowerCase() !== settings.email || user.uid !== state.firebaseUid) {
    throw new Error("Signed-in Firebase user does not match the exact test email and UID saved at signup");
  }
  await user.reload();
  if (!user.emailVerified) {
    output("FRESH_VERIFICATION_LINK", "WAITING_FOR_INBOX", "Firebase still reports emailVerified=false. Open the newest verification email once, then tell me whether it says Success or Expired/Already Used.");
    for (let attempt = 0; attempt < 48 && !user.emailVerified; attempt += 1) {
      await delay(15_000);
      await user.reload();
    }
    if (!user.emailVerified) {
      process.exitCode = 2;
      return;
    }
  }
  output("FRESH_VERIFICATION_LINK", "PASS");
  output("EMAIL_VERIFIED_REFRESH", "PASS");
  await signOut(auth);
  const login = await signInWithEmailAndPassword(auth, settings.email, settings.password);
  if (login.user.uid !== state.firebaseUid || !login.user.emailVerified) throw new Error("Verified test account login did not restore the expected Firebase user");
  output("LOGIN", "PASS");
  const token = await login.user.getIdToken(true);
  if (!token) throw new Error("Firebase returned no fresh ID token");
  output("FRESH_ID_TOKEN", "PASS");
  if (!settings.adminConfigured) {
    output("FIREBASE_ADMIN_VERIFICATION", "ADMIN_BLOCKED", "No local Admin credential; client-side phases completed safely.");
    process.exitCode = 2;
    return;
  }
  try {
    const { verifyFirebaseIdToken } = await import("../../lib/firebase-admin.js");
    const claims = await verifyFirebaseIdToken(token);
    if (claims.uid !== state.firebaseUid || claims.aud !== expected.projectId || claims.email_verified !== true) {
      throw new Error("Verified token claims do not match the test account or project");
    }
    output("FIREBASE_ADMIN_VERIFICATION", "PASS");
  } catch (error) {
    output("FIREBASE_ADMIN_VERIFICATION", error?.code === "app/invalid-credential" ? "ADMIN_BLOCKED" : "FAIL", safeError(error, [token, settings.password, settings.config.apiKey, settings.email]));
    process.exitCode = error?.code === "app/invalid-credential" ? 2 : 1;
    return;
  }
  let session = await postJson(`${settings.apiBase}/auth/session`, token, { deferProfileCreation: true });
  if (session.status === 200 && session.data?.needsProfile) {
    session = await postJson(`${settings.apiBase}/auth/session`, token, { name: "Auth E2E Test", timezone: "UTC", preferredLocale: "en" });
  }
  if (session.status !== 200 || !session.data?.user?.id || session.data.user.email !== settings.email) {
    output("AUTH_SESSION", "FAIL", `${session.status}: ${session.data?.firebaseErrorCode || session.data?.error || "unexpected response"}`);
    process.exitCode = 1;
    return;
  }
  output("AUTH_SESSION", "PASS");
  const route = await fetch(`${frontendOrigin}/dev/emotion-lab`);
  if (route.status !== 200 || !(await route.text()).includes('id="root"')) {
    output("EMOTION_LAB", "FAIL", "Local frontend route did not load");
    process.exitCode = 1;
    return;
  }
  const preview = await postJson(`${settings.apiBase}/dev/emotion-preview`, token, {
    text: "Auth E2E test: a calm day in the garden.", primaryGardenMood: "SUNNY_BLOOM"
  });
  if (preview.status !== 200 || !Array.isArray(preview.data?.labels)) {
    output("EMOTION_LAB", "FAIL", `${preview.status}: ${preview.data?.firebaseErrorCode || preview.data?.error || "unexpected response"}`);
    process.exitCode = 1;
    return;
  }
  output("EMOTION_LAB", "PASS");
  writeState({ ...state, stage: "complete" });
}

async function main() {
  const settings = await preflight();
  if (!settings) return;
  const app = initializeApp(settings.config, "petalpal-auth-e2e");
  const auth = getAuth(app);
  try {
    await ensureLocalServices();
    const state = readState();
    if (state && state.email !== settings.email) throw new Error("Local E2E state belongs to another email");
    if (process.argv.includes("--fresh") || !state || state.stage === "created") await start(settings, auth);
    else await resume(settings, auth, state);
  } finally {
    await deleteApp(app);
    stopStartedServices();
  }
}

main().catch((error) => {
  const secrets = [process.env.AUTH_E2E_TEST_EMAIL, process.env.AUTH_E2E_TEST_PASSWORD];
  output("AUTH_E2E", "FAIL", safeError(error, secrets));
  process.exitCode = 1;
});
