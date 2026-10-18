# Long-skirt Fairy shoes V2 — full-cycle review

The user-approved 90% local shoe-length treatment is applied to all sixteen existing poses. This package awaits full-cycle visual review, not application integration. Source artwork and application files were not edited.

## Delivery and preservation

- `index.html` is fully self-contained: all 32 comparison PNGs and playback code are embedded. It works offline without a server or adjacent files.
- `frames/`: sixteen corrected 378×378 RGBA PNGs. `original/`: exact source copies for inspection.
- `frames.json`: original phase order, 85 ms/frame, 1360 ms/cycle, correction status and per-frame hashes.
- `review/walk.gif` and `review/before_after.gif`: sixteen frames each, alternating 80/90 ms delays (GIF centisecond precision), 1360 ms total, forward looping only.
- Full-body, shoe-detail, light/dark alpha contact sheets and four requested transition comparisons are in `review/`.
- Per-foot masks, union masks and source-coordinate definitions are in `masks/`.

Frames 01/05/09/13 are copied **byte-for-byte** from the approved 90% variants, with their masks unchanged. The remaining twelve are each sampled once from the original PNG. Every shoe has its own mask, local heel reference, direction and short ankle blending band. Twelve new pairs of masks were added; no approved mask was revised. Definitions record every polygon and the inward feathering margin. No full-body, leg, ankle or center-based uniform scale was used. The 90% value is the same local length target; perspective and transition blending intentionally prevent identical screen-space shoe widths.

## Separate validation results

| Check | Result |
|---|---|
| Proportion consistency | All 16 inspected in order. Forefoot projection is reduced with the same conservative method. Lifted shoes retain their tilted axes; no attempt was made to equalize widths. Low-resolution sampling can soften tiny decorative details. Full-cycle aesthetic approval remains manual. |
| Ankle continuity | Full-body and enlarged shoe inspection found no obvious new ankle gaps, detached shoes, doubled straps or clipped heels. Proximal calf pixels are protected by the local blend/mask. |
| Existing contact placement | All 16 retain the exact alpha>16 lowest occupied row. Grounded-shoe corrections do not move pixels vertically. 30/32 recorded heel-reference RGBA samples are identical. The two exceptions are front-reference samples in the **already-approved** overlapping frames 05/13, where the approved local overlap resampling changes color/alpha at that coordinate; those approved PNGs are retained exactly. This is not a claim that every toe pixel/contact coordinate is fixed, or that dynamic ground locking is solved. |
| Overlapping feet | 05/13 retained exactly as approved, with separate rear-visible/front-visible masks. No combined-foot scaling or reconstruction of hidden anatomy. |
| Alpha edges | All sixteen inspected on light and dark backgrounds. No new opaque background patch or obvious detached toe remnant was seen. Existing soft alpha edges and small resampling softness remain. |
| Outside-mask RGBA | **0 changed pixels outside each declared union mask across all 16 frames**, including invisible RGB and full feathering margins. Seventy source-package files were hash-checked unchanged during processing. |

## Loop inspection

All sixteen ordered frames were reviewed in full-body and shoe-detail sheets. Original/corrected pairs for 4→5, 8→9, 12→13 and 16→1 were inspected explicitly in `review/transitions.png`; no obvious new shoe detachment or size spike was identified. The source's pose/occlusion changes at those boundaries remain. Review was ordered-frame inspection, not a claimed real-time browser/perceptual gait certification. The synchronized player and GIF support the requested manual loop review.

No crossfades, ping-pong, motion blur, generated intermediates, pose edits were introduced. The shared player clock defaults to exactly 85 ms; speed control applies equally to both sides. Play/pause, step, scrub, frame indicator and light/dark options are included.

## Tests

- `python validate.py`: passed all sixteen PNG dimensions/alpha modes, outside-mask preservation, static lowest-row preservation, original copies, four approved byte-identical copies, both GIF frame counts/durations, and embedded HTML asset identity.
- `node player.test.cjs`: passed shared clock, 85 ms default, 16→1 wrap, pause, previous/next, scrub, speed and background controls using a DOM mock. No headless browser/screenshot automation.

The smaller shoes do **not** resolve or reclassify the previously reported gait, opposite passing, identity drift or ground-locking limitations. No GardenScene, Fairy implementation, landmark interaction, Expo integration or performance architecture changes were made.

Stop here for full-cycle visual review.


## Timing-only update

Playback is now twice the prior speed: 85 ms per frame, 1360 ms per 16-frame loop. Both original/corrected HTML views use the same new clock. GIF cannot encode 85 ms exactly, so both GIFs alternate 80/90 ms for an exact 1360 ms loop. Only GIF delay bytes were patched; palettes and compressed image data were not re-encoded. Every PNG in this package remains byte-for-byte unchanged. Frame order, canvas and looping remain unchanged. The ZIP has been refreshed.
