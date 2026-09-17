import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent } from "../../lib/audit-events.js";

test("AuditEvent repository is create-only and allowlisted", async () => {
  const writes = [];
  const client = { auditEvent: { create: async ({ data }) => (writes.push(data), data) } };
  await createAuditEvent({ eventType: "AI_PROCESSING_REVOKED", outcome: "COMPLETED", correlationId: "r1", actorUserId: "u1", targetClass: "ai_consent", actionCode: "AI_CONSENT", email: "private@example.com", token: "secret", metadata: { journal: "private" } }, client);
  assert.deepEqual(writes[0], { eventType: "AI_PROCESSING_REVOKED", outcome: "COMPLETED", correlationId: "r1", actorUserId: "u1", targetClass: "ai_consent", targetSafeId: null, actionCode: "AI_CONSENT", reasonCode: null });
  await assert.rejects(createAuditEvent({ eventType: "UNSAFE", outcome: "COMPLETED", targetClass: "x" }, client), /Invalid audit event/);
  await assert.rejects(createAuditEvent({ eventType: "AI_PROCESSING_REVOKED", outcome: "COMPLETED", targetClass: "x", actionCode: "UPDATE" }, client), /Invalid audit action/);
  assert.equal(Object.keys((await import("../../lib/audit-events.js"))).includes("updateAuditEvent"), false);
  assert.equal(Object.keys((await import("../../lib/audit-events.js"))).includes("deleteAuditEvent"), false);
  assert.equal(Object.keys((await import("../../lib/audit-events.js"))).includes("listAuditEvents"), false);
});
