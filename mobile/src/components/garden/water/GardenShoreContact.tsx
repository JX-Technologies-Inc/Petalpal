import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';

// Broken contact shadow and a short submerged stone foot, sampled from the real bank.
// Never brighten or dilate the island silhouette into a continuous rim.
const SHORE = Skia.RuntimeEffect.Make(`
uniform shader land;
// Restrict the final contact polish to the crescent, bridge approaches and
// small central channels. These coordinates affect water shading only.
float polishZone(float2 p) {
  float2 a=(p-float2(2080,730))/float2(345,175);
  float2 b=(p-float2(1640,960))/float2(260,165);
  float2 c=(p-float2(1690,1380))/float2(210,210);
  float2 d=(p-float2(870,520))/float2(145,165);
  float2 e=(p-float2(1000,1080))/float2(135,140);
  float zone=max(max(exp(-dot(a,a)*2.0),exp(-dot(b,b)*2.0)),
    max(exp(-dot(c,c)*2.0),max(exp(-dot(d,d)*2.0),exp(-dot(e,e)*2.0))));
  return smoothstep(0.05,0.82,zone);
}
half4 main(float2 p) {
  float own=land.eval(p).a;
  float contact=(land.eval(p+float2(-3,-5)).a*0.65+
                 land.eval(p+float2(2,-3)).a*0.35)*(1.0-own);
  float broken=smoothstep(-0.3,0.5,sin(p.x/43.0+sin(p.y/71.0)*2.0));
  float local=polishZone(p)*smoothstep(-0.25,0.65,
    sin(p.x/31.0+sin(p.y/57.0)*1.6)+sin(p.y/23.0)*0.32);
  float shadow=contact*broken*(0.31+local*0.075);
  half4 stone=(land.eval(p+float2(-3,-10-local*2.0))+land.eval(p+float2(-5,-13-local*2.0)))*0.5;
  float foot=stone.a*(1.0-own)*broken*(0.23+local*0.13);
  float3 tint=mix(stone.rgb/max(float(stone.a),0.001),float3(0.39,0.68,0.67),0.74-local*0.12);
  float alpha=shadow+foot*(1.0-shadow);
  return half4(float3(0.13,0.39,0.43)*shadow+tint*foot*(1.0-shadow),alpha);
}
`);
export default function GardenShoreContact({ image, x, y, width, height }: {
  image: SkImage; x: number; y: number; width: number; height: number;
}) {
  if (!SHORE) return null;
  return <Rect x={x-16} y={y-16} width={width+32} height={height+32}>
    <Shader source={SHORE}>
      <ImageShader image={image} rect={{ x, y, width, height }} fit="contain" tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}
