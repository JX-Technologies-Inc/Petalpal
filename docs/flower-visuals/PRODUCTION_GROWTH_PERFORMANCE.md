# Production Growth V1.1 performance checkpoint

The user-approved visual baseline is **PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED**. It was captured before runtime optimization in `output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/`: 863 archived files, a per-file SHA-256 manifest, exact production references for cold/unchanged/move/Cancel/add, checksums and a standalone verifier. The older 836-file DEV checkpoint is retained. Neither checkpoint was edited during optimization.

This work changes computation and caching only. No artwork, composition weights, scales, maturity targets, density, counts, parent anchors, collision, saved data, Journal, Support, emotion effects or Tea Set ordering changed. The QA panel now records the manual approval.

## Measured generation

Desktop Node v24.11.0, same TypeScript module harness and inputs before/after, with CPU profiling enabled. These are generation timings after module loading, not application startup, image decode/upload or GPU frame timings. QA fixture packing is outside the timer. The add case starts from a separate runtime with only 29 parents cached, so it cannot reuse a previously generated 30-parent result. Values are single comparable profile runs, not device guarantees.

| Case | Before | After |
| --- | ---: | ---: |
| Cold 30 | 13,270.92 ms | 513.97 ms |
| Identical 30 | 0.102 ms | 0.079 ms |
| Move one parent | 10,722.97 ms | 178.65 ms |
| Cancel | 0.264 ms | 0.220 ms |
| Add 29 → 30 | 9,979.45 ms | 463.14 ms |

Cold generation improved about 25.8×; move about 60.0×; addition about 21.5×. Cold and movement targets are met on this desktop. Addition is below 500 ms with limited headroom; it is not a guarantee of “well under 500 ms” on other devices. Cached reconstruction was already fast and retains its stable reference behavior.

The separate exact-equivalence regression run measured cold 566.80 ms, unchanged 0.195 ms, move 186.59 ms and addition 476.67 ms. This confirms the same order of improvement while showing normal run-to-run variation.

### Profile breakdown

| Cold-generation stage | Before | After |
| --- | ---: | ---: |
| Base monthly field | 3,463.55 ms | 160.02 ms |
| Layered-bed composition | 9,542.39 ms | 325.63 ms |
| Production binding/origin fitting | 259.00 ms | 22.77 ms |
| Mask sampling, nested in base field | 3,120.36 ms | 0.029 ms |
| 280 coverage accumulations, nested across stages | 9,162.86 ms | 296.81 ms |
| Primary species composition, nested in base field | 3.40 ms | 2.54 ms |

Nested rows overlap and must not be added to the top-level stages. CPU samples identified repeated alpha transforms, component lookups, dense coverage scans, mask polygon/segment work and repeated depth/pocket scoring. PNG analysis/decoding was not occurring in generation: it already uses the checked-in alpha atlas. Species recipe construction was only a few milliseconds, so it did not warrant another independent recipe cache. The existing semantic whole-field cache already retains deterministic recipe output.

Raw timings, nested stages and CPU profiles are in `output/production-growth-performance/before.json`, `after.json`, `before.cpuprofile` and `after.cpuprofile`.

## Implementation

- Precompute the exact existing twelve approved-mask sample domains and region metadata, including their original sample order and path strings. Runtime reads `growthStaticData.json`. `buildGrowthStaticData.mjs --check` independently regenerates all twelve using the original sampler. Geometry source hashes fail validation if the static data becomes stale. No planting validator consumes the new cache.
- Cache component alpha metadata, logical anchors and per-piece transforms. A uniform 32-world-pixel grid finds the relevant sample indices. Sparse alpha rasters retain double precision until the original Float32 accumulation, with the same operation order and saturation threshold. The transform cache is bounded to 2,048 entries per live sample domain; object-specific entries use weak references. Queries are clamped to the sample grid even for extreme visual scales.
- Cache static bed depth, filler pockets, focal candidates and seeded candidate ranks. Reuse sorted parent neighbors within a generation and avoid evaluating the winning candidate's score again on every comparison. Deterministic order and tie-breaking remain intact.
- Reuse approved-origin fitting results by month, position and sample domain, bounded to 4,096 entries per domain. Position changes invalidate the relevant lookup. Scale and rotation still invalidate transformed alpha sampling.
- Keep the existing bounded 32-field production cache keyed by actual parent semantic inputs. A no-change call and repeated depth passes reuse the same field. Moves/additions still rerun the shared field coordinator because stage, spacing, neighboring roots and sequential coverage balancing depend on the roster. Unchanged static fields and alpha rasters are reused; unrelated expensive sampling does not restart from zero. It would be incorrect to freeze all unrelated filler after a parent change.
- Memoize production draw order and unique asset requests on the growth reference. No sorting or asset deduplication runs again just because an image finishes loading. Drawing order, image quality and Land06 occlusion are unchanged.

All caches are process-local and derived. No child pieces or rendering-origin metadata are persisted. Cached static configuration is immutable for the module lifetime; a new build/reload invalidates configuration caches. Future geometry changes must regenerate/check static data.

## Exact visual gate

The entire generated result is deep-compared with the frozen pre-optimization reference for cold generation, a move, addition and reload. Cancel returns the original cached field. An independent copy of the original alpha arithmetic verifies every Float32 sample cell under reversed piece order, transformed pieces, mutated transforms and different sample domains.

Locked Production 30 metrics remain:

- 30 parent identities and anchors; **591 pieces = 57 Primary + 360 Companion + 174 Filler**.
- Botanical alpha coverage **74.8152634766808%**; visible alpha area **23,951.525727290875 world px²**.
- **6/6** occupied sectors; **0** outside child origins.
- Low/mid/tall and per-species shares, child identities, component choices, all scales/rotations and coordinates exactly equal.
- Piece SHA-256: `54a70db005ac5476b0ebd0c859a311bfca542858a5d7f85db499b4817cc7bdeb`.

The original-PNG alpha regression is separate from the runtime atlas estimate; it preserves its own existing measurements and tolerance. Visual class metadata remains S/M/L = 9/12/16; production collision remains Tulip/Lavender = 20, Sunflower = 24, Lotus/Cherry Blossom/default = 22. No collision migration occurred.

## Validation and rendering scope

**37/37 checks passed:** 30 Node regression suites, TypeScript (`tsc --noEmit`), one backend invocation containing 19 passing tests, three original-PNG alpha checks and two archive integrity verifiers (836 DEV files / 863 production files). Full results are recorded by actual child-process execution in `output/production-growth-integration-checks/verified-results.json` and its per-check logs. This covers planting/masks/collision, visual species and composition, monthly growth, production movement/persistence/occlusion/rendering, Journal/Support and cache equivalence. Live protection also checked 685 DEV and 697 production source/art/data paths against their original or explicitly authorized performance hashes.

The all-twelve static-data regeneration check passed separately. Render-cache tests verify identical draw order, asset requests, move invalidation and Cancel behavior. `output/production-growth-performance/render-preparation.json` measures JavaScript element/array preparation using hook/Skia stubs: **0.284 ms without memoization → 0.067 ms with memoization**, averaged over 500 unchanged 591-piece preparations. It does **not** measure React reconciliation, PNG decode/upload, GPU draw time or native frame rate. No browser, headless Chrome or screenshot automation ran.

## Files changed in this performance task

Runtime changes:

- `mobile/src/components/garden/flower-density-sandbox/allSpeciesReviewModel.ts`
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthCoverage.ts`
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/layeredBedModel.ts`
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/monthlyGrowthModel.ts`
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthStatic.ts` (new)
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthStaticData.json` (new)
- `mobile/src/components/garden/planting/landAwareGrowth.ts`
- `mobile/src/components/garden/planting/ProductionGrowthLayer.tsx`
- `mobile/src/components/garden/planting/ProductionGrowthQA.tsx` (approval text only)

Scripts/tests:

- `mobile/scripts/buildGrowthStaticData.mjs` (new)
- `mobile/scripts/profileProductionGrowth.mjs` (new)
- `mobile/test/assertFlowerBaseline.mjs`
- `mobile/test/productionGrowthProtection.test.mjs`
- `mobile/test/productionGrowthPerformance.test.mjs` (new)
- `mobile/test/growthCoverageCache.test.mjs` (new)
- `mobile/test/growthStaticData.test.mjs` (new)
- `mobile/test/productionGrowthRenderCache.test.mjs` (new)
- `output/production-growth-integration-checks/run-checks.mjs`

Documentation/checkpoint/evidence:

- `docs/flower-visuals/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED.md` (new)
- `docs/flower-visuals/PRODUCTION_GROWTH_LAND_AWARE_CORRECTION.md` (approval status)
- `docs/flower-visuals/PRODUCTION_GROWTH_PERFORMANCE_HASHES.json` (new; exact authorized source hashes, historical manifests untouched)
- `docs/flower-visuals/PRODUCTION_GROWTH_PERFORMANCE.md` (this report)
- New `output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/`: `snapshot.zip`, `manifest.json`, `reference.json`, `checksums.json`, `verify_checkpoint.py`, `README.md`.
- New `output/production-growth-performance/`: `create_checkpoint.py`, `before.json`, `before.cpuprofile`, `after.json`, `after.cpuprofile`, `equivalence-and-timing.json`, `render-preparation.json`.
- Refreshed `output/production-growth-integration-checks/verified-results.json` and per-check `*-verified.log` files.

## Remaining limits

The 1.22 MB static JSON trades module-load/bundle memory for generation speed; app startup and mobile memory pressure have not been measured. Raster caches are bounded per domain, while weak object entries live as long as their referenced cached fields. Several simultaneously visited months can use more memory than June alone. Shared-bed balancing still dominates a rebuild and must remain sequential to preserve exact coverage decisions. Native/GPU performance and real-device Adjust interaction remain manual QA work; this task stops without any further composition, collision-capacity or emotion changes.
