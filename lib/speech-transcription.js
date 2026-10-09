import { validSpeechAudio } from './speech-audio.js';
import prisma from './prisma.js';
import { PrismaAiCostGate, aiCostHttpStatus, aiCostError, isAiCostError } from './ai-cost-gate.js';

const speechLease = Symbol('speechLease');

// Bound large parsed bodies and provider work together; never queue uploads.
export function speechAdmission({ maxInflight = 4, maxPerUser = 1, uploadTimeoutMs = 30_000 } = {}) {
  for (const value of [maxInflight, maxPerUser, uploadTimeoutMs]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid speech admission limit');
  }
  let active = 0;
  const owners = new Map();
  return (req, res, next) => {
    const owner = req.auth?.userId;
    if (!owner) return res.status(401).json({ error: 'Authentication required' });
    const owned = owners.get(owner) || 0;
    if (owned >= maxPerUser || active >= maxInflight) {
      res.set('Retry-After', '1');
      return res.status(owned >= maxPerUser ? 429 : 503).json({ error: 'Voice input is busy. Please try again shortly or type your Event.' });
    }
    active++; owners.set(owner, owned + 1);
    const controller = new AbortController();
    let running = false, released = false;
    const release = () => {
      if (released) return;
      released = true; clearTimeout(timer);
      active--;
      const remaining = owners.get(owner) - 1;
      if (remaining) owners.set(owner, remaining); else owners.delete(owner);
      req.off('aborted', disconnected); res.off('close', closed); res.off('finish', finished);
      req.body = undefined;
    };
    const disconnected = () => {
      controller.abort();
      // A disconnected handler may still hold audio/provider work. Its finally
      // releases the slot only once that work actually settles.
      if (!running) release();
    };
    const closed = () => { if (!res.writableFinished) disconnected(); else if (!running) release(); };
    const finished = () => { if (!running) release(); };
    const timer = setTimeout(() => { disconnected(); req.destroy(); res.destroy(); }, uploadTimeoutMs);
    timer.unref();
    req[speechLease] = {
      signal: controller.signal,
      start() { running = true; clearTimeout(timer); },
      release,
    };
    req.once('aborted', disconnected); res.once('close', closed); res.once('finish', finished);
    next();
  };
}

export function speechTranscriptionHandler({ env = process.env, fetchImpl = fetch, costGate = new PrismaAiCostGate(prisma, { env }) } = {}) {
  return async (req, res) => {
    const lease = req[speechLease];
    lease?.start();
    res.set('Cache-Control', 'no-store');
    try {
      if (lease?.signal.aborted) return;
      if (!validSpeechAudio(req.body)) return res.status(400).json({ error: 'Use a valid M4A, WebM, or Ogg recording up to 8 MB.' });
      const url = String(env.CLOUDFLARE_WORKER_AI_URL || '').replace(/\/$/, '');
      const token = env.CLOUDFLARE_WORKER_AI_TOKEN;
      if (!url || !token) return res.status(503).json({ error: 'Voice input is temporarily unavailable.' });
      const reservation = await costGate.reserve({ identity: req.auth, action: 'SPEECH_TRANSCRIPTION' });
      if (lease?.signal.aborted) return;
      const response = await fetchImpl(`${url}/v1/speech/transcribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio: req.body.audio, mimeType: req.body.mimeType }),
        signal: lease ? AbortSignal.any([lease.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error('Transcription provider failed');
      const data = await response.json();
      if (lease?.signal.aborted) return;
      if (typeof data?.text !== 'string' || data.text.length > 20000) throw new Error('Invalid transcript');
      await costGate.checkProcessingConsent({ identity: req.auth, consentUpdatedAt: reservation.consentUpdatedAt });
      return res.json({ text: data.text.trim() });
    } catch (error) {
      if (lease?.signal.aborted) return;
      if (isAiCostError(error)) return res.status(aiCostHttpStatus(error.code)).json({ error: aiCostError(error.code).message, code: error.code });
      return res.status(502).json({ error: 'Unable to transcribe this recording. Please try again or type your Event.' });
    } finally {
      // Audio is request-scoped memory only. Never write or log it.
      req.body = undefined;
      lease?.release();
    }
  };
}
