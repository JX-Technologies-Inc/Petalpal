// Read-only comparison against exact PR #49 source. Candidates are authored mocks, not Claude.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { scenarios, fixture } from './fixtures.mjs';
import { prepareExperiment, graphemes, TYPES, LOCALES } from './experiment.mjs';
export const referenceCommit = '09f6aee0584c386c99523e81657413efab32f1af';
async function referenceModules(directory) {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
  assert.equal(process.env.DEV_DATABASE_URL, 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test');
  assert.equal(execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), referenceCommit);
  assert.equal(execFileSync('git', ['-C', directory, 'status', '--porcelain', '--', 'lib', 'package.json', 'package-lock.json'], { encoding: 'utf8' }).trim(), '');
  globalThis.fetch = async () => { throw Error('Comparison network disabled'); };
  const names = ['ai-periods', 'report-write-fence', 'monthly-evidence', 'sonnet-weekly', 'opus-monthly', 'native-reflection', 'native-composition'];
  return Object.assign({}, ...await Promise.all(names.map(n => import(pathToFileURL(resolve(directory, 'lib', n + '.js'))))));
}
function baselineInput(input, lib) {
  const ownerId = input.ownerId, locale = input.preference.locale, reportType = input.reportType;
  const period = reportType === 'WEEKLY' ? lib.weeklyPeriodForLocalDate('2026-09-14', 'UTC') : lib.monthlyPeriodFor({ year: 2026, month: 9, timezone: 'UTC' });
  const events = input.events.map(e => ({ id: e.id, ownerId, occurredAt: new Date(e.eventDate), updatedAt: new Date(e.updatedAt), memoryProcessingAllowed: true,
    memory: { id: e.memoryId, ownerId, sourceEventId: e.id, summary: e.text, memoryType: 'EVENT', topics: [], updatedAt: new Date(e.memoryUpdatedAt),
      embeddingInputRevision: e.revision, importanceScore: null, embeddingStatus: 'NOT_REQUESTED', embeddedInputRevision: null } }));
  return { reportType, ownerId, locale, period,
    aggregates: { ...period, ownerId, year: 2026, month: 9, eventCount: events.length, topTopics: [] },
    sourceFence: { evidencePolicy: reportType === 'MONTHLY' ? lib.MONTHLY_EVIDENCE_POLICY : 'weekly-localized-v1',
      consentUpdatedAt: new Date('2000-01-01'), preferredLocale: locale, sources: lib.reportSourceSnapshot(events) },
    evidenceSelection: { ownerId, status: events.length ? 'READY' : 'INSUFFICIENT_EVIDENCE', evidence: events.map(e => ({ ownerId,
      sourceEventId: e.id, sourceMemoryId: e.memory.id, summary: e.memory.summary, topics: [], eventDate: e.occurredAt, importanceScore: null,
      provenance: { sourceEventId: e.id, sourceMemoryId: e.memory.id } })) } };
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


export async function compare(directory) {
  const lib = await referenceModules(directory);
  const rows = scenarios.flatMap(s => TYPES.flatMap(type => LOCALES.map(locale => {
    const input = fixture(s, type, locale), before = JSON.stringify(input), baseline = baselineInput(input, lib);
    const baselineBefore = JSON.stringify(baseline);
    const versions = Object.fromEntries(['v1', 'v2', 'v2.1'].map(v => [v, evaluateBaseline(baseline, v, lib)]));
    const proposed = prepareExperiment(input);
    assert.equal(JSON.stringify(input), before);
    assert.equal(JSON.stringify(baseline), baselineBefore);
    assert.deepEqual(JSON.parse(proposed.request.body.messages[0].content).evidence.map(e => e.text), baseline.evidenceSelection.evidence.map(e => e.summary));
    return { scenario: s.id, type, locale, sources: input.events.map(e => e.text), versions,
      promptFirst: { status: 'PREPARED_NOT_SENT', model: proposed.request.body.model, factualCorrectness: 'UNVERIFIED', writingQuality: 'NOT_MEASURED' } };
  })));
  return { referenceCommit, origin: 'SYNTHETIC_AUTHORED_CANDIDATES_NOT_CLAUDE',
    method: 'One deterministic authored candidate per baseline. Identical selected evidence across contracts/locales; no retrieval-rate or model-quality measurement.',
    counts: Object.fromEntries(['v1', 'v2', 'v2.1'].map(v => [v, {
      accepted: rows.filter(r => r.versions[v].status === 'accepted-by-reference-validator').length,
      preflightAbstained: rows.filter(r => r.versions[v].stage === 'preflight').length,
      outputRejected: rows.filter(r => r.versions[v].stage === 'output-validation').length }])), rows };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--reference');
  console.log(JSON.stringify(await compare(resolve(process.argv[3])), null, 2));
}
