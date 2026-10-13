// Synthetic review fixtures only. These functions call existing pure renderers;
// they do not dispatch a provider or implement a new native-writing contract.
import { monthlyPeriodFor, weeklyPeriodForLocalDate } from '../../lib/ai-periods.js';
import { REPORT_EVIDENCE_LIMITS } from '../../lib/report-foundation.js';
import { reportSourceSnapshot } from '../../lib/report-write-fence.js';
import { selectMonthlyEvidence, MONTHLY_EVIDENCE_POLICY } from '../../lib/monthly-evidence.js';
import { buildWeeklyReflectionPacket, validateWeeklyReflection, WEEKLY_REFLECTION_CONTRACT } from '../../lib/sonnet-weekly.js';
import { buildMonthlyReflectionPacket, validateMonthlyReflection, MONTHLY_REFLECTION_CONTRACT, monthlyTextLength } from '../../lib/opus-monthly.js';

export const reviewLocales = ['en', 'zh-Hans', 'zh-Hant'];
export const reviewSources = {
  en: ['I felt frustrated about the delayed project. I did not argue with colleagues.',
    'I tried charcoal to draw the trees in River Park.',
    'I drew River Park in my sketchbook. I did not enter an exhibition.',
    'I shared the charcoal drawing with a friend. They said they liked the trees.'],
  'zh-Hans': ['项目延期让我很烦，我没有和同事吵架。', '我试着用炭笔画 River Park 的树。',
    '我把 River Park 画进了 sketchbook，没有参加展览。', '我把炭笔画发给朋友。朋友说喜欢画里的树。'],
  'zh-Hant': ['專案延期讓我很煩，我沒有和同事吵架。', '我試著用炭筆畫 River Park 的樹。',
    '我把 River Park 畫進了 sketchbook，沒有參加展覽。', '我把炭筆畫傳給朋友。朋友說喜歡畫裡的樹。']
};

export function reviewInput(type, locale) {
  const ownerId = 'synthetic-owner', identity = { userId: ownerId };
  const period = type === 'WEEKLY' ? weeklyPeriodForLocalDate('2026-09-14', 'UTC')
    : monthlyPeriodFor({ year: 2026, month: 9, timezone: 'UTC' });
  const indexes = type === 'WEEKLY' ? [0, 2] : [0, 1, 2, 3];
  const days = type === 'WEEKLY' ? [16, 19] : [2, 9, 16, 27];
  const events = indexes.map((index, i) => {
    const id = `synthetic-${i}`, occurredAt = new Date(`2026-09-${String(days[i]).padStart(2, '0')}T12:00:00Z`);
    return { id, ownerId, occurredAt, updatedAt: new Date('2026-10-01'), memoryProcessingAllowed: true,
      memory: { id: `memory-${i}`, ownerId, sourceEventId: id, summary: reviewSources[locale][index], memoryType: 'EVENT', topics: [],
        updatedAt: new Date('2026-10-01'), embeddingInputRevision: 1, importanceScore: null, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null } };
  });
  const evidence = events.map(event => ({ ownerId, sourceEventId: event.id, sourceMemoryId: event.memory.id, summary: event.memory.summary,
    topics: [], eventDate: event.occurredAt, importanceScore: null, provenance: { sourceEventId: event.id, sourceMemoryId: event.memory.id } }));
  return { reportType: type, ownerId, locale, period,
    aggregates: { ...period, ownerId, year: 2026, month: 9, eventCount: events.length, topTopics: [] },
    sourceFence: { evidencePolicy: type === 'WEEKLY' ? 'weekly-localized-v1' : MONTHLY_EVIDENCE_POLICY,
      consentUpdatedAt: new Date('2000-01-01'), preferredLocale: locale, sources: reportSourceSnapshot(events) },
    evidenceSelection: type === 'WEEKLY' ? { ownerId, status: 'READY', evidence }
      : selectMonthlyEvidence({ identity, period, events, previousEvents: [], limits: REPORT_EVIDENCE_LIMITS.MONTHLY }) };
}

export function renderReview(type, locale) {
  const input = reviewInput(type, locale);
  if (type === 'WEEKLY') {
    const packet = buildWeeklyReflectionPacket(input);
    const plan = { version: WEEKLY_REFLECTION_CONTRACT, locale, moments: packet.evidence.map(item => ({ ref: item.ref, quote: item.sentences[0] })), insights: [] };
    return { input, plan, result: validateWeeklyReflection(plan, input) };
  }
  const packet = buildMonthlyReflectionPacket(input), fact = packet.facts.find(item => item.kind === 'CROSS_WEEK_MOMENTS');
  const plan = { version: MONTHLY_REFLECTION_CONTRACT, locale, overview: 'O1',
    insights: [{ kind: fact.kind, factId: fact.id }], closing: { factId: fact.id, style: 'OPEN' } };
  return { input, plan, result: validateMonthlyReflection(plan, input) };
}

export function renderedExamplesMarkdown() {
  return '# Deterministic current-renderer examples\n\n' +
    'Generated from synthetic fixtures by existing v1 renderers. No Claude call, translation stage or native-prose validation. These show current limitations, not the requested upgrade.\n\n' +
    ['WEEKLY', 'MONTHLY'].flatMap(type => reviewLocales.map(locale => {
      const { input, result } = renderReview(type, locale);
      return `## ${type} / ${locale}\n\nSources (synthetic, verbatim):\n\n` +
        input.evidenceSelection.evidence.map(item => `- ${item.summary}`).join('\n') +
        `\n\nActual renderer output (${monthlyTextLength(result.narrative)} graphemes excluding layout whitespace):\n\n${result.narrative}\n`;
    })).join('\n');
}
