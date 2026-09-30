import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules(),clean=x=>JSON.parse(JSON.stringify(x));
const {DEFAULT_CLUSTER_VISUAL_SCALES:defaults,cloneClusterVisualScales,clusterVisualScale}=load('../flower-density-sandbox/tulip-components/clusterVisualScale');
const {getRegionInfo,generateDensityLayout,DEFAULT_TUNING}=load('../flower-density-sandbox/flowerDensityModel');
const area=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
assert.deepEqual(clean(defaults),{SMALL:1,MEDIUM:1.08,LARGE:1.22});
assert.deepEqual(clean(area.DEFAULT_AREA_PROFILES),{
  SMALL:{weights:{sparse:45,normal:45,full:10},spread:1},
  MEDIUM:{weights:{sparse:25,normal:50,full:25},spread:1.08},
  LARGE:{weights:{sparse:10,normal:45,full:45},spread:1.15},
});
const june=getRegionInfo(6),october=getRegionInfo(10);
assert.equal(clusterVisualScale(1,true,area.classifyMaskArea(june.estimatedArea)),1);
assert.equal(clusterVisualScale(1,true,area.classifyMaskArea(october.estimatedArea)),1.22);
assert.equal(clusterVisualScale(1,false,'LARGE'),1,'V2 scale unchanged');
const scales=cloneClusterVisualScales();scales.LARGE=1;
assert.equal(scales.SMALL,1);assert.equal(defaults.LARGE,1.22);

// Execute the actual renderer with __DEV__ enabled and inspect its transform tree.
// No browser, screenshots, generated artwork or raster approximation.
const ts=createRequire(import.meta.url)('typescript');
const jsx=(type,props)=>({type,props});
const dependencies={
  react:{memo:fn=>fn},'react/jsx-runtime':{jsx,jsxs:jsx},
  '@shopify/react-native-skia':{Group:'Group',Circle:'Circle',Rect:'Rect',Image:'Image',useImage:()=>({})},
  './componentImages':load('../flower-density-sandbox/tulip-components/componentImages'),
  './tulipComposition':load('../flower-density-sandbox/tulip-components/tulipComposition'),
  '../../flower-visuals/flowerVisualResolver':load('../flower-visuals/flowerVisualResolver'),
};
const filename=new URL('../src/components/garden/flower-density-sandbox/tulip-components/TulipComponentLayer.tsx',import.meta.url);
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,
}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{module,exports:module.exports,__DEV__:true,require:name=>{
  assert.ok(dependencies[name],name);return dependencies[name];
}});
const render=(flowers,visualScale)=>module.exports.TulipComponentLayer({flowers,visualScale,showBounds:true,showFootprints:true,showAnchors:true});
const octoberLayout=generateDensityLayout(10,30,'M',DEFAULT_TUNING);
assert.equal(octoberLayout.flowers.length,30);
const flowers=area.composeReviewObjects(octoberLayout.flowers,october,true),saved=JSON.stringify(flowers);
const a=render(flowers,clusterVisualScale(1,true,'LARGE',scales));
const b=render(flowers,clusterVisualScale(1,true,'LARGE'));
assert.equal(a.props.children.length,30);assert.equal(b.props.children.length,30);
for(let i=0;i<30;i++){
  const left=a.props.children[i],right=b.props.children[i];
  assert.deepEqual(clean(left.props.transform),clean(right.props.transform),'World anchor transform unchanged');
  assert.equal(left.props.children[0].props.transform[0].scale,1);
  assert.equal(right.props.children[0].props.transform[0].scale,1.22);
  const l=clean(left.props.children[0]),r=clean(right.props.children[0]);
  r.props.transform=l.props.transform;
  // Bounds stroke compensation changes with zoom; it is a DEV overlay, not artwork.
  r.props.children[1].props.strokeWidth=l.props.children[1].props.strokeWidth;
  assert.deepEqual(r,l,'All selected components, offsets, scales and spread data unchanged');
  assert.equal(right.props.children[1].props.r,12,'Footprint is outside scaled group');
  assert.deepEqual(clean(left.props.children.slice(1)),clean(right.props.children.slice(1)),'Ground marker/footprint stay unscaled');
}
assert.equal(JSON.stringify(flowers),saved,'Rendering does not mutate records or compositions');
assert.deepEqual(clean(area.composeReviewObjects(octoberLayout.flowers,october,true)),clean(flowers),'Reload remains deterministic');
const juneFlowers=area.composeReviewObjects(generateDensityLayout(6,30,'M',DEFAULT_TUNING).flowers,june,true);
assert.deepEqual(clean(render(juneFlowers,1)),clean(render(juneFlowers,clusterVisualScale(1,true,'SMALL'))),
  'June render tree, component geometry and scaling are identical to previous V3');
console.log('Cluster visual scale: June identical render tree at 1.00; October 30/30 at 1.22; only visual group scale differs; anchors, radius 12, components, weights and spread unchanged.');
