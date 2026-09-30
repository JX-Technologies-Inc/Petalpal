import { findJournalEntry } from '../../../data/journalEntries';
import type { FlowerPlacementRecord } from './plantingPersistence';

export interface FlowerMessage {
  id?: string;
  author?: string;
  senderName?: string;
  text: string;
  pending?: boolean;
  createdAt?: string;
}

export interface FlowerSupportState {
  localDate: string;
  timezone: string;
  supportedToday: boolean;
  canSupport: boolean;
  isOwner: boolean;
}

export interface FlowerSourceDetail {
  id: string;
  userId: string;
  name: string;
  mood: string;
  event?: string;
  meaning?: string;
  img?: string;
  supportCount: number;
  messages?: FlowerMessage[];
  journalEntryId?: string | null;
  dailyCheckIn?: {
    journal?: { id: string; content: string } | null;
  } | null;
  supportState?: FlowerSupportState;
}

export interface FlowerAccess {
  currentUserId?: string;
  gardenOwnerUserId?: string;
  localOwner: boolean;
}

export function mergeFlowerSource(current: FlowerSourceDetail | null, incoming: FlowerSourceDetail,
  personalState: 'response' | 'broadcast' | 'refresh' = 'response'): FlowerSourceDetail {
  if (!current || current.id !== incoming.id) {
    return personalState === 'broadcast' ? { ...incoming, supportState: undefined } : incoming;
  }
  const sameDay = current.supportState?.localDate === incoming.supportState?.localDate;
  const supportState = personalState === 'broadcast' ? current.supportState
    : personalState === 'refresh' && sameDay && current.supportState?.supportedToday
      ? current.supportState : incoming.supportState || current.supportState;
  const messages = new Map<string, FlowerMessage>();
  for (const message of [...(current.messages || []), ...(incoming.messages || [])]) {
    if (personalState === 'response' && message.pending) continue;
    const key = message.id || message.createdAt || `${message.author || message.senderName || 'Friend'}:${message.text}`;
    messages.set(key, message);
  }
  return { ...current, ...incoming, supportState, messages: [...messages.values()],
    supportCount: Math.max(current.supportCount, incoming.supportCount) };
}

export function ownsFlower(flower: FlowerPlacementRecord, access: FlowerAccess): boolean {
  if (access.gardenOwnerUserId && access.currentUserId !== access.gardenOwnerUserId) return false;
  const ownerId = flower.ownerUserId || access.gardenOwnerUserId;
  if (ownerId) return Boolean(access.currentUserId && access.currentUserId === ownerId);
  // The existing standalone Journal/Garden contains the device owner's records.
  // An explicitly visited garden never receives this local editing fallback.
  return access.localOwner;
}

export function resolveFlowerDetail(flower: FlowerPlacementRecord, source?: FlowerSourceDetail | null) {
  if (source?.id !== flower.flowerId) source = null;
  const entry = findJournalEntry(flower.flowerId, flower.journalEntryId);
  return {
    name: source?.name || flower.flowerName || entry?.flowerName || 'Garden Flower',
    mood: source?.mood || entry?.mood || flower.mood || 'Unknown',
    memory: source?.dailyCheckIn?.journal?.content || source?.event || entry?.reflection || flower.notes || '',
    meaning: source?.meaning || flower.meaning || '',
    image: source?.img || flower.image || '',
    messages: source?.messages || flower.messages || [],
    supportCount: source?.supportCount ?? flower.supportCount ?? 0,
    supportState: source?.supportState,
    journalEntryId: source?.journalEntryId || entry?.id || flower.journalEntryId,
  };
}
