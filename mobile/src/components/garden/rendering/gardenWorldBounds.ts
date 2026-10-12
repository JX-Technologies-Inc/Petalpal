// Retained map rectangle: a short waterfall source through the entrance gate.
// Original world coordinates keep every landmark and navigation route aligned.
export const GARDEN_WORLD_BOUNDS = { x: 0, y: -309, width: 2400, height: 2119 };

export function constrainGardenCamera(width: number, height: number, fit: number,
  baseX: number, baseY: number, x: number, y: number, zoom: number) {
  'worklet';
  // Preserve main's free pan and established zoom limits. Navigation bounds
  // are independent of framing; never force a cropped initial Garden view.
  return { x, y, zoom: Math.max(0.8,Math.min(3,zoom)), minimumZoom: 0.8 };
}

export function zoomGardenAt(width: number, height: number, fit: number,
  baseX: number, baseY: number, x: number, y: number, zoom: number,
  targetZoom: number, focalX: number, focalY: number) {
  'worklet';
  if (fit <= 0 || zoom <= 0) return constrainGardenCamera(width, height, fit, baseX, baseY, x, y, zoom);
  const nextZoom = constrainGardenCamera(width, height, fit, baseX, baseY, x, y, targetZoom).zoom;
  const worldX = (focalX - baseX - x) / (fit * zoom);
  const worldY = (focalY - baseY - y) / (fit * zoom);
  return constrainGardenCamera(width, height, fit, baseX, baseY,
    focalX - baseX - worldX * fit * nextZoom,
    focalY - baseY - worldY * fit * nextZoom, nextZoom);
}
