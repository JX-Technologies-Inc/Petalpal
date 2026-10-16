export const WEEKLY_EVIDENCE_POLICY = "weekly-localized-v1";
// New generation only. Saved reports retain their original locale and prose.
export const REFLECTION_OUTPUT_LOCALES = Object.freeze(["en", "zh-Hans"]);

export function weeklyReportLocale(value) {
  const locale = typeof value === "string" ? value.toLowerCase() : "";
  if (/^en(?:-[a-z0-9]{2,8})*$/.test(locale)) return "en";
  if (/^zh(?:-[a-z0-9]{2,8})*$/.test(locale) && !/(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(locale)) {
    return "zh-Hans";
  }
  const error = new Error("Weekly report locale is unsupported");
  error.code = "REPORT_NARRATIVE_INVALID_INPUT";
  throw error;
}
