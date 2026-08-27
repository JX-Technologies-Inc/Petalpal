export const EMOTION_INFERENCE_PATH = Object.freeze({
  NO_AI: "NO_AI",
  LOCAL_CLASSIFIER: "LOCAL_CLASSIFIER",
  FAST_LLM_FALLBACK: "FAST_LLM_FALLBACK",
  DETERMINISTIC_FALLBACK: "DETERMINISTIC_FALLBACK"
});

function boundedNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function getEmotionRoutingConfig(env = process.env) {
  return {
    llmFallbackThreshold: boundedNumber(env.EMOTION_LLM_FALLBACK_THRESHOLD, 0.75),
    ambiguityMargin: boundedNumber(env.EMOTION_CLASSIFIER_AMBIGUITY_MARGIN, 0.2)
  };
}
