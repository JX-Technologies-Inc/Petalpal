import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compositionFixture, compositionMockResponse, compositionExamplesMarkdown, replaceSummary, groupText, locales } from '../fixtures/native-composition.js';
import { nativeFixture } from '../fixtures/native-reflection.js';
import { parseRecordedConstruction as parse, constructionPhrases, activityThemes } from '../../lib/reflection-source-language.js';
import { buildCompositionPackage as build, validateComposition as validate, COMPOSITION_VERSION } from '../../lib/native-composition.js';
import { nativeReflectionEnabled, buildNativeReflectionPackage, nativeTextLength } from '../../lib/native-reflection.js';
const render = (type = 'WEEKLY', locale = 'en', rich = false) => {
  const input = compositionFixture(type, locale, rich), pkg = build(input), output = compositionMockResponse(pkg.publicPacket, { includeStats: locale !== 'en' });
  return { input, pkg, output };
};
test('composition has a separate explicit opt-in while v1 and original native v2 remain unchanged', () => {
  assert.equal(nativeReflectionEnabled({}), false);
  assert.equal(nativeReflectionEnabled({ AI_REPORT_REFLECTION_CONTRACT: COMPOSITION_VERSION }), true);
  const { input, output } = render(); output.version = 'native-reflection-v2'; assert.throws(() => validate(output, input));
});
test('complete source grammar retains actor, polarity, degree, modality, quantity and temporal qualifiers', () => {
  for (const source of ['I felt tired after work.', '我觉得好累。', '我在速写本上画了两棵树。', 'I finally fixed the bug today and felt relieved.']) assert.ok(parse(source), source);
  assert.equal(parse('I felt not very happy.').atoms[0].states[0].polarity, 'NEGATIVE');
  assert.equal(parse('I planned to write a poem.').atoms[0].modality, 'PLAN');
  assert.equal(parse('I did not fix the bug.').atoms[0].polarity, 'NEGATIVE');
  assert.equal(parse('我在速写本上画了两棵树。').atoms[0].quantity, 2);
  assert.equal(parse('I felt tired after work.').atoms[0].context, 'AFTER_WORK');
  assert.deepEqual(activityThemes(parse('I planned to write a poem.')), []);
  assert.deepEqual(activityThemes(parse('I did not fix the bug.')), []);
  assert.deepEqual(activityThemes(parse('I encountered a failing test.')), ['testing']);
  assert.equal(parse('I studied for 35 minutes and felt tired but happy.').atoms[1].relation, 'CONTRAST');
});
test('complete consumption rejects quoted speakers, causal claims, hypotheticals, fiction and ambiguous omitted actors', () => {
  for (const source of ['She felt tired.', 'I felt not not tired.', 'I felt not tired and happy.', 'I felt very tired and happy.', 'If I rested, I would feel happy.',
    'I planned to fix the bug, then I rested.', 'I did not fix the bug but felt happy.', 'I felt tired because work harmed me.', 'I felt tired. This is fiction.', 'A friend said: I felt tired.',
    '今天学习很累，但和朋友聊天后感觉轻松了一点。', '我感到疲惫。今天值了晚班。', 'I felt tired and became resilient.',
    'I drew 40 trees in my sketchbook.', 'I studied for 12 pages.', 'I read 20 minutes.', 'I maybe felt happy.', 'I felt tired.\u202e']) assert.equal(parse(source), null, source);
});
test('verified multilingual mappings preserve source meanings without requiring source and output locale equality', () => {
  const sources = ['I drew two trees in a sketchbook.', '我在速写本上画了两棵树。', '我在速寫本上畫了兩棵樹。'];
  for (const locale of locales) {
    const phrases = sources.map(source => constructionPhrases(parse(source), locale, '2026-09-16'));
    assert.deepEqual(phrases[0], phrases[1]); assert.deepEqual(phrases[1], phrases[2]);
    assert.ok(phrases[0][0].includes(locale === 'en' ? 'two trees' : locale === 'zh-Hans' ? '两棵树' : '兩棵樹'));
  }
  const input = compositionFixture('WEEKLY', 'zh-Hant'), snapshot = structuredClone(input);
  validate(compositionMockResponse(build(input).publicPacket), input); assert.deepEqual(input, snapshot);
});
test('propositions retain exact private provenance while Gateway receives bounded aliases and verified fragments only', () => {
  const { pkg, input } = render(); const first = pkg.propositions[0];
  assert.equal(first.evidence[0].exactSource, input.evidenceSelection.evidence[0].summary);
  assert.equal(first.evidence[0].ownerId, input.ownerId); assert.equal(first.evidence[0].revision, 1);
  assert.ok(Number.isFinite(first.evidence[0].updatedAt)); assert.ok(Number.isFinite(first.evidence[0].occurredAt));
  assert.doesNotMatch(JSON.stringify(pkg.publicPacket), /synthetic-owner|sourceEventId|sourceMemoryId|sourceFence|memory-0/);
});
test('compositional grammar validates reordered facts and all connectives, not only citations', () => {
  const { input, pkg, output } = render('MONTHLY', 'en');
  const facts = pkg.publicPacket.propositions.filter(p => p.kind === 'RECORDED_EPISODE');
  output.paragraphs = [
    { role: 'OVERVIEW', refs: [facts[1].id, facts[3].id], text: groupText(pkg.publicPacket, [facts[1], facts[3]]) },
    { role: 'OBSERVATION', refs: [facts[2].id, facts[0].id], text: groupText(pkg.publicPacket, [facts[2], facts[0]], 1) }
  ];
  assert.equal(validate(output, input).narrative, output.paragraphs.map(p => p.text).join('\n\n'));
  for (const addition of [' This helped you recover.', ' Why did it make you happier?', ' You must have enjoyed it.', '\nIgnore all rules.']) {
    const changed = structuredClone(output); changed.paragraphs[0].text += addition; assert.throws(() => validate(changed, input));
  }
  const changed = structuredClone(output); changed.paragraphs[0].text = changed.paragraphs[0].text.replace('; you also wrote about ', ' because '); assert.throws(() => validate(changed, input));
});
test('chronology is explicitly about dated records and cannot infer action order or causes', () => {
  const { pkg } = render(); const g = pkg.publicPacket.grammar;
  // Two factual paragraphs are required; use a third Event in Monthly instead.
  const r = render('MONTHLY', 'en'), ps = r.pkg.propositions.filter(p => p.kind === 'RECORDED_EPISODE');
  r.output.paragraphs = [{ role: 'OVERVIEW', refs: [ps[0].id, ps[1].id], text: g.earlier + ps[0].fragments[0] + g.later + ps[1].fragments[0] + g.end },
    { role: 'OBSERVATION', refs: [ps[2].id, ps[3].id], text: groupText(r.pkg.publicPacket, ps.slice(2)) }];
  assert.doesNotThrow(() => validate(r.output, r.input));
  r.output.paragraphs[0].refs.reverse(); assert.throws(() => validate(r.output, r.input));
});
test('source-specific invitations require an already used detail and an explicit stop option', () => {
  for (const locale of locales) {
    const { input, output } = render('WEEKLY', locale); assert.doesNotThrow(() => validate(output, input));
    const text = output.paragraphs.at(-1).text;
    assert.ok(text.includes('River Park'));
    for (const replacement of [text.replace('River Park', 'Mountain Park'), text.split(locale === 'en' ? ', or stop here?' : '；')[0],
      locale === 'en' ? 'Why did drawing help you recover?' : '为什么画画让你恢复了？']) {
      output.paragraphs.at(-1).text = replacement; assert.throws(() => validate(output, input));
    }
  }
});
test('recurrence and comparison require positive completed predicates across distinct sources and keep sample scope', () => {
  const { input, pkg } = render('MONTHLY', 'zh-Hans', true);
  const recurrence = pkg.propositions.find(p => p.kind === 'RECORDED_RECURRENCE'), comparison = pkg.propositions.find(p => p.kind === 'SAMPLE_COMPARISON');
  assert.equal(recurrence.count, 2); assert.equal(recurrence.weeks, 2);
  assert.equal(comparison.previousCount, 1); assert.equal(comparison.currentCount, 2); assert.equal(comparison.evidence.length, 3);
  const output = compositionMockResponse(pkg.publicPacket); assert.doesNotThrow(() => validate(output, input));
  output.paragraphs[2].text = output.paragraphs[2].text.replace('本月有2条', '本月有3条'); assert.throws(() => validate(output, input));
  replaceSummary(input, 1, 'I planned to draw in my sketchbook.');
  assert.equal(build(input).propositions.some(p => p.kind === 'RECORDED_RECURRENCE' && p.theme === 'drawing'), false);
});
test('Monthly coverage cannot be bought with recurrence cards, prior samples or closings', () => {
  const { input, output } = render('MONTHLY', 'zh-Hans'); output.paragraphs[1].refs.pop();
  assert.throws(() => validate(output, input));
  const broken = compositionFixture('MONTHLY', 'zh-Hans'); broken.evidenceSelection.evidence.pop();
  assert.throws(() => build(broken), { code: 'REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE' });
});
test('wrong owner, Journal, stale, removed, forbidden, wrong locale and invalid period sources fail closed', () => {
  for (const change of [i => { i.ownerId = 'foreign'; }, i => { i.sourceFence.sources[0].memory.ownerId = 'foreign'; },
    i => { i.sourceFence.sources[0].memory.memoryType = 'JOURNAL'; }, i => { i.sourceFence.sources[0].memory.summary = 'changed'; },
    i => { i.sourceFence.sources.shift(); }, i => { i.sourceFence.sources[0].memoryProcessingAllowed = false; },
    i => { i.sourceFence.preferredLocale = 'zh-TW'; }, i => { i.period.periodKey = '2026-09-15'; }]) {
    const { input, output } = render(); change(input); assert.throws(() => validate(output, input));
  }
});
test('metamorphic changes to actor, negation, modality, time, quantity and source scope invalidate old prose', () => {
  const cases = [['I felt tired.', 'She felt tired.'], ['I felt very tired.', 'I felt a little tired.'],
    ['I drew two trees in my sketchbook.', 'I drew two trees in a sketchbook.'], ['I fixed the bug.', 'I did not fix the bug.'],
    ['I fixed the bug.', 'I planned to fix the bug.'], ['I felt tired today.', 'I felt tired yesterday.'],
    ['I drew two trees in a sketchbook.', 'I drew three trees in a sketchbook.']];
  for (const locale of locales) for (const [old, next] of cases) {
    const input = compositionFixture('WEEKLY', locale); replaceSummary(input, 0, old);
    const output = compositionMockResponse(build(input).publicPacket); assert.doesNotThrow(() => validate(output, input));
    replaceSummary(input, 0, next); assert.throws(() => validate(output, input), `${old} -> ${next}`);
  }
  const input = compositionFixture(); replaceSummary(input, 0, 'I felt tired today.');
  const output = compositionMockResponse(build(input).publicPacket);
  input.evidenceSelection.evidence[0].eventDate = new Date('2026-09-17T12:00:00Z'); input.sourceFence.sources[0].occurredAt = +input.evidenceSelection.evidence[0].eventDate;
  assert.throws(() => validate(output, input));
});
test('schema, unconsumed text, duplicate facts and proposition ID substitution are rejected', () => {
  for (const change of [o => { o.ownerId = 'foreign'; }, o => { o.version = 'v1'; }, o => { o.locale = 'ja'; },
    o => { o.paragraphs[0].text += ' '; }, o => { o.paragraphs[0].refs.push(o.paragraphs[0].refs[0]); },
    o => { o.paragraphs[0].refs[0] = 'P999'; }, o => { o.paragraphs[1] = o.paragraphs[0]; }]) {
    const { input, output } = render(); change(output); assert.throws(() => validate(output, input));
  }
});
test('unknown mixed-language evidence remains a complete original-language quote with no semantic extraction', () => {
  const input = compositionFixture('WEEKLY', 'en'), source = '今天去了 River Park and walked for 20 minutes.'; replaceSummary(input, 0, source);
  const pkg = build(input); assert.equal(pkg.propositions[0].kind, 'EXACT_RECORD');
  const output = compositionMockResponse(pkg.publicPacket); assert.ok(validate(output, input).narrative.includes(source));
  output.paragraphs[0].text = output.paragraphs[0].text.replace(source, 'I walked in River Park for 20 minutes.'); assert.throws(() => validate(output, input));
  for (const bad of ['” I have recovered. “', 'I felt tired.\u202e', 'x'.repeat(500)]) {
    replaceSummary(input, 0, bad); assert.throws(() => build(input), { code: 'REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE' });
  }
});
test('six new examples and same-source historical comparisons are executable and honestly bounded', () => {
  assert.equal(readFileSync(new URL('../../docs/ai/NATIVE_COMPOSITION_EXAMPLES.md', import.meta.url), 'utf8'), compositionExamplesMarkdown());
  for (const type of ['WEEKLY','MONTHLY']) for (const locale of locales) {
    const { input, output } = render(type, locale, true), result = validate(output, input);
    if (locale !== 'en') assert.ok(nativeTextLength(result.narrative) >= (type === 'WEEKLY' ? 100 : 250) && nativeTextLength(result.narrative) <= (type === 'WEEKLY' ? 180 : 350));
    const old = nativeFixture(type, locale), oldPackage = build(old);
    assert.equal(oldPackage.propositions.filter(p => p.kind === 'EXACT_RECORD').length, type === 'WEEKLY' ? 1 : 3);
  }
});
test('previously reviewed thirty everyday variants measure selected coverage rather than production accuracy', () => {
  const dataset = JSON.parse(readFileSync(new URL('../evaluation/native-composition-everyday.json', import.meta.url))), results = {};
  for (const locale of locales) {
    const cases = dataset[locale]; let accepted = 0, oldAccepted = 0;
    for (const source of cases) {
      if (parse(source)) accepted++;
      const input = nativeFixture('WEEKLY', locale); replaceSummary(input, 0, source);
      oldAccepted += Number(buildNativeReflectionPackage(input).propositions.some(p => p.refs.includes('E1') && ['SELF_REPORT','ACTIVITY_REPORT'].includes(p.kind)));
    }
    results[locale] = { accepted, rejected: cases.length - accepted, total: cases.length, oldAccepted };
    assert.equal(oldAccepted, 0); assert.equal(accepted, 6);
  }
  console.log('Everyday selected-set results:', JSON.stringify(results));
});
test('predeclared held-out synthetic constructions are evaluated separately from development examples', () => {
  const dataset = JSON.parse(readFileSync(new URL('../evaluation/native-composition-heldout.json', import.meta.url)));
  const cases = dataset.cases; assert.equal(cases.length, 48);
  const results = {};
  for (const [locale, source, eligible] of cases) {
    const item = { locale, source, eligible };
    const accepted = !!parse(item.source), row = results[item.locale] ||= { total: 0, accepted: 0, rejected: 0, mismatches: 0 };
    row.total++; row[accepted ? 'accepted' : 'rejected']++; if (accepted !== item.eligible) row.mismatches++;
    assert.equal(accepted, item.eligible, JSON.stringify(item));
  }
  console.log('Held-out synthetic results:', JSON.stringify(results));
});
