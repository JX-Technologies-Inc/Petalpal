import { apiRequest } from './api';

export interface FairyMomentPost {
  id: string; postedAt: string; state: string; location: string; mood: string | null;
  photoKey: string | null; caption: string; liked: boolean;
}
export interface FairyMomentsPage {
  fairy: { id: string; type: string; name: string };
  posts: FairyMomentPost[];
  nextBefore: string | null;
}
export interface FairyMomentsStatus { enabled: boolean; unread: boolean }

// Reconciles the Fairy's server-side day, which is also what records her new Moments.
// The response carries `moments` only for owners on the server's Moments allowlist;
// anything else (not listed, onboarding unfinished, offline) keeps the Fairy icon as before.
export async function syncFairyMoments(): Promise<FairyMomentsStatus> {
  try {
    const runtime = await apiRequest<{ moments?: { unread?: boolean } }>('/api/fairy/runtime');
    return runtime.moments ? { enabled: true, unread: Boolean(runtime.moments.unread) } : { enabled: false, unread: false };
  } catch {
    return { enabled: false, unread: false };
  }
}

export const loadFairyMoments = (before?: string | null) =>
  apiRequest<FairyMomentsPage>(`/api/fairy/moments${before ? `?before=${encodeURIComponent(before)}` : ''}`);

export const likeFairyMoment = (momentId: string, liked: boolean) =>
  apiRequest<{ liked: boolean }>(`/api/fairy/moments/${encodeURIComponent(momentId)}/like`, 'POST', { liked });
