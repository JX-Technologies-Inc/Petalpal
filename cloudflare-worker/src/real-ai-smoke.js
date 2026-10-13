// Dedicated test entrypoint. Reuses the real provider handlers without queue,
// speech, scheduled or production routes. No production configuration changes.
import worker from './index.js';
const emotion = '@cf/meta/llama-3.1-8b-instruct-fast';
const embedding = '@cf/baai/bge-small-en-v1.5';
const report = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const routes = new Map([['/v1/event-emotion', emotion], ['/v1/embedding', embedding], ['/v1/report-narrative', report]]);
export default {
  async fetch(request, env, ctx) {
    if (env.SMOKE_ONLY !== '1' || env.AI_JOB_QUEUE || env.AI_JOB_EXECUTOR_URL || env.AI_JOB_EXECUTOR_TOKEN ||
        env.REPORT_NARRATIVE_MODEL !== report) return new Response(null, { status: 503 });
    if (!env.RENDER_SHARED_SECRET || request.headers.get('Authorization') !== `Bearer ${env.RENDER_SHARED_SECRET}`) {
      return new Response(null, { status: 401 });
    }
    const path = new URL(request.url).pathname;
    if (path === '/smoke-info' && request.method === 'GET') return Response.json({
      smokeOnly: true, models: [emotion, embedding, report], maxEmotionOutputTokens: 64,
      maxReportOutputTokens: 1024, maxReportMessageBytes: 24000, maxEmbeddingCharacters: 2000
    });
    if (request.method !== 'POST' || !routes.has(path)) return new Response(null, { status: 404 });
    let invoked = false;
    const ai = { async run(model, input) {
      if (invoked || model !== routes.get(path)) throw new Error('SMOKE_MODEL_OR_CALL_LIMIT');
      if (model === embedding) {
        if (input.text?.length !== 1 || typeof input.text[0] !== 'string' || input.text[0].length > 2000) throw new Error('SMOKE_INPUT_LIMIT');
      } else {
        const max = model === emotion ? 64 : 1024;
        const bytes = new TextEncoder().encode(JSON.stringify(input.messages)).length;
        if (!Number.isInteger(input.max_tokens) || input.max_tokens > max || bytes > (model === emotion ? 2000 : 24000)) throw new Error('SMOKE_TOKEN_LIMIT');
      }
      invoked = true;
      return env.AI.run(model, input);
    } };
    return worker.fetch(request, { ...env, AI: ai }, ctx);
  }
};
