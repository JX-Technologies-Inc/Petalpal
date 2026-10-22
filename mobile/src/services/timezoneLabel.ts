// Shows an account's IANA time zone (stored as e.g. "America/Vancouver", the only valid
// spelling) as a city and zone name: "Vancouver · Pacific Time" / "温哥华 · 北美太平洋时间".
// Display only: the stored value and every period calculation stay on the IANA id (time.md).
export type LabelLocale = 'en' | 'zh-Hans';

const ZH_CITIES: Record<string, string> = {
  Vancouver: '温哥华', Edmonton: '埃德蒙顿', Winnipeg: '温尼伯', Toronto: '多伦多', Montreal: '蒙特利尔',
  Halifax: '哈利法克斯', St_Johns: '圣约翰斯', Regina: '里贾纳', Whitehorse: '怀特霍斯',
  Los_Angeles: '洛杉矶', Denver: '丹佛', Phoenix: '凤凰城', Chicago: '芝加哥', New_York: '纽约',
  Anchorage: '安克雷奇', Honolulu: '檀香山', Mexico_City: '墨西哥城', Sao_Paulo: '圣保罗',
  London: '伦敦', Dublin: '都柏林', Paris: '巴黎', Berlin: '柏林', Madrid: '马德里', Rome: '罗马',
  Amsterdam: '阿姆斯特丹', Zurich: '苏黎世', Stockholm: '斯德哥尔摩', Moscow: '莫斯科',
  Shanghai: '上海', Chongqing: '重庆', Urumqi: '乌鲁木齐', Hong_Kong: '香港', Macau: '澳门', Taipei: '台北',
  Tokyo: '东京', Seoul: '首尔', Singapore: '新加坡', Kuala_Lumpur: '吉隆坡', Bangkok: '曼谷',
  Ho_Chi_Minh: '胡志明市', Manila: '马尼拉', Jakarta: '雅加达', Kolkata: '加尔各答', Dubai: '迪拜',
  Sydney: '悉尼', Melbourne: '墨尔本', Brisbane: '布里斯班', Perth: '珀斯', Auckland: '奥克兰',
};

function zoneName(timezone: string, locale: LabelLocale) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function timezoneLabel(timezone: string | null | undefined, locale: LabelLocale = 'en') {
  if (!timezone) return locale === 'zh-Hans' ? '协调世界时 (UTC)' : 'Coordinated Universal Time (UTC)';
  if (!timezone.includes('/')) return zoneName(timezone, locale) || timezone;
  const key = timezone.slice(timezone.lastIndexOf('/') + 1);
  const city = (locale === 'zh-Hans' && ZH_CITIES[key]) || key.replace(/_/g, ' ');
  const zone = zoneName(timezone, locale);
  return zone && zone !== city ? `${city} · ${zone}` : city;
}
