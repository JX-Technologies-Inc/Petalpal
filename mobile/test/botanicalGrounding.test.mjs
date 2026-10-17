import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const require=createRequire(import.meta.url);
const CK=await require('canvaskit-wasm')({wasmBinary:fs.readFileSync(new URL('../public/canvaskit.wasm',import.meta.url))});
const jsx=(type,props)=>({type,props}),effects=[];
const load=loadPlantingModules(undefined,undefined,undefined,true,{
  'react/jsx-runtime':{jsx,jsxs:jsx},
  '@shopify/react-native-skia':{Group:'Group',Image:'Image',ImageShader:'ImageShader',Rect:'Rect',Shader:'Shader',
    ColorType:CK.ColorType,AlphaType:CK.AlphaType,
    Skia:{RuntimeEffect:{Make:source=>{const effect=CK.RuntimeEffect.Make(source);assert.ok(effect,'Grounding SkSL compiles');effects.push(effect);return effect;}}}},
});
const render=load('../flower-visuals/BotanicalFlowerImage').BotanicalFlowerImage;
const surface=CK.MakeSurface(80,100),canvas=surface.getCanvas(),paint=new CK.Paint();
canvas.clear(CK.TRANSPARENT);
paint.setColor(CK.Color(248,239,216));canvas.drawRect(CK.XYWHRect(30,10,20,36),paint);
paint.setColor(CK.Color(72,118,54));canvas.drawRect(CK.XYWHRect(31,46,18,35),paint);
canvas.drawRect(CK.XYWHRect(22,63,36,8),paint);
const source=surface.makeImageSnapshot();
const readSource=source.readPixels.bind(source);let sourceReads=0;
source.readPixels=(x=0,y=0,info={})=>{sourceReads++;return readSource(x,y,{...info,colorSpace:CK.ColorSpace.SRGB});};
const texture=source.makeShaderOptions(CK.TileMode.Decal,CK.TileMode.Decal,CK.FilterMode.Nearest,CK.MipmapMode.None);
function shader(node,child=texture){
  const effect=node.props.source,values=[];
  for(let i=0;i<effect.getUniformCount();i++){
    const value=node.props.uniforms[effect.getUniformName(i)];
    values.push(...(Array.isArray(value)?value:[value]));
  }
  return effect.makeShaderWithChildren(values,[child]);
}
function pixels(image){return image.readPixels(0,0,{width:80,height:100,colorType:CK.ColorType.RGBA_8888,
  alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});}
const pixel=(data,x,y)=>Array.from(data.slice((y*80+x)*4,(y*80+x)*4+4));
const rect={image:source,x:0,y:0,width:80,height:100,rootX:40,rootY:80,rootWidth:14,plantWidth:36,plantHeight:70,seed:.4};
const drawing=render(rect),[shadow,plant]=drawing.props.children;
render({...rect,seed:.9,role:'companion'});
assert.equal(sourceReads,1,'Visible alpha is measured once per decoded image rather than once per flower');
const integration=shader(plant.props.children),contact=shader(shadow.props.children);
canvas.clear(CK.TRANSPARENT);paint.setShader(integration);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const integratedImage=surface.makeImageSnapshot(),integrated=pixels(integratedImage),original=pixels(source);
assert.deepEqual(pixel(integrated,40,20),pixel(original,40,20),'Opaque ivory blossom pixels retain their source colors and alpha');
assert.equal(pixel(integrated,40,60)[3],255,'Upper foliage keeps its silhouette');
assert.equal(pixel(integrated,40,80)[3],0,'The basal edge reveals the actual underlying terrain');
assert.equal(pixel(integrated,5,70)[3],0,'Transparent artwork cannot gain speckles or painted foliage');
assert.notDeepEqual(pixel(integrated,40,65).slice(0,3),pixel(original,40,65).slice(0,3),'Ambient shade is confined to lower foliage');
const alteredRows=[];
for(let y=46;y<=80;y++)if(pixel(integrated,40,y)[3]<pixel(original,40,y)[3])alteredRows.push(y);
assert.ok(alteredRows.length>0&&Math.min(...alteredRows)>=80-70*.15,'Only the lower fifteen percent can dissolve into the ground');

canvas.clear(CK.TRANSPARENT);paint.setShader(contact);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const contactImage=surface.makeImageSnapshot(),contactPixels=pixels(contactImage);
assert.ok(pixel(contactPixels,40,80)[3]>0&&pixel(contactPixels,40,80)[3]<70,'Contact is restrained and follows basal alpha');
assert.equal(pixel(contactPixels,5,80)[3],0,'Contact cannot form an oval beyond the plant silhouette');
assert.equal(pixel(contactPixels,40,40)[3],0,'The contact pass stays next to the soil root');

canvas.clear(CK.Color(92,130,65));paint.setShader(null);paint.setColor(CK.Color(152,62,109));
canvas.drawRect(CK.XYWHRect(30,75,10,12),paint);
paint.setShader(integration);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const layeredImage=surface.makeImageSnapshot();
assert.deepEqual(pixel(pixels(layeredImage),34,80),[152,62,109,255],
  'Root transparency preserves a previously drawn neighbouring flower rather than replaying terrain over it');

// A rebuilt narrow bud can be much shorter than its frozen interaction bounds.
// Deliberately pass the old tall size and an exaggerated depth override.
canvas.clear(CK.TRANSPARENT);paint.setShader(null);paint.setColor(CK.Color(96,142,73));
canvas.drawRect(CK.XYWHRect(31,41,18,39),paint);
const narrowSource=surface.makeImageSnapshot(),readNarrow=narrowSource.readPixels.bind(narrowSource);
let narrowReads=0;
narrowSource.readPixels=(x=0,y=0,info={})=>{narrowReads++;return readNarrow(x,y,{...info,colorSpace:CK.ColorSpace.SRGB});};
const narrowTexture=narrowSource.makeShaderOptions(CK.TileMode.Decal,CK.TileMode.Decal,CK.FilterMode.Nearest,CK.MipmapMode.None);
const narrowDraw=render({...rect,image:narrowSource,plantWidth:50,plantHeight:135,seed:.99,baseDepth:33});
const narrowShaderNode=narrowDraw.props.children[1].props.children;
assert.deepEqual(Array.from(narrowShaderNode.props.uniforms.plantSize),[18,39],
  'Actual rebuilt alpha dimensions override the tall historical metadata');
assert.equal(narrowShaderNode.props.uniforms.baseLimit,80-39*.15);
const contained=render({...rect,image:narrowSource,x:5,y:7,width:160,height:100,fit:'contain',plantHeight:135});
const containedUniforms=contained.props.children[1].props.children.props.uniforms;
assert.deepEqual(Array.from(containedUniforms.plantSize),[18,39]);
assert.equal(containedUniforms.baseLimit,7+80-39*.15,'Contain letterboxing preserves the visible bottom');
assert.equal(narrowReads,1,'A second rectangle and pose reuse the decoded alpha bounds');
const narrowShader=shader(narrowShaderNode,narrowTexture);
canvas.clear(CK.TRANSPARENT);paint.setShader(narrowShader);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const narrowImage=surface.makeImageSnapshot(),narrowPixels=pixels(narrowImage),narrowOriginal=pixels(narrowSource);
let altered=0;
for(let y=41;y<80;y++)for(let x=31;x<49;x++){
  if(pixel(narrowPixels,x,y)[3]>=pixel(narrowOriginal,x,y)[3])continue;
  altered++;
  assert.ok(y+.5>=80-39*.15,'Even feathered edges cannot erase above the lowest 15% of a narrow visible bud');
}
assert.ok(altered>0,'Narrow buds still receive restrained basal integration');
assert.deepEqual(pixel(narrowPixels,40,45),pixel(narrowOriginal,40,45),'Upper narrow-bud color and silhouette remain intact');

let failedReads=0;
const unavailable={width:()=>80,height:()=>100,readPixels:()=>{failedReads++;return null;}};
const unavailableDrawing=render({...rect,image:unavailable});render({...rect,image:unavailable});
assert.equal(failedReads,1,'Unavailable GPU pixel reads are not retried for every flower');
const safeShader=shader(unavailableDrawing.props.children[1].props.children);
canvas.clear(CK.TRANSPARENT);paint.setShader(safeShader);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const safeImage=surface.makeImageSnapshot(),safePixels=pixels(safeImage);
for(let i=3;i<original.length;i+=4)assert.equal(safePixels[i],original[i],
  'Unavailable decoded bounds preserve source alpha instead of applying a guessed base mask');

canvas.clear(CK.TRANSPARENT);paint.setShader(null);paint.setColor(CK.Color(72,118,54));
canvas.drawRect(CK.XYWHRect(31,41,18,39),paint);
paint.setColor(CK.Color(248,248,238,.28));canvas.drawRect(CK.XYWHRect(30,50,1,18),paint);
paint.setColor(CK.Color(250,250,246));canvas.drawRect(CK.XYWHRect(35,43,8,4),paint);
const fringeSource=surface.makeImageSnapshot(),readFringe=fringeSource.readPixels.bind(fringeSource);
fringeSource.readPixels=(x=0,y=0,info={})=>readFringe(x,y,{...info,colorSpace:CK.ColorSpace.SRGB});
const fringeOriginal=pixels(fringeSource);
const fringeTexture=fringeSource.makeShaderOptions(CK.TileMode.Decal,CK.TileMode.Decal,CK.FilterMode.Nearest,CK.MipmapMode.None);
const fringeDraw=render({...rect,image:fringeSource}),fringeShader=shader(fringeDraw.props.children[1].props.children,fringeTexture);
canvas.clear(CK.TRANSPARENT);paint.setShader(fringeShader);canvas.drawRect(CK.XYWHRect(0,0,80,100),paint);
const fringeImage=surface.makeImageSnapshot(),fringePixels=pixels(fringeImage);
const bright=pixel(fringeOriginal,30,55),cleaned=pixel(fringePixels,30,55);
const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
assert.ok(luminance(cleaned)<luminance(bright)-30,'Bright partial-alpha fringe moves toward its opaque neighbour');
assert.equal(cleaned[3],bright[3],'Fringe cleanup preserves silhouette alpha');
assert.deepEqual(pixel(fringePixels,37,44),pixel(fringeOriginal,37,44),'True opaque white petals remain untouched');

for(const object of [fringeImage,fringeShader,fringeTexture,fringeSource,safeImage,safeShader,narrowImage,narrowShader,narrowTexture,narrowSource,layeredImage,contactImage,integratedImage,
  integration,contact,texture,source,paint,surface,...effects])object.delete();
console.log('Botanical grounding: real SkSL, cached visible bounds, narrow bud 15% limit, unchanged ivory petals, local contact and preserved neighbours passed.');
