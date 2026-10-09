import { Group, Rect, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

// Contact points on compact-r2, not random emitters on the dry cliff faces.
// Tight drawing rectangles keep the per-fragment work local to actual spray.
export const SPRAY_EMITTERS = [
  {"x":210,"y":1260,"width":690,"height":470,"originX":555,"originY":1500,"power":1.18,"direction":0,"seed":11},
  {"x":275,"y":1370,"width":245,"height":350,"originX":440,"originY":1525,"power":0.66,"direction":-1,"seed":83},
  {"x":620,"y":1370,"width":245,"height":350,"originX":670,"originY":1535,"power":0.66,"direction":1,"seed":97},
  {"x":335,"y":495,"width":190,"height":175,"originX":441,"originY":581,"power":0.44,"direction":-1,"seed":23},
  {"x":585,"y":495,"width":190,"height":175,"originX":666,"originY":582,"power":0.44,"direction":1,"seed":37},
  {"x":310,"y":970,"width":185,"height":195,"originX":420,"originY":1060,"power":0.40,"direction":-1,"seed":53},
  {"x":615,"y":1110,"width":185,"height":195,"originX":688,"originY":1190,"power":0.40,"direction":1,"seed":71}
] as const;

// Small irregular aerated fragments follow ejection -> arc -> gravity -> fade.
// The persistent impact mass is never translated, scaled or opacity-pulsed.
const SPRAY = Skia.RuntimeEffect.Make(`
uniform float seconds;
uniform float enabled;
uniform float2 origin;
uniform float power;
uniform float direction;
uniform float seed;
float rand(float n) { return fract(sin(n*127.1+seed*17.17)*43758.5453); }
float fragment(float2 q) {
  // Uneven joined lobes, not a pointed streak or a circular particle stamp.
  return (1.0-smoothstep(0.26,1.0,length(q)))*0.65+
    (1.0-smoothstep(0.18,0.75,length(q-float2(0.45,-0.28))))*0.35;
}
half4 bottomSplash(float2 p) {
  float coverage=0.0;
  for(int i=0;i<9;i++) {
    float n=float(i),duration=1.35+0.42*rand(n+8.0);
    float clock=seconds/duration+rand(n+19.0);
    float age=fract(clock),cycle=floor(clock),t=age*duration;
    // New trajectories each emission; changes occur only at zero coverage.
    float r=rand(n+cycle*31.0+103.0);
    float side=direction==0.0?(r<0.5?-1.0:1.0):direction;
    float2 start=origin+float2((r-0.5)*100.0*power,rand(n+33.0)*12.0);
    float2 v=float2(side*(62.0+70.0*rand(n+cycle*17.0+47.0)),
      -(155.0+90.0*rand(n+cycle*13.0+61.0)))*power;
    float gravity=380.0*power;
    float2 center=start+v*t+float2(0,0.5*gravity*t*t);
    float detach=max(t-0.24,0.0);
    float split=smoothstep(0.16,0.40,t);
    float life=smoothstep(0.0,0.07,age)*(1.0-smoothstep(0.48,0.96,age));
    float radius=(7.0+5.0*rand(n+81.0))*sqrt(power);
    float parent=fragment((p-center)/float2(radius,radius*1.25));
    coverage+=parent*life*(1.0-split)*0.72;
    for(int k=0;k<3;k++) {
      float child=float(k)-1.0;
      float2 separation=float2(child*(25.0+18.0*r),-abs(child)*24.0)*detach*power;
      float childRadius=radius*mix(0.68,0.22,smoothstep(0.2,1.1,t));
      float2 q=(p-center-separation)/float2(childRadius,childRadius*1.20);
      coverage+=fragment(q)*split*life*0.66;
    }
  }
  // Surface fragments disperse after landing, independently of airborne bursts.
  for(int j=0;j<7;j++) {
    float n=float(j),duration=1.8+0.65*rand(n+141.0);
    float clock=seconds/duration+rand(n+153.0),age=fract(clock);
    float r=rand(n+floor(clock)*23.0+163.0);
    float side=direction==0.0?(r<0.5?-1.0:1.0):direction;
    float2 center=origin+float2(side*(18.0+age*150.0)*power,20.0+age*105.0*power);
    float radius=mix(12.0,3.0,age)*sqrt(power);
    float2 q=(p-center)/float2(radius*1.5,radius*0.55);
    float broken=fragment(q)*(0.60+0.40*sin(q.x*3.0+q.y*4.0)*sin(q.y*3.0));
    coverage+=broken*smoothstep(0.0,0.12,age)*(1.0-smoothstep(0.25,1.0,age))*0.45;
  }
  // Taper before emitter bounds, never a rectangular cutoff at late life.
  float boundary=(1.0-smoothstep(155.0*power,230.0*power,abs(p.x-origin.x)))*
    (1.0-smoothstep(120.0,170.0,p.y-origin.y));
  float a=min(coverage,0.78)*boundary;
  return half4(half3(0.949,0.984,0.984)*a,a);
}
half4 main(float2 p) {
  if(enabled<0.5) return half4(0);
  if(origin.y>1400.0) return bottomSplash(p);
  float coverage=0.0;
  for(int i=0;i<22;i++) {
    float n=float(i),r=rand(n+1.0);
    float duration=0.83+0.48*rand(n+8.0);
    float age=fract(seconds/duration+rand(n+19.0));
    float t=age*duration;
    float side=direction==0.0 ? (r<0.5 ? -1.0:1.0) : direction;
    float2 velocity=float2(side*(55.0+110.0*rand(n+41.0)),-(85.0+155.0*rand(n+59.0)))*power;
    float2 start=origin+float2((r-0.5)*110.0*power,(rand(n+77.0)-0.5)*15.0);
    float gravity=340.0*power;
    float2 center=start+velocity*t+float2(0,0.5*gravity*t*t);
    float2 tangent=normalize(velocity+float2(0,gravity*t)+float2(0.001));
    float2 delta=p-center;
    float radius=(1.7+2.6*rand(n+93.0))*(origin.y>1400.0?1.35:1.0);
    float2 q=float2(dot(delta,float2(tangent.y,-tangent.x))/radius,dot(delta,tangent)/(radius*1.55));
    float shape=(1.0-smoothstep(0.22,1.0,length(q)))*0.78+
                (1.0-smoothstep(0.15,0.8,length(q-float2(0.32,0.65))))*0.22;
    float life=smoothstep(0.0,0.10,age)*(1.0-smoothstep(0.48,1.0,age));
    coverage+=shape*life*(0.34+0.28*r);
  }
  float a=min(coverage,0.68);
  return half4(half3(0.949,0.984,0.984)*a,a);
}
`);

function Emitter({ emitter:e, seconds, enabled }: {
  emitter: typeof SPRAY_EMITTERS[number]; seconds: SharedValue<number>; enabled: boolean;
}) {
  const uniforms=useDerivedValue(()=>({seconds:seconds.value,enabled:enabled?1:0,
    origin:[e.originX,e.originY],power:e.power,direction:e.direction,seed:e.seed}),[enabled,e]);
  if(!SPRAY || !enabled) return null;
  return <Rect x={e.x} y={e.y} width={e.width} height={e.height}>
    <Shader source={SPRAY} uniforms={uniforms} />
  </Rect>;
}

export default function WaterfallV2Spray({seconds,enabled}:{seconds:SharedValue<number>;enabled:boolean}) {
  return <Group>{SPRAY_EMITTERS.map(e=><Emitter key={e.seed} emitter={e} seconds={seconds} enabled={enabled} />)}</Group>;
}
