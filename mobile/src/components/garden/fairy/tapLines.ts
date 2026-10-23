import bank from './tapLines.json';
import type { FairyState } from './FairyNavigation';
import type { Point } from './walkNetwork';

// What PPL says when the owner taps her. Lines are bundled and picked on the device,
// so a tap answers instantly and never calls a model. scripts/generate-fairy-tap-lines.mjs
// adds reviewed lines to tapLines.json offline.
export type TapActivity = 'SWINGING' | 'SLEEPING' | 'TEA_TIME' | 'IDLE';
export type TapLine = { id: string; activity: TapActivity | 'ANY'; source: string; en: string; zh: string };

export const TAP_LINES = bank.lines as TapLine[];
const ACTIVITY_WEIGHT = 3, ANY_WEIGHT = 1;
export const RECENT_TAP_LINES = 5;

// Chinese except Traditional (same rule as the server's weeklyReportLocale), else English.
export const zhHans = (locale?: string | null) =>
  /^zh(?:-|$)/i.test(locale || '') && !/(?:^|-)(hant|tw|hk|mo)(?:-|$)/i.test(locale || '');

// Only resting states answer; while she travels a tap keeps redirecting her.
export function tapActivity(state: FairyState): TapActivity | null {
  if (state === 'sittingOnSwing') return 'SWINGING';
  if (state === 'sleepingOnMoonBed') return 'SLEEPING';
  if (state === 'seatedAtTea' || state === 'drinkingTea') return 'TEA_TIME';
  if (state === 'idle') return 'IDLE';
  return null;
}

// The walking sprite is drawn 102×139 world units above her foot pivot (GardenFairy Frame).
export function hitsFairySprite(p: Point, at: Point | null | undefined) {
  if (!at) return false;
  const dx = p.x - at.x, dy = p.y - at.y;
  return dx >= -70 && dx <= 56 && dy >= -151 && dy <= 12;
}

// Lines for her activity weigh more than general ones; the last few shown are skipped
// while anything else is left.
export function pickTapLine(state: FairyState, locale: string | null | undefined, recent: readonly string[],
  random: () => number = Math.random, lines: readonly TapLine[] = TAP_LINES) {
  const activity = tapActivity(state);
  if (!activity) return null;
  const pool = lines.filter(line => line.activity === activity || line.activity === 'ANY');
  const fresh = pool.filter(line => !recent.includes(line.id));
  const candidates = fresh.length ? fresh : pool;
  if (!candidates.length) return null;
  const weight = (line: TapLine) => line.activity === 'ANY' ? ANY_WEIGHT : ACTIVITY_WEIGHT;
  let roll = random() * candidates.reduce((sum, line) => sum + weight(line), 0);
  const line = candidates.find(item => (roll -= weight(item)) < 0) ?? candidates[candidates.length - 1];
  return { id: line.id, text: zhHans(locale) ? line.zh : line.en };
}
