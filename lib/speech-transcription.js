import { validSpeechAudio } from './speech-audio.js';

export function speechTranscriptionHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!validSpeechAudio(req.body)) return res.status(400).json({ error: 'Use a valid M4A, WebM, or Ogg recording up to 8 MB.' });
    const url = String(env.CLOUDFLARE_WORKER_AI_URL || '').replace(/\/$/, '');
    const token = env.CLOUDFLARE_WORKER_AI_TOKEN;
    if (!url || !token) return res.status(503).json({ error: 'Voice input is temporarily unavailable.' });
    try {
      const response = await fetchImpl(`${url}/v1/speech/transcribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio: req.body.audio, mimeType: req.body.mimeType }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error('Transcription provider failed');
      const data = await response.json();
      if (typeof data?.text !== 'string' || data.text.length > 20000) throw new Error('Invalid transcript');
      return res.json({ text: data.text.trim() });
    } catch {
      return res.status(502).json({ error: 'Unable to transcribe this recording. Please try again or type your Event.' });
    } finally {
      // Audio is request-scoped memory only. Never write or log it.
      req.body = undefined;
    }
  };
}
