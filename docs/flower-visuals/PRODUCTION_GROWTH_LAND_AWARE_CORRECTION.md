# Production Growth V1.1 — land-aware correction

2026-09-29. The first production local-offset adaptation was rejected in manual QA. This corrected result has now **PASSED manual visual QA** and is locked as [PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED](PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED.md). The original `MONTHLY_GARDEN_GROWTH_V1_1_APPROVED` checkpoint remains intact. The measurements below document the approved pre-optimization implementation.

## Cause and correction

The rejected adapter generated a complete land-relative bed around seeded synthetic reference anchors, converted it to offsets, and transplanted those offsets to unrelated real anchors. That broke spatial coverage and moved some origins outside the land. The prior tests checked rigid translation and determinism but did not measure the resulting field's coverage or origin validity.

Production now calls the unchanged approved growth and layered-bed engines using the **actual parent coordinates**. Stable IDs, species, month, stage, land geometry and the current neighboring anchors drive the result. There is no synthetic reference-anchor conversion. No parent is moved, no placement solver runs, no persisted rendering metadata is introduced, and no extra density target or component budget is added.

Primary component offsets rotate and scale once around their owning parent's saved anchor. Companion/filler positions are already world-space bed positions; they are not transferred or rotated around a second reference origin. Their artwork uses the parent's scale/rotation once. All final child origins are checked against the approved month region; an invalid generated origin is placed at its nearest conservative approved grass sample. This constrains **generation**, not pixels. No botanical clipping path is introduced. Valid original origins remain exactly as generated.

Adjust changes the real parent's render input and rebuilds the deterministic bed for the new neighborhood. Recognizable primary growth follows the parent. Shared filler may relocate or change as the field is recomputed, as explicitly authorized. Cancel restores the original cached field; Confirm uses unchanged validation/persistence; reload reconstructs the same confirmed field. There is no separate old-child collection to leave behind.

## Quantitative June Day-30 comparison

The production QA fixture retains the same seven species and stable parent prefix as the approved reference: Chamomile 6, Tulip 6, Daisy 5, Lavender 4, Poppy 4, Hydrangea 2, Coreopsis 3. The 1/5/10/20/30 views remain isolated fixtures, never saved to user storage.

| Measurement | Approved reference | Corrected production QA |
|---|---:|---:|
| Parent records | 30 | 30 |
| Visual pieces | 591 | 591 |
| Botanical coverage, runtime alpha atlas | 74.67% | 74.82% |
| Botanical coverage, original PNG alpha | 74.09% | 73.89% |
| Visible alpha area, world px² | 23,928 | 23,952 |
| Occupied sectors (at least 25% coverage) | 6 / 6 | 6 / 6 |
| Low / mid / tall visible mass | 33.45 / 51.86 / 14.68% | 34.04 / 52.01 / 13.96% |
| Child origins outside approved generation region | 49 | 0 |
| Parent distance p50 / p90 / max, world px | 33.31 / 74.35 / 309.59 | 32.61 / 74.35 / 309.59 |

The reference stays byte-for-byte unchanged, including its pre-existing 49 out-of-region origins. In the corrected fixture, those 49 origins are constrained; the other 542 origins, all component selections, scales, rotations, owners and counts match the reference. The long distance tail belongs to shared bed/focal growth; it remains inside the land, rather than implying a tiny per-parent circular scatter region.

| Spatial sector | Approved coverage | Production coverage |
|---|---:|---:|
| Left back | 86.21% | 86.78% |
| Left front | 59.61% | 60.59% |
| Center back | 72.54% | 72.54% |
| Center front | 74.67% | 74.67% |
| Right back | 88.99% | 88.10% |
| Right front | 77.51% | 77.81% |

| Species | Approved visible contribution | Production visible contribution |
|---|---:|---:|
| Chamomile | 15.82% | 16.04% |
| Tulip | 30.38% | 30.87% |
| Daisy | 9.80% | 9.79% |
| Lavender | 10.74% | 10.79% |
| Poppy | 12.81% | 13.04% |
| Hydrangea | 6.39% | 5.82% |
| Coreopsis | 14.06% | 13.66% |

The runtime metric uses the existing alpha atlas over conservative approved grass samples. Coverage counts alpha ≥0.5 and uses the same approved-area normalization as the reference. Visible mass attributes source-over alpha in actual filler-underlay / ground-Y draw order, so overlapping hidden pieces do not each receive full credit. Low includes filler, foliage and Chamomile/Daisy/Aster; tall/focal includes Hydrangea/Lavender and appropriate vertical species; other recognizable blooms are mid. Sectors divide sample-area thirds across X and curved local bed depth into front/back. These measurements support comparison, not automatic visual approval.

Production progression: 1 / 5 / 10 / 20 / 30 parents gives approximately **1.89 / 8.82 / 22.00 / 54.03 / 74.82%** coverage with **4 / 38 / 113 / 333 / 591** pieces. No count was increased to conceal poor distribution. Independent source-PNG alpha verification is captured separately from the runtime atlas metrics.

## DEV review

Open `/garden-test` → **Production Growth QA**. Use the retained 1/5/10/20/30 controls and compare **Production — 30** with **Approved June — 30**. The panel reports coverage, visible area, sectors, low/mid/tall mass, species contribution, origin violations and parent-distance distribution.

Optional overlays: **Child Origins**, **Parent Ownership**, **Low/Mid/Tall**, **Spatial Coverage Grid**, and the existing Final Mask overlay. These are DEV-only and share the existing Land06 flower slot behind the Tea Set. No Tea Set art/placement or other production Garden layering changed.

Review the uninterrupted mature border, remaining grass, left/center/right and front/back distribution, recognizable species, and border-crossing pixels with no detached origins over water. Then test real Plant/Confirm/reload and owner Adjust/Cancel/Confirm/reload. Release rollout remains disabled; no emotion effects or new species/artwork were added.

## Protected behavior and performance

Production collisions remain Tulip/Lavender 20, Sunflower 24, default/Lotus/Cherry Blossom 22 world px. DEV S/M/L 9/12/16 remains visual metadata only. Approved masks, validators, persisted positions, parent identities, Journal/Support/backend contracts and all Garden artwork remain unchanged. The dedicated collision-footprint review TODO is unchanged.

The 32-entry positioned-field cache remains. Neighborhood changes now require recomposition rather than a cheap rigid translation. The final Node harness measured **12.805 s cold**, **10.309 s for a mature-field move/rebuild**, and **0.13 ms for a cached lookup** (`productionGrowth-verified.log`). This synchronous work can cause pauses on devices and is a remaining performance concern, not a device frame-rate measurement. No pieces were removed or quality reduced to conceal it. Broadening this task into an asynchronous renderer or art retuning is intentionally deferred.

## Files changed in this correction

Modified:

- `mobile/src/components/garden/planting/productionGrowth.ts`
- `mobile/src/components/garden/planting/ProductionGrowthQA.tsx`
- `mobile/test/productionGrowth.test.mjs`
- `mobile/test/productionGrowthFlow.test.mjs`
- `docs/flower-visuals/PRODUCTION_GROWTH_V1_1_INTEGRATION.md` — marks the prior adaptation as rejected/superseded.
- `output/production-growth-integration-checks/run-checks.mjs` — runs and records the additional spatial/source-alpha checks.

Added:

- `mobile/src/components/garden/planting/landAwareGrowth.ts`
- `mobile/src/components/garden/planting/growthReviewMetrics.ts`
- `mobile/src/components/garden/planting/productionGrowthQAData.ts`
- `mobile/test/productionGrowthSpatial.test.mjs`
- `mobile/test/productionGrowthAlpha.test.py`
- This report.

Generated verification artifacts under `output/production-growth-integration-checks/`: `land-aware-metrics.json`, `land-aware-alpha-geometry.json`, `land-aware-source-alpha.json`, executed-check logs and `verified-results.json`. The approved archive and historical visual baselines are not updated by these outputs.

## Validation

Focused checks cover actual-origin containment, border-crossing visible alpha, single coordinate transforms, full spatial-sector occupancy, comparable coverage/mass, all height layers, all seven species, stable ownership, movement/rebuild/Cancel/reload, unchanged collision, no rendering persistence, and the unchanged approved June fingerprint. The full integration verification runner also exercises planting, mask refinement, species composition, Sandbox rendering, Tea Set occlusion, Journal/Support, protected source/art hashes, TypeScript and archive integrity. Automated execution results are recorded directly by the runner, not inferred from child count.

**Final result: all 32 checks passed** — 26 Node suites, TypeScript, the backend suite (19 Journal/Support tests), three independent source-alpha comparisons, and checkpoint verification. All 836 archived files are intact; the protection test confirms 685 protected source/art/data files still match the approved snapshot. See `output/production-growth-integration-checks/verified-results.json` for executed commands, actual exit codes and logs.

No browser, headless Chrome or screenshot automation is used. Stop for manual visual review; this correction is not automatically approved.
