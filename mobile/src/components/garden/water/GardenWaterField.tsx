import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { useWaterTopFlow } from './WaterTopAssembly';

// The extended rect is a static backdrop only. Moving water stays inside the
// garden's receiving-water bounds; the approved upper river animates itself.
const FIELD = Skia.RuntimeEffect.Make(`
uniform shader base;
uniform float seconds;
float hash(float2 p){return fract(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
float noise(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+1.0),f.x),f.y);}
half4 main(float2 p){
  float outside=length(max(max(-p,p-float2(2400,1800)),float2(0)));
  float extension=smoothstep(0.0,300.0,outside);
  // Beyond the unchanged transition, the result is exactly this opaque tone.
  if(extension>=1.0)return half4(0.471,0.722,0.698,1);
  half3 painted=base.eval(p).rgb;
  float depth=noise(p/610.0+float2(2.1,0.7))*0.65+noise(p/310.0+7.3)*0.35;
  // Broad downstream corridor; no strokes, stripes or hard region boundary.
  float center=1120.0+170.0*sin(p.y/620.0);
  float channel=exp(-pow((p.x-center)/260.0,2.0));
  float visible=smoothstep(0.0,100.0,p.y)*(1.0-smoothstep(1700.0,1800.0,p.y))*
    smoothstep(0.0,100.0,p.x)*(1.0-smoothstep(2300.0,2400.0,p.x));
  half3 tone=mix(half3(0.310,0.655,0.698),half3(0.616,0.871,0.890),depth);
  half3 rgb=mix(painted,tone,0.30);
  // Keep every moving-water calculation inside its existing nonzero region.
  if(visible>0.0){
  float speed=mix(2.0,5.0,channel);
  float2 uv=(p-float2(seconds*0.7,seconds*speed))/155.0;
  float broad=noise(uv)-0.5;
  // Counter-moving, soft local detail breaks the single-plane scrolling read.
  float phase=noise(p/210.0+5.7)*6.0;
  float2 local=p/44.0+float2(seconds*0.19,-seconds*0.13);
  local+=float2(noise(p/100.0+seconds*0.045),noise(p/115.0-seconds*0.035))*0.8;
  float fine=noise(local+phase)*0.6+noise(p/67.0+float2(-seconds*0.11,seconds*0.16)+phase)*0.4-0.5;
  float outflow=exp(-dot((p-float2(1060,240))/float2(260,240),(p-float2(1060,240))/float2(260,240)));
  // Do not stretch the image's edge row into vertical bands upstream.
  rgb+=visible*(broad*0.026+fine*mix(0.070,0.090,outflow));
  }
  // A soft static transition avoids a hard horizon without flooding the upstream backdrop.
  rgb=mix(rgb,half3(0.471,0.722,0.698),extension);
  return half4(rgb,1);
}
`);

export default function GardenWaterField({image,active,animated=true}:{image:SkImage;active:boolean;animated?:boolean}) {
  const flow=useWaterTopFlow(active,animated);
  const uniforms=useDerivedValue(()=>({seconds:flow.enabled?flow.seconds.value:0}),[flow.enabled]);
  if(!FIELD)return null;
  return <Rect x={-2400} y={-2400} width={7200} height={6600}>
    <Shader source={FIELD} uniforms={uniforms}>
      <ImageShader image={image} rect={{x:0,y:0,width:2400,height:1800}} fit="fill" tx="clamp" ty="clamp" />
    </Shader>
  </Rect>;
}
