// Authoritative flower placement and footprint metadata definitions.

export interface FlowerPlacementDefinition {
  footprintRadius: number; // Radius of logical hole/planting base (collision shape)
  hitboxRadius: number;    // Radius of clickable touch target
  visualWidth: number;     // Rendered width in Garden world units
  visualHeight: number;    // Rendered height in Garden world units
}

export const DEFAULT_FLOWER_PLACEMENT_DEF: FlowerPlacementDefinition = {
  footprintRadius: 22,
  hitboxRadius: 40,
  visualWidth: 76,
  visualHeight: 76,
};

// Flower species-specific definitions if needed (all use consistent standard hole size)
export const FLOWER_PLACEMENT_DEFINITIONS: Record<string, FlowerPlacementDefinition> = {
  default: DEFAULT_FLOWER_PLACEMENT_DEF,
  Sunflower: {
    footprintRadius: 24,
    hitboxRadius: 44,
    visualWidth: 84,
    visualHeight: 84,
  },
  Tulip: {
    footprintRadius: 20,
    hitboxRadius: 38,
    visualWidth: 70,
    visualHeight: 70,
  },
  Lotus: {
    footprintRadius: 22,
    hitboxRadius: 40,
    visualWidth: 76,
    visualHeight: 76,
  },
  Lavender: {
    footprintRadius: 20,
    hitboxRadius: 38,
    visualWidth: 72,
    visualHeight: 72,
  },
  'Cherry Blossom': {
    footprintRadius: 22,
    hitboxRadius: 40,
    visualWidth: 76,
    visualHeight: 76,
  },
};

export function getFlowerPlacementDefinition(speciesOrName?: string): FlowerPlacementDefinition {
  if (!speciesOrName) return DEFAULT_FLOWER_PLACEMENT_DEF;
  const direct = FLOWER_PLACEMENT_DEFINITIONS[speciesOrName];
  if (direct) return direct;

  const lower = speciesOrName.toLowerCase();
  for (const [key, val] of Object.entries(FLOWER_PLACEMENT_DEFINITIONS)) {
    if (key.toLowerCase() === lower || lower.includes(key.toLowerCase())) {
      return val;
    }
  }
  return DEFAULT_FLOWER_PLACEMENT_DEF;
}
