import { AlphaType, ColorType, Group, Image, ImageShader, Rect, Shader, Skia, type SkImage } from '@shopify/react-native-skia';

export type BotanicalRole = 'primary' | 'companion' | 'filler';

const ROOT_OPACITY: Record<BotanicalRole, number> = { primary: .19, companion: .14, filler: .075 };

type VisibleBounds = { left: number; top: number; right: number; bottom: number };
const visibleBounds = new WeakMap<SkImage, VisibleBounds | null>();

// Rebuilt art can occupy less of its padded canvas than the frozen interaction
// bounds. Read each decoded image once; retain only its visible bounds, not pixels.
function imageVisibleBounds(image: SkImage): VisibleBounds | null {
  if (typeof image.readPixels !== 'function') return null;
  if (visibleBounds.has(image)) return visibleBounds.get(image) ?? null;
  let bounds: VisibleBounds | null = null;
  try {
    const width = image.width(), height = image.height();
    const pixels = image.readPixels(0, 0, { width, height,
      colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (pixels instanceof Uint8Array) {
      let left = width, top = height, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] <= 4) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      if (right > left && bottom > top) bounds = { left, top, right, bottom };
    }
  } catch {
    // Some GPU-backed images cannot be read. Keep their approved silhouette.
  }
  visibleBounds.set(image, bounds);
  return bounds;
}

// Composition can size existing sprites with these same cached dimensions.
export { imageVisibleBounds as botanicalImageBounds };

// All coordinates are local world units, not padded image pixels. Source PNGs,
// placement masks and interaction alpha are deliberately left unchanged.
const ROOT_CONTACT = Skia.RuntimeEffect.Make(`
uniform shader plant;
uniform float2 root;
uniform float2 plantSize;
uniform float opacity;
half4 main(float2 p) {
  float depth=max(0.65,plantSize.y*0.065);
  float2 q=float2(p.x,root.y+(p.y-root.y-0.18)*4.5-plantSize.y*0.065);
  float dx=clamp(plantSize.x*0.045,0.35,1.35);
  float dy=max(0.5,plantSize.y*0.04);
  float a=plant.eval(q).a*0.24;
  a+=(plant.eval(q+float2(dx,0)).a+plant.eval(q-float2(dx,0)).a)*0.16;
  a+=(plant.eval(q+float2(0,dy)).a+plant.eval(q-float2(0,dy)).a)*0.12;
  a+=(plant.eval(q+float2(dx*1.8,dy)).a+plant.eval(q+float2(-dx*1.8,dy)).a+
      plant.eval(q+float2(dx*1.8,-dy)).a+plant.eval(q-float2(dx*1.8,dy)).a)*0.05;
  // Only basal leaves/stems cast this short, softly projected contact.
  float falloff=1.0-smoothstep(depth*0.28,depth*1.65,abs(p.y-root.y));
  a*=opacity*falloff;
  return half4(half3(0.15,0.20,0.105)*a,a);
}
`);

const ROOT_INTEGRATION = Skia.RuntimeEffect.Make(`
uniform shader plant;
uniform float2 root;
uniform float2 plantSize;
uniform float seed;
uniform float baseDepth;
uniform float baseLimit;
half4 main(float2 p) {
  half4 src=plant.eval(p);
  if(src.a<=0.001)return half4(0);
  half3 rgb=src.rgb/max(src.a,half(0.001));
  // Repair only bright, partially transparent fringes using a more opaque
  // immediate neighbour. Opaque ivory petals are never desaturated or trimmed.
  float d=clamp(plantSize.y*0.014,0.2,0.65);
  half4 inside=src;
  half4 s=plant.eval(p+float2(d,0));if(s.a>inside.a)inside=s;
  s=plant.eval(p-float2(d,0));if(s.a>inside.a)inside=s;
  s=plant.eval(p+float2(0,d));if(s.a>inside.a)inside=s;
  s=plant.eval(p-float2(0,d));if(s.a>inside.a)inside=s;
  half3 inner=inside.rgb/max(inside.a,half(0.001));
  float fringe=(1.0-smoothstep(0.55,0.95,src.a))*smoothstep(0.04,0.20,inside.a-src.a);
  float excess=max(0.0,dot(rgb-inner,half3(0.2126,0.7152,0.0722)));
  rgb=mix(rgb,inner,fringe*smoothstep(0.04,0.20,excess)*0.65);

  // A restrained grass reflection and ambient shade act on the basal foliage,
  // leaving the species' blossom palette and upper silhouette intact.
  float lower=smoothstep(root.y-plantSize.y*0.32,root.y,p.y);
  rgb*=1.0-lower*0.075;
  rgb=mix(rgb,half3(0.36,0.405,0.22),lower*0.045);

  // A connected, irregular grass/moss edge exposes the EXISTING terrain.
  // No new sprite or painted grass patch is added to the garden.
  float spacing=max(0.9,plantSize.x*0.07);
  float u=(p.x-root.x)/spacing+seed*9.0;
  float cell=floor(u);
  float blade=pow(max(0.0,1.0-abs(fract(u)-0.5)*2.0),2.5);
  float variation=0.5+0.5*sin(cell*2.37+seed*13.0);
  float moss=0.5+0.5*sin(u*1.15+sin(u*0.63+seed*11.0));
  float reach=baseDepth*(0.18+0.48*blade*(0.3+0.7*variation)+0.22*moss);
  float feather=max(0.18,baseDepth*0.22);
  // Include the feather and any pixels below the root in the fifteen-percent
  // limit. Short buds must not dissolve according to taller legacy bounds.
  float edge=max(root.y-reach,baseLimit+feather);
  float keep=1.0-smoothstep(edge-feather,edge+feather,p.y);
  float a=src.a*keep;
  return half4(rgb*a,a);
}
`);

/** Root-only compositing. Existing terrain shows through the basal silhouette;
 * shadows follow source alpha. Neither pass adds a planting or hit-test area. */
export function BotanicalFlowerImage({ image, x, y, width, height, rootX, rootY, rootWidth,
  role = 'primary', fit = 'fill', seed = .5, plantHeight = height * .45,
  plantWidth = rootWidth / .36, baseDepth }: {
  image: SkImage; x: number; y: number; width: number; height: number;
  rootX: number; rootY: number; rootWidth: number; role?: BotanicalRole; fit?: 'fill' | 'contain';
  seed?: number; plantHeight?: number; plantWidth?: number; baseDepth?: number;
}) {
  if (!ROOT_CONTACT || !ROOT_INTEGRATION) return <Image image={image} x={x} y={y} width={width} height={height} fit={fit} />;
  const bounds = imageVisibleBounds(image);
  let bottom = rootY;
  if (bounds) {
    const sx = width / image.width(), sy = height / image.height();
    const scaleX = fit === 'contain' ? Math.min(sx, sy) : sx;
    const scaleY = fit === 'contain' ? Math.min(sx, sy) : sy;
    plantWidth = (bounds.right - bounds.left) * scaleX;
    plantHeight = (bounds.bottom - bounds.top) * scaleY;
    bottom = y + (height - image.height() * scaleY) / 2 + bounds.bottom * scaleY;
  }
  const root = [rootX, rootY], plantSize = [Math.max(.5, plantWidth), Math.max(.5, plantHeight)];
  const depth = baseDepth ?? plantHeight * (.075 + seed * .045);
  // Without decoded bounds, preserve alpha instead of guessing an erosion band.
  const baseLimit = bounds ? bottom - plantHeight * .15 : y + height;
  const shadowDepth = Math.max(.65, plantHeight * .065) * 1.65;
  const source = <ImageShader image={image} rect={{ x, y, width, height }} fit={fit} tx="decal" ty="decal" />;
  return <Group>
    <Rect x={rootX - plantWidth * .65} y={rootY - shadowDepth}
      width={plantWidth * 1.3} height={shadowDepth * 2}>
      <Shader source={ROOT_CONTACT} uniforms={{ root, plantSize, opacity: ROOT_OPACITY[role] }}>{source}</Shader>
    </Rect>
    <Rect x={x} y={y} width={width} height={height}>
      <Shader source={ROOT_INTEGRATION} uniforms={{ root, plantSize, seed, baseDepth: depth, baseLimit }}>{source}</Shader>
    </Rect>
  </Group>;
}
