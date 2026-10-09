import { Circle, Group, Image, Path, Rect, useImage } from '@shopify/react-native-skia';
import { type BridgeTestPlacement } from './bridgeTestPlacement';
import { bridgePathPoints, BRIDGE_VIEW_SPRITE, projectBridgePoint } from './bridgeSprites';

const bridgeTransform = (p: BridgeTestPlacement) => [
  { translateX: p.x }, { translateY: p.y },
  { scale: p.scale },
];

export default function GardenBridge({ placement: p }: { placement: BridgeTestPlacement }) {
  const sprite = BRIDGE_VIEW_SPRITE;
  const image = useImage(sprite.source);
  if (!p.visible || !image) return null;
  return <Group transform={bridgeTransform(p)}>
    <Image image={image} x={-sprite.anchor.x} y={-sprite.anchor.y}
      width={sprite.canvas.width} height={sprite.canvas.height} fit="contain" opacity={p.opacity} />
  </Group>;
}

// A separate geometry-only overlay keeps labels legible above landmarks.
// There is still exactly one rendered bridge image.
export function BridgeDebugOverlay({ placement: p, debug, walkPath }: {
  placement: BridgeTestPlacement; debug: boolean; walkPath: boolean;
}) {
  if (!__DEV__ || !p.visible || (!debug && !walkPath)) return null;
  const sprite = BRIDGE_VIEW_SPRITE;
  const points = bridgePathPoints(p.path).map(point => projectBridgePoint(point, sprite));
  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const crest = projectBridgePoint(p.path.crest, sprite);
  const entryA = projectBridgePoint(p.path.entryA, sprite);
  const entryB = projectBridgePoint(p.path.entryB, sprite);
  return <Group transform={bridgeTransform(p)}>
    {__DEV__ && walkPath && <Group>
      <Path path={path}
        color="#101820" style="stroke" strokeWidth={12} />
      <Path path={path}
        color="#00FFFF" style="stroke" strokeWidth={6} />
      <Circle cx={crest.x} cy={crest.y} r={14} color="#00FFFF" />
    </Group>}
    {__DEV__ && debug && <Group>
      <Rect x={-sprite.anchor.x} y={-sprite.anchor.y} width={sprite.canvas.width} height={sprite.canvas.height}
        style="stroke" strokeWidth={5} color="#FF4EE8" />
      <Path path="M -25 0 L 25 0 M 0 -25 L 0 25" style="stroke" strokeWidth={5} color="#FF4EE8" />
      <Circle cx={0} cy={0} r={7} color="#FFFFFF" />
      <Marker x={entryA.x} y={entryA.y} label="A" />
      <Marker x={entryB.x} y={entryB.y} label="B" />
    </Group>}
  </Group>;
}

// Vector letter labels avoid asynchronous font loading inside the canvas.
function Marker({ x, y, label }: { x: number; y: number; label: 'A' | 'B' }) {
  return <Group transform={[{ translateX: x }, { translateY: y }]}>
    <Circle cx={0} cy={0} r={36} color="#172219" />
    <Circle cx={0} cy={0} r={32} color={label === 'A' ? '#FFE36E' : '#8DFFFF'} />
    <Group transform={[{ scale: 2 }]}>
    <Path path={label === 'A' ? 'M -9 11 L 0 -12 L 9 11 M -5 3 L 5 3'
      : 'M -7 11 L -7 -11 L 2 -11 Q 13 -11 9 -2 L -7 0 L 3 0 Q 15 1 8 11 Z'}
      color="#172219" style="stroke" strokeWidth={3} />
    </Group>
  </Group>;
}
