// Offline v2 preparation only. No transport, external input, credential, database or send mode.
import { fileURLToPath } from 'node:url';
import { fixture, scenarios } from './fixtures.mjs';
import { LOCALES, TYPES, prepareExperimentV2 } from './experiment-v2.mjs';
export function prepareAllV2() {
  return scenarios.flatMap(s => TYPES.flatMap(type => LOCALES.map(locale => {
    const e = prepareExperimentV2(fixture(s, type, locale));
    return { scenario: s.id, type, locale, origin: 'PREPARED_V2_NOT_SENT', request: e.request,
      estimatedInputTokens: e.estimatedInputTokens, reservedNanoUsd: e.reservation.reservedNanoUsd };
  })));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw Error('No arguments are supported; no send mode');
  const cases = prepareAllV2();
  console.log(JSON.stringify({ promptRevision: 'v2', scenarios: scenarios.length, cases: cases.length, providerCalls: 0,
    maximumEstimatedInputTokens: Math.max(...cases.map(c => c.estimatedInputTokens)),
    fullMatrixReservationUsd: cases.reduce((n, c) => n + c.reservedNanoUsd, 0) / 1e9 }, null, 2));
}
