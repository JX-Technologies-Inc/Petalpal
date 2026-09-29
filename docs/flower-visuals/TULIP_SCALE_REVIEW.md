# Tulip final scale comparison — awaiting manual approval

The Garden adaptation direction has been approved by the user. Asset status remains **READY_FOR_REVIEW**, not APPROVED.

| Composition | Current effective visualScale | Tuned effective visualScale | Reduction |
|---|---:|---:|---:|
| Sparse | 1.00 | 0.95 | 5% |
| Normal | 1.00 | 0.89 | 11% |
| Full | 1.00 | 0.82 | 18% |

These values are applied only through the existing DEV preview scale multiplier. The manifest's base scale remains 1.0 to retain the original comparison; no approval metadata or generated asset binding is changed. The review panel shows all three effective values, including any additional temporary user scale adjustment. Clicking either A/B button resets that adjustment to 1.0.

In Flower Density Sandbox, **Tulip Current Scale** and **Tulip Tuned Scale** both select October / Land10, 30 requested flowers, Tulip only, automatic seeded compositions, neutral base art, and debug overlays off. The default is Tuned. Both use the same placement results and Sparse/Normal/Full assignments. June / Land06 remains available and retains the selected profile (24 of 30 requested fit the unchanged existing constraints).

M-class soil footprint radius remains **12 world px**. Production footprint configuration is untouched. Anchors, deterministic grouping/positions, composition hashes, depth sorting and PNG bytes remain unchanged. Both secondary emotions are NONE. No recoloring or emotion architecture changes.

Scale reduces Full's visual mass but does not open new gaps within the artwork. If Full still needs a more airy structure after manual review, that requires a future artist-supplied revision. No repainting, alpha removal or procedural reconstruction was attempted.

**Future art direction:** Tulip production variants may use slightly different natural coral/pink-to-yellow balance across Sparse / Normal / Full while preserving the same Tulip identity. This is art variation, not emotion variation, and must not be implemented through arbitrary runtime hue shifts.

Files changed for this pass:

- `mobile/src/components/garden/flower-density-sandbox/tulipReviewPreset.ts`
- `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`
- `mobile/src/components/garden/flower-visuals/FlowerEmotionPreview.tsx`
- `mobile/test/tulipGardenReview.test.mjs`
- `docs/flower-visuals/TULIP_SCALE_REVIEW.md` (new)

Stop for manual review; do not promote Tulip to APPROVED automatically.

QA passed: `npx tsc --noEmit`; Flower Visual System (2,220 assertions); Tulip review tests including A/B geometry invariance; sandbox regression (1,735 footprints, all 12 months × four modes, V2 grouping checks). Asset validator passed with three valid candidates. Hash checks confirmed all three PNGs and 49 protected files unchanged, along with recorded anchors and READY_FOR_REVIEW status. No headless Chrome or screenshot automation ran.
