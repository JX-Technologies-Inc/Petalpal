// Direct Anthropic transport adapter for a future separately authorized v2 LIVE run. This module reads no
// environment variables and has no CLI. A trusted operator launcher must inject the key in memory only.
import { isV2LiveGrant } from './acceptance-v2.mjs';

export const ANTHROPIC_ORIGIN = 'https://api.anthropic.com';
export const FUTURE_KEY_VARIABLE = 'PETALPAL_CLAUDE_EVAL_API_KEY';
const ROUTES = Object.freeze({
  'POST /anthropic/v1/messages': '/v1/messages',
  'POST /anthropic/v1/messages/count_tokens': '/v1/messages/count_tokens',
  'GET /anthropic/v1/models/claude-sonnet-5-5': '/v1/models/claude-sonnet-5-5',
  'GET /anthropic/v1/models/claude-opus-5-5': '/v1/models/claude-opus-5-5'
});

export function anthropicV2Transport(apiKey, fetchImpl = globalThis.fetch) {
  if (typeof apiKey !== 'string' || !apiKey || /\s/.test(apiKey) || typeof fetchImpl !== 'function')
    throw Error('V2_ANTHROPIC_TRANSPORT_CONFIG_REJECTED');
  return async (request, { signal, grant } = {}) => {
    if (!isV2LiveGrant(grant)) throw Error('V2_ANTHROPIC_TRANSPORT_LIVE_RUN_REQUIRED');
    const path = ROUTES[`${request?.method} ${request?.path}`];
    if (!path || (request.method === 'POST' ? typeof request.body !== 'string' : request.body !== undefined))
      throw Error('V2_ANTHROPIC_TRANSPORT_ROUTE_REJECTED');
    const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    if (request.method === 'POST') headers['content-type'] = 'application/json';
    const response = await fetchImpl(ANTHROPIC_ORIGIN + path, { method: request.method, headers,
      body: request.body, signal, redirect: 'error' });
    return { status: response.status, body: response.body };
  };
}
