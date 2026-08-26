import { predictMood } from "../moodClassifier.js";

export const SUPPORTED_MOODS = ["happy", "calm", "tired", "sad", "stressed"];

function classifierError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function timeoutMs(env) {
  const parsed = Number(env.AI_REQUEST_TIMEOUT_MS || 3000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

export async function classifyWithCloudflare(text, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const url = String(env.CLOUDFLARE_WORKER_AI_URL || "").replace(/\/$/, "");
  const token = env.CLOUDFLARE_WORKER_AI_TOKEN;
  if (!url || !token) throw classifierError("WORKER_NOT_CONFIGURED", "Cloudflare emotion worker is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(env));
  let response;
  try {
    response = await fetchImpl(`${url}/v1/emotion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw classifierError("WORKER_TIMEOUT", "Cloudflare emotion worker timed out");
    throw classifierError("WORKER_NETWORK_ERROR", "Cloudflare emotion worker is unavailable");
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw classifierError(`WORKER_HTTP_${response.status}`, data?.error || "Cloudflare emotion worker failed");
  if (!data || !SUPPORTED_MOODS.includes(data.label) || !Number.isFinite(data.confidence)) {
    throw classifierError("WORKER_INVALID_OUTPUT", "Cloudflare emotion worker returned invalid output");
  }
  return {
    label: data.label,
    confidence: Math.max(0, Math.min(1, data.confidence)),
    provider: "CLOUDFLARE_WORKERS_AI",
    model: data.model || "unknown"
  };
}

function deterministicMood(text) {
  const normalized = String(text || "").toLowerCase();
  if (/happy|great|excited|joy|love|wonderful/.test(normalized)) return "happy";
  if (/sad|cry|grief|lonely|disappointed/.test(normalized)) return "sad";
  if (/stress|angry|anxious|worried|fear|overwhelmed/.test(normalized)) return "stressed";
  if (/tired|exhausted|sleepy|drained/.test(normalized)) return "tired";
  return "calm";
}

export async function classifyEmotion(text, options = {}) {
  const startedAt = Date.now();
  try {
    const result = await classifyWithCloudflare(text, options);
    return { ...result, latencyMs: Date.now() - startedAt, success: true, errorCode: null };
  } catch (workerError) {
    try {
      const label = await (options.localPredictor || predictMood)(text);
      return {
        label: SUPPORTED_MOODS.includes(label) ? label : deterministicMood(text),
        confidence: null,
        provider: "LOCAL",
        model: "natural-mood-classifier",
        latencyMs: Date.now() - startedAt,
        success: true,
        errorCode: workerError.code || "WORKER_ERROR"
      };
    } catch {
      return {
        label: deterministicMood(text),
        confidence: null,
        provider: "DETERMINISTIC",
        model: "keyword-fallback-v1",
        latencyMs: Date.now() - startedAt,
        success: true,
        errorCode: `${workerError.code || "WORKER_ERROR"}_LOCAL_FAILED`
      };
    }
  }
}
