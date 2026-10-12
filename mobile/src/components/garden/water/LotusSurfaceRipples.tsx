import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

// Broken outward wisps follow the actual pad silhouettes, not circular stamps.
// Existing GardenLotusContact remains the unchanged stationary contact layer.
const RIPPLES = Skia.RuntimeEffect.Make(`
uniform shader pads;
uniform float seconds;
uniform float seed;
uniform float displayP3;
float hash(float2 p) {
  float3 q=fract(float3(p.x,p.y,p.x)*0.1031);
  q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float noise(float2 p) {
  float2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+float2(1,0)),f.x),
    mix(hash(i+float2(0,1)),hash(i+1.0),f.x),f.y);
}
float3 linearize(float3 c) {
  return mix(c/12.92,pow((c+0.055)/1.055,float3(2.4)),step(float3(0.04045),c));
}
float3 encode(float3 c) {
  return mix(c*12.92,1.055*pow(max(c,float3(0)),float3(1.0/2.4))-0.055,step(float3(0.0031308),c));
}
half4 main(float2 p) {
  float own=pads.eval(p).a;
  if(own>0.995)return half4(0);
  float light=0.0;
  for(int i=0;i<2;i++) {
    float key=seed+float(i)*3.7;
    float age=fract(seconds/(6.3+hash(float2(key,7.1))*3.4)+key);
    float envelope=smoothstep(0.0,0.20,age)*(1.0-smoothstep(0.35,1.0,age));
    float2 direction=float2(sin(key*2.3)*0.65,0.8);
    float2 offset=direction*(3.0+age*14.0);
    // The same two samples soften the departing event as it expands.
    // Extent, density, alpha ceiling and pad placement remain unchanged.
    float2 softness=float2(0.7,0.5)*(1.0+age*1.6);
    float displaced=(pads.eval(p-offset-softness).a+
      pads.eval(p-offset+softness).a)*0.5;
    float inside=pads.eval(p-offset*0.72).a;
    float fragment=smoothstep(0.34,0.73,noise(p/19.0+key+float2(age*0.6,-age*0.4)));
    light+=max(0.0,displaced-inside)*fragment*envelope;
  }
  float alpha=min(light*0.055,0.070)*(1.0-own);
  float3 rgb=float3(0.7412,0.9255,0.9373);
  if(displayP3>0.5) {
    float3 c=linearize(rgb);
    rgb=encode(float3(dot(c,float3(0.822593,0.177534,0)),
      dot(c,float3(0.033200,0.966784,0)),dot(c,float3(0.017085,0.072396,0.910302))));
  }
  return half4(rgb*alpha,alpha);
}
`);

export default function LotusSurfaceRipples({ image, width, height, seconds, seed, opacity }: {
  image: SkImage; width: number; height: number; seconds: SharedValue<number>; seed: number; opacity: number;
}) {
  const displayP3 = Platform.OS === 'web' ? 1 : 0;
  const uniforms = useDerivedValue(() => ({ seconds: seconds.value, seed, displayP3 }), [seconds, seed, displayP3]);
  if (!RIPPLES) return null;
  const padding = 20;
  return <Rect x={-padding} y={-padding} width={width+padding*2} height={height+padding*2} opacity={opacity}>
    <Shader source={RIPPLES} uniforms={uniforms}>
      <ImageShader image={image} rect={{x:0,y:0,width,height}} fit="fill" tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}
