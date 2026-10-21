import { getLocalCalendarDate } from './dateHelpers';
import type { MoodCategory } from './types';

// Owner-approved mapping (2026-10-20). The user's own Primary Garden Mood sets the level;
// AI secondary emotions may only strengthen it one step in the same direction, never
// flip it or change a neutral mood. Legacy or unknown moods stay neutral (no effect).
export const PRIMARY_MOOD_LEVELS: Readonly<Record<string, MoodCategory>> = {
  SUNNY_BLOOM: 'very_positive',
  WONDER_BLOOM: 'positive',
  GENTLE_BLOOM: 'positive',
  PEACEFUL_BLOOM: 'neutral',
  HEALING_BLOOM: 'neutral',
  DRIFTING_BLOOM: 'neutral',
  FIRE_BLOOM: 'neutral',
  QUIET_BLOOM: 'negative',
};

// "sadness" never appears as a Quiet secondary (it is Quiet's redundant label), so in
// practice disappointment or remorse strengthens Quiet.
const BOOSTS: Partial<Record<MoodCategory, { to: MoodCategory; emotions: readonly string[] }>> = {
  negative: { to: 'very_negative', emotions: ['sadness', 'disappointment', 'remorse'] },
  positive: { to: 'very_positive', emotions: ['joy', 'excitement', 'gratitude'] },
};

export function gardenMoodLevel(primaryMood?: string, secondaryEmotions: readonly string[] = []): MoodCategory {
  const level = PRIMARY_MOOD_LEVELS[primaryMood ?? ''] ?? 'neutral';
  const boost = BOOSTS[level];
  return boost && secondaryEmotions.some(emotion => boost.emotions.includes(emotion)) ? boost.to : level;
}

// The friend's design keeps an effect only for the day the flower was planted, until the
// next local midnight. Days are the account timezone's (time.md), never a default zone.
export function moodEffectActiveToday(plantedDate: string | undefined, timeZone: string | undefined, now: Date = new Date()) {
  if (!plantedDate || !timeZone || Number.isNaN(new Date(plantedDate).getTime())) return false;
  try {
    return getLocalCalendarDate(plantedDate, timeZone) === getLocalCalendarDate(now, timeZone);
  } catch {
    return false;
  }
}
