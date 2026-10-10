import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { chromium } from '../../deploy/cloudflare/node_modules/playwright/index.mjs';
import { server } from '../../server.js';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';

test('isolated Chromium performs real CORS preflight and reads authorized/error responses', { timeout: 30000 }, async t => {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const backend = `http://127.0.0.1:${server.address().port}`;
  // Two empty synthetic frontends: one approved origin and one denied origin.
  const fixture = () => createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html',
      'Content-Security-Policy': `default-src 'self'; connect-src ${backend}` });
    res.end('<!doctype html><title>Synthetic cross-origin test</title>');
  });
  const frontend = fixture(), denied = fixture();
  frontend.listen(0, '127.0.0.1'); denied.listen(0, '127.0.0.1');
  await Promise.all([once(frontend, 'listening'), once(denied, 'listening')]);
  const origin = `http://127.0.0.1:${frontend.address().port}`;
  process.env.CORS_ALLOWED_ORIGINS = origin;
  const findUser = prisma.user.findUnique, findJournals = prisma.journal.findMany;
  prisma.user.findUnique = async () => ({ id: 'synthetic-owner', timezone: 'UTC' });
  prisma.journal.findMany = async () => [];
  setFirebaseTokenVerifierForTests(async token => {
    if (token !== 'synthetic-browser') throw Error('synthetic');
    return { uid: 'synthetic-browser-owner', email_verified: true };
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
  t.after(async () => {
    await browser.close();
    await Promise.all([server, frontend, denied].map(s => new Promise(r => s.close(r))));
    prisma.user.findUnique = findUser; prisma.journal.findMany = findJournals; setFirebaseTokenVerifierForTests();
  });
  const page = await browser.newPage();
  // The fixture has no scripts/assets and its CSP permits only our loopback API.
  // Avoid request interception: it would bypass the browser's real preflight.
  await page.goto(origin);
  const preflights = [];
  const observe = req => { if (req.method === 'OPTIONS') preflights.push(req.url); };
  server.on('request', observe); t.after(() => server.off('request', observe));
  const result = await page.evaluate(async base => {
    const request = async (path, token) => {
      const response = await fetch(base + path, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      return { status: response.status, cache: response.headers.get('Cache-Control'), json: await response.json() };
    };
    return [await request('/users/synthetic-owner/journals', 'synthetic-browser'),
      await request('/users/other/journals', 'synthetic-browser'),
      await request('/users/synthetic-owner/journals', 'synthetic-invalid')];
  }, backend);
  assert.deepEqual(result.map(r => r.status), [200, 403, 401]);
  assert.ok(result.every(r => r.cache === 'no-store'));
  assert.ok(preflights.length >= 2);
  await page.goto(`http://127.0.0.1:${denied.address().port}`);
  assert.equal(await page.evaluate(async base => {
    try { await fetch(base + '/users/synthetic-owner/journals', { headers: { Authorization: 'Bearer synthetic-browser' } }); return 'unexpected'; }
    catch { return 'blocked'; }
  }, backend), 'blocked');
});
