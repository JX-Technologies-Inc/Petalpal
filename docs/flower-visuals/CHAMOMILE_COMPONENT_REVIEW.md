# Chamomile DEV component review

Status: **APPROVED_S_CLASS_REFERENCE** — manual neutral-art visual review passed on 2026-09-28. The current Chamomile Garden component implementation is the approved SMALL / S-class visual reference for subsequent species. It remains available only in the DEV Flower Density Sandbox; this approval does not authorize production Garden integration. Tulip's status and implementation are unchanged.

Checkpoint: preserve the 29 extracted components, source anchors and scales, Sparse / Normal / Full recipes, radius 9 world px, deterministic composition, area-aware behavior, Tulip + Chamomile mixed behavior and Land06 Tea Set occlusion. Do not continue tuning Chamomile. The accompanying `CHAMOMILE_S_CLASS_APPROVED_CHECKPOINT.json` records hashes of these existing assets and behavior files.

**Mixed-species monthly views are the PRIMARY visual review target.** Single-species ×30 views are QA/stress-test views only; do not optimize them individually to fill an entire land. June Mixed 30 and October Mixed 30 remain the main comparison scenes.

Next species: Hydrangea as the L-class reference, but work must not begin until its Garden candidate artwork is provided. No Hydrangea integration was started at this checkpoint.

The replacement source was read afresh from `Resources/Garden Flowers/Chamomile/chamomile_garden_abc_candidate.png`: 1536 Ã— 1024 RGBA, SHA256 `8842911c29ea4059a2beb2dfe5ee8bbccc253dea0ed5f8b638b37d144a306d6e`. It has 806,802 fully transparent pixels and 1,049,690 pixels with alpha â‰¤8; representative clear gaps are alpha 0â€“2. RGB still contains background color under transparent pixels, but compositing the actual alpha over gray confirms isolated artwork. The old nearly opaque background is absent.

Clean extraction succeeded: 29 distinct components (10 single stems/buds, 3 small, 3 medium, 5 full, 8 foliage/fillers). No labels or separators are present. Crops preserve original RGBA without resampling, color keys, hue changes, repainting, sharpening or blur. As in the Tulip extractor, only remote alpha residue is discarded: alpha â‰¥8 support plus a three-pixel fringe retaining original edge RGBA. Tests verify every visible source pixel is retained exactly and each crop boundary has alpha <8. No component is duplicated to inflate variety.

Each component uses a transparent 512 Ã— 512 canvas. Anchors are manually inspected source stem/soil bases, translated into the padded canvas and normalized to [0,1]; they are not canvas centers. Source rectangles, padding offsets, soil points, visible bounds and SHA256 hashes are recorded in the manifest. The supplied source is unchanged.

Chamomile uses the existing Tulip component renderer with a supplied component catalog and footprint radius. Tulip keeps its default catalog, seed strings, component selection, offsets, scale, rotations, weights, spread and sorting. The shared seeded generator and bounds functions now accept the second species; area-profile selection is factored into a shared helper with identical Tulip defaults. There is no second rendering engine.

Chamomile recipes count visible open heads; closed buds remain in the supplied art but do not inflate these ranges:

| Composition | Open heads | Core and variation |
| --- | --- | --- |
| Sparse | 2â€“4 | Two-head small cluster, with 0â€“2 seeded single stems; occasional small foliage piece |
| Normal | 4â€“7 | Three-head medium cluster, with 1â€“4 seeded single stems; occasional small foliage piece |
| Full | 7â€“11 | Six-to-nine-head full cluster eligible for the chosen count, with enough single stems to reach it; no extra foliage |

Component scale is 0.88â€“1.00; optional foliage is 0.45â€“0.55. Rotation is Â±6Â° for singles and Â±3Â° for clusters/foliage. Local horizontal spread is Â±2 / Â±3 / Â±4 world px for Sparse / Normal / Full, multiplied by the existing area spread; local vertical offsets are Â±1.5 px (foliage +1). Parts retain local-Y depth ordering and complete objects retain world-Y ordering. Species, identity, density and approved area profile drive deterministic choices. Reloading reproduces the same geometry.

Every asset has defaultVisualScale 1 and 0.105 world units per source pixel. The whole-cluster DEV base multiplier is 1.00, tunable temporarily from 0.50â€“1.50. Its effective default scale is 1.00 in June and 1.22 in October. The footprint is always exactly **9 world px**, independent of art or cluster scale. One composed cluster remains one Journal preview object, one ground anchor and one footprint. Tulip's sandbox radius remains 12.

Both species reuse the existing approved-mask area thresholds: SMALL <45,000 pxÂ²; MEDIUM 45,000â€“<90,000 pxÂ²; LARGE â‰¥90,000 pxÂ². No mask areas or thresholds changed.

| Profile | Sparse / Normal / Full weights | Internal spread | Cluster visual scale |
| --- | --- | --- | --- |
| Small | 45 / 45 / 10% | 1.00 | 1.00 |
| Medium | 25 / 50 / 25% | 1.08 | 1.08 |
| Large | 10 / 45 / 45% | 1.15 | 1.22 |

The sandbox now opens on October Mixed 30. Direct Tulip, Chamomile, and Tulip + Chamomile selection is available. The four new quick presets are June/October Chamomile 30 and June/October Mixed 30. Both mixed presets contain exactly **15 Tulips + 15 Chamomile = 30 total objects**; both Chamomile-only presets contain 30 Chamomile. Mixing uses the existing natural grouping and footprint validation with a deterministic M/S sequence, not two separately generated overlapping layouts. These are disposable preview positions; saved positions are untouched. Pure Tulip layouts retain their existing identities/coordinates. Composition or visual-scale controls never repack positions.

The new neutral mixed/Chamomile review uses V3 defaults and its own Chamomile-only temporary scale. Existing Tulip-only tuning remains available separately. Both emotions are NONE. No tint, glow, sparkle, mist, pulse or animation is added. Cluster bounds, anchors, footprints and the approved Final Mask overlay remain available. Legacy tuning controls are hidden while reviewing Garden art so they do not imply that they alter these neutral presets.

Land06 occlusion is reused without implementation changes. `SandboxGardenBackdrop` routes its June children into `LandmarkLayer.behindTeaSet`, immediately before the existing Tea Set transform and all seven original layers: chair bases, table, occluders and overlays. Chamomile and mixed scenes are passed as the same children. No duplicate Tea Set draw or rectangular occluder is introduced. Tests verify this routing preserves all 30 objects and their world anchors. Tea Set art, placement, production Garden rendering, planting validity, masks, persistence, Journal, Support and backend files are unchanged.

Validation passed:

- `npx tsc --noEmit`
- `python scripts/extractChamomileComponents.py --check`
- `python test/chamomileExtraction.test.py` â€” 29 exact-pixel extractions and clear crop edges
- `node test/chamomileComposition.test.mjs` â€” 29 unique assets/anchors and 900 deterministic recipes
- `node test/mixedSpeciesSandbox.test.mjs` â€” all four 30-object presets, complete valid footprints, collision separation, unchanged anchors, fresh-module reload determinism
- `node test/speciesSandboxRendering.test.mjs` â€” actual preset callbacks and shared renderer; correct catalogs/radii, neutral presentation, DEV guard, web-safe Canvas style and backdrop containment
- `node test/flowerOcclusion.test.mjs` â€” original depth rule plus Chamomile/mixed June scenes
- `node test/tulipClusterVisualScale.test.mjs`
- `node test/tulipAreaProfiles.test.mjs`
- `node test/tulipComponentComposition.test.mjs`
- `node test/tulipGardenReview.test.mjs`
- `python scripts/extractTulipComponentsV2.py --check`
- `node test/flowerVisualSystem.test.mjs` â€” 2,220 assertions
- `node test/flowerDensitySandbox.test.mjs` â€” 1,735 complete footprints across 12 months and four legacy modes
- `node test/plantingSystem.test.mjs` â€” 158 assertions
- `node test/plantingMaskRefinement.test.mjs` â€” 57 assertions
- `node test/approvedPlantingRuntime.test.mjs`
- `node test/flowerDetail.test.mjs` â€” 20 tests

The render tests use mocked native primitives, not a browser. No headless Chrome or screenshot automation ran. The two image inspection artifacts show source/extracted art only. Manual neutral Chamomile visual review has now passed; the implementation is frozen as the S-class reference above.

Component inventory and exact changed-file inventory follow below.

## Component IDs, paths and soil anchors

All paths below are relative to the Petalpal workspace root.

| ID | Asset path | Anchor X | Anchor Y |
| --- | --- | --- | --- |
| `single/upright_01` | `mobile/assets/garden/flowers/species/chamomile/components/single/upright_01.png` | 0.492188 | 0.951172 |
| `single/leaning_01` | `mobile/assets/garden/flowers/species/chamomile/components/single/leaning_01.png` | 0.500000 | 0.951172 |
| `single/upright_02` | `mobile/assets/garden/flowers/species/chamomile/components/single/upright_02.png` | 0.498047 | 0.951172 |
| `single/bud_01` | `mobile/assets/garden/flowers/species/chamomile/components/single/bud_01.png` | 0.509766 | 0.951172 |
| `single/leaning_02` | `mobile/assets/garden/flowers/species/chamomile/components/single/leaning_02.png` | 0.480469 | 0.951172 |
| `single/tiny_01` | `mobile/assets/garden/flowers/species/chamomile/components/single/tiny_01.png` | 0.501953 | 0.951172 |
| `single/upright_03` | `mobile/assets/garden/flowers/species/chamomile/components/single/upright_03.png` | 0.523438 | 0.951172 |
| `single/bud_02` | `mobile/assets/garden/flowers/species/chamomile/components/single/bud_02.png` | 0.515625 | 0.951172 |
| `single/bud_03` | `mobile/assets/garden/flowers/species/chamomile/components/single/bud_03.png` | 0.474609 | 0.951172 |
| `single/bud_04` | `mobile/assets/garden/flowers/species/chamomile/components/single/bud_04.png` | 0.507812 | 0.951172 |
| `small/bud_pair_01` | `mobile/assets/garden/flowers/species/chamomile/components/small/bud_pair_01.png` | 0.519531 | 0.939453 |
| `small/open_pair_01` | `mobile/assets/garden/flowers/species/chamomile/components/small/open_pair_01.png` | 0.501953 | 0.943359 |
| `medium/airy_01` | `mobile/assets/garden/flowers/species/chamomile/components/medium/airy_01.png` | 0.500000 | 0.943359 |
| `medium/airy_02` | `mobile/assets/garden/flowers/species/chamomile/components/medium/airy_02.png` | 0.494141 | 0.951172 |
| `small/open_pair_02` | `mobile/assets/garden/flowers/species/chamomile/components/small/open_pair_02.png` | 0.494141 | 0.943359 |
| `medium/airy_03` | `mobile/assets/garden/flowers/species/chamomile/components/medium/airy_03.png` | 0.494141 | 0.962891 |
| `full/spreading_01` | `mobile/assets/garden/flowers/species/chamomile/components/full/spreading_01.png` | 0.488281 | 0.933594 |
| `full/upright_01` | `mobile/assets/garden/flowers/species/chamomile/components/full/upright_01.png` | 0.500000 | 0.917969 |
| `full/spreading_02` | `mobile/assets/garden/flowers/species/chamomile/components/full/spreading_02.png` | 0.509766 | 0.917969 |
| `full/airy_01` | `mobile/assets/garden/flowers/species/chamomile/components/full/airy_01.png` | 0.486328 | 0.929688 |
| `full/airy_02` | `mobile/assets/garden/flowers/species/chamomile/components/full/airy_02.png` | 0.527344 | 0.931641 |
| `foliage/leaves_01` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/leaves_01.png` | 0.503906 | 0.933594 |
| `foliage/leaves_02` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/leaves_02.png` | 0.494141 | 0.941406 |
| `foliage/leaves_03` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/leaves_03.png` | 0.498047 | 0.941406 |
| `foliage/leaves_04` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/leaves_04.png` | 0.511719 | 0.935547 |
| `foliage/ground_01` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/ground_01.png` | 0.482422 | 0.927734 |
| `foliage/ground_02` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/ground_02.png` | 0.482422 | 0.929688 |
| `foliage/ground_03` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/ground_03.png` | 0.501953 | 0.925781 |
| `foliage/ground_04` | `mobile/assets/garden/flowers/species/chamomile/components/foliage/ground_04.png` | 0.488281 | 0.923828 |

## Exact files changed in this integration

Modified existing files:

- `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`
- `mobile/src/components/garden/flower-density-sandbox/flowerDensityModel.ts`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/TulipComponentLayer.tsx`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/tulipComposition.ts`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/tulipAreaProfiles.ts`
- `mobile/test/flowerOcclusion.test.mjs`

New code, tests, documentation and inspection artifacts:

- `mobile/scripts/extractChamomileComponents.py`
- `mobile/src/components/garden/flower-density-sandbox/speciesReviewModel.ts`
- `mobile/src/components/garden/flower-density-sandbox/chamomile-components/chamomileComposition.ts`
- `mobile/src/components/garden/flower-density-sandbox/chamomile-components/chamomileCatalog.ts`
- `mobile/src/components/garden/flower-density-sandbox/chamomile-components/componentImages.ts`
- `mobile/src/components/garden/flower-density-sandbox/chamomile-components/componentManifest.json`
- `mobile/test/chamomileComposition.test.mjs`
- `mobile/test/chamomileExtraction.test.py`
- `mobile/test/mixedSpeciesSandbox.test.mjs`
- `mobile/test/speciesSandboxRendering.test.mjs`
- `docs/flower-visuals/CHAMOMILE_COMPONENT_REVIEW.md`
- `output/chamomile-integration-baseline.json`
- `output/chamomile-replaced-alpha-inspection.jpg`
- `output/chamomile-extracted-inspection.jpg`

New artwork files: exactly the 29 PNG paths in the component inventory above. The source candidate was supplied/replaced by the user and was read only during this implementation.
