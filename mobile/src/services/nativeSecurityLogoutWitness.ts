import { nativeSecurityEnabled } from './nativeSecurity';

let witness: ((erased: boolean) => Promise<void>) | null = null;
// In-memory, one-shot arm. Only the normal logout completion calls the writer;
// activation/startup cleanup never calls it, including after a new JS runtime.
export function armNativeLogoutWitness(write: (erased: boolean) => Promise<void>) {
  if (!__DEV__ || !nativeSecurityEnabled) throw new Error('Isolated native test required');
  if (witness) throw new Error('Logout witness already armed');
  witness = write;
}
export function disarmNativeLogoutWitness() { witness = null; }
export async function recordNativeLogoutWitness(erased: boolean) {
  if (!__DEV__ || !nativeSecurityEnabled || !witness) return;
  const write = witness;
  witness = null;
  // Test evidence failure is handled by the harness; it does not change logout.
  try { await write(erased); } catch { /* No private adapter error logging. */ }
}
