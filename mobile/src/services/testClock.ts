// TEST-only logical Event date, shared by the Garden Calendar and Event creation.
// Available only in development builds (__DEV__); release builds always use the
// device date and never send the header. The backend independently rejects the
// header unless its isolated simulated-time gate passes, so this flag is never
// the security boundary. In-memory only: reset on reload.
export const SIMULATED_TIME_HEADER = 'X-PetalPal-Simulated-Time';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
let simulated: string | null = null;
let version = 0;
const syntheticDays = new Map<string, string>();
const listeners = new Set<() => void>();
const changed = () => { version += 1; listeners.forEach((listener) => listener()); };
const validDate = (value: string) => DATE_ONLY.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const testClockAvailable = () => __DEV__ === true;
export const simulatedEventDate = () => (testClockAvailable() ? simulated : null);
export const testClockSnapshot = () => version;
export function subscribeTestClock(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setSimulatedEventDate(value: string | null) {
  if (!testClockAvailable()) return;
  if (value !== null && !validDate(value)) throw new Error('TEST date must use YYYY-MM-DD');
  simulated = value;
  changed();
}
export function simulatedTimeHeaders(): Record<string, string> {
  const date = simulatedEventDate();
  return date ? { [SIMULATED_TIME_HEADER]: date } : {};
}
// Calendar placement for Flowers created under a TEST date (Flower createdAt is real server time).
export function rememberSyntheticFlowerDay(flowerId: string | undefined, localDate: string | undefined) {
  if (!simulatedEventDate() || !flowerId || !localDate || !validDate(localDate)) return;
  syntheticDays.set(flowerId, localDate);
  changed();
}
export const syntheticFlowerDay = (flowerId: string) => (testClockAvailable() ? syntheticDays.get(flowerId) ?? null : null);
