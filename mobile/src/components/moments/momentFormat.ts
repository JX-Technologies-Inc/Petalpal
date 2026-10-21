// Display helpers for Fairy Moments. Times are shown in the phone's local time zone;
// the server decides when she posts (account time zone) and stores UTC instants.
// Words follow the owner's chosen language (English or Simplified Chinese), like her captions.

export type MomentLocale = 'en' | 'zh-Hans';
// Same rule as the server's weeklyReportLocale: Chinese except Traditional, else English.
export function momentLocale(value?: string | null): MomentLocale {
  const locale = (value || '').toLowerCase();
  return /^zh(?:-|$)/.test(locale) && !/(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(locale) ? 'zh-Hans' : 'en';
}

const LOCATIONS: Record<MomentLocale, Record<string, string>> = {
  en: { TEA_CHAIR: 'Tea chair', SWING: 'Swing', MAILBOX: 'Mailbox', TREEHOUSE: 'Treehouse', MOON_BED: 'Moon bed',
    PAVILION: 'Pavilion', EAST_BRIDGE: 'East bridge', GARDEN_ARCH: 'Garden arch',
    STEPPING_STONES: 'Stepping stones', SOUTH_BRIDGE: 'South bridge', DEFAULT_AREA: 'Garden' },
  'zh-Hans': { TEA_CHAIR: '茶座', SWING: '秋千', MAILBOX: '信箱', TREEHOUSE: '树屋', MOON_BED: '月亮床',
    PAVILION: '凉亭', EAST_BRIDGE: '东桥', GARDEN_ARCH: '花园拱门',
    STEPPING_STONES: '踏脚石', SOUTH_BRIDGE: '南桥', DEFAULT_AREA: '花园' },
};

export function momentLocationLabel(location: string, locale: MomentLocale = 'en') {
  return LOCATIONS[locale][location] ?? LOCATIONS[locale].DEFAULT_AREA;
}

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function momentTimeLabel(postedAt: string, now = new Date(), locale: MomentLocale = 'en') {
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return '';
  const zh = locale === 'zh-Hans';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return zh ? '刚刚' : 'Just now';
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return zh ? `${Math.floor(minutes / 60)} 小时前` : `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return zh ? `昨天 ${clock(date)}` : `Yesterday ${clock(date)}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  if (zh) return `${sameYear ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日`;
  return sameYear ? `${MONTHS[date.getMonth()]} ${date.getDate()}` : `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// The panel's own words. `name` is the Fairy's name as the owner set it.
export const MOMENTS_COPY = {
  en: {
    title: (name: string) => `${name}'s Moments`, close: 'Close Moments', find: 'Find her',
    findLabel: (name: string) => `Find ${name} in the Garden`, signature: 'Checking whether the flowers opened today.',
    loading: 'Loading Moments', loadError: 'Her Moments could not load. Try again in a moment.',
    moreError: 'More Moments could not load. Try again in a moment.', retry: 'Try again',
    empty: (name: string) => `${name} hasn't posted yet. She shares a photo or a small discovery every few days.`,
    more: 'Show earlier Moments', end: "That's all for now", like: 'Like', unlike: 'Unlike',
    photo: (name: string, place: string) => `${name} at the ${place.toLowerCase()}`,
  },
  'zh-Hans': {
    title: (name: string) => `${name}的朋友圈`, close: '关闭朋友圈', find: '去找她',
    findLabel: (name: string) => `在花园里找到${name}`, signature: '在看今天的花开了没有。',
    loading: '正在加载朋友圈', loadError: '朋友圈没加载出来，等一下再试试。',
    moreError: '更早的动态没加载出来，等一下再试试。', retry: '再试一次',
    empty: (name: string) => `${name}还没有发过动态。她每隔几天会分享一张照片或一个小发现。`,
    more: '查看更早的动态', end: '暂时就这些', like: '点赞', unlike: '取消点赞',
    photo: (name: string, place: string) => `${name}在${place}`,
  },
} as const;
