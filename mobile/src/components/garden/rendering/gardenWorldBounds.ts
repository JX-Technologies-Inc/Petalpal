// Retained map rectangle: a short waterfall source through the entrance gate.
// Original world coordinates keep every landmark and navigation route aligned.
export const GARDEN_WORLD_BOUNDS = { x: 0, y: -309, width: 2400, height: 2119 };

export function constrainGardenCamera(width: number, height: number, fit: number,
  baseX: number, baseY: number, x: number, y: number, zoom: number) {
  'worklet';
  if (fit <= 0 || width <= 0 || height <= 0) return { x, y, zoom, minimumZoom: 1 };
  const b = GARDEN_WORLD_BOUNDS;
  const minimumZoom = Math.max(width / b.width, height / b.height) / fit;
  const z = Math.max(minimumZoom, Math.min(Math.max(3, minimumZoom * 3), zoom));
  const scale = fit * z;
  const minX = width - baseX - (b.x + b.width) * scale;
  const maxX = -baseX - b.x * scale;
  const minY = height - baseY - (b.y + b.height) * scale;
  const maxY = -baseY - b.y * scale;
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)), zoom: z, minimumZoom };
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
