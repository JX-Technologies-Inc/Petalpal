const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const mobile=path.join(__dirname,'..'), directory=path.join(mobile,'src/components/garden');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(directory,file),'utf8'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;

test('shore coverage skips only zero-result pixels with original sampling, rotations and zoom',async()=>{
  const kit=await require('canvaskit-wasm')({wasmBinary:fs.readFileSync(path.join(mobile,'public/canvaskit.wasm'))});
  const assets=[],effects=[];
  const decode=file=>{
    const image=kit.MakeImageFromEncoded(fs.readFileSync(file)),read=image.readPixels.bind(image);
    image.readPixels=()=>read(0,0,{width:image.width(),height:image.height(),colorType:kit.ColorType.RGBA_8888,
      alphaType:kit.AlphaType.Premul,colorSpace:kit.ColorSpace.SRGB});assets.push(image);return image;
  };
  const layout={exports:{}},module={exports:{}};
  vm.runInNewContext(compile('gardenMapLayout.ts'),{module:layout,exports:layout.exports,
    require:file=>decode(path.join(mobile,file.replace('@/','')))});
  const jsx=(type,props)=>({type,props});
  vm.runInNewContext(compile('water/GardenShoreContact.tsx'),{Uint8Array,Uint32Array,module,exports:module.exports,require:name=>{
    if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
    if(name==='react-native')return{Platform:{OS:'web'}};
    return{AlphaType:kit.AlphaType,ColorType:kit.ColorType,Rect:'Rect',Shader:'Shader',ImageShader:'ImageShader',Skia:{
      Data:{fromBytes:bytes=>({bytes,dispose(){}})},Image:{MakeImage:(info,data,stride)=>{
        const image=kit.MakeImage({...info,colorSpace:kit.ColorSpace.SRGB},data.bytes,stride);assert.ok(image);assets.push(image);return image;
      }},RuntimeEffect:{Make:source=>{const e=kit.RuntimeEffect.Make(source);assert.ok(e);effects.push(e);return e;}},
    }};
  }});
  const paint=new kit.Paint();paint.setAntiAlias(true);const size=128;
  try{
    for(const land of layout.exports.GARDEN_LANDS){
      const image=land.source,w=land.width,h=w*image.height()/image.width();
      const coverage=module.exports.makeShoreCoverage(image,w);assert.ok(coverage);
      assert.ok(coverage.width()*coverage.height() < image.width()*image.height()/50,'Coverage is a small cache, not resampled artwork');
      const matrix=(width,height)=>[w/width,0,land.x,0,h/height,land.y,0,0,1];
      const art=image.makeShaderCubic(kit.TileMode.Decal,kit.TileMode.Decal,1,0,matrix(image.width(),image.height()));
      const mask=coverage.makeShaderCubic(kit.TileMode.Clamp,kit.TileMode.Clamp,1,0,matrix(coverage.width(),coverage.height()));
      const shaders=[effects[0].makeShaderWithChildren([],[art]),effects[1].makeShaderWithChildren([],[art,mask])];
      try{
        const pixels = image.readPixels();
        const coast = [];
        for(let y=1;y<image.height()-1 && coast.length<3;y+=29){
          for(let x=1;x<image.width()-1;x+=7){
            const at=(y*image.width()+x)*4+3;
            if(pixels[at]>0 && pixels[at]<254){coast.push([land.x+x*w/image.width(),land.y+y*h/image.height()]);break;}
          }
        }
        const views=[{zoom:size/(Math.max(w,h)+40),center:[land.x+w/2,land.y+h/2]},
          {zoom:.73,center:[land.x+w/2,land.y+h/2]},...coast.map(center=>({zoom:2,center}))];
        for(const {zoom,center} of views){
          const surfaces=[kit.MakeSurface(size,size),kit.MakeSurface(size,size)];
          try{
            surfaces.forEach((surface,i)=>{
              const canvas=surface.getCanvas();canvas.clear(kit.Color(.471,.722,.698,1));
              canvas.translate(size/2,size/2);canvas.scale(zoom,zoom);canvas.translate(-center[0],-center[1]);
              canvas.rotate(land.rotation,land.x+w/2,land.y+h/2);
              paint.setShader(shaders[i]);canvas.drawRect(kit.XYWHRect(land.x-20,land.y-20,w+40,h+40),paint);paint.setShader(null);surface.flush();
            });
            const pixels=surfaces.map(surface=>{const snap=surface.makeImageSnapshot();try{return snap.readPixels(0,0,{width:size,height:size,
              colorType:kit.ColorType.RGBA_8888,alphaType:kit.AlphaType.Premul,colorSpace:kit.ColorSpace.SRGB});}finally{snap.delete();}});
            assert.ok(pixels[0]&&pixels[1]);assert.equal(pixels[0].reduce((n,v,i)=>n+(v!==pixels[1][i]),0),0,`${land.id}, zoom ${zoom}`);
          }finally{surfaces.forEach(surface=>surface.delete());}
        }
      }finally{shaders.forEach(shader=>shader.delete());art.delete();mask.delete();}
    }
  }finally{paint.delete();assets.forEach(image=>image.delete());effects.forEach(effect=>effect.delete());}
});
