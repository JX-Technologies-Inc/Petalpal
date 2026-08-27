import test from "node:test";
import assert from "node:assert/strict";

import { resolveDailyFlowerEmotion } from "../../lib/daily-flower-input.js";

test("event plus a manual mood always plants without invoking AI", async () => {
  let classifierCalled = false;
  const result = await resolveDailyFlowerEmotion({
    event: "I presented my project today",
    mood: "happy",
    aiProcessingAllowed: false,
    classify: async () => {
      classifierCalled = true;
      throw new Error("AI must not run for a manual mood");
    }
  });

  assert.equal(classifierCalled, false);
  assert.deepEqual(result, {
    event: "I presented my project today",
    mood: "happy",
    emotionSource: "USER",
    classification: null
  });
});

test("a manual mood works without journal text or AI consent", async () => {
  const result = await resolveDailyFlowerEmotion({
    event: "",
    mood: "CALM",
    aiProcessingAllowed: false,
    classify: async () => {
      throw new Error("not expected");
    }
  });
  assert.equal(result.mood, "calm");
  assert.equal(result.event, "");
  assert.equal(result.emotionSource, "USER");
});

test("journal-only detection requires consent", async () => {
  await assert.rejects(
    resolveDailyFlowerEmotion({
      event: "A complicated day",
      mood: "",
      aiProcessingAllowed: false,
      classify: async () => ({ label: "stressed" })
    }),
    (error) => error.status === 403
  );
});

test("journal-only detection uses the classifier when consent is present", async () => {
  const result = await resolveDailyFlowerEmotion({
    event: "I am exhausted",
    mood: "",
    aiProcessingAllowed: true,
    classify: async () => ({
      label: "tired",
      secondaryEmotion: null,
      intensity: 0.8
    })
  });
  assert.equal(result.mood, "tired");
  assert.equal(result.emotionSource, "MODEL");
});
