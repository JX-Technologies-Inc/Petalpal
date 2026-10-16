// Offline before/after selection report (no provider, network or database).
// node experiments/weekly-selective-reflection-v1/report.mjs
import { CASES, EXTRA_CASES, analyzeWeekly, analyzeMonthly } from "./stress.mjs";
console.log("case | locale | eligible | arm | candidates | selected | meaningful | experiences | outcomes | shared-label pairs | context chars");
for (const c of [...CASES, ...EXTRA_CASES]) for (const locale of ["en", "zh-Hans"]) {
  const r = analyzeWeekly(c, locale);
  for (const arm of ["v1", "v2", "sig"]) {
    const a = r[arm], cand = arm === "sig" ? a.candidates : r.candidates;
    console.log([c.id, locale, r.events, arm, cand, a.delivered, `${a.meaningfulDelivered}/${r.meaningful}`, `${a.groupsCovered}/${a.groups}`,
      `${a.outcomesDelivered}/${a.outcomes}`, a.sharedLabelPairs, a.contextCharacters ?? "-"].join(" | "));
  }
}
const g = analyzeMonthly();
console.log(`G Monthly (unchanged) | ${g.status} | weeks ${g.weeksCovered}/${g.weeks} | meaningful ${g.meaningfulDelivered}/${g.meaningful}`);
