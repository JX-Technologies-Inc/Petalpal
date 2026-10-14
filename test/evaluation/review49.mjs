// Fresh review corpus and independent mock author: no development fixture imports,
// inference, translation, repair attempts or changes to the eligible grammar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { monthlyPeriodFor, weeklyPeriodForLocalDate } from '../../lib/ai-periods.js';
import { reportSourceSnapshot } from '../../lib/report-write-fence.js';
import { selectMonthlyEvidence, MONTHLY_EVIDENCE_POLICY } from '../../lib/monthly-evidence.js';
import { REPORT_EVIDENCE_LIMITS } from '../../lib/report-foundation.js';
import { buildWeeklyReflectionPacket, validateWeeklyReflection } from '../../lib/sonnet-weekly.js';
import { buildMonthlyReflectionPacket, validateMonthlyReflection } from '../../lib/opus-monthly.js';
import { buildNativeReflectionPackage, validateNativeReflection, nativeTextLength } from '../../lib/native-reflection.js';
import { buildCompositionPackage, validateComposition } from '../../lib/native-composition.js';
import { parseRecordedConstruction } from '../../lib/reflection-source-language.js';
export const corpus = JSON.parse(readFileSync(new URL('./review49-everyday.json', import.meta.url)));
export function reviewInput(scenario, type, locale) {
  const ownerId = 'review49-synthetic-owner', identity = { userId: ownerId };
  const period = type === 'WEEKLY' ? weeklyPeriodForLocalDate('2026-09-14', 'UTC') : monthlyPeriodFor({ year: 2026, month: 9, timezone: 'UTC' });
  const days = type === 'WEEKLY' ? [15, 18] : [2, 9, 16, 27];
  const events = days.map((day, i) => ({ id: `review49-${i}`, ownerId, occurredAt: new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`),
    updatedAt: new Date('2026-10-01'), memoryProcessingAllowed: true,
    memory: { id: `review49-memory-${i}`, ownerId, sourceEventId: `review49-${i}`, summary: scenario.sources[i], memoryType: 'EVENT', topics: [],
      updatedAt: new Date('2026-10-01'), embeddingInputRevision: 1, importanceScore: null, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null } }));
  const evidence = events.map(e => ({ ownerId, sourceEventId: e.id, sourceMemoryId: e.memory.id, summary: e.memory.summary, topics: [], eventDate: e.occurredAt,
    importanceScore: null, provenance: { sourceEventId: e.id, sourceMemoryId: e.memory.id } }));
  return { reportType: type, ownerId, locale, period, aggregates: { ...period, ownerId, year: 2026, month: 9, eventCount: events.length, topTopics: [] },
    sourceFence: { evidencePolicy: type === 'MONTHLY' ? MONTHLY_EVIDENCE_POLICY : 'weekly-localized-v1',
      consentUpdatedAt: new Date('2000-01-01'), preferredLocale: locale, sources: reportSourceSnapshot(events) },
    evidenceSelection: type === 'WEEKLY' ? { ownerId, status: 'READY', evidence }
      : selectMonthlyEvidence({ identity, period, events, previousEvents: [], limits: REPORT_EVIDENCE_LIMITS.MONTHLY }) };
}
const substitute = (form, prop) => form.replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(prop[key]));
function authoredV2(packet) {
  const aliases = [...new Set(packet.propositions.filter(p => p.kind === 'QUOTE').flatMap(p => p.refs))];
  const clauses = aliases.map((alias, i) => {
    const prop = packet.propositions.find(p => p.refs.includes(alias) && ['SELF_REPORT', 'ACTIVITY_REPORT'].includes(p.kind))
      || packet.propositions.find(p => p.kind === 'QUOTE' && p.refs.includes(alias));
    const forms = packet.grammar[prop.kind];
    return { propositionId: prop.id, text: substitute(forms[i % forms.length], prop) };
  });
  return { version: packet.version, reportType: packet.reportType, locale: packet.locale, blocks: [
    { role: 'OVERVIEW', clauses: clauses.slice(0, 1) }, { role: 'OBSERVATION', clauses: clauses.slice(1) },
    { role: 'CLOSING', clauses: [{ propositionId: 'R', text: packet.grammar.conditions[0] + packet.grammar.invitations[1] + packet.grammar.endings[0] }] }
  ] };
}
export function authoredComposition(packet) {
  const facts = packet.propositions.filter(p => ['RECORDED_EPISODE', 'EXACT_RECORD'].includes(p.kind)), g = packet.grammar;
  const groups = [facts.slice(0, 1), facts.slice(1)];
  return { version: packet.version, reportType: packet.reportType, locale: packet.locale,
    paragraphs: groups.map((group, i) => ({ role: i ? 'OBSERVATION' : 'OVERVIEW', refs: group.map(p => p.id),
      text: group.map(p => p.kind === 'EXACT_RECORD' ? g.quoteStart + p.quote + g.quoteEnd : g.openings[i % 2] + p.fragments[0] + g.end).join(g.gap) })) };
}
function evaluateOne(input, version) {
  let stage = 'preflight';
  try {
    let output, validate, packet;
    if (version === 'v1' && input.reportType === 'WEEKLY') {
      packet = buildWeeklyReflectionPacket(input);
      output = { version: packet.version, locale: packet.locale, moments: packet.evidence.filter(e => e.sentences.length).slice(0, 2).map(e => ({ ref: e.ref, quote: e.sentences[0] })), insights: [] };
      validate = validateWeeklyReflection;
    } else if (version === 'v1') {
      packet = buildMonthlyReflectionPacket(input); const fact = packet.facts.find(f => f.kind !== 'OVERVIEW');
      output = { version: packet.version, locale: packet.locale, overview: 'O1', insights: [{ kind: fact.kind, factId: fact.id }], closing: { factId: fact.id, style: 'OPEN' } };
      validate = validateMonthlyReflection;
    } else if (version === 'v2') {
      packet = buildNativeReflectionPackage(input).publicPacket; output = authoredV2(packet); validate = validateNativeReflection;
    } else {
      packet = buildCompositionPackage(input).publicPacket; output = authoredComposition(packet); validate = validateComposition;
    }
    stage = 'output-validation';
    const result = validate(output, input);
    return { status: 'accepted', narrative: result.narrative, length: nativeTextLength(result.narrative),
      referencedEvents: new Set(result.sections.flatMap(s => s.evidenceRefs.map(r => r.sourceEventId))).size };
  } catch (error) { return { status: 'abstained', stage, code: error.code || error.name }; }
}
export function evaluateReview49() {
  const rows = corpus.flatMap(scenario => ['WEEKLY', 'MONTHLY'].flatMap(type => ['en', 'zh-Hans', 'zh-Hant'].map(locale => {
    const input = reviewInput(scenario, type, locale), snapshot = JSON.stringify(input);
    const versions = Object.fromEntries(['v1', 'v2', 'v2.1'].map(version => [version, evaluateOne(input, version)]));
    if (JSON.stringify(input) !== snapshot) throw new Error('Evaluation mutated source evidence');
    return { domain: scenario.domain, type, locale, versions };
  })));
  return { nativeSourceEligibility: { accepted: corpus.flatMap(s => s.sources).filter(s => parseRecordedConstruction(s)).length, total: corpus.length * 4 },
    counts: Object.fromEntries(['v1', 'v2', 'v2.1'].map(version => [version, {
      accepted: rows.filter(r => r.versions[version].status === 'accepted').length,
      preflightAbstained: rows.filter(r => r.versions[version].stage === 'preflight').length,
      outputRejected: rows.filter(r => r.versions[version].stage === 'output-validation').length
    }])), rows };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(evaluateReview49(), null, 2));
