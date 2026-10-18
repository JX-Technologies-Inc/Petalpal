import { useSyncExternalStore } from 'react';

// Readiness is published outside React state so the canvas owner never
// re-renders (re-rendering it would rebuild the Skia tree and reload images).
let landsReady = false;
const listeners = new Set<() => void>();

export function publishLandsReady(ready: boolean) {
  if (landsReady === ready) return;
  landsReady = ready;
  listeners.forEach(listener => listener());
}

export function useLandsReady() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => landsReady, () => landsReady);
}
