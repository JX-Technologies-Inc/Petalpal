import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadPlantingModules } from './loadPlantingModules.mjs';
import { CANONICAL_PRIMARY_GARDEN_MOODS, SECONDARY_FLOWER_MODIFIERS } from '../../lib/flower-variant-config.js';
const load = loadPlantingModules();
const { resolveFlowerVisual: resolve, compositionForId, groundRect, sortVisualsByGroundY, FLOWER_CATALOG } = load('../flower-visuals/flowerVisualResolver');
const { PRIMARY_BLOOMS, SECONDARY_EMOTIONS } = load('../flower-visuals/flowerVisualTypes');
const { EMOTION_STYLES, EFFECTS, colorMatrix } = load('../flower-visuals/emotionStyles');
const clean = value => JSON.parse(JSON.stringify(value));
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions++; }
function eq(actual, expected, message) { assert.deepEqual(clean(actual), clean(expected), message); assertions++; }
const input = { flowerId: 'journal-42', primaryBloom: 'SUNNY_BLOOM', speciesCode: 'TULIP', secondaryEmotions: [] };
eq(PRIMARY_BLOOMS, CANONICAL_PRIMARY_GARDEN_MOODS);
eq([...SECONDARY_EMOTIONS].sort(), Object.keys(SECONDARY_FLOWER_MODIFIERS).sort());
eq(SECONDARY_EMOTIONS.length, 18);
eq(FLOWER_CATALOG.length, 29);
for (const p of PRIMARY_BLOOMS) for (const emotion of SECONDARY_EMOTIONS) {
  const v = resolve({ ...input, primaryBloom: p, secondaryEmotions: [emotion] });
  eq(v.primaryBloom, p); eq(v.speciesCode, 'TULIP'); eq(v.compositionVariant, compositionForId(input.flowerId));
  eq(v.colorAccent, SECONDARY_FLOWER_MODIFIERS[emotion].colorAccent);
  eq(v.accentEffect, 'none'); check(EFFECTS[EMOTION_STYLES[emotion].secondaryEffect]);
}
// Cases A–E, explicitly preserve identity and main/accent role ordering.
const a = resolve(input);
eq(a.colorAccent, 'NONE'); eq(a.accentEffect, 'none');
const b = resolve({ ...input, secondaryEmotions: ['gratitude'] });
eq(b.colorAccent, 'WARM_GOLD'); eq(b.accentEffect, 'none'); check(b.mainEmotionStyle.halo);
const c = resolve({ ...input, secondaryEmotions: ['gratitude', 'surprise'] });
eq(c.colorAccent, 'WARM_GOLD'); eq(c.visualEffect, 'FLASH_SPARKLE'); eq(c.accentEffect, 'flash_sparkle');
eq(c.secondaryEmotions, ['gratitude', 'surprise']);
const d = resolve({ ...input, secondaryEmotions: ['gratitude'] });
eq(d.secondaryEmotions, ['gratitude']); eq(d.primaryBloom, 'SUNNY_BLOOM');
const e = resolve({ ...input, primaryBloom: 'FIRE_BLOOM', speciesCode: 'POPPY', secondaryEmotions: ['sadness'] });
eq(e.primaryBloom, 'FIRE_BLOOM'); eq(e.speciesCode, 'POPPY'); eq(e.colorAccent, 'COOL_BLUE');
eq(resolve({ ...input, secondaryEmotions: ['surprise', 'gratitude'] }).visualEffect, 'SOFT_SPARKLE');
for (const bad of [null, 'gratitude', ['neutral'], ['approval'], ['gratitude', 'surprise', 'sadness'], ['gratitude', 'gratitude'], [null, 'surprise']]) {
  const v = resolve({ ...input, secondaryEmotions: bad });
  eq(v.secondaryEmotions, []); check(v.issues.includes('INVALID_SECONDARY_LIST')); eq(v.speciesCode, input.speciesCode);
}
const redundant = resolve({ ...input, secondaryEmotions: ['joy', 'gratitude'] });
eq(redundant.primaryBloom, 'SUNNY_BLOOM'); check(redundant.issues.includes('BACKEND_REDUNDANCY_FILTER_EXPECTED'));
check(!resolve({ ...input, primaryBloom: 'bad' }).renderable);
check(!resolve({ ...input, flowerId: '' }).renderable);
check(!resolve({ ...input, speciesCode: 'UNKNOWN' }).renderable);
for (let i=0;i<360;i++) {
  const id = `journal-${i}`;
  eq(compositionForId(id), compositionForId(id));
  eq(resolve({ ...input, flowerId:id, secondaryEmotions: ['fear','love'] }).compositionVariant, compositionForId(id));
}
for (const species of FLOWER_CATALOG) {
  eq(Object.keys(species.gardenAssets), ['sparse','normal','full']);
  for (const composition of ['sparse','normal','full']) {
    const v = resolve({ ...input, speciesCode: species.speciesCode }, { composition, devPreview: true });
    const isReviewCandidate = species.speciesCode === 'TULIP';
    eq(v.renderable, isReviewCandidate);
    eq(v.issues.includes('MISSING_APPROVED_GARDEN_ART'), !isReviewCandidate);
    check(!resolve({ ...input, speciesCode: species.speciesCode }, { composition }).renderable);
    if (isReviewCandidate) eq(v.gardenAsset.status, 'READY_FOR_REVIEW');
    check(!v.gardenAsset.asset.startsWith('Resources'));
    const rect = groundRect(v.gardenAsset, 130, 240, v.visualWidth, v.visualHeight);
    check(Math.abs(rect.x + v.gardenAsset.anchorX * rect.width - 130) < 1e-9);
    check(Math.abs(rect.y + v.gardenAsset.anchorY * rect.height - 240) < 1e-9);
  }
}
eq(a.footprintRadius, 12);
const tulip = FLOWER_CATALOG.find(s=>s.speciesCode==='TULIP');
const slot = tulip.gardenAssets.normal, saved = {...slot};
try {
  slot.status='READY_FOR_REVIEW';
  check(!resolve(input,{composition:'normal'}).renderable);
  check(resolve(input,{composition:'normal',devPreview:true}).renderable);
  slot.status='APPROVED'; slot.visualScale=2;
  const focused=resolve(input,{composition:'normal',state:'SELECTED',selectedTier:'FOCUSED'});
  check(focused.renderable); eq(focused.footprintRadius,12); eq(focused.effectTier,'FOCUSED');
  eq(resolve(input,{selectedTier:'FOCUSED'}).effectTier,'SUBTLE');
  slot.anchorX=NaN; check(!resolve(input,{composition:'normal'}).renderable);
} finally {Object.assign(slot,saved);}
const objects=[{id:'b',worldY:20},{id:'a',worldY:20},{id:'c',worldY:10}];
eq(sortVisualsByGroundY(objects).map(x=>x.id),['c','a','b']); eq(objects[0].id,'b');
eq(colorMatrix(EMOTION_STYLES.sadness.mainVariantStyle).slice(15),[0,0,0,1,0]);
// Exercise actual renderer gates with a fake decoded bitmap (not fake production artwork).
const jsx = (type,props) => ({ type,props });
const imageRequests=[];
let decodeSuccess=true;
const bindings={};
const renderLoad=loadPlantingModules(undefined,{memo:fn=>fn},undefined,true,{
  './gardenArtBindings.generated': {GARDEN_ART_BINDINGS:bindings},
  'react/jsx-runtime': {jsx,jsxs:jsx},
  '@shopify/react-native-skia': {Circle:'Circle',ColorMatrix:'ColorMatrix',Group:'Group',Image:'Image',
    useImage:source=>{imageRequests.push(source);return source && decodeSuccess ? {decoded:true}:null;}},
});
const renderer=renderLoad('../flower-visuals/GardenFlowerVisualLayer');
const runtime=renderLoad('../flower-visuals/flowerVisualResolver');
const runtimeSlot=runtime.FLOWER_CATALOG.find(s=>s.speciesCode==='TULIP').gardenAssets.normal;
const runtimeSaved={...runtimeSlot};
function renderSprite(devPreview=false) {
  const visual=runtime.resolveFlowerVisual(input,{composition:'normal',devPreview});
  const tree=renderer.GardenFlowerVisualLayer({flowers:[{id:input.flowerId,worldX:1,worldY:2,visual}],devPreview});
  const child=tree.props.children[0];
  // VM has __DEV__ false: a caller cannot accidentally enable DEV in release.
  eq(child.props.devPreview,false);
  return child.type(child.props);
}
try {
  eq(renderSprite(),null); eq(imageRequests.at(-1),null);
  runtimeSlot.status='APPROVED';
  eq(renderSprite(),null); // Approval status without a validated binding is insufficient.
  bindings[runtimeSlot.asset]={source:123,metadata:{...runtimeSlot},sha256:'fixture-only'};
  check(renderSprite()!==null); eq(imageRequests.at(-1),123);
  runtimeSlot.anchorY=.7;
  eq(renderSprite(),null); // Stale metadata binding fails closed.
  Object.assign(runtimeSlot,runtimeSaved,{status:'READY_FOR_REVIEW'});
  bindings[runtimeSlot.asset]={source:123,metadata:{...runtimeSlot},sha256:'fixture-only'};
  eq(renderSprite(true),null); // Release renderer rejects READY even with dev resolution.
  runtimeSlot.status='APPROVED';bindings[runtimeSlot.asset].metadata={...runtimeSlot};decodeSuccess=false;
  eq(renderSprite(),null); // Decode failure never substitutes botanical art.
} finally {Object.assign(runtimeSlot,runtimeSaved);delete bindings[runtimeSlot.asset];}
const directory = new URL('../src/components/garden/flower-visuals/',import.meta.url);
for (const file of fs.readdirSync(directory).filter(f=>/\.tsx?$/.test(f))) {
  const source=fs.readFileSync(new URL(file,directory),'utf8');
  check(!source.includes('Math.random('),file+' must be deterministic');
  check(!source.includes('Resources/'),file+' must not load botanical art');
}
execFileSync(process.execPath,[new URL('../scripts/syncFlowerVisualContract.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--check'],{stdio:'inherit'});
console.log(`Flower visual system: ${assertions} assertions passed (including A–E, 360 identities, 87 slots).`);
