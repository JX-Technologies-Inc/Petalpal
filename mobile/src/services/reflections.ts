import { ApiError, apiRequest } from './api';

export type ReportType = 'weekly' | 'monthly';
export interface SavedReport {
  id: string; type: ReportType; periodKey: string; periodStartUtc: string;
  periodEndUtc: string; createdAt: string; status: string;
}
export interface ReflectionReport {
  id: string; summary: string | null; eventCount: number;
  topTopics: { topic: string; count: number }[];
  narrativeSections: { kind: string; claim: string }[];
  trendSignals: { status?: string; eventCountChange?: number;
    topicChanges?: { topic: string; currentCount: number; previousCount: number; change: number }[] };
}
export interface WeeklyTriggerResult {
  periodKey: string; execution: string;
  job: { status: string } | null;
  report: { id: string; periodKey: string; narrativeStatus: string } | null;
}
export const listReflections = (cursor?: string, signal?: AbortSignal) =>
  apiRequest<{ reports: SavedReport[]; nextCursor: string | null }>(`/ai/reports?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET', undefined, { signal });
export const readReflection = (report: SavedReport, signal?: AbortSignal) =>
  apiRequest<ReflectionReport>(`/ai/reports/${report.type}/${encodeURIComponent(report.id)}`, 'GET', undefined, { signal });
// An empty body lets the server pick the most recent closed week in the owner's timezone,
// so an open week is never targeted. One job per owner and week: repeat presses are safe.
export const createLastWeekReflection = (signal?: AbortSignal) =>
  apiRequest<WeeklyTriggerResult>('/ai/reports/weekly/trigger', 'POST', {}, { signal });

// Weekly periodKey is the local Monday (YYYY-MM-DD) of a Monday-Sunday week.
export function lastClosedWeekKey(now = new Date()) {
  const offset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset - 7);
  return [monday.getFullYear(), monday.getMonth() + 1, monday.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
}
// "October · Week 2" (the Monday's week of its month) and "Oct 12 – 18" for a Weekly periodKey.
export function weekLabel(periodKey: string) {
  const match = periodKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { title: periodKey, chip: periodKey, range: '' };
  const [year, month, day] = match.slice(1).map(Number), start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(Date.UTC(year, month - 1, day + 6));
  const name = (date: Date, style: 'long' | 'short') => date.toLocaleDateString('en-US', { month: style, timeZone: 'UTC' });
  const week = Math.ceil(day / 7);
  return { title: `${name(start, 'long')} · Week ${week}`, chip: `${name(start, 'short')} · Week ${week}`,
    range: `${name(start, 'short')} ${day} – ${end.getUTCMonth() === start.getUTCMonth() ? '' : `${name(end, 'short')} `}${end.getUTCDate()}` };
}

export type WeeklyTriggerOutcome = {
  kind: 'ready' | 'empty' | 'pending' | 'consent' | 'paused' | 'failed'; message: string; periodKey?: string;
};
export function weeklyTriggerOutcome(result?: WeeklyTriggerResult, error?: unknown): WeeklyTriggerOutcome {
  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 403) return { kind: 'consent', message: 'Turn on AI memory in your privacy settings to create reflections.' };
    if ([409, 429, 503].includes(status)) return { kind: 'paused', message: 'Reflections are taking a short break. Please try again later.' };
    if (status === 502) return { kind: 'failed', message: 'Last week’s reflection couldn’t be written.' };
    const message = (error as { message?: unknown }).message;
    return { kind: 'failed', message: typeof message === 'string' && message ? message : 'Unable to create last week’s reflection.' };
  }
  const periodKey = result?.periodKey;
  if (result?.report?.narrativeStatus === 'GENERATED') return { kind: 'ready', message: 'Last week’s reflection is ready.', periodKey };
  if (result?.job?.status === 'SUCCEEDED') {
    return { kind: 'empty', message: 'Last week didn’t have enough moments for a written reflection.', periodKey };
  }
  return { kind: 'pending', message: 'Last week’s reflection is being written. Check back in a few minutes.', periodKey };
}
