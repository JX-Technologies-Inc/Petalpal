# Waterfall V2 preview variant

## Active compact refinement

The active preview now uses `waterfall-v2-compact-r3.png` (887 × 1774 RGBA), byte-identically copied to the runtime waterfall-v2 folder. It renders at 1024 × 2048 design size, x=742.6, y=-656, scale=0.5, rotation=-2.5. The shorter canvas origin compensates for removed upstream length; legacy placements are untouched.

The upstream channel is substantially shorter, with deeper cliff shoulders and richer contact spray. The production shader retains stationary alpha/banks while advecting water detail; independent small ballistic spray uses the same UI-thread clock. Reduced motion/animation OFF holds the complete static art.

`waterfall-v2-complete.png` and the intermediate `waterfall-v2-compact-r2.png` remain available. Pre-refinement component/placement copies are in `output/waterfall-v2/pre-compact`. New preview and provenance records are in `output/waterfall-v2-compact`. The details below document the preserved original V2, not the active compact version.

## Preserved original V2

Complete reference-guided river / cliff / waterfall painting, generated with the built-in image tool. Actual PNG: 724 × 2172, RGBA. No production layer extraction or old waterfall asset edits.

Runtime copy: `mobile/assets/garden/landmarks/waterfall-v2/waterfall-v2-complete.png` (byte-identical).

`WaterfallV2Entity.tsx` displays the entire image uniformly in a 1024 × 3072 design rectangle. Its independent placement is `x=730, y=-1228, scale=0.5, rotation=-2.5`. Rotation uses the canvas center. Existing landmark/land/camera values remain unchanged.

`/garden-test` selects V2 by default. DEV Controls → **Old Waterfall** restores the preserved legacy composition; **Waterfall V2** restores this variant. **Waterfall Flow ON/OFF** controls V2 motion. Legacy calibration buttons explicitly select legacy before editing old placements.

V2 renders above the pond but below land and other landmarks. Legacy WaterfallEntity, upper source, foam and underlay are not simultaneously displayed. Non-preview GardenScene callers retain their legacy default.

Motion uses a UI-thread clock, material/spatial water gating, convergent surface flow and two separately timed descending detail fields with three staggered parcels. Original alpha and bank geometry remain stationary. Reduced motion displays the complete static image; background/inactive routes pause the clock. There are no React per-frame state updates.

Run `node scripts/preview-waterfall-v2.cjs` from mobile for scene/shader QA, then `npx tsc --noEmit`. QA images include actual nearby land/treehouse/pavilion geometry but are not device screenshots. The actual iPhone appearance and performance still need device review. Browser `/garden-test` currently encounters Skia RuntimeEffect SSR initialization failure; iOS Metro bundle compilation succeeds.

Full generation prompts and verification: `output/waterfall-v2/generation-and-integration.json` and `verification.json`.
