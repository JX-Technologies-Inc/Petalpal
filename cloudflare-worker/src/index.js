const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MOODS = ["happy", "calm", "tired", "sad", "stressed"];

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "Classify the user's emotional tone. Choose one primary PetalPal label, an optional different secondary label (or none), and emotional intensity from 0 to 1. Do not diagnose mental health conditions."
          },
          { role: "user", content: text }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "object",
            properties: {
              label: { type: "string", enum: MOODS },
              secondaryEmotion: { type: "string", enum: ["none", ...MOODS] },
              intensity: { type: "number", minimum: 0, maximum: 1 },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["label", "secondaryEmotion", "intensity", "confidence"],
            additionalProperties: false
          }
        }
      });
      const output = typeof result?.response === "string" ? JSON.parse(result.response) : result?.response;
      if (
        !output ||
        !MOODS.includes(output.label) ||
        !["none", ...MOODS].includes(output.secondaryEmotion) ||
        !Number.isFinite(output.intensity) ||
        !Number.isFinite(output.confidence)
      ) {
        return json({ error: "Model returned invalid structured output" }, 502);
      }
      return json({
        label: output.label,
        secondaryEmotion: output.secondaryEmotion,
        intensity: output.intensity,
        confidence: output.confidence,
        model: MODEL
      });
    } catch {
      return json({ error: "Emotion inference failed" }, 502);
    }
  }
};
