import { isWebShellRequest } from '../../lib/web-shell.js';

// Static hosting only. All dynamic calls go directly to the existing backend.
// Keep in sync with the explicit API origin in build-cloudflare-web.mjs.
const apiOrigin = 'https://petalpal-v2.onrender.com';
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin} wss://petalpal-v2.onrender.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://petalpal-b212c.firebaseapp.com`,
  "frame-src https://petalpal-b212c.firebaseapp.com",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
].join('; ');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;
    const shell = isWebShellRequest({ method: request.method, path: url.pathname });
    if (!['GET', 'HEAD'].includes(request.method)) {
      response = Response.json({ error: 'Use the configured backend origin' }, { status: 405 });
    } else {
      // Expo output is "single". Only actual public product routes get the
      // shell; missing JS/WASM and API paths must remain 404, never index.html.
      const assetUrl = new URL(request.url);
      if (shell) assetUrl.pathname = '/index.html';
      assetUrl.search = '';
      response = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method }));
    }
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', contentSecurityPolicy);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=15552000');
    const html = headers.get('Content-Type')?.includes('text/html');
    headers.set('Cache-Control', shell || html || response.status >= 400 ||
      request.headers.has('Authorization') || request.headers.has('Cookie')
      ? 'no-store' : 'public, max-age=0, must-revalidate');
    return new Response(response.body, { status: response.status, headers });
  }
};
