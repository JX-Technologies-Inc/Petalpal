// Per-owner opt-in to the short Weekly report. AI_WEEKLY_SHORT_OWNER_IDS lists the owner
// ids (comma-separated) who get `weekly-short-v1`; everyone else keeps the configured
// AI_WEEKLY_REFLECTION_CONTRACT and its flags. Unset or empty: nobody. A malformed list
// fails closed. No dependencies, so report-foundation and sonnet-weekly can both use it.
export const WEEKLY_SHORT_CONTRACT = "weekly-short-v1";
const MAX_OWNERS = 100;

export function weeklyShortOwners(env = process.env) {
  const raw = env.AI_WEEKLY_SHORT_OWNER_IDS;
  if (raw === undefined || raw === "") return new Set();
  const ids = typeof raw === "string" ? raw.split(",") : [];
  if (!ids.length || ids.length > MAX_OWNERS || ids.some(id => !/^[A-Za-z0-9_-]{1,64}$/.test(id))) {
    throw Object.assign(new Error("Weekly short-report owner list is invalid"), { code: "AI_GATEWAY_CONFIG_INVALID" });
  }
  return new Set(ids);
}

// The contract one owner's Weekly report uses, given the configured one.
export const weeklyContractFor = (env, ownerId, configured) =>
  weeklyShortOwners(env).has(ownerId) ? WEEKLY_SHORT_CONTRACT : configured;
