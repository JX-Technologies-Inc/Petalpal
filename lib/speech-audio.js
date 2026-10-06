// Shared by the API and Worker; no storage, Event, or provider credentials here.
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_JSON_BYTES = 12 * 1024 * 1024;
export const SPEECH_MODEL = '@cf/openai/whisper-large-v3-turbo';
export function validSpeechAudio(body) {
  if (!body || typeof body.audio !== 'string' || typeof body.mimeType !== 'string') return false;
  const { audio, mimeType } = body;
  if (!audio.length || audio.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 ||
      audio.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return false;
  const bytes = audio.length / 4 * 3 - (audio.endsWith('==') ? 2 : audio.endsWith('=') ? 1 : 0);
  if (bytes < 12 || bytes > MAX_AUDIO_BYTES) return false;
  const head = atob(audio.slice(0, 32));
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return head.slice(4, 8) === 'ftyp';
  if (mimeType === 'audio/webm') return head.startsWith('\x1a\x45\xdf\xa3');
  if (mimeType === 'audio/ogg') return head.startsWith('OggS');
  return false;
}
