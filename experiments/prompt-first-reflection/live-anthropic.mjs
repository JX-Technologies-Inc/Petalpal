// Direct Anthropic API transport for the single approved LIVE acceptance run (synthetic fixtures only; no database,
// user Events or report persistence). The key is read once from the trusted runtime, held only in this closure,
// sent only as the x-api-key header to api.anthropic.com, and never logged, returned or written to the ledger.
import { fileURLToPath } from 'node:url';
import { isLiveGrant, liveLedgerPath, runAcceptance } from './acceptance.mjs';

export const ANTHROPIC_ORIGIN = 'https://api.anthropic.com';
export const KEY_VARIABLE = 'PETALPAL_CLAUDE_EVAL_API_KEY';
// Runner routes -> official Messages, token-counting and Models endpoints. Nothing else is forwarded.
const ROUTES = Object.freeze({
  'POST /anthropic/v1/messages': '/v1/messages',
  'POST /anthropic/v1/messages/count_tokens': '/v1/messages/count_tokens',
  'GET /anthropic/v1/models/claude-sonnet-5-5': '/v1/models/claude-sonnet-5-5',
  'GET /anthropic/v1/models/claude-opus-5-5': '/v1/models/claude-opus-5-5'
});

export function anthropicTransport(apiKey, fetchImpl = globalThis.fetch) {
  if (typeof apiKey !== 'string' || !apiKey || /\s/.test(apiKey) || typeof fetchImpl !== 'function') {
    throw Error('ANTHROPIC_TRANSPORT_CONFIG_REJECTED');
  }
  return async (request, { signal, grant } = {}) => {
    if (!isLiveGrant(grant)) throw Error('ANTHROPIC_TRANSPORT_LIVE_RUN_REQUIRED');
    const path = ROUTES[`${request?.method} ${request?.path}`];
    if (!path || (request.method === 'POST' ? typeof request.body !== 'string' : request.body !== undefined)) {
      throw Error('ANTHROPIC_TRANSPORT_ROUTE_REJECTED');
    }
    const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    if (request.method === 'POST') headers['content-type'] = 'application/json';
    // redirect:'error' keeps the key from following a redirect to any other origin.
    const response = await fetchImpl(ANTHROPIC_ORIGIN + path, { method: request.method, headers, body: request.body,
      signal, redirect: 'error' });
    return { status: response.status, body: response.body };
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw Error('No arguments are supported');
  const apiKey = process.env[KEY_VARIABLE];
  delete process.env[KEY_VARIABLE]; // Child processes (the git source pin) never inherit the key.
  const summary = await runAcceptance({ transport: anthropicTransport(apiKey) });
  console.log(JSON.stringify({ ...summary, ledger: liveLedgerPath() }, null, 2));
}
