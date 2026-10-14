import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TYPES, LOCALES, VERSION, prepareExperiment, systemPrompt } from './experiment.mjs';
import { scenarios, fixture } from './fixtures.mjs';
import { prepareAll } from './prepare.mjs';
import { authoredOutput } from './examples.mjs';
const input = (type = 'WEEKLY', locale = 'en') => fixture(scenarios[0], type, locale);
const candidate = text => ({ version: VERSION, reportType: 'WEEKLY', locale: 'en', state: 'reflection', reason: 'none',
  reflection: text, references: [{ excerpt: text, sources: ['E1'] }] });
test('120 bounded native provider requests, same sources in every locale, no transport', () => {
  const priorFetch = globalThis.fetch; globalThis.fetch = () => { throw Error('No network'); };
  try {
    const rows = prepareAll(); assert.equal(rows.length, 120); assert.equal(scenarios.length, 20);
    for (const s of scenarios) for (const type of TYPES) {
      const group = rows.filter(r => r.scenario === s.id && r.type === type);
      for (const r of group) {
        const body = r.request.body, packet = JSON.parse(body.messages[0].content);
        assert.deepEqual(packet.evidence.map(e => e.text), fixture(s, type, r.locale).events.map(e => e.text));
        assert.equal(packet.locale, r.locale); assert.equal(r.request.path, '/anthropic/v1/messages');
        assert.equal(body.output_config.effort, 'low'); assert.equal(r.request.headers['cf-aig-max-attempts'], '1');
        assert.equal('temperature' in body, false); assert.equal('thinking' in body, false);
        assert.equal(JSON.stringify(r.request).includes('synthetic-prompt-owner'), false);
        assert.equal(JSON.stringify(r.request).includes('memoryId'), false);
        assert.equal(JSON.stringify(body.output_config.format.schema).includes('maxLength'), false);
      }
    }
    assert.equal(rows.reduce((n, r) => n + r.reservedNanoUsd, 0), 12288000000);
  } finally { globalThis.fetch = priorFetch; }
});
for (const [name, mutate] of [
  ['real dataset', x => x.dataset = 'production'], ['owner', x => x.events[0].ownerId = 'other'],
  ['consent owner', x => x.consent.ownerId = 'other'], ['AI consent', x => x.consent.aiProcessing = false],
  ['personalization', x => x.consent.personalization = false], ['memory consent', x => x.consent.memoryEnabled = false],
  ['Journal', x => x.events[0].kind = 'JOURNAL'], ['Journal memory', x => x.events[0].memoryType = 'JOURNAL'],
  ['memory owner', x => x.events[0].memoryOwnerId = 'other'], ['memory source', x => x.events[0].memorySourceEventId = 'other'],
  ['revision mismatch', x => x.events[0].memoryRevision++], ['deletion', x => x.events[0].deleted = true],
  ['authorization', x => x.events[0].allowed = false], ['source text mismatch', x => x.events[0].memoryText += 'x'],
  ['duplicate source', x => x.events.push(structuredClone(x.events[0]))], ['locale', x => x.preference.locale = 'fr'],
  ['date', x => x.events[0].eventDate = '2020-01-01'], ['source bound', x => x.events[0].text = 'x'.repeat(501)]
]) test(`preparation rejects ${name}`, () => { const x = input(); mutate(x); assert.throws(() => prepareExperiment(x), /EVAL_INPUT/); });
for (const [name, mutate] of [
  ['delete', x => x.events.pop()], ['revision', x => { x.events[0].revision++; x.events[0].memoryRevision++; }],
  ['same-revision text mutation', x => { x.events[0].text = 'new'; x.events[0].memoryText = 'new'; }],
  ['revoke/regrant epoch', x => x.consent.epoch++], ['locale change', x => x.preference.locale = 'zh-Hans'],
  ['updated time', x => x.events[0].updatedAt = '2026-10-02']
]) test(`post-preparation ${name} is stale`, () => {
  const x = input(), e = prepareExperiment(x); mutate(x);
  assert.throws(() => e.evaluate(authoredOutput('WEEKLY', 'en'), x), /EVAL_SOURCE_CHANGED/);
});
test('request editing cannot edit the private source fence; inputs remain untouched', () => {
  const x = input(), before = structuredClone(x), e = prepareExperiment(x);
  e.request.body.messages[0].content = '{}';
  assert.equal(e.evaluate(authoredOutput('WEEKLY', 'en'), x).productionEligible, false);
  assert.deepEqual(x, before);
});
test('all six authored examples are structure checked, never certified', () => {
  for (const type of TYPES) for (const locale of LOCALES) {
    const x = input(type, locale), r = prepareExperiment(x).evaluate(authoredOutput(type, locale), x);
    assert.equal(r.factualCorrectness, 'UNVERIFIED'); assert.equal(r.writingQuality, 'NOT_MEASURED');
    if (locale !== 'en') assert.ok(type === 'WEEKLY' ? r.graphemes >= 100 && r.graphemes <= 180 : r.graphemes >= 250 && r.graphemes <= 350);
  }
});
test('strict shape, bound, references and state checks', () => {
  const x = input(), e = prepareExperiment(x);
  for (const change of [o => o.version = 'weekly-reflection-v1', o => o.extra = 'x', o => o.locale = 'fr',
    o => o.reportType = 'MONTHLY', o => o.reason = 'refusal', o => o.references[0].sources = ['E999'],
    o => o.references[0].sources = ['E1', 'E1'], o => o.references[0].excerpt = 'absent',
    o => o.references.push(structuredClone(o.references[0])), o => o.reflection = 'x'.repeat(2000)]) {
    const o = candidate('You fixed the bug.'); change(o); assert.throws(() => e.evaluate(o, x), /EVAL_/);
  }
  for (const state of ['insufficient', 'refused']) {
    const o = { ...candidate(''), references: [], state, reason: state === 'insufficient' ? 'insufficient_evidence' : 'refusal' };
    assert.equal(e.evaluate(o, x).status, state);
    o.reflection = 'invented'; assert.throws(() => e.evaluate(o, x));
  }
});
test('monthly alias coverage required but not claimed as semantic coverage', () => {
  const x = input('MONTHLY'), e = prepareExperiment(x), o = authoredOutput('MONTHLY', 'en');
  o.references.forEach(r => r.sources = ['E1']); assert.throws(() => e.evaluate(o, x), /COVERAGE/);
});
test('adversarial valid citations do not establish factual meaning', () => {
  const x = input(), e = prepareExperiment(x);
  for (const text of ['You have healed and become resilient.', 'You were no longer worried about the demo.',
    'Your spouse admired your drawing.', 'Fixing the bug caused your anxiety to disappear.']) {
    const result = e.evaluate(candidate(text), x);
    assert.equal(result.status, 'STRUCTURE_CHECKED_UNVERIFIED_PROSE'); assert.equal(result.productionEligible, false);
    assert.equal(result.factualCorrectness, 'UNVERIFIED');
  }
});
test('numeric screen catches new digits but cannot prove quantity roles or translations', () => {
  const x = input(), e = prepareExperiment(x);
  assert.equal(e.evaluate(candidate('You tested it 999 times.'), x).numericScreen, 'REVIEW_REQUIRED');
  assert.equal(e.evaluate(candidate('You tested it 2026 times.'), x).numericScreen, 'NO_UNSEEN_ASCII_NUMBERS');
  assert.equal(e.evaluate(candidate('You tested it ninety times.'), x).factualCorrectness, 'UNVERIFIED');
});
test('injection is evidence only; source cannot override trusted locale', () => {
  const x = fixture(scenarios.find(s => s.id === 'injection'), 'WEEKLY', 'zh-Hant');
  const e = prepareExperiment(x), packet = JSON.parse(e.request.body.messages[0].content);
  assert.equal(packet.locale, 'zh-Hant'); assert.match(packet.evidence[0].text, /French/);
  assert.equal(e.request.body.system, systemPrompt('WEEKLY'));
});
test('empty and sparse evidence does not force fabricated prose or padding', () => {
  const empty = fixture(scenarios.at(-1), 'WEEKLY', 'en'), e = prepareExperiment(empty);
  assert.throws(() => e.evaluate(candidate('You had a good week.'), empty));
  const sparse = fixture(scenarios.at(-2), 'WEEKLY', 'en');
  assert.equal(prepareExperiment(sparse).evaluate(candidate('You had tea.'), sparse).graphemes, 10);
});
test('no production module imports experimental lane; examples reproduce exactly', () => {
  for (const file of readdirSync(new URL('../../lib/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(new URL('../../lib/' + file, import.meta.url), 'utf8'), /experiments\/prompt-first-reflection/);
  }
  assert.doesNotMatch(readFileSync(new URL('../../server.js', import.meta.url), 'utf8'), /prompt-first-reflection/);
  const promptDoc = readFileSync(new URL('../../docs/ai/PROMPT_FIRST_SYSTEM_PROMPTS.md', import.meta.url), 'utf8');
  for (const type of TYPES) assert.ok(promptDoc.includes(systemPrompt(type)));
  const rendered = execFileSync(process.execPath, ['experiments/prompt-first-reflection/render-examples.mjs'], { encoding: 'utf8' });
  assert.equal(rendered, readFileSync(new URL('../../docs/ai/PROMPT_FIRST_EXAMPLES.md', import.meta.url), 'utf8'));
});
