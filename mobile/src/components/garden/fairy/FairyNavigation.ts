import {TEA_EXIT,TEA_APPROACH,TEA_SEAT} from './teaDestination';
import {MOON_EXIT,MOON_APPROACH,MOON_SLEEP_ANCHOR} from './moonDestination';
import {walkVisualHeight} from './fairyMetrics';
import {GARDEN_WORLD_BOUNDS} from '../rendering/gardenWorldBounds';
import { advance, distance, WALK_START, type Point } from './walkNetwork';
import { groundRoute } from './groundNavigation';
import { SWING_EXIT } from './swingDestination';
import { createAerialFlight, sampleFlight, smooth, SWING_FLIGHT_APPROACH, SWING_FLIGHT_SEAT } from './swingFlight';
export const WALK_SPEED=.085; // world units per millisecond; shared with renderer

export const WALK_HEIGHT_MULTIPLIER=4;
export type MovementDecision={target:Point;visualHeight:number;distanceToTarget:number;pathDistance:number|null;pathEvaluated:boolean;sameLocalPathSection:boolean;walkReachable:boolean|null;mode:'WALK'|'FLY'|'INVALID';reason:string};
export type FairyState='idle'|'walking'|'flying'|'flyingToSwing'|'aligningToSwing'|'sittingOnSwing'|'flyingToMoonBed'|'aligningToMoonBed'|'sleepingOnMoonBed'|'flyingToTea'|'aligningToTea'|'seatedAtTea'|'drinkingTea';
const length=(points:Point[])=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
export class FairyNavigation {
  state:FairyState='idle';position:Point;remaining:Point[]=[];target:Point|null=null;
  lift=0;flightStartLift=0;flightProgress=0;flight:Point[]=[];flightTime=0;duration=0;estimatedWalkMs=0;
  decision:MovementDecision|null=null;
  private teaTarget=false;private seatedTime=0;
  get atTea(){return this.state==='seatedAtTea'||this.state==='drinkingTea';}
  private swingTarget=false;private moonTarget=false;
  private alignment:Point[]=[];
  constructor(start:Point=WALK_START){this.position={...start};}
  get airborne(){return this.state==='flyingToTea'||this.state==='aligningToTea'||this.state==='flying'||this.state==='flyingToSwing'||this.state==='aligningToSwing'||this.state==='flyingToMoonBed'||this.state==='aligningToMoonBed';}
  private align(){
    const approach=createAerialFlight(this.position,this.teaTarget?TEA_APPROACH:this.moonTarget?MOON_APPROACH:SWING_FLIGHT_APPROACH);
    if(!approach){this.state='idle';return;}
    this.alignment=[...approach,this.teaTarget?TEA_SEAT:this.moonTarget?MOON_SLEEP_ANCHOR:SWING_FLIGHT_SEAT];this.flightTime=0;
    this.duration=Math.max(850,length(this.alignment)/.12);this.state=this.teaTarget?'aligningToTea':this.moonTarget?'aligningToMoonBed':'aligningToSwing';
  }
  move(destination:Point,blocked:(p:Point)=>boolean,swing=false,visualHeight=walkVisualHeight(),moon=false,tea=false){
    const requested=tea?TEA_EXIT:moon?MOON_EXIT:swing?SWING_EXIT:destination;
    const start=this.atTea?TEA_EXIT:this.state==='sleepingOnMoonBed'?MOON_EXIT:this.state==='sittingOnSwing'?SWING_EXIT:this.position;
    const b=GARDEN_WORLD_BOUNDS;
    const inside=Number.isFinite(requested.x)&&Number.isFinite(requested.y)&&requested.x>=b.x&&requested.x<b.x+b.width&&requested.y>=b.y&&requested.y<b.y+b.height;
    // Ground validity applies before either travel mode. Flying crosses water
    // and flower beds, but never makes them eligible landing destinations.
    const valid=inside&&!blocked(requested);
    const distanceToTarget=distance(this.position,requested);
    const walkLimit=WALK_HEIGHT_MULTIPLIER*visualHeight;
    // Far travel already selects flight under the approved four-height rule.
    // Avoid a synchronous island-wide ground search that cannot change that
    // decision. Null diagnostics mean "not evaluated", never "unreachable".
    const pathEvaluated=valid&&!this.airborne&&distanceToTarget<=walkLimit+1e-7;
    const points=pathEvaluated?groundRoute(start,requested,blocked):null;
    const pathDistance=points?length(points):null;
    const sameLocalPathSection=!!points&&length(points)<=walkLimit+1e-7;
    // Reachable local travel always stays grounded. Beyond the user's explicit
    // four-height cutoff, select the aerial shortcut even on a connected graph.
    const fly=this.airborne||!points||distanceToTarget>walkLimit+1e-7;
    this.decision={target:requested,visualHeight,distanceToTarget,pathDistance,pathEvaluated,sameLocalPathSection,walkReachable:pathEvaluated?!!points:null,mode:valid?(fly?'FLY':'WALK'):'INVALID',reason:!inside?'Outside Garden':!valid?'Water or plantable flower area':this.airborne?'Complete airborne approach before landing':distanceToTarget>walkLimit?'Beyond four fairy heights':!points?'No connected ground route':sameLocalPathSection?'Local connected ground · WALK preferred':'Within four fairy heights'};
    if(!valid)return false;
    if((tea&&this.atTea)||(swing&&this.state==='sittingOnSwing')||(moon&&this.state==='sleepingOnMoonBed'))return true;
    const flight=fly?createAerialFlight(start,tea?TEA_APPROACH:moon?MOON_APPROACH:swing?SWING_FLIGHT_APPROACH:(points?.at(-1)??requested)):null;
    if(fly&&!flight)return false; // No unsafe straight-line fallback.
    this.estimatedWalkMs=points?length(points)/WALK_SPEED:Infinity;this.flightStartLift=this.lift;this.position={...start};this.swingTarget=swing;this.moonTarget=moon;this.teaTarget=tea;this.seatedTime=0;
    this.target=points?.at(-1)??requested;this.flightTime=0;this.flightProgress=0;
    if(flight){this.flight=flight;this.remaining=[];this.duration=Math.max(1000,length(flight)/.18);this.state=tea?'flyingToTea':moon?'flyingToMoonBed':swing?'flyingToSwing':'flying';}
    else {this.remaining=points!.slice(1);this.lift=0;this.state=this.remaining.length?'walking':'idle';if(!this.remaining.length&&(swing||moon||tea))this.align();}
    return true;
  }
  update(dtMs:number,blocked:(p:Point)=>boolean){return this.tick(dtMs*WALK_SPEED,blocked);}
  tick(amount:number,blocked:(p:Point)=>boolean){
    if(this.state==='seatedAtTea'){this.seatedTime+=amount/WALK_SPEED;if(this.seatedTime>=1200)this.state='drinkingTea';return 0;}
    if(this.airborne){
      const old=this.position;this.flightTime+=amount/WALK_SPEED;
      const t=Math.min(1,this.flightTime/this.duration);this.flightProgress=t;
      if(this.state==='aligningToTea'||this.state==='aligningToSwing'||this.state==='aligningToMoonBed'){
        this.position=sampleFlight(this.alignment,smooth(t));this.lift=7.2*(1-smooth(t));
        if(t===1){this.state=this.teaTarget?'seatedAtTea':this.moonTarget?'sleepingOnMoonBed':'sittingOnSwing';this.lift=0;}
      }else{
        this.position=sampleFlight(this.flight,smooth(t));
        const endLift=(this.swingTarget||this.moonTarget||this.teaTarget)?.3:0;
        this.lift=(this.flightStartLift+(24-this.flightStartLift)*smooth(Math.min(1,this.flightTime/300)))*(1-(1-endLift)*smooth(Math.max(0,(t-.65)/.35)))+1.5*Math.sin(this.flightTime/310)*Math.sin(Math.PI*t);
        if(t===1){if(this.swingTarget||this.moonTarget||this.teaTarget)this.align();else {this.state='idle';this.lift=0;}}
      }
      return distance(old,this.position);
    }
    if(!this.remaining.length)return 0;
    const next=advance(this.position,this.remaining,amount,blocked);
    this.position=next.point;this.remaining=next.remaining;
    if(!this.remaining.length){this.state='idle';if((this.swingTarget||this.moonTarget||this.teaTarget)&&this.target&&distance(this.position,this.target)<.05)this.align();}
    return next.moved;
  }
  stop(){if(this.airborne)return;this.remaining=[];this.target=null;if(!this.atTea&&this.state!=='sittingOnSwing'&&this.state!=='sleepingOnMoonBed')this.state='idle';}
}
