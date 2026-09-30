import { Circle, Group, Image, Rect, useImage } from '@shopify/react-native-skia';
import { memo } from 'react';
import { COMPONENT_IMAGES } from './componentImages';
import { componentById, type ComponentPart, type ComponentGeometry, type Bounds } from './tulipComposition';
import { groundRect, sortVisualsByGroundY } from '../../flower-visuals/flowerVisualResolver';
import type { VisualFlower } from '../../flower-visuals/GardenFlowerVisualLayer';

export interface ComponentCatalog { images: Record<string, number>; lookup: (id: string) => ComponentGeometry }
const TULIP_CATALOG: ComponentCatalog = { images: COMPONENT_IMAGES, lookup: componentById };
export interface ComposedFlower { id: string; worldX: number; worldY: number; visualScale?: number; catalog?: ComponentCatalog;
  composition: { parts: ComponentPart[]; bounds: Bounds; footprintRadius: number } }
const ComponentSprite=memo(function ComponentSprite({ part, catalog=TULIP_CATALOG }: {part:ComponentPart;catalog?:ComponentCatalog}) {
  const c=catalog.lookup(part.componentId);
  const image=useImage(catalog.images[part.componentId]);
  if(!image)return <Circle cx={part.localX} cy={part.localY} r={1.5} color="#ac6034" />;
  const size=c.worldUnitsPerPixel*c.defaultVisualScale*part.scale;
  return <Group transform={[{translateX:part.localX},{translateY:part.localY},{rotate:part.rotation}]}>
    <Image image={image} x={-c.anchorX*c.canvasWidth*size} y={-c.anchorY*c.canvasHeight*size}
      width={c.canvasWidth*size} height={c.canvasHeight*size} fit="fill" />
  </Group>;
});
export function TulipComponentLayer({flowers,showBounds=false,showFootprints=false,showAnchors=false,visualScale=1}: {
  flowers:readonly ComposedFlower[];showBounds?:boolean;showFootprints?:boolean;showAnchors?:boolean;visualScale?:number;
}) {
  if(!__DEV__)return null;
  return <Group>{sortVisualsByGroundY(flowers).map(f=><Group key={f.id}
    transform={[{translateX:f.worldX},{translateY:f.worldY}]}>
    <Group transform={[{scale:f.visualScale??visualScale}]}>
      {f.composition.parts.map(part=><ComponentSprite key={part.order} part={part} {...(f.catalog?{catalog:f.catalog}:{})} />)}
      {showBounds && <Rect {...f.composition.bounds} color="#8459ad" style="stroke" strokeWidth={.6/(f.visualScale??visualScale)} />}
    </Group>
    {showFootprints && <Circle cx={0} cy={0} r={f.composition.footprintRadius} color="#466b56" style="stroke" strokeWidth={.7} />}
    {showAnchors && <Circle cx={0} cy={0} r={1.8} color="#934627" />}
  </Group>)}</Group>;
}

export function FixedTulipBounds({flowers}: {flowers:readonly VisualFlower[]}) {
  if(!__DEV__)return null;
  return <Group>{flowers.map(f=>{
    const a=f.visual.gardenAsset;if(!a)return null;
    const t=f.previewTuning;
    const rect=groundRect({...a,visualScale:a.visualScale*(t?.scaleMultiplier??1),
      anchorX:Math.max(0,Math.min(1,a.anchorX+(t?.anchorOffsetX??0))),
      anchorY:Math.max(0,Math.min(1,a.anchorY+(t?.anchorOffsetY??0)))},f.worldX,f.worldY,f.visual.visualWidth,f.visual.visualHeight);
    return <Rect key={f.id} {...rect} color="#8459ad" style="stroke" strokeWidth={.6} />;
  })}</Group>;
}
