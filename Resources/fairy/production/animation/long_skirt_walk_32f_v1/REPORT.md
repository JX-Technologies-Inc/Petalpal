# Fairy 32-frame candidate — FAILED strict motion gate

The approved 24-frame revision base is preserved unchanged. Exactly eight midpoint candidates were added at the requested **24-frame sequence indices**: 5→6, 8→9, 11→12, 13→14, 17→18, 20→21, 23→24 and 24→1. This package does not meet all requested motion-physics criteria and is explicitly marked FAILED; it is supplied for manual comparison, not production integration.

## Delivery

- `anchors/`: 24 byte-identical copies of the approved sequence.
- `inbetweens/`: eight new transparent PNGs; `frame_24_5.png` closes the loop.
- `frames/`: complete 32-frame sequence, each 378×378 RGBA. Existing anchors are copied without re-encoding.
- `frames.json`: exact anchor/midpoint mapping, hashes, timing and flow diagnostics.
- `review/contact_sheet.png`: all 32 frames.
- `review/triplets.png`: eight full-body transition triplets.
- `review/feet_light.png`, `review/feet_dark.png`: corresponding ankle/shoe details.
- `review/walk_32.gif`: forward looping preview.
- `index.html`: self-contained side-by-side approved-24/candidate-32 playback, stepping, scrub, frame labels, speed and backgrounds.

Labels such as 13.5 refer to the current 24-frame index, not the earlier 16-frame index.

## Method

New frames use destination-painting pixels warped halfway along estimated correspondence to the preceding anchor. Bidirectional dense optical flow is measured, smoothed and inverted with damped iterations; premultiplied-alpha resampling avoids a simple averaged-image dissolve. One painted surface is used, so no two-neighbor opacity blend is presented as a new pose. No generative character art, global recentering, whole-character resize, or animation rig was used. The 24→1 pair is treated cyclically using exactly those anchors.

This produces intermediate **image geometry**, not a solved human skeleton, contact trajectory or physically verified loading model. It cannot independently recover which hidden leg bears weight. It also cannot hold a contact stationary over two unchanged endpoints whose apparent planted shoe already moves. The latter is a constraint conflict with the requested strict support-lock criterion; changing original anchors or shifting the whole character was not permitted and was not done.

## Timing

Both comparison loops last 1360 ms. HTML uses **42.5 ms/frame** for 32 frames and **56.6667 ms/frame** for the approved 24. GIF uses **24 × 40 ms + 8 × 50 ms**, distributed by rounded cumulative timing, totaling exactly 1360 ms. The original 24-frame GIF/HTML/metadata are untouched.

Uniform timing with selective insertion changes anchor timestamps within the loop. Total loop speed is preserved; identical phase timing at every old anchor is mathematically incompatible with uniform new-frame duration and this nonuniform insertion pattern.

## Separate validation A–G

| Criterion | Result |
|---|---|
| A. Foot locking | **FAIL.** Apparent support-shoe displacement remains. For 20→21, the screen-right lower-shoe extent moves from x210–241 to x230–264, with the same bottom row y340. This is visible displacement of the low shoe contour, not a claim of an anatomically measured contact point. A midpoint spreads it out but cannot lock both unchanged endpoints. 5→6 and 13→14 also retain 6-pixel distal shifts. |
| B. Passing continuity | **FAIL under the strict brief.** Added frames progress spatially, but the inherited obscured-leg identity/passing ambiguity is not resolved. No gross duplicated leg was seen in the inspected new triplets; that does not establish correct support/swing mechanics. |
| C. Weight transfer | **NOT VERIFIED.** The image warp follows existing body displacement; it does not establish correct pelvis loading over the support foot. No intentionally added bounce or runway sway. |
| D. Character consistency | Existing anchors are exact. New frames retain source painting, recognizable hair/face/costume and fixed global scale; small flow deformation and detail softening remain possible. Exact identity/shape invariance of synthesized frames is not certified. |
| E. Shoe consistency | No obvious detached shoe, ankle hole or doubled heel was seen in all eight inspected triplets. Local resampling can soften heel/strap detail or slightly deform shape, so a strict zero shoe-size/shape-drift pass is not claimed. |
| F. Dress continuity | Hem transitions are intermediate and no intentional knee exposure or shortening was added. Existing petal-layout changes remain; image warping cannot prove physically consistent cloth lag or exact silhouette preservation. |
| G. Loop quality | 24→new→1 is present and inspected. It subdivides the visible transition, but seamless human-like restart is **not certified**; foot/hem differences in the fixed endpoints persist. |

The overall result is FAILED because the explicit foot-lock/passing requirements remain unmet. This does not revoke the user's approval of the 24-frame source as the revision base.

## Eight transition reviews

| Pair | Ordered visual inspection |
|---|---|
| 5→new→6 | Small lifted-foot progression; planted-shoe contour still changes horizontally. |
| 8→new→9 | Intermediate leg/heel advance; inherited occlusion change remains. |
| 11→new→12 | Restrained shoe displacement, no gross new double silhouette. |
| 13→new→14 | Subdivides loading-looking pose change; support role remains unproven. |
| 17→new→18 | Small intermediate calf/shoe motion; no obvious ankle break. |
| 20→new→21 | Largest lower-shoe displacement; fails stationary-support interpretation. |
| 23→new→24 | Subtle advance toward the last anchor; local detail softening remains. |
| 24→new→1 | Cyclic halfway geometry added with no global translation; still requires playback review for perceptual snap. |

Inspection covers the contact sheet and every light/dark transition triplet. No real-time browser visual QA was performed. No claim is made that the 32-frame playback is visibly smoother or more human-like merely because it has more frames. Use the side-by-side player for that manual decision.

## Technical checks

- All 24 original anchors match their source PNG bytes, including copies inside the 32-frame sequence.
- Exactly eight new frames, each different from both adjacent anchors; exact requested insertion order verified.
- Original 24-frame package hashes unchanged (processing dependencies excluded from the source hash inventory).
- All outputs are transparent RGBA, 378×378, with alpha bounds safely inside the canvas.
- GIF contains 32 frames totaling 1360 ms; every delay is 40 or 50 ms.
- HTML embedded assets match delivered PNGs. Player tests pass 42.5 ms timing, 1360 ms wrap, 32-frame stepping, loop midpoint, pause and backgrounds using a DOM mock.

`contact_evidence.json` records lower-shoe contour measurements; `validation.json` records technical results. These technical checks are not a visual pass. No GardenScene, application integration, landmark behavior, Blender or Spine changes were made.

Stop for manual review. Production approval is not implied.
