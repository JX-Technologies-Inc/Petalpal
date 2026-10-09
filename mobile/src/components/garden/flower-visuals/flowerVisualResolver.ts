import contract from './contract.generated.json';
import manifest from './gardenArtManifest.json';
import { getFlowerPlacementDefinition } from '../planting/flowerFootprintConfig';
import { EMOTION_STYLES, NEUTRAL_STYLE } from './emotionStyles';
import { COMPOSITIONS, PRIMARY_BLOOMS, SECONDARY_EMOTIONS,
  type Composition, type FlowerVisualInput, type SpeciesManifest, type VisualState, type EffectTier, type SecondaryEmotion } from './flowerVisualTypes';
export const FLOWER_CATALOG = (manifest as SpeciesManifest[]).map(species => ({
  ...species,
  primaryBloomMappingStatus: 'MAPPING_UNRESOLVED' as const,
  supportedCompositionVariants: COMPOSITIONS,
  defaultVisualScale: 1,
  // References the locked placement authority; never uses PNG bounds or sandbox radii.
  ...getFlowerPlacementDefinition(species.displayName),
}));
export function compositionForId(id: string): Composition {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return COMPOSITIONS[hash % COMPOSITIONS.length];
}
export function resolveFlowerVisual(input: FlowerVisualInput, options: {
  devPreview?: boolean; composition?: Composition; state?: VisualState; selectedTier?: EffectTier;
} = {}) {
  const issues: string[] = [];
  const validPrimary = PRIMARY_BLOOMS.includes(input.primaryBloom);
  if (!validPrimary) issues.push('INVALID_PRIMARY');
  const validId = typeof input.flowerId === 'string' && input.flowerId.length > 0;
  if (!validId) issues.push('INVALID_FLOWER_ID');
  const supplied = input.secondaryEmotions;
  // Reject the entire malformed list rather than promoting accent into the main role.
  const validList = Array.isArray(supplied) && supplied.length <= 2
    && supplied.every((e) => SECONDARY_EMOTIONS.includes(e)) && new Set(supplied).size === supplied.length;
  if (!validList) issues.push('INVALID_SECONDARY_LIST');
  const secondary: SecondaryEmotion[] = validList ? [...supplied] : [];
  if (validPrimary && secondary.some(e => (contract.primaryBlooms[input.primaryBloom].redundantSecondaryEmotions as string[]).includes(e))) {
    issues.push('BACKEND_REDUNDANCY_FILTER_EXPECTED');
  }
  // Never choose or reinterpret species. Canonical pools intentionally remain unresolved.
  const primary = validPrimary ? contract.primaryBlooms[input.primaryBloom] : null;
  if (primary && primary.speciesPool.length === 0) issues.push('PRIMARY_SPECIES_MAPPING_UNRESOLVED');
  const species = FLOWER_CATALOG.find(s => s.speciesCode === input.speciesCode) ?? null;
  if (!species) issues.push('UNKNOWN_SPECIES');
  const compositionVariant = options.composition && COMPOSITIONS.includes(options.composition)
    ? options.composition : compositionForId(validId ? input.flowerId : 'invalid');
  const gardenAsset = species?.gardenAssets[compositionVariant] ?? null;
  const allowed = gardenAsset?.status === 'APPROVED' || (options.devPreview === true && gardenAsset?.status === 'READY_FOR_REVIEW');
  if (!allowed) issues.push('MISSING_APPROVED_GARDEN_ART');
  const metadataValid = gardenAsset && [gardenAsset.anchorX, gardenAsset.anchorY].every(v => Number.isFinite(v) && v >= 0 && v <= 1)
    && Number.isFinite(gardenAsset.visualScale) && gardenAsset.visualScale > 0;
  if (gardenAsset && !metadataValid) issues.push('INVALID_ASSET_METADATA');
  const mainEmotionStyle = secondary[0] ? EMOTION_STYLES[secondary[0]].mainVariantStyle : NEUTRAL_STYLE;
  const accent = secondary[1] ? EMOTION_STYLES[secondary[1]] : null;
  const placement = getFlowerPlacementDefinition(species?.displayName);
  return { flowerId: input.flowerId, primaryBloom: input.primaryBloom, speciesCode: input.speciesCode,
    secondaryEmotions: secondary, compositionVariant, gardenAsset, species, issues,
    renderable: Boolean(allowed && metadataValid && validId && validPrimary),
    mainEmotionStyle, colorAccent: mainEmotionStyle.colorAccent,
    visualEffect: accent?.visualEffect ?? 'NONE', accentEffect: accent?.secondaryEffect ?? 'none',
    accentColor: accent?.mainVariantStyle.highlight ?? NEUTRAL_STYLE.highlight,
    // The backend legacy variant field uses the first effect when no second exists.
    // Expose it for diagnostics; the ordered list is authoritative for the new four-layer renderer.
    backendVisualEffect: secondary.length ? contract.secondaryModifiers[secondary[1] ?? secondary[0]].effect : 'NONE',
    effectTier: options.state === 'SELECTED' ? (options.selectedTier ?? 'STANDARD') : 'SUBTLE' as EffectTier,
    footprintRadius: placement.footprintRadius, visualWidth: placement.visualWidth,
    visualHeight: placement.visualHeight, postureApplied: false,
  };
}
export type ResolvedFlowerVisual = ReturnType<typeof resolveFlowerVisual>;
export function groundRect(asset: { anchorX: number; anchorY: number; visualScale: number },
  worldX: number, worldY: number, width: number, height: number) {
  const w = width * asset.visualScale, h = height * asset.visualScale;
  return { x: worldX - asset.anchorX * w, y: worldY - asset.anchorY * h, width: w, height: h };
}
export function sortVisualsByGroundY<T extends { id: string; worldY: number }>(flowers: readonly T[]): T[] {
  return [...flowers].sort((a,b) => a.worldY - b.worldY || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
