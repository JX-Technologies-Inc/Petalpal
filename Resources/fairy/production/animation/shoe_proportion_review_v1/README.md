# Shoe proportion — first size review only

Status: awaiting user's size choice. The current 16-frame long-skirt candidate is the accepted revision base. This does not supersede its unresolved gait/passing/ground-lock findings.

Only frames 01, 05, 09 and 13 have trial outputs, each at 90% and 85% local shoe-length targets. Original frames, frames.json and REPORT.md remain untouched. No full sequence or new animation was produced. All trial PNGs retain the original 378×378 canvas and registration; the source timing remains 170 ms/frame.

## Review

- `review/full_comparison.png`: each row is one frame; columns Original / 90% / 85%, full-body comparison at the same scale.
- `review/feet_comparison.png`: identical source-coordinate crop enlarged 4× with nearest-neighbor sampling; no independent shoe scaling in the review layout.
- `variants/090/` and `variants/085/`: eight transparent trial PNGs.
- `masks/`: eight separate foot masks and four union masks. `definitions.json` records polygons, local axes, stationary heel references, and ankle transition bands in source pixels.
- `validation.json`: source file hashes and all outside-mask comparisons.

## Local treatment

Deterministic Python/Pillow/NumPy masked resampling, using only the current source pixels. No image generation, redrawing, pose replacement, full-frame scaling, calf/leg shortening, or color adjustment.

Each shoe is handled separately. Distal shoe pixels are compressed toward a stationary heel reference; the change fades to zero at the short ankle junction. Grounded shoes retain vertical coordinates and heel references, so the local correction cannot raise the grounded shoe. Frame 09's screen-left lifted shoe uses its diagonal heel-to-toe axis and stays lifted. This is not center scaling. The 90%/85% labels are local artistic targets: ankle blending and occlusion protection mean the entire visible bounding-box ratio is not uniformly 0.90/0.85.

Frames 05/13 have separate rear-visible/front-visible masks and source-sampling protection at painted occlusion boundaries. The rear shoe is treated conservatively where the front shoe hides it; no missing hidden anatomy is generated. Existing foreground overlap is retained. Thin gold straps, petals and heel pixels are resampled, not redesigned. At this low source resolution, subpixel compression can soften a small decorative pixel detail, especially at 85%.

Masks include all feathering. Feathering is inward (2-pixel erosion plus 0.7-pixel Gaussian transition); the mask is hard-clipped outside the declared polygon. Distal empty padding is included so the old toe is removed cleanly rather than left as a detached fragment. Pixels outside each union mask are copied byte-for-byte from the original, including RGB values under zero alpha.

## Checks and limits

| Area | First-review result |
|---|---|
| Proportion | Both variants visibly reduce toe projection; 90% is more conservative, 85% more noticeable. User choice pending. |
| Ankle continuity | Four-frame full-body and enlarged-foot inspection found no obvious ankle gap, detached heel or doubled strap. Calves above the blending region remain unchanged. |
| Contact preservation | Source heel reference positions remain fixed; alpha>16 bottom rows are unchanged: 01=343, 05=341, 09=342, 13=341. This checks static placement only, not pre-existing gait ground-lock. |
| Overlapping shoes | Separately edited; not resized as one combined silhouette. Hidden portions are not newly reconstructed. |
| Protected pixels | All eight trials: **0 changed RGBA pixels outside the union masks**. All 16 original PNG file hashes unchanged. |
| Frame-to-frame sizing | Only four requested samples reviewed. Complete-sequence consistency is intentionally not claimed before size approval and propagation. |

The original motion, frame ordering, timing and all application code are unchanged. Smaller shoes do not resolve or reclassify the earlier gait, opposite-passing or support-foot-lock limitations.

Next step is the user's size choice. Do not propagate to the other 12 frames before that choice.
