import { Group, Rect, useImage } from '@shopify/react-native-skia';
import { memo, type ReactNode } from 'react';
import { flowersRenderBehindTeaSet } from '../flowerOcclusion';
import GardenConnectionLayer from '../GardenConnectionLayer';
import GardenInfrastructureLayer from '../GardenInfrastructureLayer';
import GardenLand09InterfaceLayer from '../GardenLand09InterfaceLayer';
import GardenRoadApproachLayer from '../GardenRoadApproachLayer';
import LandLayer from '../LandLayer';
import LandmarkLayer from '../LandmarkLayer';
import WaterfallV2Entity from '../WaterfallV2Entity';
import { GARDEN_WATER_COLOR } from '../gardenMapLayout';
import PlantingRegionOverlay from '../planting/PlantingRegionOverlay';
import FishLayer from '../water/FishLayer';
import GardenWaterField from '../water/GardenWaterField';
import LotusLayer from '../water/LotusLayer';
import SurfaceRippleLayer from '../water/SurfaceRippleLayer';
import { WATER_ASSETS } from '../water/waterAssets';

/** Existing Garden art and default transforms, with motion paused for comparisons.
 * No PlantingProvider, production flowers, calibration state, or persistence.
 */
function SandboxGardenBackdrop({ month, showMask, children }: { month: number; showMask: boolean; children?: ReactNode }) {
  const water = useImage(WATER_ASSETS.calmBase);
  return <Group>
    <Rect x={-2400} y={-2400} width={7200} height={6600} color={GARDEN_WATER_COLOR} />
    {water && <GardenWaterField image={water} active={false} animated={false} />}
    <FishLayer active={false} />
    <SurfaceRippleLayer active={false} softWorldEdges />
    <LotusLayer active={false} />
    <WaterfallV2Entity active={false} animated={false} />
    <LandLayer />
    <PlantingRegionOverlay highlightedMonth={showMask ? month : null} showLandBounds={false} />
    <GardenLand09InterfaceLayer />
    <GardenConnectionLayer />
    <GardenInfrastructureLayer />
    <LandmarkLayer waterfallVersion="v2" waterfallActive={false} suppressLegacyWaterTop
      behindTeaSet={flowersRenderBehindTeaSet(month) ? children : undefined} />
    <GardenRoadApproachLayer />
    {!flowersRenderBehindTeaSet(month) && children}
  </Group>;
}

export default memo(SandboxGardenBackdrop);
