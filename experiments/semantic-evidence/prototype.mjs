// Offline research only. No production imports, provider, parser, persistence or
// implicit semantic trust. Fixture assumptions NEVER become independent proof.
import { isDeepStrictEqual as equal } from 'node:util';

const LOCALES = ['en', 'zh-Hans', 'zh-Hant'];
const ASSUMPTION = 'developer-authored-assumption';
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const check = (condition, code) => { if (!condition) fail(code); };
const unique = xs => [...new Set(xs)];
function shape(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) &&
    equal(Object.keys(value).sort(), [...keys].sort()), 'INVALID_SHAPE');
}
const str = x => typeof x === 'string' && x.length > 0 && x.length <= 4000;
// Bounded canonical UTC timestamps make lexical order identical to time order;
// expanded/signed ISO years cannot silently reverse comparisons.
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) &&
  Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
function jsonCopy(value) {
  // This interface takes bounded JSON, not arbitrary executable JS objects.
  const encoded = JSON.stringify(value);
  check(typeof encoded === 'string' && encoded.length <= 250000, 'INPUT_BOUND');
  return JSON.parse(encoded);
}
function attempt(fn) {
  try { return fn(); } catch (e) {
    return { status: 'REJECTED', reason: e.code || 'INVALID_INPUT', productionEligible: false };
  }
}
function spanValid(span, source) {
  shape(span, ['field', 'start', 'end', 'text']);
  check(['text', 'memoryText'].includes(span.field) && Number.isInteger(span.start) &&
    Number.isInteger(span.end) && span.start >= 0 && span.end > span.start &&
    span.end <= source[span.field].length && source[span.field].slice(span.start, span.end) === span.text,
  'SPAN_MISMATCH');
  // UTF-16 offsets are explicit; do not accept half a surrogate pair.
  const boundary = n => !(n > 0 && n < source[span.field].length &&
    /[\uD800-\uDBFF]/.test(source[span.field][n - 1]) && /[\uDC00-\uDFFF]/.test(source[span.field][n]));
  check(boundary(span.start) && boundary(span.end), 'SPAN_BOUNDARY');
}
function atomValid(a) {
  shape(a, ['kind', 'actor', 'predicate', 'object', 'polarity', 'modality', 'intensity', 'quantity', 'time', 'qualifiers']);
  check(['recorded-fact', 'self-reported-emotion'].includes(a.kind) && str(a.actor) && str(a.predicate) &&
    (a.object === null || str(a.object)) && ['positive', 'negative'].includes(a.polarity) &&
    ['actual', 'planned', 'wanted', 'possible'].includes(a.modality) &&
    (a.intensity === null || str(a.intensity)) && Array.isArray(a.qualifiers) && a.qualifiers.length <= 8 &&
    a.qualifiers.every(str) && unique(a.qualifiers).length === a.qualifiers.length, 'INVALID_ATOM');
  if (a.quantity !== null) {
    shape(a.quantity, ['value', 'unit']);
    check(Number.isFinite(a.quantity.value) && a.quantity.value >= 0 && str(a.quantity.unit), 'INVALID_QUANTITY');
  }
  if (a.time.kind === 'unknown') shape(a.time, ['kind']);
  else {
    shape(a.time, ['kind', 'start', 'end', 'scope']);
    check(a.time.kind === 'explicit' && date(a.time.start) && date(a.time.end) &&
      a.time.start <= a.time.end && ['activity', 'planning', 'feeling'].includes(a.time.scope), 'INVALID_TIME');
  }
}

/**
 * Server-side analogue over synthetic source snapshots. `annotations` and
 * `realizations` are a separate fixture input, never supplied by a candidate.
 * Their source→meaning and meaning→text judgements are ASSUMPTIONS, visibly
 * retained in every successful semantic result. Exact spans alone prove neither.
 */
export function createExperiment(input) {
  const { request, sources, annotations, realizations } = jsonCopy(input);
  shape(input, ['request', 'sources', 'annotations', 'realizations']);
  shape(request, ['dataset', 'ownerId', 'consentEpoch', 'locale', 'reportType', 'start', 'end', 'requiredEventIds']);
  check(request.dataset === 'synthetic' && id(request.ownerId) && Number.isInteger(request.consentEpoch) &&
    request.consentEpoch > 0 && LOCALES.includes(request.locale) && ['WEEKLY', 'MONTHLY'].includes(request.reportType) &&
    date(request.start) && date(request.end) && request.start < request.end &&
    Array.isArray(request.requiredEventIds) && request.requiredEventIds.length >= 1 &&
    request.requiredEventIds.every(id) && unique(request.requiredEventIds).length === request.requiredEventIds.length,
  'INVALID_REQUEST');
  check(Array.isArray(sources) && sources.length >= 1 && sources.length <= 32, 'SOURCE_BOUND');
  for (const s of sources) {
    shape(s, ['kind', 'ownerId', 'eventId', 'memoryId', 'revision', 'memoryRevision', 'recordedAt',
      'updatedAt', 'memoryUpdatedAt', 'sourceLanguage', 'text', 'memoryText', 'consentEpoch', 'allowed']);
    check(s.kind === 'EVENT' && s.ownerId === request.ownerId && s.allowed === true &&
      s.consentEpoch === request.consentEpoch && id(s.eventId) && id(s.memoryId) &&
      Number.isInteger(s.revision) && s.revision >= 1 && s.memoryRevision === s.revision &&
      date(s.recordedAt) && date(s.updatedAt) && date(s.memoryUpdatedAt) &&
      s.recordedAt >= request.start && s.recordedAt < request.end && s.updatedAt >= s.recordedAt &&
      s.memoryUpdatedAt >= s.updatedAt && str(s.text) && str(s.memoryText) &&
      [...LOCALES, 'mixed', 'unknown'].includes(s.sourceLanguage), 'SOURCE_NOT_AUTHORIZED');
  }
  check(unique(sources.map(s => s.eventId)).length === sources.length &&
    unique(sources.map(s => s.memoryId)).length === sources.length, 'DUPLICATE_SOURCE');
  check(request.requiredEventIds.every(x => sources.some(s => s.eventId === x)), 'MISSING_REQUIRED_SOURCE');
  const bySource = new Map(sources.map(s => [s.eventId, s]));
  check(Array.isArray(annotations) && annotations.length <= 96 && Array.isArray(realizations) && realizations.length <= 32,
    'REGISTRY_BOUND');
  const byAnnotation = new Map();
  for (const a of annotations) {
    shape(a, ['id', 'origin', 'source', 'spans', 'meaning']);
    check(id(a.id) && !byAnnotation.has(a.id) && a.origin === ASSUMPTION, 'UNTRUSTED_ANNOTATION');
    const s = bySource.get(a.source.eventId);
    // Bind the ENTIRE source snapshot, including context outside the aligned span.
    check(s && equal(s, a.source), 'STALE_ANNOTATION');
    check(Array.isArray(a.spans) && a.spans.length >= 1 && a.spans.length <= 8, 'SPAN_BOUND');
    for (const span of a.spans) spanValid(span, s);
    if (a.meaning.kind === 'relation') {
      shape(a.meaning, ['kind', 'relation', 'from', 'to']);
      check(['explicit-contrast', 'reported-cause', 'explicit-order'].includes(a.meaning.relation) &&
        id(a.meaning.from) && id(a.meaning.to) && a.meaning.from !== a.meaning.to, 'INVALID_RELATION');
    } else atomValid(a.meaning);
    byAnnotation.set(a.id, a);
  }
  for (const a of annotations.filter(a => a.meaning.kind === 'relation')) {
    const ends = [a.meaning.from, a.meaning.to].map(x => byAnnotation.get(x));
    check(ends.every(x => x && x.meaning.kind !== 'relation' && x.source.eventId === a.source.eventId),
      'RELATION_SCOPE');
  }
  for (const r of realizations) {
    shape(r, ['id', 'origin', 'locale', 'reportType', 'plan', 'text']);
    check(id(r.id) && r.origin === ASSUMPTION && LOCALES.includes(r.locale) &&
      ['WEEKLY', 'MONTHLY'].includes(r.reportType) && str(r.text), 'UNTRUSTED_REALIZATION');
  }
  check(unique(realizations.map(r => r.id)).length === realizations.length, 'DUPLICATE_REALIZATION');

  function prove(plan) {
    let nodes = 0;
    function visit(n, depth = 0) {
      check(++nodes <= 128 && depth <= 12, 'PLAN_BOUND');
      check(n && typeof n === 'object', 'INVALID_PLAN');
      if (n.op === 'atom') {
        shape(n, ['op', 'annotationId', 'meaning']);
        const a = byAnnotation.get(n.annotationId);
        check(a && a.meaning.kind !== 'relation' && equal(a.meaning, n.meaning), 'ATOM_NOT_ESTABLISHED');
        return { sources: [a.source.eventId], assumptions: [a.id], atoms: [a], rules: ['exact-annotated-atom'] };
      }
      if (n.op === 'and') {
        shape(n, ['op', 'args']);
        check(Array.isArray(n.args) && n.args.length >= 2 && n.args.length <= 8, 'CONJUNCTION_BOUND');
        const xs = n.args.map(x => visit(x, depth + 1));
        return combine(xs, 'neutral-conjunction');
      }
      if (n.op === 'relation') {
        shape(n, ['op', 'annotationId', 'left', 'right']);
        const a = byAnnotation.get(n.annotationId);
        check(a?.meaning.kind === 'relation' && n.left?.op === 'atom' && n.right?.op === 'atom' &&
          a.meaning.from === n.left.annotationId && a.meaning.to === n.right.annotationId, 'RELATION_NOT_ESTABLISHED');
        const result = combine([visit(n.left, depth + 1), visit(n.right, depth + 1)], a.meaning.relation);
        result.assumptions.push(a.id);
        return result;
      }
      if (n.op === 'recorded-before' || n.op === 'occurred-before') {
        shape(n, ['op', 'left', 'right']);
        check(n.left?.op === 'atom' && n.right?.op === 'atom', 'ORDER_SCOPE');
        const left = visit(n.left, depth + 1), right = visit(n.right, depth + 1);
        const a = left.atoms[0], b = right.atoms[0];
        if (n.op === 'recorded-before') {
          check(a.source.eventId !== b.source.eventId && a.source.recordedAt < b.source.recordedAt, 'RECORD_ORDER');
        } else {
          check(a.meaning.kind === 'recorded-fact' && b.meaning.kind === 'recorded-fact' &&
            a.meaning.modality === 'actual' && b.meaning.modality === 'actual' &&
            a.meaning.polarity === 'positive' && b.meaning.polarity === 'positive' &&
            a.meaning.time.kind === 'explicit' && b.meaning.time.kind === 'explicit' &&
            a.meaning.time.scope === 'activity' && b.meaning.time.scope === 'activity' &&
            a.meaning.time.end < b.meaning.time.start, 'ACTIVITY_ORDER_NOT_ESTABLISHED');
        }
        return combine([left, right], n.op);
      }
      if (n.op === 'recurs') {
        shape(n, ['op', 'args', 'subject', 'scope']);
        shape(n.subject, ['actor', 'predicate', 'object']);
        check(n.scope === 'selected-records' && Array.isArray(n.args) && n.args.length >= 2 && n.args.length <= 8 &&
          n.args.every(x => x.op === 'atom'), 'RECURRENCE_SCOPE');
        const result = combine(n.args.map(x => visit(x, depth + 1)), 'distinct-recorded-subject');
        check(unique(result.sources).length === n.args.length && result.atoms.every(({ meaning: a }) =>
          a.kind === 'recorded-fact' && a.modality === 'actual' && a.polarity === 'positive' &&
          equal({ actor: a.actor, predicate: a.predicate, object: a.object }, n.subject)), 'RECURRENCE_NOT_ESTABLISHED');
        return result;
      }
      // A question/free-prose label cannot hide presuppositions from validation.
      fail('UNSUPPORTED_OPERATOR');
    }
    const result = visit(plan);
    check(request.requiredEventIds.every(x => result.sources.includes(x)), 'SOURCE_COVERAGE');
    return result;
  }
  function combine(xs, rule) {
    return { sources: unique(xs.flatMap(x => x.sources)), assumptions: unique(xs.flatMap(x => x.assumptions)),
      atoms: xs.flatMap(x => x.atoms), rules: unique([...xs.flatMap(x => x.rules), rule]) };
  }
  function evaluatePlan(plan) {
    return attempt(() => {
      const p = jsonCopy(plan), proof = prove(p);
      return { status: 'CONDITIONAL_SEMANTIC_PLAN', productionEligible: false,
        sources: proof.sources, assumptions: proof.assumptions, rules: proof.rules,
        limitation: 'Source-to-meaning fixture judgements are not independently verified.' };
    });
  }
  function evaluateText(candidate) {
    return attempt(() => {
      const c = jsonCopy(candidate);
      shape(c, ['locale', 'reportType', 'plan', 'text']);
      check(c.locale === request.locale && c.reportType === request.reportType && str(c.text), 'OUTPUT_CONTRACT');
      const proof = prove(c.plan);
      const r = realizations.find(r => r.locale === c.locale && r.reportType === c.reportType &&
        r.text === c.text && equal(r.plan, c.plan));
      if (!r) return { status: 'UNVERIFIED_FREE_TEXT', reason: 'NO_INDEPENDENT_TEXT_ALIGNMENT',
        semanticPlan: 'CONDITIONAL_SEMANTIC_PLAN', productionEligible: false };
      return { status: 'CONDITIONAL_FIXTURE_TEXT', productionEligible: false,
        assumptions: [...proof.assumptions, r.id],
        limitation: 'Exact fixture realization match; same-task authorship is not independent semantic proof.' };
    });
  }
  function quote(eventId) {
    return attempt(() => {
      const source = bySource.get(eventId);
      check(source, 'UNKNOWN_SOURCE');
      // Structured data only: a future UI MUST use inert textContent, never HTML
      // or executable Markdown. Whole source avoids qualifier/speaker clipping.
      return { status: 'EXACT_ATTRIBUTED_SOURCE', productionEligible: false,
        claim: 'The synthetic Event snapshot contains this exact text.',
        source: jsonCopy(source), text: source.text, outputLocale: request.locale,
        languagePreserved: true, externalWorldTruth: 'NOT_ESTABLISHED' };
    });
  }
  // Mutation of supplied objects cannot promote fixture claims or alter proof.
  return Object.freeze({ evaluatePlan, evaluateText, quote });
}
