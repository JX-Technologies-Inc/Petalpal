import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import worker from '../../cloudflare-worker/src/index.js';
import { validSpeechAudio, SPEECH_MODEL } from '../../lib/speech-audio.js';
import { speechTranscriptionHandler } from '../../lib/speech-transcription.js';
const audio = Buffer.from('\0\0\0\x18ftypM4A \0\0\0\0').toString('base64');
const payload = { audio, mimeType: 'audio/mp4' };

test('speech validates declared format, file signature, base64, and size', () => {
  assert.equal(validSpeechAudio(payload), true);
  for (const bad of [null, {}, { ...payload, mimeType: 'text/plain' }, { ...payload, audio: '!!!!' },
    { ...payload, audio: Buffer.from('this is not audio').toString('base64') },
    { ...payload, audio: 'A'.repeat(12 * 1024 * 1024) }]) assert.equal(validSpeechAudio(bad), false);
});
test('speech Worker authenticates, uses Whisper only, returns transcript and handles failure', async () => {
  let calls = 0;
  const env = { RENDER_SHARED_SECRET: 'test', AI: { run: async (model, input) => {
    calls++; assert.equal(model, SPEECH_MODEL); assert.equal(input.audio, audio);
    assert.equal(input.task, 'transcribe'); return { text: '  A small moment.  ' };
  } } };
  const req = (token, body = payload) => new Request('https://worker.test/v1/speech/transcribe', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await worker.fetch(req('wrong'), env)).status, 401); assert.equal(calls, 0);
  assert.equal((await worker.fetch(req('test', {}), env)).status, 400); assert.equal(calls, 0);
  const result = await worker.fetch(req('test'), env);
  assert.deepEqual(await result.json(), { text: 'A small moment.' }); assert.equal(calls, 1);
  env.AI.run = async () => { throw Error('private provider detail'); };
  const failed = await worker.fetch(req('test'), env); assert.equal(failed.status, 502);
  assert.equal((await failed.text()).includes('private provider'), false);
});
test('speech API route rejects anonymous uploads and proxies authenticated audio without creating Events', async () => {
  let calls = 0;
  const app = express();
  app.post('/speech/transcribe', (req, res, next) => req.get('Authorization') === 'Bearer user'
    ? next() : res.sendStatus(401), express.json({ limit: '12mb' }), speechTranscriptionHandler({
      costGate: { async reserve({ action }) { assert.equal(action, 'SPEECH_TRANSCRIPTION'); } },
      env: { CLOUDFLARE_WORKER_AI_URL: 'https://worker.test/', CLOUDFLARE_WORKER_AI_TOKEN: 'server-only' },
      fetchImpl: async (url, options) => {
        calls++; assert.equal(url, 'https://worker.test/v1/speech/transcribe');
        assert.equal(options.headers.Authorization, 'Bearer server-only');
        assert.deepEqual(JSON.parse(options.body), payload);
        return Response.json({ text: 'A moment to edit.' });
      },
    }));
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/speech/transcribe`;
    const send = (token, body = payload) => fetch(url, { method: 'POST', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await send('wrong')).status, 401); assert.equal(calls, 0);
    assert.equal((await send('user', {})).status, 400); assert.equal(calls, 0);
    const result = await send('user'); assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { text: 'A moment to edit.' }); assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
