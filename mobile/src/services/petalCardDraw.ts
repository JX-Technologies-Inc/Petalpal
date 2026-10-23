import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from './api';
import { closenessChanged, onClosenessChanged } from './fairyCloseness';

// The daily petal card draw (lib/petal-card-draw.js). Every route answers 404 while the petal
// card switch leaves the owner out; that reads as "off" (null) here.
export interface PetalCardFace { id: string; name: string; line: string; text: string; disclaimer: string }
export interface PetalDrawn { position: number; drawnAt: string; card: PetalCardFace | null }
export interface PetalToday {
  locale: 'en' | 'zh-Hans'; localDate: string; deckSize: number; back: 'lilac' | 'violet'; drawn: PetalDrawn | null;
}
export interface PetalDrawResult extends PetalDrawn { created: boolean; locale: 'en' | 'zh-Hans'; localDate: string }

async function orOff<T>(request: Promise<T>): Promise<T | null> {
  try { return await request; } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}

export const loadPetalToday = () => orOff(apiRequest<PetalToday>('/api/petal-cards/today'));
export async function drawPetalCard(position: number) {
  const result = await orOff(apiRequest<PetalDrawResult>('/api/petal-cards/draw', 'POST', { position }));
  if (result?.created) closenessChanged(); // the calendar shows the day's card
  return result;
}

// Today's draw state; reloads with `refreshKey` and after anything that changes the day.
export function usePetalToday(refreshKey: unknown) {
  const [today, setToday] = useState<PetalToday | null>(null);
  const [changes, setChanges] = useState(0);
  useEffect(() => onClosenessChanged(() => setChanges(count => count + 1)), []);
  useEffect(() => {
    let active = true;
    loadPetalToday().then(result => { if (active) setToday(result); }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey, changes]);
  return today;
}
