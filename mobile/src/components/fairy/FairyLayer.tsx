import {Atlas,Image,Skia,useImage} from '@shopify/react-native-skia';
import {memo,useCallback,useEffect,useMemo,useState} from 'react';
import {FAIRY_ASSETS} from './fairyAssets';
import {fairyInView,fairyWorldBounds,resolveFairyFrame,type FairyAssets,type FairyRuntime} from './fairyRuntime';

export type FairyVisualStatus='loading'|'reference-ready'|'sprite-ready'|'hidden'|'error';
export interface FairyLayerProps extends FairyRuntime {
  assets?:FairyAssets;frameIndex?:number;
  viewport?:{x:number;y:number;width:number;height:number};
  onStatus?:(status:FairyVisualStatus)=>void;
}
/** One visible image/sprite node. No animation timer or React frame loop.
 * Frame sequences and atlas pages share the same external character API. */
export const FairyLayer=memo(function FairyLayer({assets=FAIRY_ASSETS,frameIndex=0,viewport,onStatus,...runtime}:FairyLayerProps) {
  const frame=useMemo(()=>resolveFairyFrame(assets,runtime.animationState,runtime.facing,frameIndex),
    [assets,runtime.animationState,runtime.facing,frameIndex]);
  const valid=runtime.visible&&Number.isFinite(runtime.x)&&Number.isFinite(runtime.y)&&Number.isFinite(runtime.scale)&&runtime.scale>0;
  const shown=valid&&(!viewport||fairyInView(runtime,frame,viewport));
  const [failedSource,setFailedSource]=useState<number|string|null>(null);
  const onError=useCallback(()=>setFailedSource(frame.source),[frame.source]);
  const image=useImage(shown?frame.source:null,onError);
  const status:FairyVisualStatus=!shown?'hidden':failedSource===frame.source?'error':!image?'loading':frame.kind==='reference'?'reference-ready':'sprite-ready';
  useEffect(()=>{onStatus?.(status);},[status,onStatus]);
  const bounds=useMemo(()=>fairyWorldBounds(runtime,frame),[runtime.x,runtime.y,runtime.scale,frame]);
  const sprites=useMemo(()=>frame.sourceRect?[Skia.XYWHRect(frame.sourceRect.x,frame.sourceRect.y,frame.sourceRect.width,frame.sourceRect.height)]:[],[frame]);
  const transforms=useMemo(()=>frame.kind==='atlas'&&shown?[Skia.RSXform(runtime.scale,0,bounds.x,bounds.y)]:[],[frame.kind,shown,runtime.scale,bounds.x,bounds.y]);
  if(!shown||!image)return null;
  if(frame.kind==='atlas')return <Atlas image={image} sprites={sprites} transforms={transforms}/>;
  return <Image image={image} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fit="fill"/>;
});
