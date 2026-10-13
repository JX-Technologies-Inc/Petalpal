export const WEEKLY_EVIDENCE_POLICY = "weekly-localized-v1";

export function weeklyReportLocale(value) {
  const locale = typeof value === "string" ? value.toLowerCase() : "";
  if (/^en(?:-[a-z0-9]{2,8})*$/.test(locale)) return "en";
  if (/^zh(?:-[a-z0-9]{2,8})*$/.test(locale)) {
    return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(locale) ? "zh-Hant" : "zh-Hans";
  }
  const error = new Error("Weekly report locale is unsupported");
  error.code = "REPORT_NARRATIVE_INVALID_INPUT";
  throw error;
}
