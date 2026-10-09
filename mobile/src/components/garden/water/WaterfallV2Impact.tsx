import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

// Coordinates share the compact painting's contact frame (before its +192 inlet).
// One local pass; same clock as the waterfall, no React animation loop.
const IMPACT = Skia.RuntimeEffect.Make(`
uniform shader painting;
uniform float seconds;
uniform float enabled;
float hash(float2 p) { return fract(sin(dot(p,float2(127.1,311.7)))*43758.5453); }
float noise(float2 p) {
  float2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+1.0),f.x),f.y);
}
half4 main(float2 p) {
  float t=enabled>0.5?seconds:0.0;
  float2 d=p-float2(555,1520);
  // Unequal downstream lobes, not a single enclosed oval/foam disk.
  float2 q=(p-float2(540,1550))/float2(165,100);
  float2 l=(p-float2(465,1635))/float2(155,125);
  float2 r=(p-float2(640,1605))/float2(115,95);
  float envelope=min(1.0,exp(-dot(q,q)*1.7)+0.55*exp(-dot(l,l)*1.6)+0.35*exp(-dot(r,r)*1.8));
  envelope*=smoothstep(240.0,300.0,p.x)*(1.0-smoothstep(810.0,880.0,p.x));
  envelope*=smoothstep(1485.0,1535.0,p.y)*(1.0-smoothstep(1810.0,1880.0,p.y));
  half4 art=painting.eval(p+float2(0,192));
  float3 c=art.rgb/max(art.a,0.001);
  float wet=max(smoothstep(0.015,0.085,min(c.g-c.r,c.b-c.r)),smoothstep(0.82,0.96,min(c.r,min(c.g,c.b))));
  envelope*=mix(1.0,wet,smoothstep(0.05,0.7,art.a));
  if(envelope<0.001)return half4(0);
  float2 left=p-float2(425,1580),right=p-float2(695,1595);
  float2 velocity=float2(d.x*0.24,30.0+max(d.y,0.0)*0.16)+
    float2(-left.y,left.x)*exp(-dot(left,left)/9500.0)*0.85-
    float2(-right.y,right.x)*exp(-dot(right,right)/11000.0)*0.75;
  float detail=0.0;
  // Overlapping transported parcels hide resets; no synchronized opacity pulse.
  for(int i=0;i<3;i++) {
    float age=fract(t/2.3+float(i)/3.0);
    float weight=(0.5-0.5*cos(6.2831853*age))/1.5;
    float2 uv=(p-velocity*age*2.3)/17.0;
    float n=noise(uv+float2(noise(uv*0.37+t*0.23),noise(uv*0.41-t*0.19))*1.8);
    detail+=weight*(n*0.65+noise(uv*2.4+7.1)*0.35);
  }
  float core=exp(-dot(d/float2(110,43),d/float2(110,43)));
  float downstream=1.0-smoothstep(70.0,315.0,d.y);
  // A compact active core; sparse outer clusters must not refill the painting's gaps.
  float froth=smoothstep(0.53,0.74,detail)*(0.46*core+0.09*downstream);
  float disturbance=(0.11+0.09*detail)*downstream;
  float a=envelope*(disturbance+froth);
  half3 teal=mix(half3(0.31,0.655,0.698),half3(0.518,0.820,0.847),detail);
  half3 rgb=mix(teal,half3(0.949,0.984,0.984),froth/max(disturbance+froth,0.001));
  return half4(rgb*a,a);
}
`);

export default function WaterfallV2Impact({ image, seconds, enabled }: {
  image: SkImage; seconds: SharedValue<number>; enabled: boolean;
}) {
  const uniforms=useDerivedValue(()=>({seconds:seconds.value,enabled:enabled?1:0}),[enabled]);
  if(!IMPACT)return null;
  return <Rect x={230} y={1485} width={660} height={410}>
    <Shader source={IMPACT} uniforms={uniforms}>
      <ImageShader image={image} fit="contain" rect={{x:0,y:0,width:1024,height:2048}} tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}
