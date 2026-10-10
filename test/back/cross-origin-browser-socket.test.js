import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '../../deploy/cloudflare/node_modules/playwright/index.mjs';
import staticWorker from '../../deploy/cloudflare/worker.js';
import { server } from '../../server.js';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';

test('Chromium Socket.IO uses CSP, polling, upgrade, refreshed reconnect and exact origins', { timeout: 40000 }, async t => {
  const oldOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const findUser = prisma.user.findUnique;
  const verified = [];
  prisma.user.findUnique = async () => ({ id: 'synthetic-browser-owner' });
  setFirebaseTokenVerifierForTests(async token => {
    if (!['synthetic-first', 'synthetic-refreshed'].includes(token)) throw Error('synthetic invalid');
    verified.push(token);
    return { uid: 'synthetic-firebase-owner', email_verified: true };
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const backend = `http://127.0.0.1:${server.address().port}`;
  const websocket = backend.replace('http:', 'ws:');
  const policyResponse = await staticWorker.fetch(new Request('https://preview.example.test/'), {
    ASSETS: { fetch: async () => new Response('', { headers: { 'Content-Type': 'text/html' } }) }
  });
  const productionPolicy = policyResponse.headers.get('Content-Security-Policy');
  assert.match(productionPolicy, /connect-src[^;]+https:\/\/petalpal-v2.onrender.com[^;]+wss:\/\/petalpal-v2.onrender.com/);
  // Only substitute the two Render origins with this task's loopback server.
  const policy = productionPolicy.replaceAll('https://petalpal-v2.onrender.com', backend)
    .replaceAll('wss://petalpal-v2.onrender.com', websocket);
  const client = readFileSync(new URL('../../node_modules/socket.io-client/dist/socket.io.min.js', import.meta.url));
  const frontend = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': req.url === '/client.js' ? 'text/javascript' : 'text/html',
      'Content-Security-Policy': policy, 'Cache-Control': 'no-store' });
    res.end(req.url === '/client.js' ? client : '<!doctype html><title>Synthetic Socket test</title><script src="/client.js"></script>');
  });
  frontend.listen(0, '127.0.0.1'); await once(frontend, 'listening');
  const origin = `http://127.0.0.1:${frontend.address().port}`;
  process.env.CORS_ALLOWED_ORIGINS = origin;
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let browser;
  t.after(async () => {
    await browser?.close();
    await Promise.all([server, frontend].map(s => new Promise(r => s.close(r))));
    prisma.user.findUnique = findUser; setFirebaseTokenVerifierForTests();
    if (oldOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = oldOrigins;
  });
  browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
  const page = await browser.newPage();
  // No interception: preserve browser CORS/preflight and real WebSocket behavior.
  await page.goto(origin);
  const result = await page.evaluate(async base => {
    const response = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
    const { sid } = JSON.parse((await response.text()).slice(1));
    await fetch(`${base}/socket.io/?EIO=4&transport=polling&sid=${sid}`, { method: 'POST', body: '1' });
    let token = 'synthetic-first', authCalls = 0;
    const socket = window.io(base, { autoConnect: false, transports: ['polling', 'websocket'],
      reconnectionDelay: 50, reconnectionDelayMax: 100, timeout: 3000,
      auth: done => { authCalls++; done({ token }); } });
    const connected = () => new Promise((resolve, reject) => {
      socket.once('connect', resolve); socket.once('connect_error', reject);
    });
    let first = connected(); socket.connect(); await first;
    if (socket.io.engine.transport.name !== 'websocket') {
      await new Promise(resolve => socket.io.engine.once('upgrade', resolve));
    }
    const transport = socket.io.engine.transport.name;
    const ack = await socket.timeout(3000).emitWithAck('join-user');
    token = 'synthetic-refreshed';
    const again = connected(); socket.io.engine.close(); await again;
    const reconnected = await socket.timeout(3000).emitWithAck('join-user');
    socket.disconnect();
    const denied = window.io(base, { autoConnect: false, reconnection: false,
      transports: ['websocket'], auth: { token: 'synthetic-invalid' } });
    const error = new Promise(resolve => denied.once('connect_error', e => resolve(e.message)));
    denied.connect(); const message = await error; denied.disconnect();
    // Browser enforces the deployed policy template against another origin.
    const violation = new Promise(resolve => document.addEventListener('securitypolicyviolation',
      event => resolve(event.effectiveDirective), { once: true }));
    await fetch('http://127.0.0.1:65534/blocked-by-csp').catch(() => {});
    return { cache: response.headers.get('Cache-Control'), transport, ack, reconnected,
      authCalls, message, directive: await violation };
  }, backend);
  assert.equal(result.cache, 'no-store'); assert.equal(result.transport, 'websocket');
  assert.equal(result.ack.ok, true); assert.equal(result.reconnected.ok, true);
  assert.ok(result.authCalls >= 2); assert.ok(verified.includes('synthetic-refreshed'));
  assert.match(result.message, /Invalid or expired/); assert.equal(result.directive, 'connect-src');
  process.env.CORS_ALLOWED_ORIGINS = 'https://different.example.test';
  const denied = await page.evaluate(async base => {
    const results = [];
    for (const transport of ['polling', 'websocket']) {
      const socket = window.io(base, { autoConnect: false, reconnection: false, timeout: 2000,
        transports: [transport], auth: { token: 'synthetic-first' } });
      const failure = new Promise(resolve => socket.once('connect_error', () => resolve(true)));
      socket.connect(); results.push(await failure); socket.disconnect();
    }
    return results;
  }, backend);
  assert.deepEqual(denied, [true, true]);
});
