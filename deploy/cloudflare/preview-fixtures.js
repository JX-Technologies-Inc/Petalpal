// Serialized only by preview-worker.js. Never imported by the production Worker
// or Expo application. All identities/data below are public synthetic fixtures.
export function installPreviewFixtures() {
  const nativeFetch = window.fetch.bind(window);
  const uid = 'synthetic-preview-owner';
  const email = 'preview@example.invalid';
  const user = { id: uid, name: 'Synthetic Preview', avatar: '🦋', email,
    timezone: 'UTC', preferredLocale: 'en', aiConsent: false };
  const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  }));
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid,
      aud: 'petalpal-synthetic', iss: 'https://securetoken.google.com/petalpal-synthetic',
      email, email_verified: true, iat: now, auth_time: now, exp: now + 3600,
      firebase: { sign_in_provider: 'password' } })}.synthetic`;
  };
  let signedIn = false;
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const body = options.body || (input instanceof Request ? await input.clone().text() : '');
    if (url.origin === location.origin) return nativeFetch(input, options);
    if (url.origin === 'https://identitytoolkit.googleapis.com') {
      if (url.pathname === '/v1/accounts:signInWithPassword' && method === 'POST') {
        let data; try { data = JSON.parse(body); } catch { data = {}; }
        if (data.email !== email || data.password !== 'preview-only') {
          return json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400);
        }
        signedIn = true;
        return json({ localId: uid, email, displayName: user.name, registered: true,
          idToken: token(), refreshToken: 'synthetic-preview-refresh', expiresIn: '3600' });
      }
      if (url.pathname === '/v1/accounts:lookup' && method === 'POST' &&
          (signedIn || String(body).includes('.synthetic'))) {
        signedIn = true;
        return json({ users: [{ localId: uid, email, emailVerified: true, displayName: user.name,
          providerUserInfo: [{ providerId: 'password', rawId: email, email }] }] });
      }
      return json({ error: { message: 'OPERATION_NOT_ALLOWED' } }, 400);
    }
    if (url.origin === 'https://securetoken.googleapis.com' && url.pathname === '/v1/token' && method === 'POST') {
      if (new URLSearchParams(body).get('refresh_token') !== 'synthetic-preview-refresh') {
        return json({ error: { message: 'INVALID_REFRESH_TOKEN' } }, 400);
      }
      signedIn = true;
      return json({ access_token: token(), id_token: token(), refresh_token: 'synthetic-preview-refresh',
        expires_in: '3600', token_type: 'Bearer', user_id: uid, project_id: 'petalpal-synthetic' });
    }
    if (url.origin === 'https://petalpal-v2.onrender.com') {
      const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
      if (!signedIn || !headers.get('Authorization')?.endsWith('.synthetic')) {
        return json({ error: 'Synthetic sign-in required' }, 401);
      }
      if (url.pathname === '/auth/session' && method === 'POST') return json({ user });
      if (method !== 'GET') return json({ error: 'Read-only synthetic preview; writes and AI disabled' }, 403);
      if (url.pathname === '/session') return json({ user, garden: { owner: { id: uid } },
        fairyState: { onboardingStep: 'COMPLETED', onboardingCompleted: true, unlockedFeatures: [] },
        todayCheckIn: null, hasCheckedInToday: false, dailyGrowLimitEnabled: true });
      if (url.pathname === `/users/${uid}/garden`) return json({ owner: { id: uid }, flowers: [] });
      if (url.pathname === `/users/${uid}/journals`) return json({ journals: [], nextCursor: null });
      return json({ error: 'Not available in the synthetic preview' }, 403);
    }
    // Never pass an unknown external request through to the network.
    throw new TypeError('External network disabled in synthetic preview');
  };
  document.addEventListener('DOMContentLoaded', () => {
    const notice = document.createElement('aside');
    notice.setAttribute('role', 'note');
    notice.textContent = 'SYNTHETIC PREVIEW · preview@example.invalid / preview-only · No real credentials. Read-only fixtures; no live API or Socket.';
    notice.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff4cf;color:#352b11;padding:6px;text-align:center;font:12px sans-serif;pointer-events:none';
    document.body.append(notice);
  }, { once: true });
}
