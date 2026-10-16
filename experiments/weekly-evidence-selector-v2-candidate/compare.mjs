// Offline only. Preserve the original V1/V2 fixtures and artifacts verbatim.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { benchmark as previousBenchmark, frozenInputs, assertBounds } from "../weekly-evidence-selector-v2/benchmark.mjs";
import { selectWeeklyEvidenceV2 } from "../../lib/weekly-evidence-selector-v2.js";

export function compare() {
  const previous = previousBenchmark(), inputs = frozenInputs();
  const cases = previous.cases.map(row => {
    const c = inputs.find(c => c.id === row.id && c.locale === row.locale);
    const selected = selectWeeklyEvidenceV2(c.args), budget = assertBounds(c.args, selected);
    for (let offset = 0; offset < c.args.candidates.length; offset++) {
      const candidates = [...c.args.candidates.slice(offset), ...c.args.candidates.slice(0, offset)];
      assert.deepEqual(selectWeeklyEvidenceV2({ ...c.args, candidates }), selected);
      assert.deepEqual(selectWeeklyEvidenceV2({ ...c.args, candidates: candidates.reverse() }), selected);
    }
    const sourceRef = id => `E${c.args.candidates.findIndex(e => e.sourceEventId === id) + 1}`;
    const selectedRefs = selected.evidence.map(e => sourceRef(e.sourceEventId));
    const visibleRefs = [...budget.actual.refs.values()].map(e => sourceRef(e.source.sourceEventId));
    assert.deepEqual(visibleRefs, selectedRefs);
    const counts = new Map(); selected.evidence.forEach(e => counts.set(e.theme, (counts.get(e.theme) ?? 0) + 1));
    const corrected = { selectedRefs, visibleRefs, selectedCount: selected.selectedCount,
      meaningfulRetained: c.meaningfulRefs.filter(ref => visibleRefs.includes(ref)),
      followupsRetained: c.followupRefs.filter(ref => visibleRefs.includes(ref)),
      distinctThemes: counts.size, largestThemeShare: Math.max(...counts.values()) / selected.selectedCount,
      contextCharacters: selected.contextCharacters, requestBytesWithReserve: budget.requestBytesWithReserve };
    for (const ref of row.original.selectedRefs) assert.ok(selectedRefs.includes(ref), "frozen initial selection preserved");
    assert.equal(corrected.distinctThemes, row.original.distinctThemes);
    return { ...row, corrected };
  });
  const summary = category => {
    const rows = cases.filter(c => c.category === category);
    return Object.fromEntries(["original", "v2", "corrected"].map(key => [key, {
      evidence: rows.reduce((n, c) => n + c[key].selectedCount, 0),
      meaningful: rows.reduce((n, c) => n + c[key].meaningfulRetained.length, 0),
      followups: rows.reduce((n, c) => n + c[key].followupsRetained.length, 0)
    }]));
  };
  return { status: "OFFLINE_COMPARISON_PASS", providerCalls: 0,
    semantic: summary("semantic"), editorial: summary("editorial"), cases };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) { console.error("Offline comparison only; no live mode."); process.exitCode = 2; }
  else console.log(JSON.stringify(compare(), null, 2));
}
