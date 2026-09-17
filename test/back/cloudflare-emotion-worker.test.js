import test from "node:test";
import assert from "node:assert/strict";

import worker, { DEFAULT_REPORT_NARRATIVE_MODEL } from "../../cloudflare-worker/src/index.js";

const endpoint = "https://petalpal-emotion-ai.example.workers.dev/v1/emotion";
const reportEndpoint = "https://petalpal-emotion-ai.example.workers.dev/v1/report-narrative";

function reportInput(reportType) {
  const monthly = reportType === "MONTHLY";
  return {
    instructions: ["backend-owned instructions are not forwarded"],
    report: {
      reportType,
      period: {
        periodKey: monthly ? "2026-09" : "2026-09-14",
        periodStartUtc: "2026-09-01T00:00:00.000Z",
        periodEndUtc: monthly ? "2026-10-01T00:00:00.000Z" : "2026-09-22T00:00:00.000Z"
      },
      aggregates: {
        eventCount: monthly ? 3 : 2,
        topTopics: [{ topic: "career", count: 2 }],
        trendSignals: {
          status: "ok",
          currentEventCount: monthly ? 3 : 2,
          previousEventCount: 1,
          eventCountChange: monthly ? 2 : 1,
          importantEventCount: 2,
          topicFrequency: [{ topic: "career", count: 2 }],
          topicChanges: [{ topic: "career", currentCount: 2, previousCount: 1, change: 1 }]
        }
      },
      selectedEvidence: [
        {
          sourceEventId: "event-1",
          sourceMemoryId: "memory-1",
          eventDate: "2026-09-15T12:00:00.000Z",
          summary: "Started a new internship",
          topics: ["career"],
          selectionReason: "SEMANTIC_RELEVANCE",
          theme: "career",
          ignoredPrivateField: "must not reach Workers AI"
        },
        {
          sourceEventId: "event-2",
          sourceMemoryId: "memory-2",
          eventDate: "2026-09-16T12:00:00.000Z",
          summary: "Completed an important exam",
          topics: ["study"],
          selectionReason: "SEMANTIC_RELEVANCE",
          theme: "study"
        },
        ...(monthly ? [{
          sourceEventId: "event-3",
          sourceMemoryId: "memory-3",
          eventDate: "2026-09-20T12:00:00.000Z",
          summary: "Changed teams at the internship",
          topics: ["career"],
          selectionReason: "REPEATED_OR_CHANGING_THEME",
          theme: "career"
        }] : [])
      ],
      allowedSectionKinds: monthly
        ? ["MAJOR_EXPERIENCES", "BROADER_RECURRING_THEMES", "MEANINGFUL_CHANGES_OR_MILESTONES"]
        : ["RECENT_MOMENTS", "RECURRING_THEMES", "NOTABLE_CHANGES"],
      outputContract: { ignoredByWorker: true },
      ignoredDatabaseHandle: "must not reach Workers AI"
    }
  };
}

function reportOutput(reportType) {
  return {
    sections: [{
      kind: reportType === "WEEKLY" ? "RECENT_MOMENTS" : "MAJOR_EXPERIENCES",
      claim: reportType === "WEEKLY" ? "The week included a new internship." : "The month included a new internship.",
      evidenceRefs: [{ sourceEventId: "event-1", sourceMemoryId: "memory-1" }],
      aggregateRefs: ["topTopics"]
    }]
  };
}

test("emotion Worker rejects callers without the shared secret", async () => {
  const response = await worker.fetch(
    new Request(endpoint, {
      method: "POST",
      body: JSON.stringify({ text: "hello" })
    }),
    { RENDER_SHARED_SECRET: "secret" }
  );

  assert.equal(response.status, 401);
});

test("emotion Worker returns a legacy primary fallback plus 21-label secondary emotions", async () => {
  let receivedInput;
  const response = await worker.fetch(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret"
      },
      body: JSON.stringify({ text: "I am excited about today" })
    }),
    {
      RENDER_SHARED_SECRET: "secret",
      AI: {
        run: async (_model, input) => {
          receivedInput = input;
          return {
            response: {
              label: "happy",
              secondaryEmotions: ["gratitude", "love"],
              intensity: 0.77,
              confidence: 0.88
            }
          };
        }
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(receivedInput.response_format.type, "json_schema");
  assert.deepEqual(await response.json(), {
    label: "happy",
    secondaryEmotions: ["gratitude", "love"],
    intensity: 0.77,
    confidence: 0.88,
    model: "@cf/meta/llama-3.1-8b-instruct-fast"
  });
  assert.ok(receivedInput.response_format.json_schema.properties.secondaryEmotions.items.enum.includes("remorse"));
});

for (const { name, response, expectedCode } of [
  {
    name: "AI inference failure",
    response: () => { throw new Error("provider detail"); },
    expectedCode: "AI_RUN_FAILED"
  },
  {
    name: "invalid JSON",
    response: () => ({ response: "not-json" }),
    expectedCode: "JSON_PARSE_FAILED"
  },
  {
    name: "schema validation failure",
    response: () => ({ response: { privateOutput: "must-not-log" } }),
    expectedCode: "SCHEMA_VALIDATION_FAILED"
  }
]) {
  test(`emotion Worker reports sanitized ${name}`, async (t) => {
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args));

    const result = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret"
        },
        body: JSON.stringify({ text: "private journal must-not-log" })
      }),
      {
        RENDER_SHARED_SECRET: "secret",
        AI: { run: response }
      }
    );

    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), {
      error: "Emotion inference failed",
      code: expectedCode
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0].code, expectedCode);
    assert.doesNotMatch(JSON.stringify(logs), /private journal|must-not-log|secret|provider detail/);
  });
}

for (const reportType of ["WEEKLY", "MONTHLY"]) {
  test(`${reportType} report Worker returns structured grounded narrative output`, async () => {
    let receivedModel;
    let receivedInput;
    const response = await worker.fetch(
      new Request(reportEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
        body: JSON.stringify(reportInput(reportType))
      }),
      {
        RENDER_SHARED_SECRET: "secret",
        REPORT_NARRATIVE_MODEL: "@cf/test/report-model",
        AI: {
          async run(model, input) {
            receivedModel = model;
            receivedInput = input;
            return { response: JSON.stringify(reportOutput(reportType)) };
          }
        }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(receivedModel, "@cf/test/report-model");
    assert.equal(receivedInput.response_format.type, "json_schema");
    assert.equal(receivedInput.temperature, 0.2);
    assert.equal(receivedInput.max_tokens, 1024);
    const providerReport = JSON.parse(receivedInput.messages[1].content);
    assert.deepEqual(Object.keys(providerReport), ["reportType", "period", "aggregates", "selectedEvidence", "allowedSectionKinds"]);
    assert.equal(JSON.stringify(providerReport).includes("must not reach Workers AI"), false);
    assert.deepEqual(await response.json(), { ...reportOutput(reportType), model: "@cf/test/report-model" });
  });
}

test("report Worker uses the production model default and rejects malformed input before inference", async () => {
  let calls = 0;
  const valid = await worker.fetch(
    new Request(reportEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
      body: JSON.stringify(reportInput("WEEKLY"))
    }),
    {
      RENDER_SHARED_SECRET: "secret",
      AI: { async run(model) { calls += 1; assert.equal(model, DEFAULT_REPORT_NARRATIVE_MODEL); return { response: reportOutput("WEEKLY") }; } }
    }
  );
  assert.equal(valid.status, 200);

  const invalid = await worker.fetch(
    new Request(reportEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
      body: JSON.stringify({ report: { reportType: "YEARLY" } })
    }),
    { RENDER_SHARED_SECRET: "secret", AI: { async run() { calls += 1; } } }
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls, 1);
});

for (const { name, response, expectedCode } of [
  {
    name: "AI inference failure",
    response: () => { throw new Error("provider detail"); },
    expectedCode: "AI_RUN_FAILED"
  },
  {
    name: "invalid JSON",
    response: () => ({ response: "not-json" }),
    expectedCode: "JSON_PARSE_FAILED"
  },
  {
    name: "schema validation failure",
    response: () => ({ response: { privateOutput: "must-not-log" } }),
    expectedCode: "SCHEMA_VALIDATION_FAILED"
  }
]) {
  test(`report Worker reports sanitized ${name}`, async (t) => {
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args));
    const result = await worker.fetch(
      new Request(reportEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
        body: JSON.stringify(reportInput("WEEKLY"))
      }),
      { RENDER_SHARED_SECRET: "secret", AI: { run: response } }
    );

    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: "Report narrative inference failed", code: expectedCode });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0].code, expectedCode);
    assert.doesNotMatch(JSON.stringify(logs), /Started a new internship|must-not-log|secret|provider detail/);
  });
}
