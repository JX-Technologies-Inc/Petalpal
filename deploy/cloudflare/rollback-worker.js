import { isWebShellRequest } from '../../lib/web-shell.js';

// First-launch escape route when there is no prior production Worker version.
// Explicitly deployed only under rollback approval; never proxies API or tokens.
// Inactive by default: no profile other than wrangler.rollback.jsonc uses it.
export const FALLBACK_ORIGIN = 'https://petalpal-v2.onrender.com';

export default {
  async fetch(request) {
    const headers = {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const fetchMode = request.headers.get('Sec-Fetch-Mode');
    // Only top-level page navigation is redirected. WebSocket upgrades, script
    // fetch/XHR (Sec-Fetch-Mode other than navigate) and any request carrying a
    // bearer credential stay 404, so tokens are never sent toward another origin.
    // Serving on the fallback host itself would loop, so it is refused as well.
    if (request.headers.has('Upgrade') || request.headers.has('Authorization') ||
        (fetchMode !== null && fetchMode !== 'navigate') || url.host === new URL(FALLBACK_ORIGIN).host ||
        !isWebShellRequest({ method: request.method, path: url.pathname })) {
      return new Response(null, { status: 404, headers });
    }
    // Return to the Vite entry point. Never forward query strings or private paths:
    // Vite's route set differs, and queries may carry one-time codes.
    return new Response(null, { status: 302, headers: { ...headers, Location: `${FALLBACK_ORIGIN}/` } });
  },
};
