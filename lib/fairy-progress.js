export function monthFromLocalDate(localDate) {
  const value = String(localDate || "");
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
    throw new Error("Invalid local date");
  }
  return value.slice(0, 7);
}

export function normalizeProgress({ month, activeDays, requiredDays, unlockedThisMonth }) {
  const safeRequired = Math.max(1, requiredDays);
  return {
    month,
    activeDays,
    requiredDays: safeRequired,
    progress: Math.min(1, Number((activeDays / safeRequired).toFixed(4))),
    unlockedThisMonth: Boolean(unlockedThisMonth)
  };
}
