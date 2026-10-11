import { Rect, Shader, Skia } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

// Small paired wake fragments in the existing fish-head coordinate frame.
// No separate route, timer, sprite deformation or bitmap animation.
const WAKE = Skia.RuntimeEffect.Make(`
uniform float seconds;
uniform float2 anchor;
uniform float heading;
uniform float seed;
uniform float displayP3;
float3 linearize(float3 c) {
  return mix(c/12.92,pow((c+0.055)/1.055,float3(2.4)),step(float3(0.04045),c));
}
float3 encode(float3 c) {
  return mix(c*12.92,1.055*pow(max(c,float3(0)),float3(1.0/2.4))-0.055,step(float3(0.0031308),c));
}
half4 main(float2 p) {
  float2 d=p-anchor,axis=float2(cos(heading),sin(heading));
  float2 q=float2(dot(d,axis),dot(d,float2(-axis.y,axis.x)));
  float behind=-q.x;
  float reach=smoothstep(4.0,16.0,behind)*(1.0-smoothstep(49.0,83.0,behind));
  if(reach<0.001)return half4(0);
  float side=q.y<0.0?-1.0:1.0;
  float t=seconds/(1.0+seed*0.06);
  // Two asynchronous departing wake events, with outward softening.
  // The fish transform/route is untouched and peak opacity cannot increase.
  float age=fract(t/(4.6+seed*0.11)+seed*0.19+side*0.27);
  float envelope=smoothstep(0.0,0.18,age)*(1.0-smoothstep(0.58,1.0,age));
  float width=7.0+behind*0.21+sin(behind*0.065-t*0.71+seed+side)*2.0+age*2.0;
  float softness=2.8+age*0.8;
  float ribbon=exp(-pow((abs(q.y)-width)/softness,2.0))*(2.8/softness);
  float broken=smoothstep(0.15,0.82,sin(behind*0.12-t*0.36+seed*3.1+side*1.8));
  float pulse=envelope;
  float alpha=reach*ribbon*broken*pulse*0.060;
  float3 rgb=float3(0.7412,0.9255,0.9373);
  if(displayP3>0.5) {
    float3 c=linearize(rgb);
    rgb=encode(float3(dot(c,float3(0.822593,0.177534,0)),
      dot(c,float3(0.033200,0.966784,0)),dot(c,float3(0.017085,0.072396,0.910302))));
  }
  return half4(rgb*alpha,alpha);
}
`);

export default function FishSurfaceWake({ seconds, x, y, heading, seed }: {
  seconds: SharedValue<number>; x: number; y: number; heading: number; seed: number;
}) {
  const displayP3 = Platform.OS === 'web' ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    seconds: seconds.value, anchor: [x, y], heading, seed, displayP3,
  }), [seconds, x, y, heading, seed, displayP3]);
  if (!WAKE) return null;
  return <Rect x={x-100} y={y-100} width={200} height={200}>
    <Shader source={WAKE} uniforms={uniforms} />
  </Rect>;
}
