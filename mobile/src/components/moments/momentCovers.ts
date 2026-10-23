// Fairy Moments cover library, keyed by the server's ids (lib/moment-covers.js). Cut from the
// owner's garden-scene sheets; replace a file with the full-size original to sharpen it.
export const MOMENT_COVERS: Record<string, number> = {
  'cover-01': require('@/assets/moment-covers/cover-01.webp'),
  'cover-02': require('@/assets/moment-covers/cover-02.webp'),
  'cover-03': require('@/assets/moment-covers/cover-03.webp'),
  'cover-04': require('@/assets/moment-covers/cover-04.webp'),
  'cover-05': require('@/assets/moment-covers/cover-05.webp'),
  'cover-06': require('@/assets/moment-covers/cover-06.webp'),
  'cover-07': require('@/assets/moment-covers/cover-07.webp'),
  'cover-08': require('@/assets/moment-covers/cover-08.webp'),
  'cover-09': require('@/assets/moment-covers/cover-09.webp'),
  'cover-10': require('@/assets/moment-covers/cover-10.webp'),
  'cover-11': require('@/assets/moment-covers/cover-11.webp'),
  'cover-12': require('@/assets/moment-covers/cover-12.webp'),
};
export const MOMENT_COVER_IDS = Object.keys(MOMENT_COVERS);
export const momentCover = (id?: string | null) => (id ? MOMENT_COVERS[id] : undefined);
