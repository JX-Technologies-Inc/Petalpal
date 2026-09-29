import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlowerPlacement } from './placementValidator';
import type { FlowerMessage } from './flowerDetailData';

export interface FlowerPlacementRecord extends FlowerPlacement {
  supportCount: number;
  notes?: string;
  ownerUserId?: string;
  meaning?: string;
  image?: string;
  messages?: FlowerMessage[];
}

const STORAGE_KEY = 'petalpal_flower_placements_v1';

// Initial seed flowers for demonstration and verification
export const DEFAULT_SEED_PLACEMENTS: FlowerPlacementRecord[] = [
  {
    id: 'flower-seed-1',
    flowerId: 'fl-jan-01',
    journalEntryId: 'entry-jan-01',
    plantedDate: '2026-01-15T10:00:00.000Z',
    month: 1,
    worldX: 1200.0,
    worldY: 562.0,
    scale: 1,
    rotation: 0,
    placementVersion: 1,
    flowerName: 'pink',
    speciesCode: 'PINK_LILY',
    mood: 'Peaceful',
    supportCount: 5,
    notes: 'A quiet morning reflection in the January meadow.',
  },
  {
    id: 'flower-seed-2',
    flowerId: 'fl-may-01',
    journalEntryId: 'entry-may-01',
    plantedDate: '2026-05-12T14:30:00.000Z',
    month: 5,
    worldX: 1524.0,
    worldY: 352.0,
    scale: 1,
    rotation: 0,
    placementVersion: 1,
    flowerName: 'purple',
    speciesCode: 'PURPLE_BELL',
    mood: 'Grateful',
    supportCount: 12,
    notes: 'Planted after a productive coding session.',
  },
  {
    id: 'flower-seed-3',
    flowerId: 'fl-jun-01',
    journalEntryId: 'entry-jun-01',
    plantedDate: '2026-06-20T09:15:00.000Z',
    month: 6,
    worldX: 1838.0,
    worldY: 320.0,
    scale: 1,
    rotation: 0,
    placementVersion: 1,
    flowerName: 'sunflower',
    speciesCode: 'SUNFLOWER',
    mood: 'Energized',
    supportCount: 8,
    notes: 'Summer sun warming the northeastern bluffs.',
  },
  {
    id: 'flower-seed-4',
    flowerId: 'fl-sep-01',
    journalEntryId: 'entry-sep-01',
    plantedDate: '2026-09-08T16:45:00.000Z',
    month: 9,
    worldX: 1166.0,
    worldY: 1332.0,
    scale: 1,
    rotation: 0,
    placementVersion: 1,
    flowerName: 'tulip',
    speciesCode: 'ORANGE_TULIP',
    mood: 'Hopeful',
    supportCount: 3,
    notes: 'Welcoming autumn near the southern gate.',
  },
];

// Cache only; browser and native storage remain the durable source of truth.
let memoryPlacementsStore: FlowerPlacementRecord[] | null = null;

export async function loadFlowerPlacements(): Promise<FlowerPlacementRecord[]> {
  try {
    {
      const stored = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(STORAGE_KEY)
        : await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          memoryPlacementsStore = parsed;
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[plantingPersistence] Failed to read localStorage:', err);
  }

  if (memoryPlacementsStore !== null) {
    return memoryPlacementsStore;
  }

  // An empty installation starts empty. Loading must never create or commit
  // unconfirmed flower coordinates; existing saved records are retained above.
  memoryPlacementsStore = [];
  return memoryPlacementsStore;
}

export async function saveFlowerPlacements(
  placements: FlowerPlacementRecord[]
): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
    }
    memoryPlacementsStore = placements;
  } catch (err) {
    console.warn('[plantingPersistence] Failed to write to localStorage:', err);
    throw err;
  }
}

export async function addOrUpdateFlowerPlacement(
  placement: FlowerPlacementRecord
): Promise<FlowerPlacementRecord[]> {
  const current = await loadFlowerPlacements();
  const existingIdx = current.findIndex(
    (p) => p.flowerId === placement.flowerId || p.id === placement.id
  );

  let updated: FlowerPlacementRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = {
      ...current[existingIdx],
      ...placement,
      placementVersion: 1,
    };
  } else {
    updated = [...current, { ...placement, placementVersion: 1 }];
  }

  await saveFlowerPlacements(updated);
  return updated;
}

export async function removeFlowerPlacement(
  flowerId: string
): Promise<FlowerPlacementRecord[]> {
  const current = await loadFlowerPlacements();
  const updated = current.filter((p) => p.flowerId !== flowerId && p.id !== flowerId);
  await saveFlowerPlacements(updated);
  return updated;
}

export async function resetFlowerPlacements(): Promise<FlowerPlacementRecord[]> {
  memoryPlacementsStore = [...DEFAULT_SEED_PLACEMENTS];
  await saveFlowerPlacements(memoryPlacementsStore);
  return memoryPlacementsStore;
}
