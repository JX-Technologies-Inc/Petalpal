import { nativeFixture, locales, nativeMockResponse } from './native-reflection.js';
import { buildNativeReflectionPackage, validateNativeReflection, nativeTextLength } from '../../lib/native-reflection.js';
import { buildCompositionPackage, validateComposition } from '../../lib/native-composition.js';
export { locales };
export const developmentSources = [
  'I finally fixed the bug today and felt tired but happy.',
  '我用炭笔画了 River Park，比较了两张画的线条，感到平静。',
  'I studied for 35 minutes and felt tired but happy. I read 12 pages.',
  '我把一幅畫分享給一位朋友，和一位朋友聊天，然後休息了。',
  'After work, I felt very tired but grateful. I planned to write a poem.',
  'I cooked dinner, then I rested and felt a little sad.'
];
export function replaceSummary(input, index, summary) {
  const item = input.evidenceSelection.evidence[index]; item.summary = summary;
  input.sourceFence.sources.find(source => source.id === item.sourceEventId).memory.summary = summary;
}
export function compositionFixture(type = 'WEEKLY', locale = 'en', rich = false) {
  const input = nativeFixture(type, locale);
  if (rich && type === 'MONTHLY') {
    for (const [i, day] of [[4, 20], [5, 29]]) {
      const source = structuredClone(input.sourceFence.sources[0]), item = structuredClone(input.evidenceSelection.evidence[0]);
      source.id = `synthetic-${i}`; source.occurredAt = +new Date(`2026-09-${day}T12:00:00Z`);
      source.memory.id = `memory-${i}`; source.memory.sourceEventId = source.id;
      item.sourceEventId = source.id; item.sourceMemoryId = source.memory.id; item.eventDate = new Date(source.occurredAt);
      item.provenance = { sourceEventId: source.id, sourceMemoryId: source.memory.id };
      input.sourceFence.sources.push(source); input.evidenceSelection.evidence.push(item); input.aggregates.eventCount++;
    }
  }
  input.evidenceSelection.evidence.forEach((_, i) => replaceSummary(input, i, developmentSources[i]));
  if (rich && type === 'MONTHLY') {
    const source = structuredClone(input.sourceFence.sources[1]), item = structuredClone(input.evidenceSelection.evidence[1]);
    source.id = 'synthetic-prior'; source.occurredAt = +new Date('2026-08-15T12:00:00Z');
    source.memory.id = 'memory-prior'; source.memory.sourceEventId = source.id;
    item.sourceEventId = source.id; item.sourceMemoryId = source.memory.id; item.eventDate = new Date(source.occurredAt);
    item.provenance = { sourceEventId: source.id, sourceMemoryId: source.memory.id };
    input.sourceFence.sources.push(source); input.evidenceSelection.evidence.push(item);
  }
  // Metadata deliberately carries no theme: recurrence must come from predicates.
  input.evidenceSelection.evidence.forEach(item => { item.topics = []; });
  input.sourceFence.sources.forEach(source => { source.memory.topics = []; });
  return input;
}
export function groupText(packet, props, opening = 0) {
  const g = packet.grammar;
  return g.openings[opening] + props.map((prop, i) => (i ? (props.length === 2 ? g.pair : i === props.length - 1 ? g.final : g.middle) : '') + prop.fragments[0]).join('') + g.end;
}
// Mock authoring only: no production text is rewritten to pass the validator.
export function compositionMockResponse(packet, { includeStats = true, closing = true, variation = 0 } = {}) {
  const facts = packet.propositions.filter(p => ['RECORDED_EPISODE', 'EXACT_RECORD'].includes(p.kind)), g = packet.grammar;
  const split = facts.length > 4 ? [[facts[1], facts[3]], [facts[0], facts[2]], facts.slice(4)]
    : [facts.slice(0, packet.reportType === 'WEEKLY' ? 1 : 2), facts.slice(packet.reportType === 'WEEKLY' ? 1 : 2)];
  const paragraphs = split.filter(group => group.length).map((group, i) => ({ role: i ? 'OBSERVATION' : 'OVERVIEW', refs: group.map(p => p.id),
    text: group.every(p => p.kind === 'RECORDED_EPISODE') ? groupText(packet, group, (i + variation) % 2)
      : group.map(p => p.kind === 'EXACT_RECORD' ? g.quoteStart + p.quote + g.quoteEnd : groupText(packet, [p], (i + variation) % 2)).join(g.gap) }));
  if (facts.length > 4) paragraphs[0].text = paragraphs[0].text.replace(g.openings[variation % 2], g.crossWeek);
  const recurrence = packet.propositions.find(p => p.kind === 'SAMPLE_COMPARISON') || packet.propositions.find(p => p.kind === 'RECORDED_RECURRENCE');
  if (includeStats && recurrence) { paragraphs.at(-1).refs.push(recurrence.id); paragraphs.at(-1).text += g.gap + recurrence.sentences[0]; }
  const invitation = facts.find(p => p.invitationDetails?.length);
  if (closing && invitation) paragraphs.push({ role: 'CLOSING', refs: [invitation.id],
    text: g.invitationStart[variation % 2] + invitation.invitationDetails[0] + g.invitationEnd[variation % 2] });
  return { version: packet.version, reportType: packet.reportType, locale: packet.locale, paragraphs };
}
export function compositionExamplesMarkdown() {
  return '# Native composition v2.1 — authored, validated mock examples\n\nNo Claude inference was run. These examples exercise actual accepted provider text, not measured model quality. All six use mixed-language synthetic sources; their source text is unchanged.\n\n' +
    'Development sources (Weekly uses the first two; Monthly all six, plus a prior-month record with the second source text for the explicit sample comparison):\n\n' + developmentSources.map(s => `- ${s}`).join('\n') + '\n\n' +
    ['WEEKLY', 'MONTHLY'].flatMap(type => locales.map((locale, i) => {
      const input = compositionFixture(type, locale, true), packet = buildCompositionPackage(input).publicPacket;
      const output = compositionMockResponse(packet, { variation: i, includeStats: locale !== 'en' }), result = validateComposition(output, input);
      return `## ${type} / ${locale}\n\n${result.narrative}\n\nLength: ${nativeTextLength(result.narrative)} graphemes excluding whitespace; ${result.narrative.length} UTF-16 units.\n`;
    })).join('\n') + '\n## Same-source comparison with original PR #48 examples\n\n' +
    ['WEEKLY','MONTHLY'].flatMap(type => locales.map(locale => {
      const input = nativeFixture(type, locale), old = validateNativeReflection(nativeMockResponse(buildNativeReflectionPackage(input).publicPacket), input);
      const pkg = buildCompositionPackage(input), result = validateComposition(compositionMockResponse(pkg.publicPacket, { closing: false }), input);
      return `### ${type} / ${locale}\n\nOriginal v2:\n\n${old.narrative}\n\nExpanded v2.1, identical evidence:\n\n${result.narrative}\n\nOnly the complete feeling construction gains native phrasing here. The qualified drawing narratives remain exact quotations; this is not a solved fluency problem.\n`;
    })).join('\n');
}
