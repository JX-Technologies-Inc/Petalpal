import { createHash } from "node:crypto";
import { speciesCodeForName } from "./flower-variant-config.js";
import { flowerVariantForSecondaryEmotions } from "./secondary-emotion-selector.js";

const RARITY_THRESHOLDS = [
  { max: 0.02, rarity: "RARE" },
  { max: 0.17, rarity: "UNCOMMON" },
  { max: 1, rarity: "COMMON" }
];

function stableFraction(seed, namespace) {
  const hex = createHash("sha256").update(`${namespace}:${seed}`).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

export function seasonForLocalDate(localDate) {
  const month = Number(String(localDate).slice(5, 7));
  if ([3, 4, 5].includes(month)) return "SPRING";
  if ([6, 7, 8].includes(month)) return "SUMMER";
  if ([9, 10, 11].includes(month)) return "AUTUMN";
  return "WINTER";
}

function selectCandidate(options, recentFlowerNames, seed) {
  const recent = new Set(recentFlowerNames.slice(0, Math.max(0, options.length - 1)));
  const fresh = options.filter((option) => !recent.has(option.name));
  const pool = fresh.length ? fresh : options;
  return pool[Math.floor(stableFraction(seed, "species") * pool.length)];
}

function selectRarity(seed, intensity) {
  const intensityBoost = Math.max(0, Math.min(0.03, (Number(intensity) || 0) * 0.03));
  const roll = Math.max(0, stableFraction(seed, "rarity") - intensityBoost);
  return RARITY_THRESHOLDS.find(({ max }) => roll < max).rarity;
}

function visualEffectFor({ rarity, season, mood }) {
  if (rarity === "RARE") return "PRISM_SPARKLE";
  if (season === "SPRING") return "PETAL_DRIFT";
  if (season === "WINTER") return "SOFT_GLOW";
  if (mood === "happy") return "SUNLIGHT";
  if (mood === "calm") return "GENTLE_BREEZE";
  return null;
}

export function generateFlowerMetadata({
  options,
  primaryGardenMood,
  mood = primaryGardenMood,
  secondaryEmotions = [],
  intensity = null,
  localDate,
  userId,
  recentFlowers = []
}) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("No flower configuration found for this mood");
  }

  const selectedSecondaryLabels = secondaryEmotions.map(({ label }) => label);
  const generationSeed = createHash("sha256")
    .update(`${userId}:${localDate}:${mood}:${selectedSecondaryLabels.join(",") || "none"}`)
    .digest("hex");
  const selected = selectCandidate(options, recentFlowers.map(({ name }) => name), generationSeed);
  const season = seasonForLocalDate(localDate);
  const rarity = selectRarity(generationSeed, intensity);
  const variant = rarity === "RARE" ? "luminous" : season.toLowerCase();
  const semanticVariant = flowerVariantForSecondaryEmotions(secondaryEmotions);

  return {
    ...selected,
    speciesCode: selected.speciesCode || speciesCodeForName(selected.name),
    variant,
    rarity,
    growthState: "BLOOMED",
    colorAccent: semanticVariant.colorAccent,
    visualEffect: semanticVariant.effect || visualEffectFor({ rarity, season, mood }),
    season,
    generationSeed
  };
}
