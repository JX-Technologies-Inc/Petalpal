import prisma from "./prisma.js";

const eventTypes = new Set([
  "ACCOUNT_DELETION_REQUESTED", "ACCOUNT_DELETION_COMPLETED", "ACCOUNT_DELETION_DENIED",
  "AI_PROCESSING_GRANTED", "AI_PROCESSING_REVOKED", "AI_CONSENT_OPTIONS_CHANGED"
]);
const outcomes = new Set(["REQUESTED", "COMPLETED", "DENIED"]);
const actionCodes = new Set(["ACCOUNT_DELETION", "AI_CONSENT"]);
const reasonCodes = new Set(["OWNER_MISMATCH", "AUDIT_WRITE_FAILED"]);

function bounded(value, max = 128) {
  return value === undefined || value === null ? null : typeof value === "string" && value.length <= max ? value : null;
}

export async function createAuditEvent(input, client = prisma) {
  if (!input || !eventTypes.has(input.eventType) || !outcomes.has(input.outcome)) throw new Error("Invalid audit event");
  const targetClass = bounded(input.targetClass, 64);
  if (!targetClass) throw new Error("Invalid audit target");
  const actionCode = bounded(input.actionCode, 64);
  const reasonCode = bounded(input.reasonCode, 64);
  if (actionCode && !actionCodes.has(actionCode)) throw new Error("Invalid audit action");
  if (reasonCode && !reasonCodes.has(reasonCode)) throw new Error("Invalid audit reason");
  return client.auditEvent.create({
    data: {
      eventType: input.eventType,
      outcome: input.outcome,
      correlationId: bounded(input.correlationId),
      actorUserId: bounded(input.actorUserId),
      targetClass,
      targetSafeId: bounded(input.targetSafeId),
      actionCode,
      reasonCode
    }
  });
}
