// OFFLINE FIXTURE. One synthetic English week for the end-to-end en Weekly pipeline with local
// BGE (test/back/weekly-en-local-bge.postgres.test.js and its one-call live runner). Realistic
// week O (offer, sleepless night, low day, walk with Lin) plus week M's call from Mum, moved
// into week 2026-10-12 (UTC). Synthetic text only; no user data.
import { REFLECTION_V2 } from "../../lib/reflection-v2.js";

export const WEEK = "2026-10-12";
export const WEEK_CLOSED_AT = "2026-10-19T00:00:00Z";
// Local Transformers.js BGE: same model, mean pooling and summary-v1 input as production BGE.
export const LOCAL_BGE_PROFILE = "production-bge-small-en-v1.5-v1";
export const EN_PIPELINE_EVENTS = Object.freeze([
  ["2026-10-13T08:00:00Z", "Got the internship offer! Called everyone I know."],
  ["2026-10-13T23:00:00Z", "Can't sleep. What if I'm not good enough for it and they regret hiring me."],
  ["2026-10-14T12:00:00Z", "Groceries."],
  ["2026-10-15T15:00:00Z", "Stayed in bed most of the day. Didn't feel like seeing anyone."],
  ["2026-10-16T19:00:00Z", "Lin dragged me out for a walk. Glad she did, I think."],
  ["2026-10-17T22:00:00Z", "Mum called to say her test results came back clear. I cried a bit after hanging up."]
].map(Object.freeze));

// Hosted TEST runbook budget and defaults (docs/testing/BILINGUAL_WEEKLY_ACCEPTANCE.md), with
// English as the only report locale. Credentials default to synthetic placeholders.
export function runbookEnv(credentials = {}) {
  return Object.freeze({
    AI_GATEWAY_ENABLED: "true", AI_GATEWAY_ANTHROPIC_ENABLED: "true", AI_REPORT_SUPPORTED_LOCALES: "en",
    CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: credentials.account ?? "0123456789abcdef0123456789abcdef", CLOUDFLARE_AI_GATEWAY_ID: "petalpal-integration",
    CLOUDFLARE_AI_GATEWAY_TOKEN: credentials.token ?? "synthetic-gateway-token", ANTHROPIC_API_KEY: credentials.key ?? "synthetic-anthropic-key",
    AI_WEEKLY_REPORT_PROVIDER: "anthropic", AI_WEEKLY_REPORT_MODEL: "claude-sonnet-5-5", AI_WEEKLY_REFLECTION_CONTRACT: REFLECTION_V2.WEEKLY,
    AI_WEEKLY_REPORT_MAX_OUTPUT_TOKENS: "2048", AI_WEEKLY_REPORT_TIMEOUT_MS: "20000", AI_ASYNC_EXECUTION_MODE: "manual",
    AI_USER_DAILY_USD_LIMIT: "0.05", AI_USER_MONTHLY_USD_LIMIT: "0.05", AI_GLOBAL_DAILY_USD_LIMIT: "0.05",
    AI_GLOBAL_MONTHLY_USD_LIMIT: "0.05", AI_ANTHROPIC_MONTHLY_USD_LIMIT: "0.05",
    AI_USER_DAILY_CALL_LIMIT: "2", AI_GLOBAL_DAILY_CALL_LIMIT: "2", AI_PROVIDER_DAILY_CALL_LIMIT: "2", AI_WEEKLY_REPORT_DAILY_LIMIT: "1"
  });
}
