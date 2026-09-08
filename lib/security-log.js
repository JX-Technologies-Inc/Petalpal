function safeCode(error) {
  const value = error?.code;
  return typeof value === "string" && /^[A-Z0-9_-]{1,64}$/i.test(value)
    ? value
    : undefined;
}

export function logServerError(context, error, metadata = {}) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) =>
      typeof value === "number" || typeof value === "boolean"
    )
  );
  console.error(context, {
    errorType: error?.name || "Error",
    ...(safeCode(error) ? { code: safeCode(error) } : {}),
    ...safeMetadata
  });
}
