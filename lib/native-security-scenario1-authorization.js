import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { assertNativeSecurityEnvironment, assertNativeSecurityHttps } from './native-security.js';

// A scoped companion for the already-running isolated bridge. Its upstream
// capability stays on the Mac; the phone receives only a Scenario-1 grant.
export function createScenarioOneAuthorization({ env, backendOrigin, savedA, authenticatedA, source, verifyBackend, now = Date.now }) {
  if (env.NATIVE_SECURITY_TEST !== '1') throw new Error('Isolated authorization required');
  assertNativeSecurityEnvironment(env); assertNativeSecurityHttps(backendOrigin);
  const a = source?.credentials?.A;
  if (source?.environment !== 'native-security-test' || source.firebaseProject !== 'petalpal-native-security-test' ||
      source.database !== 'petalpal_native_security_test' || !a?.uid || !a.owner || a.disposable !== false ||
      a.email !== savedA.email || a.password !== savedA.password || a.uid !== authenticatedA.uid ||
      authenticatedA.project !== 'petalpal-native-security-test') throw new Error('Exact A authorization rejected');
  const exactA = { ...a }; // No B/C credential reference is retained.
  const token = randomBytes(32).toString('hex'), digest = createHash('sha256').update(token).digest();
  const expires = now() + 15 * 60 * 1000;
  let active = true;
  const safe = status => ({ environment: 'native-security-test', firebaseProject: 'petalpal-native-security-test',
    database: 'petalpal_native_security_test', backendOrigin, authorizedScenarios: [1], status });
  async function status(value) {
    assertNativeSecurityEnvironment(env);
    if (!active || now() >= expires || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value) ||
        !timingSafeEqual(createHash('sha256').update(value).digest(),digest)) throw new Error('Scoped authorization unavailable');
    try {
      // The upstream bridge map is process-local. A backend restart rejects
      // this proof; there is deliberately no automatic credential rebootstrap.
      const result = await verifyBackend();
      if (result.environment !== 'native-security-test' || result.firebaseProject !== 'petalpal-native-security-test' ||
          result.database !== 'petalpal_native_security_test' || ['A','B','C'].some(label =>
            result.status?.[label]?.firebaseExists !== true || result.status[label].backendExists !== true)) throw new Error('Isolation changed');
      return safe(result.status);
    } catch { active = false; throw new Error('Scoped authorization invalidated'); }
  }
  return {
    token,
    status,
    session: async value => ({ ...await status(value), credentials: { A: exactA } }),
    revoke: async value => { await status(value); active = false; return { revoked: true }; },
  };
}

export function scenarioOneAuthorizationRouter(service) {
  const router = Router();
  router.use((req,res,next) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    if (req.get('x-forwarded-proto') !== 'https' || Object.keys(req.query).length ||
        !req.body || Array.isArray(req.body) || Object.keys(req.body).length) return res.status(403).json({ error: 'Scoped HTTPS authorization required' });
    next();
  });
  for (const method of ['session','status','revoke']) router.post(`/${method}`,async(req,res) => {
    try {
      const token = req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
      res.json(await service[method](token));
    } catch { res.status(403).json({ error: 'Scenario-1 authorization unavailable' }); }
  });
  return router;
}
