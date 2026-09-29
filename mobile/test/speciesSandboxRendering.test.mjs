import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const ts=createRequire(import.meta.url)('typescript'),load=loadPlantingModules();
const jsx=(type,props)=>({type,props}),clean=x=>JSON.parse(JSON.stringify(x));
function compile(file,deps,dev=true) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(new URL(`../src/components/garden/flower-density-sandbox/${file}`,import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,__DEV__:dev,require:name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    assert.ok(deps[name],`Unexpected renderer dependency ${name}`);return deps[name];
  }});return module.exports;
}
const catalog=load('../flower-density-sandbox/chamomile-components/chamomileCatalog').CHAMOMILE_CATALOG;
const hydrangeaCatalog=load('../flower-density-sandbox/hydrangea-components/hydrangeaCatalog').HYDRANGEA_CATALOG;
const review=load('../flower-density-sandbox/speciesReviewModel');
const skia={Group:'Group',Image:'Image',Circle:'Circle',Rect:'Rect',Canvas:'Canvas',useImage:x=>x};
const rendererDeps={react:{memo:fn=>fn},'@shopify/react-native-skia':skia,
  './componentImages':load('../flower-density-sandbox/tulip-components/componentImages'),
  './tulipComposition':load('../flower-density-sandbox/tulip-components/tulipComposition'),
  '../../flower-visuals/flowerVisualResolver':load('../flower-visuals/flowerVisualResolver')};
const renderer=compile('tulip-components/TulipComponentLayer.tsx',rendererDeps).TulipComponentLayer;
const neighborhoodModule=load('../flower-density-sandbox/mixedNeighborhoods');
const debugDeps={'@shopify/react-native-skia':{...skia,Line:'Line'}};
const NeighborhoodLayer=compile('MixedNeighborhoodLayer.tsx',debugDeps).MixedNeighborhoodLayer;
const source=review.composeSpeciesReview(review.generateSpeciesReviewLayout(6,30,'MIXED_SML').flowers,6);
const flowers=source.map(f=>({...f,...(f.speciesCode==='CHAMOMILE'?{catalog}:f.speciesCode==='HYDRANGEA'?{catalog:hydrangeaCatalog}:{})}));
const neighborhoods=neighborhoodModule.buildNeighborhoods(flowers),debug=NeighborhoodLayer({flowers,neighborhoods});
assert.equal(debug.props.children.length,6);
assert.equal(debug.props.children.reduce((sum,n)=>sum+n.props.children.length,0),30);
for(const n of debug.props.children)for(const member of n.props.children){
  assert.equal(member.props.children[0].type,'Line');assert.equal(member.props.children[1].type,'Circle');
}
assert.equal(compile('MixedNeighborhoodLayer.tsx',debugDeps,false).MixedNeighborhoodLayer({flowers,neighborhoods}),null);
const tree=renderer({flowers,showBounds:true,showFootprints:true,showAnchors:true});
const sorted=[...flowers].sort((a,b)=>a.worldY-b.worldY || a.id.localeCompare(b.id));
assert.equal(tree.props.children.length,30);
for(let i=0;i<30;i++) {
  const node=tree.props.children[i],f=sorted[i];
  assert.deepEqual(clean(node.props.transform),[{translateX:f.worldX},{translateY:f.worldY}]);
  const visual=node.props.children[0], footprint=node.props.children[1];
  assert.equal(visual.props.transform[0].scale,1);
  assert.equal(footprint.props.r,{CHAMOMILE:9,TULIP:12,HYDRANGEA:16}[f.speciesCode],'Footprint outside art scale');
  for(const sprite of visual.props.children[0]) {
    const rendered=sprite.type(sprite.props),image=rendered.props.children;
    assert.equal(image.type,'Image'); assert.equal(image.props.fit,'fill');
    if(f.speciesCode==='CHAMOMILE') assert.ok(image.props.image.includes('/chamomile/components/'));
    else if(f.speciesCode==='HYDRANGEA') assert.ok(image.props.image.includes('/hydrangea/components/'));
    else assert.ok(image.props.image.includes('/tulip/components/'));
    assert.equal(image.props.children,undefined,'No image emotion filters/effects');
  }
}
assert.equal(compile('tulip-components/TulipComponentLayer.tsx',rendererDeps,false).TulipComponentLayer({flowers}),null);

// Execute actual sandbox with lightweight hooks, then invoke its real preset controls.
let cursor=0;const state=[];
const react={useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;
  return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
  useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:()=>{}};
let growthTapHandler;
const tapGesture=new Proxy({}, {get:(_,key)=>key==='onEnd'?fn=>{growthTapHandler=fn;return tapGesture;}:()=>tapGesture});
const gesture=new Proxy({}, {get:(_,key)=>key==='Tap'?()=>tapGesture:()=>gesture});
const cluster={FlowerClusterLayer:'Legacy',CLUSTER_VISUALS:{S:{}},LEGACY_CLUSTER_VISUALS:{S:{}}};
const deps={react,'@shopify/react-native-skia':skia,
  'react-native':{Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',TextInput:'TextInput',View:'View',StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:1200})},
  'react-native-gesture-handler':{Gesture:gesture,GestureDetector:'GestureDetector'},
  'react-native-reanimated':{useSharedValue:value=>({value}),useDerivedValue:fn=>fn()},
  '../gardenMapLayout':{GARDEN_WORLD_WIDTH:3000,GARDEN_WORLD_HEIGHT:2000},
  './FlowerClusterLayer':cluster,'./SandboxGardenBackdrop':{__esModule:true,default:'Backdrop'},
  '../flower-visuals/FlowerEmotionPreview':{FlowerEmotionPreview:'EmotionControls',previewVisual:()=>({footprintRadius:12,compositionVariant:'normal'})},
  '../flower-visuals/GardenFlowerVisualLayer':{GardenFlowerVisualLayer:'FixedGarden'},
  './tulip-components/TulipComponentLayer':{TulipComponentLayer:renderer,FixedTulipBounds:'FixedBounds'},
  './chamomile-components/chamomileCatalog':{CHAMOMILE_CATALOG:catalog},
  './hydrangea-components/hydrangeaCatalog':{HYDRANGEA_CATALOG:hydrangeaCatalog},
  './MixedNeighborhoodLayer':{MixedNeighborhoodLayer:'Neighborhoods'},
  './monthly-growth/MonthlyGrowthLayer':{MonthlyGrowthLayer:'MonthlyGrowth'},
};
for(const name of ['./monthly-growth/layeredBedModel','./monthly-growth/monthlyGrowthModel','./mixedV2ReviewModel','./allSpeciesReviewModel','./batch-components/batchCatalog','./speciesReviewModel','./flowerDensityModel','./tulipReviewPreset','./tulip-components/tulipAreaProfiles','./tulip-components/clusterVisualScale'])
  deps[name]=load(`../flower-density-sandbox/${name.slice(2)}`);
const Sandbox=compile('FlowerDensitySandbox.tsx',deps).default;
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const renderSandbox=()=>{cursor=0;return Sandbox({onClose:()=>{}});};
let ui=renderSandbox();
for(const preset of [...review.SPECIES_REVIEW_PRESETS,...review.HYDRANGEA_REVIEW_PRESETS]) {
  const button=nodes(ui).find(n=>n.props?.label===preset.label);assert.ok(button,preset.label);
  button.props.onPress();ui=renderSandbox();
  const backdrop=nodes(ui).find(n=>n.type==='Backdrop');assert.equal(backdrop.props.month,preset.month);
  const content=nodes(backdrop).find(n=>n.type===renderer);assert.ok(content,'Species renderer remains inside the occlusion backdrop');
  assert.equal(content.props.flowers.length,preset.species==='HYDRANGEA'?(preset.month===6?11:20):30);
  const expected=preset.species==='MIXED'?15:preset.species==='MIXED_SML'?12:preset.species==='HYDRANGEA'?0:30;
  assert.equal(content.props.flowers.filter(f=>f.speciesCode==='CHAMOMILE').length,expected);
  assert.equal(content.props.flowers.filter(f=>f.speciesCode==='HYDRANGEA').length,preset.species==='MIXED_SML'?6:preset.species==='HYDRANGEA'?content.props.flowers.length:0);
  assert.equal(nodes(ui).filter(n=>n.type==='EmotionControls').length,0);
  assert.ok(!Array.isArray(nodes(ui).find(n=>n.type==='Canvas').props.style),'Web-safe Canvas style');
}
for(const preset of deps['./allSpeciesReviewModel'].ALL_SPECIES_PRESETS){
  nodes(ui).find(n=>n.props?.label===preset.label).props.onPress();ui=renderSandbox();
  const backdrop=nodes(ui).find(n=>n.type==='Backdrop');assert.equal(backdrop.props.month,preset.month);
  const layer=nodes(backdrop).find(n=>n.type===renderer);assert.equal(layer.props.flowers.length,30);
  const tree=renderer({...layer.props,showFootprints:true});
  const sorted=[...layer.props.flowers].sort((a,b)=>a.worldY-b.worldY||a.id.localeCompare(b.id));
  for(let i=0;i<30;i++){
    const f=sorted[i],node=tree.props.children[i],visual=node.props.children[0],footprint=node.props.children[1];
    assert.deepEqual(clean(node.props.transform),[{translateX:f.worldX},{translateY:f.worldY}]);
    assert.equal(visual.props.transform[0].scale,f.visualScale);assert.equal(footprint.props.r,f.footprintRadius);
    for(const sprite of visual.props.children[0]){
      const image=sprite.type(sprite.props).props.children;
      assert.equal(image.type,'Image');assert.ok(image.props.image.includes(`/species/${f.speciesCode.toLowerCase()}/components/`));
      assert.equal(image.props.children,undefined,'No emotion image filters');
    }
  }
  assert.equal(nodes(ui).filter(n=>n.type==='EmotionControls').length,0);
  assert.ok(!Array.isArray(nodes(ui).find(n=>n.type==='Canvas').props.style));
}
for(const preset of deps['./mixedV2ReviewModel'].MIXED_V2_PRESETS){
  nodes(ui).find(n=>n.props?.label===preset.label).props.onPress();ui=renderSandbox();
  const layer=()=>nodes(nodes(ui).find(n=>n.type==='Backdrop')).find(n=>n.type===renderer);
  assert.equal(nodes(ui).find(n=>n.type==='Backdrop').props.month,preset.month);
  const richer=clean(layer().props.flowers);assert.equal(richer.length,30);
  nodes(ui).find(n=>n.props?.label==='Show Neighborhoods OFF').props.onPress();ui=renderSandbox();
  assert.deepEqual(clean(layer().props.flowers),richer,'Debug overlay cannot affect composition');
  assert.equal(nodes(ui).find(n=>n.type==='Neighborhoods').props.neighborhoods.length,6);
  nodes(ui).find(n=>n.props?.label==='Mixed V1').props.onPress();ui=renderSandbox();
  const original=clean(layer().props.flowers);
  const identity=flowers=>flowers.map(f=>({id:f.id,x:f.worldX,y:f.worldY,r:f.footprintRadius}));
  assert.deepEqual(identity(original),identity(richer));
  assert.deepEqual(original.map(f=>f.composition),clean(deps['./allSpeciesReviewModel'].composeAllSpecies(
    deps['./allSpeciesReviewModel'].generateAllSpeciesLayout(preset.month,30).flowers,preset.month)).map(f=>f.composition));
  nodes(ui).find(n=>n.props?.label==='Mixed V2').props.onPress();ui=renderSandbox();
  assert.deepEqual(clean(layer().props.flowers),richer);
  const drawn=renderer({...layer().props,showFootprints:true});
  const sorted=[...layer().props.flowers].sort((a,b)=>a.worldY-b.worldY||a.id.localeCompare(b.id));
  drawn.props.children.forEach((node,i)=>{
    assert.deepEqual(clean(node.props.transform),[{translateX:sorted[i].worldX},{translateY:sorted[i].worldY}]);
    assert.equal(node.props.children[1].props.r,sorted[i].footprintRadius);
    for(const sprite of node.props.children[0].props.children[0])assert.equal(sprite.type(sprite.props).props.children.type,'Image');
  });
  assert.equal(nodes(ui).filter(n=>n.type==='EmotionControls').length,0);
  nodes(ui).find(n=>n.props?.label==='Show Neighborhoods ON').props.onPress();ui=renderSandbox();
}
console.log('Actual Sandbox controls: reference presets, Mixed V1/V2 A/B, three V2 presets, identical anchors, diagnostic-only neighborhoods, correct assets/depth/footprints and neutral web-safe rendering passed.');
for(const preset of deps['./monthly-growth/monthlyGrowthModel'].GROWTH_PRESETS){
  nodes(ui).find(n=>n.props?.label===preset.label).props.onPress();ui=renderSandbox();
  const backdrop=nodes(ui).find(n=>n.type==='Backdrop'),layer=nodes(backdrop).find(n=>n.type==='MonthlyGrowth');
  assert.equal(backdrop.props.month,preset.month);assert.equal(layer.props.growth.records.length,preset.day);
  assert.equal(nodes(ui).filter(n=>n.type===renderer).length,0,'No double rendering with QA flowers');
  assert.equal(nodes(ui).filter(n=>n.type==='EmotionControls').length,0);
}
const getGrowth=()=>nodes(ui).find(n=>n.type==='MonthlyGrowth').props;
const selectedParent=getGrowth().growth.records[0];
growthTapHandler({x:selectedParent.worldX,y:selectedParent.worldY},true);ui=renderSandbox();
assert.equal(getGrowth().selectedId,selectedParent.id,'Canvas tap resolves only the parent primary footprint');
const detachedVisual=getGrowth().growth.filler.find(p=>getGrowth().growth.records.every(f=>Math.hypot(p.worldX-f.worldX,p.worldY-f.worldY)>f.footprintRadius));
assert.ok(detachedVisual);
growthTapHandler({x:detachedVisual.worldX,y:detachedVisual.worldY},true);ui=renderSandbox();
assert.equal(getGrowth().selectedId,null,'Filler does not create another click target');
const fullGrowth=JSON.stringify(getGrowth().growth);
for(const label of ['Companion Growth ON','Bed Filler ON','Growth Coverage OFF','Primary Anchors OFF']){
  nodes(ui).find(n=>n.props?.label===label).props.onPress();ui=renderSandbox();
  assert.equal(JSON.stringify(getGrowth().growth),fullGrowth,'Layer diagnostics never change logical records or generated children');
}
assert.equal(getGrowth().showCompanions,false);assert.equal(getGrowth().showFiller,false);assert.equal(getGrowth().showCoverage,true);
const growthCatalog=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const growthDeps={'./growthCatalog':growthCatalog,'@shopify/react-native-skia':{...skia,Path:'Path'},
  react:{memo:fn=>fn,useState:()=>[{},()=>{}],useCallback:fn=>fn,useEffect:fn=>fn()}};
const actualGrowth=compile('monthly-growth/MonthlyGrowthLayer.tsx',growthDeps);
const scene=getGrowth().growth,rendered=actualGrowth.MonthlyGrowthLayer({growth:scene,showCoverage:true,showAnchors:true});
assert.equal(rendered.props.clip,undefined,'Final Mask must not clip the botanical layer');
assert.ok(nodes(rendered).every(n=>n.props?.clip===undefined),'No nested mask clip on primary, companion or filler');
const sprites=nodes(rendered).filter(n=>n.type?.name==='BotanicalPiece');assert.equal(sprites.length,scene.pieces.length);
const loaders=nodes(rendered).filter(n=>n.type?.name==='ImageLoader');
assert.equal(loaders.length,new Set(scene.pieces.map(p=>`${p.speciesCode}:${p.componentId}`)).size,'Load once per unique asset, not per visual child');
for(const node of sprites){
  assert.equal(node.props.piece.interactive,false);
  const sprite=node.type({...node.props,image:'decoded-art'}),image=sprite.props.children;
  assert.ok(nodes(sprite).every(n=>n.props?.clip===undefined),'Actual botanical pixels are not clipped');
  assert.equal(image.type,'Image');assert.equal(image.props.children,undefined);
  assert.equal(image.props.onPress,undefined);
}
const primaryOnly=actualGrowth.growthDrawOrder(scene,false,false);assert.equal(primaryOnly.length,scene.primary.length);
assert.ok(primaryOnly.every(p=>p.kind==='primary'));
assert.equal(compile('monthly-growth/MonthlyGrowthLayer.tsx',growthDeps,false).MonthlyGrowthLayer({growth:scene}),null);
console.log('Monthly Growth controls: six stages/presets, shared occlusion slot, layer diagnostics, one image load per asset, unclipped noninteractive children and parent-only data passed.');
nodes(ui).find(n=>n.props?.label==='June Day 30 — V1').props.onPress();ui=renderSandbox();
const v1=clean(getGrowth().growth);
nodes(ui).find(n=>n.props?.label==='June Day 30 — V1.1').props.onPress();ui=renderSandbox();
const v11=getGrowth().growth;
assert.equal(nodes(ui).find(n=>n.type==='Backdrop').props.month,6);
assert.ok(nodes(nodes(ui).find(n=>n.type==='Backdrop')).some(n=>n.type==='MonthlyGrowth'));
assert.deepEqual(clean(v11.records),v1.records);assert.deepEqual(clean(v11.primary),v1.primary);
assert.equal(v11.pieces.length,v1.pieces.length);assert.notDeepEqual(clean(v11.companions),v1.companions);
const layeredOrder=actualGrowth.growthDrawOrder(v11),firstRaised=layeredOrder.findIndex(p=>p.kind!=='filler'||p.baseCover);
assert.ok(layeredOrder.slice(0,firstRaised).every(p=>p.kind==='filler'&&!p.baseCover));
assert.ok(layeredOrder.slice(firstRaised).every((p,i,rest)=>!i||p.worldY>=rest[i-1].worldY),'Root covers share depth ordering');
const v11Rendered=actualGrowth.MonthlyGrowthLayer({growth:v11,showCoverage:true,showAnchors:true});
assert.ok(nodes(v11Rendered).every(n=>n.props?.clip===undefined),'V1.1 debug overlays cannot clip botanical pixels');
for(const kind of ['primary','companion','filler']){
  const pieces=nodes(v11Rendered).filter(n=>n.type?.name==='BotanicalPiece'&&n.props.piece.kind===kind);
  assert.equal(pieces.length,v11.pieces.filter(p=>p.kind===kind).length);
  for(const node of pieces)assert.ok(nodes(node.type({...node.props,image:'decoded-art'})).every(n=>n.props?.clip===undefined),`${kind} artwork is uncut`);
}
nodes(ui).find(n=>n.props?.label==='June Day 30 — V1').props.onPress();ui=renderSandbox();
assert.deepEqual(clean(getGrowth().growth),v1,'A/B round trip preserves V1 exactly');
console.log('June V1/V1.1 actual A/B controls: same parents/primary/counts, changed children, root-cover depth, unchanged mask and Tea Set slot passed.');
