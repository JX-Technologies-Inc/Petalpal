import {FAIRY_POSE_FRAMES} from './fairyPoseMetadata';
export type FairyPosePhase='none'|'turn_back'|'sit_back'|'swinging_back'|'settling_back'|'stand_back'|'turn_front';
export const WALK_POSES=[1,2,3,4] as const;
export const WALK_DISTANCE=48;
export function walkPose(distance:number) {
  const frame=Math.floor(Math.max(0,distance)/(WALK_DISTANCE/4));
  return {index:WALK_POSES[frame%4],plant:Math.floor(frame/2),frame};
}
export function poseTransition(phase:FairyPosePhase,progress:number,lastWalk=0) {
  const p=Math.max(0,Math.min(1,progress));
  const poses=phase==='turn_back'?[lastWalk,0,7,8]:phase==='sit_back'?[8,9,10]
    :phase==='stand_back'?[10,9,8]:phase==='turn_front'?[8,7,0]:[10];
  const at=p*(poses.length-1),i=Math.min(poses.length-1,Math.floor(at)),t=at-i;
  return {index:poses[i],next:poses[Math.min(i+1,poses.length-1)],mix:t*t*(3-2*t)};
}
/** Coordinates of the painted ground-contact point relative to the sprite root. */
export function contactOffset(index:number,scale:number,angle:number) {
  const pose=FAIRY_POSE_FRAMES[index],contact=pose.contact??pose.root;
  const x=(contact[0]-pose.root[0])*scale,y=(contact[1]-pose.root[1])*scale;
  return {x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)};
}
