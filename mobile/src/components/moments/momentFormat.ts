// Display helpers for Fairy Moments. Times are shown in the phone's local time zone;
// the server decides when she posts (account time zone) and stores UTC instants.

const LOCATIONS: Record<string, string> = {
  TEA_CHAIR: 'Tea chair', SWING: 'Swing', MAILBOX: 'Mailbox', TREEHOUSE: 'Treehouse', MOON_BED: 'Moon bed',
  PAVILION: 'Pavilion', EAST_BRIDGE: 'East bridge', GARDEN_ARCH: 'Garden arch',
  STEPPING_STONES: 'Stepping stones', SOUTH_BRIDGE: 'South bridge', DEFAULT_AREA: 'Garden',
};

export function momentLocationLabel(location: string) {
  return LOCATIONS[location] ?? 'Garden';
}

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function momentTimeLabel(postedAt: string, now = new Date()) {
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return `Yesterday ${clock(date)}`;
  return date.getFullYear() === now.getFullYear()
    ? `${MONTHS[date.getMonth()]} ${date.getDate()}`
    : `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
