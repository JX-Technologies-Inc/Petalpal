// Bundled Fairy Moments photos keyed by the server's photoKey (FAIRY_MOMENTS_CONFIG).
// Rendered from the garden's own art by scripts/render-fairy-moment-photos.mjs.
export const MOMENT_PHOTOS: Record<string, number> = {
  'TEA_TIME/1': require('@/assets/moments/TEA_TIME-1.jpg'),
  'TEA_TIME/2': require('@/assets/moments/TEA_TIME-2.jpg'),
  'TEA_TIME/3': require('@/assets/moments/TEA_TIME-3.jpg'),
  'TEA_TIME/4': require('@/assets/moments/TEA_TIME-4.jpg'),
  'SWINGING/1': require('@/assets/moments/SWINGING-1.jpg'),
  'SWINGING/2': require('@/assets/moments/SWINGING-2.jpg'),
  'SWINGING/3': require('@/assets/moments/SWINGING-3.jpg'),
  'AT_MAILBOX/1': require('@/assets/moments/AT_MAILBOX-1.jpg'),
  'AT_MAILBOX/2': require('@/assets/moments/AT_MAILBOX-2.jpg'),
  'AT_MAILBOX/3': require('@/assets/moments/AT_MAILBOX-3.jpg'),
  'IN_TREEHOUSE/1': require('@/assets/moments/IN_TREEHOUSE-1.jpg'),
  'IN_TREEHOUSE/2': require('@/assets/moments/IN_TREEHOUSE-2.jpg'),
  'IN_TREEHOUSE/3': require('@/assets/moments/IN_TREEHOUSE-3.jpg'),
  'SLEEPING/1': require('@/assets/moments/SLEEPING-1.jpg'),
  'SLEEPING/2': require('@/assets/moments/SLEEPING-2.jpg'),
  'IDLE/PAVILION': require('@/assets/moments/IDLE-PAVILION.jpg'),
  'IDLE/EAST_BRIDGE': require('@/assets/moments/IDLE-EAST_BRIDGE.jpg'),
  'IDLE/GARDEN_ARCH': require('@/assets/moments/IDLE-GARDEN_ARCH.jpg'),
  'IDLE/STEPPING_STONES': require('@/assets/moments/IDLE-STEPPING_STONES.jpg'),
  'IDLE/SOUTH_BRIDGE': require('@/assets/moments/IDLE-SOUTH_BRIDGE.jpg'),
};

export const momentPhoto = (photoKey: string | null) => (photoKey ? MOMENT_PHOTOS[photoKey] : undefined);
