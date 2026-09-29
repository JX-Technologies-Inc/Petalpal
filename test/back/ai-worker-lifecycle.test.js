import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";

import { AiJobWorker } from "../../lib/ai-worker.js";

test("an idle worker keeps polling without accumulating shutdown listeners", async () => {
  const controller = new AbortController();
  let polls = 0;
  const worker = new AiJobWorker({
    repository: { async claimNext() { polls += 1; return null; } },
    handlers: {}, pollIntervalMs: 5
  });
  const running = worker.start({ signal: controller.signal });
  try {
    for (let attempt = 0; polls < 10 && attempt < 100; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(polls >= 10);
    assert.ok(getEventListeners(controller.signal, "abort").length <= 1);
  } finally {
    controller.abort();
    await running;
  }
});

test("consent cancellation during a heartbeat does not retry the job", async () => {
  let failed = false;
  let cancelled = false;
  const worker = new AiJobWorker({
    repository: {
      async claimNext() { return { id: "job-1", jobType: "MEMORY_EXTRACTION" }; },
      async renewLease() { return { count: 0 }; },
      async cancelClaimed() { cancelled = true; return true; },
      async markFailed() { failed = true; }
    },
    handlers: { MEMORY_EXTRACTION: async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return { status: "CONSENT_INELIGIBLE" };
    } },
    leaseMs: 1_000, logger: { error() {} }
  });
  const result = await worker.runOnce();
  assert.equal(result.skipped, true);
  assert.equal(cancelled, true);
  assert.equal(failed, false);
});
