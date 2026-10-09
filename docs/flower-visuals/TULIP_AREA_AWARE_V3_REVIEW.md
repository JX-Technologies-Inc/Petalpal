# Tulip Area-Aware Composition V3 — DEV manual review

V3 changes only the seeded density class and internal component-root spacing. Component artwork, normalized anchors, individual component scales/rotations, color-family rules and all production systems remain unchanged. Tulip stays READY_FOR_REVIEW.

## Area source and thresholds

The existing `getRegionInfo(month).estimatedArea` sums accepted samples from `isPointInApprovedMonthMaskWorld` on a 2-world-pixel grid, including approved Add/Remove refinements and offsets. Land bounds provide only the sampling window; their rectangle area is never used to classify a month. Values below are therefore estimates of the approved plantable Final Mask area, not image dimensions.

- SMALL: area < **45,000 world px²**.
- MEDIUM: **45,000 ≤ area < 90,000 world px²**.
- LARGE: area ≥ **90,000 world px²**.

These rounded thresholds lie in gaps in the measured twelve-region distribution (41,818→53,976 and 84,312→90,340). There is no month-name special case. A month's classification follows its approved-mask area.

| Month | Land | Mask area ≈ world px² | Profile |
|---|---|---:|---|
| January | Land01 | 38,504 | SMALL |
| February | Land02 | 41,818 | SMALL |
| March | Land03 | 40,120 | SMALL |
| April | Land04 | 53,976 | MEDIUM |
| May | Land05 | 34,572 | SMALL |
| June | Land06 | 33,020 | SMALL |
| July | Land07 | 84,312 | MEDIUM |
| August | Land08 | 84,184 | MEDIUM |
| September | Land09 | 90,340 | LARGE |
| October | Land10 | 104,592 | LARGE |
| November | Land11 | 99,474 | LARGE |
| December | Land12 | 78,280 | MEDIUM |

## Starting visual profiles

| Profile | Sparse | Normal | Full | Internal spread |
|---|---:|---:|---:|---:|
| SMALL | 45% | 45% | 10% | 1.00 |
| MEDIUM | 25% | 50% | 25% | 1.08 |
| LARGE | 10% | 45% | 45% | 1.15 |

The density draw includes version, flowerId, TULIP, month, land ID and area profile. Weights define probabilities, not exact quotas for any 10- or 30-flower sample. Once selected, density uses the existing V2 component assembly with the same artwork size baseline. Spread multiplies only local X/Y offsets relative to one world ground anchor. It does not scale PNGs or collision circles. Visible bounds are recalculated for the shifted parts; internal Y order and whole-object ground depth remain intact.

One journal flower remains one record, one anchor and one **radius-12** footprint. The composition mapper returns exactly one result per supplied object, including 30 outputs for 30 inputs. It never packs, validates or creates planting objects. The existing sandbox placement capacity is preserved: October 30/30, June 24/30 requested, October close-review 10/10. No hidden flowers or extra anchors are added to fill June's six rejected placements.

Open grass is deliberately retained. V3 biases Large toward fuller clusters with 15% wider root offsets; it does not target carpet coverage or force October to match June's apparent density. Final visual balance needs manual review.

## DEV review controls

Use **Component Composition V2** / **Area-Aware Composition V3** on the same existing positions. Old Fixed Prefabs also remains available. V3 is the new default; all three presets remain available: October 30, June 30, October 10.

The panel shows approved mask area, profile, Sparse/Normal/Full percentages and Internal Spread. Percentage edits rebalance the other two proportionally to keep the total exactly 100%. Spread is bounded to 0.80–1.30. Edits affect only the selected Small/Medium/Large profile, remain in temporary component state and reset on exit or with Reset area profiles. No storage writes occur.

Use `auto` composition to apply area weights. Explicit Sparse/Normal/Full controls remain available for inspection and override only the density draw; the panel explains this. V2 ignores profile edits and retains its original hash-selected density and 1.00 spread. Both modes share the same visual scale control and unchanged placement layout.

Secondary #1 and #2 remain NONE. No emotion rendering or source artwork changes were made.

## Validation

`tulipAreaProfiles.test.mjs` covers all twelve classifications and threshold boundaries, swapped-area checks proving classification does not depend on the month name, 3,600 deterministic compositions, statistical profile differences, identical component scales/rotations/asset selections for a fixed density, offset-only spread, coherent bounds, 30-in/30-out, radius 12, unchanged V2/V3 positions/depth, profile tuning and mask hashes.

Observed densities over 1,200 IDs per profile:

| Profile | Sparse | Normal | Full |
|---|---:|---:|---:|
| SMALL | 501 | 571 | 128 |
| MEDIUM | 303 | 618 | 279 |
| LARGE | 142 | 546 | 512 |

TypeScript and the V3 tests passed. Existing planting (158 assertions), refinement (57), flower visual system (2,220), V2 component tests (1,200 identities plus density cases), fixed-Tulip review and sandbox regression (1,735 full footprints across all 12 months × four modes, with V2 grouping checks) passed. Component extraction verification confirms the 28 PNGs and their metadata are unchanged; 49 protected production/source files also retain their hashes. No headless Chrome or screenshot automation ran.

## Files changed

- Modified: `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`.
- Created: `mobile/src/components/garden/flower-density-sandbox/tulip-components/tulipAreaProfiles.ts`.
- Created: `mobile/test/tulipAreaProfiles.test.mjs`.
- Created: `docs/flower-visuals/TULIP_AREA_AWARE_V3_REVIEW.md`.

STOP for manual review. No automatic Tulip approval, other species work or production integration.
