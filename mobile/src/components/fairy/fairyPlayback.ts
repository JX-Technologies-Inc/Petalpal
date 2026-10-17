import {FAIRY_ANIMATION_STATES,FAIRY_FACINGS,findFairyClip,type FairyAnimationState,type FairyAssets,type FairyFacing} from './fairyRuntime';

export type FairyAnimationClip={
  name:FairyAnimationState;direction:FairyFacing;frameCount:number;fps:number;loop:boolean;
  frameWidth?:number;frameHeight?:number;
};
export type FairyPlaybackStatus='no-clip'|'paused'|'playing'|'completed';
export interface FairyPlaybackState {
  clip:FairyAnimationClip|null;frameIndex:number;elapsedMs:number;status:FairyPlaybackStatus;
}
export function validFairyAnimationClip(clip:FairyAnimationClip):boolean {
  'worklet';
  return FAIRY_ANIMATION_STATES.includes(clip.name)&&FAIRY_FACINGS.includes(clip.direction)&&
    Number.isInteger(clip.frameCount)&&clip.frameCount>0&&Number.isFinite(clip.fps)&&clip.fps>0&&typeof clip.loop==='boolean'&&
    (clip.frameWidth===undefined||(Number.isFinite(clip.frameWidth)&&clip.frameWidth>0))&&
    (clip.frameHeight===undefined||(Number.isFinite(clip.frameHeight)&&clip.frameHeight>0));
}
/** Metadata does not invent resources: only registered, nonempty authored
 * sequence/atlas entries produce a usable descriptor. Registry stays empty. */
export function fairyClipDescriptor(assets:FairyAssets,name:FairyAnimationState,direction:FairyFacing):FairyAnimationClip|null {
  const source=findFairyClip(assets,name,direction);
  if(!source?.frames.length)return null;
  const frameWidth=source.kind==='sequence'?source.width:
    source.frames.every(f=>f.width===source.frames[0].width)?source.frames[0].width:undefined;
  const frameHeight=source.kind==='sequence'?source.height:
    source.frames.every(f=>f.height===source.frames[0].height)?source.frames[0].height:undefined;
  const clip={name,direction,frameCount:source.frames.length,fps:source.fps,loop:source.loop,frameWidth,frameHeight};
  return validFairyAnimationClip(clip)?clip:null;
}
export function createFairyPlayback(clip:FairyAnimationClip|null):FairyPlaybackState {
  'worklet';
  if(!clip||!validFairyAnimationClip(clip))return {clip:null,frameIndex:0,elapsedMs:0,status:'no-clip'};
  return {clip:{...clip},frameIndex:0,elapsedMs:0,status:'paused'};
}
export function playFairy(state:FairyPlaybackState):FairyPlaybackState {
  'worklet';
  if(!state.clip||state.status==='playing')return state;
  return state.status==='completed'?{...state,frameIndex:0,elapsedMs:0,status:'playing'}:{...state,status:'playing'};
}
export function pauseFairy(state:FairyPlaybackState):FairyPlaybackState {
  'worklet';
  return state.status==='playing'?{...state,status:'paused'}:state;
}
export function stepFairy(state:FairyPlaybackState,offset:number):FairyPlaybackState {
  'worklet';
  if(!state.clip||!Number.isFinite(offset))return state;
  const frameIndex=Math.max(0,Math.min(state.clip.frameCount-1,state.frameIndex+Math.trunc(offset)));
  return {...state,frameIndex,elapsedMs:frameIndex*1000/state.clip.fps,status:'paused'};
}
/** Pure shared-runtime progression seam. No timer/RAF subscription is created.
 * A future active, visible real-clip worklet can assign this result to a shared
 * value and derive the sprite index without publishing every frame to React. */
export function advanceFairy(state:FairyPlaybackState,deltaMs:number):FairyPlaybackState {
  'worklet';
  if(!state.clip||state.status!=='playing'||!Number.isFinite(deltaMs)||deltaMs<=0)return state;
  const durationMs=state.clip.frameCount*1000/state.clip.fps;
  const elapsed=state.elapsedMs+deltaMs;
  if(!state.clip.loop&&elapsed>=durationMs)return {...state,elapsedMs:durationMs,frameIndex:state.clip.frameCount-1,status:'completed'};
  const elapsedMs=state.clip.loop?elapsed%durationMs:elapsed;
  return {...state,elapsedMs,frameIndex:Math.min(state.clip.frameCount-1,Math.floor(elapsedMs*state.clip.fps/1000))};
}
