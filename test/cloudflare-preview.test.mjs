import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { unstable_dev } from '../deploy/cloudflare/node_modules/wrangler/wrangler-dist/cli.js';
import { chromium } from '../deploy/cloudflare/node_modules/playwright/index.mjs';

test('delivery-only preview reuses Expo export and browser CSP blocks production API/Firebase', { timeout: 45000 }, async t => {
  const worker = await unstable_dev('deploy/cloudflare/worker.js', {
    config: 'deploy/cloudflare/wrangler.preview.jsonc', local: true, ip: '127.0.0.1', port: 0,
    persist: false, envFiles: [], logLevel: 'error', experimental: { disableExperimentalWarning: true }
  });
  t.after(() => worker.stop());
  const r = await worker.fetch('/bookhouse');
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self';/); assert.match(csp, /frame-src 'none';/);
  assert.doesNotMatch(csp, /onrender\.com|googleapis\.com|apis\.google\.com|firebaseapp\.com/);
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  // A network backstop guarantees even a failing CSP assertion cannot reach
  // a provider. CSP violations must happen before any intercepted request.
  let escaped = 0;
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    escaped++; return route.abort();
  });
  await page.goto(`http://${worker.address}:${worker.port}/bookhouse`);
  await page.getByText('Sign in to PetalPal', { exact: true }).waitFor();
  const violations = await page.evaluate(async () => {
    const directives = [];
    document.addEventListener('securitypolicyviolation', e => directives.push(e.effectiveDirective));
    for (const target of ['https://petalpal-v2.onrender.com/session',
      'https://identitytoolkit.googleapis.com/blocked-synthetic-probe']) {
      try { await fetch(target); } catch { /* Expected CSP rejection, no token. */ }
    }
    try { new WebSocket('wss://petalpal-v2.onrender.com/socket.io/'); } catch { /* Expected. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
    return directives;
  });
  assert.ok(violations.filter(d => d === 'connect-src').length >= 3);
  assert.equal(escaped, 0, 'No provider request escaped preview CSP');
  assert.equal((await worker.fetch('/socket.io/')).status, 404);
});
