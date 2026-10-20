import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const { shortWeekly, moodCurveLayout, moodIcon, SHORT_COPY, WEEKLY_SHORT, shortDate, thenNowCount } = loadPlantingModules()('../../../services/reflections');
const { PRIMARY_MOODS } = loadPlantingModules()('../../../services/events');
const plain = value => JSON.parse(JSON.stringify(value)); // values from the VM sandbox have foreign prototypes

// Synthetic sections in the shape the backend saves for weekly-short-v1.
const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
const meta = { contractVersion: WEEKLY_SHORT, locale: 'zh-Hans' };
const sections = [
  { kind: 'LINE_OF_WEEK', claim: '那个下午很安静。', evidenceRefs: [{ sourceEventId: 'event-0', sourceMemoryId: 'memory-0' }], ...meta },
  { kind: 'MOOD_CURVE', claim: '周一到周四：安静 2 次。', days, evidenceRefs: [], ...meta, points: [
    { date: '2026-09-14', mood: 'QUIET_BLOOM', level: 1, sourceEventId: 'event-0' },
    { date: '2026-09-14', mood: 'SUNNY_BLOOM', level: 3, sourceEventId: 'event-1' },
    { date: '2026-09-17', mood: 'QUIET_BLOOM', level: 1, sourceEventId: 'event-2' },
    { date: '2026-09-30', mood: 'QUIET_BLOOM', level: 1, sourceEventId: 'outside' },
    { date: '2026-09-15', mood: 'UNKNOWN', level: 2, sourceEventId: 'bad-mood' }] },
  { kind: 'SIDE_BY_SIDE', claim: '你画完了一幅素描，也把画分享给了朋友。', evidenceRefs: [], ...meta },
  { kind: 'QUESTION', claim: '走回家的路上，你在想什么？', evidenceRefs: [], ...meta }
];

test('short Weekly sections are read only from the short contract; older reports keep the plain summary', () => {
  const short = plain(shortWeekly({ narrativeSections: sections }));
  assert.equal(short.locale, 'zh-Hans');
  assert.deepEqual(short.line, { text: '那个下午很安静。', eventId: 'event-0' });
  assert.deepEqual(short.curve.points.map(point => point.sourceEventId), ['event-0', 'event-1', 'event-2']);
  assert.equal(short.side, sections[2].claim); assert.equal(short.question, sections[3].claim); assert.equal(short.support, null);
  assert.equal(shortWeekly({ narrativeSections: [{ kind: 'RECENT_MOMENTS', claim: 'Older report.', contractVersion: 'weekly-reflection-v2' }] }), null);
  assert.equal(shortWeekly({ narrativeSections: [...sections, { kind: 'RECENT_MOMENTS', claim: 'Mixed.' }] }), null);
  assert.equal(shortWeekly({ narrativeSections: [] }), null);
  const support = plain(shortWeekly({ narrativeSections: [{ kind: 'SUPPORT_RESOURCES', claim: 'You do not have to face this alone.', contractVersion: WEEKLY_SHORT, locale: 'en' }] }));
  assert.deepEqual({ ...support, support: !!support.support }, { locale: 'en', line: null, curve: null, side: null, question: null, support: true, thenAndNow: null });
});

test('mood curve puts each day in its column, higher moods higher, and joins points in time order', () => {
  const { curve } = shortWeekly({ narrativeSections: sections });
  const { dots, segments } = moodCurveLayout(curve.days, curve.points, 700, 96, 12);
  assert.deepEqual(dots.map(dot => [Math.round(dot.x), dot.y]), [[43, 84], [57, 12], [350, 84]]);
  assert.equal(segments.length, 2);
  assert.ok(Math.abs(segments[1].length - Math.hypot(350 - 57, 72)) < 0.1);
  assert.ok(segments[1].angle > 0 && segments[1].angle < Math.PI / 2);
  // Icons follow the EventsPanel mood order (index 0 is the general Event art).
  assert.deepEqual(plain(PRIMARY_MOODS.map(moodIcon)), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('both languages carry the same labels and seven day initials', () => {
  assert.deepEqual(Object.keys(SHORT_COPY.en), Object.keys(SHORT_COPY['zh-Hans']));
  for (const copy of Object.values(SHORT_COPY)) assert.equal(copy.days.length, 7);
});

test('then and now keeps both quotes and dates; a count appears only with its phrase', () => {
  const then = { sourceEventId: 'event-old', date: '2026-08-30', quote: '那时候一直睡不着觉。' };
  const now = { sourceEventId: 'event-0', date: '2026-09-14', quote: '晚上又睡不着觉，脑子停不下来。' };
  const read = section => plain(shortWeekly({ narrativeSections: [{ kind: 'THEN_AND_NOW', claim: 'x', ...meta, ...section }] })).thenAndNow;
  assert.deepEqual(read({ then, now, count: 3, phrase: '睡不着觉' }), { then, now, count: 3, phrase: '睡不着觉' });
  assert.deepEqual(read({ then, now, count: 3, phrase: null }), { then, now, count: null, phrase: null });
  assert.equal(read({ then: { ...then, date: 'August' }, now }), null);
  assert.equal(shortDate('2026-08-30', 'zh-Hans'), '8月30日'); assert.equal(shortDate('2026-09-04', 'en'), 'Sep 4');
  assert.equal(thenNowCount(3, '睡不着觉', 'zh-Hans'), '过去五周里，你有 3 条记录写到“睡不着觉”。');
});
