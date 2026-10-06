import { Platform } from 'react-native';
import { readAsStringAsync, deleteAsync, EncodingType, getInfoAsync } from 'expo-file-system/legacy';
import { apiRequest } from './api';

const MAX_BYTES = 8 * 1024 * 1024;
export async function discardRecording(uri: string) {
  if (Platform.OS === 'web') URL.revokeObjectURL(uri);
  else await deleteAsync(uri, { idempotent: true });
}
export async function transcribeRecording(uri: string, signal: AbortSignal): Promise<string> {
  let audio: string;
  let mimeType = 'audio/mp4';
  if (Platform.OS === 'web') {
    const response = await fetch(uri, { signal });
    const blob = await response.blob();
    if (!blob.size || blob.size > MAX_BYTES) throw new Error('Recordings must be no larger than 8 MB.');
    mimeType = blob.type.split(';')[0];
    audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read recording.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    });
  } else {
    const info = await getInfoAsync(uri);
    if (!info.exists || !info.size || info.size > MAX_BYTES) throw new Error('Recordings must be no larger than 8 MB.');
    audio = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  }
  const result = await apiRequest<{ text: string }>('/speech/transcribe', 'POST', { audio, mimeType }, { signal });
  if (typeof result.text !== 'string') throw new Error('Unable to read transcript.');
  return result.text.trim();
}
