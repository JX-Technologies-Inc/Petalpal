> Current status: [Monthly Garden Growth V1.1 is APPROVED](MONTHLY_GARDEN_GROWTH_V1_1_APPROVED.md) as the initial production visual direction. Mixed V1, Mixed V2 and Monthly Growth V1 are **LEGACY DEV / QA**, retained unchanged. All currently valid batch components are preserved. Source validity/extraction history below is unchanged; this approval does not admit invalid or missing artwork.

> Manual review update: Mixed V1 monthly composition is REJECTED for insufficient visual mass/grouping. Artwork is retained. Mixed Composition V2 is implemented for DEV A/B review; see [current review report](MIXED_COMPOSITION_V2_REVIEW.md). The batch implementation report below is historical.

# Batch Garden integration — manual review pending

**Hydrangea V2: APPROVED_L_CLASS_REFERENCE.** Its existing 25 source components, recipes, color variation, scales, radius 16, deterministic placement/composition and area behavior are frozen. Chamomile remains APPROVED_S_CLASS_REFERENCE (radius 9); Tulip V3 remains the authoritative M reference (radius 12). The reference, planting, Tea Set, production Garden and backend file hashes match the batch-start baseline.

**Batch: READY_FOR_REVIEW.** 20 newly integrated species / 59 components; 23 available species including the three references. All work is confined to DEV review. No batch approval, emotion variants or production integration.

## Source audit

All 8 actual PNG source files were freshly decoded and visually inspected over gray before extraction. The two UUID atlases have readable species labels; identities were mapped from those labels. Detailed per-file and per-species metrics are in [BATCH_SOURCE_AUDIT.json](BATCH_SOURCE_AUDIT.json). VALIDATED describes the pre-extraction audit; final outcome lists are in [BATCH_INTEGRATION_STATUS.json](BATCH_INTEGRATION_STATUS.json).

| Discovered source under Resources/Garden Flowers | Dimensions | Mode | Alpha min–max | Fully transparent pixels | Outcome |
|---|---|---|---|---|---|
| 121213a0-fabc-42af-9580-3f7383f17583.png | 1536 × 1024 | RGBA | 0–253 | 323,860 | SUCCESSFUL |
| 59ec5368-7656-4110-9742-d3b36213429e.png | 1536 × 1024 | RGBA | 0–253 | 231,962 | SUCCESSFUL |
| Chamomile/chamomile_garden_abc_candidate.png | 1536 × 1024 | RGBA | 0–253 | 806,802 | PROTECTED_REFERENCE |
| Coreopsis/coreopsis.png | 1536 × 1024 | RGBA | 0–254 | 640,631 | SUCCESSFUL |
| Hydrangea/hydrangea_garden_abc_candidate.png | 1536 × 1024 | RGBA | 0–254 | 462,120 | PROTECTED_REFERENCE |
| Rose/rose_garden_abc_candidate.png | 1536 × 1024 | RGB | 255–255 | 0 | SKIPPED_INVALID_SOURCE |
| Tulip/tulip_garden_abc_candidate.png | 2172 × 724 | RGBA | 0–255 | 921,652 | PROTECTED_REFERENCE |
| Tulip/tulip_garden_component_sheet_v2.png | 1536 × 1024 | RGBA | 0–254 | 654,976 | PROTECTED_REFERENCE |

**SKIPPED_INVALID_SOURCE:** ROSE — RGB with an opaque baked checkerboard, decoded alpha 255 everywhere. No destructive background removal attempted.

**MISSING_SOURCE:** TUMI, WHITE_MAGNOLIA, BLUE_ROSE, LOTUS, CHERRY_BLOSSOM. No raw botanical fallback or unresolved emotion/species mapping was invented.

**PROTECTED_REFERENCE:** CHAMOMILE, TULIP, HYDRANGEA. No reference extraction was rebuilt.

## Successful species / starting scales

Source keys:

- **A**: `Resources/Garden Flowers/59ec5368-7656-4110-9742-d3b36213429e.png`
- **B**: `Resources/Garden Flowers/121213a0-fabc-42af-9580-3f7383f17583.png`
- **C**: `Resources/Garden Flowers/Coreopsis/coreopsis.png`

| Species | Class / radius | Components | Source | Base scale | World px / source px | Sparse / Normal / Full pieces |
|---|---|---|---|---|---|---|
| COREOPSIS | S / 9 | 3 | C | 1.00 | 0.100 | 1 / 1 / 2 |
| DAISY | S / 9 | 3 | A | 1.00 | 0.120 | 1 / 2 / 3 |
| GERBERA_DAISY | M / 12 | 3 | A | 1.00 | 0.150 | 1 / 2 / 3 |
| SUNFLOWER | L / 16 | 3 | A | 1.00 | 0.180 | 1 / 1 / 2 |
| ANEMONE | M / 12 | 3 | A | 1.00 | 0.150 | 1 / 2 / 3 |
| BLUEBELL | S / 9 | 3 | A | 1.00 | 0.120 | 1 / 2 / 3 |
| HEATHER | S / 9 | 3 | A | 1.00 | 0.120 | 1 / 2 / 3 |
| SNOWDROP | S / 9 | 3 | A | 1.00 | 0.120 | 1 / 2 / 3 |
| GENTIAN | M / 12 | 3 | A | 1.00 | 0.150 | 1 / 2 / 3 |
| PETUNIA | M / 12 | 3 | A | 1.00 | 0.150 | 1 / 2 / 3 |
| POPPY | M / 12 | 3 | B | 1.00 | 0.150 | 1 / 2 / 3 |
| BIRD_OF_PARADISE | L / 16 | 2 | B | 1.00 | 0.160 | 1 / 1 / 2 |
| WHITE_ROSE | M / 12 | 3 | B | 1.00 | 0.150 | 1 / 2 / 3 |
| YELLOW_DAFFODIL | M / 12 | 3 | B | 1.00 | 0.150 | 1 / 2 / 3 |
| ASTER | S / 9 | 3 | B | 1.00 | 0.120 | 1 / 2 / 3 |
| DANDELION | S / 9 | 3 | B | 1.00 | 0.120 | 1 / 2 / 3 |
| YELLOW_RAPESEED_FLOWER | S / 9 | 3 | B | 1.00 | 0.120 | 1 / 2 / 3 |
| CHINESE_VIOLET_CRESS | S / 9 | 3 | B | 1.00 | 0.120 | 1 / 2 / 3 |
| LAVENDER | S / 9 | 3 | B | 1.00 | 0.120 | 1 / 2 / 3 |
| OLIVE | M / 12 | 3 | B | 0.90 | 0.130 | 1 / 1 / 2 |

Olive uses M / radius 12 because the existing Sandbox packer requires an S/M/L class. It is a modest foliage/fruiting branch form (base scale 0.90), not a flowering bush or a new backend semantic mapping.

## Components and composition

Component IDs and exact PNG paths, source rectangles, hashes and logical soil points are recorded in `mobile/src/components/garden/flower-density-sandbox/batch-components/componentManifest.json`. Categories used: single, bud, partial, foliage, sparse and branch. The 59 pieces preserve source pixels and natural colors. No giant bottom-row prefab, label, border, old botanical fallback or duplicate asset was registered to inflate variety.

Batch alpha connectivity uses support alpha ≥32, followed by a three-pixel original-RGBA fringe. It never thresholds the output alpha or keys RGB/green. Safe ROI boundaries exclude neighboring artwork; any visible crop edge fails extraction. The final 59 pieces have clear edges and retain original RGBA wherever visible. The source alpha inspection, contact-sheet review and byte-for-byte regeneration tests passed.

Anchors are normalized fractions of a transparent 512×512 canvas, computed from explicitly inspected stem/soil-base points plus crop padding. They are not image centers. Every cluster has one world anchor and one footprint. Heads/buds and foliage do not become extra Journal objects.

Sparse/Normal/Full use the per-species piece counts above. At least one rooted main is present; companion slots have a seeded 28% chance to use an available bud/foliage piece. Fresh pieces are preferred before repeating a component. Dandelion favors yellow blooms and occasionally uses its seed head. Lavender, Heather, Snowdrop and Daffodil keep narrow upright grouping and a ±3° rotation limit; other batch forms use ±6°. Coreopsis, Sunflower, Bird of Paradise and Olive use lighter 1/1/2 recipes.

Per-piece visual scale is 0.87 (Sparse), 0.95 (Normal), or 1.00 (Full), multiplied by seeded 0.94–1.06 variation. These are visual-only values. The species base scale and existing complete-cluster area scale apply independently of the collision footprint. Protected reference recipes do not use these batch rules.

Existing area profiles are reused unchanged: Small 45/45/10%, spread 1.00, cluster scale 1.00; Medium 25/50/25%, spread 1.08, scale 1.08; Large 10/45/45%, spread 1.15, scale 1.22. Thresholds remain 45,000 and 90,000 approved-mask world px².

## Primary manual review

The Sandbox now opens in **ALL AVAILABLE SPECIES — MIXED**. Use June / Land06 / 30, October / Land10 / 30, and April / Land04 / 30 (Medium). All three place exactly 30 TOTAL objects with valid whole footprints and no collisions.

Mix balance: 18 S / 9 M / 3 L. L draws are without replacement, giving one each of Hydrangea, Sunflower and Bird of Paradise as distinct accents. Within S/M, weighted seeded selection favors Chamomile/Tulip (2), Coreopsis/Daisy (1.5), ordinary species (1), and Olive (0.5). This permits repeats and omissions rather than equal per-species distribution. Species, compositions, local offsets, scales, rotations and world positions reproduce across reloads.

| Preset | Area | Objects | Distinct species | S / M / L |
|---|---|---|---|---|
| June / Land06 | SMALL | 30 | 20 | 18 / 9 / 3 |
| October / Land10 | LARGE | 30 | 19 | 18 / 9 / 3 |
| April / Land04 | MEDIUM | 30 | 16 | 18 / 9 / 3 |

Exact per-species counts are in BATCH_INTEGRATION_STATUS.json. Existing two-/three-species and single-species QA controls remain available. Single-species stress views are not tuned to fill the land. Both secondary emotions remain NONE; no tint, animation or effects.

**Land06 occlusion verified:** all new species use the existing shared component layer inside SandboxGardenBackdrop. Ground → planted flowers → Tea Set foreground. The Tea Set artwork, placement and shared occlusion implementation were unchanged; runtime tree tests verify this order and unchanged anchors.

## Validation

All 21 checks passed: `npx tsc --noEmit`, the 17 Node test files below, and 3 Python extraction tests. No headless Chrome or screenshot automation was run. Asset contact sheets are source-pixel inspections, not application screenshots.

- `node ./test/plantingSystem.test.mjs` — PASS
- `node ./test/plantingMaskRefinement.test.mjs` — PASS
- `node ./test/flowerVisualSystem.test.mjs` — PASS
- `node ./test/flowerDensitySandbox.test.mjs` — PASS
- `node ./test/tulipClusterVisualScale.test.mjs` — PASS
- `node ./test/tulipAreaProfiles.test.mjs` — PASS
- `node ./test/tulipComponentComposition.test.mjs` — PASS
- `node ./test/tulipGardenReview.test.mjs` — PASS
- `node ./test/chamomileComposition.test.mjs` — PASS
- `node ./test/mixedSpeciesSandbox.test.mjs` — PASS
- `node ./test/hydrangeaComposition.test.mjs` — PASS
- `node ./test/hydrangeaV2Replacement.test.mjs` — PASS
- `node ./test/hydrangeaMixedSandbox.test.mjs` — PASS
- `node ./test/flowerDetail.test.mjs` — PASS
- `node ./test/batchFlowerIntegration.test.mjs` — PASS
- `node ./test/speciesSandboxRendering.test.mjs` — PASS
- `node ./test/flowerOcclusion.test.mjs` — PASS
- `python ./test/batchFlowerExtraction.test.py` — PASS
- `python ./test/chamomileExtraction.test.py` — PASS
- `python ./test/hydrangeaExtraction.test.py` — PASS

Batch coverage includes 3,600 deterministic compositions, unique IDs and valid explicit anchors, genuine alpha, unreadable/opaque/unreviewed input rejection, invalid-species failure isolation, exact original-pixel regeneration, no stale assets, fixed 9/12/16 radii, immutable protected files, all three valid Mixed 30 layouts, deterministic reloads, no storage access, neutral rendering, actual preset controls, and Tea Set draw order.

## Exact changed files

[BATCH_CHANGED_FILES.json](BATCH_CHANGED_FILES.json) lists every source, PNG, documentation and test file added/edited for this task, separately from QA artifacts. It excludes unrelated changes that were already in the workspace. Source artwork files were read only.

**Stopped for manual visual review. Batch species are not approved automatically.**
