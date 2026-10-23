// Fairy Moments cover library: garden scenes bundled in the app as
// mobile/assets/moment-covers/<id>.webp. The owner picks one for the top of PPL's Moments;
// null keeps her default treehouse photo.
export const MOMENT_COVER_IDS = Object.freeze(Array.from({ length: 12 }, (_, i) => `cover-${String(i + 1).padStart(2, "0")}`));

export const isMomentCover = value => typeof value === "string" && MOMENT_COVER_IDS.includes(value);
