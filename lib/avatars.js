// The avatar library: portraits bundled in the app as mobile/assets/avatars/<id>.webp
// (scripts/compress-avatars.mjs). A User's avatar is one of these ids or a legacy emoji;
// the Fairy's Moments avatar is one of these ids or null for her default photo.
export const AVATAR_IDS = Object.freeze(["fairy-1", "fairy-2", "fairy-3", "fairy-4", "fairy-5", "fairy-6", "fairy-7", "fairy-8"]);

export const isLibraryAvatar = value => typeof value === "string" && AVATAR_IDS.includes(value);
