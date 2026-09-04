import {
  LEGACY_PRIMARY_MOODS,
  SECONDARY_EMOTION_LABELS
} from "../../lib/flower-variant-config.js";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function inferenceFailure(code, error) {
  console.error({
    event: "emotion_inference_failed",
    code,
    ...(error ? { errorName: error instanceof Error ? error.name : "UnknownError" } : {})
  });
  return json({ error: "Emotion inference failed", code }, 502);
}

function authorized(request, env) {
  const expected = env.RENDER_SHARED_SECRET;
  return Boolean(expected) && request.headers.get("Authorization") === `Bearer ${expected}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/emotion") return json({ error: "Not found" }, 404);
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 2000) return json({ error: "Text must contain 1-2000 characters" }, 400);

    let result;
    try {
      result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "Classify the user's emotional tone. Choose one legacy primary fallback mood and up to two fine-grained secondary emotions. Secondary emotions must add useful detail. Also return emotional intensity and confidence from 0 to 1. Do not diagnose mental health conditions."
          },
          { role: "user", content: text }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "object",
            properties: {
              label: { type: "string", enum: LEGACY_PRIMARY_MOODS },
              secondaryEmotions: {
                type: "array",
                items: { type: "string", enum: SECONDARY_EMOTION_LABELS },
                maxItems: 2,
                uniqueItems: true
              },
              intensity: { type: "number", minimum: 0, maximum: 1 },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["label", "secondaryEmotions", "intensity", "confidence"],
            additionalProperties: false
          }
        }
      });
    } catch (error) {
      return inferenceFailure("AI_RUN_FAILED", error);
    }

    let output;
    try {
      output = typeof result?.response === "string" ? JSON.parse(result.response) : result?.response;
    } catch (error) {
      return inferenceFailure("JSON_PARSE_FAILED", error);
    }

    if (
      !output ||
      !LEGACY_PRIMARY_MOODS.includes(output.label) ||
      !Array.isArray(output.secondaryEmotions) ||
      output.secondaryEmotions.length > 2 ||
      output.secondaryEmotions.some((label) => !SECONDARY_EMOTION_LABELS.includes(label)) ||
      !Number.isFinite(output.intensity) ||
      !Number.isFinite(output.confidence)
    ) {
      return inferenceFailure("SCHEMA_VALIDATION_FAILED");
    }

    return json({
      label: output.label,
      secondaryEmotions: [...new Set(output.secondaryEmotions)]
        .slice(0, 2),
      intensity: output.intensity,
      confidence: output.confidence,
      model: MODEL
    });
  }
};
