import {WALK_SPRITE_HEIGHT,walkVisualHeight,FLY_VISUAL_HEIGHT,SEATED_VISUAL_HEIGHT} from './fairyMetrics';
import { FairyNavigation, type FairyState } from './FairyNavigation';
import SwingFlightOcclusion from './SwingFlightOcclusion';
import FlyingFairy from './FlyingFairy';
import { SWING_APPROACH } from './swingDestination';
import { Circle, Group, Image, Path, useImage } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { WALK_NETWORK, WALK_START, walkFrame, type Point } from './walkNetwork';
import { groundRoute } from './groundNavigation';

// Static, explicit V2-only sources. Original PNGs are copied byte-for-byte.
const sources = [
  require('@/assets/garden/fairy/walk-v2/walk_01.png'),
  require('@/assets/garden/fairy/walk-v2/walk_02.png'),
  require('@/assets/garden/fairy/walk-v2/walk_03.png'),
  require('@/assets/garden/fairy/walk-v2/walk_04.png'),
  require('@/assets/garden/fairy/walk-v2/walk_05.png'),
  require('@/assets/garden/fairy/walk-v2/walk_06.png'),
  require('@/assets/garden/fairy/walk-v2/walk_07.png'),
  require('@/assets/garden/fairy/walk-v2/walk_08.png'),
];
export type FairyHandle = { move:(p:Point)=>boolean; visitSwing:()=>boolean; visitMoonBed:()=>boolean; visitTea:()=>boolean; pointer:(p:Point)=>void; stop:()=>void };
type Props={pixelsPerUnit?:()=>number;onStateChange?:(state:FairyState)=>void;blocked:(p:Point)=>boolean;active:boolean;debug:boolean;onStatus:(s:string)=>void};
const polyline=(points:Point[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
const networkPath=WALK_NETWORK.edges.map(e=>polyline([WALK_NETWORK.nodes[e.a],WALK_NETWORK.nodes[e.b]])).join(' ');
function Frame({index,frame}:{index:number;frame:SharedValue<number>}) {
  const image=useImage(sources[index]);const opacity=useDerivedValue(()=>frame.value===index?1:0);
  // One fixed foot/base pivot for all frames. No per-frame translation, bob or morph.
  return image?<Image image={image} x={-58} y={-139} width={102.4} height={WALK_SPRITE_HEIGHT} fit="fill" opacity={opacity}/>:null;
}
const GardenFairy=forwardRef<FairyHandle,Props>(function GardenFairy({blocked,active,debug,onStatus,onStateChange,pixelsPerUnit},ref){
  const x=useSharedValue(WALK_START.x),y=useSharedValue(WALK_START.y),facing=useSharedValue(1),frame=useSharedValue(3);
  const lift=useSharedValue(0), lean=useSharedValue(0);
  const flightSeconds=useSharedValue(0), flightBlend=useSharedValue(0);
  const groundOpacity=useDerivedValue(()=>1-flightBlend.value);
  const nav=useRef(new FairyNavigation());
  const elapsed=useRef(0);
  const [state,setState]=useState<FairyState>('idle');
  const lastState=useRef<FairyState>('idle');
  const config=useRef({blocked,active,debug,onStatus,onStateChange,pixelsPerUnit});config.current={blocked,active,debug,onStatus,onStateChange,pixelsPerUnit};
  const [routeDrawing,setRouteDrawing]=useState(''),[targetDrawing,setTargetDrawing]=useState<Point|null>(null);
  const [pointerDrawing,setPointerDrawing]=useState<{p:Point;valid:boolean}|null>(null);
  const trace=useRef<Point[]>([]);
  const transform=useDerivedValue(()=>[{translateX:x.value},{translateY:y.value-lift.value},{rotate:lean.value},{scaleX:facing.value}]);
  const controls=useRef<FairyHandle>(null);
  const publish = () => {
    const current=nav.current;
    x.value=current.position.x;y.value=current.position.y;lift.value=current.lift;
    flightBlend.value=current.airborne?((current.state==='aligningToTea'||current.state==='aligningToSwing'||current.state==='aligningToMoonBed')?1:Math.min(1,current.flightTime/220)*(current.state==='flying'?Math.min(1,(1-current.flightProgress)*current.duration/220):1)):0;
    if(lastState.current!==current.state){
      lastState.current=current.state;setState(current.state);config.current.onStateChange?.(current.state);
      config.current.onStatus({flyingToTea:'Flying to afternoon tea',aligningToTea:'Taking a seat',seatedAtTea:'Seated for afternoon tea',drinkingTea:'Enjoying afternoon tea · tap to leave',flyingToMoonBed:'Flying to the moon bed',aligningToMoonBed:'Settling into the moon bed',sleepingOnMoonBed:'Sleeping on the moon bed · tap to leave',idle:'Resting on dry ground',walking:'Walking on dry ground',flying:'Flying to the destination',flyingToSwing:'Flying to the swing',aligningToSwing:'Settling onto the swing',sittingOnSwing:'Sitting on the swing · tap dry ground to leave'}[current.state]);
    }
  };
  const requestMove=(p:Point,swing=false,moon=false,tea=false)=>{
    if(!config.current.active)return false;
    const accepted=nav.current.move(p,config.current.blocked,swing,nav.current.state==='sittingOnSwing'?SEATED_VISUAL_HEIGHT:nav.current.airborne?FLY_VISUAL_HEIGHT:walkVisualHeight(frame.value),moon,tea);
    if(__DEV__)console.info('[Fairy movement decision]',JSON.stringify(nav.current.decision));
    if(!accepted){config.current.onStatus(nav.current.decision?.reason==='Water or plantable flower area'?'Water / flower bed · choose dry ground':'Cannot reach this destination');return false;}
    elapsed.current=0;
    setRouteDrawing(polyline([nav.current.position,...nav.current.remaining]));setTargetDrawing(nav.current.target);
    publish();
    if(__DEV__&&nav.current.decision){const d=nav.current.decision;
      config.current.onStatus(`${d.mode} · height ${d.visualHeight.toFixed(1)} · distance ${d.distanceToTarget.toFixed(1)}\nPath: ${d.pathDistance?.toFixed(1)??(d.pathEvaluated?"unreachable":"not evaluated")} · local section: ${d.sameLocalPathSection}\n${d.reason}`);
    }
    return true;
  };
  if(!controls.current)controls.current={
    move:p=>requestMove(p),
    visitSwing:()=>requestMove(SWING_APPROACH,true),
    visitTea:()=>requestMove({x:0,y:0},false,false,true),
    visitMoonBed:()=>requestMove({x:0,y:0},false,true),
    pointer(p){if(!config.current.debug)return;const valid=!config.current.blocked(p);
      setPointerDrawing({p,valid});},
    stop(){nav.current.stop();frame.value=3;setRouteDrawing('');setTargetDrawing(null);publish();},
  };
  useImperativeHandle(ref,()=>controls.current!,[]);
  useEffect(()=>{
    let previous:number|undefined,request:number;
    const tick=(now:number)=>{
      const dt=previous===undefined?0:Math.min(50,now-previous);previous=now;
      if(config.current.active&&(nav.current.remaining.length||nav.current.airborne||nav.current.state==='seatedAtTea')){
        const old=nav.current.position;
        const moved=nav.current.update(dt,config.current.blocked);
        if(nav.current.airborne)flightSeconds.value+=dt/1000;
        const point=nav.current.position;
        if(Math.abs(point.x-old.x)>.001)facing.value=point.x>old.x?1:-1;
        lean.value+=( (nav.current.airborne ? (point.x-old.x)*.012 : 0)-lean.value)*Math.min(1,dt/160);
        publish();elapsed.current+=dt;frame.value=nav.current.airborne?3:walkFrame(elapsed.current,nav.current.remaining.length>0);
        if(config.current.debug&&moved){trace.current.push(point);if(trace.current.length>20000)trace.current.shift();}
        if(!nav.current.remaining.length)setRouteDrawing('');
      }else frame.value=3;
      request=requestAnimationFrame(tick);
    };request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request);
  },[x,y,frame,facing]);
  useEffect(()=>{if(!active)controls.current?.stop();},[active]);
  useEffect(()=>{
    if(!__DEV__||typeof window==='undefined')return;
    const host=window as unknown as {__fairyDebug?:unknown};
    const api={move:(p:Point)=>controls.current!.move(p),getState:()=>({position:nav.current.position,target:nav.current.target,
      remaining:nav.current.remaining,frame:frame.value+1,facing:facing.value,source:'V2',state:nav.current.state,decision:nav.current.decision,lift:nav.current.lift,flightProgress:nav.current.flightProgress,active:config.current.active}),
      network:WALK_NETWORK,trace:()=>trace.current,clearTrace:()=>{trace.current=[];},
      isWalkable:(p:Point)=>!config.current.blocked(p),route:(p:Point)=>groundRoute(nav.current.position,p,config.current.blocked)};
    host.__fairyDebug=api;return()=>{if(host.__fairyDebug===api)delete host.__fairyDebug;};
  },[frame,facing]);
  return <>
    {debug&&<>
      <Path path={networkPath} color="rgba(40,215,210,.4)" style="stroke" strokeWidth={12}/>
      <Path path={networkPath} color="#e6fff7" style="stroke" strokeWidth={2}/>
      {routeDrawing&&<Path path={routeDrawing} color="#ffde68" style="stroke" strokeWidth={5}/>}
      {targetDrawing&&<Circle cx={targetDrawing.x} cy={targetDrawing.y} r={7} color="#ffde68"/>}
      {pointerDrawing&&<Circle cx={pointerDrawing.p.x} cy={pointerDrawing.p.y} r={8} color={pointerDrawing.valid?'#48e0a0':'#fb6272'}/>}
    </>}
    <Group opacity={(state==='seatedAtTea'||state==='drinkingTea'||state==='sittingOnSwing'||state==='sleepingOnMoonBed')?0:1} transform={transform}>
      <Group opacity={groundOpacity}>{sources.map((_,index)=><Frame key={index} index={index} frame={frame}/>)}</Group>
      <FlyingFairy seconds={flightSeconds} blend={flightBlend}/>
    </Group>
    {(state==='flying'||state==='flyingToSwing'||state==='aligningToSwing')&&<SwingFlightOcclusion/>}
    {debug&&<Circle cx={x} cy={y} r={4} color="#ff4285"/>}
  </>;
});
export default GardenFairy;
