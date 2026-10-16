// Offline per-dimension screening report. No provider, network or database access.
// Usage: node experiments/weekly-narrative-thread-v1/run.mjs
import { corpus, targets, inputFor } from "../weekly-editorial-quality-v1/fixtures.mjs";
import { exemplars, foils, score } from "./fixtures.mjs";
import { buildWeeklyReflectionV2Packet } from "../../lib/sonnet-weekly.js";

const DIMS = ["fidelity", "restraint", "cohesion", "synthesis", "naturalness", "validator"];
const mark = v => v === null ? "n/a" : v ? "PASS" : "FAIL";
const rows = [];
const run = (set, label, items) => {
  for (const item of items) {
    const c = corpus.cases.find(c => c.id === item.caseId), built = buildWeeklyReflectionV2Packet(inputFor(c, item.locale));
    const r = score({ version: "weekly-reflection-v2", locale: item.locale, paragraphs: item.paragraphs }, { caseId: item.caseId, locale: item.locale, built });
    rows.push([set, label(item), ...DIMS.map(d => mark(r[d]))]);
  }
};
run("narrative exemplar", e => `${e.caseId}/${e.locale}`, exemplars);
run("prior target", t => `${t.caseId}/${t.locale}`, targets.targets);
run("foil", f => `${f.id} ${f.caseId}/${f.locale} (${f.why})`, foils);
console.log(["set", "item", ...DIMS].join(" | "));
for (const row of rows) console.log(row.join(" | "));
