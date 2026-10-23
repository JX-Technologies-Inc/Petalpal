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
    findLabel: (name: string) => `Find ${name} in the Garden`, signature: 'Cherish the present, rejoice in new beginnings.', // crocus flower language
    loading: 'Loading Moments', loadError: 'Her Moments could not load. Try again in a moment.',
    moreError: 'More Moments could not load. Try again in a moment.', retry: 'Try again',
    empty: (name: string) => `${name} hasn't posted yet. She shares a photo or a small discovery every few days.`,
    more: 'Show earlier Moments', end: "That's all for now", like: 'Like', unlike: 'Unlike',
    photo: (name: string, place: string) => `${name} at the ${place.toLowerCase()}`,
    avatarChange: (name: string) => `Change ${name}'s avatar`, avatarTitle: (name: string) => `Choose ${name}'s avatar`,
    avatarDefault: (name: string) => `${name}'s own photo`, avatarOption: (n: number) => `Avatar ${n}`,
    avatarClose: 'Close', avatarFailed: 'The avatar was not saved. Please try again.',
    coverChange: 'Change cover', coverTitle: 'Choose a cover', coverDefault: 'Her treehouse photo',
    coverOption: (n: number) => `Garden scene ${n}`, coverFailed: 'The cover was not saved. Please try again.',
  },
  'zh-Hans': {
    title: (name: string) => `${name}的朋友圈`, close: '关闭朋友圈', find: '去找她',
    findLabel: (name: string) => `在花园里找到${name}`, signature: '珍惜当下，喜悦新生。', // 番红花的花语
    loading: '正在加载朋友圈', loadError: '朋友圈没加载出来，等一下再试试。',
    moreError: '更早的动态没加载出来，等一下再试试。', retry: '再试一次',
    empty: (name: string) => `${name}还没有发过动态。她每隔几天会分享一张照片或一个小发现。`,
    more: '查看更早的动态', end: '暂时就这些', like: '点赞', unlike: '取消点赞',
    photo: (name: string, place: string) => `${name}在${place}`,
    avatarChange: (name: string) => `更换${name}的头像`, avatarTitle: (name: string) => `选择${name}的头像`,
    avatarDefault: (name: string) => `${name}原来的照片`, avatarOption: (n: number) => `头像 ${n}`,
    avatarClose: '关闭', avatarFailed: '头像没有保存成功，请再试一次。',
    coverChange: '更换封面', coverTitle: '选择封面', coverDefault: '她的树屋照片',
    coverOption: (n: number) => `花园风景 ${n}`, coverFailed: '封面没有保存成功，请再试一次。',
  },
} as const;
