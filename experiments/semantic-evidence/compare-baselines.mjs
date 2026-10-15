// Same-task synthetic comparison. This file never imports a provider runner,
// invokes a provider, writes reports, or edits the reference checkout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createExperiment } from './prototype.mjs';

export const referenceCommit = '09f6aee0584c386c99523e81657413efab32f1af';
export const corpus = JSON.parse(readFileSync(new URL('./fresh-corpus.json', import.meta.url)));
const locales = ['en', 'zh-Hans', 'zh-Hant'];
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
export const graphemes = text => [...segmenter.segment(text.replace(/\s/gu, ''))].length;
// Independently authored fixture fields happen to be equal. Production
// occurredAt is NOT a recording timestamp and must never be relabeled as one.
const timelines = {
  WEEKLY: [
    { occurredAt: '2026-09-15T12:00:00.000Z', recordedAt: '2026-09-15T12:00:00.000Z' },
    { occurredAt: '2026-09-18T12:00:00.000Z', recordedAt: '2026-09-18T12:00:00.000Z' }
  ],
  MONTHLY: [
    { occurredAt: '2026-09-02T12:00:00.000Z', recordedAt: '2026-09-02T12:00:00.000Z' },
    { occurredAt: '2026-09-09T12:00:00.000Z', recordedAt: '2026-09-09T12:00:00.000Z' },
    { occurredAt: '2026-09-16T12:00:00.000Z', recordedAt: '2026-09-16T12:00:00.000Z' },
    { occurredAt: '2026-09-27T12:00:00.000Z', recordedAt: '2026-09-27T12:00:00.000Z' }
  ]
};

async function referenceModules(directory) {
  // Some transitive reference imports initialize Prisma configuration. Use only
  // an explicit synthetic non-listening endpoint and suppress dotenv loading.
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
  assert.equal(process.env.DEV_DATABASE_URL, 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test');
  assert.equal(execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), referenceCommit);
  assert.equal(execFileSync('git', ['-C', directory, 'status', '--porcelain', '--', 'lib', 'package.json', 'package-lock.json'],
    { encoding: 'utf8' }).trim(), '', 'Reference implementation or dependency declarations differ from pinned commit');
  globalThis.fetch = async () => { throw new Error('Network disabled for synthetic comparison'); };
  const names = ['ai-periods', 'report-write-fence', 'monthly-evidence', 'report-foundation',
    'sonnet-weekly', 'opus-monthly', 'native-reflection', 'native-composition', 'reflection-source-language'];
  const modules = await Promise.all(names.map(name => import(pathToFileURL(resolve(directory, 'lib', `${name}.js`)))));
  return Object.assign({}, ...modules);
}

export function sourceInput(scenario, type, locale, lib) {
  const ownerId = 'semantic-synthetic-owner';
  const period = type === 'WEEKLY' ? lib.weeklyPeriodForLocalDate('2026-09-14', 'UTC')
    : lib.monthlyPeriodFor({ year: 2026, month: 9, timezone: 'UTC' });
  const events = timelines[type].map((timeline, i) => ({
    id: `${scenario.id}-${i + 1}`, ownerId, occurredAt: new Date(timeline.occurredAt),
    updatedAt: new Date('2026-10-01T00:00:00Z'), memoryProcessingAllowed: true,
    memory: { id: `${scenario.id}-memory-${i + 1}`, ownerId, sourceEventId: `${scenario.id}-${i + 1}`,
      summary: scenario.sources[i], memoryType: 'EVENT', topics: [], updatedAt: new Date('2026-10-01T00:00:00Z'),
      embeddingInputRevision: 1, importanceScore: null, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null }
  }));
  const evidence = events.map(e => ({ ownerId, sourceEventId: e.id, sourceMemoryId: e.memory.id,
    summary: e.memory.summary, topics: [], eventDate: e.occurredAt, importanceScore: null,
    provenance: { sourceEventId: e.id, sourceMemoryId: e.memory.id } }));
  return {
    reportType: type, ownerId, locale, period,
    aggregates: { ...period, ownerId, year: 2026, month: 9, eventCount: events.length, topTopics: [] },
    sourceFence: { evidencePolicy: type === 'MONTHLY' ? lib.MONTHLY_EVIDENCE_POLICY : 'weekly-localized-v1',
      consentUpdatedAt: new Date('2000-01-01T00:00:00Z'), preferredLocale: locale, sources: lib.reportSourceSnapshot(events) },
    evidenceSelection: type === 'WEEKLY' ? { ownerId, status: 'READY', evidence }
      : lib.selectMonthlyEvidence({ identity: { userId: ownerId }, period, events, previousEvents: [], limits: lib.REPORT_EVIDENCE_LIMITS.MONTHLY })
  };
}

const substitute = (form, prop) => form.replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(prop[key]));
function candidateV2(packet) {
  const aliases = [...new Set(packet.propositions.filter(p => p.kind === 'QUOTE').flatMap(p => p.refs))];
  const clauses = aliases.map((alias, i) => {
    const prop = packet.propositions.find(p => p.refs.includes(alias) && ['SELF_REPORT', 'ACTIVITY_REPORT'].includes(p.kind))
      || packet.propositions.find(p => p.kind === 'QUOTE' && p.refs.includes(alias));
    return { propositionId: prop.id, text: substitute(packet.grammar[prop.kind][i % packet.grammar[prop.kind].length], prop) };
  });
  return { version: packet.version, reportType: packet.reportType, locale: packet.locale, blocks: [
    { role: 'OVERVIEW', clauses: clauses.slice(0, 1) }, { role: 'OBSERVATION', clauses: clauses.slice(1) }
  ] };
}
function candidateV21(packet) {
  const facts = packet.propositions.filter(p => ['RECORDED_EPISODE', 'EXACT_RECORD'].includes(p.kind));
  const g = packet.grammar;
  return { version: packet.version, reportType: packet.reportType, locale: packet.locale,
    paragraphs: [facts.slice(0, 1), facts.slice(1)].map((group, i) => ({
      role: i ? 'OBSERVATION' : 'OVERVIEW', refs: group.map(p => p.id),
      text: group.map(p => p.kind === 'EXACT_RECORD' ? g.quoteStart + p.quote + g.quoteEnd
        : g.openings[i % 2] + p.fragments[0] + g.end).join(g.gap)
    })) };
}
function evaluateBaseline(input, version, lib) {
  let stage = 'preflight';
  try {
    let packet, candidate, validate;
    if (version === 'v1' && input.reportType === 'WEEKLY') {
      packet = lib.buildWeeklyReflectionPacket(input);
      candidate = { version: packet.version, locale: packet.locale,
        moments: packet.evidence.filter(e => e.sentences.length).slice(0, 2).map(e => ({ ref: e.ref, quote: e.sentences[0] })), insights: [] };
      validate = lib.validateWeeklyReflection;
    } else if (version === 'v1') {
      packet = lib.buildMonthlyReflectionPacket(input);
      const fact = packet.facts.find(f => f.kind !== 'OVERVIEW');
      candidate = { version: packet.version, locale: packet.locale, overview: 'O1',
        insights: [{ kind: fact.kind, factId: fact.id }], closing: { factId: fact.id, style: 'OPEN' } };
      validate = lib.validateMonthlyReflection;
    } else if (version === 'v2') {
      packet = lib.buildNativeReflectionPackage(input).publicPacket;
      candidate = candidateV2(packet); validate = lib.validateNativeReflection;
    } else {
      packet = lib.buildCompositionPackage(input).publicPacket;
      candidate = candidateV21(packet); validate = lib.validateComposition;
    }
    stage = 'output-validation';
    const result = validate(candidate, input);
    return { status: 'accepted-by-reference-validator', narrative: result.narrative, graphemes: graphemes(result.narrative),
      referencedEvents: new Set(result.sections.flatMap(s => s.evidenceRefs.map(r => r.sourceEventId))).size,
      independentUnsupportedClaimCount: null };
  } catch (error) {
    // Deliberately do not print reference exception messages or ambient config.
    return { status: 'abstained', stage, code: error.code || error.name };
  }
}

function evaluateProposed(input, recordedAtByEvent) {
  const sources = input.sourceFence.sources.map(s => ({ kind: 'EVENT', ownerId: input.ownerId,
    eventId: s.id, memoryId: s.memory.id, revision: 1, memoryRevision: 1,
    recordedAt: recordedAtByEvent[s.id], updatedAt: new Date(s.updatedAt).toISOString(),
    memoryUpdatedAt: new Date(s.memory.updatedAt).toISOString(), sourceLanguage: 'unknown',
    text: s.memory.summary, memoryText: s.memory.summary, consentEpoch: 1, allowed: true }));
  const experiment = createExperiment({ request: { dataset: 'synthetic', ownerId: input.ownerId,
    consentEpoch: 1, locale: input.locale, reportType: input.reportType,
    start: new Date(input.period.periodStartUtc).toISOString(), end: new Date(input.period.periodEndUtc).toISOString(),
    requiredEventIds: sources.map(s => s.eventId) }, sources, annotations: [], realizations: [] });
  // This source-copy probe is not a generated reflection or a semantic gold label.
  // It exercises the absence of an independently established semantic registry.
  // Even a source-copy string cannot become certified native prose via citations.
  const probe = { locale: input.locale, reportType: input.reportType,
    plan: { op: 'atom', annotationId: 'unestablished-source-meaning', meaning: {
      kind: 'recorded-fact', actor: 'user', predicate: 'unestablished', object: null,
      polarity: 'positive', modality: 'actual', intensity: null, quantity: null,
      time: { kind: 'unknown' }, qualifiers: []
    } }, text: sources[0].text };
  const result = experiment.evaluateText(probe);
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.reason, 'ATOM_NOT_ESTABLISHED');
  const quoteArtifact = sources.map(source => {
    const quote = experiment.quote(source.eventId);
    assert.equal(quote.status, 'EXACT_ATTRIBUTED_SOURCE');
    assert.equal(quote.text, source.text);
    assert.deepEqual(quote.source, source);
    assert.equal(quote.externalWorldTruth, 'NOT_ESTABLISHED');
    return { eventId: source.eventId, kind: quote.status, text: quote.text };
  });
  return { status: 'native-prose-abstained', code: result.reason, certifiedNativeProse: false,
    productionEligible: result.productionEligible, quoteArtifact };
}

export async function compare(directory) {
  const lib = await referenceModules(directory);
  const rows = corpus.scenarios.flatMap(scenario => ['WEEKLY', 'MONTHLY'].flatMap(type => locales.map(locale => {
    const input = sourceInput(scenario, type, locale, lib), before = JSON.stringify(input);
    const sources = scenario.sources.slice(0, type === 'WEEKLY' ? 2 : 4);
    assert.deepEqual(input.sourceFence.sources.map(s => s.memory.summary), sources);
    const recordedAtByEvent = Object.fromEntries(timelines[type].map((t, i) => [`${scenario.id}-${i + 1}`, t.recordedAt]));
    assert.deepEqual(input.sourceFence.sources.map(s => new Date(s.occurredAt).toISOString()), timelines[type].map(t => t.occurredAt));
    const versions = Object.fromEntries(['v1', 'v2', 'v2.1'].map(version => [version, evaluateBaseline(input, version, lib)]));
    const proposed = evaluateProposed(input, recordedAtByEvent);
    assert.equal(JSON.stringify(input), before, 'Reference comparator mutated source input');
    assert.deepEqual(proposed.quoteArtifact.map(q => q.text), sources);
    return { scenario: scenario.id, type, locale, sources, versions, proposed };
  })));
  return {
    origin: corpus.origin, referenceCommit,
    method: 'Single deterministic author per baseline; no sampled model output, repair, retry, blind judgment, or provider call. Proposed native lane has no independent semantic registry and therefore certifies no prose.',
    metrics: { independentUnsupportedClaimCount: null, naturalnessScore: null, warmthScore: null,
      note: 'Not measured independently. Passing the reference validator is not an independent semantic audit.' },
    sources: { count: corpus.scenarios.reduce((n, s) => n + s.sources.length, 0),
      v21Parsed: corpus.scenarios.flatMap(s => s.sources).filter(s => lib.parseRecordedConstruction(s)).length },
    counts: Object.fromEntries(['v1', 'v2', 'v2.1'].map(version => [version, {
      accepted: rows.filter(r => r.versions[version].status === 'accepted-by-reference-validator').length,
      preflightAbstained: rows.filter(r => r.versions[version].stage === 'preflight').length,
      outputRejected: rows.filter(r => r.versions[version].stage === 'output-validation').length
    }])),
    proposedCounts: { certifiedNativeProse: rows.filter(r => r.proposed.certifiedNativeProse).length,
      nativeAbstained: rows.filter(r => r.proposed.status === 'native-prose-abstained').length,
      exactSourceArtifacts: rows.filter(r => r.proposed.quoteArtifact.length === r.sources.length).length,
      note: 'Quotation artifacts are not native reports; conditional fixture composition is tested separately.' }, rows
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--reference');
  assert.ok(index >= 0 && process.argv[index + 1], 'Pass --reference with a read-only checkout of the pinned PR #49 commit');
  console.log(JSON.stringify(await compare(resolve(process.argv[index + 1])), null, 2));
}
