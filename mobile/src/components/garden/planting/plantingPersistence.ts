import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlowerPlacement } from './placementValidator';
import type { FlowerMessage } from './flowerDetailData';

export interface FlowerPlacementRecord extends FlowerPlacement {
  supportCount: number;
  sourceType?: import('../../../services/garden').FlowerSource;
  dailyCheckInId?: string;
  placementOrigin?: 'LOCAL' | 'FALLBACK';
  variant?: string;
  rarity?: string;
  growthState?: string;
  season?: string;
  sourceEventId?: string;
  secondaryEmotions?: string[];
  colorAccent?: string;
  visualEffect?: string;
  notes?: string;
  ownerUserId?: string;
  meaning?: string;
  image?: string;
  messages?: FlowerMessage[];
}

// PetalPal private-store registry: placements include derived emotions/details.
// Theme/background, calibration/masks and Firebase SDK persistence are excluded.
const LEGACY_KEY = 'petalpal_flower_placements_v1';
const ownerKey = (owner: string) => `${LEGACY_KEY}:${encodeURIComponent(owner)}`;
let activeOwner: string | null = null;
let generation = 0;
let storageReady = false;
let storageQueue: Promise<unknown> = Promise.resolve();
const pendingErasure = new Set<string>();
export interface PlacementSession { owner: string | null; generation: number }
export const capturePlacementSession = (): PlacementSession => ({ owner: activeOwner, generation });
const current = (session: PlacementSession) => session.owner !== null &&
  session.owner === activeOwner && session.generation === generation;
const cacheError = () => new Error('Private device cache is unavailable. Please sign in again.');
function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(action);
  storageQueue = result.catch(() => {});
  return result;
}
async function eraseKey(key: string) {
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
  else await AsyncStorage.removeItem(key);
}
// Invalidate synchronously; physical erasure follows any already-started write.
// Each activation starts fresh, including after process restart/failed cleanup.
export function scopeFlowerPlacements(owner: string | null): Promise<boolean> {
  const outgoing = activeOwner;
  activeOwner = owner; generation++; storageReady = false; memoryPlacementsStore = null;
  const session = capturePlacementSession();
  pendingErasure.add(LEGACY_KEY);
  if (outgoing) pendingErasure.add(ownerKey(outgoing));
  if (owner) pendingErasure.add(ownerKey(owner));
  return enqueue(async () => {
    try {
      // Recover orphaned owner caches from earlier processes/accounts, using
      // only the PetalPal placement namespace. Never clear the storage adapter.
      const browser = typeof window !== 'undefined' ? window.localStorage : null;
      const persistedKeys = browser
        ? Array.from({ length: browser.length }, (_, index) => browser.key(index))
        : await AsyncStorage.getAllKeys();
      for (const key of persistedKeys) {
        if (key === LEGACY_KEY || key?.startsWith(`${LEGACY_KEY}:`)) pendingErasure.add(key);
      }
      for (const key of pendingErasure) {
        await eraseKey(key);
        pendingErasure.delete(key);
      }
      if (session.generation === generation) storageReady = true;
      return true;
    } catch {
      // Never log storage errors: adapters can embed private payloads in errors.
      return false; // Reads/writes remain closed until a successful activation.
    }
  });
}

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

export async function loadFlowerPlacements(
  session = capturePlacementSession()
): Promise<FlowerPlacementRecord[]> {
  return enqueue(async () => {
    if (!current(session)) return [];
    if (!storageReady) throw cacheError();
    try {
      const key = ownerKey(session.owner!);
      const stored = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key) : await AsyncStorage.getItem(key);
      if (!current(session)) return [];
      const parsed = stored ? JSON.parse(stored) : [];
      memoryPlacementsStore = Array.isArray(parsed) ? parsed : [];
      return memoryPlacementsStore;
    } catch { storageReady = false; memoryPlacementsStore = null; throw cacheError(); }
  });
}

export async function saveFlowerPlacements(
  placements: FlowerPlacementRecord[], session = capturePlacementSession()
): Promise<void> {
  return enqueue(async () => {
    if (!current(session)) return;
    if (!storageReady) throw cacheError();
    try {
      const key = ownerKey(session.owner!);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(placements));
      } else await AsyncStorage.setItem(key, JSON.stringify(placements));
      if (current(session)) memoryPlacementsStore = placements;
      // A transition during setItem queued erasure behind this write.
    } catch { storageReady = false; memoryPlacementsStore = null; throw cacheError(); }
  });
}

export async function addOrUpdateFlowerPlacement(
  placement: FlowerPlacementRecord, session = capturePlacementSession()
): Promise<FlowerPlacementRecord[]> {
  const loaded = await loadFlowerPlacements(session);
  if (!current(session)) return [];
  const existingIdx = loaded.findIndex(
    (p) => p.flowerId === placement.flowerId || p.id === placement.id
  );

  let updated: FlowerPlacementRecord[];
  if (existingIdx >= 0) {
    updated = [...loaded];
    updated[existingIdx] = {
      ...loaded[existingIdx],
      ...placement,
      placementVersion: 1,
    };
  } else {
    updated = [...loaded, { ...placement, placementVersion: 1 }];
  }

  await saveFlowerPlacements(updated, session);
  return current(session) ? updated : [];
}

export async function removeFlowerPlacement(
  flowerId: string, session = capturePlacementSession()
): Promise<FlowerPlacementRecord[]> {
  const loaded = await loadFlowerPlacements(session);
  if (!current(session)) return [];
  const updated = loaded.filter((p) => p.flowerId !== flowerId && p.id !== flowerId);
  await saveFlowerPlacements(updated, session);
  return current(session) ? updated : [];
}

export async function resetFlowerPlacements(session = capturePlacementSession()): Promise<FlowerPlacementRecord[]> {
  const defaults = [...DEFAULT_SEED_PLACEMENTS];
  await saveFlowerPlacements(defaults, session);
  return current(session) ? defaults : [];
}
