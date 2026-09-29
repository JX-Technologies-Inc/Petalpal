import contract from './contract.generated.json';
import type { SecondaryEmotion, EffectTier } from './flowerVisualTypes';

// Static presentation first: no timers, animation subscriptions or per-flower loops.
// Pulse/tremble/flash are motion directions only until a shared event clock is supplied.
export const EFFECTS = {
  none: { shape: 'none', motion: 'none' },
  soft_glow: { shape: 'halo', motion: 'none' }, warm_halo: { shape: 'halo', motion: 'none' },
  soft_sparkle: { shape: 'points', motion: 'long-interval' },
  flash_sparkle: { shape: 'points', motion: 'one-shot-only' },
  subtle_pulse: { shape: 'halo', motion: 'slow-low-amplitude' },
  slow_pulse: { shape: 'halo', motion: 'slow-low-amplitude' },
  soft_mist: { shape: 'mist', motion: 'none' },
  subtle_shimmer: { shape: 'points', motion: 'long-interval' },
  gentle_tremble: { shape: 'mist', motion: 'tiny-shared-motion' },
  brief_opening_flash: { shape: 'points', motion: 'one-shot-only' },
} as const;
export type EffectName = keyof typeof EFFECTS;
// Backend token -> shared rendering primitive. No emotion pair keys or asset lookups.
export const BACKEND_EFFECTS: Record<string, EffectName> = {
  SOFT_SHIMMER: 'subtle_shimmer', PLAYFUL_SPARKLE: 'soft_sparkle', HEAT_SPARK: 'soft_sparkle',
  SUBTLE_FLICKER: 'gentle_tremble', GENTLE_GLOW: 'soft_glow', DRIFTING_MOTES: 'soft_mist',
  ORBITING_MOTES: 'subtle_shimmer', SOFT_RAIN: 'soft_mist', SUBTLE_SPORES: 'soft_mist',
  BURST_SPARKLE: 'subtle_pulse', SUBTLE_MIST: 'gentle_tremble', SOFT_SPARKLE: 'soft_sparkle',
  SUNLIGHT: 'soft_glow', RISING_LIGHT: 'warm_halo', DEW_SHIMMER: 'subtle_shimmer', FLASH_SPARKLE: 'flash_sparkle',
};
export const EFFECT_BUDGET: Record<EffectTier, { opacity: number; particles: number }> = {
  SUBTLE: { opacity: 0.07, particles: 1 }, STANDARD: { opacity: 0.13, particles: 2 },
  FOCUSED: { opacity: 0.20, particles: 3 },
};
export interface MainStyle {
  brightness: number; saturation: number; highlight: string; halo: boolean;
  postureIntent: string; colorAccent: string;
}
const style = (brightness: number, saturation: number, highlight: string, halo: boolean, postureIntent: string) =>
  ({ brightness, saturation, highlight, halo, postureIntent });
const DIRECTIONS: Record<SecondaryEmotion, Omit<MainStyle, 'colorAccent'>> = {
  admiration: style(1.02, 0.99, '#e4d4b2', false, 'refined-upright'),
  amusement: style(1.02, 1.02, '#e6b09e', false, 'light-playful'),
  anger: style(0.99, 1.04, '#c98162', false, 'sharper-energy'),
  annoyance: style(0.99, 1.01, '#d4a06f', false, 'mild-irregularity'),
  caring: style(1.01, 0.97, '#eadbbd', true, 'soft-embracing'),
  confusion: style(0.99, 0.98, '#b8acc9', false, 'mild-asymmetry'),
  curiosity: style(1.02, 1.00, '#bdcedc', false, 'outward-open'),
  disappointment: style(0.96, 0.93, '#b2bfcc', false, 'slightly-lowered'),
  disgust: style(0.98, 0.96, '#a7bdac', false, 'slightly-contracted'),
  excitement: style(1.04, 1.03, '#e6ce93', false, 'bright-open'),
  fear: style(0.96, 0.95, '#aebbc9', false, 'tightened'),
  gratitude: style(1.02, 1.00, '#e0c18a', true, 'warm-soft'),
  joy: style(1.04, 1.02, '#ead697', false, 'full-open'),
  love: style(1.01, 0.98, '#deb9be', true, 'soft-central'),
  optimism: style(1.03, 1.00, '#e8cda5', true, 'upward-growing'),
  remorse: style(0.94, 0.94, '#b5c2cf', false, 'inward-droop'),
  sadness: style(0.96, 0.94, '#afc1d3', false, 'gentle-droop'),
  surprise: style(1.04, 1.01, '#e9dfc5', false, 'brief-opening'),
};
export const EMOTION_STYLES = Object.fromEntries(Object.entries(DIRECTIONS).map(([key, main]) => {
  const token = contract.secondaryModifiers[key as SecondaryEmotion];
  return [key, { mainVariantStyle: { ...main, colorAccent: token.colorAccent },
    visualEffect: token.effect, secondaryEffect: BACKEND_EFFECTS[token.effect] }];
})) as Record<SecondaryEmotion, { mainVariantStyle: MainStyle; visualEffect: string; secondaryEffect: EffectName }>;
export const NEUTRAL_STYLE: MainStyle = { brightness: 1, saturation: 1, highlight: '#ddd8bf',
  halo: false, postureIntent: 'neutral', colorAccent: 'NONE' };

// Species colors and foliage stay intact: small luminance/saturation changes, never a flat tint.
export function colorMatrix(style: MainStyle): number[] {
  const s = style.saturation, b = style.brightness, r = .2126 * (1 - s), g = .7152 * (1 - s), bl = .0722 * (1 - s);
  return [(r+s)*b,g*b,bl*b,0,0, r*b,(g+s)*b,bl*b,0,0, r*b,g*b,(bl+s)*b,0,0, 0,0,0,1,0];
}
