import { Group, Image, ImageShader, LinearGradient, Mask, Rect, Shader, Skia, useImage, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { INITIAL_WATER_TOP_PLACEMENT, type WaterTopPlacement } from '../waterTopPlacement';
import { WATER_TOP_ASSETS, WATER_TOP_CANVAS_HEIGHT as HEIGHT, WATER_TOP_CANVAS_WIDTH as WIDTH } from './waterTopAssets';

export type TopWaterMotionMode = 'static' | 'animate';
export type TopWaterLayerGroup = 'under' | 'over' | 'all';
export type WaterTopAssemblyProps = {
  placement?: WaterTopPlacement;
  motionMode?: TopWaterMotionMode;
  layerGroup?: TopWaterLayerGroup;
  active?: boolean;
  showWater?: boolean;
  showCliff?: boolean;
  showBank?: boolean;
  flow?: WaterTopFlow;
};

type WaterTopFlow = { seconds: SharedValue<number>; enabled: boolean };

// One clock shared by the channel AND the outlet, so motion never stops at
// the compositing seam. Background/reduced-motion pauses happen once.
export function useWaterTopFlow(active: boolean, animate: boolean): WaterTopFlow {
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const seconds = useSharedValue(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  const frame = useFrameCallback(info => {
    seconds.value += Math.min(info.timeSincePreviousFrame ?? 0,64)/1000;
  }, false);
  useEffect(() => {
    frame.setActive(active && foreground && animate && !reduced);
    return () => frame.setActive(false);
  }, [active, foreground, animate, reduced, frame]);
  return { seconds, enabled: animate && !reduced };
}

// Advect the existing painted texture, not a second layer of drawn highlights.
// Two staggered samples hide UV resets. Alpha and shore geometry remain fixed.
const SURFACE_EFFECT = Skia.RuntimeEffect.Make(`
uniform shader paintedWater;
uniform float seconds;
uniform float motion;
uniform float outletOnly;
float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1,311.7))) * 43758.5453);
}
float softField(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+float2(1,0)),f.x),
             mix(hash(i+float2(0,1)),hash(i+float2(1,1)),f.x),f.y);
}
half4 main(float2 p) {
  half4 c = paintedWater.eval(p);
  float downstream = smoothstep(450.0,960.0,p.y);
  float center = mix(770.0,800.0,smoothstep(400.0,900.0,p.y));
  // Extend clean water color under the bank silhouettes. The generated water
  // cutout is intentionally loose; its scalloped alpha is not a second shore.
  half4 shoreFill = paintedWater.eval(float2(clamp(p.x,center-160.0,center+160.0),p.y));
  half3 surfaceColor = mix(shoreFill.rgb/max(shoreFill.a,0.001),
                          c.rgb/max(c.a,0.001),smoothstep(0.8,0.995,c.a));
  c = half4(surfaceColor,1.0);
  // Stay underneath the painted inner banks until the final throat; narrowing
  // earlier exposes triangular gaps between the water and the rock shoulders.
  float halfWidth = mix(mix(520.0,440.0,smoothstep(450.0,700.0,p.y)),
                        210.0,smoothstep(600.0,920.0,p.y));
  float edge = 1.0-smoothstep(halfWidth-22.0,halfWidth,abs(p.x-center));
  float across = clamp((p.x-800.0)/210.0,-1.0,1.0);
  float lipY = 956.0-12.0*across*across;
  float endFade = 1.0-smoothstep(lipY-18.0,lipY+24.0,p.y);
  float front = mix(1.0,smoothstep(810.0,875.0,p.y),outletOnly);
  // Velocity goes inward and downstream. Near the drop the pull increases;
  // close to banks it fades out, keeping every shoreline attachment fixed.
  // Keep sampling well inside the irregular painted shores: their RGB edge
  // contours must never be advected into open water, even with alpha held fixed.
  float interior = 1.0-smoothstep(halfWidth*0.30,halfWidth*0.65,abs(p.x-center));
  float2 velocity = float2((center-p.x)*(0.02+0.04*downstream),22.0+26.0*downstream)*interior;
  float phaseA = fract(seconds/6.0);
  float phaseB = fract(seconds/6.0+0.5);
  float weightA = 1.0-abs(phaseA*2.0-1.0);
  half4 a = paintedWater.eval(p-velocity*6.0*phaseA);
  half4 b = paintedWater.eval(p-velocity*6.0*phaseB);
  // Reapply the original alpha: no moving cutout, shrinking shore or sliding PNG.
  half3 original = c.rgb/max(c.a,0.001);
  half3 rgbA = mix(original,a.rgb/max(a.a,0.001),smoothstep(0.75,0.985,a.a));
  half3 rgbB = mix(original,b.rgb/max(b.a,0.001),smoothstep(0.75,0.985,b.a));
  c.rgb = mix(c.rgb,mix(rgbB,rgbA,weightA)*c.a,motion*0.9*interior);
  // Match the existing light teal waterfall entrance without a flat patch.
  float lip = smoothstep(760.0,940.0,p.y)*0.22;
  c.rgb = mix(c.rgb,half3(0.616,0.871,0.890)*c.a,lip);
  float2 flow = float2((p.x-center)/(230.0-65.0*downstream),
                       p.y/200.0-seconds*0.1);
  float field = softField(flow)*0.7+softField(flow*1.37+float2(4.1,7.8))*0.3;
  c.rgb *= 1.0+motion*0.048*(field-0.5);
  return c * edge * endFade * front;
}
`);
if (!SURFACE_EFFECT) throw new Error('Water-top surface shader failed to compile');

function WaterSurface({ flow, outletOnly = false }: {
  flow: WaterTopFlow; outletOnly?: boolean;
}) {
  const image = useImage(WATER_TOP_ASSETS.waterStatic);
  const motion = flow.enabled ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    seconds: flow.seconds.value, motion, outletOnly: outletOnly ? 1 : 0,
  }), [flow.seconds, motion, outletOnly]);
  if (!image) return null;
  return <Rect x={0} y={0} width={WIDTH} height={HEIGHT}>
    <Shader source={SURFACE_EFFECT!} uniforms={uniforms}>
      <ImageShader image={image} fit="fill" rect={{x:0,y:0,width:WIDTH,height:HEIGHT}} tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}

function Banks({ front, x, y, scale }: { front: boolean; x: number; y: number; scale: number }) {
  const image = useImage(WATER_TOP_ASSETS.cliff);
  if (!image) return null;
  const artwork = <Image image={image} x={0} y={0} width={WIDTH} height={HEIGHT} fit="fill" />;
  return <Group transform={[{translateX:x},{translateY:y},{scale}]}>
    {front ? <Mask mode="alpha" mask={
      <Rect x={0} y={0} width={WIDTH} height={HEIGHT}>
        <LinearGradient start={vec(0,700)} end={vec(0,790)} colors={['#FFFFFF00','#FFFFFFFF']} />
      </Rect>
    }>{artwork}</Mask> : artwork}
  </Group>;
}

function WaterTopDrawing({ placement=INITIAL_WATER_TOP_PLACEMENT,
  layerGroup='all', active=true, flow,
  showWater=true, showCliff=true, showBank=true }: WaterTopAssemblyProps & { flow: WaterTopFlow }) {
  // Hook-owning children mount/unmount normally; no conditional hook order.
  if (!active) return null;
  const center={x:placement.x+WIDTH*placement.scale/2,y:placement.y+HEIGHT*placement.scale/2};
  return <Group origin={center} transform={[{rotate:placement.rotation*Math.PI/180}]}>
    <Group transform={[{translateX:placement.x},{translateY:placement.y},{scale:placement.scale}]}>
      {layerGroup !== 'over' && <Group>
        {showWater && <WaterSurface flow={flow} />}
        {showCliff && <Banks front={false} x={placement.cliffOffsetX}
          y={placement.cliffOffsetY} scale={placement.cliffScale} />}
      </Group>}
      {layerGroup !== 'under' && <Group>
        {showWater && <WaterSurface flow={flow} outletOnly />}
        {/* Real foreground rock shoulders overlap the cascade, including at
            zero offsets. Never replace the front lip with a flat water sticker. */}
        {showBank && <Banks front x={placement.cliffOffsetX+placement.bankOffsetX}
          y={placement.cliffOffsetY+placement.bankOffsetY} scale={placement.cliffScale*placement.bankScale} />}
      </Group>}
    </Group>
  </Group>;
}
function StandaloneWaterTop(props: WaterTopAssemblyProps) {
  const flow = useWaterTopFlow(props.active ?? true, props.motionMode === 'animate');
  return <WaterTopDrawing {...props} flow={flow} />;
}
export function WaterTopAssembly(props: WaterTopAssemblyProps) {
  return props.flow ? <WaterTopDrawing {...props} flow={props.flow} /> : <StandaloneWaterTop {...props} />;
}
export default memo(WaterTopAssembly);
