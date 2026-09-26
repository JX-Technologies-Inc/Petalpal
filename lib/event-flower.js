import flowerDB from "../data/flowerDB.js";
import { generateFlowerMetadata } from "./flower-engine.js";
import { isSupportedPrimaryGardenMood, speciesPoolForPrimary, EXCLUDED_SECONDARY_EMOTIONS, SECONDARY_EMOTION_LABELS } from "./flower-variant-config.js";
import { selectFlowerSecondaryEmotions } from "./secondary-emotion-selector.js";

const productLabels = new Set(SECONDARY_EMOTION_LABELS.filter((label) => !EXCLUDED_SECONDARY_EMOTIONS.includes(label)));

export function canonicalEventLabels(result, primaryGardenMood) {
  const labels = result?.labels;
  if (!Array.isArray(labels) || labels.length > 2 || new Set(labels).size !== labels.length || labels.some((label) => !productLabels.has(label))) return null;
  const selected = selectFlowerSecondaryEmotions({ primaryGardenMood, candidates: labels });
  return selected.length === labels.length && selected.every((item, index) => item.label === labels[index]) ? labels : null;
}

export function previewEventFlower({ userId, localDate, primaryGardenMood, labels = [], recentFlowers = [] }) {
  if (!isSupportedPrimaryGardenMood(primaryGardenMood)) return null;
  const { pool: options } = speciesPoolForPrimary(primaryGardenMood, flowerDB);
  return generateFlowerMetadata({
    options, primaryGardenMood, localDate, userId, recentFlowers,
    secondaryEmotions: selectFlowerSecondaryEmotions({ primaryGardenMood, candidates: labels })
  });
}
