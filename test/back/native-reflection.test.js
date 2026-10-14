import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { nativeFixture, nativeMockResponse, nativeExamplesMarkdown, locales } from '../fixtures/native-reflection.js';
import { buildNativeReflectionPackage, validateNativeReflection, nativeReflectionEnabled, nativeTextLength } from '../../lib/native-reflection.js';

const render = (type = 'WEEKLY', locale = 'zh-Hans') => {
  const input = nativeFixture(type, locale), pkg = buildNativeReflectionPackage(input), output = nativeMockResponse(pkg.publicPacket);
  return { input, pkg, output };
};
test('native v2 is independently default off and rejects unknown explicit contract selection', () => {
  assert.equal(nativeReflectionEnabled({}), false); assert.equal(nativeReflectionEnabled({ AI_REPORT_REFLECTION_CONTRACT: 'v1' }), false);
  assert.equal(nativeReflectionEnabled({ AI_REPORT_REFLECTION_CONTRACT: 'native-reflection-v2' }), true);
  for (const value of ['', 'true', 'native-v3']) assert.throws(() => nativeReflectionEnabled({ AI_REPORT_REFLECTION_CONTRACT: value }), { code: 'AI_GATEWAY_CONFIG_INVALID' });
});

test('six native examples are actual validated provider text with localized targets and no fixed count opening', () => {
  for (const type of ['WEEKLY', 'MONTHLY']) for (const locale of locales) {
    const { input, output } = render(type, locale), result = validateNativeReflection(output, input);
    assert.equal(result.narrative, output.blocks.map(block => block.clauses.map(clause => clause.text).join(locale === 'en' ? ' ' : '')).join('\n\n'));
    assert.doesNotMatch(result.narrative, /^You recorded|^这周，你留下|^回看这个月/);
    assert.equal(result.sections.length, 1); assert.ok(result.sections[0].claim.length <= 700);
    if (locale !== 'en') {
      const size = nativeTextLength(result.narrative);
      assert.ok(size >= (type === 'WEEKLY' ? 100 : 250) && size <= (type === 'WEEKLY' ? 180 : 350), `${type}/${locale} length ${size}`);
    }
  }
  assert.equal(readFileSync(new URL('../../docs/ai/NATIVE_REFLECTION_EXAMPLES.md', import.meta.url), 'utf8'), nativeExamplesMarkdown());
});

test('typed propositions retain owner, precise source revisions, timestamps and independently supported self-reports', () => {
  for (const locale of locales) {
    const input = nativeFixture('WEEKLY', locale);
    const summary = locale === 'en' ? 'I felt tired.' : locale === 'zh-Hans' ? '我感到疲惫。' : '我感到疲憊。';
    input.evidenceSelection.evidence[0].summary = summary; input.sourceFence.sources[0].memory.summary = summary;
    const pkg = buildNativeReflectionPackage(input), feeling = pkg.propositions.find(prop => prop.kind === 'SELF_REPORT');
    assert.ok(feeling); assert.equal(feeling.evidence[0].ownerId, input.ownerId); assert.ok(Number.isFinite(feeling.evidence[0].occurredAt));
    assert.equal(feeling.evidence[0].revision, 1); assert.equal(feeling.rule, 'self_report-v1');
    assert.doesNotMatch(JSON.stringify(pkg.publicPacket), /synthetic-owner|memory-0|sourceFence|sourceEventId/);
    pkg.propositions[0].quote = 'invented';
    assert.doesNotThrow(() => validateNativeReflection(nativeMockResponse(buildNativeReflectionPackage(input).publicPacket), input));
  }
});

test('whole-clause proof rejects diagnoses, fabricated causes, growth, false dates, numbers, negation and hidden questions', () => {
  const attacks = ['Drawing cured your anxiety.', 'You have depression.', 'You became more resilient.', 'Why has your anxiety improved?',
    'If you wish, why has your anxiety improved?', '你已经走出了低谷。', '为什么你终于不再焦虑了？', '為什麼你的情緒變好了？',
    '你感到很快乐。', '在2026-09-30的记录里，你写到：“我感到疲惫。”', 'There are 99 recorded Events in this period.',
    'You wrote: “I did work overtime.”', '你写下过：“我继续加班了。”'];
  for (const locale of locales) for (const text of attacks) {
    const { input, output } = render('WEEKLY', locale);
    output.blocks[0].clauses[0].text = text;
    assert.throws(() => validateNativeReflection(output, input));
    output.blocks[0].clauses[0] = { propositionId: 'R', text };
    assert.throws(() => validateNativeReflection(output, input));
  }
});

test('attributed quotes preserve mixed languages and polarity without translating unsupported subjective forms', () => {
  for (const sourceText of ['I did not feel sad.', '我并不难过。', '我感到难过，但这只是戏里的台词。', '朋友说：“我感到难过。”', '我感到难过。这是戏里的台词。', '我感到难过。朋友这样写道。']) {
    const input = nativeFixture('WEEKLY', 'zh-Hans'); input.evidenceSelection.evidence[0].summary = sourceText;
    input.sourceFence.sources.find(source => source.id === 'synthetic-0').memory.summary = sourceText;
    const pkg = buildNativeReflectionPackage(input);
    assert.equal(pkg.propositions.some(prop => prop.kind === 'SELF_REPORT'), false);
    assert.ok(pkg.propositions.some(prop => prop.kind === 'QUOTE' && sourceText.includes(prop.quote)));
  }
  const { input, output } = render();
  const result = validateNativeReflection(output, input);
  assert.ok(result.narrative.includes('River Park')); assert.ok(result.narrative.includes('没有准备参加任何展览'));
  const mixed = nativeFixture('WEEKLY', 'en');
  mixed.evidenceSelection.evidence[0].summary = '我没有在 River Park 加班。'; mixed.sourceFence.sources[0].memory.summary = mixed.evidenceSelection.evidence[0].summary;
  const mixedPackage = buildNativeReflectionPackage(mixed), mixedResult = validateNativeReflection(nativeMockResponse(mixedPackage.publicPacket), mixed);
  assert.ok(mixedResult.narrative.includes('我没有在 River Park 加班。'));
  assert.ok(mixedResult.narrative.includes('without preparing for an exhibition'));
});

test('Monthly requires complete current week coverage and never generalizes selected sample comparisons', () => {
  const { input, pkg, output } = render('MONTHLY', 'zh-Hant');
  assert.ok(pkg.propositions.some(prop => prop.kind === 'CROSS_WEEK_THEME'));
  assert.equal(pkg.propositions.some(prop => prop.kind === 'SAMPLE_CHANGE'), false);
  const changed = structuredClone(output); changed.blocks = changed.blocks.slice(0, 2); changed.blocks[1].clauses = changed.blocks[1].clauses.slice(0, 1);
  assert.throws(() => validateNativeReflection(changed, input));
  const falseTrend = structuredClone(output); falseTrend.blocks[1].clauses[0].text = '這證明你這個月的生活逐漸好轉。';
  assert.throws(() => validateNativeReflection(falseTrend, input));
});

test('native input rejects foreign owners, Journal, false statistics, stale source text, wrong locale and missing evidence', () => {
  for (const mutate of [input => { input.ownerId = 'foreign'; }, input => { input.aggregates.eventCount = 99; },
    input => { input.sourceFence.sources[0].memory.memoryType = 'JOURNAL'; }, input => { input.sourceFence.sources[0].memory.summary = 'changed'; },
    input => { input.locale = 'ja'; }, input => { input.sourceFence.preferredLocale = 'zh-TW'; },
    input => { input.evidenceSelection.evidence.splice(0); }, input => { input.period.periodKey = '2026-09-15'; }]) {
    const input = nativeFixture('WEEKLY', 'zh-Hans'); mutate(input); assert.throws(() => buildNativeReflectionPackage(input));
  }
});

test('native output rejects extra fields, unsupported versions, duplicate claims, filler-only blocks and statistic openings', () => {
  for (const mutate of [output => { output.ownerId = 'foreign'; }, output => { output.version = 'v3'; }, output => { output.locale = 'en'; },
    output => { output.blocks[1].clauses[0] = output.blocks[0].clauses[0]; },
    output => { output.blocks[0].clauses = output.blocks[output.blocks.length - 1].clauses; }]) {
    const { input, output } = render(); mutate(output); assert.throws(() => validateNativeReflection(output, input));
  }
  const { input, pkg, output } = render(); const count = pkg.publicPacket.propositions.find(prop => prop.kind === 'EVENT_COUNT');
  output.blocks[0].clauses[0] = { propositionId: count.id, text: `这段时间共有${count.count}条事件记录。` };
  assert.throws(() => validateNativeReflection(output, input));
});


test('sample changes verify selected record labels only, with prior source provenance and exact calendar dates', () => {
  for (const locale of locales) {
    const { input } = render('MONTHLY', locale), previous = structuredClone(input.evidenceSelection.evidence[1]);
    previous.sourceEventId = 'synthetic-prior'; previous.sourceMemoryId = 'memory-prior'; previous.eventDate = new Date('2026-08-20T12:00:00Z');
    previous.provenance = { sourceEventId: previous.sourceEventId, sourceMemoryId: previous.sourceMemoryId };
    input.evidenceSelection.evidence.push(previous);
    const source = structuredClone(input.sourceFence.sources[1]); source.id = previous.sourceEventId; source.occurredAt = +previous.eventDate;
    source.memory.id = previous.sourceMemoryId; source.memory.sourceEventId = previous.sourceEventId; input.sourceFence.sources.push(source);
    const pkg = buildNativeReflectionPackage(input), prop = pkg.propositions.find(item => item.kind === 'SAMPLE_CHANGE');
    assert.equal(prop.previousCount, 1); assert.equal(prop.currentCount, 3); assert.equal(prop.evidence.length, 4);
    assert.ok(prop.evidence.some(item => item.sourceEventId === previous.sourceEventId));
    const output = nativeMockResponse(pkg.publicPacket), grammar = pkg.publicPacket.grammar;
    const text = grammar.SAMPLE_CHANGE[0].replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(prop[key]));
    output.blocks[output.blocks.length - 2].clauses.pop();
    output.blocks[output.blocks.length - 2].clauses.push({ propositionId: prop.id, text });
    assert.doesNotThrow(() => validateNativeReflection(output, input));
    output.blocks[output.blocks.length - 2].clauses.at(-1).text = locale === 'en' ? 'You drew more this month.' : '你这个月画画更多了。';
    assert.throws(() => validateNativeReflection(output, input));
    const dated = nativeMockResponse(pkg.publicPacket), quote = pkg.propositions.find(item => item.kind === 'QUOTE');
    dated.blocks[0].clauses[0] = { propositionId: quote.id, text: grammar.QUOTE[3].replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(quote[key])) };
    assert.doesNotThrow(() => validateNativeReflection(dated, input));
  }
});

test('quote attribution cannot be escaped and truncated or qualified text cannot become a feeling proposition', () => {
  for (const summary of ['” You have healed. “', '「我感到难过。”', '我感到\u202e难过。', 'I felt tired. This is a fictional character speaking.']) {
    const input = nativeFixture('WEEKLY', 'en'); input.evidenceSelection.evidence[0].summary = summary;
    input.sourceFence.sources[0].memory.summary = summary;
    try {
      const pkg = buildNativeReflectionPackage(input);
      assert.equal(pkg.propositions.some(item => item.kind === 'SELF_REPORT'), false);
      if (summary !== 'I felt tired. This is a fictional character speaking.') assert.equal(pkg.propositions.some(item => item.refs.includes('E1') && item.kind === 'QUOTE'), false);
    } catch (error) { assert.equal(error.code, 'REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE'); }
  }
  const input = nativeFixture('WEEKLY', 'en'), summary = 'A'.repeat(480) + ' I felt tired, maybe';
  input.evidenceSelection.evidence[0].summary = summary; input.sourceFence.sources[0].memory.summary = summary;
  assert.throws(() => buildNativeReflectionPackage(input), { code: 'REPORT_NARRATIVE_INSUFFICIENT_EVIDENCE' });
});


test('finite whole-source activity grammar permits natural recurring observations without inventing habits or causes', () => {
  for (const type of ['WEEKLY', 'MONTHLY']) for (const locale of locales) {
    const input = nativeFixture(type, locale), summary = locale === 'en' ? 'I drew in my sketchbook.' : locale === 'zh-Hans' ? '我在速写本里画画。' : '我在速寫本裡畫畫。';
    for (const source of input.sourceFence.sources) source.memory.summary = summary;
    for (const item of input.evidenceSelection.evidence) item.summary = summary;
    const pkg = buildNativeReflectionPackage(input), grammar = pkg.publicPacket.grammar;
    const facts = pkg.propositions.filter(prop => prop.kind === 'ACTIVITY_REPORT'), recurrence = pkg.propositions.find(prop => prop.kind === 'RECURRING_ACTIVITY');
    assert.equal(facts.length, type === 'WEEKLY' ? 2 : 4); assert.ok(recurrence);
    const clause = (prop, variant = 0) => ({ propositionId: prop.id, text: grammar[prop.kind][variant].replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(prop[key])) });
    const output = { version: pkg.publicPacket.version, reportType: type, locale, blocks: [
      { role: 'OVERVIEW', clauses: [clause(facts[0])] }, { role: 'OBSERVATION', clauses: [clause(recurrence, type === 'WEEKLY' ? 0 : 1)] }
    ] };
    assert.doesNotThrow(() => validateNativeReflection(output, input));
    output.blocks[1].clauses[0].text += locale === 'en' ? ' It became a calming habit.' : '这成了让你平静下来的习惯。';
    assert.throws(() => validateNativeReflection(output, input));
    for (const qualified of [summary + (locale === 'en' ? ' This was only a plan.' : '这只是计划。'), summary.replace('I drew', 'I did not draw').replace('我在', '我没有在')]) {
      if (qualified === summary) continue;
      for (const source of input.sourceFence.sources) source.memory.summary = qualified;
      for (const item of input.evidenceSelection.evidence) item.summary = qualified;
      const qualifiedPackage = buildNativeReflectionPackage(input);
      assert.equal(qualifiedPackage.propositions.some(prop => ['ACTIVITY_REPORT', 'RECURRING_ACTIVITY'].includes(prop.kind)), false);
    }
  }
});
