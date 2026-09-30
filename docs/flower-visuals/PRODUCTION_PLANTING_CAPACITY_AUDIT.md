# Production planting capacity audit — all 12 lands

Audit date: 2026-09-29. The production Growth V1.1 visual and performance baselines are user-approved. This audit changes no production source, radii, masks, coordinates, artwork or Growth rules.

## Result and interpretation

6 PASS, 0 MARGINAL, 6 FAIL under the tested production mixes. PASS requires representative B to fit 30 with an extra 2 world px of pairwise clearance and all four mixes to reach 30. MARGINAL means some mix reaches 30 but that criterion is unmet. FAIL means none of the four searches reaches 30.

**FAIL is a practical, bounded-search finding, not a mathematical proof of the continuous maximum.** Placed counts below 30 are best-found valid lower bounds. No finite heuristic proves that every possible arrangement fails. Successful witnesses are independently replayed through the real production validator. A passing planned layout does not guarantee that 30 fit after arbitrary earlier user placements without Adjust Position.

| Land | Approx. Final Mask area (world px²) | A small-friendly | B representative | C large stress | D default | Classification |
|---|---:|---:|---:|---:|---:|---|
| January / Land01 | 38,504 | 19/30 | 18/30 | 16/30 | 16/30 | FAIL |
| February / Land02 | 41,818 | 19/30 | 17/30 | 16/30 | 16/30 | FAIL |
| March / Land03 | 40,120 | 18/30 | 17/30 | 15/30 | 15/30 | FAIL |
| April / Land04 | 53,976 | 27/30 | 23/30 | 22/30 | 22/30 | FAIL |
| May / Land05 | 34,572 | 17/30 | 16/30 | 14/30 | 14/30 | FAIL |
| June / Land06 | 33,020 | 12/30 | 11/30 | 10/30 | 9/30 | FAIL |
| July / Land07 | 84,312 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |
| August / Land08 | 84,184 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |
| September / Land09 | 90,340 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |
| October / Land10 | 104,592 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |
| November / Land11 | 99,474 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |
| December / Land12 | 78,280 | 30/30 | 30/30 | 30/30 | 30/30 | PASS |

## Production authority

The audit imports validateFlowerPlacement from placementValidator.ts, the same function called again by PlantingContext.confirmPlacement immediately before saving. It passes flowerName and actual month/world coordinates with no definition override. Every selected witness is validated against all previously accepted parents; Adjust parity ignores only the selected record ID.

Current collision radii: **Tulip 20, Lavender 20, Sunflower 24, Lotus 22, Cherry Blossom 22, default 22** world px. Resolution is case-insensitive exact-or-substring matching of flowerName. speciesCode does not select the collision radius. Names such as pink/purple and unlisted species resolve to 22; ORANGE_TULIP resolves to 20. Scale, rotation, hitbox size and DEV visual metadata 9/12/16 do not change the production collision circle.

Rules: world bounds; target-month Final Mask center membership (otherwise other-month detection); conservative entire-circle mask containment; squared-distance parent collision with strict '<' (touching is allowed). Confirm sets landId from MONTH_REGION_METAS. Approved calibration, Add/Remove operations and offsets are loaded from approvedPlantingMasks.json; no baseline-only, editable localStorage or DEV mask is substituted.

There is no additional Tea Set/landmark-object exclusion in this Confirm validator: relevant excluded ground is encoded in the Final Mask. Foreground Tea Set occlusion is visual and does not subtract extra capacity. The audit does not import or place Growth Primary/Companion/Filler children. Owner/session/duplicate-Journal rules are outside geometric capacity; QA parents have unique IDs and represent an authorized user's records.

All areas are the locked Final Mask's **2-world-pixel center-sampled estimates**, with current source hashes checked. They are not analytic areas or eroded center areas. Reported valid-center counts use a separate 3 px grid and the real full-footprint validator. These estimates are diagnostics, never placement acceptance criteria.

## Mixes

A: TULIP×14, LAVENDER×10, CHAMOMILE×3, DAISY×3.

B June-reference (January–March, May–September, November–December): CHAMOMILE×6, TULIP×6, DAISY×5, LAVENDER×4, POPPY×4, HYDRANGEA×2, COREOPSIS×3.

B April: CHAMOMILE×6, TULIP×6, DAISY×5, BLUEBELL×4, PETUNIA×4, HYDRANGEA×2, COREOPSIS×3.

B October: CHAMOMILE×6, TULIP×5, ASTER×5, HEATHER×4, POPPY×5, HYDRANGEA×2, COREOPSIS×3.

B copies the approved June/April/October monthly mix definitions. Months without a dedicated approved mix use the declared June neutral reference, not an invented claim of twelve approved seasonal species mixes.

C: SUNFLOWER×18, HYDRANGEA×4, POPPY×4, TULIP×2, LAVENDER×2.

D: CHAMOMILE×8, DAISY×8, HYDRANGEA×4, POPPY×4, PETUNIA×3, ASTER×3. All 30 resolve to default radius 22.

## Full 48-scenario table

Radius distribution is radius × number requested, not the subset that happened to fit. Requested count is 30 in every row. Clearance is minimum circle-edge-to-circle-edge distance of the reported successful subset. +2 px shows the achieved count under the additional pairwise gap; '-' means the base search failed and no margin run was requested.

| Month / land | Mask area ≈ | Scenario | Requested radii | Placed | Failed | 30/30 | Min clearance px | +2 px count | Full starts / 96 | Assessment |
|---|---:|---|---|---:|---:|---|---:|---:|---:|---|
| January / Land01 | 38504 | A | 20×24 / 22×6 | 19 | 11 | no | 0.025 | — | 0 | FAIL (search) |
| January / Land01 | 38504 | B | 20×10 / 22×20 | 18 | 12 | no | 0.025 | — | 0 | FAIL (search) |
| January / Land01 | 38504 | C | 20×4 / 22×8 / 24×18 | 16 | 14 | no | 0.025 | — | 0 | FAIL (search) |
| January / Land01 | 38504 | D | 22×30 | 16 | 14 | no | 0.025 | — | 0 | FAIL (search) |
| February / Land02 | 41818 | A | 20×24 / 22×6 | 19 | 11 | no | 0.025 | — | 0 | FAIL (search) |
| February / Land02 | 41818 | B | 20×10 / 22×20 | 17 | 13 | no | 0.025 | — | 0 | FAIL (search) |
| February / Land02 | 41818 | C | 20×4 / 22×8 / 24×18 | 16 | 14 | no | 0.094 | — | 0 | FAIL (search) |
| February / Land02 | 41818 | D | 22×30 | 16 | 14 | no | 0.294 | — | 0 | FAIL (search) |
| March / Land03 | 40120 | A | 20×24 / 22×6 | 18 | 12 | no | 0.025 | — | 0 | FAIL (search) |
| March / Land03 | 40120 | B | 20×10 / 22×20 | 17 | 13 | no | 0.107 | — | 0 | FAIL (search) |
| March / Land03 | 40120 | C | 20×4 / 22×8 / 24×18 | 15 | 15 | no | 0.094 | — | 0 | FAIL (search) |
| March / Land03 | 40120 | D | 22×30 | 15 | 15 | no | 0.294 | — | 0 | FAIL (search) |
| April / Land04 | 53976 | A | 20×24 / 22×6 | 27 | 3 | no | 0.025 | — | 0 | FAIL (search) |
| April / Land04 | 53976 | B | 20×6 / 22×24 | 23 | 7 | no | 0.025 | — | 0 | FAIL (search) |
| April / Land04 | 53976 | C | 20×4 / 22×8 / 24×18 | 22 | 8 | no | 0.025 | — | 0 | FAIL (search) |
| April / Land04 | 53976 | D | 22×30 | 22 | 8 | no | 0.025 | — | 0 | FAIL (search) |
| May / Land05 | 34572 | A | 20×24 / 22×6 | 17 | 13 | no | 0.025 | — | 0 | FAIL (search) |
| May / Land05 | 34572 | B | 20×10 / 22×20 | 16 | 14 | no | 0.025 | — | 0 | FAIL (search) |
| May / Land05 | 34572 | C | 20×4 / 22×8 / 24×18 | 14 | 16 | no | 0.025 | — | 0 | FAIL (search) |
| May / Land05 | 34572 | D | 22×30 | 14 | 16 | no | 0.294 | — | 0 | FAIL (search) |
| June / Land06 | 33020 | A | 20×24 / 22×6 | 12 | 18 | no | 0.010 | — | 0 | FAIL (search) |
| June / Land06 | 33020 | B | 20×10 / 22×20 | 11 | 19 | no | 0.010 | — | 0 | FAIL (search) |
| June / Land06 | 33020 | C | 20×4 / 22×8 / 24×18 | 10 | 20 | no | 0.025 | — | 0 | FAIL (search) |
| June / Land06 | 33020 | D | 22×30 | 9 | 21 | no | 0.598 | — | 0 | FAIL (search) |
| July / Land07 | 84312 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.249 | 30 | 74 | robust |
| July / Land07 | 84312 | B | 20×10 / 22×20 | 30 | 0 | yes | 0.294 | 30 | 70 | robust |
| July / Land07 | 84312 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.374 | 30 | 45 | robust |
| July / Land07 | 84312 | D | 22×30 | 30 | 0 | yes | 0.598 | 30 | 58 | robust |
| August / Land08 | 84184 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.249 | 30 | 73 | robust |
| August / Land08 | 84184 | B | 20×10 / 22×20 | 30 | 0 | yes | 0.361 | 30 | 60 | robust |
| August / Land08 | 84184 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.094 | 29 | 35 | marginal |
| August / Land08 | 84184 | D | 22×30 | 30 | 0 | yes | 0.294 | 30 | 36 | robust |
| September / Land09 | 90340 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.361 | 30 | 82 | robust |
| September / Land09 | 90340 | B | 20×10 / 22×20 | 30 | 0 | yes | 0.294 | 30 | 75 | robust |
| September / Land09 | 90340 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.374 | 30 | 49 | robust |
| September / Land09 | 90340 | D | 22×30 | 30 | 0 | yes | 0.294 | 30 | 57 | robust |
| October / Land10 | 104592 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.953 | 30 | 96 | robust |
| October / Land10 | 104592 | B | 20×5 / 22×25 | 30 | 0 | yes | 0.638 | 30 | 95 | robust |
| October / Land10 | 104592 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.466 | 30 | 84 | robust |
| October / Land10 | 104592 | D | 22×30 | 30 | 0 | yes | 1.000 | 30 | 91 | robust |
| November / Land11 | 99474 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.426 | 30 | 96 | robust |
| November / Land11 | 99474 | B | 20×10 / 22×20 | 30 | 0 | yes | 0.598 | 30 | 90 | robust |
| November / Land11 | 99474 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.374 | 30 | 75 | robust |
| November / Land11 | 99474 | D | 22×30 | 30 | 0 | yes | 0.598 | 30 | 84 | robust |
| December / Land12 | 78280 | A | 20×24 / 22×6 | 30 | 0 | yes | 0.249 | 30 | 72 | robust |
| December / Land12 | 78280 | B | 20×10 / 22×20 | 30 | 0 | yes | 0.361 | 30 | 63 | robust |
| December / Land12 | 78280 | C | 20×4 / 22×8 / 24×18 | 30 | 0 | yes | 0.294 | 28 | 14 | marginal |
| December / Land12 | 78280 | D | 22×30 | 30 | 0 | yes | 0.598 | 30 | 46 | robust |

## Search strength and uncertainty

For each land, enumerate a deterministic 3 px center grid spanning the full transformed baseline plus Add-stroke bounds. Centers must pass the approved point predicate and candidate radii 20/22/24 are individually admitted by the real validator. Each mix receives 96 starts combining 24 directions, directional sweeps, staggered rows, radial and seeded-random candidate orders, plus large-first/small-first/original/seeded record orders. Up to 120 local destroy/repair passes remove nearby pockets and reinsert missing records. Failures receive 48 continuous compaction rounds with true off-grid validation and tangent insertion, then 24 additional searches using pairwise circle-intersection tangencies and directional packing. Every final witness receives a full sequential production-validator replay.

Margin runs use 48 starts and up to 48 repairs with an extra 2 px between pairs; actual radii and mask containment stay unchanged. This is additional QA spacing, not a new validator rule. summary.json also records ±1 px individual-parent perturbation acceptance in eight directions. It diagnoses sensitivity and is not a guarantee against moving all parents together. Candidate/grid restrictions and finite restart budgets may miss a better continuous solution.

## Failure causes

| Land | Radius-20/22/24 valid-center area estimates (px²) | B disk area / mask area | Evidence and cause |
|---|---|---:|---|
| January / Land01 | 20: 19008 / 22: 17406 / 24: 15795 | 111.6% | 18 accepted, 12 unplaced in B after all search stages. Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses. Larger-radius mix 16/30 versus small-friendly 19/30 shows additional radius/species-mix sensitivity. |
| February / Land02 | 20: 17091 / 22: 15345 / 24: 13716 | 102.8% | 17 accepted, 13 unplaced in B after all search stages. Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses. Larger-radius mix 16/30 versus small-friendly 19/30 shows additional radius/species-mix sensitivity. |
| March / Land03 | 20: 16038 / 22: 14202 / 24: 12681 | 107.1% | 17 accepted, 13 unplaced in B after all search stages. Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses. Larger-radius mix 15/30 versus small-friendly 18/30 shows additional radius/species-mix sensitivity. |
| April / Land04 | 20: 29358 / 22: 27486 / 24: 25929 | 81.6% | 23 accepted, 7 unplaced in B after all search stages. Disk area alone is insufficient to explain the shortfall; full-circle erosion, boundary/shape losses and circle packing are the limiting evidence. Larger-radius mix 22/30 versus small-friendly 27/30 shows additional radius/species-mix sensitivity. |
| May / Land05 | 20: 15381 / 22: 13815 / 24: 12240 | 124.3% | 16 accepted, 14 unplaced in B after all search stages. Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses. Larger-radius mix 14/30 versus small-friendly 17/30 shows additional radius/species-mix sensitivity. |
| June / Land06 | 20: 6255 / 22: 4671 / 24: 3582 | 130.2% | 11 accepted, 19 unplaced in B after all search stages. Requested non-overlapping disk area already exceeds the sampled mask area; area shortage plus boundary/shape losses. Larger-radius mix 10/30 versus small-friendly 12/30 shows additional radius/species-mix sensitivity. |

The static candidate scans reject FOOTPRINT_OUTSIDE_REGION, despite valid centers; remaining feasible centers compete through COLLIDES_WITH_FLOWER. Final witnesses contain no such failures. No separate hidden landmark rule or visual-child collision explains these shortfalls. Area comparisons are approximate evidence, not a certified impossibility proof.

The approved Production 30 visual fixture is not a production-capacity witness: replay in its saved order accepts **4/30**, with rejections {"FOOTPRINT_OUTSIDE_REGION":22,"COLLIDES_WITH_FLOWER":4}. It used QA parent anchors; visual approval remains intact and was never proof that those anchors satisfy the current production radii.

## Recommended next options — not implemented

1. Review production collision footprints as a separate product decision, with explicit species/name mapping and re-audit. The DEV 9/12/16 values are not automatically suitable production replacements.
2. If current collision rules must stay, evaluate a capacity-aware planting/Adjust assist or an overflow/unplanted-record flow. Assistance can improve arrangement but cannot guarantee thirty on the failing lands.
3. Treat any enlargement of approved masks as a separately authorized art/geometry review; current masks remain authoritative.
4. If mathematical maximum capacity is required, run a dedicated continuous packing/global-bound investigation, especially for borderline favorable mixes. Do not present this bounded search as a proof of impossibility.
5. Keep real Journal-parent counts independent of growth visuals; removing visual children would not solve parent packing.

## Evidence, files and tests

Isolated QA evidence is under output/production-capacity-audit/: land01.json … land12.json (witness coordinates and complete search results), summary.json, locked-inputs.json, capacity-review.html and validation logs/results. QA coordinates are audit artifacts only; no records are inserted into app storage, Journal or backend. The review HTML is offline, read-only and outside the application. Its gray mask is the existing conservative 1 px mask-display path; acceptance always comes from the production validator, not the display.

Added files: mobile/scripts/productionCapacityAudit.mjs; mobile/scripts/runProductionCapacityAudit.mjs; mobile/scripts/refineProductionCapacityAudit.mjs; mobile/scripts/reportProductionCapacityAudit.mjs; mobile/test/productionCapacityAudit.test.mjs; docs/flower-visuals/PRODUCTION_PLANTING_CAPACITY_AUDIT.md; output/production-capacity-audit/ artifacts and test runner. **No existing production, Growth, mask, art or checkpoint file is modified.**

Validation: productionCapacityAudit.test.mjs rebuilds all twelve domains and repeats all 48 complete searches, comparing exact witnesses, then replays production/Adjust validation. It checks authoritative radii, all approved masks, current geometry source hashes and 42 locked source/checkpoint/performance-evidence hashes, with storage/network access trapped. TypeScript and relevant existing regressions plus both archive verifiers are recorded in validation-results.json. No browser/headless Chrome/screenshot automation.

STOP: audit only. No collision-capacity, mask, Growth or emotion implementation follows this report.
