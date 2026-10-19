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
