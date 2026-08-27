import {
  EXCLUDED_SECONDARY_EMOTIONS,
  PRIMARY_GARDEN_MOOD_CONFIG,
  SECONDARY_EMOTION_CLUSTERS,
  SECONDARY_EMOTION_LABELS,
  SECONDARY_FLOWER_MODIFIERS
} from "./flower-variant-config.js";

const supportedLabels = new Set(SECONDARY_EMOTION_LABELS);
const excludedLabels = new Set(EXCLUDED_SECONDARY_EMOTIONS);
const clusterByLabel = new Map(
  Object.entries(SECONDARY_EMOTION_CLUSTERS).flatMap(([cluster, labels]) =>
    labels.map((label) => [label, cluster])
  )
);

function normalizeCandidate(candidate, index) {
  const label = typeof candidate === "string" ? candidate : candidate?.label;
  const score = typeof candidate === "object" && Number.isFinite(candidate?.score)
    ? Math.max(0, Math.min(1, candidate.score))
    : null;
  return {
    label: String(label || "").trim().toLowerCase(),
    score,
    originalIndex: index
  };
}

export function selectFlowerSecondaryEmotions({
  primaryGardenMood,
  candidates,
  maxSecondaryEmotions = 2
}) {
  const limit = Math.max(0, Math.min(2, Number(maxSecondaryEmotions) || 0));
  if (!limit || !Array.isArray(candidates)) return [];

  const redundant = new Set(
    PRIMARY_GARDEN_MOOD_CONFIG[primaryGardenMood]?.redundantSecondaryEmotions || []
  );
  const unique = new Map();
  candidates.forEach((candidate, index) => {
    const normalized = normalizeCandidate(candidate, index);
    if (
      !supportedLabels.has(normalized.label) ||
      excludedLabels.has(normalized.label) ||
      redundant.has(normalized.label) ||
      !SECONDARY_FLOWER_MODIFIERS[normalized.label]
    ) return;
    const existing = unique.get(normalized.label);
    if (!existing || (normalized.score ?? -1) > (existing.score ?? -1)) {
      unique.set(normalized.label, normalized);
    }
  });

  const ranked = [...unique.values()].sort((left, right) => {
    if (left.score !== null || right.score !== null) {
      return (right.score ?? -1) - (left.score ?? -1) || left.originalIndex - right.originalIndex;
    }
    return left.originalIndex - right.originalIndex;
  });

  const selected = [];
  const usedClusters = new Set();
  for (const candidate of ranked) {
    const cluster = clusterByLabel.get(candidate.label) || candidate.label;
    if (usedClusters.has(cluster)) continue;
    selected.push({
      label: candidate.label,
      score: candidate.score,
      role: selected.length === 0 ? "PRIMARY_VARIANT" : "ACCENT_VARIANT"
    });
    usedClusters.add(cluster);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function flowerVariantForSecondaryEmotions(selectedSecondaryEmotions) {
  const first = selectedSecondaryEmotions?.[0];
  const second = selectedSecondaryEmotions?.[1];
  const primaryModifier = first ? SECONDARY_FLOWER_MODIFIERS[first.label] : null;
  const accentModifier = second ? SECONDARY_FLOWER_MODIFIERS[second.label] : null;
  return {
    colorAccent: primaryModifier?.colorAccent || accentModifier?.colorAccent || null,
    effect: accentModifier?.effect || primaryModifier?.effect || null
  };
}
