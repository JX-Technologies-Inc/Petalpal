# Tulip V3 cluster visual scale — manual review

June / Land06 V3 is visually accepted as-is by the user. Tulip's asset approval status remains READY_FOR_REVIEW; this pass does not promote it to APPROVED or integrate it into production.

## Separate rendering multiplier

| Approved-mask area profile | Cluster Visual Scale |
|---|---:|
| SMALL | 1.00 |
| MEDIUM | 1.08 |
| LARGE | 1.22 |

The existing thresholds/classification are unchanged: June is Small and October is Large. The multiplier applies to the complete composed visual group around its existing ground origin. It combines with the existing temporary visual-scale control; at the default baseline of 1.00, the effective values are exactly those above. V2 and old fixed-prefab modes do not use this area multiplier.

Scale is held in separate DEV state and never passed to the composition generator or placement model. It is not a seed input. Changing it does not rerun the composition memo. Sparse/Normal/Full assignments, selected components, local offsets/internal spread, individual component scales, rotations, color families, weights and density rules remain unchanged. Scaling the finished group increases their rendered coverage together; it does not edit the internal composition data.

The world translation encloses the scaled visual group, so the local ground origin still maps to exactly the same worldX/worldY. The footprint circle and anchor marker are siblings outside that scaled group. Footprint radius remains **12 world px**. No mask, placement, collision, count, persistence, Journal, Support, backend or emotion change was made. Artwork bytes and component anchor metadata remain untouched.

## DEV controls and comparison

V3 now exposes **Cluster Visual Scale** for the currently selected Small/Medium/Large profile (temporary range 0.80–1.50). Editing Large does not change Small or Medium. A separate Reset cluster visual scales button restores 1.00 / 1.08 / 1.22 without changing weights or spread. Values are not persisted.

**Large Scale 1.00** and **Large Scale 1.22** both select October / Land10 / 30 / V3, restore automatic density and the same baseline visual multiplier, and use identical positions/compositions/component selections. Between those two comparison states, only the Large cluster visual scale differs. Existing profile weight/spread tuning is retained, and June's scale is untouched.

June at Small 1.00 preserves the prior V3 transform tree and all component geometry exactly. October should receive more visual coverage while preserving its existing open spaces; in-app coverage remains for manual review, not an automated claim that the final balance is approved.

## Verification

The new `tulipClusterVisualScale.test.mjs` executes the actual DEV renderer using mocked Skia primitives. It verifies:

- June's previous/new render trees are identical at 1.00, including compositions, transforms and scale behavior.
- October remains exactly 30 objects at 1.22.
- A/B trees have identical world translations and component inputs; only the visual-group scale and debug stroke compensation differ.
- The radius-12 footprint and ground marker remain unscaled.
- Composition data is not mutated, reload results remain deterministic, and existing V3 weights/spread are unchanged.

No headless Chrome, screenshots, image regeneration or runtime recoloring was used. This verifies render inputs/geometry equivalence rather than claiming a captured raster comparison.

Passed: `npx tsc --noEmit`, the new renderer-scale test, V3 area-profile tests (3,600 identities), V2 component tests (1,200 identities plus explicit density cases), fixed-Tulip/A-B tests, Flower Visual System (2,220 assertions), and sandbox regression (1,735 full footprints across all twelve months and four modes, plus grouping checks). Extraction verification passed for all 28 component PNGs/anchors; all 49 protected production/source files retain their hashes.

## Files changed

- Modified: `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`.
- Created: `mobile/src/components/garden/flower-density-sandbox/tulip-components/clusterVisualScale.ts`.
- Created: `mobile/test/tulipClusterVisualScale.test.mjs`.
- Created: `docs/flower-visuals/TULIP_CLUSTER_VISUAL_SCALE_REVIEW.md`.

STOP for manual review. No automatic Tulip approval.
