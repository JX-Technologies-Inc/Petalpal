// Evaluation only. No transport, environment access, database, worker or report writer.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { compileGatewaySchema } from '../../lib/ai-gateway-schema.js';
import { gatewayQuote } from '../../lib/ai-gateway-config.js';

export const VERSION = 'prompt-first-reflection-eval-v1';
export const LOCALES = Object.freeze(['en', 'zh-Hans', 'zh-Hant']);
export const TYPES = Object.freeze(['WEEKLY', 'MONTHLY']);
export const LIMITS = Object.freeze({ WEEKLY: { input: 8192, output: 2048, text: 1400 },
  MONTHLY: { input: 16384, output: 4096, text: 3200 } });
const shared = readFileSync(new URL('./prompts/shared-v1.txt', import.meta.url), 'utf8').trim();
export function systemPrompt(type) {
  if (!TYPES.includes(type)) throw Error('EVAL_INVALID_TYPE');
  return shared + '\n\n' + readFileSync(new URL(`./prompts/${type.toLowerCase()}-reflection-prompt-v1.txt`, import.meta.url), 'utf8').trim();
}
export const graphemes = text => [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text.replace(/\s/gu, ''))].length;
const string = maxLength => ({ type: 'string', maxLength });
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['version', 'reportType', 'locale', 'state', 'reason', 'reflection', 'references'],
  properties: {
    version: { type: 'string', enum: [VERSION] }, reportType: { type: 'string', enum: TYPES },
    locale: { type: 'string', enum: LOCALES }, state: { type: 'string', enum: ['reflection', 'insufficient', 'refused'] },
    reason: { type: 'string', enum: ['none', 'insufficient_evidence', 'refusal'] }, reflection: string(16000),
    references: { type: 'array', maxItems: 24, items: { type: 'object', additionalProperties: false,
      required: ['excerpt', 'sources'], properties: { excerpt: { ...string(4000), minLength: 1 },
        sources: { type: 'array', minItems: 1, maxItems: 12, items: string(4) } } } }
  }
};
const { wireSchema, validate } = compileGatewaySchema(SCHEMA);
function requireInput(input) {
  const fail = () => { throw Error('EVAL_INPUT_REJECTED'); };
  if (input?.dataset !== 'synthetic' || !TYPES.includes(input.reportType) || !LOCALES.includes(input.preference?.locale) ||
      typeof input.ownerId !== 'string' || !input.ownerId.startsWith('synthetic-') ||
      input.consent?.ownerId !== input.ownerId || input.consent.aiProcessing !== true ||
      input.consent.personalization !== true || input.consent.memoryEnabled !== true ||
      !Number.isSafeInteger(input.consent.epoch) || input.consent.epoch < 1 ||
      !Array.isArray(input.events) || input.events.length > 12) fail();
  const start = Date.parse(input.start), end = Date.parse(input.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || input.timezone !== 'UTC') fail();
  const ids = new Set(), memories = new Set();
  for (const e of input.events) {
    if (e.kind !== 'EVENT' || e.ownerId !== input.ownerId || e.allowed !== true || e.deleted !== false ||
        typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.memoryId !== 'string' || !e.memoryId || memories.has(e.memoryId) ||
        e.memoryOwnerId !== input.ownerId || e.memorySourceEventId !== e.id || e.memoryType !== 'EVENT' ||
        !Number.isSafeInteger(e.revision) || e.revision < 1 || e.memoryRevision !== e.revision ||
        typeof e.text !== 'string' || !e.text.trim() || e.text.length > 500 || e.memoryText !== e.text ||
        !Number.isFinite(Date.parse(e.updatedAt)) || !Number.isFinite(Date.parse(e.memoryUpdatedAt)) ||
        !Number.isFinite(Date.parse(e.eventDate)) || Date.parse(e.eventDate) < start || Date.parse(e.eventDate) >= end) fail();
    ids.add(e.id); memories.add(e.memoryId);
  }
}
const week = date => {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
};
export function prepareExperiment(input) {
  requireInput(input);
  // This private closure models revision checks for synthetic fixtures only; it is not a DB fence.
  const snapshot = structuredClone(input), type = snapshot.reportType, locale = snapshot.preference.locale;
  const evidence = snapshot.events.map((e, i) => ({ alias: `E${i + 1}`, eventDate: e.eventDate,
    week: week(e.eventDate), text: e.text }));
  const packet = { version: VERSION, promptVersion: `${type.toLowerCase()}-reflection-prompt-v1`,
    reportType: type, locale, period: { start: snapshot.start, end: snapshot.end, timezone: 'UTC' }, evidence };
  const model = type === 'WEEKLY' ? 'claude-sonnet-5-5' : 'claude-opus-5-5';
  const body = { model, system: systemPrompt(type), messages: [{ role: 'user', content: JSON.stringify(packet) }],
    max_tokens: LIMITS[type].output, output_config: { effort: 'low', format: { type: 'json_schema', schema: wireSchema } } };
  // Conservative local estimate, NOT a tokenizer or a guaranteed billing bound.
  const estimatedInputTokens = Buffer.byteLength(JSON.stringify(body)) + 1024;
  if (estimatedInputTokens > LIMITS[type].input) throw Error('EVAL_INPUT_TOO_LARGE');
  const request = { method: 'POST', path: '/anthropic/v1/messages', headers: {
    'Content-Type': 'application/json', 'anthropic-version': '2023-06-01',
    'cf-aig-collect-log': 'false', 'cf-aig-collect-log-payload': 'false', 'cf-aig-skip-cache': 'true',
    'cf-aig-max-attempts': '1', 'cf-aig-request-timeout': '19900'
  }, body };
  function assertCurrent(current) {
    requireInput(current);
    if (!isDeepStrictEqual(snapshot, current)) throw Error('EVAL_SOURCE_CHANGED');
  }
  function evaluate(output, current) {
    assertCurrent(current);
    if (!output || Buffer.byteLength(JSON.stringify(output)) > 65536 || !validate(output) ||
        output.reportType !== type || output.locale !== locale) throw Error('EVAL_RESPONSE_REJECTED');
    if (output.state !== 'reflection') {
      if (output.reflection !== '' || output.references.length ||
          output.reason !== (output.state === 'insufficient' ? 'insufficient_evidence' : 'refusal')) throw Error('EVAL_RESPONSE_REJECTED');
      return { status: output.state, productionEligible: false, factualCorrectness: 'UNVERIFIED', writingQuality: 'NOT_MEASURED' };
    }
    if (output.reason !== 'none' || !output.reflection.trim() || !evidence.length ||
        graphemes(output.reflection) > LIMITS[type].text || !output.references.length) throw Error('EVAL_RESPONSE_REJECTED');
    const aliases = new Map(evidence.map(e => [e.alias, e])), cited = new Set(), spans = [];
    for (const r of output.references) {
      const start = output.reflection.indexOf(r.excerpt), end = start + r.excerpt.length;
      if (!r.excerpt.trim() || start < 0 || output.reflection.indexOf(r.excerpt, start + 1) >= 0 ||
          spans.some(s => start < s.end && end > s.start) || new Set(r.sources).size !== r.sources.length ||
          r.sources.some(a => !aliases.has(a))) throw Error('EVAL_REFERENCES_REJECTED');
      spans.push({ start, end }); r.sources.forEach(a => cited.add(a));
    }
    const citedWeeks = new Set([...cited].map(a => aliases.get(a).week));
    if (type === 'MONTHLY' && evidence.some(e => !citedWeeks.has(e.week))) throw Error('EVAL_COVERAGE_REJECTED');
    // ASCII numeric token screening only: does not prove a number's role, attribution or date meaning.
    const numericTokens = text => text.match(/\d+(?:[.,]\d+)*/g) || [];
    const suppliedNumbers = new Set(evidence.flatMap(e => numericTokens(e.text + ' ' + e.eventDate)));
    const unseenNumbers = [...new Set(numericTokens(output.reflection).filter(n => !suppliedNumbers.has(n)))];
    return { status: 'STRUCTURE_CHECKED_UNVERIFIED_PROSE', productionEligible: false,
      factualCorrectness: 'UNVERIFIED', writingQuality: 'NOT_MEASURED', graphemes: graphemes(output.reflection),
      referencedEvents: cited.size, suppliedEvents: evidence.length, citedWeeks: citedWeeks.size,
      numericScreen: unseenNumbers.length ? 'REVIEW_REQUIRED' : 'NO_UNSEEN_ASCII_NUMBERS', unseenNumbers,
      semanticReviewRequired: ['numbers-and-dates-in-context', 'negation', 'speaker-and-relationships',
        'causation-and-psychology', 'unreferenced-claims', 'locale-and-translation', 'meaningful-week-coverage'] };
  }
  return { request: structuredClone(request), estimatedInputTokens,
    reservation: gatewayQuote({ model, action: `${type}_REPORT`, inputTokens: LIMITS[type].input, maxOutputTokens: LIMITS[type].output }),
    assertCurrent, evaluate };
}
