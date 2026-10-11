import { GARDEN_WORLD_BOUNDS } from './gardenWorldBounds';
import {Canvas,Group} from '@shopify/react-native-skia';
import {memo,type ReactNode,type ComponentProps} from 'react';
import {StyleSheet} from 'react-native';
import {PlantingProvider,usePlanting} from '../planting/PlantingContext';
import {runtimeAudit} from '../performance/runtimeAudit';

/** Independent retained surfaces, in original source-over order. Animation in
 * one surface cannot dirty another surface's Skia scene graph. The same camera
 * still redraws every plane on pan/zoom. No raster downsampling; a shared hard world boundary. */
export const GardenCanvasPlane=memo(function GardenCanvasPlane({name,cameraTransform,planting,children}:{
  name:string;cameraTransform:ComponentProps<typeof Group>['transform'];planting:ReturnType<typeof usePlanting>;children:ReactNode;
}) {
  runtimeAudit.render(`Canvas plane: ${name}`);
  return <Canvas style={styles.plane} pointerEvents="none">
    <PlantingProvider value={planting}><Group transform={cameraTransform}><Group clip={GARDEN_WORLD_BOUNDS}>{children}</Group></Group></PlantingProvider>
  </Canvas>;
});

const styles=StyleSheet.create({plane:{position:'absolute',top:0,right:0,bottom:0,left:0}});
