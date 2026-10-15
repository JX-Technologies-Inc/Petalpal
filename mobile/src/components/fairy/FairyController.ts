import type {FairyAnimationState,FairyFacing} from './fairyRuntime';
import {smoothTravel} from './fairyLocomotion';
import {contactOffset,poseTransition,walkPose,type FairyPosePhase} from './fairyPosePlayback';
export type FairyControllerState='idle'|'walking'|'approach_landmark'|'interacting'|'leaving_landmark';
export type FairyInteractionPhase=FairyPosePhase;
export type FairyPoint={x:number;y:number};
export interface FairyLandmarkTarget {
  id:string;approach:FairyPoint;interaction:FairyPoint;exit:FairyPoint;facing:FairyFacing;
  spriteScale?:number;spriteAngle?:number;
}
export interface FairyControllerSnapshot extends FairyPoint {
  state:FairyControllerState;facing:FairyFacing;animationState:FairyAnimationState;
  activeTarget:FairyLandmarkTarget|null;currentLandmark:string|null;
  phase:FairyInteractionPhase;phaseProgress:number;seated:number;attached:boolean;
  gaitPhase:number;gaitWeight:number;distance:number;
  poseIndex:number;nextPoseIndex:number;poseMix:number;drawX:number;drawY:number;
  supportX:number|null;supportY:number|null;
}
const durations={turn_back:1000,sit_back:1100,swinging_back:8400,settling_back:1500,stand_back:1100,turn_front:900};
const copy=(p:FairyPoint)=>({x:p.x,y:p.y});
const valid=(p:FairyPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
/** Caller-clocked control. Logical world root and painted weight-bearing offset
 * are distinct. No persisted state and no independent seat-motion simulation. */
export class FairyController {
  private value:FairyControllerSnapshot;
  private elapsed=0;
  private travel:{from:FairyPoint;elapsed:number;duration:number;gaitFrom:number;gaitLength:number}|null=null;
  private plant:{id:number;x:number;y:number}|null=null;
  private lastWalk=0;
  private arrivalOffset={x:0,y:0};
  constructor(position:FairyPoint,private readonly speed=65) {
    if(!valid(position)||!Number.isFinite(speed)||speed<=0)throw new Error('Invalid Fairy position/speed');
    this.value={...position,state:'idle',facing:'SE',animationState:'idle',activeTarget:null,currentLandmark:null,
      phase:'none',phaseProgress:0,seated:0,attached:false,gaitPhase:0,gaitWeight:0,distance:0,
      poseIndex:0,nextPoseIndex:0,poseMix:0,drawX:position.x,drawY:position.y,supportX:null,supportY:null};
  }
  snapshot():FairyControllerSnapshot {
    const t=this.value.activeTarget;
    return {...this.value,activeTarget:t?{...t,approach:copy(t.approach),interaction:copy(t.interaction),exit:copy(t.exit)}:null};
  }
  request(target:FairyLandmarkTarget) {
    if(this.value.state!=='idle')return false;
    if(!target.id||![target.approach,target.interaction,target.exit].every(valid))throw new Error('Invalid landmark target');
    this.value.activeTarget={...target,approach:copy(target.approach),interaction:copy(target.interaction),exit:copy(target.exit)};
    this.value.state='walking';this.value.animationState='walk';this.value.distance=0;
    this.value.gaitPhase=0;
    this.travel=null;this.plant=null;this.lastWalk=0;
    if(Math.hypot(this.value.x-target.interaction.x,this.value.y-target.interaction.y)<.1) {
      this.value.state='interacting';this.value.currentLandmark=target.id;this.arrivalOffset={x:0,y:0};this.begin('turn_back');
    }
    return true;
  }
  tick(ms:number) {
    if(!Number.isFinite(ms)||ms<0)throw new Error('Invalid elapsed time');
    let remaining=Math.min(ms,1000);
    while(remaining>0){const step=Math.min(remaining,10);this.step(step);remaining-=step;}
  }
  private begin(phase:Exclude<FairyPosePhase,'none'>) {
    const v=this.value;this.elapsed=0;v.phase=phase;v.phaseProgress=0;
    v.animationState=phase==='swinging_back'?'swing':phase==='sit_back'||phase==='settling_back'?'sit':'interact';
    this.updatePose();
  }
  private updatePose() {
    const v=this.value,pose=poseTransition(v.phase,v.phaseProgress,this.lastWalk);
    v.poseIndex=pose.index;v.nextPoseIndex=pose.next;v.poseMix=pose.mix;
    const settle=v.phase==='turn_back'?1-smoothTravel(Math.min(1,v.phaseProgress*3)):0;
    v.drawX=v.x+this.arrivalOffset.x*settle;v.drawY=v.y+this.arrivalOffset.y*settle;
    v.supportX=null;v.supportY=null;
  }
  private step(ms:number) {
    const v=this.value,t=v.activeTarget;if(!t)return;
    if(v.phase!=='none') {
      this.elapsed+=ms;v.phaseProgress=Math.min(1,this.elapsed/durations[v.phase]);
      v.seated=v.phase==='sit_back'?smoothTravel(v.phaseProgress):v.phase==='stand_back'?1-smoothTravel(v.phaseProgress)
        :v.phase==='swinging_back'||v.phase==='settling_back'?1:0;
      this.updatePose();
      if(v.phaseProgress<1)return;
      if(v.phase==='turn_back'){v.attached=true;v.facing='N';this.begin('sit_back');}
      else if(v.phase==='sit_back')this.begin('swinging_back');
      else if(v.phase==='swinging_back')this.begin('settling_back');
      else if(v.phase==='settling_back'){v.state='leaving_landmark';this.begin('stand_back');}
      else if(v.phase==='stand_back'){v.attached=false;this.begin('turn_front');}
      else {v.state='idle';v.phase='none';v.animationState='idle';v.currentLandmark=null;v.activeTarget=null;
        v.facing='SE';v.poseIndex=0;v.nextPoseIndex=0;v.poseMix=0;v.seated=0;v.phaseProgress=0;}
      return;
    }
    const destination=v.state==='walking'?t.approach:t.interaction;
    const dx=destination.x-v.x,dy=destination.y-v.y,distance=Math.hypot(dx,dy);
    if(!this.travel)this.travel={from:copy(v),elapsed:0,duration:Math.max(500,1.875*distance/(this.speed*(v.state==='walking'?1:.6))*1000),
      gaitFrom:v.gaitPhase,gaitLength:Math.max(24,Math.round(distance/24)*24)};
    const travel=this.travel;travel.elapsed+=ms;
    const p=Math.min(1,travel.elapsed/travel.duration),blend=smoothTravel(p),old=copy(v);
    v.x=travel.from.x+(destination.x-travel.from.x)*blend;v.y=travel.from.y+(destination.y-travel.from.y)*blend;
    v.distance+=Math.hypot(v.x-old.x,v.y-old.y);v.gaitPhase=travel.gaitFrom+travel.gaitLength*blend;v.gaitWeight=Math.sin(Math.PI*p)**2;
    const walk=walkPose(v.gaitPhase),offset=contactOffset(walk.index,t.spriteScale??.2,t.spriteAngle??0);
    if(!this.plant||walk.plant!==this.plant.id)this.plant={id:walk.plant,x:v.x+offset.x,y:v.y+offset.y};
    v.drawX=this.plant.x-offset.x;v.drawY=this.plant.y-offset.y;
    v.supportX=this.plant.x;v.supportY=this.plant.y;
    v.poseIndex=v.distance<2?0:walk.index;v.nextPoseIndex=walk.index;v.poseMix=Math.min(1,v.distance/2);
    this.lastWalk=walk.index;
    if(distance>0)v.facing=Math.abs(dx)>=Math.abs(dy)?dx>=0?'E':'W':dy>=0?'S':'N';
    if(p<1)return;
    this.travel=null;v.gaitWeight=0;v.x=destination.x;v.y=destination.y;
    if(v.state==='walking')v.state='approach_landmark';
    else {v.state='interacting';v.currentLandmark=t.id;
      this.arrivalOffset={x:v.drawX-v.x,y:v.drawY-v.y};this.begin('turn_back');}
  }
}
