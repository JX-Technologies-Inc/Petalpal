// Pure helpers shared by the Worker and tests; kept out of the Worker entry point
// so the entry module exports only the default handler.
// Defaults are the existing production values: with no variables set, behavior is
// unchanged. The isolated integration Worker (wrangler.integration.jsonc) sets
// PETALPAL_ENVIRONMENT=integration and must be given API_ORIGIN and
// FIREBASE_AUTH_DOMAIN at deploy time; it fails closed otherwise. Keep the
// production API origin in sync with build-cloudflare-web.mjs.
const productionApiOrigin = 'https://petalpal-v2.onrender.com';
const productionAuthDomain = 'petalpal-b212c.firebaseapp.com';

export function resolveHostingConfig(env = {}) {
  if (env.PETALPAL_ENVIRONMENT === undefined) {
    return { apiOrigin: productionApiOrigin, authDomain: productionAuthDomain };
  }
  if (env.PETALPAL_ENVIRONMENT !== 'integration') return null;
  const apiOrigin = String(env.API_ORIGIN || '');
  const authDomain = String(env.FIREBASE_AUTH_DOMAIN || '');
  // Exact HTTPS origin only; never the production API or production Firebase domain.
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(apiOrigin) || apiOrigin.toLowerCase() === productionApiOrigin ||
      !/^[a-z0-9.-]+$/i.test(authDomain) || authDomain.toLowerCase() === productionAuthDomain) return null;
  return { apiOrigin, authDomain };
}

export function buildContentSecurityPolicy({ apiOrigin, authDomain }) {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} wss://${new URL(apiOrigin).host} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://${authDomain}`,
    `frame-src https://${authDomain}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
  ].join('; ');
}
