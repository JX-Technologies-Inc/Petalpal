import test from "node:test";
import assert from "node:assert/strict";

import { classifyMoodWithScores } from "../../moodClassifier.js";

test("Natural scores are normalized only for routing and include a top-label margin", async () => {
  const result = await classifyMoodWithScores("I feel happy and excited today");
  const sum = result.scores.reduce((total, item) => total + item.score, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(result.confidence, result.scores[0].score);
  assert.equal(result.margin, result.scores[0].score - result.scores[1].score);
});
