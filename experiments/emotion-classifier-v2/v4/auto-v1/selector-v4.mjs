// Experimental ablation only. Production selector is unchanged.
import { SECONDARY_EMOTION_LABELS, EXCLUDED_SECONDARY_EMOTIONS, PRIMARY_GARDEN_MOOD_CONFIG } from '../../../../lib/flower-variant-config.js';
const supported = new Set(SECONDARY_EMOTION_LABELS);
const excluded = new Set(EXCLUDED_SECONDARY_EMOTIONS);
export function selectWithoutBroadClusters({primaryGardenMood, candidates, maxSecondaryEmotions = 2}) {
  const limit = Math.max(0, Math.min(2, Number(maxSecondaryEmotions) || 0));
  if (!limit || !Array.isArray(candidates)) return [];
  const redundant = new Set(PRIMARY_GARDEN_MOOD_CONFIG[primaryGardenMood]?.redundantSecondaryEmotions || []);
  const unique = new Map();
  candidates.forEach((item,index) => {
    const label = String(typeof item === 'string' ? item : item?.label || '').trim().toLowerCase();
    const score = Number.isFinite(item?.score) ? Math.max(0,Math.min(1,item.score)) : 0;
    if (!supported.has(label) || excluded.has(label) || redundant.has(label)) return;
    if (!unique.has(label) || score > unique.get(label).score) unique.set(label,{label,score,index});
  });
  return [...unique.values()].sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,limit)
    .map(({label,score},i)=>({label,score,role:i?'ACCENT_VARIANT':'PRIMARY_VARIANT'}));
}
