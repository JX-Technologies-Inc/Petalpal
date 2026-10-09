import { resolveParentCollision, UNRESOLVED_PARENT_COLLISION_RADIUS } from './parentCollision';
// Visual/hit-target metadata is preserved; parent radius comes from one resolver.

export interface FlowerPlacementDefinition {
  footprintRadius: number; // Radius of logical hole/planting base (collision shape)
  hitboxRadius: number;    // Radius of clickable touch target
  visualWidth: number;     // Rendered width in Garden world units
  visualHeight: number;    // Rendered height in Garden world units
}

export const DEFAULT_FLOWER_PLACEMENT_DEF: FlowerPlacementDefinition = {
  footprintRadius: UNRESOLVED_PARENT_COLLISION_RADIUS,
  hitboxRadius: 40,
  visualWidth: 76,
  visualHeight: 76,
};

// Historical visual and hit-target dimensions; unresolved legacy entries are
// conservative occupied-anchor metadata, not approved new planting classes.
export const FLOWER_PLACEMENT_DEFINITIONS: Record<string, FlowerPlacementDefinition> = {
  default: DEFAULT_FLOWER_PLACEMENT_DEF,
  Sunflower: {
    footprintRadius: resolveParentCollision('SUNFLOWER').radius,
    hitboxRadius: 44,
    visualWidth: 84,
    visualHeight: 84,
  },
  Tulip: {
    footprintRadius: resolveParentCollision('TULIP').radius,
    hitboxRadius: 38,
    visualWidth: 70,
    visualHeight: 70,
  },
  Lotus: {
    footprintRadius: UNRESOLVED_PARENT_COLLISION_RADIUS,
    hitboxRadius: 40,
    visualWidth: 76,
    visualHeight: 76,
  },
  Lavender: {
    footprintRadius: resolveParentCollision('LAVENDER').radius,
    hitboxRadius: 38,
    visualWidth: 72,
    visualHeight: 72,
  },
  'Cherry Blossom': {
    footprintRadius: UNRESOLVED_PARENT_COLLISION_RADIUS,
    hitboxRadius: 40,
    visualWidth: 76,
    visualHeight: 76,
  },
};

export function getFlowerPlacementDefinition(speciesOrName?: string, speciesCode?: string): FlowerPlacementDefinition {
  const radius = resolveParentCollision(speciesCode, speciesOrName).radius;
  if (!speciesOrName) return { ...DEFAULT_FLOWER_PLACEMENT_DEF, footprintRadius: radius };
  const direct = FLOWER_PLACEMENT_DEFINITIONS[speciesOrName];
  if (direct) return { ...direct, footprintRadius: radius };

  const lower = speciesOrName.toLowerCase();
  for (const [key, val] of Object.entries(FLOWER_PLACEMENT_DEFINITIONS)) {
    if (key.toLowerCase() === lower || lower.includes(key.toLowerCase())) {
      return { ...val, footprintRadius: radius };
    }
  }
  return { ...DEFAULT_FLOWER_PLACEMENT_DEF, footprintRadius: radius };
}
