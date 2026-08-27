export async function resolveDailyFlowerEmotion({
  mood: rawMood,
  event: rawEvent,
  aiProcessingAllowed,
  classify
}) {
  const event = typeof rawEvent === "string" ? rawEvent.trim().slice(0, 2000) : "";
  const mood = typeof rawMood === "string" ? rawMood.trim().toLowerCase() : "";

  if (mood) {
    return {
      event,
      mood,
      emotionSource: "USER",
      classification: null
    };
  }
  if (!event) {
    const error = new Error("Choose a mood or write an optional journal entry");
    error.status = 400;
    throw error;
  }
  if (!aiProcessingAllowed) {
    const error = new Error(
      "AI mood analysis requires your consent. Choose a mood manually or enable AI processing."
    );
    error.status = 403;
    throw error;
  }

  const classification = await classify(event);
  return {
    event,
    mood: classification.label,
    emotionSource: "MODEL",
    classification
  };
}
