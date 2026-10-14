// No send mode and no external input. Emits only committed synthetic fixtures.
import { fileURLToPath } from 'node:url';
import { scenarios, fixture } from './fixtures.mjs';
import { prepareExperiment, TYPES, LOCALES } from './experiment.mjs';
export function prepareAll() {
  return scenarios.flatMap(s => TYPES.flatMap(type => LOCALES.map(locale => {
    const e = prepareExperiment(fixture(s, type, locale));
    return { scenario: s.id, type, locale, origin: 'PREPARED_NOT_SENT', request: e.request,
      estimatedInputTokens: e.estimatedInputTokens, reservedNanoUsd: e.reservation.reservedNanoUsd };
  })));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--requests')) throw Error('Only --requests is supported; no send mode');
  const cases = prepareAll();
  console.log(JSON.stringify(process.argv[2] ? cases : { scenarios: scenarios.length, cases: cases.length,
    providerCalls: 0, maximumEstimatedInputTokens: Math.max(...cases.map(c => c.estimatedInputTokens)),
    fullMatrixReservationUsd: cases.reduce((n, c) => n + c.reservedNanoUsd, 0) / 1e9 }, null, 2));
}
