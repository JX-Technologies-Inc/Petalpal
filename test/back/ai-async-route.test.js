import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../../server.js";
import prisma from "../../lib/prisma.js";

test("internal executor rejects Firebase and invalid tokens before job lookup", async (t) => {
  const previousToken = process.env.AI_JOB_EXECUTOR_TOKEN;
  const previousMode = process.env.AI_ASYNC_EXECUTION_MODE;
  process.env.AI_JOB_EXECUTOR_TOKEN = "dedicated-test-executor-token";
  process.env.AI_ASYNC_EXECUTION_MODE = "manual";
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousToken === undefined) delete process.env.AI_JOB_EXECUTOR_TOKEN;
    else process.env.AI_JOB_EXECUTOR_TOKEN = previousToken;
    if (previousMode === undefined) delete process.env.AI_ASYNC_EXECUTION_MODE;
    else process.env.AI_ASYNC_EXECUTION_MODE = previousMode;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (token) => fetch(`${base}/internal/ai-jobs/dispatchable`, {
    headers: token ? { Authorization: token } : {}
  });
  assert.equal((await request()).status, 401);
  assert.equal((await request("Bearer firebase-user-token")).status, 401);
  const authorized = await request("Bearer dedicated-test-executor-token");
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), { jobs: [] });
});

test("authenticated executor refuses a job outside the shadow owner", async (t) => {
  const previous = {
    token: process.env.AI_JOB_EXECUTOR_TOKEN,
    mode: process.env.AI_ASYNC_EXECUTION_MODE,
    owner: process.env.AI_ASYNC_SHADOW_OWNER_ID,
    startedAt: process.env.AI_ASYNC_SHADOW_STARTED_AT,
    findUnique: prisma.aiJob.findUnique
  };
  process.env.AI_JOB_EXECUTOR_TOKEN = "dedicated-test-executor-token";
  process.env.AI_ASYNC_EXECUTION_MODE = "shadow";
  process.env.AI_ASYNC_SHADOW_OWNER_ID = "approved-test-owner";
  process.env.AI_ASYNC_SHADOW_STARTED_AT = "2026-09-27T00:00:00Z";
  prisma.aiJob.findUnique = async () => ({
    id: "cmforeignjob0001", ownerId: "another-owner", createdAt: new Date(), jobType: "MEMORY_EXTRACTION", status: "PENDING"
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    prisma.aiJob.findUnique = previous.findUnique;
    for (const [key, value] of [["AI_JOB_EXECUTOR_TOKEN", previous.token],
      ["AI_ASYNC_EXECUTION_MODE", previous.mode], ["AI_ASYNC_SHADOW_OWNER_ID", previous.owner],
      ["AI_ASYNC_SHADOW_STARTED_AT", previous.startedAt]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/internal/ai-jobs/cmforeignjob0001/execute`, {
    method: "POST",
    headers: { Authorization: "Bearer dedicated-test-executor-token", "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { outcome: "NOT_SELECTED" });
});
