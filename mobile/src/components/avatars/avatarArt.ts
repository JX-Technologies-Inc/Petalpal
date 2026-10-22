// The avatar library bundled in the app, keyed by the server's ids (lib/avatars.js).
// Compressed from the owner's portraits by scripts/compress-avatars.mjs.
export const AVATAR_ART: Record<string, number> = {
  'fairy-1': require('@/assets/avatars/fairy-1.webp'),
  'fairy-2': require('@/assets/avatars/fairy-2.webp'),
  'fairy-3': require('@/assets/avatars/fairy-3.webp'),
  'fairy-4': require('@/assets/avatars/fairy-4.webp'),
  'fairy-5': require('@/assets/avatars/fairy-5.webp'),
  'fairy-6': require('@/assets/avatars/fairy-6.webp'),
  'fairy-7': require('@/assets/avatars/fairy-7.webp'),
  'fairy-8': require('@/assets/avatars/fairy-8.webp'),
};
export const AVATAR_IDS = Object.keys(AVATAR_ART);
export const DEFAULT_AVATAR = 'fairy-1';
// Accounts made before the library keep their emoji (🦋, 🐝, 🐦) until they choose a portrait.
export const avatarArt = (avatar?: string | null) => (avatar ? AVATAR_ART[avatar] : undefined);
