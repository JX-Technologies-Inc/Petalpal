import type { FairyState } from './FairyNavigation';
import { distance, type Point } from './walkNetwork';

// The Garden follows her server-side day (GET /api/fairy/runtime, lib/fairy-runtime.js) for owners
// the server marks with `gardenSchedule`. Opening the Garden puts her straight where she is; a change
// while you watch, she travels there; on a walk (IDLE) she strolls between path points on her own.
// A tap on her or a landmark wins, and she returns to her day a minute after the last one.
export type ScheduleRest = 'tea' | 'swing' | 'moon' | 'treehouse' | 'mailbox' | 'path';
export const SCHEDULE_REST: Readonly<Record<string, ScheduleRest>> = {
  TEA_TIME: 'tea', SWINGING: 'swing', SLEEPING: 'moon', IN_TREEHOUSE: 'treehouse', AT_MAILBOX: 'mailbox', IDLE: 'path',
};
export const scheduleRest = (state: string | null | undefined): ScheduleRest | null => (state && SCHEDULE_REST[state]) || null;

export const USER_HOLD_MS = 60_000;
export const WANDER_PAUSE_MS: readonly [number, number] = [8_000, 20_000];
// After a 'go' that could not start (no route right now), wait before trying again.
export const RETRY_MS = 10_000;
export const MAILBOX_STAND_RADIUS = 30;

const RESTING: Record<Exclude<ScheduleRest, 'mailbox' | 'path'>, readonly FairyState[]> = {
  tea: ['seatedAtTea', 'drinkingTea'], swing: ['sittingOnSwing'], moon: ['sleepingOnMoonBed'], treehouse: ['insideTreehouse'],
};
// On her way somewhere, or in the letter sequence: never interrupted by the schedule.
const SETTLED: readonly FairyState[] = ['idle', 'seatedAtTea', 'drinkingTea', 'sittingOnSwing', 'sleepingOnMoonBed', 'insideTreehouse'];

export type ScheduleAction = 'place' | 'leaveTreehouse' | 'go' | 'wander' | 'wait';
export type ScheduleInput = {
  rest: ScheduleRest; navState: FairyState; position: Point; mailboxStand: Point;
  placed: boolean; now: number; userAt: number; idleSince: number; pauseMs: number; retryAt: number;
};

export function scheduleAction(input: ScheduleInput): ScheduleAction {
  const { rest, navState, now } = input;
  if (!input.placed) return 'place';
  if (now - input.userAt < USER_HOLD_MS || now < input.retryAt || !SETTLED.includes(navState)) return 'wait';
  if (navState === 'insideTreehouse' && rest !== 'treehouse') return 'leaveTreehouse';
  if (rest === 'path') return navState !== 'idle' || now - input.idleSince >= input.pauseMs ? 'wander' : 'wait';
  if (rest === 'mailbox') return navState === 'idle' && distance(input.position, input.mailboxStand) <= MAILBOX_STAND_RADIUS ? 'wait' : 'go';
  return RESTING[rest].includes(navState) ? 'wait' : 'go';
}

// A path point to stroll to, picked by `random` (0..1): not where she stands, and near enough to
// walk (she flies beyond four of her heights, about 490 units), else any point further on.
export const WANDER_DISTANCE: readonly [number, number] = [120, 450];
export function wanderTarget(nodes: readonly Point[], from: Point, random: () => number, [near, far] = WANDER_DISTANCE): Point | null {
  const away = nodes.filter(node => distance(node, from) >= near);
  const walkable = away.filter(node => distance(node, from) <= far);
  const pool = walkable.length ? walkable : away;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : null;
}

export const wanderPause = (random: () => number) => WANDER_PAUSE_MS[0] + random() * (WANDER_PAUSE_MS[1] - WANDER_PAUSE_MS[0]);
