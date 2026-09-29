# Monthly Garden Growth V1 — DEV manual review

Current status: **Monthly Growth V1 is LEGACY DEV / QA**, retained unchanged for comparison. [Monthly Garden Growth V1.1 is APPROVED](MONTHLY_GARDEN_GROWTH_V1_1_APPROVED.md) as the initial production visual direction. The report below records V1's historical implementation; its review-pending statements are superseded by this checkpoint.

Rendering-boundary correction supersedes the historical clipping description below: Final Mask validation still constrains planting anchors/footprints, but the shared DEV growth renderer no longer clips botanical pixels. Primary, companion and filler artwork may naturally cross the boundary. Composition and actual foreground landmark occlusion remain unchanged.

**READY_FOR_REVIEW, not approved.** Mixed V1 and Mixed V2 are rejected as beauty targets and retained unchanged as QA modes. This implementation adds a separate parent-owned growth field; it does not retune Mixed V2 percentages.

## Product and interaction model

At Day 30 the beauty fixture contains exactly 30 parent Flower Records. Each parent keeps one species, ID, primary ground anchor, 9/12/16 collision footprint and interaction identity. The Sandbox fixtures are temporary review data; no real Journal entry, Flower Record, Support target or backend row is created or changed.

Each botanical draw node has a unique visual ID plus its parentId. The primary uses the existing species composition unchanged. Same-species companions and small foliage/bud/flower filler are non-interactive visual children. They never join the record list or become separately persisted flowers.

Only taps within a primary footprint select its parent identity. Camera pan/zoom coordinates are converted before hit testing. Detached companion/filler taps do not select an extra flower; child-to-parent lookup is available as a pure helper. Support target identities remain exactly the parent IDs, and this DEV viewer makes no Support requests.

## Growth-stage rules

Maturity depends only on the number of real parent records supplied to the preview, never a clock. Coverage targets interpolate between the stage endpoints as records accumulate; stage changes expand companion counts and reach.

| Records | Stage | Companion pieces per parent | Target coverage at stage end |
|---|---|---|---|
| 1–5 | NEW GARDEN | 2 | 9% |
| 6–10 | EARLY GROWTH | 4 | 22% |
| 11–15 | ESTABLISHED | 6 | 38% |
| 16–20 | LUSH | 8 | 54% |
| 21–25 | MATURE | 10 | 67% |
| 26–30 | FULL MONTH | 12 | 78% |

Targets operate within the conservative clip interior. Actual approved-region coverage is measured separately below. Every preset first prepares a fixed 30-parent fixture using the existing collision/validity solver, then reveals a stable seeded prefix. Day 5/10/20/30 never repacks existing primary anchors. Existing QA fixtures and persisted production coordinates remain untouched.

Companions spread around their parent and approach its nearest real neighbor. Filler is assigned to the nearest real parent, uses that parent species, and fills low-alpha gaps inside its stage-dependent growth field. A seeded spatial pattern reserves irregular breathing spaces; children may overlap. No extra collision islands, record merges, grid placement of primary anchors, or boundary ring is created.

## Actual visual child counts

Primary pieces are also non-interactive draw nodes; the parent record owns interaction. Counts below are visual nodes, not logical flowers.

| Preset | Parent records | Primary pieces | Companion pieces | Filler pieces | Total visual nodes | Runtime coverage estimate |
|---|---|---|---|---|---|---|
| June Day 5 | 5 | 11 | 10 | 17 | 38 | 8.8% |
| June Day 10 | 10 | 23 | 40 | 50 | 113 | 21.4% |
| June Day 20 | 20 | 38 | 160 | 135 | 333 | 52.5% |
| June Day 30 | 30 | 57 | 360 | 174 | 591 | 75.7% |
| April Day 30 | 30 | 86 | 360 | 387 | 833 | 76.6% |
| October Day 30 | 30 | 82 | 360 | 1595 | 2037 | 77.7% |

October requires substantially more small filler draws because its approved region is much larger. Image decoding is shared per unique asset rather than repeated per visual child. The extra draw nodes do not create planting, click, Journal or Support objects.

## Independent Day 30 alpha coverage

| Month | Full-resolution source-alpha check | Runtime downsampled-alpha estimate |
|---|---|---|
| June | 76.4% | 75.7% |
| April | 75.9% | 76.6% |
| October | 80.0% | 77.7% |

Both calculations sample a 4-world-pixel lattice, transform each sample into the actual component alpha, composite overlapping alpha, and count samples whose combined alpha is at least 0.5. The denominator is the full approved-mask area from the existing solver. Runtime alpha metadata averages 8×8 source pixels; the independent Python test reads the unmodified full-resolution PNGs. These are approximate botanical coverage measurements before landmark occlusion, not screenshot measurements or visual approval.

The existing Tea Set still occludes growth behind it. Consequently, visible screen coverage can be lower where landmark foreground artwork overlaps the bed. All three raw-alpha estimates lie within the requested 70–85% range.

## Species distributions at Day 30

| Species | June | April | October |
|---|---|---|---|
| ASTER | 0 | 0 | 5 |
| BLUEBELL | 0 | 4 | 0 |
| CHAMOMILE | 6 | 6 | 6 |
| COREOPSIS | 3 | 3 | 3 |
| DAISY | 5 | 5 | 0 |
| HEATHER | 0 | 0 | 4 |
| HYDRANGEA | 2 | 2 | 2 |
| LAVENDER | 4 | 0 | 0 |
| PETUNIA | 0 | 4 | 0 |
| POPPY | 4 | 0 | 5 |
| TULIP | 6 | 6 | 5 |

Each beauty preset contains seven species and repeats them. June exactly matches the requested 6 Chamomile / 6 Tulip / 5 Daisy / 4 Lavender / 4 Poppy / 2 Hydrangea / 3 Coreopsis distribution. All Species Mixed is QA only.

## Height, edge and depth behavior

Companion height ranges: low Chamomile/Daisy/Aster 12–20 world px; mid forms 18–28; Hydrangea/Lavender/Heather support 22–32. Filler stays 9–16 px high and at most 34 px wide. Primary reference scales are unchanged. The supplied source silhouettes and colors are preserved; there are no emotion effects, recoloring, artwork regeneration or new full-bush prefabs.

Low filler draws first; primary and companion pieces then share ground-Y ordering. The complete growth group, including diagnostics, lives inside the unchanged SandboxGardenBackdrop slot. Land06 therefore remains ground → all flower growth → Tea Set foreground. Tea artwork, placement and occlusion implementation are unchanged.

Clipping is a read-only conservative 1-world-pixel scan conversion of the authoritative approved Final Mask predicate. Every included cell passes center, corner and edge-midpoint checks. Its resulting SVG clip is applied to every growth draw. This preserves thin exclusions and irregular edges without editing masks or planting validity; the subpixel conservative edge loss is reflected in the full-area coverage denominator.

## Review controls

- Monthly Growth V1 opens as the default beauty mode.
- Quick presets: June Day 5, 10, 20, 30; April Day 30; October Day 30.
- Primary Anchors, Companion Growth, Bed Filler, Growth Coverage, and the existing Final Mask toggle.
- Layer visibility does not mutate or regenerate logical data. Coverage debug deliberately describes all generated layers even when a layer is temporarily hidden.
- Existing Mixed V1/V2, all-species and single-species QA controls remain available.

## Validation

Passed: TypeScript, 19 Node regression suites, independent full-resolution-alpha coverage verification, and regeneration checking of the alpha metadata. No headless Chrome or screenshot automation was used.

- `node ./test/monthlyGardenGrowth.test.mjs` — PASS
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
- `node ./test/mixedCompositionV2.test.mjs` — PASS
- `node ./test/flowerDetail.test.mjs` — PASS
- `npx tsc --noEmit` — PASS
- `python ./test/monthlyGrowthAlpha.test.py` — PASS
- `python ./scripts/buildGrowthAlphaSamples.py --check` — PASS

Tests cover stable count prefixes/anchors/radii, valid primary collisions, deterministic children and growth fields across reorder/reload, one parent per child, no storage access, parent-only hit testing, source-alpha coverage, conservative clipping, shared Tea Set draw order, no image effects, and frozen artwork/reference/QA/production hashes.

## Exact files changed

[MONTHLY_GROWTH_CHANGED_FILES.json](MONTHLY_GROWTH_CHANGED_FILES.json) lists the 19 implementation, test, metadata and documentation files, plus QA logs/geometry artifacts. PNG artwork changes: zero. Production Garden changes: zero.

**Stopped for manual Monthly Garden Growth V1 review. Production integration remains deferred; no automatic approval.**
