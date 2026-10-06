// Device-local dates; date-only records must not shift across UTC boundaries.
export const calendarDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function calendarRecordDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : calendarDateKey(date);
}
export function calendarToday(device: Date, simulated: Date | null, development: boolean) {
  return development && simulated ? simulated : device;
}
