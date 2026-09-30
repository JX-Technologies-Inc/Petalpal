import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const load = loadPlantingModules();
const { TULIP_REVIEW_SETTINGS: settings, TULIP_REVIEW_RADIUS: radius, TULIP_REVIEW_PRESETS: presets } = load('../flower-density-sandbox/tulipReviewPreset');
const { TULIP_REVIEW_SCALES: scales, tulipReviewTuning } = load('../flower-density-sandbox/tulipReviewPreset');
const { DEFAULT_TUNING, generateDensityLayout } = load('../flower-density-sandbox/flowerDensityModel');
const { resolveFlowerVisual, compositionForId, groundRect, sortVisualsByGroundY } = load('../flower-visuals/flowerVisualResolver');
const { GARDEN_ART_BINDINGS: bindings } = load('../flower-visuals/gardenArtBindings.generated');
const extraction = JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/TULIP_CANDIDATE_EXTRACTION.json',import.meta.url),'utf8'));
const root = new URL('../../',import.meta.url);
const clean = x => JSON.parse(JSON.stringify(x));
assert.equal(settings.main,''); assert.equal(settings.accent,''); assert.equal(settings.composition,'auto');
assert.equal(radius,DEFAULT_TUNING.M.footprintRadius); assert.equal(radius,12);
assert.deepEqual(clean(presets.map(p=>p.month)),[10,6]);
assert.deepEqual(clean(scales.current),{sparse:1,normal:1,full:1});
assert.deepEqual(clean(scales.tuned),{sparse:.95,normal:.89,full:.82});
for (const asset of extraction.assets) {
  const file=fs.readFileSync(new URL(asset.asset,root));
  assert.equal(file.readUInt32BE(16),512);assert.equal(file.readUInt32BE(20),512);
  assert.equal(file[25],6); // PNG RGBA color type.
  assert.equal(createHash('sha256').update(file).digest('hex'),asset.sha256);
  const binding=bindings[asset.asset];assert.ok(binding);assert.equal(binding.sha256,asset.sha256);
  const input={flowerId:'review',primaryBloom:settings.primaryBloom,speciesCode:'TULIP',secondaryEmotions:[]};
  const dev=resolveFlowerVisual(input,{composition:asset.composition,devPreview:true});
  assert.equal(dev.renderable,true);assert.equal(dev.gardenAsset.status,'READY_FOR_REVIEW');
  assert.deepEqual(clean(binding.metadata),clean(dev.gardenAsset));
  assert.equal(dev.gardenAsset.anchorX,asset.anchorX);assert.equal(dev.gardenAsset.anchorY,asset.anchorY);
  assert.equal(dev.mainEmotionStyle.halo,false);assert.equal(dev.accentEffect,'none');
  assert.equal(dev.colorAccent,'NONE');assert.equal(dev.mainEmotionStyle.brightness,1);assert.equal(dev.mainEmotionStyle.saturation,1);
  assert.equal(dev.footprintRadius,20); // Existing production radius was not changed to sandbox M radius.
  assert.equal(resolveFlowerVisual(input,{composition:asset.composition}).renderable,false);
}
const source=fs.readFileSync(new URL(extraction.source,root));
assert.equal(createHash('sha256').update(source).digest('hex'),extraction.sourceSha256);
for(const preset of presets) {
  const before=generateDensityLayout(preset.month,preset.count,'M',DEFAULT_TUNING);
  const review=generateDensityLayout(preset.month,preset.count,'M',{...DEFAULT_TUNING,M:{...DEFAULT_TUNING.M,footprintRadius:radius}});
  assert.deepEqual(clean(review.flowers),clean(before.flowers));
  const variants=new Set();
  const snapshots={current:[],tuned:[]};
  for(const flower of review.flowers) {
    const v=resolveFlowerVisual({flowerId:flower.id,primaryBloom:settings.primaryBloom,speciesCode:'TULIP',secondaryEmotions:[]},{devPreview:true});
    assert.equal(v.compositionVariant,compositionForId(flower.id));assert.ok(bindings[v.gardenAsset.asset]);
    variants.add(v.compositionVariant);assert.equal(flower.footprintRadius,radius);
    for(const mode of ['current','tuned']) {
      const tuning=tulipReviewTuning(settings,v.compositionVariant,mode);
      const rect=groundRect({...v.gardenAsset,visualScale:v.gardenAsset.visualScale*tuning.scaleMultiplier},
        flower.worldX,flower.worldY,v.visualWidth,v.visualHeight);
      assert.ok(Math.abs(rect.x+v.gardenAsset.anchorX*rect.width-flower.worldX)<1e-9);
      assert.ok(Math.abs(rect.y+v.gardenAsset.anchorY*rect.height-flower.worldY)<1e-9);
      assert.ok(Math.abs(rect.width/v.visualWidth-scales[mode][v.compositionVariant])<1e-9);
      assert.equal(tuning.anchorOffsetX,0);assert.equal(tuning.anchorOffsetY,0);
      const {scaleMultiplier,...rest}=tuning;
      snapshots[mode].push({...flower,composition:v.compositionVariant,asset:v.gardenAsset,settings:rest});
    }
  }
  assert.deepEqual(clean(snapshots.current),clean(snapshots.tuned),'A/B changes only visual scale');
  assert.deepEqual(clean(sortVisualsByGroundY(snapshots.current).map(f=>f.id)),
    clean(sortVisualsByGroundY(snapshots.tuned).map(f=>f.id)),'Depth order stays identical');
  assert.equal(variants.size,3);
  console.log(`Tulip Garden review: month ${preset.month}, ${review.placed}/${preset.count}, same M-class positions/footprints, all 3 real assets resolve.`);
}
console.log('Tulip extraction, neutral presentation, source preservation, bindings and production rejection passed.');
console.log('Current/tuned A/B: only scale differs; exact anchors, positions, footprints, assets and depth order preserved.');
