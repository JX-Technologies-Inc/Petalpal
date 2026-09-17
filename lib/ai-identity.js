export function requireAiIdentity(identity) {
  const userId = identity?.userId;
  if (typeof userId !== "string" || !userId.trim()) {
    const error = new Error("Authenticated owner identity is required");
    error.code = "AI_AUTH_REQUIRED";
    throw error;
  }
  return userId;
}

export function assertOwnerIdentity(identity, ownerId) {
  const authenticatedUserId = requireAiIdentity(identity);
  if (ownerId !== undefined && ownerId !== authenticatedUserId) {
    const error = new Error("AI resource does not belong to the authenticated owner");
    error.code = "AI_FORBIDDEN";
    throw error;
  }
  return authenticatedUserId;
}
