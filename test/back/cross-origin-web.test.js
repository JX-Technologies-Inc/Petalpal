import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { server } from '../../server.js';
import prisma from '../../lib/prisma.js';
import { setFirebaseTokenVerifierForTests } from '../../lib/auth.js';

test('cross-origin REST and actual Engine.IO transports retain origin, token and owner boundaries', { timeout: 30000 }, async t => {
  const origin = 'https://app.jastrevia.com';
  const previous = { node: process.env.NODE_ENV, cors: process.env.CORS_ALLOWED_ORIGINS };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOWED_ORIGINS = `${origin},https://preview.example.test,https://petalpal-v2.onrender.com`;
  const findUser = prisma.user.findUnique, findJournals = prisma.journal.findMany;
  prisma.user.findUnique = async () => ({ id: 'synthetic-owner', timezone: 'UTC' });
  prisma.journal.findMany = async () => [];
  let verifications = 0;
  setFirebaseTokenVerifierForTests(async token => {
    verifications++;
    if (!['synthetic-valid', 'synthetic-refreshed'].includes(token)) throw Error('synthetic invalid');
    return { uid: 'synthetic-firebase', email_verified: true };
  });
  const sockets = [];
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    sockets.forEach(s => s.disconnect());
    await new Promise(resolve => server.close(resolve));
    prisma.user.findUnique = findUser; prisma.journal.findMany = findJournals;
    setFirebaseTokenVerifierForTests();
    for (const [key, value] of [['NODE_ENV', previous.node], ['CORS_ALLOWED_ORIGINS', previous.cors]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  await t.test('browser preflight allows explicit origins and authorization, never wildcard', async () => {
    for (const allowed of [origin, 'https://preview.example.test', 'https://petalpal-v2.onrender.com']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const r = await fetch(`${base}/users/synthetic-owner/journals`, { method: 'OPTIONS', headers: {
          Origin: allowed, 'Access-Control-Request-Method': method,
          'Access-Control-Request-Headers': 'authorization,content-type'
        } });
        assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), allowed);
        assert.match(r.headers.get('access-control-allow-headers'), /authorization/i);
        assert.match(r.headers.get('access-control-allow-methods'), new RegExp(method));
        assert.match(r.headers.get('vary'), /Origin/);
        assert.equal(r.headers.get('cache-control'), 'no-store');
      }
    }
    const r = await fetch(`${base}/session`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
  });
  await t.test('all dynamic prefixes stay on backend and anonymous/private responses are uncached', async () => {
    for (const path of ['/session', '/users/x/journals', '/api/fairies', '/events/x', '/ai/reports',
      '/speech/transcribe', '/friends/request', '/reports', '/visit', '/leave', '/analyze-mood', '/internal/ai-jobs/dispatchable']) {
      const r = await fetch(base + path, { headers: { Origin: origin } });
      assert.equal(r.status, 401, path); assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.equal(r.headers.get('access-control-allow-origin'), origin);
      assert.match(r.headers.get('content-type'), /json/); await r.text();
    }
    const headers = { Origin: origin, Authorization: 'Bearer synthetic-valid' };
    const owner = await fetch(`${base}/users/synthetic-owner/journals`, { headers });
    assert.equal(owner.status, 200); assert.equal(owner.headers.get('cache-control'), 'no-store');
    const other = await fetch(`${base}/users/synthetic-other/journals`, { headers });
    assert.equal(other.status, 403); assert.equal(other.headers.get('cache-control'), 'no-store');
  });
  function socket(options = {}) {
    const s = io(base, { autoConnect: false, reconnection: false, timeout: 3000,
      extraHeaders: { Origin: origin }, auth: { token: 'synthetic-valid' }, ...options });
    sockets.push(s); return s;
  }
  await t.test('polling and direct WebSocket reject unapproved origins before Firebase verification', async () => {
    for (const transport of ['polling', 'websocket']) {
      const count = verifications;
      const s = socket({ transports: [transport], extraHeaders: { Origin: 'https://evil.example' } });
      const error = once(s, 'connect_error'); s.connect(); await error; s.disconnect();
      assert.equal(verifications, count);
    }
  });
  await t.test('valid origin still requires a valid Firebase identity on both transports', async () => {
    for (const transport of ['polling', 'websocket']) {
      const s = socket({ transports: [transport], auth: { token: 'synthetic-invalid' } });
      const error = once(s, 'connect_error'); s.connect();
      assert.match((await error)[0].message, /Invalid or expired/); s.disconnect();
    }
  });
  await t.test('polling authenticates, upgrades, acknowledges events and reconnects with a refreshed token', async () => {
    let token = 'synthetic-valid';
    const s = socket({ transports: ['polling', 'websocket'], auth: done => done({ token }) });
    const connected = once(s, 'connect'); s.connect(); await connected;
    if (s.io.engine.transport.name !== 'websocket') await once(s.io.engine, 'upgrade');
    assert.equal(s.io.engine.transport.name, 'websocket');
    const ack = await s.timeout(3000).emitWithAck('join-user'); assert.equal(ack.ok, true);
    s.disconnect(); token = 'synthetic-refreshed';
    const reconnected = once(s, 'connect'); s.connect(); await reconnected;
    assert.equal((await s.timeout(3000).emitWithAck('join-user')).ok, true);
    s.disconnect();
    const poll = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: origin } });
    assert.equal(poll.status, 200); assert.equal(poll.headers.get('cache-control'), 'no-store');
    const text = await poll.text(); assert.ok(text.startsWith('0'));
    // Close this synthetic Engine.IO session explicitly so no timer remains.
    const { sid } = JSON.parse(text.slice(1));
    await fetch(`${base}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '1'
    });
  });
});
