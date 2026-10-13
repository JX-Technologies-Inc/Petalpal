import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { reviewInput, renderReview, renderedExamplesMarkdown, reviewLocales } from '../fixtures/reflection-review.js';
import { validateWeeklyReflection, buildWeeklyReflectionPacket } from '../../lib/sonnet-weekly.js';
import { validateMonthlyReflection, buildMonthlyReflectionPacket } from '../../lib/opus-monthly.js';
import { GroundedReportNarrativeService } from '../../lib/report-narrative.js';

// These are boundary/review tests, not a new semantic validator or native-writing
// implementation. Existing privacy/job/cost/persistence regressions are reused.
test('review artifact exactly matches current deterministic multilingual renderer output', t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('no network or inference allowed'));
  assert.equal(readFileSync(new URL('../../docs/ai/REFLECTION_RENDERED_EXAMPLES.md', import.meta.url), 'utf8'), renderedExamplesMarkdown());
});

test('ordinary sensitive Chinese and mixed-language sources retain numbers and negation in attributed output', () => {
  for (const type of ['WEEKLY', 'MONTHLY']) for (const locale of reviewLocales) {
    const { result } = renderReview(type, locale);
    assert.ok(result.narrative.includes(locale === 'en' ? 'frustrated' : locale === 'zh-Hant' ? '很煩' : '很烦'));
    assert.ok(result.narrative.includes(type === 'WEEKLY' ? 'River Park' : locale === 'en' ? 'friend' : '朋友'));
    if (locale !== 'en' && type === 'WEEKLY') assert.ok(result.narrative.includes(locale === 'zh-Hant' ? '沒有參加展覽' : '没有参加展览'));
  }
  const { input, plan } = renderReview('WEEKLY', 'zh-Hans');
  const original = '我走了２公里，没有参加比赛。';
  input.evidenceSelection.evidence[0].summary = original;
  input.sourceFence.sources.find(source => source.id === 'synthetic-0').memory.summary = original;
  const packet = buildWeeklyReflectionPacket(input); plan.moments[0].quote = packet.evidence[0].sentences[0];
  assert.ok(validateWeeklyReflection(plan, input, packet).narrative.includes(original));
  plan.moments[0].quote = '我参加了比赛，跑了３公里。';
  assert.throws(() => validateWeeklyReflection(plan, input, packet));
});

test('v1 contracts do not accept native prose or reflective labels as evidence of factual entailment', () => {
  const claims = ['Drawing caused your anxiety to disappear.', '你已经患上抑郁症。', '你的個性一直很脆弱。',
    'Why have your symptoms improved?', '你升职了。', 'You visited River Park on 2026-09-30.', 'You ran ９ kilometres.'];
  for (const type of ['WEEKLY', 'MONTHLY']) for (const locale of reviewLocales) {
    const { input, plan } = renderReview(type, locale), validate = type === 'WEEKLY' ? validateWeeklyReflection : validateMonthlyReflection;
    for (const text of claims) {
      // Unknown prose is rejected regardless of truth or language. This does NOT
      // certify a detector for diagnoses/causes; a benign native paragraph fails too.
      assert.throws(() => validate({ ...plan, overview: { text, role: 'reflection', evidenceRefs: ['E1'] } }, input));
    }
    assert.throws(() => validate({ ...plan, overview: { text: '回看这些记录，也可以暂时不下结论。', evidenceRefs: ['E1'] } }, input));
  }
});

test('legacy citation and numeric checks demonstrably cannot certify novel prose as true', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('no network or inference allowed'));
  for (const claim of ['Drawing cured your anxiety.', 'You have clinical depression.', '你已经抑郁了。', '為什麼你的焦慮已經改善？']) {
    let calls = 0;
    const input = reviewInput('WEEKLY', 'en');
    const service = new GroundedReportNarrativeService({ maxAttempts: 1, provider: { generateNarrative() {
      calls++; return { sections: [{ kind: 'RECENT_MOMENTS', claim,
        evidenceRefs: [{ sourceEventId: 'synthetic-0', sourceMemoryId: 'memory-0' }], aggregateRefs: [] }] };
    } } });
    const result = await service.generate(input);
    // Known, already documented legacy limitation; not desired acceptance for a
    // native contract. If that legacy gate is hardened, update this review record.
    assert.equal(result.status, 'GENERATED', 'reproduce the documented lack of semantic entailment checks');
    assert.equal(calls, 1);
  }
});

test('sparse and cross-owner evidence cannot become a valid native-writing fact package', () => {
  const weekly = reviewInput('WEEKLY', 'en'); weekly.evidenceSelection.evidence[0].ownerId = 'another-owner';
  assert.throws(() => buildWeeklyReflectionPacket(weekly));
  const monthly = reviewInput('MONTHLY', 'zh-Hans'); monthly.evidenceSelection.evidence.splice(1, 3);
  assert.throws(() => buildMonthlyReflectionPacket(monthly));
});

test('unapproved native version or locale cannot enter existing v1 reflection contracts', () => {
  for (const type of ['WEEKLY', 'MONTHLY']) {
    const { input, plan } = renderReview(type, 'en');
    const validate = type === 'WEEKLY' ? validateWeeklyReflection : validateMonthlyReflection;
    assert.throws(() => validate({ ...plan, version: 'native-reflection-v2' }, input));
    assert.throws(() => validate({ ...plan, locale: 'zh-Hans' }, input));
    assert.doesNotThrow(() => validate(plan, input));
  }
});
