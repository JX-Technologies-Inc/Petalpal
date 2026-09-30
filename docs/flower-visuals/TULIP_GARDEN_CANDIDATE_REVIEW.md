# Tulip Garden candidate — ready for manual DEV review

All three assets are **READY_FOR_REVIEW**, not APPROVED. Live production Garden rendering was not integrated or changed. This report supersedes the earlier preparation report's statement that no Tulip candidates exist.

## Extracted files and metadata

All paths are repository-relative. Canvas: **512 × 512 RGBA PNG**. `visualScale: 1.0` for each; sandbox scale multiplier initially 1.0. Ground anchors are visual estimates of the central soil-entry point, awaiting manual review, not automatic image centers.

| Variant | File | anchorX | anchorY | Status |
|---|---|---:|---:|---|
| Sparse | mobile/assets/garden/flowers/species/tulip/base/tulip_garden_sparse.png | 0.443296 | 0.872168 | READY_FOR_REVIEW |
| Normal | mobile/assets/garden/flowers/species/tulip/base/tulip_garden_normal.png | 0.470313 | 0.902662 | READY_FOR_REVIEW |
| Full | mobile/assets/garden/flowers/species/tulip/base/tulip_garden_full.png | 0.523643 | 0.889761 | READY_FOR_REVIEW |

Extraction uses the supplied `Resources/Garden Flowers/Tulip/tulip_garden_abc_candidate.png`, left/center/right. Its bytes remain unchanged. Transparent seams split the clusters; crops preserve all nonzero alpha, including faint source fragments. All three use the same 0.6 raster normalization ratio (with sub-pixel integer rounding) and transparent padding. Uniform downsampling is necessary to fit the existing canvas; output pixels are therefore not claimed to be bit-identical to the larger source. There is no repainting, recoloring, alpha cleanup, sharpening, extra blur, geometry redesign, or botanical-source substitution. Crop coordinates, original ground-point estimates and SHA-256 hashes are recorded in `TULIP_CANDIDATE_EXTRACTION.json`.

## Review entry and controls

Open DEV `/garden-test` → Flower Density Sandbox. It now defaults to October / Land10, Tulip only, 30 requested objects, Garden assets ON, deterministic automatic sparse/normal/full selection, both secondary emotions NONE and all debug overlays OFF. Dedicated October and June buttons reset these review settings.

The Garden-art path loads the actual three PNGs; it does not mount the legacy duplicated cluster renderer. Legacy V1/V2 comparison remains available by explicitly switching back. Base-art mode disables emotion controls and neutralizes the rendering input. Only visualScale is exposed for tuning in the base-art panel; no persisted settings are written.

Sandbox Tulip M-class radius remains **12 world px**. This uses the unchanged existing density model, masks and placement logic. Regression tests compare complete resulting flower records against the pre-existing M-class layout. The runtime production Tulip radius remains **20 world px** in the unchanged production configuration. These are separate authorities; neither was resized to fit the PNG.

- October / Land10: **30/30** placed.
- June / Land06: **24/30** placed under the existing M-class constraints; six remain unplaced. No forced packing or footprint reduction.

Stable identity selects composition. Existing ground coordinates and Y-depth sorting are preserved. No glow, sparkle, tint, pulse, mist or emotional recoloring is enabled.

## Validation

- Garden validator `--sync` and `--check`: three existing PNGs, all three structurally valid, zero build errors; the other 84 slots remain unresolved.
- Each candidate: correct canvas, real alpha, nonempty content, no opaque rectangle, valid paths/anchors/status and current hash-bound Metro bindings.
- `npx tsc --noEmit` from mobile: passed.
- `node ./test/flowerVisualSystem.test.mjs`: 2,220 assertions passed, including rejection of these candidates by production rendering.
- `node ./test/tulipGardenReview.test.mjs`: all three real PNG/binding resolutions, neutral presentation, source hash, stable compositions and exact M-class position/footprint parity passed.
- `node ./test/flowerDensitySandbox.test.mjs`: 12 months × four modes at 30/40 requested, 1,735 full footprints and existing V2 checks passed.
- Python validator regression suite: nine tests passed.

No headless Chrome or screenshot automation was used. Extraction PNGs were inspected directly; in-app visual approval remains manual.

## Exact files changed in this import

Created:

```text
mobile/assets/garden/flowers/species/tulip/base/tulip_garden_sparse.png
mobile/assets/garden/flowers/species/tulip/base/tulip_garden_normal.png
mobile/assets/garden/flowers/species/tulip/base/tulip_garden_full.png
mobile/scripts/extractTulipGardenCandidate.py
mobile/src/components/garden/flower-density-sandbox/tulipReviewPreset.ts
mobile/test/tulipGardenReview.test.mjs
docs/flower-visuals/TULIP_CANDIDATE_EXTRACTION.json
docs/flower-visuals/TULIP_GARDEN_CANDIDATE_REVIEW.md
```

Modified:

```text
mobile/src/components/garden/flower-visuals/gardenArtManifest.json
mobile/src/components/garden/flower-visuals/gardenArtBindings.generated.ts
mobile/src/components/garden/flower-visuals/FlowerEmotionPreview.tsx
mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx
mobile/test/flowerVisualSystem.test.mjs
```

STOP for manual review. No candidate is approved and no other species has been generated.
