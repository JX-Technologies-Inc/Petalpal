import proxy from '@/assets/garden/decorations/bridge/rendered/bridge_camera_55.json';

/** Bridge-owned coordinates: x along the span, y across the deck.
 * One local span unit is half the reference span. Elevation is normalized;
 * the Blender exporter calibrates these units against its master.
 */
export type BridgeLocalPoint = { x: number; y: number; elevation: number };
export type BridgeWalkPath = {
  entryA: BridgeLocalPoint;
  crest: BridgeLocalPoint;
  entryB: BridgeLocalPoint;
  approach: BridgeLocalPoint[];
  exit: BridgeLocalPoint[];
};
export type BridgeTestPlacement = {
  x: number; y: number; scale: number; bridgeAngle: number; cameraAzimuthDegrees: number;
  opacity: number; visible: boolean; path: BridgeWalkPath;
};
export type BridgeNumericField = 'x' | 'y' | 'scale' | 'cameraAzimuthDegrees' | 'opacity';
export const INITIAL_BRIDGE_TEST: BridgeTestPlacement = {
  // User-tested lower entrance road → lower-right land placement baseline.
  // Geometry proxy yaw comes from Blender, independently of past UI experiments.
  x: 1740, y: 1364, scale: 0.154, cameraAzimuthDegrees: 322, bridgeAngle: proxy.angle, opacity: 1, visible: true,
  path: {
    entryA: proxy.path[0],
    crest: proxy.path[16],
    entryB: proxy.path[32],
    approach: proxy.path.slice(1, 16), exit: proxy.path.slice(17, 32),
  },
};
