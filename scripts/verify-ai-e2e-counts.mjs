// Fails unless a node:test TAP summary shows exactly the expected passing tests
// and zero failed, skipped, todo or cancelled tests.
import fs from "node:fs";

const [file, expectedText] = process.argv.slice(2);
const expected = Number(expectedText);
if (!file || !Number.isInteger(expected) || expected < 1) {
  console.error("usage: verify-ai-e2e-counts.mjs <tap-file> <expected-pass-count>");
  process.exit(2);
}
const tap = fs.readFileSync(file, "utf8");
const count = (name) => {
  const values = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))].map((match) => Number(match[1]));
  return values.length === 1 ? values[0] : NaN;
};
const summary = Object.fromEntries(["tests", "pass", "fail", "skipped", "todo", "cancelled"].map((name) => [name, count(name)]));
const ok = summary.tests === expected && summary.pass === expected &&
  summary.fail === 0 && summary.skipped === 0 && summary.todo === 0 && summary.cancelled === 0;
console.log(`${file}: ${JSON.stringify(summary)} expected pass=${expected} -> ${ok ? "PASS" : "FAIL"}`);
if (!ok) process.exit(1);
