// Regression: British Columbia stays on UTC-7 after 2026-11-01 (IANA tzdata 2026b+).
// Node reads its bundled ICU tzdata, not the OS, so this fails on stale runtimes
// (for example Node 24.7.0 / tzdata 2025b) instead of silently shifting Vancouver
// Event local dates and Weekly/Monthly boundaries by one hour.
import assert from "node:assert/strict";
import test from "node:test";

import { localDateForInstant, localMidnightToUtc, monthlyPeriodFor, previousMonthlyPeriod, weeklyPeriodForLocalDate } from "../../lib/ai-periods.js";

const TZ = "America/Vancouver";
const runtime = `Node ${process.version}, tzdata ${process.versions.tz || "unknown"}`;
const iso = (date) => date.toISOString();

function local(instant) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" })
    .formatToParts(new Date(instant));
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("hour")}:${value("minute")} ${value("timeZoneName")}`;
}

test("runtime tzdata models British Columbia permanent UTC-7 (IANA 2026b or later)", () => {
  assert.equal(local("2026-11-15T12:00:00Z"), "05:00 GMT-07:00", `${runtime}: 2026-11-15T12:00Z must be 05:00 in ${TZ}`);
  for (const instant of ["2026-11-01T12:00:00Z", "2026-12-15T12:00:00Z", "2027-01-15T12:00:00Z", "2027-11-15T12:00:00Z"]) {
    assert.equal(local(instant), "05:00 GMT-07:00", `${runtime}: ${instant}`);
  }
  // Historical rules stay intact: standard time before the 2026-03-08 spring forward.
  assert.equal(local("2026-02-15T12:00:00Z"), "04:00 GMT-08:00", runtime);
});

test("November 2026 Vancouver Event local dates and report periods use UTC-7", () => {
  assert.equal(localDateForInstant("2026-11-15T12:00:00Z", TZ), "2026-11-15");
  assert.equal(localDateForInstant("2026-11-16T06:59:59Z", TZ), "2026-11-15", runtime);
  assert.equal(localDateForInstant("2026-11-16T07:30:00Z", TZ), "2026-11-16", `${runtime}: 00:30 local, not 23:30 the day before`);
  assert.equal(iso(localMidnightToUtc("2026-11-15", TZ)), "2026-11-15T07:00:00.000Z", runtime);

  const week = weeklyPeriodForLocalDate("2026-11-15", TZ);
  assert.deepEqual([week.periodKey, iso(week.periodStartUtc), iso(week.periodEndUtc)],
    ["2026-11-09", "2026-11-09T07:00:00.000Z", "2026-11-16T07:00:00.000Z"], runtime);
  const fallBackWeek = weeklyPeriodForLocalDate("2026-11-01", TZ);
  assert.equal((fallBackWeek.periodEndUtc - fallBackWeek.periodStartUtc) / 3_600_000, 168, `${runtime}: no fall-back hour on 2026-11-01`);

  const november = monthlyPeriodFor({ year: 2026, month: 11, timezone: TZ });
  assert.deepEqual([iso(november.periodStartUtc), iso(november.periodEndUtc)], ["2026-11-01T07:00:00.000Z", "2026-12-01T07:00:00.000Z"], runtime);
  const previous = previousMonthlyPeriod({ year: 2026, month: 12, timezone: TZ });
  assert.equal(iso(previous.periodEndUtc), "2026-12-01T07:00:00.000Z", runtime);

  // The last real transition (2026-03-08 spring forward) is still a 167-hour week.
  const springWeek = weeklyPeriodForLocalDate("2026-03-08", TZ);
  assert.equal((springWeek.periodEndUtc - springWeek.periodStartUtc) / 3_600_000, 167);
});
