import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { parse } from 'dotenv';
import { Router } from 'express';
import { assertNativeSecurityEnvironment } from './native-security.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export function readNativeTestAccounts() {
  const name = '.env.native-security-accounts.local';
  const stat = fs.lstatSync(root + name);
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('Test account boundary rejected');
  execFileSync('git', ['check-ignore', '--quiet', '--', name], { cwd: root, stdio: 'ignore' });
  const accounts = parse(fs.readFileSync(root + name));
  if (accounts.NATIVE_TEST_C_DISPOSABLE !== 'true') throw new Error('Disposable C boundary rejected');
  const emails = ['A', 'B', 'C'].map(label => accounts[`NATIVE_TEST_${label}_EMAIL`]?.trim().toLowerCase());
  if (emails.some(email => !email) || new Set(emails).size !== 3 ||
      ['A', 'B', 'C'].some(label => (accounts[`NATIVE_TEST_${label}_PASSWORD`]?.length || 0) < 12)) throw new Error('Test identities incomplete');
  return accounts;
}

// Applied only to isolated test deletion; normal product behavior is unchanged.
export function assertNativeTestDeletion(user, env = process.env, accounts = readNativeTestAccounts()) {
  if (env.NATIVE_SECURITY_TEST !== '1') throw new Error('Test mode required');
  assertNativeSecurityEnvironment(env);
  if (accounts.NATIVE_TEST_C_DISPOSABLE !== 'true' || !user?.firebaseUid ||
      user.email?.trim().toLowerCase() !== accounts.NATIVE_TEST_C_EMAIL?.trim().toLowerCase() ||
      [accounts.NATIVE_TEST_A_EMAIL, accounts.NATIVE_TEST_B_EMAIL].some(email => email?.trim().toLowerCase() === user.email?.trim().toLowerCase())) {
    throw new Error('Only designated disposable C may be deleted');
  }
}

export function createNativeSecurityHarnessBridge({ prisma, verifyToken, findUser, env = process.env,
  readAccounts = readNativeTestAccounts, now = Date.now }) {
  if (env.NATIVE_SECURITY_TEST !== '1') throw new Error('Test mode required');
  assertNativeSecurityEnvironment(env);
  const sessions = new Map();
  const hash = value => createHash('sha256').update(value).digest('hex');
  async function inspect() {
    assertNativeSecurityEnvironment(env);
    const db = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
    if (db[0]?.db !== 'petalpal_native_security_test') throw new Error('Database boundary rejected');
    const local = readAccounts(), credentials = {}, status = {};
    for (const label of ['A', 'B', 'C']) {
      const email = local[`NATIVE_TEST_${label}_EMAIL`].trim().toLowerCase();
      const provider = await findUser(email);
      const row = await prisma.user.findUnique({ where: { email }, select: { id: true, firebaseUid: true } });
      if (!!provider !== !!row || (provider && (provider.uid !== row.firebaseUid || provider.disabled || !provider.emailVerified)) ||
          (label !== 'C' && !provider)) throw new Error('Test linkage rejected');
      status[label] = { firebaseExists: !!provider, backendExists: !!row };
      credentials[label] = { email, password: local[`NATIVE_TEST_${label}_PASSWORD`], uid: provider?.uid || null,
        owner: row?.id || null, disposable: label === 'C' && local.NATIVE_TEST_C_DISPOSABLE === 'true' };
    }
    return { environment: 'native-security-test', firebaseProject: 'petalpal-native-security-test',
      database: 'petalpal_native_security_test', credentials, status };
  }
  function requireSession(token) {
    if (typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) throw new Error('Resume access unavailable');
    const key = hash(token), expires = sessions.get(key);
    if (!expires || expires <= now()) { sessions.delete(key); throw new Error('Resume access expired'); }
    return key;
  }
  const service = {
    async bootstrap(token) {
      const identity = await verifyToken(token);
      const data = await inspect();
      if (identity.email_verified !== true || identity.uid !== data.credentials.A.uid) throw new Error('Designated A sign-in required');
      for (const [key, expires] of sessions) if (expires <= now()) sessions.delete(key);
      if (sessions.size >= 4) throw new Error('Test session limit');
      const capability = randomBytes(32).toString('hex');
      sessions.set(hash(capability), now() + 2 * 60 * 60 * 1000);
      return { ...data, capability };
    },
    async session(token) { requireSession(token); return inspect(); },
    async status(token) { requireSession(token); const { credentials: _private, ...safe } = await inspect(); return safe; },
    revoke(token) { sessions.delete(requireSession(token)); }
  };
  return service;
}

export function nativeSecurityHarnessRouter(service) {
  const router = Router();
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    if (req.get('x-forwarded-proto') !== 'https' || Object.keys(req.query).length || Object.keys(req.body || {}).length) {
      return res.status(403).json({ error: 'Isolated HTTPS harness access required' });
    }
    next();
  });
  for (const method of ['bootstrap', 'session', 'status', 'revoke']) {
    router.post(`/${method}`, async (req, res) => {
      try {
        const token = req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
        if (!token) throw new Error('Authentication required');
        const result = await service[method](token);
        res.json(result || { revoked: true });
      } catch { res.status(403).json({ error: 'Isolated harness access unavailable' }); }
    });
  }
  return router;
}
