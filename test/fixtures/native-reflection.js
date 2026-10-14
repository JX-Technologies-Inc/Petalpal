import { monthlyPeriodFor, weeklyPeriodForLocalDate } from '../../lib/ai-periods.js';
import { REPORT_EVIDENCE_LIMITS } from '../../lib/report-foundation.js';
import { reportSourceSnapshot } from '../../lib/report-write-fence.js';
import { selectMonthlyEvidence, MONTHLY_EVIDENCE_POLICY } from '../../lib/monthly-evidence.js';
import { buildNativeReflectionPackage, validateNativeReflection, NATIVE_REFLECTION_VERSION, nativeTextLength } from '../../lib/native-reflection.js';

export const locales = ['en', 'zh-Hans', 'zh-Hant'];
const sources = {
  en: ['I felt very tired.',
    'I drew River Park with charcoal, without preparing for an exhibition.',
    'I put two drawings in my sketchbook and compared their different lines.',
    'I sent a charcoal drawing to a friend. They said they liked the space beside the branches.'],
  'zh-Hans': ['我感到很疲惫。',
    '周末我画了 River Park 的树，试着用炭笔留下枝叶的线条，没有准备参加任何展览。',
    '我把两张画放进 sketchbook，重新看了不同笔触，没有给作品起名字，也没有打算把它们送给别人。',
    '我把炭笔画发给朋友。对方说喜欢树枝旁边留白的部分，我把这句话记了下来，但没有继续修改画。'],
  'zh-Hant': ['我感到很疲憊。',
    '週末我畫了 River Park 的樹，試著用炭筆留下枝葉的線條，沒有準備參加任何展覽。',
    '我把兩張畫放進 sketchbook，重新看了不同筆觸，沒有替作品取名字，也沒有打算把它們送給別人。',
    '我把炭筆畫傳給朋友。對方說喜歡樹枝旁邊留白的部分，我把這句話記了下來，但沒有繼續修改畫。']
};
export function nativeFixture(type, locale) {
  const identity = { userId: 'synthetic-owner' }, ownerId = identity.userId;
  const period = type === 'WEEKLY' ? weeklyPeriodForLocalDate('2026-09-14', 'UTC') : monthlyPeriodFor({ year: 2026, month: 9, timezone: 'UTC' });
  const topic = locale === 'en' ? 'drawing' : locale === 'zh-Hant' ? '畫畫' : '画画';
  const indexes = type === 'WEEKLY' ? [0, 1] : [0, 1, 2, 3], days = type === 'WEEKLY' ? [16, 19] : [2, 9, 16, 27];
  const events = indexes.map((index, i) => {
    const id = `synthetic-${i}`, occurredAt = new Date(`2026-09-${String(days[i]).padStart(2, '0')}T12:00:00Z`);
    return { id, ownerId, occurredAt, updatedAt: new Date('2026-10-01'), memoryProcessingAllowed: true,
      memory: { id: `memory-${i}`, ownerId, sourceEventId: id, summary: sources[locale][index], memoryType: 'EVENT', topics: index ? [topic] : [],
        updatedAt: new Date('2026-10-01'), embeddingInputRevision: 1, importanceScore: null, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null } };
  });
  const evidence = events.map(event => ({ ownerId, sourceEventId: event.id, sourceMemoryId: event.memory.id, summary: event.memory.summary,
    topics: event.memory.topics, eventDate: event.occurredAt, importanceScore: null, provenance: { sourceEventId: event.id, sourceMemoryId: event.memory.id } }));
  return { reportType: type, ownerId, locale, period, aggregates: { ...period, ownerId, year: 2026, month: 9, eventCount: events.length, topTopics: [] },
    sourceFence: { evidencePolicy: type === 'WEEKLY' ? 'weekly-localized-v1' : MONTHLY_EVIDENCE_POLICY,
      consentUpdatedAt: new Date('2000-01-01'), preferredLocale: locale, sources: reportSourceSnapshot(events) },
    evidenceSelection: type === 'WEEKLY' ? { ownerId, status: 'READY', evidence }
      : selectMonthlyEvidence({ identity, period, events, previousEvents: [], limits: REPORT_EVIDENCE_LIMITS.MONTHLY }) };
}
function substitute(pattern, prop) { return pattern.replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(prop[key])); }
// Authored mock responses, not live Claude output. Production code never calls
// this helper. The server accepts these exact strings without rewriting them.
export function nativeMockResponse(packet, variation = 0) {
  const { grammar, propositions } = packet;
  const refs = [...new Set(propositions.filter(prop => prop.kind === 'QUOTE').flatMap(prop => prop.refs))];
  function clause(prop, variant = variation) { return { propositionId: prop.id,
    text: substitute(grammar[prop.kind][variant % grammar[prop.kind].length], prop) }; }
  const first = propositions.find(prop => prop.kind === 'SELF_REPORT' && prop.refs.includes(refs[0]));
  const firstQuotes = propositions.filter(prop => prop.kind === 'QUOTE' && prop.refs.includes(refs[0]));
  const overview = first ? [clause(first), ...(firstQuotes[1] ? [clause(firstQuotes[1], 1)] : [])] : firstQuotes.map((prop, i) => clause(prop, i));
  const remaining = refs.slice(1).map(ref => propositions.filter(prop => prop.kind === 'QUOTE' && prop.refs.includes(ref)));
  const observations = packet.reportType === 'WEEKLY' ? [remaining.flatMap(group => group.slice(0, 1)).map((prop, i) => clause(prop, i + 2))]
    : [remaining.slice(0, 2).map((group, i) => clause(group[0], i + 2)), remaining.slice(2).flatMap(group => group).map(prop => clause(prop, 1))];
  const theme = propositions.find(prop => prop.kind === 'CROSS_WEEK_THEME');
  if (theme && observations[observations.length - 1].length < 3) observations[observations.length - 1].push(clause(theme));
  const reflection = grammar.conditions[variation % grammar.conditions.length] + grammar.invitations[variation % grammar.invitations.length] + grammar.endings[1];
  return { version: NATIVE_REFLECTION_VERSION, reportType: packet.reportType, locale: packet.locale, blocks: [
    { role: 'OVERVIEW', clauses: overview }, ...observations.filter(group => group.length).map(clauses => ({ role: 'OBSERVATION', clauses })),
    { role: 'CLOSING', clauses: [{ propositionId: 'R', text: reflection }] }
  ] };
}
export function nativeExamplesMarkdown() {
  return '# Validated native v2 examples\n\nThese are manually authored mocked provider responses, validated and assembled by the executable v2 path. No real Claude inference or translation occurred. They demonstrate permitted forms, not measured Claude quality. Original source language remains unchanged.\n\n' +
    ['WEEKLY', 'MONTHLY'].flatMap(type => locales.map((locale, i) => {
      const input = nativeFixture(type, locale), packet = buildNativeReflectionPackage(input).publicPacket, output = nativeMockResponse(packet, i);
      const result = validateNativeReflection(output, input);
      return `## ${type} / ${locale}\n\n${result.narrative}\n\nLength: ${nativeTextLength(result.narrative)} grapheme clusters, excluding layout whitespace.\n`;
    })).join('\n');
}
