// Synthetic developer-authored fixtures. These annotations and realizations
// are explicit assumptions, not independently validated semantic mappings.
const ORIGIN = 'developer-authored-assumption';
const copy = value => JSON.parse(JSON.stringify(value));
const explicit = (day, scope = 'activity') => ({ kind: 'explicit',
  start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z`, scope });
const unknown = () => ({ kind: 'unknown' });
const fact = overrides => ({ kind: 'recorded-fact', actor: 'synthetic-user', predicate: 'tested',
  object: 'cedar-cache patch', polarity: 'positive', modality: 'actual', intensity: null,
  quantity: null, time: unknown(), qualifiers: [], ...overrides });
const feeling = (object, intensity) => fact({ kind: 'self-reported-emotion', predicate: 'felt',
  object, intensity, time: unknown() });

export function makeFixture() {
  const request = { dataset: 'synthetic', ownerId: 'synthetic-user', consentEpoch: 3,
    locale: 'en', reportType: 'WEEKLY', start: '2026-10-05T00:00:00.000Z',
    end: '2026-10-12T00:00:00.000Z', requiredEventIds: ['event-alpha', 'event-beta'] };
  const texts = [
    'On 2026-10-02, I tested the cedar-cache patch on two staging devices. The reconnect timeout did not recur. I felt somewhat relieved because the reconnect timeout did not recur, but I still felt uneasy about the untested offline path. After testing the patch, I inspected the trace. I planned to test the offline path on Friday. 🌱',
    '2026年10月7日，我在一台测试设备上测试了 cedar-cache 补丁；没有提交到生产环境。我有点期待，也仍不确定。I wanted to ask Mira to review the offline path; I might run a longer check tomorrow.',
  ];
  const sources = texts.map((text, index) => ({ kind: 'EVENT', ownerId: request.ownerId,
    eventId: index ? 'event-beta' : 'event-alpha', memoryId: index ? 'memory-beta' : 'memory-alpha',
    revision: 2, memoryRevision: 2, recordedAt: index ? '2026-10-09T12:00:00.000Z' : '2026-10-05T12:00:00.000Z',
    updatedAt: index ? '2026-10-09T12:00:00.000Z' : '2026-10-05T12:00:00.000Z',
    memoryUpdatedAt: index ? '2026-10-09T12:00:00.000Z' : '2026-10-05T12:00:00.000Z',
    sourceLanguage: index ? 'mixed' : 'en', text, memoryText: text, consentEpoch: 3, allowed: true }));
  const annotations = [];
  function add(id, sourceIndex, spanText, meaning, field = 'text') {
    const source = sources[sourceIndex];
    const start = source[field].indexOf(spanText);
    if (start < 0) throw new Error('FIXTURE_SPAN_MISSING');
    annotations.push({ id, origin: ORIGIN, source: copy(source),
      spans: [{ field, start, end: start + spanText.length, text: spanText }], meaning });
  }
  add('tested-alpha', 0, 'On 2026-10-02, I tested the cedar-cache patch on two staging devices.',
    fact({ quantity: { value: 2, unit: 'devices' }, time: explicit('2026-10-02'), qualifiers: ['staging'] }));
  add('no-timeout', 0, 'The reconnect timeout did not recur.',
    fact({ actor: 'reconnect timeout', predicate: 'recurred', object: null, polarity: 'negative' }));
  add('relieved', 0, 'I felt somewhat relieved', feeling('relief', 'somewhat'));
  add('uneasy', 0, 'I still felt uneasy about the untested offline path',
    feeling('unease about the untested offline path', null));
  add('inspected', 0, 'I inspected the trace.', fact({ predicate: 'inspected', object: 'trace' }));
  add('planned', 0, 'I planned to test the offline path on Friday.',
    fact({ predicate: 'test', object: 'offline path', modality: 'planned', qualifiers: ['on Friday (unresolved)'] }));
  add('tested-beta', 1, '2026年10月7日，我在一台测试设备上测试了 cedar-cache 补丁',
    fact({ quantity: { value: 1, unit: 'devices' }, time: explicit('2026-10-07'), qualifiers: ['test device'] }));
  add('not-deployed', 1, '没有提交到生产环境',
    fact({ predicate: 'deployed', object: 'production', polarity: 'negative' }));
  add('hopeful', 1, '我有点期待', feeling('anticipation', 'a little'));
  add('uncertain', 1, '也仍不确定', feeling('uncertainty', null));
  add('wanted', 1, 'I wanted to ask Mira to review the offline path',
    fact({ predicate: 'ask', object: 'Mira to review the offline path', modality: 'wanted' }));
  add('possible', 1, 'I might run a longer check tomorrow.',
    fact({ predicate: 'run', object: 'longer check', modality: 'possible', qualifiers: ['tomorrow (unresolved)'] }));
  add('cause-relief', 0, 'I felt somewhat relieved because the reconnect timeout did not recur',
    { kind: 'relation', relation: 'reported-cause', from: 'no-timeout', to: 'relieved' });
  add('contrast-feelings', 0, 'I felt somewhat relieved because the reconnect timeout did not recur, but I still felt uneasy about the untested offline path',
    { kind: 'relation', relation: 'explicit-contrast', from: 'relieved', to: 'uneasy' });
  add('testing-before-inspection', 0, 'After testing the patch, I inspected the trace.',
    { kind: 'relation', relation: 'explicit-order', from: 'tested-alpha', to: 'inspected' });
  const fixture = { request, sources, annotations, realizations: [] };
  const plan = makeComposedPlan(fixture);
  fixture.realizations.push({ id: 'fixture-en-weekly', origin: ORIGIN, locale: 'en', reportType: 'WEEKLY',
    plan, text: 'You tested the cedar-cache patch in both records. The reconnect timeout not recurring left you somewhat relieved, but you still felt uneasy about the untested offline path.' });
  return fixture;
}

export function atomPlan(fixture, annotationId) {
  const annotation = fixture.annotations.find(item => item.id === annotationId);
  if (!annotation) throw new Error('UNKNOWN_FIXTURE_ANNOTATION');
  return { op: 'atom', annotationId, meaning: copy(annotation.meaning) };
}

export function relationPlan(fixture, annotationId) {
  const annotation = fixture.annotations.find(item => item.id === annotationId);
  return { op: 'relation', annotationId, left: atomPlan(fixture, annotation.meaning.from),
    right: atomPlan(fixture, annotation.meaning.to) };
}

export function makeComposedPlan(fixture) {
  return { op: 'and', args: [
    { op: 'recurs', args: [atomPlan(fixture, 'tested-alpha'), atomPlan(fixture, 'tested-beta')],
      subject: { actor: 'synthetic-user', predicate: 'tested', object: 'cedar-cache patch' }, scope: 'selected-records' },
    relationPlan(fixture, 'cause-relief'), relationPlan(fixture, 'contrast-feelings'),
  ] };
}

export function makeTextCandidate(fixture, plan = makeComposedPlan(fixture), text = fixture.realizations[0].text) {
  return { locale: fixture.request.locale, reportType: fixture.request.reportType, plan: copy(plan), text };
}
