import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';

// Reuse the unchanged cluster image under the same sway/placement transform.
const CONTACT = Skia.RuntimeEffect.Make(`
uniform shader pads;
uniform float2 size;
half4 main(float2 p) {
  float own=pads.eval(p).a;
  float shade=(pads.eval(p-float2(1.5,2.5)).a+pads.eval(p-float2(-2.0,2.0)).a)*0.5;
  // Broken reflections follow the actual pad silhouette, not a cluster ellipse.
  float edge=max(0.0,pads.eval(p+float2(2.5,-1.0)).a-own);
  float glint=edge*smoothstep(0.25,0.85,sin(p.x/size.x*19.0+p.y/size.y*11.0))*0.065;
  float shadow=shade*0.14*(1.0-own);
  return half4(half3(0.243,0.529,0.573)*shadow+half3(0.949,0.984,0.984)*glint,
               shadow+glint);
}
`);

export default function GardenLotusContact({ image, width, height, opacity }: {
  image: SkImage; width: number; height: number; opacity: number;
}) {
  if (!CONTACT) return null;
  const padding = Math.max(8, width * 0.07);
  return <Rect x={-padding} y={-padding} width={width + padding * 2} height={height + padding * 2} opacity={opacity}>
    <Shader source={CONTACT} uniforms={{ size: [width, height] }}>
      <ImageShader image={image} rect={{ x: 0, y: 0, width, height }} fit="fill" tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}
