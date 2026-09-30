import { Circle, Group } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { usePlanting } from './PlantingContext';
import { getFlowerPlacementDefinition } from './flowerFootprintConfig';
import { flowerInDepthPass, type FlowerDepthPass } from '../flowerOcclusion';
import { productionGrowth } from './productionGrowth';
import { ProductionGrowthLayer } from './ProductionGrowthLayer';
import type { FlowerPlacementRecord } from './plantingPersistence';

export function growthPreviewParents(placements:readonly FlowerPlacementRecord[],target:FlowerPlacementRecord|null,
  preview:{worldX:number;worldY:number}|null,adjusting:boolean) {
  return adjusting&&target&&preview?placements.map(p=>p.id===target.id?{...p,...preview}:p):placements;
}
export function ProductionPlantedFlowers({depthPass='all'}:{depthPass?:FlowerDepthPass}) {
  const {placements,activeMode,targetFlower,previewCoords,validationResult,showDevFootprints,showDevHitboxes}=usePlanting();
  const parents=useMemo(()=>growthPreviewParents(placements,targetFlower,previewCoords,activeMode==='adjusting'),
    [placements,targetFlower,previewCoords,activeMode]);
  const scenes=useMemo(()=>productionGrowth(parents),[parents]);
  // Unconfirmed Plant preview never contributes to the committed month's count.
  const pending=useMemo(()=>activeMode==='planting'&&targetFlower&&previewCoords
    ? productionGrowth([{...targetFlower,...previewCoords}]):[],[activeMode,targetFlower,previewCoords]);
  const active=activeMode!=='normal'&&targetFlower&&previewCoords&&flowerInDepthPass(targetFlower.month,depthPass);
  const color=validationResult?.isValid?'#22c55e':'#ef4444';
  return <Group>
    {scenes.filter(s=>flowerInDepthPass(s.month,depthPass)).map(scene=><Group key={scene.month}>
      <ProductionGrowthLayer growth={scene.growth}/>
      {__DEV__&&scene.unresolved.map(p=><Circle key={p.id} cx={p.worldX} cy={p.worldY} r={4} color="#a6643c" style="stroke" strokeWidth={1.5}/>)}
    </Group>)}
    {pending.filter(s=>flowerInDepthPass(s.month,depthPass)).map(s=><Group key={`preview-${s.month}`} opacity={validationResult?.isValid ? .92 : .65}>
      <ProductionGrowthLayer growth={{...s.growth,pieces:s.growth.primary,companions:[],filler:[]}}/>
      {__DEV__&&s.unresolved.map(p=><Circle key={p.id} cx={p.worldX} cy={p.worldY} r={4} color="#a6643c" style="stroke" strokeWidth={1.5}/>)}
    </Group>)}
    {active&&<Group>
      <Circle cx={previewCoords.worldX} cy={previewCoords.worldY} r={getFlowerPlacementDefinition(targetFlower.flowerName, targetFlower.speciesCode).footprintRadius+4} color={color} opacity={.2}/>
      <Circle cx={previewCoords.worldX} cy={previewCoords.worldY} r={getFlowerPlacementDefinition(targetFlower.flowerName, targetFlower.speciesCode).footprintRadius} color={color} style="stroke" strokeWidth={2.5}/>
    </Group>}
    {__DEV__&&(showDevFootprints||showDevHitboxes)&&parents.filter(p=>flowerInDepthPass(p.month,depthPass)).map(p=><Circle key={p.id}
      cx={p.worldX} cy={p.worldY} r={getFlowerPlacementDefinition(p.flowerName, p.speciesCode).footprintRadius} color="#38bdf8" style="stroke" strokeWidth={1}/>)}
  </Group>;
}
