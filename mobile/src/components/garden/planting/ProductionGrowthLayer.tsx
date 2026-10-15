import {runtimeAudit} from '../performance/runtimeAudit';
import { Group, Picture, drawAsPicture, useImage, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';
import { growthDrawOrder } from '../flower-density-sandbox/monthly-growth/MonthlyGrowthLayer';
import type { GrowthPiece } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import type { MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';

import { BotanicalFlowerImage, botanicalImageBounds } from '../flower-visuals/BotanicalFlowerImage';
import { botanicalPresentationPose } from '../flower-visuals/botanicalPresentationPose';
import { composeProductionBed } from './productionBedComposition';

/** Full rotated image rectangles, including transparent margins and botanical
 * pixels outside soil masks. Recording bounds are not planting constraints. */
export function flowerPictureBounds(pieces:readonly GrowthPiece[]) {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of pieces){
    const c=growthCatalog(p.speciesCode).lookup(p.componentId);
    const x0=-c.anchorX*c.canvasWidth*p.scale,y0=-c.anchorY*c.canvasHeight*p.scale;
    const pose=botanicalPresentationPose(p.id);
    const scale=pose.transform[0] as {scale:number}, turn=pose.transform[1] as {rotate:number};
    const skew=pose.transform[2] as {skewX:number};
    const cs=Math.cos(p.rotation+turn.rotate),sn=Math.sin(p.rotation+turn.rotate);
    const pad=Math.max(3,c.canvasHeight*p.scale*.12);
    for(const x of [x0-pad,x0+c.canvasWidth*p.scale+pad])for(const y of [y0-pad,y0+c.canvasHeight*p.scale+pad]){
      const px=(x+Math.tan(skew.skewX)*y)*scale.scale,py=y*scale.scale;
      const wx=p.worldX+px*cs-py*sn,wy=p.worldY+px*sn+py*cs;
      left=Math.min(left,wx);right=Math.max(right,wx);top=Math.min(top,wy);bottom=Math.max(bottom,wy);
    }
  }
  return pieces.length?{x:left-2,y:top-2,width:right-left+4,height:bottom-top+4}:{x:0,y:0,width:0,height:0};
}

const AssetLoader = memo(function AssetLoader({ piece, onLoad }: {
  piece: GrowthPiece; onLoad: (key: string, image: SkImage) => void;
}) {
  const key = `${piece.speciesCode}:${piece.componentId}`;
  const image = useImage(growthCatalog(piece.speciesCode).images[piece.componentId]);
  useEffect(() => { if (image) onLoad(key, image); }, [image, key, onLoad]);
  return null;
});

const BotanicalPiece = memo(function BotanicalPiece({ piece, image }: {
  piece: GrowthPiece; image?: SkImage;
}) {
  const c = growthCatalog(piece.speciesCode).lookup(piece.componentId);
  if (!image) return null;
  const pose = botanicalPresentationPose(piece.id);
  return <Group transform={[{ translateX: piece.worldX }, { translateY: piece.worldY }, { rotate: piece.rotation }]}>
    <Group transform={pose.transform}>
      <BotanicalFlowerImage image={image} x={-c.anchorX * c.canvasWidth * piece.scale} y={-c.anchorY * c.canvasHeight * piece.scale}
        width={c.canvasWidth * piece.scale} height={c.canvasHeight * piece.scale}
        rootX={0} rootY={0} rootWidth={(c.contentBounds[2] - c.contentBounds[0]) * piece.scale * .36} role={piece.kind}
        seed={pose.seed} plantWidth={(c.contentBounds[2] - c.contentBounds[0]) * piece.scale}
        plantHeight={(c.contentBounds[3] - c.contentBounds[1]) * piece.scale} />
    </Group>
  </Group>;
});

function isPictureValid(pic: SkPicture | null | undefined): pic is SkPicture {
  if (!pic) return false;
  const ref = (pic as any).ref;
  if (!ref) return false;
  if (typeof ref.isDeleted === 'function' && ref.isDeleted()) return false;
  return true;
}

/** Release-capable neutral drawing of the approved pieces. No placement,
 * persistence, interaction identity, emotion effect or botanical mask clip. */
export const ProductionGrowthLayer = memo(function ProductionGrowthLayer({ growth,month,cache=true }: { growth: MonthlyGrowth;month?:number;cache?:boolean }) {
  runtimeAudit.render('ProductionGrowthLayer');
  const [images, setImages] = useState<Record<string, SkImage>>({});
  const [recorded,setRecorded]=useState<{pieces:GrowthPiece[];images:Record<string,SkImage>;picture:SkPicture}|null>(null);
  const onLoad = useCallback((key: string, image: SkImage) =>
    setImages(previous => previous[key] === image ? previous : { ...previous, [key]: image }), []);
  const initialBed = useMemo(() => month === undefined ? growth : composeProductionBed(growth, month), [growth, month]);
  const requests = useMemo(() => new Map(growthDrawOrder(initialBed).map(piece =>
    [`${piece.speciesCode}:${piece.componentId}`, piece])), [initialBed]);
  const complete = Array.from(requests.keys()).every(key => images[key]);
  // Decide the layout once while images load; size it with decoded bounds only
  // after the selected assets are ready, rather than rebuilding for every image.
  const bed = useMemo(() => month === undefined || !complete ? initialBed : composeProductionBed(growth, month, piece => {
    const image = images[`${piece.speciesCode}:${piece.componentId}`];
    return image ? botanicalImageBounds(image) : null;
  }), [growth, month, images, initialBed, complete]);
  const pieces = useMemo(() => growthDrawOrder(bed), [bed]);

  // Record exactly the existing decoded JSX draw commands once per semantic
  // field/image readiness. The picture retains image references, not raster
  // copies; the independent foreground Canvas is not dirtied by water clocks.
  useEffect(() => {
    if (!cache || typeof drawAsPicture !== 'function' || !pieces.length || pieces.some(p => !images[`${p.speciesCode}:${p.componentId}`])) return;
    let cancelled = false;
    const element = <Group>{pieces.map(piece => <BotanicalPiece key={piece.id} piece={piece}
      image={images[`${piece.speciesCode}:${piece.componentId}`]} />)}</Group>;
    void drawAsPicture(element, flowerPictureBounds(pieces)).then(picture => {
      if (cancelled) {
        if (isPictureValid(picture)) {
          try { picture.dispose(); } catch {}
        }
        return;
      }
      setRecorded({ pieces, images, picture });
    }).catch(() => { /* Keep the exact retained-node fallback if recording fails. */ });
    return () => {
      cancelled = true;
      // Do not prematurely call picture.dispose() in React unmount cleanup!
      // In WebAssembly / React Native Skia, an in-flight frame or canvas teardown may still
      // access the picture. Prematurely deleting the C++ sk_sp<Picture> causes
      // "Cannot pass deleted object as a pointer of type sk_sp<Picture>".
      // CanvasKit automatically finalizes smart-pointer SkPictures via FinalizationRegistry
      // once all JS references are dropped.
    };
  }, [pieces, images, cache]);
  const candidate = cache && recorded && recorded.pieces === pieces && recorded.images === images ? recorded.picture : null;
  const picture = isPictureValid(candidate) ? candidate : null;
  return <Group>
    {Array.from(requests, ([key, piece]) => <AssetLoader key={key} piece={piece} onLoad={onLoad} />)}
    {picture ? <Picture picture={picture} /> : pieces.map(piece => <BotanicalPiece key={piece.id} piece={piece}
      image={images[`${piece.speciesCode}:${piece.componentId}`]} />)}
  </Group>;
});
