import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import proxyaddr from 'proxy-addr';
import { Server } from 'engine.io';
import WebSocket from 'ws';

test('proxy trust does not treat unrelated IPv4 peers as IPv6 subnet members', () => {
  assert.equal(proxyaddr.compile('::/1')('203.0.113.5'), false);
  assert.equal(proxyaddr.compile('::ffff:10.0.0.0/8')('203.0.113.5'), false);
  const trusted = proxyaddr.compile('10.0.0.0/8');
  assert.equal(trusted('10.1.2.3'), true);
  assert.equal(trusted('203.0.113.5'), false);
});

test('Engine.IO rejects protocol-mismatched upgrades and preserves valid upgrades', { timeout: 10000 }, async t => {
  const server = http.createServer();
  const engine = new Server();
  const clients = [];
  engine.attach(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const client of clients) client.terminate();
    engine.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const address = `127.0.0.1:${server.address().port}`;
  const handshake = await fetch(`http://${address}/engine.io/?EIO=4&transport=polling`);
  assert.equal(handshake.status, 200);
  const { sid } = JSON.parse((await handshake.text()).slice(1));
  for (const revision of ['', '&EIO=3']) {
    const client = new WebSocket(`ws://${address}/engine.io/?transport=websocket&sid=${sid}${revision}`);
    clients.push(client);
    const rejected = new Promise((resolve, reject) => {
      client.on('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); });
      client.on('open', () => reject(new Error('Mismatched upgrade was accepted')));
      client.on('error', reject);
    });
    assert.equal(await rejected, 400);
  }
  const valid = new WebSocket(`ws://${address}/engine.io/?transport=websocket&sid=${sid}&EIO=4`);
  clients.push(valid);
  await once(valid, 'open');
  const probe = once(valid, 'message');
  valid.send('2probe');
  assert.equal((await probe)[0].toString(), '3probe');
  valid.send('5');
});
