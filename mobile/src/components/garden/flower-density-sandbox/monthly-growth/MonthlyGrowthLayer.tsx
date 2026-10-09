import { Circle, Group, Image, Path, useImage, type SkImage } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useState } from 'react';
import { growthCatalog } from './growthCatalog';
import type { GrowthPiece } from './growthCoverage';
import type { MonthlyGrowth } from './monthlyGrowthModel';

const ImageLoader=memo(function ImageLoader({piece,onLoad}:{piece:GrowthPiece;onLoad:(key:string,image:SkImage)=>void}) {
  const key=`${piece.speciesCode}:${piece.componentId}`,catalog=growthCatalog(piece.speciesCode);
  const image=useImage(catalog.images[piece.componentId]);
  useEffect(()=>{if(image)onLoad(key,image);},[image,key,onLoad]);
  return null;
});
const BotanicalPiece=memo(function BotanicalPiece({piece,image}:{piece:GrowthPiece;image?:SkImage}) {
  const c=growthCatalog(piece.speciesCode).lookup(piece.componentId);
  if(!image)return null;
  return <Group transform={[{translateX:piece.worldX},{translateY:piece.worldY},{rotate:piece.rotation}]}>
    <Image image={image} x={-c.anchorX*c.canvasWidth*piece.scale} y={-c.anchorY*c.canvasHeight*piece.scale}
      width={c.canvasWidth*piece.scale} height={c.canvasHeight*piece.scale} fit="fill" />
  </Group>;
});
export function growthDrawOrder(growth:MonthlyGrowth,companions=true,filler=true) {
  const sort=(a:GrowthPiece,b:GrowthPiece)=>a.worldY-b.worldY||a.id.localeCompare(b.id);
  // Low cover underneath the bed, then globally ground-Y ordered primary/companion growth.
  return [...(filler?growth.filler.filter(p=>!p.baseCover).sort(sort):[]),
    ...[...growth.primary,...(companions?growth.companions:[]),...(filler?growth.filler.filter(p=>p.baseCover):[])].sort(sort)];
}
export function MonthlyGrowthLayer({growth,showCompanions=true,showFiller=true,showCoverage=false,showAnchors=false,selectedId=null}:{
  growth:MonthlyGrowth;showCompanions?:boolean;showFiller?:boolean;showCoverage?:boolean;showAnchors?:boolean;selectedId?:string|null;
}) {
  const [images,setImages]=useState<Record<string,SkImage>>({});
  const onLoad=useCallback((key:string,image:SkImage)=>setImages(previous=>previous[key]===image?previous:{...previous,[key]:image}),[]);
  if(!__DEV__)return null;
  const pieces=growthDrawOrder(growth,showCompanions,showFiller);
  const requests=new Map(pieces.map(piece=>[`${piece.speciesCode}:${piece.componentId}`,piece]));
  const cells=showCoverage?growth.coveredSamples.map(p=>`M${p.x-2} ${p.y-2}h4v4h-4Z`).join(''):'';
  // Final Mask constrains planting/origins, not botanical pixels. Foreground
  // landmark occlusion is provided by the unchanged Sandbox backdrop slot.
  return <Group>
    {Array.from(requests,([key,piece])=><ImageLoader key={key} piece={piece} onLoad={onLoad}/>)}
    {pieces.map(piece=><BotanicalPiece key={piece.id} piece={piece} image={images[`${piece.speciesCode}:${piece.componentId}`]}/>)}
    {showCoverage&&<Path path={cells} color="#4ccbd2" opacity={.3}/>}
    {(showAnchors||selectedId)&&growth.records.filter(f=>showAnchors||f.id===selectedId).map(f=><Circle key={f.id} cx={f.worldX} cy={f.worldY}
      r={f.footprintRadius} color={f.id===selectedId?'#faf0a2':'#893c59'} style="stroke" strokeWidth={f.id===selectedId?1.5:.8}/>)}
  </Group>;
}
