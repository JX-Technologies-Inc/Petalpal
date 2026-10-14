// A closed, complete source language. Lexical rules describe predicates, not
// finished reflections. No word-overlap, partial-source extraction or model proof.
export const SOURCE_RULE_VERSION = 'recorded-construction-v1';
const locales = ['en', 'zh-Hans', 'zh-Hant'];
const uniq = values => [...new Set(values)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lex = (en, hans, hant) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
const feelings = {
  tired: lex(['tired'], ['疲惫', '累'], ['疲憊', '累']),
  exhausted: lex(['exhausted', 'worn out'], ['筋疲力尽'], ['筋疲力盡']),
  happy: lex(['happy'], ['开心', '高兴'], ['開心', '高興']),
  sad: lex(['sad'], ['难过'], ['難過']),
  frustrated: lex(['frustrated'], ['沮丧'], ['沮喪']),
  lonely: lex(['lonely'], ['孤独'], ['孤獨']),
  grateful: lex(['grateful', 'thankful'], ['感激'], ['感激']),
  relieved: lex(['relieved'], ['如释重负'], ['如釋重負']),
  worried: lex(['worried'], ['担心'], ['擔心']),
  calm: lex(['calm'], ['平静'], ['平靜']),
  more_at_ease: lex(['a little more at ease'], ['轻松了一点'], ['輕鬆了一點'])
};
const outputFeelings = Object.fromEntries(Object.entries(feelings).map(([key, values]) => [key,
  Object.fromEntries(locales.map(locale => [locale, values[locale][0]]))]));
const actions = [];
function action(key, theme, past, base, phrase, hansPast, hansBase, hantPast, hantBase, hansPhrase = hansPast, hantPhrase = hantPast, fields = {}) {
  actions.push({ key, theme, fields, source: lex(past, hansPast, hantPast), base: lex(base, hansBase, hantBase),
    phrase: lex(phrase, hansPhrase, hantPhrase) });
}
action('work', 'work', ['worked'], ['work'], ['working'], ['工作了'], ['工作'], ['工作了'], ['工作'], ['工作'], ['工作']);
action('study', 'study', ['studied'], ['study'], ['studying'], ['学习了'], ['学习'], ['學習了'], ['學習'], ['学习'], ['學習']);
action('finish_shift', 'work', ['finished my shift'], ['finish my shift'], ['finishing your shift'], ['结束了值班'], ['结束值班'], ['結束了值班'], ['結束值班'], ['结束值班'], ['結束值班']);
action('fix_bug', 'project', ['fixed the bug', 'resolved the bug'], ['fix the bug', 'resolve the bug'], ['fixing the bug', 'resolving the bug'], ['修好了这个bug'], ['修好这个bug'], ['修好了這個bug'], ['修好這個bug'], ['修好这个bug'], ['修好這個bug']);
action('test_failure', 'testing', ['encountered a failing test'], ['encounter a failing test'], ['encountering a failing test'], ['遇到了一个失败的测试'], ['遇到一个失败的测试'], ['遇到了一個失敗的測試'], ['遇到一個失敗的測試'], ['遇到一个失败的测试'], ['遇到一個失敗的測試']);
action('finish_draft', 'writing', ['finished a draft'], ['finish a draft'], ['finishing a draft'], ['完成了一份初稿'], ['完成一份初稿'], ['完成了一份初稿'], ['完成一份初稿'], ['完成一份初稿'], ['完成一份初稿']);
action('write_poem', 'writing', ['wrote a poem'], ['write a poem'], ['writing a poem'], ['写了一首诗'], ['写一首诗'], ['寫了一首詩'], ['寫一首詩'], ['写一首诗'], ['寫一首詩']);
action('rest', 'rest', ['rested'], ['rest'], ['resting'], ['休息了'], ['休息'], ['休息了'], ['休息'], ['休息'], ['休息']);
action('cook_dinner', 'daily', ['cooked dinner', 'made dinner'], ['cook dinner', 'make dinner'], ['cooking dinner', 'making dinner'], ['做了晚饭'], ['做晚饭'], ['做了晚飯'], ['做晚飯'], ['做晚饭'], ['做晚飯']);
action('walk_park', 'walking', ['walked in the park'], ['walk in the park'], ['walking in the park'], ['在公园散步', '在公园散了步'], ['在公园散步'], ['在公園散步', '在公園散了步'], ['在公園散步'], ['在公园散步'], ['在公園散步']);
action('draw_sketchbook_owned', 'drawing', ['drew in my sketchbook'], ['draw in my sketchbook'], ['drawing in your sketchbook'], ['在自己的速写本里画画'], ['在自己的速写本里画画'], ['在自己的速寫本裡畫畫'], ['在自己的速寫本裡畫畫'], ['在自己的速写本里画画'], ['在自己的速寫本裡畫畫'], { possession: 'AUTHOR' });
action('draw_sketchbook', 'drawing', ['drew in a sketchbook'], ['draw in a sketchbook'], ['drawing in a sketchbook'], ['在速写本里画画', '在速写本上画画'], ['在速写本里画画'], ['在速寫本裡畫畫', '在速寫本上畫畫'], ['在速寫本裡畫畫'], ['在速写本里画画'], ['在速寫本裡畫畫'], { possession: 'UNSPECIFIED' });
// Literal names are copied only through a bounded lexical construction. The name
// remains an opaque label, never a relationship, location type or translated fact.
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const hanNumbers = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九'];
for (let n = 1; n <= 9; n++) {
  const ew = numberWords[n], hn = hanNumbers[n], tn = hn === '两' ? '兩' : hn;
  const draws = n === 1 ? 'drawing' : 'drawings', trees = n === 1 ? 'tree' : 'trees';
  action(`compare_${n}`, 'drawing', [`compared the lines in ${ew} ${draws}`, `compared the lines of ${n} ${draws}`], [`compare the lines in ${ew} ${draws}`], [`comparing the lines of ${ew} ${draws}`], [`比较了${hn}张画的线条`, `比较了${n}张画的线条`], [`比较${hn}张画的线条`], [`比較了${tn}張畫的線條`, `比較了${n}張畫的線條`], [`比較${tn}張畫的線條`], [`比较${hn}张画的线条`], [`比較${tn}張畫的線條`], { quantity: n, unit: 'drawings' });
  for (const owned of [false, true]) action(`trees_${n}_${owned}`, 'drawing', [`drew ${ew} ${trees} in ${owned ? 'my' : 'a'} sketchbook`, `sketched ${n} ${trees} in ${owned ? 'my' : 'a'} sketchbook`], [`draw ${ew} ${trees} in ${owned ? 'my' : 'a'} sketchbook`], [`drawing ${ew} ${trees} in ${owned ? 'your' : 'a'} sketchbook`], [`在${owned ? '自己的' : ''}速写本上画了${hn}棵树`, `在${owned ? '自己的' : ''}速写本上画了${n}棵树`], [`在${owned ? '自己的' : ''}速写本上画${hn}棵树`], [`在${owned ? '自己的' : ''}速寫本上畫了${tn}棵樹`, `在${owned ? '自己的' : ''}速寫本上畫了${n}棵樹`], [`在${owned ? '自己的' : ''}速寫本上畫${tn}棵樹`], [`在${owned ? '自己的' : ''}速写本上画${hn}棵树`], [`在${owned ? '自己的' : ''}速寫本上畫${tn}棵樹`], { quantity: n, unit: 'trees', possession: owned ? 'AUTHOR' : 'UNSPECIFIED' });
}
for (const [role, hs, ht] of [['friend', '朋友', '朋友'], ['colleague', '同事', '同事'], ['partner', '伴侣', '伴侶']]) {
  action(`talk_${role}`, 'social', [`talked with a ${role}`, `chatted with a ${role}`], [`talk with a ${role}`], [`talking with a ${role}`, `chatting with a ${role}`], [`和一位${hs}聊天`, `和一位${hs}聊了天`], [`和一位${hs}聊天`], [`和一位${ht}聊天`, `和一位${ht}聊了天`], [`和一位${ht}聊天`], [`和一位${hs}聊天`], [`和一位${ht}聊天`], { relationship: role, quantity: 1 });
}
action('share_drawing', 'drawing', ['shared a drawing with a friend'], ['share a drawing with a friend'], ['sharing a drawing with a friend'], ['把一幅画分享给一位朋友'], ['把一幅画分享给一位朋友'], ['把一幅畫分享給一位朋友'], ['把一幅畫分享給一位朋友'], undefined, undefined, { quantity: 1, relationship: 'friend' });
const byKey = new Map(actions.map(value => [value.key, value]));
const contexts = {
  AFTER_WORK: lex('after work', '下班后', '下班後'), AFTER_STUDY: lex('after studying', '学习后', '學習後'),
  TODAY: lex('today', '今天', '今天'), YESTERDAY: lex('yesterday', '昨天', '昨天')
};
const prefixes = {
  en: [['After work, ', 'AFTER_WORK'], ['After studying, ', 'AFTER_STUDY'], ['Today, ', 'TODAY'], ['Yesterday, ', 'YESTERDAY']],
  'zh-Hans': [['下班后，', 'AFTER_WORK'], ['下班后', 'AFTER_WORK'], ['学习后，', 'AFTER_STUDY'], ['学习后', 'AFTER_STUDY'], ['今天，', 'TODAY'], ['今天', 'TODAY'], ['昨天', 'YESTERDAY']],
  'zh-Hant': [['下班後，', 'AFTER_WORK'], ['下班後', 'AFTER_WORK'], ['學習後，', 'AFTER_STUDY'], ['學習後', 'AFTER_STUDY'], ['今天，', 'TODAY'], ['今天', 'TODAY'], ['昨天', 'YESTERDAY']]
};
function removePrefix(text, locale) {
  const found = prefixes[locale].find(([prefix]) => text.startsWith(prefix));
  return found ? { text: text.slice(found[0].length), context: found[1] } : { text, context: null };
}
function parseFeeling(text, locale) {
  const prefixes = locale === 'en' ? ['felt ', 'feel '] : locale === 'zh-Hans' ? ['感到', '觉得', '感觉'] : ['感到', '覺得', '感覺'];
  const prefix = prefixes.find(value => text.startsWith(value)); if (!prefix) return null;
  const body = text.slice(prefix.length), negative = locale === 'en' ? 'not ' : '不';
  const state = value => {
    let polarity = 'POSITIVE', degree = 'PLAIN';
    if (value.startsWith(negative)) { polarity = 'NEGATIVE'; value = value.slice(negative.length); }
    const intensifiers = locale === 'en' ? [['very ', 'VERY'], ['a little ', 'LITTLE']] : [['很', 'VERY'], ['好', 'VERY'], ['有点', 'LITTLE'], ['有點', 'LITTLE']];
    // The comparative phrase is indivisible; stripping its degree would change it.
    if (feelings.more_at_ease[locale].includes(value)) return polarity === 'POSITIVE' ? { key: 'more_at_ease', degree: 'LITTLE_MORE', polarity } : null;
    for (const [form, intensity] of intensifiers) if (value.startsWith(form)) { degree = intensity; value = value.slice(form.length); break; }
    // English "not a little" can be litotes (very), not Boolean negation.
    // No cross-language mapping is proved for this scope; retain the source.
    if (polarity === 'NEGATIVE' && degree === 'LITTLE') return null;
    const key = Object.keys(feelings).find(key => key !== 'more_at_ease' && feelings[key][locale].includes(value));
    return key ? { key, degree, polarity } : null;
  };
  const single = state(body); if (single) return { kind: 'FEELING', states: [single], relation: null, sourceTense: prefix === 'feel ' ? 'PRESENT' : 'REPORTED' };
  for (const [join, relation] of locale === 'en' ? [[' but ', 'CONTRAST'], [' and ', 'AND']] : [['但', 'CONTRAST'], ['又', 'AND'], ['和', 'AND']]) {
    const parts = body.split(join); if (parts.length !== 2) continue;
    const states = parts.map(state);
    // An AND with a shared negation/degree can have more than one scope.
    if (relation === 'AND' && states.every(Boolean) && (states.some(s => s.polarity === 'NEGATIVE') || states[0].degree !== states[1].degree)) continue;
    if (states.every(Boolean)) return { kind: 'FEELING', states, relation, sourceTense: prefix === 'feel ' ? 'PRESENT' : 'REPORTED' };
  }
  return null;
}
function parseAtom(raw, locale, inheritedContext = null) {
  let { text, context } = removePrefix(raw, locale); context ||= inheritedContext;
  if (locale === 'en') for (const [key, value] of Object.entries(contexts)) {
    if (text.endsWith(` ${value.en}`)) { if (context) return null; context = key; text = text.slice(0, -value.en.length - 1); break; }
  }
  const feeling = parseFeeling(text, locale); if (feeling) return { ...feeling, context, actor: 'AUTHOR' };
  let modality = 'ACTUAL', finallyRecorded = false, polarity = 'POSITIVE';
  const modifiers = locale === 'en' ? [['planned to ', 'PLAN'], ['did not ', 'NEGATIVE'], ["didn't ", 'NEGATIVE']]
    : locale === 'zh-Hans' ? [['计划', 'PLAN'], ['没有', 'NEGATIVE']] : [['計劃', 'PLAN'], ['沒有', 'NEGATIVE']];
  for (const [prefix, value] of modifiers) if (text.startsWith(prefix)) { text = text.slice(prefix.length); if (value === 'NEGATIVE') polarity = value; else modality = value; break; }
  const finalWord = locale === 'en' ? 'finally ' : '终于'; const altFinalWord = locale === 'zh-Hant' ? '終於' : finalWord;
  if (text.startsWith(altFinalWord)) { finallyRecorded = true; text = text.slice(altFinalWord.length); }
  if (finallyRecorded && (modality !== 'ACTUAL' || polarity !== 'POSITIVE')) return null;
  const field = modality === 'PLAN' || polarity === 'NEGATIVE' ? 'base' : 'source';
  const found = actions.find(entry => entry[field][locale].includes(text));
  // English partner can mean a business/project partner. It does not prove
  // the romantic relationship asserted by 伴侣/伴侶 in the shared mapping.
  if (locale === 'en' && found?.key === 'talk_partner') return null;
  let predicate = found ? { key: found.key, theme: found.theme, ...found.fields } : null;
  // Quantity productions are bounded and consume the complete phrase.
  if (!predicate) {
    const match = locale === 'en' ? /^(studied|read) (?:for )?([1-9][0-9]?) (minutes|pages)$/.exec(text)
      : (locale === 'zh-Hans' ? /^(学习了|读了)([1-9][0-9]?)(分钟|页)$/u : /^(學習了|讀了)([1-9][0-9]?)(分鐘|頁)$/u).exec(text);
    if (match && field === 'source' && ((['studied', '学习了', '學習了'].includes(match[1]) && ['minutes', '分钟', '分鐘'].includes(match[3])) ||
      (['read', '读了', '讀了'].includes(match[1]) && ['pages', '页', '頁'].includes(match[3])))) predicate = { key: match[3] === 'pages' || match[3] === '页' || match[3] === '頁' ? 'read_pages' : 'study_minutes', theme: 'study', quantity: Number(match[2]), unit: ['pages', '页', '頁'].includes(match[3]) ? 'pages' : 'minutes' };
  }
  if (!predicate) {
    const match = locale === 'en' ? /^drew ([A-Z][a-z]+(?: [A-Z][a-z]+){0,3}) (?:using|with) charcoal$/.exec(text)
      : (locale === 'zh-Hans' ? /^用炭笔画了 ?([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})$/u : /^用炭筆畫了 ?([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})$/u).exec(text);
    if (match && field === 'source') predicate = { key: 'draw_named', theme: 'drawing', name: match[1], medium: 'charcoal' };
  }
  return predicate ? { kind: 'ACTION', ...predicate, actor: 'AUTHOR', modality, polarity, finallyRecorded, context } : null;
}
function parseSequence(raw, locale, depth = 0, inheritedContext = null, requireActor = true) {
  if (depth >= 3) return [];
  const before = removePrefix(raw, locale); let text = before.text, context = before.context || inheritedContext;
  const actor = locale === 'en' ? 'I ' : '我';
  if (text.startsWith(actor)) text = text.slice(actor.length);
  else if (requireActor) return [];
  const whole = parseAtom(text, locale, context), results = whole ? [{ atoms: [whole], relations: [] }] : [];
  const joins = locale === 'en' ? [[' and ', 'AND', false], [' but ', 'CONTRAST', false], [', then ', 'THEN', false], ['. ', 'AND', true]]
    : locale === 'zh-Hans' ? [['，然后', 'THEN', false], ['，但', 'CONTRAST', false], ['，', 'AND', false], ['。', 'AND', true]]
      : [['，然後', 'THEN', false], ['，但', 'CONTRAST', false], ['，', 'AND', false], ['。', 'AND', true]];
  for (const [join, relation, newSentence] of joins) {
    let index = text.indexOf(join);
    while (index > 0) {
      const atom = parseAtom(text.slice(0, index), locale, context);
      if (atom) for (const rest of parseSequence(text.slice(index + join.length), locale, depth + 1, newSentence ? null : context, newSentence))
        results.push({ atoms: [atom, ...rest.atoms], relations: [relation, ...rest.relations] });
      index = text.indexOf(join, index + join.length);
    }
  }
  return results;
}
export function parseRecordedConstruction(source) {
  if (typeof source !== 'string' || source.length >= 500 || !source.trim() || /[\p{Cc}\p{Cf}]/u.test(source)) return null;
  const text = source.trim().replace(/[.。!！]$/u, '');
  const parses = locales.flatMap(locale => parseSequence(text, locale).map(parsed => ({ ...parsed, sourceLocale: locale })));
  if (!parses.length) return null;
  const canonical = { atoms: parses[0].atoms, relations: parses[0].relations };
  // A date attached to planning must not migrate to the planned activity:
  // "Yesterday, I planned to rest" != "planning to rest yesterday".
  // The current fragment grammar cannot express that scope unambiguously.
  if (canonical.atoms.some(atom => atom.modality === 'PLAN' && atom.context)) return null;
  // Modal/negative multi-predicate contrast or chronology needs a separate
  // scope rule. Keep the complete source quoted rather than guessing it.
  if (canonical.atoms.some(atom => atom.modality === 'PLAN' || atom.polarity === 'NEGATIVE') && canonical.relations.some(relation => relation !== 'AND')) return null;
  if (parses.some(parsed => !same({ atoms: parsed.atoms, relations: parsed.relations }, canonical))) return null;
  return { ...canonical, sourceLocales: uniq(parses.map(parsed => parsed.sourceLocale)), actor: 'AUTHOR', rule: SOURCE_RULE_VERSION };
}
function cross(values) { return values.reduce((rows, choices) => rows.flatMap(row => choices.map(choice => [...row, choice])), [[]]); }
function number(n, locale) { return locale === 'en' ? numberWords[n] || String(n) : (locale === 'zh-Hant' && hanNumbers[n] === '两' ? '兩' : hanNumbers[n]) || String(n); }
function atomPhrases(atom, locale, date) {
  let choices;
  if (atom.kind === 'FEELING') {
    const states = atom.states.map(state => {
      const degree = state.degree === 'VERY' ? (locale === 'en' ? 'very ' : '很') : state.degree === 'LITTLE' ? (locale === 'en' ? 'a little ' : locale === 'zh-Hans' ? '有点' : '有點') : '';
      const negation = state.polarity === 'NEGATIVE' ? (locale === 'en' ? 'not ' : '不') : '';
      return negation + degree + outputFeelings[state.key][locale];
    });
    const join = atom.relation === 'CONTRAST' ? (locale === 'en' ? ' but ' : '但') : locale === 'en' ? ' and ' : '又';
    choices = [(locale === 'en' ? 'feeling ' : '感到') + states.join(join)];
  } else {
    if (byKey.has(atom.key)) choices = byKey.get(atom.key).phrase[locale];
    else if (atom.key === 'draw_named') choices = [locale === 'en' ? `drawing “${atom.name}” in charcoal` : locale === 'zh-Hans' ? `用炭笔画“${atom.name}”` : `用炭筆畫「${atom.name}」`];
    else if (atom.key === 'study_minutes') choices = [locale === 'en' ? `studying for ${atom.quantity} minutes` : locale === 'zh-Hans' ? `学习${atom.quantity}分钟` : `學習${atom.quantity}分鐘`];
    else if (atom.key === 'read_pages') choices = [locale === 'en' ? `reading ${atom.quantity} pages` : `读${atom.quantity}页`];
    else return [];
    if (atom.key === 'read_pages' && locale === 'zh-Hant') choices = [`讀${atom.quantity}頁`];
    if (atom.modality === 'PLAN') {
      if (!byKey.has(atom.key)) return [];
      choices = byKey.get(atom.key).base[locale].map(value => (locale === 'en' ? 'planning to ' : locale === 'zh-Hans' ? '计划' : '計劃') + (locale === 'en' ? value.replace(/\bmy\b/g, 'your') : value));
    }
    if (atom.polarity === 'NEGATIVE') choices = choices.map(value => (locale === 'en' ? 'not ' : '没有') + value);
    if (atom.polarity === 'NEGATIVE' && locale === 'zh-Hant') choices = choices.map(value => value.replace(/^没有/u, '沒有'));
    if (atom.finallyRecorded) choices = choices.map(value => (locale === 'en' ? 'finally ' : locale === 'zh-Hans' ? '终于' : '終於') + value);
  }
  if (atom.context === 'TODAY' || atom.context === 'YESTERDAY') {
    const actual = atom.context === 'TODAY' ? date : new Date(+new Date(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    choices = choices.map(value => locale === 'en' ? `${value} on ${actual}` : `在${actual}${value}`);
  } else if (atom.context) choices = choices.map(value => locale === 'en' ? `${value} ${contexts[atom.context].en}` : contexts[atom.context][locale] + value);
  return choices;
}
export function constructionPhrases(episode, locale, date) {
  if (!locales.includes(locale) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const products = cross(episode.atoms.map(atom => atomPhrases(atom, locale, date)));
  return uniq(products.map(parts => parts.reduce((text, part, index) => {
    if (!index) return part;
    const relation = episode.relations[index - 1];
    const scoped = episode.atoms.some(atom => atom.modality === 'PLAN' || atom.polarity === 'NEGATIVE');
    if (scoped && relation === 'AND') {
      const join = locale === 'en' ? '; you also mentioned ' : locale === 'zh-Hans' ? '；还提到' : '；還提到';
      return text + join + part;
    }
    const join = locale === 'en' ? ({ AND: parts.length > 2 && episode.relations.every(r => r === 'AND') ? (index === parts.length - 1 ? ', and ' : ', ') : ' and ', CONTRAST: ' but ', THEN: ' and then ' })[relation]
      : ({ AND: '，', CONTRAST: '，但', THEN: '，然后' })[relation];
    return text + (locale === 'zh-Hant' ? join.replace('然后', '然後') : join) + part;
  }, '')));
}
export function activityThemes(episode) {
  return uniq(episode.atoms.filter(atom => atom.kind === 'ACTION' && atom.modality === 'ACTUAL' && atom.polarity === 'POSITIVE').map(atom => atom.theme));
}
export function invitationDetails(episode, locale) {
  // A detail labels a record, never promises the artwork still exists or helped.
  const names = episode.atoms.filter(atom => atom.kind === 'ACTION' && atom.key === 'draw_named' && atom.modality === 'ACTUAL' && atom.polarity === 'POSITIVE').map(atom => atom.name);
  if (names.length === 1) return [locale === 'en' ? `the entry about “${names[0]}”` : locale === 'zh-Hans' ? `写到“${names[0]}”的那条记录` : `寫到「${names[0]}」的那則記錄`];
  return [];
}
