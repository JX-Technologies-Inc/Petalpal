/** Semantic state only. No fabricated frames, clocks, navigation or persistence. */
export const FAIRY_ANIMATION_STATES=['idle','walk','run','jump','interact','sit','lie','swing','write'] as const;
export const FAIRY_SPRITE_DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'] as const;
/** Existing semantic facing values remain valid; authored compass views are additive. */
export const FAIRY_FACINGS=['front','back','left','right',...FAIRY_SPRITE_DIRECTIONS] as const;
export type FairyAnimationState=typeof FAIRY_ANIMATION_STATES[number];
export type FairyFacing=typeof FAIRY_FACINGS[number];
export type FairySpriteDirection=typeof FAIRY_SPRITE_DIRECTIONS[number];
export function fairyAssetDirection(facing:FairyFacing):FairySpriteDirection {
  const aliases={front:'S',back:'N',left:'W',right:'E'} as const;
  return facing in aliases?aliases[facing as keyof typeof aliases]:facing as FairySpriteDirection;
}
export interface FairyRuntime {
  x:number;y:number;scale:number;facing:FairyFacing;animationState:FairyAnimationState;visible:boolean;
}
export type FairyImageSource=number|string;
export interface FairyFrameGeometry {
  width:number;height:number;
  /** Normalized pivot in the complete exported frame, not its opaque bounds. */
  anchorX:number;anchorY:number;
}
export interface FairyClipTiming {fps:number;loop:boolean}
export interface FairySequenceClip extends FairyClipTiming,FairyFrameGeometry {
  kind:'sequence';frames:readonly FairyImageSource[];
}
export interface FairyAtlasClip extends FairyClipTiming {
  kind:'atlas';source:FairyImageSource;
  frames:readonly (FairyFrameGeometry&{x:number;y:number})[];
}
export type FairyClip=FairySequenceClip|FairyAtlasClip;
export interface FairyAssets {
  reference:{source:FairyImageSource;geometry:FairyFrameGeometry};
  animations:Partial<Record<FairyAnimationState,Partial<Record<FairyFacing,FairyClip>>>>;
}
export interface FairyVisualFrame extends FairyFrameGeometry {
  source:FairyImageSource;kind:'reference'|'sequence'|'atlas';
  sourceRect?:{x:number;y:number;width:number;height:number};
}
export function findFairyClip(assets:FairyAssets,state:FairyAnimationState,facing:FairyFacing) {
  return assets.animations[state]?.[facing]??assets.animations[state]?.[fairyAssetDirection(facing)];
}
/** Missing authored state/view always returns the full reference sheet. Facing
 * never mirrors/recolors it. Actual playback will supply a frame index. */
export function resolveFairyFrame(assets:FairyAssets,state:FairyAnimationState,facing:FairyFacing,frameIndex=0):FairyVisualFrame {
  const clip=findFairyClip(assets,state,facing);
  if(!clip||!clip.frames.length||!Number.isFinite(frameIndex))return {...assets.reference.geometry,source:assets.reference.source,kind:'reference'};
  const raw=Math.max(0,Math.floor(frameIndex));
  const index=clip.loop?raw%clip.frames.length:Math.min(raw,clip.frames.length-1);
  if(clip.kind==='sequence')return {kind:'sequence',source:clip.frames[index],width:clip.width,height:clip.height,anchorX:clip.anchorX,anchorY:clip.anchorY};
  const frame=clip.frames[index];
  return {kind:'atlas',source:clip.source,width:frame.width,height:frame.height,anchorX:frame.anchorX,anchorY:frame.anchorY,
    sourceRect:{x:frame.x,y:frame.y,width:frame.width,height:frame.height}};
}
export function fairyWorldBounds(runtime:FairyRuntime,frame:FairyFrameGeometry) {
  return {x:runtime.x-frame.anchorX*frame.width*runtime.scale,y:runtime.y-frame.anchorY*frame.height*runtime.scale,
    width:frame.width*runtime.scale,height:frame.height*runtime.scale};
}
export function fairyInView(runtime:FairyRuntime,frame:FairyFrameGeometry,viewport:{x:number;y:number;width:number;height:number},margin=0) {
  if(!runtime.visible||!Number.isFinite(runtime.scale)||runtime.scale<=0||!Number.isFinite(runtime.x)||!Number.isFinite(runtime.y))return false;
  const b=fairyWorldBounds(runtime,frame);
  return b.x+b.width>=viewport.x-margin&&b.x<=viewport.x+viewport.width+margin&&
    b.y+b.height>=viewport.y-margin&&b.y<=viewport.y+viewport.height+margin;
}
