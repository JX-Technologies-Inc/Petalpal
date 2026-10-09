# Growth V1.1 production integration — awaiting manual verification

**Historical integration report — spatial adaptation REJECTED in manual QA.** The architecture remains in use, but the synthetic-reference local-offset adaptation described below has been replaced. See [the land-aware correction](PRODUCTION_GROWTH_LAND_AWARE_CORRECTION.md) for current generation, movement semantics, quantitative comparison and review status. Earlier automated passes did not establish visual equivalence.

Implemented 2026-09-29 against `MONTHLY_GARDEN_GROWTH_V1_1_APPROVED`. The approved visual direction and its archive remain unchanged. This integration is enabled in DEV through `USE_MONTHLY_GARDEN_GROWTH_V1_1 = __DEV__`; release rollout awaits manual verification. The existing Garden **DEV Controls → Planting DEV → Growth V1.1 ON/OFF** toggle compares the new runtime against the retained legacy renderer without changing saved records. No emotion effects or new artwork were added.

## A. Real-parent anchoring and runtime path

`PlantingProvider` / existing placement persistence → `GardenScene` → `PlantedFlowerLayer` feature switch → `ProductionPlantedFlowers` → `productionGrowth` → `ProductionGrowthLayer`.

The adapter consumes the existing real `FlowerPlacementRecord` objects. Their IDs, flowerId, journalEntryId, owner, date, month, landId, species, saved worldX/worldY, scale and rotation remain authoritative. Extra semantic fields on supplied records remain untouched. Neutral rendering does not interpret secondary emotions or infer unresolved Primary Bloom mappings.

The user explicitly selected deterministic local recipes, with no persisted rendering metadata. A seeded intermediate reference frame derives from the real parent IDs / flower IDs / owner / month / species and the unchanged approved region. The existing composition engine compiles this frame into **parent-relative offsets**. Only these derived local recipes are cached in memory. Real anchors are never replaced by those reference coordinates; no planting solver or DEV mock-parent generator is called by the runtime adapter.

Every child is reconstructed as current parent anchor plus its local offset, with the parent's existing scale and rotation applied. Moving one parent translates its whole field by the same dx/dy. Adjust preview substitutes that parent's coordinates only in the render input. Cancel discards the preview; Confirm uses the unchanged validator and persistence path. A fresh runtime recreates the same confirmed field without an original-anchor field, localStorage sidecar, or child persistence.

The pure conversion helper also reconstructs the exact approved June fixture from its original anchors; the approved 591-piece fingerprint remains unchanged. As authorized, arbitrary real records use identity-based local recipes and preserve the visual direction rather than guaranteeing the old absolute June layout. Coverage/density settings and stage budgets are unchanged; overlap and total filler count can vary with real identities, species and positions. Reference-frame coverage diagnostics are not presented as measured current-world coverage.

Each month counts only its own real planted parents. Stages remain 1–5 New Garden, 6–10 Early Growth, 11–15 Established, 16–20 Lush, 21–25 Mature and 26–30 Full Month. Unknown-art parents still count toward maturity but do not create substitute plants. The approved layered-bed specialization remains June with 30 renderable parents; other months/counts retain the existing stage implementation. No new monthly art direction was invented.

Children stay non-independent: no Journal entries, Support counts, collisions or persisted records. Primary artwork alpha and the real parent's production ground footprint resolve taps to that original parent record and its existing Flower Detail. Companions/filler have no separate hit targets. Existing owner Adjust, Journal lookup and Support APIs are unchanged.

## B. Production planting collision — preserved

| Existing definition | Radius, world px |
|---|---:|
| Tulip | 20 |
| Sunflower | 24 |
| Lavender | 20 |
| Lotus | 22 |
| Cherry Blossom | 22 |
| Default / other species | 22 |

`flowerFootprintConfig.ts`, validators, persistence, PlantingContext, masks and saved coordinates are unchanged by this integration. Overlap rejection and Adjust's self-exclusion use these existing values. Existing name resolution is preserved.

**TODO after manual integration verification:** conduct a dedicated production collision-footprint review. Decide explicitly whether/how production occupancy should ever align with visual-class metadata, including capacity, saved placements and migration implications. This task makes no such migration. A 30-record visual QA fixture does not establish that 30 current production footprints fit every small region.

## C. DEV visual footprint metadata — separate

S / M / L = **9 / 12 / 16 world px** remains composition/reference metadata only. It does not replace production collision radii. Chamomile S, Tulip M, Hydrangea V2 L, area profiles, artwork, component scales and approved visual rules remain unchanged.

## Rendering, fallback and performance limits

- Land06 uses the existing slot immediately before the Tea Set: ground → all primary/companion/filler visuals, including previews → Tea Set. Tea artwork and transforms are unchanged. The Final Mask validates the real ground footprint and does not clip botanical pixels.
- Existing Treehouse, Swing, Moon Bed, Garden Arch and Pavilion groups do not expose equivalent split flower/foreground slots. Their current production draw order is retained; precise partial flower occlusion by their individual foreground parts remains unresolved. No landmark artwork or layering redesign was made.
- Missing Garden art: `ROSE` has a rejected opaque source; `TUMI`, `WHITE_MAGNOLIA`, `BLUE_ROSE`, `LOTUS`, `CHERRY_BLOSSOM` lack usable components. Existing sample Journal/placement codes `OCTOBER_BELL`, `FEBRUARY_TULIP`, `ORANGE_TULIP`, `PURPLE_BELL`, `PINK_LILY` also lack explicit registry mappings. They are not silently aliased to another species. Unknown records show DEV anchor markers plus a diagnostic list; the release-capable new renderer omits their artwork. Their parent detail remains available at the anchor. No live user-storage inventory was performed.
- Recipes and positioned fields have bounded 32-entry caches. Geometry is not regenerated per animation frame; decoded images are requested once per unique component per layer. Moving a parent reuses its recipe.
- In the final Node test harness run, one 30-parent identity set produced 669 pieces (the locked DEV June fixture remains 591). First compilation took about **4.45 s**, cached lookup about **0.11 ms**, and moved-field reconstruction about **0.87 ms**. These are not device frame-rate measurements. Cold generation is synchronous and can stall startup or count/species changes; multi-month cold cost and GPU texture/draw cost need manual device review. No quality reduction was used to hide that concern.

## D. Exact implementation/test/documentation files changed

Paths below are relative to the repository root. Existing unrelated workspace changes are not part of this integration.

Modified implementation:

- `mobile/src/components/garden/GardenScene.tsx`
- `mobile/src/components/garden/planting/PlantedFlowerLayer.tsx`
- `mobile/src/components/garden/flower-density-sandbox/monthly-growth/monthlyGrowthModel.ts` — optional real parent count; default DEV results unchanged.
- `mobile/src/app/garden-test.tsx`

Added implementation:

- `mobile/src/components/garden/planting/parentRelativeGrowth.ts`
- `mobile/src/components/garden/planting/productionGrowth.ts`
- `mobile/src/components/garden/planting/ProductionGrowthLayer.tsx`
- `mobile/src/components/garden/planting/ProductionPlantedFlowers.tsx`
- `mobile/src/components/garden/planting/ProductionGrowthQA.tsx`

Added tests/helper:

- `mobile/test/parentRelativeGrowth.test.mjs`
- `mobile/test/productionGrowth.test.mjs`
- `mobile/test/productionGrowthFlow.test.mjs`
- `mobile/test/productionGrowthRendering.test.mjs`
- `mobile/test/productionGrowthProtection.test.mjs`
- `mobile/test/assertFlowerBaseline.mjs`

Updated tests:

- `mobile/test/flowerOcclusion.test.mjs` — retain direct legacy checks beside the new production rendering checks.
- `mobile/test/monthlyGardenGrowth.test.mjs`
- `mobile/test/mixedCompositionV2.test.mjs`
- `mobile/test/batchFlowerIntegration.test.mjs`
- `mobile/test/hydrangeaMixedSandbox.test.mjs`
- `mobile/test/hydrangeaV2Replacement.test.mjs`

The last five tests use explicit integration hashes for the four modified implementation files. Historical baseline manifests and checkpoint hashes were not rewritten; every other protected file retains its old expectation.

Added documentation: this file and `docs/flower-visuals/PRODUCTION_GROWTH_INTEGRATION_HASHES.json`. Added verification runner: `output/production-growth-integration-checks/run-checks.mjs`; it executes every check and captures its actual exit status in `verified-results.json` with adjacent logs. Initial run logs are retained separately. Existing deterministic count/geometry reports are regenerated by their regression suites; comparison to the archive confirms those approved data files are unchanged.

## E. Automated verification

**All 30 final checks passed:** 25 Node suites (20 existing suites plus five anchoring/integration/protection suites), TypeScript, 19 backend Journal/Support tests across three files, two full-resolution alpha comparisons, and archive integrity. `npx tsc --noEmit` also passed directly; the final runner invokes the same installed TypeScript compiler. Exact executed commands, exit codes and logs are recorded automatically in `output/production-growth-integration-checks/verified-results.json`.

An earlier in-flight monthly run loaded an integration hash before the last DEV diagnostic edit and failed that hash check. Its rerun and the entire final verification run passed; initial logs remain available. Verification covers planting/mask/composition/Growth/occlusion/detail behavior, real-parent flow and rendering, unchanged protected assets/configuration, and backend persistence. The flow harness exercises the real provider, production validator and persistence implementation with isolated in-memory storage; it does not claim a browser/device visual approval.

The archive verifier confirms all **836 checkpoint files** remain intact. The integration protection test confirms **685 source/art/data files** match that checkpoint, excluding only the four named implementation integration files. The June V1.1 piece fingerprint is still `347f5a41794341e6032d88db308928a76e2e0b7e893010e776cbce2f2cec0f5c`.

## F. Remaining manual QA

1. Open the existing DEV Garden and keep **Growth V1.1 ON**. From Journal, use a record with registered art (the existing June Sunflower is suitable). Choose a valid same-month position, inspect preview, Confirm, then reload. Check the same parent and field remain.
2. Tap the primary bloom or its ground anchor. Verify the existing detail, Journal memory and parent Support identity. As owner, preview Adjust movement: all its growth should move once, with no field left at the original anchor. Cancel and verify the original field returns.
3. Adjust again, try an invalid/outside/overlapping position, then confirm a valid position. Reload and check the confirmed field and original identifiers. Confirm ordinary overlap rejection remains unchanged.
4. On Land06 inspect plant overlap with the Tea Set: all botanical pieces should remain behind table/chairs/tea objects. At planting edges, artwork may extend beyond the Final Mask. Inspect other landmark limitations noted above.
5. In `/garden-test`, open **Production Growth QA** and inspect 1 / 5 / 10 / 20 / 30 isolated deterministic fixture records, using the same production adapter and drawing layer. These fixtures never enter persistence. Compare the locked **Flower Density Sandbox → June Day 30 — V1.1** as the visual-direction reference. Check cold-start responsiveness on web and native.
6. Inspect another month's real records to confirm month-isolated maturity. Check missing-art markers/diagnostics where applicable. Toggle Growth V1.1 OFF for legacy recovery/comparison, then ON; saved data must remain unchanged.

No headless Chrome, browser automation, screenshots, storage reset, backend migration, new approval checkpoint, or emotion work is part of this integration. Stop here for manual verification.
