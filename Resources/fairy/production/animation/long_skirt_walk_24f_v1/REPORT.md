# Fairy 24-frame midpoint candidate — manual visual review required

Sixteen approved shoe-V2 anchors are preserved byte-for-byte. Exactly eight synthesized midpoints were inserted, only at 1→2, 3→4, 5→6, 7→8, 9→10, 11→12, 13→14, 15→16. The approved source package is unchanged. No application/Garden integration, replacement sprite-sheet generation, Blender or Spine work was performed.

## Deliverables

- `anchors/`: exact copies of the sixteen approved PNGs.
- `inbetweens/`: eight new RGBA PNGs, named by preceding anchor (`frame_01_5.png`, etc.).
- `frames/`: final sequence, 01–24; `frames.json` maps every index to its anchor/midpoint label and hash.
- `review/contact_sheet.png`: all 24 frames in requested order.
- `review/triplets.png`: all eight anchor–midpoint–anchor groups.
- `review/feet_light.png`, `review/feet_dark.png`: all eight shoe/ankle transition groups on both backgrounds.
- `review/walk_24.gif`: looping 24-frame preview.
- `index.html`: self-contained side-by-side 16/24 player, play/pause, previous/next, scrub, frame labels, speed and light/dark backgrounds. Both views share the same loop timeline; no runtime crossfade or interpolation.

All PNGs are 378×378 with the existing coordinate origin. No global recentering or rescaling was applied. Existing anchors inside the final sequence are copied as files, not re-encoded.

## Synthesis method and limits

Python/OpenCV dense optical flow estimates correspondence between each supplied pair. A smoothed, damped inverse map moves destination-anchor pixels halfway toward the preceding pose. Premultiplied-alpha resampling retains the existing painting rather than generating a new identity. New frames are neither copies nor unwarped dissolves. The full visual field supplies estimated torso, shoulder/hand, hem, hair and wing displacement; these are image correspondences, not a biomechanically rigged model with independently proven body-part motion.

The initial dual-image blend produced doubled legs at 5→6 and 13→14. It was rejected internally. Final synthesis uses one warped painted surface to avoid double silhouettes. For those two occlusion-heavy pairs, explicit heel, ankle and toe correspondences place landmarks at arithmetic midpoint coordinates, with a thin-plate-spline lower-region warp. Coordinates are recorded in `frames.json` and `synthesize.py`. No hidden leg is newly painted. These two midpoints remain the highest-risk review areas because occluded anatomy cannot be inferred exactly from flattened anchors.

## Timing

- HTML: 1360/24 = **56.6667 ms per frame**, exactly **1360 ms per loop**.
- Original comparison: sixteen frames at **85 ms**, also 1360 ms.
- GIF: eight 50 ms and sixteen 60 ms delays, distributed using rounded cumulative centiseconds; exact total **1360 ms**. Actual per-frame values are in `frames.json`.

Uniform 24-frame timing was requested. Since only alternating anchor intervals receive a midpoint, the original anchor timestamps cannot all remain unchanged at the same time. Inserted intervals now span two 56.667 ms slots; untouched intervals span one. Total pace is unchanged, but phase timing is redistributed. No insertion was made at other pairs or at 16→1.

## Visual checks, separated from technical checks

All eight triplets were inspected in order, including feet against dark backgrounds. Full-body scale/identity was inspected on the 24-frame contact sheet. This is still-frame/triplet inspection, not a claim that real-time playback has been demonstrated smoother.

| Pair | Inspection finding |
|---|---|
| 1→1.5→2 | Intermediate ankle/heel position; initial jagged alpha around calf/hem was reduced with stable inverse-map convergence. Slight resampling softness remains. |
| 3→3.5→4 | Small lifted-foot progression; no gross duplicate leg in inspected output. |
| 5→5.5→6 | Guided separation removes initial doubled legs. Inspect shoe contour and skirt/leg boundary closely; local deformation remains possible. |
| 7→7.5→8 | Restrained position change; no gross wing or foot jump seen in triplet. |
| 9→9.5→10 | Intermediate lifted shoe placement; not a newly proven ground-contact phase. |
| 11→11.5→12 | Small lower-leg progression; no gross duplicated foot seen. |
| 13→13.5→14 | Guided split removes initial overlapping ghost feet. Highest risk of local shoe/hem shape stretching; manual approval required. |
| 15→15.5→16 | Intermediate foot/ankle progression; original 16→1 transition remains untouched. |

| Required check | Result / qualification |
|---|---|
| Identity | Same source painting and no new design. Pixel-perfect identity cannot be claimed for resampled midpoints; face detail may soften. Anchors are exact. |
| Scale/registration | Same canvas and global registration; no whole-character scale transform. Local flow can still alter silhouettes slightly. |
| Shoe size | Uses corrected source shoes. No intentional additional size change; 5.5/13.5 local warps need close visual approval. |
| Skirt length | Uses existing hem correspondence, no intentional shortening. Local hem distortion at occlusions remains a review risk. |
| Wings/hair | No new design or flapping. Only estimated small image displacement; texture softness possible. |
| Teleporting/duplicated legs | No gross duplicated legs in final triplets; explicit halfway landmarks replace ambiguous flow at 5.5/13.5. This does not prove anatomically correct gait. |
| Ground sliding | **Not certified resolved or absent.** The source has no explicit world-space contact track; interpolated contact and uniform retiming require playback review. |
| Alpha edges | Transparent RGBA and safe canvas padding verified. No gross opaque background rectangle; resampling can soften fine edges, especially at hems. A zero-artifact guarantee is not made. |
| Smoother playback | **Not claimed.** More samples alone do not establish a better walk; approve using the synchronized HTML comparison. |

## Technical validation

`python validate.py` passed: all sixteen anchors byte-identical in both anchor and final-sequence copies; all eight midpoints differ from both neighbors; exact sequence order; all source-package hashes unchanged; 378×378 RGBA and noncropped alpha bounds; 24 GIF frames totaling 1360 ms; HTML embedded image identity.

`node player.test.cjs` passed: loop duration, stepping, ordering, scrub, shared timeline, pause and backgrounds (DOM mock, not browser visual QA).

The isolated `_tool_deps/` directory contains OpenCV for reproducibility, is Git-ignored and excluded from the delivery ZIP. Review HTML needs no dependency or server. Rebuilding synthesis requires Pillow, NumPy and OpenCV; the original shoe-V2 source must be alongside this package.

Stop for visual review. Neither improved smoothness nor production readiness is automatically approved.
