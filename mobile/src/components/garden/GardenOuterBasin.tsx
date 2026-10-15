import { Image, ImageShader, Rect, Shader, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { installGardenWebPaintLifecycle } from './rendering/installGardenWebPaintLifecycle';
import GardenRightPondShore from './GardenRightPondShore';
import GardenUpperRightScenery, { ScenicExclusion } from './GardenUpperRightScenery';

type Bounds = { x: number; y: number; width: number; height: number };
// The alpha opening meets the existing compact waterfall's painted inlet at
// world (948, -309). Its original lip, drop and pool remain untouched.
const INLET_BOUNDS = { x: 645, y: -1160, width: 600, height: 900 };
const TERRAIN_MASKS = `
uniform shader inletBanks;
float sourceBank(float2 p) {
  return mix(1.0, inletBanks.eval(p).a, 1.0 - smoothstep(-325.0, -280.0, p.y));
}
float entranceAdvance(float2 p) {
  // Advance only the entrance-facing walls; preserve the outer lotus bays.
  float local = smoothstep(850.0, 1250.0, p.x) * (1.0 - smoothstep(1900.0, 2150.0, p.x));
  return mix(300.0, 235.0, smoothstep(1550.0, 1800.0, p.x)) * local;
}
float entrancePlacement(float2 p) {
  float edge = 1820.0 + 12.0 * sin(p.x / 93.0) + 8.0 * sin(p.x / 37.0);
  // Keep the join short and irregular so overlapping foliage stays crisp.
  float leftEdge = 1080.0 + 20.0 * sin(p.y / 90.0) + 15.0 * sin(p.y / 37.0);
  float rightEdge = 2000.0 + 15.0 * sin(p.y / 81.0);
  float local = smoothstep(leftEdge, leftEdge + 40.0, p.x)
    * (1.0 - smoothstep(rightEdge, rightEdge + 40.0, p.x));
  return local * smoothstep(edge - 10.0, edge + 10.0, p.y);
}
float exteriorLand(float2 p) {
  float shore = 2130.0 - entranceAdvance(p) + 28.0 * sin(p.x / 163.0) + 16.0 * sin(p.x / 57.0);
  return smoothstep(shore - 12.0, shore + 12.0, p.y);
}
`;
// These two small image shaders blend terrain joins without allocating full
// offscreen Mask layers on the animated water canvas each frame.
const JOIN = Skia.RuntimeEffect.Make(`
uniform shader painting;
uniform float4 bounds;
uniform float2 feather;
uniform float lowerPlacement;
${TERRAIN_MASKS}
half4 main(float2 p) {
  float a = 1.0;
  if (feather.x > 0.0) a *= smoothstep(bounds.y, bounds.y + feather.x, p.y);
  if (feather.y > 0.0) a *= 1.0 - smoothstep(bounds.x + bounds.z - feather.y, bounds.x + bounds.z, p.x);
  // Blend the placement boundary, not the sampling coordinates: the cliff
  // faces retain their proportions instead of compressing into a flat ridge.
  float placement = lowerPlacement * entrancePlacement(p);
  half4 moved = mix(painting.eval(p + float2(-125.0, 300.0)),
                    painting.eval(p + float2(95.0, 235.0)), smoothstep(1550.0, 1800.0, p.x));
  half4 terrain = mix(painting.eval(p), moved, placement);
  return terrain * a * sourceBank(p);
}
`);
const OUTER_GROUND = Skia.RuntimeEffect.Make(`
uniform shader upland;
${TERRAIN_MASKS}
half4 main(float2 p) {
  // Terrain continues beyond the fixed basin artwork in tall/wide viewports.
  // One shared painted alpha defines the inlet across every terrain layer.
  // Fill the former offset blue opening; expose only the aligned source.
  float top = (1.0 - smoothstep(-350.0, -270.0, p.y)) * sourceBank(p);
  // The exterior approach is dry, including underneath the unchanged road.
  float bottom = exteriorLand(p);
  float sides = max(1.0 - smoothstep(-610.0, -490.0, p.x), smoothstep(2810.0, 2910.0, p.x));
  float cover = max(max(top, bottom), sides);
  return upland.eval(p) * cover;
}
`);
const SOURCE_BANKS = Skia.RuntimeEffect.Make(`
uniform shader painting;
half4 main(float2 p) {
  float sides = smoothstep(645.0, 700.0, p.x) * (1.0 - smoothstep(1190.0, 1245.0, p.x));
  float end = 1.0 - smoothstep(-340.0, -260.0, p.y);
  return painting.eval(p) * sides * end;
}
`);
const DRY_PASS = Skia.RuntimeEffect.Make(`
uniform shader painting;
${TERRAIN_MASKS}
half4 passage(float2 p, float2 offset, float scale) {
  // Align only the new ground artwork to the original road's existing course.
  // Keep the painted shore silhouette and the rocks' original aspect ratio.
  // Bring the established cliff passage up beside the gate, asymmetrically.
  float2 q = p + offset;
  float localY = q.y - 1870.0;
  float sy = localY / scale;
  float floorX = mix(820.0, 880.0, clamp((sy - 400.0) / 200.0, 0.0, 1.0));
  floorX = mix(floorX, 975.0, clamp((sy - 600.0) / 200.0, 0.0, 1.0));
  floorX = mix(floorX, 1045.0, clamp((sy - 800.0) / 224.0, 0.0, 1.0));
  float roadX = mix(1630.0, 1700.0, smoothstep(3000.0, 4000.0, p.y));
  // Keep the original road and a dry shoulder clear while moving rock faces
  // inward farther out. This samples the same approved artwork, unmodified.
  float sx = floorX + (q.x - roadX) / scale;
  float sides = smoothstep(-80.0, 80.0, sx) * (1.0 - smoothstep(1456.0, 1616.0, sx));
  return painting.eval(float2(sx, sy)) * sides * smoothstep(0.0, 18.0, localY)
    * (1.0 - smoothstep(960.0, 1023.0, sy));
}
half4 main(float2 p) {
  half4 original = passage(p, float2(0.0), 1.30);
  half4 moved = mix(passage(p, float2(-125.0, 300.0), 1.60),
                    passage(p, float2(95.0, 235.0), 1.60), smoothstep(1550.0, 1800.0, p.x));
  return mix(original, moved, entrancePlacement(p));
}
`);
// Restyle the terrain without moving its established shoreline or changing
// the alpha used by the baked dry-ground navigation mask. Replacement PNGs
// provide color only; uncovered edge pixels retain the original rock color.
const PERIMETER_PAINT = Skia.RuntimeEffect.Make(`
uniform shader originalTerrain;
uniform shader newPainting;
half4 main(float2 p) {
  half4 original = originalTerrain.eval(p);
  half4 painted = newPainting.eval(p);
  half3 base = original.rgb / max(original.a, 0.001);
  half3 fresh = painted.rgb / max(painted.a, 0.001);
  half3 color = mix(base, fresh, smoothstep(0.02, 0.95, painted.a));
  return half4(color * original.a, original.a);
}
`);
function PerimeterPaint({ image, painting, bounds, tile = 'decal' }: {
  image: SkImage; painting?: SkImage | null; bounds: Bounds; tile?: 'decal' | 'clamp';
}) {
  const original = <ImageShader image={image} rect={bounds} fit="fill" tx={tile} ty={tile} />;
  if (!painting || !PERIMETER_PAINT) return original;
  return <Shader source={PERIMETER_PAINT}>
    {original}
    <ImageShader image={painting} rect={bounds} fit="fill" tx={tile} ty={tile} />
  </Shader>;
}
function InletMask({ image }: { image: SkImage }) {
  return <ImageShader image={image} rect={INLET_BOUNDS} fit="fill" tx="clamp" ty="mirror" />;
}
function TerrainJoin({image, painting, inlet, bounds, scenicEnabled = false, top = 0, right = 0, lowerPlacement = 0}: {image: SkImage; painting?: SkImage | null; inlet: SkImage; bounds: Bounds; scenicEnabled?: boolean; top?: number; right?: number; lowerPlacement?: number}) {
  if (!JOIN) return <Image image={image} {...bounds} fit="fill" />;
  return <Rect {...bounds}><Shader source={JOIN} uniforms={{bounds:[bounds.x,bounds.y,bounds.width,bounds.height],feather:[top,right],lowerPlacement}}>
    <ScenicExclusion enabled={scenicEnabled}><PerimeterPaint image={image} painting={painting} bounds={bounds} /></ScenicExclusion>
    <InletMask image={inlet} />
  </Shader></Rect>;
}

// Terrain-only artwork in world space. Alpha exposes the approved water; no
// water material, island placement, landmark transform or camera is changed.
function GardenOuterBasin() {
  useEffect(() => {
    if (Platform.OS === 'web') installGardenWebPaintLifecycle(Skia);
  }, []);
  const scenic = useImage(require('./terrain/upper-right-scenic-v2.png'));
  const basin = useImage(require('./terrain/outer-basin-v2.png'));
  const floralBasin = useImage(require('./terrain/outer-basin-floral-v3.png'));
  const floralRightBank = useImage(require('./terrain/outer-right-bank-floral-v2.png'));
  const floralPass = useImage(require('./terrain/entrance-floral-banks-v2.png'));
  const treeCliffs = useImage(require('./terrain/treehouse-cliff-backing-v1.png'));
  const rightBank = useImage(require('./terrain/outer-right-bank-v1.png'));
  const upland = useImage(require('./terrain/outer-upland-v1.png'));
  const inlet = useImage(require('./terrain/waterfall-source-banks-v1.png'));
  const pass = useImage(require('./terrain/entrance-mountain-pass-v1.png'));
  if (!inlet) return null;
  return <>
    {upland && OUTER_GROUND && <Rect x={-2400} y={-2400} width={7200} height={7000}>
      <Shader source={OUTER_GROUND}>
        <ScenicExclusion enabled={!!scenic}><ImageShader image={upland} rect={{x:-1700,y:-2250,width:3000,height:2000}} fit="fill" tx="mirror" ty="mirror" /></ScenicExclusion>
        <InletMask image={inlet} />
      </Shader>
    </Rect>}
    {pass && DRY_PASS && <Rect x={-2400} y={1790} width={7200} height={3280}>
      <Shader source={DRY_PASS}>
        <PerimeterPaint image={pass} painting={floralPass} bounds={{x:0,y:0,width:1536,height:1024}} tile="clamp" />
        <InletMask image={inlet} />
      </Shader>
    </Rect>}
    <GardenRightPondShore />
    {basin && <TerrainJoin scenicEnabled={!!scenic} image={basin} painting={floralBasin} inlet={inlet} bounds={{x:-700,y:-800,width:3800,height:3400}} lowerPlacement={1} />}
    {/* Continuous planted cliff directly behind the original tree silhouette. */}
    {treeCliffs && <TerrainJoin image={treeCliffs} inlet={inlet} bounds={{x:-350,y:-200,width:1300,height:1100}} top={75} />}
    {/* The right shoulder joins the waterfall to the upper enclosure while
        ending above the impact pool; it never crosses the open outflow. */}
    {rightBank && <TerrainJoin scenicEnabled={!!scenic} image={rightBank} painting={floralRightBank} inlet={inlet} bounds={{x:1010,y:-1480,width:550,height:1660}} right={150} />}
    {SOURCE_BANKS && <Rect x={645} y={-2400} width={600} height={2140}>
      <Shader source={SOURCE_BANKS}><InletMask image={inlet} /></Shader>
    </Rect>}
    {/* Keep the perimeter beyond the existing lotus and crescent landmarks. */}
    {rightBank && <Rect x={2140} y={-260} width={680} height={2300}>
      <PerimeterPaint image={rightBank} painting={floralRightBank} bounds={{x:2140,y:-260,width:680,height:2300}} />
    </Rect>}
    {scenic && <GardenUpperRightScenery image={scenic} />}
  </>;
}
export default memo(GardenOuterBasin);
