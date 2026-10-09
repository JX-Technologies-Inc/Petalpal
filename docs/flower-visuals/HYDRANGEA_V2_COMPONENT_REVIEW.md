> Approved checkpoint (2026-09-29): CURRENT Hydrangea V2 is **APPROVED_L_CLASS_REFERENCE** after user manual review. Preserve its current artwork, scales, recipe, colors, radius 16, determinism, area behavior, mixed presets and occlusion; no further tuning. Production remains deferred. Details below describe the original implementation/review history.

# Hydrangea V2 art replacement — manual review pending

Status: **APPROVED_L_CLASS_REFERENCE**. The previous Hydrangea artwork is **REJECTED** and all 25 of its extracted PNGs have been removed. The V2 manifest and bindings resolve only new artwork; none of the rejected components remain available to the component renderer. Production Garden rendering is unchanged.

## Fresh source and alpha verification

Read `Resources/Garden Flowers/Hydrangea/hydrangea_garden_abc_candidate.png` again from disk. It is now 1536 × 1024 RGBA, SHA256 `54db3ac0ac344c24d44cdad6b0cf007ff578daedab4cd81606760030ccdd661a`, with actual alpha range 0–254. There are 462,120 fully transparent pixels and 699,867 pixels at alpha ≤8. Empty samples (220,10), (395,10), (790,10), (1530,400), (780,680), and (900,5) all have alpha 0. Actual-alpha compositing over gray confirmed clean surroundings; this is not the earlier opaque RGB checkerboard file.

Extraction succeeded using the existing alpha-only connected-component method, without color keys, resizing, repainting, recoloring, sharpening, blur, or reconstruction. Retained pixels have exactly the original RGBA. Alpha ≥8 defines visible support and three pixels of original-alpha fringe preserve edges. Tests verify all extracted crop edges are below alpha 8 and the extraction can be reproduced exactly from this source. No background labels/separators appear in the selected regions.

## New component inventory

25 unique V2 components: 3 compact/side main-head stems, 5 smaller partial/side/budding main blooms, 6 buds, 8 foliage pieces, and 3 asymmetric two-head source patches. The largest complete top-row heads and bottom Full bushes remain source references only. They are not extracted or selected for routine Journal flowers.

Every new ID ends in `_v2`, and no path or file hash overlaps the rejected component inventory. All metadata retains speciesCode HYDRANGEA; status is now APPROVED_L_CLASS_REFERENCE. The 512 × 512 transparent canvas convention and normalized logical stem/soil anchors are retained. New artwork receives its own inspected soil/stem-base coordinates; world anchors and placement architecture are unchanged.

## V2 recipe

| Composition | Construction |
| --- | --- |
| Sparse | Exactly one smaller partial/side-facing main bloom, one foliage piece, and a 50% seeded chance of a bud |
| Normal | One main bloom, with a 35% seeded chance of a smaller partial secondary bloom; one foliage piece; 30% optional bud |
| Full | Two heads normally (85% starting weight), three occasionally (15%); staggered head size, side and depth; two foliage pieces; 30% optional bud |

Sparse always selects from partial blooms. Other independently composed main blooms prefer partials at 80%; secondary/third blooms always select partials. A small eligible subset of two-head identities (15% conditional chance when mixed or lavender) can use a supplied asymmetric patch instead. No large bush is eligible. Tests require more than 80% of sampled recipes to include partial/side blooms and Full two-head compositions to substantially outnumber three-head ones.

Natural blue, muted lavender/purple and soft pink come directly from the source. Multi-head recipes have a 25% chance of restrained mixed source colors. Both emotions are NONE; there are no image filters, tint, glow, sparkle, mist, pulse or emotional animation.

Main head local scale: 0.85–0.98. Secondary: 0.58–0.78. Occasional third: 0.48–0.62. Asymmetric source patch: 0.65–0.77. Foliage: 0.38–0.50. Bud: 0.40–0.54. Complete supplied stems/patches are retained, so heads are not detached cutouts. Secondary stems stagger to one side by 2.5–5.5 world px and local Y 0.8–1.3; the occasional third uses the opposite side at 1–3 world px and Y −1.3 to −0.8. The first root stays within ±1 horizontal world px and ±0.5 vertical world px. Existing area spread multiplies these local offsets. Main rotations stay within ±4°, support within ±6°. Local-Y and whole-object world-Y sorting are unchanged.

The shared seed generator uses the V2 species-recipe seed. It reproduces the same new composition for a given flower ID/profile while intentionally replacing the rejected V1 silhouettes. Existing area-based Sparse/Normal/Full assignment is unchanged.

## Preserved system behavior

- HYDRANGEA remains L-class with exactly **16 world px** footprint radius.
- One Journal preview object remains one ground anchor and one collision footprint.
- Base visual multiplier remains 1.00; component worldUnitsPerPixel remains 0.18.
- Existing area thresholds are unchanged: Small <45,000, Medium <90,000, Large ≥90,000 world px².
- Area weights remain 45/45/10%, 25/50/25%, 10/45/45%; spreads 1.00/1.08/1.15; cluster scales 1.00/1.08/1.22.
- June and October Mixed retain **12 Tulip + 12 Chamomile + 6 Hydrangea = 30 total objects**.
- Hydrangea QA still requests 20: June places 11, October 20, with the existing capacity report. No radius or validity changes were made to force extra objects.
- All four existing preset layouts, including IDs, world coordinates, species assignments, radii, and counts, match snapshots captured before replacement exactly.
- Tulip and Chamomile composition output for those layouts matches the pre-replacement snapshots exactly. Their source files, assets, scale and status were not modified.
- Land06 still draws the composed flower layer through the existing `behindTeaSet` slot. Tea Set artwork/placement and the occlusion implementation are unchanged.
- Planting masks/refinements, collision/validity, saved positions, Journal, Support, backend semantics and production Garden files remain unchanged.

Mixed monthly views remain PRIMARY. Hydrangea-only views are QA/stress tests; this pass does not optimize them to fill the land.

## Validation

The extraction check verifies V2-only asset directory contents as well as source pixels/metadata. The replacement test verifies all 25 old paths are absent, all four layouts remain identical, other-species visuals are identical, and protected source/data hashes are unchanged.

All checks passed: TypeScript; Hydrangea extraction, composition (1,350 deterministic recipes), replacement, mixed sandbox, actual preset/render tree; Chamomile composition and mixed presets; all existing Tulip component/area/scale/Garden review regressions; Land06 occlusion; flower visual system (2,220 assertions); density sandbox; planting (158 assertions); mask refinement (57 assertions); flower detail/Support (20 tests). No headless Chrome or screenshot automation was used. Inspection JPGs are asset-only composites/contact sheets, not app screenshots.

Stop for manual review. Hydrangea V2 is not automatically approved.

## New component IDs, paths and anchors

Paths are relative to the Petalpal workspace root.

| ID | Path | Anchor X | Anchor Y |
| --- | --- | --- | --- |
| `head/blue_compact_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/head/blue_compact_v2.png` | 0.482422 | 0.941406 |
| `head/pink_compact_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/head/pink_compact_v2.png` | 0.509766 | 0.955078 |
| `head/lavender_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/head/lavender_side_v2.png` | 0.404297 | 0.935547 |
| `partial/blue_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/partial/blue_side_v2.png` | 0.470703 | 0.955078 |
| `partial/lavender_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/partial/lavender_side_v2.png` | 0.519531 | 0.943359 |
| `partial/lavender_open_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/partial/lavender_open_v2.png` | 0.484375 | 0.957031 |
| `partial/pink_budding_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/partial/pink_budding_v2.png` | 0.468750 | 0.945312 |
| `partial/blue_budding_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/partial/blue_budding_v2.png` | 0.443359 | 0.951172 |
| `bud/cream_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/cream_side_v2.png` | 0.421875 | 0.949219 |
| `bud/cream_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/cream_branch_v2.png` | 0.416016 | 0.939453 |
| `bud/green_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_side_v2.png` | 0.488281 | 0.949219 |
| `bud/green_upright_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_upright_v2.png` | 0.478516 | 0.958984 |
| `bud/green_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_branch_v2.png` | 0.443359 | 0.951172 |
| `bud/cream_upright_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/bud/cream_upright_v2.png` | 0.505859 | 0.951172 |
| `foliage/bud_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/bud_branch_v2.png` | 0.451172 | 0.949219 |
| `foliage/tall_leaf_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/tall_leaf_v2.png` | 0.472656 | 0.947266 |
| `foliage/side_leaves_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/side_leaves_v2.png` | 0.427734 | 0.921875 |
| `foliage/flowering_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/flowering_branch_v2.png` | 0.570312 | 0.931641 |
| `foliage/wide_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/wide_branch_v2.png` | 0.544922 | 0.947266 |
| `foliage/leaning_leaf_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaning_leaf_v2.png` | 0.494141 | 0.939453 |
| `foliage/tall_branch_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/tall_branch_v2.png` | 0.511719 | 0.949219 |
| `foliage/bud_fan_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/foliage/bud_fan_v2.png` | 0.509766 | 0.947266 |
| `asymmetric/blue_pink_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/asymmetric/blue_pink_v2.png` | 0.466797 | 0.925781 |
| `asymmetric/lavender_companion_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/asymmetric/lavender_companion_v2.png` | 0.509766 | 0.939453 |
| `asymmetric/blue_pink_side_v2` | `mobile/assets/garden/flowers/species/hydrangea/components/asymmetric/blue_pink_side_v2.png` | 0.511719 | 0.925781 |

## Exact files changed in this V2 replacement

Modified:

- `mobile/scripts/extractHydrangeaComponents.py`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/componentManifest.json`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/componentImages.ts`
- `mobile/src/components/garden/flower-density-sandbox/hydrangea-components/hydrangeaComposition.ts`
- `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`
- `mobile/test/hydrangeaComposition.test.mjs`
- `docs/flower-visuals/HYDRANGEA_COMPONENT_REVIEW.md`
- `docs/flower-visuals/FLOWER_VISUAL_SYSTEM_DELIVERY.md`

Added:

- `mobile/test/hydrangeaV2Replacement.test.mjs`
- `docs/flower-visuals/HYDRANGEA_V2_COMPONENT_REVIEW.md`
- `output/hydrangea-v1-rejected-assets.json`
- `output/hydrangea-v2-protected-baseline.json`
- `output/hydrangea-v2-placement-baseline.json`
- `output/hydrangea-v2-alpha-inspection.jpg`
- `output/hydrangea-v2-extracted-inspection.jpg`
- `output/hydrangea-v2-edge-inspection.jpg`

Also added: the 25 V2 PNG files listed above.

Removed rejected PNGs:

- `mobile/assets/garden/flowers/species/hydrangea/components/single/blue_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/single/pink_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/single/lavender_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_02.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/small/blue_bud_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/bud/pink_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/bud/green_03.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_upright_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_upper_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/leaf_lower_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_pair_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/pink_lavender_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/lavender_blue_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_bud_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/pink_lavender_02.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/cluster/blue_pink_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_02.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/stem_buds_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_leaves_03.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_02.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/grass_01.png`
- `mobile/assets/garden/flowers/species/hydrangea/components/foliage/ground_bud_03.png`
