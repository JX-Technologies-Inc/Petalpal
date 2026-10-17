import assert from "node:assert/strict";
import test from "node:test";

// Real PostgreSQL through the app's PrismaPg client: the Fairy advisory lock must
// not fail as P2010 (pg_advisory_xact_lock returns void). Runs only when
// REAL_POSTGRES_DATABASE_URL is set and matches the app database (DEV_DATABASE_URL).
const databaseUrl = process.env.REAL_POSTGRES_DATABASE_URL;
const realTest = databaseUrl && databaseUrl === process.env.DEV_DATABASE_URL ? test : test.skip;

realTest("Fairy routes take the transactional advisory lock on real PostgreSQL without P2010", async (t) => {
  const { default: prisma } = await import("../../lib/prisma.js");
  const { setFirebaseTokenVerifierForTests } = await import("../../lib/auth.js");
  const { COMMUNITY_VERSION } = await import("../../lib/community-policy.js");
  const { app } = await import("../../server.js");
  const uid = `firebase-fairy-lock-${Date.now()}`;
  setFirebaseTokenVerifierForTests(async () => ({ uid, email: `${uid}@example.test`, email_verified: true }));
  const errors = [];
  const originalError = console.error;
  console.error = (context, details) => errors.push([context, details?.code]);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  let userId;
  t.after(async () => {
    console.error = originalError;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
    if (userId) {
      // Garden is the only restrict FK to User; everything else cascades.
      await prisma.garden.deleteMany({ where: { ownerId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });
  const call = async (path, method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { Authorization: "Bearer synthetic", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  assert.equal((await call("/auth/session", "POST", { name: "Fairy Lock", timezone: "UTC", communityTermsVersion: COMMUNITY_VERSION })).status, 200);
  userId = (await prisma.user.findFirst({ where: { firebaseUid: uid }, select: { id: true } })).id;
  const month = new Date().toISOString().slice(0, 7);

  // Concurrent requests serialize on the same per-owner lock and all succeed.
  const progress = await Promise.all(Array.from({ length: 4 }, () => call(`/api/fairy/progress?month=${month}`)));
  assert.deepEqual(progress.map(({ status }) => status), [200, 200, 200, 200]);

  await prisma.fairyState.upsert({ where: { userId }, update: { onboardingCompleted: true }, create: { userId, onboardingCompleted: true } });
  const [fairies, runtime] = await Promise.all([call("/api/fairies"), call("/api/fairy/runtime")]);
  assert.equal(fairies.status, 200);
  assert.equal(runtime.status, 200);
  assert.equal(await prisma.userFairy.count({ where: { userId } }), 1, "the starter Fairy is created exactly once");
  assert.deepEqual(errors.filter(([, code]) => code === "P2010"), []);
});
