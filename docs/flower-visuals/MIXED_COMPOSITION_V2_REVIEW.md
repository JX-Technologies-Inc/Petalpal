> Current status: **Mixed V1 and Mixed V2 are LEGACY DEV / QA**, retained but rejected as beauty targets. Monthly Growth V1 is also LEGACY DEV / QA. [Monthly Garden Growth V1.1 is APPROVED](MONTHLY_GARDEN_GROWTH_V1_1_APPROVED.md) as the initial production visual direction. No artwork was regenerated. The report below is historical.

# Mixed Composition V2 — manual review pending

**Mixed V1 is REJECTED as a monthly composition. Mixed V2 is READY_FOR_REVIEW, not approved.** No source or extracted artwork was changed. This is a DEV Sandbox composition update only.

Use **Mixed V1 / Mixed V2** for direct A/B. Quick V2 presets are June / Land06 / 30, April / Land04 / 30 and October / Land10 / 30. The Sandbox opens in V2; the existing All Species Mixed preset buttons explicitly select V1. The A/B buttons retain the current month, count and camera.

## Actual 30-object results

| Month | Area | Sparse | Normal | Full | Neighborhoods | Objects per neighborhood | Visual pieces V1 → V2 |
|---|---|---|---|---|---|---|---|
| June | SMALL | 5 | 18 | 7 | 6 | 5 / 6 / 4 / 5 / 4 / 6 | 57 → 92 |
| April | MEDIUM | 5 | 15 | 10 | 6 | 5 / 6 / 4 / 5 / 4 / 6 | 59 → 86 |
| October | LARGE | 5 | 13 | 12 | 6 | 5 / 6 / 4 / 5 / 4 / 6 | 77 → 90 |

Every row has exactly **30 logical objects: 18 S / 9 M / 3 L**, radii **9 / 12 / 16 world px**. Each object still has one ID, one world anchor and one collision footprint. Visual pieces are internal cluster parts, not new Journal records. The DEV pipeline performs no persistence writes.

Area-specific target weights start from 15/50/35: Small uses 15/60/25 to favor Normal, Medium 15/50/35, Large 15/45/40. Integer monthly budgets round to the counts above. Existing reference density assignments are retained; new species fill the remaining budget. Richer clusters favor neighborhood cores and lighter clusters their edges.

## Fixed anchors and neighborhood affinity

Neighborhoods are computed from existing world coordinates using deterministic, capacity-constrained spatial grouping. No anchor moves and no extra positions are generated. The 30-object presets have six groups with 4–6 members. Group membership is diagnostic/compositional metadata, never a saved planting change. Preserving world anchors limits how much the existing gaps can change; V2 addresses them with cluster richness and species affinity rather than relocating objects.

Affinity exchanges only non-reference preview species between same-class anchors. The monthly species counts below stay exactly the same as V1. Tulip, Chamomile and Hydrangea keep their exact V1 IDs, species, compositions and complete-cluster scales. L accents remain one each of Hydrangea, Sunflower and Bird of Paradise.

Affinity favors repeated/compatible companions (such as Daisy/Lavender, Coreopsis/Bluebell, Poppy/fillers) and penalizes pockets exceeding four identities. Most pockets contain 2–4 species. One June pocket retains five to preserve its fixed geometry, reference identities and monthly totals; this is an explicit manual-review limitation rather than a hidden relocation or new object.

**Show Neighborhoods ON/OFF** draws colored anchor markers and connector lines. Toggling it cannot alter species, compositions, anchors, masks, scale, object count or collision. Debug drawing uses the same existing occlusion container.

## Visual richness

All 20 batch species now have separate V2 recipes. V1 recipes and assets are untouched. Intact multi-head/spike source pieces contribute their estimated visible-unit count; whole prefabs are not blindly multiplied by a head-count target. Companion buds/foliage can be added without creating another logical object.

| Species/form | Sparse | Normal | Full | Unit |
|---|---|---|---|---|
| Daisy / Aster | 2–3 | 4–6 | 6–9 | heads |
| Coreopsis | 2–3 | 3–5 | 5–8 | open heads |
| Dandelion | 1–2 | 2–4 | 4–6 | flower/seed heads |
| Bluebell | 1–2 | 2–3 | 3–5 | bell stems |
| Heather | 1–2 | 2–4 | 4–6 | sprays |
| Lavender | 1–2 | 2–4 | 4–6 | spikes |
| Rapeseed / Chinese Violet Cress | 1–2 | 2–4 | 4–6 | flowering stems |
| Snowdrop | 1–2 | 2–3 | 3–4 | rooted bell groups |
| Gerbera Daisy | 1 | 2 | 2–3 | heads |
| Anemone / Gentian / Poppy / Daffodil | 1–2 | 2–3 | 3–4 | heads or trumpet stems |
| Petunia | 1–2 | 2–3 | 3–5 | open heads |
| White Rose | 1 | 1–2 | 2–3 | open heads |
| Sunflower | 1 | 1–2 | 2 | heads |
| Bird of Paradise | 1 | 1 | 1–2 | architectural stems |
| Olive | 1 | 1–2 | 2–3 | foliage branches |
| Chamomile | 2–4 | 4–7 | 7–11 | existing approved recipe, unchanged |
| Tulip / Hydrangea | unchanged | unchanged | unchanged | exact reference results preserved |

Local part scale is 0.96–1.12; optional companions 0.80–0.92. The first main component is rooted at the object origin, with additional roots irregularly distributed inside a bounded local span. Upright forms keep ±3° rotation; others ±6°. Existing area spread (1.00/1.08/1.15), whole-cluster scale (1.00/1.08/1.22), source world-units-per-pixel and species base scales remain unchanged. These visual dimensions never scale the footprint.

## Species distribution — unchanged monthly totals

| Species | June | April | October |
|---|---|---|---|
| ANEMONE | 1 | 0 | 2 |
| ASTER | 2 | 0 | 1 |
| BIRD_OF_PARADISE | 1 | 1 | 1 |
| BLUEBELL | 1 | 4 | 2 |
| CHAMOMILE | 2 | 3 | 5 |
| CHINESE_VIOLET_CRESS | 1 | 2 | 3 |
| COREOPSIS | 2 | 2 | 1 |
| DAISY | 3 | 0 | 1 |
| DANDELION | 1 | 2 | 1 |
| GENTIAN | 1 | 0 | 1 |
| GERBERA_DAISY | 0 | 2 | 0 |
| HEATHER | 2 | 2 | 2 |
| HYDRANGEA | 1 | 1 | 1 |
| LAVENDER | 0 | 2 | 1 |
| OLIVE | 1 | 0 | 2 |
| PETUNIA | 0 | 1 | 2 |
| POPPY | 1 | 4 | 1 |
| SNOWDROP | 2 | 1 | 0 |
| SUNFLOWER | 1 | 1 | 1 |
| TULIP | 3 | 1 | 1 |
| WHITE_ROSE | 1 | 0 | 0 |
| YELLOW_DAFFODIL | 1 | 1 | 0 |
| YELLOW_RAPESEED_FLOWER | 2 | 0 | 1 |

Exact per-neighborhood species counts and object IDs are in [MIXED_V2_REVIEW_COUNTS.json](MIXED_V2_REVIEW_COUNTS.json).

## Preservation and validation

All 204 protected source/artwork, V1, reference, mask, planting, occlusion, Tea Set, production and backend file hashes match [the checkpoint](MIXED_V2_PROTECTED_BASELINE.json). No art regeneration, source replacement, Journal/Support change, backend change or production integration. Both secondary emotions remain NONE.

Land06 continues using the unchanged shared depth rule: ground → planted cluster layer → Tea Set foreground. Runtime-tree tests confirm Mixed V2 reaches that same slot and the Tea Set artwork/placement remains unchanged. Flower Y ordering remains in the unchanged shared renderer.

Tests: `npx tsc --noEmit` and the 18 Node suites listed below passed. The new suite checks 3,600 recipe cases, exact logical counts, identical A/B anchors/radii, deterministic neighborhoods and composition (including reordered input and fresh reload), monthly budgets, unchanged species totals/reference outputs, no persistence access, protected hashes and valid collisions. Actual Sandbox controls, render asset routing and the diagnostic-only overlay are exercised without a browser.

- `node ./test/mixedCompositionV2.test.mjs` — PASS
- `node ./test/speciesSandboxRendering.test.mjs` — PASS
- `node ./test/flowerOcclusion.test.mjs` — PASS
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
- `node ./test/batchFlowerIntegration.test.mjs` — PASS
- `node ./test/flowerDetail.test.mjs` — PASS

No headless Chrome or screenshot automation was run.

## Exact files changed

[MIXED_V2_CHANGED_FILES.json](MIXED_V2_CHANGED_FILES.json) lists all 14 implementation, test and documentation paths plus separate test logs. Artwork changes: zero.

**Stopped for manual June / April / October V1-versus-V2 review. No automatic approval.**
