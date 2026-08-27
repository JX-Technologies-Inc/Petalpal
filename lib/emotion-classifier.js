import { classifyMoodWithScores } from "../moodClassifier.js";
import { EMOTION_INFERENCE_PATH, getEmotionRoutingConfig } from "./emotion-config.js";

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

function validSecondaryEmotions(values, primary, limit) {
  return [...new Set(Array.isArray(values) ? values : [])]
    .filter((label) => SUPPORTED_MOODS.includes(label) && label !== primary)
    .slice(0, limit);
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    secondaryEmotions: validSecondaryEmotions(data.secondaryEmotions, data.label, 2),
    intensity: Number.isFinite(data.intensity) ? Math.max(0, Math.min(1, data.intensity)) : null,
    provider: "CLOUDFLARE_WORKERS_AI",
    model: data.model || "unknown"
  };
}

export function deterministicMood(text) {
  const normalized = String(text || "").toLowerCase();
  if (/happy|great|excited|joy|love|wonderful/.test(normalized)) return "happy";
  if (/sad|cry|grief|lonely|disappointed/.test(normalized)) return "sad";
  if (/stress|angry|anxious|worried|fear|overwhelmed/.test(normalized)) return "stressed";
  if (/tired|exhausted|sleepy|drained/.test(normalized)) return "tired";
  return "calm";
}

export async function classifyEmotion(text, options = {}) {
  const startedAt = Date.now();
  const config = getEmotionRoutingConfig(options.env || process.env);
  const selectedMood = SUPPORTED_MOODS.includes(options.userSelectedMood)
    ? options.userSelectedMood
    : null;
  let localErrorCode = null;

  try {
    const local = await (options.localClassifier || classifyMoodWithScores)(text);
    const valid =
      SUPPORTED_MOODS.includes(local?.label) &&
      Number.isFinite(local?.confidence) && local.confidence >= 0 && local.confidence <= 1 &&
      Number.isFinite(local?.margin) && local.margin >= 0 && local.margin <= 1;
    if (valid && local.confidence >= config.llmFallbackThreshold && local.margin >= config.ambiguityMargin) {
      return {
        label: local.label,
        confidence: local.confidence,
        secondaryEmotions: selectedMood && local.label !== selectedMood ? [local.label] : [],
        intensity: null,
        provider: "LOCAL",
        model: "natural-bayes-mood-classifier",
        inferencePath: EMOTION_INFERENCE_PATH.LOCAL_CLASSIFIER,
        latencyMs: Date.now() - startedAt,
        success: true,
        errorCode: null
      };
    }
    localErrorCode = valid ? "LOCAL_LOW_CONFIDENCE_OR_AMBIGUOUS" : "LOCAL_INVALID_OUTPUT";
  } catch {
    localErrorCode = "LOCAL_CLASSIFIER_FAILED";
  }

  try {
    const fast = await (options.fastClassifier || classifyWithCloudflare)(text, options);
    return {
      ...fast,
      secondaryEmotions: validSecondaryEmotions(fast.secondaryEmotions, selectedMood || fast.label, 2),
      inferencePath: EMOTION_INFERENCE_PATH.FAST_LLM_FALLBACK,
      latencyMs: Date.now() - startedAt,
      success: true,
      errorCode: localErrorCode
    };
  } catch (workerError) {
    return {
      label: selectedMood || deterministicMood(text),
      confidence: null,
      secondaryEmotions: [],
      intensity: null,
      provider: "DETERMINISTIC",
      model: "keyword-fallback-v1",
      inferencePath: EMOTION_INFERENCE_PATH.DETERMINISTIC_FALLBACK,
      latencyMs: Date.now() - startedAt,
      success: true,
      errorCode: workerError.code || localErrorCode || "FAST_LLM_FAILED"
    };
  }
}
