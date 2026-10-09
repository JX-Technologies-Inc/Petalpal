import { ImageShader, Rect, Shader, Skia, AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

// Reuses Land's decoded image and transform. Stationary contact depth follows
// the real alpha contour; no duplicated decoding, guessed island shapes or foam ring.
const SHORE_SOURCE = `
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
`;
const SHORE = Skia.RuntimeEffect.Make(SHORE_SOURCE);
const COVERED = Platform.OS === 'web' ? Skia.RuntimeEffect.Make(SHORE_SOURCE
  .replace('uniform shader land;', 'uniform shader land;\nuniform shader coverage;')
  .replace('half4 main(float2 p){', 'half4 main(float2 p){\n  if(coverage.eval(p).r==0.0)return half4(0);')) : null;

// A conservative zero-result map, not artwork: all nonzero shoreline pixels
// still use the original shader and original source sampling. Tiny RGBA cells
// bound all 17 taps (including cubic support and mapping/filtering margins).
export function makeShoreCoverage(image: SkImage, worldWidth: number): SkImage | null {
  const pixels = image.readPixels(), width = image.width(), height = image.height();
  if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 4) return null;
  // Eight source pixels per classification cell; the source artwork is untouched.
  const cell = 8, columns = Math.ceil(width / cell), rows = Math.ceil(height / cell), stride = columns + 1;
  const nonempty = new Uint32Array(stride * (rows + 1)), interior = new Uint32Array(nonempty.length);
  for (let y = 0; y < rows; y++) {
    let rowNonempty = 0, rowInterior = 0;
    for (let x = 0; x < columns; x++) {
      const x0 = x * cell, y0 = y * cell, x1 = Math.min(width,x0+cell), y1 = Math.min(height,y0+cell);
      let any = false, full = x1 === x0 + cell && y1 === y0 + cell;
      scan: for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
        const alpha = pixels[(py*width+px)*4+3];
        any ||= alpha > 0;
        // 254/255 safely exceeds SHORE's unchanged own > .99 guard.
        full &&= alpha >= 254;
        if (any && !full) break scan;
      }
      rowNonempty += Number(any); rowInterior += Number(full);
      const at = (y+1)*stride+x+1;
      nonempty[at] = nonempty[y*stride+x+1]+rowNonempty;
      interior[at] = interior[y*stride+x+1]+rowInterior;
    }
  }
  const radius = Math.ceil((17/(worldWidth/width)+2)/cell)+2;
  const bytes = new Uint8Array(columns*rows*4);
  const sum = (table: Uint32Array,x0: number,y0: number,x1: number,y1: number) =>
    table[y1*stride+x1]-table[y0*stride+x1]-table[y1*stride+x0]+table[y0*stride+x0];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const x0 = Math.max(0,x-radius), y0 = Math.max(0,y-radius), x1 = Math.min(columns,x+radius+1), y1 = Math.min(rows,y+radius+1);
    const allCells = (radius*2+1)**2; // Outside-image cells are transparent, never opaque.
    const active = sum(nonempty,x0,y0,x1,y1)>0 && sum(interior,x0,y0,x1,y1)<allCells;
    const at = (y*columns+x)*4;
    bytes[at]=bytes[at+1]=bytes[at+2]=active?255:0; bytes[at+3]=255;
  }
  const data = Skia.Data.fromBytes(bytes);
  try { return Skia.Image.MakeImage({width:columns,height:rows,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Opaque},data,columns*4); }
  finally { data.dispose(); }
}

export default function GardenShoreContact({image,x,y,width,height,coverage}:{image:SkImage;x:number;y:number;width:number;height:number;coverage?:SkImage|null}){
  if(!SHORE)return null;
  const covered = Boolean(coverage && COVERED);
  return <Rect x={x-20} y={y-20} width={width+40} height={height+40}>
    <Shader source={covered ? COVERED! : SHORE}>
      <ImageShader image={image} rect={{x,y,width,height}} fit="contain" tx="decal" ty="decal" />
      {covered && <ImageShader image={coverage!} rect={{x,y,width,height}} fit="fill" tx="clamp" ty="clamp" />}
    </Shader>
  </Rect>;
}
