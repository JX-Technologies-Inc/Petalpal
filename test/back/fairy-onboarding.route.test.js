import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { app } from "../../server.js";

const originals = {
  userFindUnique: prisma.user.findUnique,
  userCreate: prisma.user.create,
  fairyStateFindUnique: prisma.fairyState.findUnique,
  fairyStateUpsert: prisma.fairyState.upsert
};

async function api(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer owner-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test("onboarding integrates trusted Fairy events", async (t) => {
  setFirebaseTokenVerifierForTests(async () => ({
    uid: "owner-firebase",
    email: "owner@example.com",
    email_verified: true
  }));

  const httpServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => httpServer.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  t.after(async () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.user.create = originals.userCreate;
    prisma.fairyState.findUnique = originals.fairyStateFindUnique;
    prisma.fairyState.upsert = originals.fairyStateUpsert;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  await t.test("new profile persists and returns FIRST_LOGIN", async () => {
    let createData;
    prisma.user.findUnique = async () => null;
    prisma.user.create = async ({ data }) => {
      createData = data;
      return { ...data, id: "owner-1", accountId: "PP00000001" };
    };

    const result = await api(baseUrl, "/auth/session", { name: "Bloom" });

    assert.equal(result.status, 200);
    assert.equal(createData.fairyState.create.lastEvent, "FIRST_LOGIN");
    assert.deepEqual(result.body.fairyEvent, {
      code: "FIRST_LOGIN",
      dialogueKey: "fairy.first_login",
      actionKey: "FAIRY_APPEARS"
    });
  });

  await t.test("client-provided lastEvent cannot overwrite server state", async () => {
    let updateData;
    const existing = {
      userId: "owner-1",
      onboardingStep: "EMPTY_GARDEN",
      onboardingCompleted: false,
      lastEvent: "FIRST_LOGIN",
      unlockedFeatures: []
    };
    prisma.user.findUnique = async () => ({ id: "owner-1" });
    prisma.fairyState.findUnique = async () => existing;
    prisma.fairyState.upsert = async ({ update }) => {
      updateData = update;
      return { ...existing, ...update };
    };

    const response = await fetch(`${baseUrl}/users/owner-1/fairy-state`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer owner-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        onboardingStep: "MOOD_SELECTION",
        lastEvent: "CLIENT_CHOSEN_EVENT"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(updateData, "lastEvent"), false);
    assert.equal(body.lastEvent, "FIRST_LOGIN");
  });
});
