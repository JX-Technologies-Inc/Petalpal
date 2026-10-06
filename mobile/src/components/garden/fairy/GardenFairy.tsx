import { Circle, Group, Image, Path, useImage } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { advance, nearest, route, WALK_NETWORK, WALK_START, walkFrame, type Point } from './walkNetwork';

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
export type FairyHandle = { move:(p:Point)=>boolean; pointer:(p:Point)=>void; stop:()=>void };
type Props={blocked:(p:Point)=>boolean;active:boolean;debug:boolean;onStatus:(s:string)=>void};
const polyline=(points:Point[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
const networkPath=WALK_NETWORK.edges.map(e=>polyline([WALK_NETWORK.nodes[e.a],WALK_NETWORK.nodes[e.b]])).join(' ');
function Frame({index,frame}:{index:number;frame:SharedValue<number>}) {
  const image=useImage(sources[index]);const opacity=useDerivedValue(()=>frame.value===index?1:0);
  // One fixed foot/base pivot for all frames. No per-frame translation, bob or morph.
  return image?<Image image={image} x={-58} y={-139} width={102.4} height={153.6} fit="fill" opacity={opacity}/>:null;
}
const GardenFairy=forwardRef<FairyHandle,Props>(function GardenFairy({blocked,active,debug,onStatus},ref){
  const x=useSharedValue(WALK_START.x),y=useSharedValue(WALK_START.y),facing=useSharedValue(1),frame=useSharedValue(3);
  const position=useRef({...WALK_START}),remaining=useRef<Point[]>([]),elapsed=useRef(0),target=useRef<Point|null>(null);
  const config=useRef({blocked,active,debug,onStatus});config.current={blocked,active,debug,onStatus};
  const [routeDrawing,setRouteDrawing]=useState(''),[targetDrawing,setTargetDrawing]=useState<Point|null>(null);
  const [pointerDrawing,setPointerDrawing]=useState<{p:Point;valid:boolean}|null>(null);
  const trace=useRef<Point[]>([]);
  const transform=useSharedValue([{translateX:WALK_START.x},{translateY:WALK_START.y},{scaleX:1}]);
  const step=useRef<(now:number)=>void>(()=>{});
  const controls=useRef<FairyHandle>(null);
  if(!controls.current)controls.current={
    move(p){
      if(!config.current.active)return false;
      const points=route(position.current,p,config.current.blocked);
      if(!points){config.current.onStatus('Not a reachable path');return false;}
      remaining.current=points.slice(1);target.current=remaining.current.length?points.at(-1)!:null;elapsed.current=0;
      if(config.current.debug){setRouteDrawing(remaining.current.length?polyline(points):'');setTargetDrawing(target.current);}
      config.current.onStatus(remaining.current.length?'Walking on the path':'Resting on the path');
      // Account for elapsed time immediately on input, then resume the same RAF
      // loop. The next frame starts at this timestamp, so time is never counted twice.
      step.current(performance.now());return true;
    },
    pointer(p){if(!config.current.debug)return;const valid=!config.current.blocked(p)&&!!nearest(p);
      setPointerDrawing({p,valid});config.current.onStatus(`Pointer: ${valid?'path':'not walkable'} · ${Math.round(p.x)}, ${Math.round(p.y)}`);},
    stop(){remaining.current=[];frame.value=3;setRouteDrawing('');target.current=null;setTargetDrawing(null);},
  };
  useImperativeHandle(ref,()=>controls.current!,[]);
  useEffect(()=>{
    let previous:number|undefined,request:number;
    const advanceAt=(now:number)=>{
      const dt=previous===undefined?0:Math.max(0,Math.min(50,now-previous));
      previous=Math.max(previous??now,now);
      if(config.current.active&&remaining.current.length){
        const old=position.current;
        const result=advance(old,remaining.current,dt*.110,config.current.blocked);
        position.current=result.point;remaining.current=result.remaining;
        if(Math.abs(result.point.x-old.x)>.001)facing.value=result.point.x>old.x?1:-1;
        x.value=result.point.x;y.value=result.point.y;
        // Publish the transform together with the foot update. A derived web
        // mapper otherwise defers this transform for another animation frame.
        transform.value=[{translateX:result.point.x},{translateY:result.point.y},{scaleX:facing.value}];
        elapsed.current+=dt;frame.value=walkFrame(elapsed.current,result.remaining.length>0);
        if(config.current.debug&&result.moved){trace.current.push(result.point);if(trace.current.length>20000)trace.current.shift();}
        if(!result.remaining.length){target.current=null;if(config.current.debug){setTargetDrawing(null);setRouteDrawing('');}config.current.onStatus('Resting on the path');}
      }else frame.value=3;
    };
    step.current=advanceAt;
    const tick=(now:number)=>{advanceAt(now);request=requestAnimationFrame(tick);};
    request=requestAnimationFrame(tick);return()=>{step.current=()=>{};cancelAnimationFrame(request);};
  },[x,y,frame,facing,transform]);
  useEffect(()=>{if(!active)controls.current?.stop();},[active]);
  useEffect(()=>{
    // Debug drawings are React state; normal retargeting only changes refs and
    // shared animation values. Populate the overlay when it is switched on.
    setRouteDrawing(debug&&remaining.current.length?polyline([position.current,...remaining.current]):'');
    setTargetDrawing(debug?target.current:null);
  },[debug]);
  useEffect(()=>{
    if(!__DEV__||typeof window==='undefined')return;
    const host=window as unknown as {__fairyDebug?:unknown};
    const api={move:(p:Point)=>controls.current!.move(p),getState:()=>({position:position.current,target:target.current,
      remaining:remaining.current,frame:frame.value+1,facing:facing.value,source:'V2',active:config.current.active}),
      network:WALK_NETWORK,trace:()=>trace.current,clearTrace:()=>{trace.current=[];},
      isWalkable:(p:Point)=>!config.current.blocked(p)&&!!nearest(p),route:(p:Point)=>route(position.current,p,config.current.blocked)};
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
    <Group transform={transform}>{sources.map((_,index)=><Frame key={index} index={index} frame={frame}/>)}</Group>
    {debug&&<Circle cx={x} cy={y} r={4} color="#ff4285"/>}
  </>;
});
export default GardenFairy;
