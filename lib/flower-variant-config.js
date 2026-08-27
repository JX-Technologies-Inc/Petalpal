export const CANONICAL_PRIMARY_GARDEN_MOODS = Object.freeze([
  "SUNNY_BLOOM",
  "GENTLE_BLOOM",
  "QUIET_BLOOM",
  "HEALING_BLOOM",
  "FIRE_BLOOM",
  "WONDER_BLOOM",
  "DRIFTING_BLOOM",
  "PEACEFUL_BLOOM"
]);

export const LEGACY_PRIMARY_MOODS = Object.freeze([
  "happy",
  "calm",
  "tired",
  "sad",
  "stressed"
]);

// Product-owned species pools intentionally remain empty until the formal asset
// mapping is supplied. The engine uses the existing asset catalog as a shared
// compatibility fallback so canonical requests can still create a flower.
export const PRIMARY_GARDEN_MOOD_CONFIG = Object.freeze({
  SUNNY_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["joy"] },
  GENTLE_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["caring"] },
  QUIET_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["sadness"] },
  HEALING_BLOOM: { speciesPool: [], redundantSecondaryEmotions: [] },
  FIRE_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["anger"] },
  WONDER_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["curiosity"] },
  DRIFTING_BLOOM: { speciesPool: [], redundantSecondaryEmotions: ["confusion"] },
  PEACEFUL_BLOOM: { speciesPool: [], redundantSecondaryEmotions: [] },
  happy: { speciesPool: null, redundantSecondaryEmotions: ["joy"] },
  calm: { speciesPool: null, redundantSecondaryEmotions: [] },
  tired: { speciesPool: null, redundantSecondaryEmotions: [] },
  sad: { speciesPool: null, redundantSecondaryEmotions: ["sadness"] },
  stressed: { speciesPool: null, redundantSecondaryEmotions: ["anger"] }
});

export const SECONDARY_EMOTION_LABELS = Object.freeze([
  "admiration",
  "amusement",
  "anger",
  "annoyance",
  "approval",
  "caring",
  "confusion",
  "curiosity",
  "disappointment",
  "disapproval",
  "disgust",
  "excitement",
  "fear",
  "gratitude",
  "joy",
  "love",
  "neutral",
  "optimism",
  "remorse",
  "sadness",
  "surprise"
]);

export const EXCLUDED_SECONDARY_EMOTIONS = Object.freeze([
  "neutral",
  "approval",
  "disapproval"
]);

export const SECONDARY_EMOTION_CLUSTERS = Object.freeze({
  UPBEAT: ["joy", "amusement", "excitement", "optimism"],
  WARM_SOCIAL: ["gratitude", "love", "caring", "admiration"],
  REFLECTIVE: ["sadness", "disappointment", "remorse"],
  THREAT_INTENSITY: ["anger", "annoyance", "fear", "disgust"],
  EXPLORATION: ["curiosity", "confusion", "surprise"]
});

export const SECONDARY_FLOWER_MODIFIERS = Object.freeze({
  admiration: { colorAccent: "PEARL_GOLD", effect: "SOFT_SHIMMER" },
  amusement: { colorAccent: "BRIGHT_CORAL", effect: "PLAYFUL_SPARKLE" },
  anger: { colorAccent: "EMBER_RED", effect: "HEAT_SPARK" },
  annoyance: { colorAccent: "SHARP_ORANGE", effect: "SUBTLE_FLICKER" },
  caring: { colorAccent: "WARM_CREAM", effect: "GENTLE_GLOW" },
  confusion: { colorAccent: "MIXED_VIOLET", effect: "DRIFTING_MOTES" },
  curiosity: { colorAccent: "IRIDESCENT_BLUE", effect: "ORBITING_MOTES" },
  disappointment: { colorAccent: "MUTED_BLUE", effect: "SOFT_RAIN" },
  disgust: { colorAccent: "COOL_GREEN", effect: "SUBTLE_SPORES" },
  excitement: { colorAccent: "VIVID_GOLD", effect: "BURST_SPARKLE" },
  fear: { colorAccent: "COOL_DARK_EDGE", effect: "SUBTLE_MIST" },
  gratitude: { colorAccent: "WARM_GOLD", effect: "SOFT_SPARKLE" },
  joy: { colorAccent: "SUNLIT_YELLOW", effect: "SUNLIGHT" },
  love: { colorAccent: "SOFT_PINK", effect: "GENTLE_GLOW" },
  optimism: { colorAccent: "DAWN_GOLD", effect: "RISING_LIGHT" },
  remorse: { colorAccent: "SILVER_BLUE", effect: "DEW_SHIMMER" },
  sadness: { colorAccent: "COOL_BLUE", effect: "SOFT_RAIN" },
  surprise: { colorAccent: "CONTRAST_POP", effect: "FLASH_SPARKLE" }
});

export function isSupportedPrimaryGardenMood(value) {
  return Object.hasOwn(PRIMARY_GARDEN_MOOD_CONFIG, value);
}

export function speciesCodeForName(name) {
  return String(name || "FLOWER")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function compatibilitySpeciesPool(flowerCatalog) {
  const configured = Object.values(flowerCatalog || {}).flat();
  const seen = new Set();
  return configured
    .filter((flower) => {
      const key = speciesCodeForName(flower?.name);
      if (!flower?.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((flower) => ({ ...flower, speciesCode: speciesCodeForName(flower.name) }));
}

export function speciesPoolForPrimary(primaryGardenMood, flowerCatalog) {
  const config = PRIMARY_GARDEN_MOOD_CONFIG[primaryGardenMood];
  if (!config) return { pool: [], source: "UNSUPPORTED" };
  if (Array.isArray(config.speciesPool) && config.speciesPool.length) {
    return { pool: config.speciesPool, source: "PRIMARY_CONFIG" };
  }
  if (LEGACY_PRIMARY_MOODS.includes(primaryGardenMood)) {
    return {
      pool: (flowerCatalog[primaryGardenMood] || []).map((flower) => ({
        ...flower,
        speciesCode: flower.speciesCode || speciesCodeForName(flower.name)
      })),
      source: "LEGACY_PRIMARY_CONFIG"
    };
  }
  return {
    pool: compatibilitySpeciesPool(flowerCatalog),
    source: "LEGACY_COMPATIBILITY_FALLBACK"
  };
}
