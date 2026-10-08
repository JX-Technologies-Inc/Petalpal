import { securityMetrics } from './security-metrics.js';

function safeCode(error) {
  const value = error?.code;
  return typeof value === "string" && /^[A-Z0-9_-]{1,64}$/i.test(value)
    ? value
    : undefined;
}

let previousMetrics = securityMetrics.snapshot();
let metricsTimer;
export function flushSecurityMetrics() {
  try {
    const counters = securityMetrics.snapshot();
    if (!Object.keys(counters).some(name => counters[name] !== previousMetrics[name])) return;
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), eventType: 'security_metrics', counters }));
    previousMetrics = counters;
  } catch { /* Logging failure must not affect protected operations. */ }
}

export function startSecurityMetricsLogging() {
  if (!metricsTimer) {
    metricsTimer = setInterval(flushSecurityMetrics, 60_000);
    metricsTimer.unref();
  }
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
