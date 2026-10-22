import { apiRequest } from './api';

export interface FairyMomentPost {
  id: string; postedAt: string; state: string; location: string; mood: string | null;
  photoKey: string | null; caption: string; liked: boolean;
}
export interface FairyMomentsPage {
  fairy: { id: string; type: string; name: string; avatar?: string | null }; // avatar: library id, null = her photo
  locale?: string; // 'en' | 'zh-Hans', the owner's chosen language (same as her captions)
  posts: FairyMomentPost[];
  nextBefore: string | null;
}
// Whether her Moments are on and unread comes with her runtime (services/fairyRuntime.ts),
// whose reconcile is also what records her new Moments.

export const loadFairyMoments = (before?: string | null) =>
  apiRequest<FairyMomentsPage>(`/api/fairy/moments${before ? `?before=${encodeURIComponent(before)}` : ''}`);

export const likeFairyMoment = (momentId: string, liked: boolean) =>
  apiRequest<{ liked: boolean }>(`/api/fairy/moments/${encodeURIComponent(momentId)}/like`, 'POST', { liked });

// Her Moments avatar is chosen apart from the owner's own avatar; null restores her photo.
export const setFairyMomentsAvatar = (avatar: string | null) =>
  apiRequest<{ avatar: string | null }>('/api/fairy/moments/avatar', 'PUT', { avatar });
