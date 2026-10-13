import { PrismaAiCostGate } from "./ai-cost-gate.js";
import { gatewayError, gatewayModel, gatewayQuote, GATEWAY_TASK_LIMITS, readGatewayConfig } from "./ai-gateway-config.js";
import { compileGatewaySchema } from "./ai-gateway-schema.js";

const MAX_RESPONSE_BYTES = 512 * 1024, MAX_JSON_BYTES = 32 * 1024;
async function boundedJson(response, signal) {
  if (!response.body || !/application\/json/i.test(response.headers.get("content-type") || "")) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED"); }
  finally { signal.removeEventListener("abort", cancel); cancel(); }
}
function normalizeResponse(raw, provider, model) {
  if (!raw || raw.model !== model) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
  let text, inputTokens, outputTokens, cachedInputTokens = 0;
  if (provider === "ANTHROPIC") {
    if (raw.type !== "message" || raw.role !== "assistant" || raw.stop_reason !== "end_turn" || !Array.isArray(raw.content) || raw.content.some(b => !b || typeof b !== "object")) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
    const blocks = raw.content.filter(b => b.type === "text");
    if (blocks.length !== 1 || raw.content.some(b => !["text", "thinking", "redacted_thinking"].includes(b.type))) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
    text = blocks[0].text;
    // No prompt-cache writes are requested; nevertheless include any reported cache usage.
    cachedInputTokens = raw.usage?.cache_read_input_tokens ?? 0;
    inputTokens = raw.usage?.input_tokens;
    const writes = raw.usage?.cache_creation_input_tokens ?? 0;
    if (![inputTokens, writes, cachedInputTokens].every(v => Number.isSafeInteger(v) && v >= 0)) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
    inputTokens += writes + cachedInputTokens;
    outputTokens = raw.usage?.output_tokens;
  } else {
    if (raw.status !== "completed" || raw.error || raw.incomplete_details || !Array.isArray(raw.output) || raw.output.some(b => !b || typeof b !== "object")) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
    const messages = raw.output.filter(b => b.type === "message");
    if (messages.length !== 1 || raw.output.some(b => !["message", "reasoning"].includes(b.type)) ||
        messages[0].role !== "assistant" || messages[0].status !== "completed" || !Array.isArray(messages[0].content) ||
        messages[0].content.length !== 1 || !messages[0].content[0] || messages[0].content[0].type !== "output_text") throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
    text = messages[0].content[0].text;
    inputTokens = raw.usage?.input_tokens;
    outputTokens = raw.usage?.output_tokens; // Includes reasoning tokens; never use visible text length.
    cachedInputTokens = raw.usage?.input_tokens_details?.cached_tokens ?? 0;
  }
  if (![inputTokens, outputTokens, cachedInputTokens].every(v => Number.isSafeInteger(v) && v >= 0) || cachedInputTokens > inputTokens ||
      typeof text !== "string" || Buffer.byteLength(text) > MAX_JSON_BYTES) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
  try { return { data: JSON.parse(text), usage: { inputTokens, outputTokens, cachedInputTokens } }; }
  catch { throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED"); }
}

// Phase 1 building block only. No server/worker route imports or selects it.
// authorize and validateOutput are trusted server policies, never request-body callbacks.
export class CloudflareAiGateway {
  #env; #fetch; #authorize; #gate;
  constructor({ prisma, env = process.env, fetchImpl = fetch, authorize } = {}) {
    const names = ["AI_GATEWAY_ENABLED", "AI_GATEWAY_ANTHROPIC_ENABLED", "AI_GATEWAY_OPENAI_ENABLED",
      "CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID", "CLOUDFLARE_AI_GATEWAY_ID", "CLOUDFLARE_AI_GATEWAY_TOKEN",
      "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AI_USER_DAILY_USD_LIMIT", "AI_USER_MONTHLY_USD_LIMIT",
      "AI_GLOBAL_DAILY_USD_LIMIT", "AI_GLOBAL_MONTHLY_USD_LIMIT", "AI_ANTHROPIC_MONTHLY_USD_LIMIT", "AI_OPENAI_MONTHLY_USD_LIMIT",
      "AI_USER_DAILY_CALL_LIMIT", "AI_GLOBAL_DAILY_CALL_LIMIT", "AI_PROVIDER_DAILY_CALL_LIMIT",
      ...Object.keys(GATEWAY_TASK_LIMITS).map(action => `AI_${action}_DAILY_LIMIT`)];
    this.#env = Object.fromEntries(names.map(name => [name, env[name]])); // Never retain unrelated secrets.
    this.#fetch = fetchImpl;
    this.#authorize = authorize;
    this.#gate = new PrismaAiCostGate(prisma, { env: this.#env });
  }
  async generate({ identity, action, key, job = null, workerId = null, eventId = null, model, instructions, input, schema,
    validateOutput, maxOutputTokens, timeoutMs, signal, fallback = false, maxAttempts = 1 } = {}) {
    const spec = gatewayModel(model, action);
    const config = readGatewayConfig(this.#env, spec.provider);
    if (fallback !== false || maxAttempts !== 1) throw gatewayError("AI_GATEWAY_REPLAY_BLOCKED");
    if (typeof this.#authorize !== "function" || typeof validateOutput !== "function" ||
        typeof instructions !== "string" || !instructions.trim() || instructions.length > 4000 ||
        !input || typeof input !== "object" || Array.isArray(input) || typeof this.#fetch !== "function") throw gatewayError("AI_GATEWAY_INVALID_INPUT");
    const limits = GATEWAY_TASK_LIMITS[action];
    maxOutputTokens ??= limits.output; timeoutMs ??= limits.timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > limits.timeoutMs) throw gatewayError("AI_GATEWAY_INVALID_INPUT");
    const { wireSchema, validate } = compileGatewaySchema(schema);
    let content;
    try { content = JSON.stringify(input); } catch { throw gatewayError("AI_GATEWAY_INVALID_INPUT"); }
    if (typeof content !== "string" || content.length > 20000) throw gatewayError("AI_GATEWAY_INVALID_INPUT");
    // Minimized input must be constructed by the future Event/report integration.
    // No client object is forwarded implicitly: only these explicit fields enter the request.
    const body = spec.provider === "ANTHROPIC" ? {
      model, system: instructions, messages: [{ role: "user", content }], max_tokens: maxOutputTokens,
      output_config: { effort: "low", format: { type: "json_schema", schema: wireSchema } }
    } : {
      model, instructions, input: [{ role: "user", content }], max_output_tokens: maxOutputTokens,
      reasoning: { effort: "low" }, store: false, stream: false,
      text: { format: { type: "json_schema", name: "petalpal_structured", strict: true, schema: wireSchema } }
    };
    const serialized = JSON.stringify(body);
    // Conservative byte-based admission, not an exact provider tokenizer or billing guarantee.
    // Includes serialized schema/instructions plus reserved framing headroom.
    const quote = gatewayQuote({ model, action, inputTokens: Buffer.byteLength(serialized) + 1024, maxOutputTokens });
    const context = { identity: { userId: identity?.userId }, action, provider: spec.provider, model,
      job: job ? { ...job } : null, workerId, eventId, key };
    async function authorized(policy, phase) {
      try { if (await policy({ ...context, phase }) === true) return; } catch {}
      throw gatewayError("AI_GATEWAY_FORBIDDEN", phase === "after" ? "RESPONSE_REJECTED" : "NOT_DISPATCHED");
    }
    await authorized(this.#authorize, "before");
    if (signal?.aborted) throw gatewayError("AI_GATEWAY_FORBIDDEN");
    const reservation = await this.#gate.reserve({ ...context, gateway: quote });
    await this.#gate.checkGatewayConsent({ ...context, consentUpdatedAt: reservation.consentUpdatedAt });
    await authorized(this.#authorize, "dispatch");
    if (signal?.aborted) throw gatewayError("AI_GATEWAY_FORBIDDEN");
    const headers = {
      "Content-Type": "application/json", "cf-aig-authorization": `Bearer ${config.token}`,
      "cf-aig-collect-log": "false", "cf-aig-collect-log-payload": "false", "cf-aig-skip-cache": "true",
      "cf-aig-max-attempts": "1", "cf-aig-request-timeout": String(Math.max(1, timeoutMs - 100))
    };
    if (spec.provider === "ANTHROPIC") Object.assign(headers, { "x-api-key": config.key, "anthropic-version": "2023-06-01" });
    else headers.Authorization = `Bearer ${config.key}`;
    const path = spec.provider === "ANTHROPIC" ? "/anthropic/v1/messages" : "/openai/responses";
    const controller = new AbortController(); let timer, abortListener;
    const aborted = new Promise((_, reject) => {
      abortListener = () => { controller.abort(); reject(gatewayError("AI_GATEWAY_TIMEOUT", "AMBIGUOUS")); };
      signal?.addEventListener("abort", abortListener, { once: true });
      timer = setTimeout(abortListener, timeoutMs);
    });
    try {
      return await Promise.race([aborted, (async () => {
        let response;
        try { response = await this.#fetch(`${config.baseUrl}${path}`, { method: "POST", headers, body: serialized, signal: controller.signal, redirect: "error" }); }
        catch { throw gatewayError("AI_GATEWAY_TRANSPORT_FAILED", "AMBIGUOUS"); }
        if (!response.ok) {
          void response.body?.cancel().catch(() => {}); // Never parse or log provider error bodies.
          const code = response.status === 429 ? "AI_GATEWAY_RATE_LIMITED" : [401, 403].includes(response.status) ? "AI_GATEWAY_PROVIDER_AUTH_FAILED" : "AI_GATEWAY_PROVIDER_FAILED";
          throw gatewayError(code, "AMBIGUOUS");
        }
        const result = normalizeResponse(await boundedJson(response, controller.signal), spec.provider, model);
        await this.#gate.recordGatewayUsage({ ...reservation, usage: result.usage });
        if (!validate(result.data)) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
        try { if (await validateOutput(result.data) !== true) throw Error(); }
        catch { throw gatewayError("AI_GATEWAY_GROUNDING_FAILED", "RESPONSE_REJECTED"); }
        if (result.usage.inputTokens > quote.inputTokens || result.usage.outputTokens > maxOutputTokens) throw gatewayError("AI_GATEWAY_INVALID_OUTPUT", "RESPONSE_REJECTED");
        await this.#gate.checkGatewayConsent({ ...context, consentUpdatedAt: reservation.consentUpdatedAt });
        await authorized(this.#authorize, "after");
        if (signal?.aborted || controller.signal.aborted) throw gatewayError("AI_GATEWAY_TIMEOUT", "AMBIGUOUS");
        return { ...result, provider: spec.provider, model, reservedNanoUsd: quote.reservedNanoUsd };
      })()]);
    } finally {
      clearTimeout(timer); signal?.removeEventListener("abort", abortListener);
    }
  }
}
