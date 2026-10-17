import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.ts";
import { setFirebaseTokenVerifierForTests } from "../../lib/auth.js";
import { logServerError, prismaTransactionErrorKind } from "../../lib/security-log.js";
import { app } from "../../server.js";

const p2028 = (message) => new Prisma.PrismaClientKnownRequestError(message, { code: "P2028", clientVersion: "test" });
const captureErrors = async (fn) => {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try { await fn(); } finally { console.error = original; }
  return calls;
};

test("P2028 transaction errors are classified into a fixed enum; other errors are not", () => {
  assert.equal(prismaTransactionErrorKind(p2028("Transaction API error: Unable to start a transaction in the given time.")), "POOL_WAIT");
  assert.equal(prismaTransactionErrorKind(p2028("Transaction API error: Transaction already closed: A commit cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5012 ms passed since the start of the transaction.")), "TRANSACTION_TIMEOUT");
  assert.equal(prismaTransactionErrorKind(p2028("Transaction API error: Transaction already closed: A query cannot be executed on a committed transaction.")), "TRANSACTION_CLOSED");
  assert.equal(prismaTransactionErrorKind(p2028("Transaction API error: Transaction not found.")), "TRANSACTION_CLOSED");
  assert.equal(prismaTransactionErrorKind(p2028("unrecognised")), "OTHER");
  assert.equal(prismaTransactionErrorKind(Object.assign(new Error("Unable to start a transaction in the given time"), { code: "P2002" })), undefined);
  assert.equal(prismaTransactionErrorKind(undefined), undefined);
});

test("logged P2028 diagnostics carry only the code, enum and numeric timing, never the Prisma message", async () => {
  const calls = await captureErrors(() => logServerError("ctx", p2028("expired transaction journal=private-text"), { transactionElapsedMs: 5012, note: "dropped" }));
  assert.deepEqual(calls, [["ctx", { errorType: "PrismaClientKnownRequestError", code: "P2028", transactionError: "TRANSACTION_TIMEOUT", transactionElapsedMs: 5012 }]]);
});

test("POST /events logs the P2028 kind and Event transaction elapsed time; the response stays generic", async (t) => {
  const originals = { userFindUnique: prisma.user.findUnique, transaction: prisma.$transaction };
  prisma.user.findUnique = async ({ where }) => (where.firebaseUid ? { id: "diag-owner" } : { id: "diag-owner", timezone: "UTC" });
  prisma.$transaction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    throw p2028("Transaction API error: Unable to start a transaction in the given time.");
  };
  setFirebaseTokenVerifierForTests(async () => ({ uid: "firebase-diag", email_verified: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.$transaction = originals.transaction;
    setFirebaseTokenVerifierForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  let response;
  const calls = await captureErrors(async () => {
    response = await fetch(`http://127.0.0.1:${server.address().port}/events`, {
      method: "POST",
      headers: { Authorization: "Bearer diag-token", "Content-Type": "application/json", "Idempotency-Key": "diag-event-0001" },
      body: JSON.stringify({ content: "Synthetic diagnostics note." })
    });
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to create Event" });
  const logged = calls.find(([context]) => context === "POST /events error");
  assert.ok(logged, "the Event failure is logged");
  assert.equal(logged[1].code, "P2028");
  assert.equal(logged[1].transactionError, "POOL_WAIT");
  assert.ok(Number.isInteger(logged[1].transactionElapsedMs) && logged[1].transactionElapsedMs >= 35);
  assert.doesNotMatch(JSON.stringify(calls), /Unable to start|Synthetic diagnostics|diag-token/);
});
