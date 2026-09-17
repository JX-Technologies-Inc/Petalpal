import { EMOTION_INFERENCE_PATH } from "./emotion-config.js";
import { normalizePrimaryGardenMood } from "./flower-variant-config.js";

export const MAX_JOURNAL_LENGTH = 2000;

export async function resolveDailyFlowerEmotion({
  mood: rawMood,
  event: rawEvent
}) {
  if (rawEvent !== undefined && typeof rawEvent !== "string") {
    const error = new Error("Journal must be text");
    error.status = 400;
    throw error;
  }
  const event = typeof rawEvent === "string" ? rawEvent.trim() : "";
  if (event.length > MAX_JOURNAL_LENGTH) {
    const error = new Error(`Journal must be ${MAX_JOURNAL_LENGTH} characters or fewer`);
    error.status = 413;
    throw error;
  }
  const selectedMood = normalizePrimaryGardenMood(rawMood);

  if (!selectedMood) {
    const error = new Error("Choose a mood; Journal text is private and is never sent to AI");
    error.status = 400;
    throw error;
  }

  return {
    event,
    mood: selectedMood,
    emotionSource: "USER",
    classification: {
      confidence: null,
      secondaryEmotions: [],
      intensity: null,
      inferencePath: EMOTION_INFERENCE_PATH.NO_AI
    }
  };
}
