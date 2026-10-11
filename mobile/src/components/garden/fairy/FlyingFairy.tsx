import { Group, Image, ImageShader, Rect, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { useDerivedValue, useReducedMotion, type SharedValue } from 'react-native-reanimated';

// The reference cutout is kept intact. Continuous, feathered displacement
// animates only the wing tips and trailing petals, leaving face/hair/torso still.
const GLIDE=Skia.RuntimeEffect.Make(`
uniform shader sprite;
uniform float seconds;
uniform float motion;
half4 main(float2 p) {
  float2 uv=(p-float2(-78.0,-135.0))/float2(112.0,150.0);
  float wings=(1.0-smoothstep(.53,.65,uv.x))*(1.0-smoothstep(.28,.40,uv.y));
  float trailing=(1.0-smoothstep(.42,.67,uv.x))*smoothstep(.40,.58,uv.y);
  float flap=sin(seconds*2.6);
  uv.x+=(uv.x-.62)*.055*flap*wings*motion;
  uv.y+=.006*flap*wings*motion;
  uv.y+=.011*sin(seconds*1.9-uv.x*4.0)*trailing*motion;
  uv.x+=.004*sin(seconds*1.9+.7)*trailing*motion;
  return sprite.eval(uv*float2(112.0,150.0));
}
`);

export default function FlyingFairy({seconds,blend}:{seconds:SharedValue<number>;blend:SharedValue<number>}){
  const image=useImage(require('@/assets/garden/fairy/fly-v1/glide.png'));
  const reducedMotion=useReducedMotion();
  const uniforms=useDerivedValue(()=>({seconds:seconds.value,motion:reducedMotion?0:blend.value}));
  if(!image)return null;
  return <Group opacity={blend}>
    {GLIDE?<Rect x={-82} y={-139} width={120} height={158}>
      <Shader source={GLIDE} uniforms={uniforms}>
        <ImageShader image={image} rect={{x:0,y:0,width:112,height:150}} fit="fill" tx="decal" ty="decal"/>
      </Shader>
    </Rect>:<Image image={image} x={-78} y={-135} width={112} height={150} fit="fill"/>}
  </Group>;
}
