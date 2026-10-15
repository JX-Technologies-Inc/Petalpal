// Fail-closed gates for the single live zh-Hans Reflection v2 Weekly (Sonnet 5.5) acceptance call.
// Node built-ins plus lib/ai-gateway-config.js only, so the gates are testable without a database or network.
// Reuses the one-time ledger pattern of experiments/prompt-first-reflection/acceptance-v2.mjs (PR #55):
// exclusive create under the Git common directory and an fsynced attempt entry before any send.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, writeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { GATEWAY_MODELS, gatewayQuote, usdLimitNano } from "../lib/ai-gateway-config.js";

export const MODEL = "claude-sonnet-5-5";
export const APPROVAL = "APPROVE-1-ZH-WEEKLY-V2-SONNET-CALL";
export const MAX_BUDGET_USD = "0.05";
export const GATEWAY_ATTESTATION = "petalpal-integration-no-retry-no-fallback-no-cache-verified";
export const MAX_OUTPUT_TOKENS = 2048;
export const PORT = "55432";
export const DATABASES = Object.freeze({ offline: "petalpal_acceptance_v2_offline_test", "live-weekly": "petalpal_acceptance_v2_live_test" });
// Fixed identity: one live call per clone, ever. A new run needs a new approval and deliberate human ledger handling.
export const LEDGER_NAME = "zh-weekly-v2-sonnet-live.jsonl";
// The Gateway reserves the full Weekly input allowance before dispatch; actual usage can never exceed it.
export const QUOTE = gatewayQuote({ model: MODEL, action: "WEEKLY_REPORT", inputTokens: 8192, maxOutputTokens: MAX_OUTPUT_TOKENS });

const FORBIDDEN_ENV = name => name === "DATABASE_URL" || name === "NATIVE_SECURITY_TEST" || name.startsWith("RENDER") ||
  name.startsWith("AI_") || /ANTHROPIC|GATEWAY|OPENAI|FIREBASE|CLOUDFLARE/.test(name);

// Returns a STOP code, or null when every gate passes. `git` reports { head, clean } for the running checkout.
export function preflight({ mode, env, dotenv, git }) {
  if (!Object.hasOwn(DATABASES, mode)) return "USAGE: offline | live-weekly";
  if (dotenv) return "DOTENV_PRESENT";
  if (env.NODE_ENV !== "test" || Object.keys(env).some(FORBIDDEN_ENV)) return "ENVIRONMENT_NOT_ISOLATED";
  let url; try { url = new URL(env.DEV_DATABASE_URL); } catch { return "DATABASE_URL_INVALID"; }
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== PORT || url.pathname !== `/${DATABASES[mode]}`) return "DATABASE_NOT_DISPOSABLE";
  if (mode === "offline") return null;
  if (env.CI !== undefined || env.GITHUB_ACTIONS !== undefined) return "LIVE_FORBIDDEN_IN_CI";
  if (env.PETALPAL_ZH_ACCEPTANCE_APPROVAL !== APPROVAL) return "APPROVAL_REQUIRED";
  const commit = env.PETALPAL_ZH_ACCEPTANCE_COMMIT;
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) return "APPROVED_COMMIT_REQUIRED";
  if (!git || git.head !== commit) return "APPROVED_COMMIT_MISMATCH";
  if (git.clean !== true) return "WORKTREE_NOT_CLEAN";
  let cap;
  try { cap = usdLimitNano(env, "PETALPAL_ZH_ACCEPTANCE_BUDGET_USD"); } catch { return "BUDGET_CAP_REQUIRED"; }
  if (cap > usdLimitNano({ cap: MAX_BUDGET_USD }, "cap")) return "BUDGET_CAP_EXCEEDS_AUTHORIZED_MAXIMUM";
  if (QUOTE.reservedNanoUsd > cap) return "BUDGET_CAP_BELOW_RESERVATION";
  // The request sends cf-aig-max-attempts: 1, but Gateway-side retry/fallback/routing settings cannot be read
  // from here. The operator must verify them out of band (human-only) and attest before any send.
  if (env.PETALPAL_ZH_ACCEPTANCE_NO_RETRY_ATTESTATION !== GATEWAY_ATTESTATION) return "GATEWAY_NO_RETRY_UNVERIFIED";
  if (git.ledgerExists) return "LEDGER_CONSUMED";
  return null;
}

export function gitState(root) {
  const run = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const common = run(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const ledger = path.join(common, "petalpal-acceptance", LEDGER_NAME);
    return { head: run(["rev-parse", "HEAD"]), clean: run(["status", "--porcelain"]) === "", ledger, ledgerExists: existsSync(ledger) };
  } catch { return null; }
}

// Exclusive create: an existing ledger (complete, partial or empty) is never resumed or overwritten.
export function openLedger(file) {
  try {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const fd = openSync(file, "wx", 0o600);
    const dir = openSync(path.dirname(file), "r"); try { fsyncSync(dir); } finally { closeSync(dir); }
    return { write(entry) { writeSync(fd, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`); fsyncSync(fd); }, close() { closeSync(fd); } };
  } catch { const error = new Error("LEDGER_UNAVAILABLE"); error.code = "LEDGER_UNAVAILABLE"; throw error; }
}

// Counts every dispatch before any network access. Live: one exact URL and one call; the one-time ledger is
// created exclusively and its attempt entry fsynced before the send, so a crash or unknown outcome still consumes it.
// Only the HTTP status is recorded; request/response bodies and headers never reach the ledger or logs.
export function dispatchGuard({ expectedUrl, live, ledgerFile = null, run = {}, send }) {
  const state = { calls: 0, ledger: null };
  state.impl = async (url, options) => {
    state.calls += 1;
    if (url !== expectedUrl || (live && (state.calls > 1 || !ledgerFile))) throw new Error("DISPATCH_REFUSED");
    if (live) {
      state.ledger = openLedger(ledgerFile);
      state.ledger.write({ entry: "run", ...run });
      state.ledger.write({ entry: "attempt", call: state.calls });
    }
    const response = await send(url, options);
    if (live) state.ledger.write({ entry: "response", call: state.calls, status: response.status });
    return response;
  };
  return state;
}

// Sanitized cost from the cost ledger rows written by the production cost gate.
export function costFromUsage(usageCode) {
  const [input, output, cached] = String(usageCode).split(":").map(Number);
  if (![input, output, cached].every(Number.isSafeInteger)) return null;
  const { inputRate, outputRate } = GATEWAY_MODELS[MODEL];
  return { inputTokens: input, outputTokens: output, cachedInputTokens: cached, nanoUsd: input * inputRate + output * outputRate };
}
