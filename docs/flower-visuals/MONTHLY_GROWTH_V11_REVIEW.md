# Monthly Garden Growth V1.1 — June Layered Bed

**MONTHLY_GARDEN_GROWTH_V1_1_APPROVED.** User manual review passed on 2026-09-29, including the removal of botanical Final Mask clipping. This is the approved initial production visual direction, with June Day 30 as the approved reference. The implementation remains in DEV; production integration is a separate task. April and October have no V1.1 behavior.

The formal preservation contract and backup are documented in [the approved checkpoint](MONTHLY_GARDEN_GROWTH_V1_1_APPROVED.md). Mixed V1, Mixed V2 and Monthly Growth V1 are **LEGACY DEV / QA**, retained for comparison. Historical review/checkpoint notes below describe earlier milestones and do not supersede this approval.

## Rendering-boundary correction checkpoint

Removed the single Final Mask clip from `MonthlyGrowthLayer`. This shared DEV renderer now lets primary, companion and filler pixels extend naturally past the planting boundary. Final Mask debug display and actual Tea Set foreground occlusion remain available and unchanged. Parent validity and filler-origin generation still use their existing constraints.

The complete pre-correction V1.1 visual-piece SHA-256 remains `347f5a41794341e6032d88db308928a76e2e0b7e893010e776cbce2f2cec0f5c`: 30 parents and 591 visual pieces (57 primary / 360 companion / 174 filler). No composition, coordinates, scales, artwork, counts or density settings changed.

Correction validation: **TypeScript and eight Node suites passed**: `monthlyLayeredBed`, `speciesSandboxRendering`, `monthlyGardenGrowth`, `flowerOcclusion`, `plantingSystem`, `plantingMaskRefinement`, `flowerVisualSystem`, `flowerDensitySandbox`. Tests verify visible alpha crosses the Final Mask for all three piece types, actual render trees contain no mask clip, valid parent footprints remain accepted, outside planting/adjustment remains rejected, collisions remain enforced, and protected production/artwork hashes remain unchanged. No browser or screenshot automation.

Files changed for this correction only: `MonthlyGrowthLayer.tsx`, `mobile/test/monthlyLayeredBed.test.mjs`, `mobile/test/speciesSandboxRendering.test.mjs`, this report, and `MONTHLY_GARDEN_GROWTH_REVIEW.md`. QA logs: `output/growth-boundary-test-*.log`. Stopped for manual review.

## Review

In the DEV Flower Density Sandbox select **June Day 30 — V1** or **June Day 30 — V1.1**. **Growth V1.1 — Layered Bed** also opens June Day 30. Existing V1 presets remain available. The selected version, parent count, piece counts and alpha coverage are displayed. Existing debug controls remain available.

## What changed

- **Depth and height:** local world-Y depth follows the curved Final Mask in narrow columns. Lower Y favors Lavender and taller Coreopsis companions; middle depth favors Tulip, Poppy and Hydrangea; the inner/front edge favors Chamomile and Daisy. June uses its existing seven species; no absent species is introduced.
- **Skyline:** occasional vertical companions reach 36–45 world px, interspersed with shorter forms. Low companions remain 12–19 px. This changes supporting silhouettes, never primary bloom scale or geometry.
- **Soft boundaries:** supporting growth spreads across neighboring pockets, retaining its original parent ID and species. Some low pieces occupy another species' nearby root area.
- **Uneven filler:** broad deterministic pockets replace even sprinkling. Daisy filler favors selected pockets; Chamomile filler uses existing foliage assets. Other areas retain grass gaps.
- **Focal rhythm:** the 24 Hydrangea companions become eight smaller partial/bud forms plus 16 foliage pieces distributed across three separated pockets. Both original Hydrangea primary compositions remain exactly where they were.
- **Plant bases:** 44 of the existing filler pieces become low root cover. They participate in ground-Y ordering with primary/companion growth, rather than all sitting underneath the entire flower layer. The remaining filler stays low in the underlay.
- **Fixed density:** deterministic placement refinement moves existing filler toward or away from overlap to retain V1's coverage. It never adds a piece, raises the target, or enlarges all flowers. The derived result is cached for A/B switching with the same V1 input.

## Counts and coverage

| June Day 30 | V1 | V1.1 |
|---|---:|---:|
| Parent records / interaction identities | 30 | 30 |
| Primary pieces | 57 | 57 |
| Companion pieces | 360 | 360 |
| Filler pieces | 174 | 174 |
| Total visual pieces | 591 | 591 |
| Runtime sampled alpha coverage | 75.7% | 74.7% |
| Full-resolution source-alpha check | 76.4% | 74.1% |

The full-resolution comparison differs by 2.3 percentage points, with no density increase. Both measurements use the same approved-region denominator and 4-world-pixel sampling before landmark occlusion. These are coverage estimates, not visual approval or screenshots. Results are recorded in `MONTHLY_GROWTH_V11_COVERAGE.json`.

## Preserved behavior

All parent IDs, species, coordinates, collision footprints (9/12/16), primary component selections/transforms, and child ownership remain unchanged. Children stay non-interactive and unpersisted. Primary-only hit testing and Support identity remain unchanged.

Rendering-boundary correction: the Final Mask constrains parent planting anchors/footprints and existing growth-origin generation, **not botanical pixels**. Primary, companion and filler artwork may extend beyond it without clipping. Final Mask debug remains available; visible artwork crossing that boundary is expected. Composition, counts and in-region coverage measurements are unchanged.

The existing Sandbox backdrop slot remains **Land06 ground → flower growth → Tea Set foreground**. Tea artwork/placement, approved source artwork, Tulip/Chamomile/Hydrangea reference composition rules, production Garden, Journal, backend and emotion behavior are unchanged. Emotion effects remain off.

## Validation

Passed: TypeScript, 15 Node suites, and the independent full-resolution alpha comparison. The dedicated tests check unchanged V1 input, exact parent/primary/child identities, seeded reload and input-order independence, back/front height separation, three focal pockets, uneven white filler, root blending, fixed coverage budget, mask inclusion, and June-only scope. The actual Sandbox UI test checks both A/B buttons and the round trip to unchanged V1; the renderer check covers root-cover depth ordering.

Commands:

- `npx tsc --noEmit`
- `node ./test/monthlyLayeredBed.test.mjs`
- `python ./test/monthlyLayeredBedAlpha.test.py`
- `node ./test/speciesSandboxRendering.test.mjs`
- `node ./test/flowerOcclusion.test.mjs`
- Existing Node suites: `monthlyGardenGrowth`, `plantingSystem`, `plantingMaskRefinement`, `flowerVisualSystem`, `flowerDensitySandbox`, `tulipComponentComposition`, `tulipAreaProfiles`, `tulipClusterVisualScale`, `chamomileComposition`, `hydrangeaV2Replacement`, `mixedSpeciesSandbox`, `hydrangeaMixedSandbox`.

No browser or screenshot automation. Manual visual review remains required.

## Exact implementation, test and documentation files changed

1. `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`
2. `mobile/src/components/garden/flower-density-sandbox/monthly-growth/layeredBedModel.ts` (new)
3. `mobile/src/components/garden/flower-density-sandbox/monthly-growth/growthCoverage.ts`
4. `mobile/src/components/garden/flower-density-sandbox/monthly-growth/MonthlyGrowthLayer.tsx`
5. `mobile/test/monthlyLayeredBed.test.mjs` (new)
6. `mobile/test/monthlyLayeredBedAlpha.test.py` (new)
7. `mobile/test/speciesSandboxRendering.test.mjs`
8. `mobile/test/flowerOcclusion.test.mjs`
9. `docs/flower-visuals/MONTHLY_GROWTH_V11_COVERAGE.json` (new)
10. `docs/flower-visuals/MONTHLY_GROWTH_V11_REVIEW.md` (new)
11. `docs/flower-visuals/MONTHLY_GARDEN_GROWTH_REVIEW.md` (checkpoint note only)

QA artifacts: `output/monthly-layered-bed-geometry.json` and `output/layered-bed-test-*.log`. Existing V1 count/geometry reports regenerated by regression tests retain their previous content. PNG edits: zero. Production edits: zero.
