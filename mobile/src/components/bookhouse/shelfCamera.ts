export type ShelfCamera = { scale: number; x: number; y: number };
export type ShelfBounds = { width: number; height: number; contentWidth: number; contentHeight: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function boundCamera(camera: ShelfCamera, bounds: ShelfBounds): ShelfCamera {
  const axis = (offset: number, viewport: number, content: number) => content <= viewport
    ? (viewport - content) / 2 : clamp(offset, viewport - content, 0);
  return { scale: camera.scale, x: axis(camera.x, bounds.width, bounds.contentWidth * camera.scale),
    y: axis(camera.y, bounds.height, bounds.contentHeight * camera.scale) };
}
export function focusCamera(point: { x: number; y: number }, scale: number, bounds: ShelfBounds): ShelfCamera {
  return boundCamera({ scale, x: bounds.width / 2 - point.x * scale, y: bounds.height / 2 - point.y * scale }, bounds);
}
export function zoomCamera(camera: ShelfCamera, focal: { x: number; y: number }, scale: number, bounds: ShelfBounds): ShelfCamera {
  return boundCamera({ scale, x: focal.x - (focal.x - camera.x) / camera.scale * scale,
    y: focal.y - (focal.y - camera.y) / camera.scale * scale }, bounds);
}
