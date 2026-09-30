import contract from './contract.generated.json';
export type PrimaryBloomCode = keyof typeof contract.primaryBlooms;
export type SecondaryEmotion = keyof typeof contract.secondaryModifiers;
export const PRIMARY_BLOOMS = Object.keys(contract.primaryBlooms) as PrimaryBloomCode[];
export const SECONDARY_EMOTIONS = Object.keys(contract.secondaryModifiers) as SecondaryEmotion[];
export const COMPOSITIONS = ['sparse', 'normal', 'full'] as const;
export type Composition = typeof COMPOSITIONS[number];
export type ApprovalStatus = 'MISSING' | 'NEEDS_GARDEN_ART_ADAPTATION' | 'READY_FOR_REVIEW' | 'APPROVED';
export interface GardenAsset {
  asset: string; canvasWidth: number; canvasHeight: number; anchorX: number; anchorY: number;
  visualScale: number; status: ApprovalStatus; anchorStatus: 'PROVISIONAL' | 'REVIEWED';
  reviewedSha256: string | null;
}
export interface SpeciesManifest {
  speciesCode: string; displayName: string; sourceReference: string | null;
  sizeClass: 'UNRESOLVED' | 'S' | 'M' | 'L';
  gardenAssets: Record<Composition, GardenAsset>;
}
export interface FlowerVisualInput {
  flowerId: string; primaryBloom: PrimaryBloomCode; speciesCode: string;
  secondaryEmotions: readonly SecondaryEmotion[]; plantedDate?: string;
}
export type VisualState = 'OVERVIEW' | 'SELECTED';
export type EffectTier = 'SUBTLE' | 'STANDARD' | 'FOCUSED';
