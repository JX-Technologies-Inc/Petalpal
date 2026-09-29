import { ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';

// Reuses Land's decoded image and transform. Stationary contact depth follows
// the real alpha contour; no duplicated decoding, guessed island shapes or foam ring.
const SHORE = Skia.RuntimeEffect.Make(`
uniform shader land;
half4 main(float2 p){
  float own=land.eval(p).a;
  if(own>0.99)return half4(0);
  float near=0.0,wide=0.0;
  for(int i=0;i<8;i++){
    float angle=float(i)*0.785398;
    float2 direction=float2(cos(angle),sin(angle));
    near+=land.eval(p+direction*6.0).a/8.0;
    wide+=land.eval(p+direction*17.0).a/8.0;
  }
  float variation=0.78+0.22*sin(p.x/91.0+p.y/137.0);
  float a=(near*0.20+wide*0.09)*(1.0-own)*variation;
  return half4(half3(0.243,0.529,0.573)*a,a);
}
`);

export default function GardenShoreContact({image,x,y,width,height}:{image:SkImage;x:number;y:number;width:number;height:number}){
  if(!SHORE)return null;
  return <Rect x={x-20} y={y-20} width={width+40} height={height+40}>
    <Shader source={SHORE}>
      <ImageShader image={image} rect={{x,y,width,height}} fit="contain" tx="decal" ty="decal" />
    </Shader>
  </Rect>;
}
