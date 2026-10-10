import { isWebShellRequest } from '../../lib/web-shell.js';

// First-launch escape route when there is no prior production Worker version.
// Explicitly deployed only under rollback approval; never proxies API or tokens.
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
    if (!isWebShellRequest({ method: request.method, path: new URL(request.url).pathname })) {
      return new Response(null, { status: 404, headers });
    }
    // Return to the Vite entry point. Never forward query strings or private paths.
    return new Response(null, {
      status: 302, headers: { ...headers, Location: 'https://petalpal-v2.onrender.com/' },
    });
  },
};
