const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const AI_WEEK_START = "MONDAY";

export function normalizeIanaTimezone(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 64) return null;
  const timezone = value.trim();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

function requireTimezone(value) {
  const timezone = normalizeIanaTimezone(value);
  if (!timezone) throw new Error("A valid IANA timezone is required");
  return timezone;
}

function dateParts(localDate) {
  const match = DATE_PATTERN.exec(String(localDate || ""));
  if (!match) throw new Error("localDate must use YYYY-MM-DD");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("localDate is not a valid calendar date");
  }
  return { year, month, day };
}

function formatDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addLocalDays(localDate, days) {
  const { year, month, day } = dateParts(localDate);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate()
  });
}

function zonedParts(instant, timezone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

export function localDateForInstant(value, timezone) {
  const normalizedTimezone = requireTimezone(timezone);
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("A valid occurredAt timestamp is required");
  const { year, month, day } = zonedParts(instant, normalizedTimezone);
  return formatDate({ year, month, day });
}

export function localMidnightToUtc(localDate, timezone) {
  const normalizedTimezone = requireTimezone(timezone);
  const target = dateParts(localDate);
  const targetEpoch = Date.UTC(target.year, target.month - 1, target.day, 0, 0, 0);
  let guess = targetEpoch;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(guess), normalizedTimezone);
    const actualEpoch = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const adjustment = targetEpoch - actualEpoch;
    guess += adjustment;
    if (adjustment === 0) break;
  }

  const result = new Date(guess);
  const verified = zonedParts(result, normalizedTimezone);
  if (formatDate(verified) !== localDate || verified.hour !== 0 || verified.minute !== 0) {
    throw new Error("Unable to resolve local midnight in the configured timezone");
  }
  return result;
}

export function weeklyPeriodForLocalDate(localDate, timezone) {
  const normalizedTimezone = requireTimezone(timezone);
  const parsed = dateParts(localDate);
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const periodKey = addLocalDays(localDate, -daysSinceMonday);
  const endLocalDate = addLocalDays(periodKey, 7);
  return {
    timezone: normalizedTimezone,
    periodKey,
    periodStartUtc: localMidnightToUtc(periodKey, timezone),
    periodEndUtc: localMidnightToUtc(endLocalDate, timezone)
  };
}

export function monthlyPeriodFor({ year, month, timezone }) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("A valid report year and month are required");
  }
  const periodKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const normalizedTimezone = requireTimezone(timezone);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    timezone: normalizedTimezone,
    periodKey,
    periodStartUtc: localMidnightToUtc(`${periodKey}-01`, timezone),
    periodEndUtc: localMidnightToUtc(`${String(nextMonth.year).padStart(4, "0")}-${String(nextMonth.month).padStart(2, "0")}-01`, timezone)
  };
}

export function previousWeeklyPeriod(period) {
  return weeklyPeriodForLocalDate(addLocalDays(period.periodKey, -7), period.timezone);
}

export function previousMonthlyPeriod({ year, month, timezone }) {
  return monthlyPeriodFor(month === 1
    ? { year: year - 1, month: 12, timezone }
    : { year, month: month - 1, timezone });
}

export function reportPeriodStatus(periodEndUtc, asOf = new Date(), allowPartial = false) {
  const reference = asOf instanceof Date ? asOf : new Date(asOf);
  if (Number.isNaN(reference.getTime())) throw new Error("A valid report asOf timestamp is required");
  if (periodEndUtc.getTime() <= reference.getTime()) return "COMPLETE";
  if (allowPartial) return "PARTIAL";
  const error = new Error("Production AI reports may only be generated for closed periods");
  error.code = "AI_REPORT_PERIOD_OPEN";
  throw error;
}
