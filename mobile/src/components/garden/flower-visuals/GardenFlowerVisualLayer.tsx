import { Circle, ColorMatrix, Group, Image, useImage } from '@shopify/react-native-skia';
import { memo } from 'react';
import { GARDEN_ART_BINDINGS } from './gardenArtBindings.generated';
import { colorMatrix, EFFECTS, EFFECT_BUDGET } from './emotionStyles';
import { groundRect, sortVisualsByGroundY, type ResolvedFlowerVisual } from './flowerVisualResolver';

export interface VisualFlower { id: string; worldX: number; worldY: number; visual: ResolvedFlowerVisual;
  previewTuning?: { anchorOffsetX: number; anchorOffsetY: number; scaleMultiplier: number } }

const Flower = memo(function Flower({ flower, devPreview, debug }: {
  flower: VisualFlower; devPreview: boolean; debug: boolean;
}) {
  const { visual: v, worldX: x, worldY: y } = flower;
  const a = v.gardenAsset;
  const binding = a ? GARDEN_ART_BINDINGS[a.asset] : undefined;
  const approvedHere = a?.status === 'APPROVED' || (devPreview && a?.status === 'READY_FOR_REVIEW');
  const usable = v.renderable && approvedHere && binding && JSON.stringify(binding.metadata) === JSON.stringify(a);
  const image = useImage(usable ? binding.source : null);
  // Production omits missing art. DEV markers are explicitly identified in the preview panel.
  if (!image || !a || !usable) return devPreview ? <Group>
    <Circle cx={x} cy={y} r={4} color="#a6643c" style="stroke" strokeWidth={1.5} />
    {debug && <Circle cx={x} cy={y} r={v.footprintRadius} color="#a6643c" style="stroke" strokeWidth={.7} />}
  </Group> : null;
  const t = devPreview ? flower.previewTuning : undefined;
  const rect = groundRect(t ? { ...a, anchorX: Math.max(0, Math.min(1, a.anchorX + t.anchorOffsetX)),
    anchorY: Math.max(0, Math.min(1, a.anchorY + t.anchorOffsetY)), visualScale: a.visualScale * t.scaleMultiplier } : a,
  x, y, v.visualWidth, v.visualHeight);
  const budget = EFFECT_BUDGET[v.effectTier];
  const shape = EFFECTS[v.accentEffect].shape;
  const color = v.mainEmotionStyle.highlight;
  return <Group>
    {v.mainEmotionStyle.halo && <Circle cx={x} cy={y - rect.height * .36} r={rect.width * .23}
      color={color} opacity={budget.opacity * .55} />}
    <Image image={image} {...rect} fit="fill"><ColorMatrix matrix={colorMatrix(v.mainEmotionStyle)} /></Image>
    {(shape === 'halo' || shape === 'mist') && <Circle cx={x} cy={y - rect.height * .32}
      r={rect.width * (shape === 'mist' ? .23 : .29)} color={v.accentColor} opacity={budget.opacity * .5}
      style={shape === 'halo' ? 'stroke' : 'fill'} strokeWidth={1.5} />}
    {shape === 'points' && Array.from({ length: budget.particles }, (_, i) => <Circle key={i}
      cx={x + (i % 2 ? -.2 : .2) * rect.width} cy={y - rect.height * (.48 + i * .09)}
      r={1.1} color={v.accentColor} opacity={budget.opacity} />)}
    {debug && <Group><Circle cx={x} cy={y} r={v.footprintRadius} style="stroke" strokeWidth={.7} color="#466b56" />
      <Circle cx={x} cy={y} r={1.8} color="#934627" /></Group>}
  </Group>;
});

// No Canvas here: callers keep their existing native/web-safe Canvas style semantics.
// This layer is prepared for future production integration; only the DEV sandbox mounts it today.
export function GardenFlowerVisualLayer({ flowers, devPreview = false, debug = false }: {
  flowers: readonly VisualFlower[]; devPreview?: boolean; debug?: boolean;
}) {
  const allowDev = __DEV__ && devPreview;
  return <Group>{sortVisualsByGroundY(flowers).map(flower =>
    <Flower key={flower.id} flower={flower} devPreview={allowDev} debug={allowDev && debug} />)}</Group>;
}
