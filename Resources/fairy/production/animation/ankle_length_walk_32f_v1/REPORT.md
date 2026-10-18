# Ankle-length Fairy walk — 32-frame candidate

**Status: ready for manual comparison, not an automatic visual PASS.**

This package contains 16 unchanged approved anchors and 16 new pose-directed cutout in-betweens. It does not overwrite the approved `ankle_length_walk_16f_v1` package. No GardenScene, Fairy implementation, Expo, landmark or application files were edited.

## Contents and timing

- `frames/frame_01.png` … `frame_32.png`: final RGBA sequence, all **378 × 378**.
- `anchors/frame_01.png` … `frame_16.png`: byte-for-byte copies of the approved source files.
- `inbetweens/frame_01_5.png` … `frame_16_5.png`: the 16 new samples separately.
- `frames.json`: ordered labels, provenance, SHA-256 hashes, timing and registration.
- `motion_controls.json`: source-pixel shoe/wrist tracks, donor choice and per-part transforms.
- `index.html`: self-contained offline side-by-side 16/32 player, pause/play, stepping, scrub, speed, backgrounds, baseline and critical-transition loops; also runtime-size checks.
- `review/walk_32f.gif`, `review/comparison.gif`: looping neutral-background previews.
- `review/contact_sheet.png`: all 32 frames in playback order.
- `review/critical_transitions.png`, `critical_transitions_dark.png`: 4/4.5/5, 12/12.5/13, 16/16.5/1, each with full-body and shoe views.
- `review/shoe_detail_light.png`, `shoe_detail_dark.png`: every frame's lower hem and shoes.
- `validation.json`, `validate_package.py`, `test_player.cjs`: reproducible technical checks.

Sequence: **1, 1.5, 2, 2.5, …, 16, 16.5 → 1**. HTML/PNG metadata use **42.5 ms/frame**, **1360 ms total**. The original comparison uses 85 ms/anchor and the same total duration. GIF uses `[40, 40, 50, 40]` repeated eight times: 32 frames, 1360 ms. Its original-side holds are 80/90 ms, the centisecond approximation of 85 ms. GIF is a review format on a neutral background; the PNGs retain soft RGBA transparency.

## How the new poses were made

This is deterministic local cutout articulation using existing painting, not global image generation, optical flow, duplicate-frame insertion or an average of two endpoint images.

1. Each shoe has a separate screen-space track. Its new location is halfway between its endpoint landmarks. The source shoe is translated at **unit scale with no rotation or shear**; its lavender/gold painting and silhouette are not redesigned. Subpixel translation uses one premultiplied-alpha sampling pass and can slightly soften an edge.
2. The more separated adjacent pose supplies the painting. This lets the lower-petal panels overlap as the stance closes, instead of exposing or inventing hidden anatomy. The two panels remain pinned above y=235 and follow their respective shoe/covered-ankle tracks below. Horizontal panel scale stays 1. No skirt shortening is used to reveal joints.
3. A local arm/hand control mesh moves toward the endpoint wrist midpoint. Body rise follows the two endpoint body-top measurements, by at most one pixel. This is pose motion in the existing registration, not independent rescaling/recentering. Face, hair, flower and wing texture come from the adjacent source painting; they are not repainted. Wing/hair articulation is not independently reconstructed.
4. The sprite root convention remains x=187, y=342. No world translation, new root-motion curve, anatomical rig or gait retiming was introduced.

These controls make intermediate shoe/hand/body positions. They **do not reconstruct hidden leg anatomy or certify actual support-leg loading**. Pelvis loading and ankle rotation under the opaque overlapping painting cannot be independently verified from this source. No claim is made that an anatomical simulation now exists.

## Visual inspection and limits

Ordered full-body frames and all lower-hem/shoe samples were inspected, including dark-background edge views and the three required critical triplets.

| Check | Finding |
| --- | --- |
| Identity / costume / scale | Existing painting retained; no new face, shoe design, wings, colors or whole-character scale. Small endpoint painting differences remain. |
| Shoe geometry | Independent unit-scale translations preserve the donor shapes. Original perspective/shape differences between the approved anchors remain; they are not normalized away. |
| Long skirt / ankle coverage | Coverage remains in the in-betweens. No newly drawn calf or exposed knee/ankle seam. Lower petal overlap changes where the stance narrows. |
| Garment joins | Initial pinched mesh joins were removed in favor of overlapping panels. At enlarged size, the central panel overlap in 4.5/12.5 and neighboring crossing samples can still be noticed as a changed petal overlap. This needs manual playback review. |
| Anatomy / separate shoes | No new leg painting, duplicated shoe ghost or averaged double silhouette was added. Source close/overlapping poses 5 and 13 remain exactly as approved. Anatomical left/right identity is not newly established. |
| Alpha | Soft RGBA, transparent padding and zero RGB in fully transparent pixels checked. Source edge softness/fringe and pale wing opacity are inherited. Fractional sampling can add minor softness; full-size dark review aids are supplied. |
| Wing / hair continuity | Original painting is retained with restrained body rise. Endpoint wing/strand contour differences are still present; no claim that every fine contour is temporally interpolated. |
| Smoother overall motion | Not certified by file count or control-point measurements. The player permits actual equal-duration A/B review. Full-speed perceptual improvement remains a manual judgment. |
| Foot popping / ground lock | Intermediate positions reduce each landmark interval, but do not prove zero popping or zero sliding. World-space support locking is not added. |
| Loop | 16.5 is specifically built from 16/1. Shoe landmarks are close; existing upper-body/petal endpoint differences may still create a visible restart. No unconditional “no snap” claim. |

### Critical transition measurements

Distances below describe the **declared painted-shoe control tracks**, not a perceptual motion score or a force/contact simulation.

| Interval | Rear-shoe endpoint distance | Each midpoint substep | Front-shoe endpoint distance | Each midpoint substep |
| --- | ---: | ---: | ---: | ---: |
| 4 → 5 | 29.83 px | 14.92 px | 28 px | 14 px |
| 12 → 13 | 45.88 px | 22.94 px | 29 px | 14.5 px |
| 16 → 1 | 1 px | 0.5 px | 1 px | 0.5 px |

The critical new frames place the shoes progressively between the endpoints. **12→13 remains a fast, large stance change even with the extra sample**. One added frame at unchanged loop duration cannot remove the underlying endpoint velocity. The package does not label the no-foot-popping gate as passed. First compare the full loop at 1×, then inspect these transitions slowly; the local-repeat controls intentionally restart their three-frame excerpts and should not be mistaken for the full-cycle seam.

## Validation executed

- `python validate_package.py`: PASS for 16 original anchor hashes against the source manifest and both output copies; 32 RGBA canvases; 16 distinct new samples; correct order; exact 1360 ms PNG/HTML timing; 20 px transparent borders; soft alpha; no hidden RGB in empty pixels; valid local arm mesh; unit shoe transforms; declared midpoint tracks; 32-frame looping GIFs totaling 1360 ms.
- `node test_player.cjs`: PASS for self-contained images; equal-duration 16/32 comparison; 42.5 ms stepping; 1360 ms wrap; play/pause; previous/next; scrub; speed; light/dark backgrounds; baseline toggle; all critical loops; visibility pause; synchronized close-ups/runtime views. This is a mocked-DOM control/timing test, **not** browser or perceptual playback QA.
- No headless browser, screenshot automation, Blender, Spine or application integration was used.

Build helpers expect the adjacent approved 16-frame package, Pillow/NumPy and the existing local OpenCV dependency directory. Playback and delivered assets require none of those dependencies.

**Handoff:** manually decide whether this candidate is visibly smoother and whether the central-petal overlaps and source foot/loop limitations are acceptable. The approved anchors remain untouched; this package is not automatically approved for Garden integration.
