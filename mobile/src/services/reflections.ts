import { apiRequest } from './api';

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
export const listReflections = (cursor?: string, signal?: AbortSignal) =>
  apiRequest<{ reports: SavedReport[]; nextCursor: string | null }>(`/ai/reports?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET', undefined, { signal });
export const readReflection = (report: SavedReport, signal?: AbortSignal) =>
  apiRequest<ReflectionReport>(`/ai/reports/${report.type}/${encodeURIComponent(report.id)}`, 'GET', undefined, { signal });
