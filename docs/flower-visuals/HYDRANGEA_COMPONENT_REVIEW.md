> Approved checkpoint (2026-09-29): CURRENT Hydrangea V2 is **APPROVED_L_CLASS_REFERENCE** after user manual review. Preserve its current artwork, scales, recipe, colors, radius 16, determinism, area behavior, mixed presets and occlusion; no further tuning. Production remains deferred. Details below describe the original implementation/review history.

> Current Hydrangea status: V1 artwork **REJECTED**; all 25 V1 component PNGs removed. The replacement V2 source is **APPROVED_L_CLASS_REFERENCE**. See [V2 replacement report](HYDRANGEA_V2_COMPONENT_REVIEW.md) for the current recipe/assets. Earlier Hydrangea details below are historical.

# Hydrangea L-class DEV candidate review

Historical V1 status at initial integration: **READY_FOR_REVIEW**. Hydrangea was integrated only into the existing Flower Density Sandbox. V1 was subsequently rejected and replaced; current V2 approval is recorded above. Chamomile remains APPROVED_S_CLASS_REFERENCE; Tulip components, V3 behavior and status are unchanged. Production Garden rendering is unchanged.

## Source and extraction

Inspected the actual `Resources/Garden Flowers/Hydrangea/hydrangea_garden_abc_candidate.png`: 1536 × 1024 RGBA, SHA256 `d6a361e98291d3ee66f909de7673aca4d101b17a1c9c13e881825c5451965e20`. The source has 609,464 fully transparent pixels and 787,009 with alpha ≤8. Empty samples at (224,60), (398,60), (780,50), (1060,40), (1200,240) and (750,800) all have alpha 0. A gap sampled across x220–235/y20–99 has alpha min/median/max 0/0/1. Compositing actual alpha over gray confirmed usable transparency, regardless of hidden RGB background colors.

Extracted 25 distinct pieces: 3 main-head stems, 4 buds, 1 small blue-head/bud stem, 6 small paired/budded clusters, and 11 foliage pieces (3 individual leaves plus 8 rooted fillers). The four huge third-row bushes remain in the source as references; they are not extracted or used as Journal objects. No artificial component duplication, repainting, recoloring, regeneration, sharpening or blur was performed.

Extraction follows the existing Tulip alpha method: select the connected piece at its soil/stem point using alpha ≥8 support plus three pixels of original-alpha fringe. Retained RGBA is copied exactly onto a transparent canvas without resizing; only disconnected neighboring art and remote low-alpha residue are excluded. Tests confirm exact retained RGBA, connected extraction reproducibility and no visible crop-edge clipping. No green-screen/color-key removal is used. The source is unchanged.

All canvases are 512 × 512. Each anchor is the inspected logical soil/stem base, converted from source coordinates into padded canvas coordinates and normalized to [0,1]. Individual leaf anchors represent their attachment base; these individual leaves are retained in the catalog but are not selected as floating heads or independent main plants. Main-head recipes use complete original stems. Manifest records include all required metadata, source rectangles/soil points, visible bounds, color families and asset hashes.

## Composition and scale

Hydrangea uses the unchanged shared Tulip component renderer, seeded generator, bounds calculation, area-classification/selection and depth system through a new species catalog and recipe. There is no separate rendering engine.

| Class | Main heads | Supporting art |
| --- | --- | --- |
| Sparse | 1 | Narrow root offsets; 20% optional bud and 20% light foliage |
| Normal | 1–2 | One rooted foliage piece; 30% optional bud |
| Full | 2–3 | One or two rooted foliage pieces; 30% optional bud |

For eligible multi-head identities, a small two-head source cluster can replace two single stems with a 35% seeded chance. Huge bush compositions are never eligible. Blue, pink and lavender are selected from original source pixels; multi-head identities have a 30% chance of restrained mixed source colors. No tint or runtime recoloring is used. These colors are base-species variation. Both secondary emotions are NONE; no glow, sparkle, mist, pulse or emotional animation is added.

Main component scale: 0.85–1.00. Supporting bud/foliage scale: 0.38–0.54. Main rotation: ±4°; support rotation: ±6°. Root horizontal offsets: ±1.5 / ±4 / ±6 world px for Sparse / Normal / Full, multiplied by the existing area spread. Vertical root offsets: ±1.5 world px; support adds 1 px before area spread. Every cluster stays coherent around one ground anchor; local-Y sorting and whole-object world-Y sorting are unchanged.

Each Hydrangea component has defaultVisualScale **1.00**, worldUnitsPerPixel **0.18**, and the whole-cluster base visual multiplier **1.00**. Temporary Hydrangea-only DEV tuning is exposed from 0.50–1.50 and never changes the other species or footprints. Broad Hydrangea heads and the larger source-pixel scale establish greater mass than Chamomile (0.105 world px/source px) and Tulip (0.16 world px/source px), subject to manual mixed-view approval.

Footprint radii stay independent of PNG dimensions and visual bounds: **Chamomile 9, Tulip 12, Hydrangea 16 world px**. One cluster is one preview Journal object, one ground anchor and one collision footprint.

## Area-aware behavior

The existing approved-mask classification is reused unchanged: SMALL <45,000 world px², MEDIUM 45,000–<90,000, LARGE ≥90,000. June is SMALL; October is LARGE.

| Area profile | Sparse / Normal / Full weights | Internal spread | Whole-cluster scale |
| --- | --- | --- | --- |
| Small | 45 / 45 / 10% | 1.00 | 1.00 |
| Medium | 25 / 50 / 25% | 1.08 | 1.08 |
| Large | 10 / 45 / 45% | 1.15 | 1.22 |

Default effective Hydrangea cluster scale is therefore 1.00 in June and 1.22 in October. Same identity, density and area reproduce the same source selections and transforms on reload. Appearance controls do not regenerate positions.

## Primary review presets and occlusion

The sandbox opens on October Mixed S + M + L / 30. Both June and October primary presets contain exactly **12 Tulips + 12 Chamomile + 6 Hydrangea = 30 total Journal objects**. The existing natural grouped placement function is reused without edits: place the six L-class footprints first, then alternate M/S. This avoids losing large footprints to earlier small placements while preserving full-mask containment and collision checks. Species assignment is deterministic; rendering remains sorted by world Y. New three-species identities are namespaced separately from the preserved two-species previews.

The original Tulip + Chamomile mixed presets remain available and unchanged at 15/15; their regression tests pass. Chamomile-only and Tulip-only behavior is unchanged. Only disposable new preview layouts are generated; saved positions are never read or written by this integration.

Hydrangea-only QA buttons request 20 objects. **June currently fits 11/20 (9 failed); October fits 20/20.** The visible capacity report remains authoritative; no radius reduction or mask/collision relaxation is used to force QA counts. These are stress-test views, not targets for filling the entire land. Mixed monthly views remain PRIMARY.

Land06 occlusion is inherited without rewriting any Tea Set code: the composed species layer remains a child of `SandboxGardenBackdrop`; June routes it to `LandmarkLayer.behindTeaSet`, before the existing Tea Set transform and all seven original layers. Tests cover Hydrangea-only and three-species mixed routing and unchanged anchors. No extra rectangular occluder, duplicate Tea Set art, or rejection based on upper visual bounds is introduced. Tea Set artwork/placement and production rendering remain unchanged.

## Validation

Focused checks cover 25 unique asset/anchor resolutions and exact pixel extraction; 1,350 deterministic Hydrangea recipes; head ranges; source-color families; coherent offsets; radius 16; one object per cluster; reused area profiles; exactly 30 objects and the 12/12/6 split in both mixed presets; full-footprint mask containment and non-overlap; fresh-module reload behavior; visual-only scaling; actual sandbox preset callbacks and renderer catalogs; and inherited Land06 occlusion.

All commands below passed (2026-09-29). Existing planting: 158 assertions; refinement: 57; visual system: 2,220; sandbox: 1,735 complete footprints; flower detail: 20 tests.

Commands run:

- `npx tsc --noEmit`
- `python scripts/extractHydrangeaComponents.py --check`
- `python test/hydrangeaExtraction.test.py`
- `node test/hydrangeaComposition.test.mjs`
- `node test/hydrangeaMixedSandbox.test.mjs`
- `node test/speciesSandboxRendering.test.mjs`
- `node test/flowerOcclusion.test.mjs`
- `node test/chamomileComposition.test.mjs`
- `node test/mixedSpeciesSandbox.test.mjs`
- `python scripts/extractChamomileComponents.py --check`
- `node test/tulipClusterVisualScale.test.mjs`
- `node test/tulipAreaProfiles.test.mjs`
- `node test/tulipComponentComposition.test.mjs`
- `node test/tulipGardenReview.test.mjs`
- `python scripts/extractTulipComponentsV2.py --check`
- `node test/flowerVisualSystem.test.mjs`
- `node test/flowerDensitySandbox.test.mjs`
- `node test/plantingSystem.test.mjs`
- `node test/plantingMaskRefinement.test.mjs`
- `node test/approvedPlantingRuntime.test.mjs`
- `node test/flowerDetail.test.mjs`

The approved Chamomile checkpoint was verified before edits. Protected baseline checks confirm unchanged Chamomile code/assets/status, Tulip code/assets, approved masks, planting logic/persistence, Tea Set, production Garden and backend. The shared `speciesReviewModel.ts` is intentionally extended with new species cases; existing two-species behavior is separately regression-tested. The prior approval checkpoint itself is not rewritten.

No headless Chrome or screenshot automation ran. Inspection images are source/extraction contact sheets only. Stop for manual review; Hydrangea is not approved and no further species work is authorized by this integration.

## Component IDs, paths and anchors

Paths are relative to the Petalpal workspace root.

| Component ID | Asset path | Anchor X | Anchor Y |
| --- | --- | --- | --- |
| `single/blue_01` | `mobile/assets/garden/flowers/species/hydrangea/components/single/blue_01.png` | 0.460938 | 0.945312 |
| `single/pink_01` | `mobile/assets/garden/flowers/species/hydrangea/components/single/pink_01.png` | 0.509766 | 0.949219 |
| `single/lavender_01` | `mobile/assets/garden/flowers/species/hydrangea/components/single/lavender_01.png` | 0.490234 | 0.949219 |
| `bud/green_01` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_01.png` | 0.423828 | 0.947266 |
| `bud/green_02` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_02.png` | 0.537109 | 0.941406 |
| `small/blue_bud_01` | `mobile/assets/garden/flowers/species/hydrangea/components/small/blue_bud_01.png` | 0.500000 | 0.955078 |
| `bud/pink_01` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/pink_01.png` | 0.507812 | 0.943359 |
| `bud/green_03` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_03.png` | 0.498047 | 0.941406 |
| `foliage/leaf_upright_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_upright_01.png` | 0.494141 | 0.955078 |
| `foliage/leaf_upper_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_upper_01.png` | 0.414062 | 0.945312 |
| `foliage/leaf_lower_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_lower_01.png` | 0.419922 | 0.828125 |
| `cluster/blue_pair_01` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_pair_01.png` | 0.482422 | 0.941406 |
| `cluster/pink_lavender_01` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/pink_lavender_01.png` | 0.513672 | 0.951172 |
| `cluster/lavender_blue_01` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/lavender_blue_01.png` | 0.500000 | 0.939453 |
| `cluster/blue_bud_01` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_bud_01.png` | 0.529297 | 0.939453 |
| `cluster/pink_lavender_02` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/pink_lavender_02.png` | 0.484375 | 0.935547 |
| `cluster/blue_pink_01` | `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_pink_01.png` | 0.478516 | 0.935547 |
| `foliage/ground_leaves_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_01.png` | 0.500000 | 0.939453 |
| `foliage/ground_leaves_02` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_02.png` | 0.511719 | 0.937500 |
| `foliage/ground_bud_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_01.png` | 0.498047 | 0.921875 |
| `foliage/stem_buds_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/stem_buds_01.png` | 0.492188 | 0.943359 |
| `foliage/ground_leaves_03` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_03.png` | 0.513672 | 0.933594 |
| `foliage/ground_bud_02` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_02.png` | 0.501953 | 0.931641 |
| `foliage/grass_01` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/grass_01.png` | 0.498047 | 0.935547 |
| `foliage/ground_bud_03` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_03.png` | 0.482422 | 0.935547 |

## Exact files changed

Modified:

- `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`
- `mobile/src/components/garden/flower-density-sandbox/speciesReviewModel.ts`
- `mobile/test/flowerOcclusion.test.mjs`
- `mobile/test/speciesSandboxRendering.test.mjs`
- `docs/flower-visuals/FLOWER_VISUAL_SYSTEM_DELIVERY.md`

Added:

- `mobile/scripts/extractHydrangeaComponents.py`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/hydrangeaComposition.ts`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/hydrangeaCatalog.ts`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/componentManifest.json`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/componentImages.ts`
- `mobile/test/hydrangeaExtraction.test.py`
- `mobile/test/hydrangeaComposition.test.mjs`
- `mobile/test/hydrangeaMixedSandbox.test.mjs`
- `docs/flower-visuals/HYDRANGEA_COMPONENT_REVIEW.md`
- `output/hydrangea-baseline.json`
- `output/hydrangea-alpha-inspection.jpg`
- `output/hydrangea-extracted-inspection.jpg`

Also added: exactly the 25 PNG asset paths listed in the component inventory above. The supplied source candidate was read only.
