import { useSyncExternalStore } from 'react';

// Load progress lives outside React state so the canvas owner never
// re-renders (re-rendering it would rebuild the Skia tree and reload images).
// Only asset names and generic error messages are kept; never user data.
export type GardenLoadState = { landsLoaded: number; landsTotal: number; water: 'loading' | 'ready' | 'failed'; failures: readonly string[] };
let state: GardenLoadState = { landsLoaded: 0, landsTotal: 7, water: 'loading', failures: [] };
const listeners = new Set<() => void>();
function update(next: Partial<GardenLoadState>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

export function publishLandsLoaded(loaded: number, total: number) {
  if (state.landsLoaded !== loaded || state.landsTotal !== total) update({ landsLoaded: loaded, landsTotal: total });
}
export function publishWater(water: GardenLoadState['water']) {
  if (state.water !== water) update({ water });
}
export function reportGardenLoadFailure(label: string) {
  const entry = label.slice(0, 80);
  if (!state.failures.includes(entry)) update({ failures: [...state.failures, entry].slice(-4) });
}

export function useGardenLoadState() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state, () => state);
}
