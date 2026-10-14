// Offline v2 prompt revision. Reuses v1 admission, evidence packet, schema, source fence and evaluator unchanged.
import { readFileSync } from 'node:fs';
import { LIMITS, LOCALES, SCHEMA, TYPES, VERSION, graphemes, prepareExperiment as prepareV1 } from './experiment.mjs';

export { LIMITS, LOCALES, SCHEMA, TYPES, VERSION, graphemes };
export const PROMPT_REVISION = 'v2';
const shared = readFileSync(new URL('./prompts-v2/shared-v2.txt', import.meta.url), 'utf8').trim();
export function systemPromptV2(type) {
  if (!TYPES.includes(type)) throw Error('EVAL_INVALID_TYPE');
  return shared + '\n\n' + readFileSync(new URL(`./prompts-v2/${type.toLowerCase()}-reflection-prompt-v2.txt`, import.meta.url), 'utf8').trim();
}
export function prepareExperimentV2(input) {
  const prepared = prepareV1(input), request = prepared.request;
  const packet = JSON.parse(request.body.messages[0].content), type = packet.reportType;
  packet.promptVersion = `${type.toLowerCase()}-reflection-prompt-v2`;
  request.body.system = systemPromptV2(type);
  request.body.messages[0].content = JSON.stringify(packet);
  const estimatedInputTokens = Buffer.byteLength(JSON.stringify(request.body)) + 1024;
  if (estimatedInputTokens > LIMITS[type].input) throw Error('EVAL_INPUT_TOO_LARGE');
  return { ...prepared, request, estimatedInputTokens };
}
