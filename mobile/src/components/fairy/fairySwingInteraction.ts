import {SWING_MAP_X,SWING_MAP_Y,SWING_MAP_SCALE,SWING_MAP_ROTATION} from '../garden/swingMapPlacement';
import type {FairyLandmarkTarget,FairyPoint} from './FairyController';
import {FAIRY_POSE_FRAMES,FAIRY_POSE_SCALE} from './fairyPoseMetadata';

// Same map-center rotation as LandmarkLayer. Artwork and production placement stay authoritative.
export const FAIRY_SOURCE_ROOT={x:674,y:1178};
export const FAIRY_SOURCE_HIPS={x:655,y:676};
export const FAIRY_WORLD_SCALE=108/1134;
export function swingLocalToWorld(point:FairyPoint,width:number,height:number):FairyPoint {
  const angle=SWING_MAP_ROTATION*Math.PI/180;
  const dx=(point.x-width/2)*SWING_MAP_SCALE,dy=(point.y-height/2)*SWING_MAP_SCALE;
  return {x:SWING_MAP_X+width*SWING_MAP_SCALE/2+dx*Math.cos(angle)-dy*Math.sin(angle),
    y:SWING_MAP_Y+height*SWING_MAP_SCALE/2+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
export function createSwingTarget(seat:FairyPoint,width:number,height:number):FairyLandmarkTarget {
  // Standing root with the hips exactly at the seat. A single local coordinate
  // is reused for attachment and detachment, so neither transition teleports.
  const localScale=FAIRY_POSE_SCALE/SWING_MAP_SCALE;
  const standing=FAIRY_POSE_FRAMES[8];
  const foot={x:seat.x+(standing.root[0]-standing.hips[0])*localScale,
    y:seat.y+(standing.root[1]-standing.hips[1])*localScale};
  const interaction=swingLocalToWorld(foot,width,height);
  return {id:'swing',approach:{x:interaction.x-65,y:interaction.y+15},interaction,
    exit:interaction,facing:'N',spriteScale:FAIRY_POSE_SCALE,spriteAngle:SWING_MAP_ROTATION*Math.PI/180};
}
