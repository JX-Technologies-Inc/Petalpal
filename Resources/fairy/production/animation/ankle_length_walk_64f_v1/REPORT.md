# Ankle-length Fairy walk — 64-frame candidate

**Overall result: FAILED visual acceptance. Do not integrate into GardenScene.**

The requested review package is exported, but it is not a successful high-fidelity production walk. The new foot-contact trajectories are continuous and alternate; the painted skirt/shoe separation is not clean enough, passing is insufficiently readable, and retained source artwork changes remain. Increasing temporal sampling has not proven that the full character is visibly smoother at normal speed.

## Preserved source and repair scope

The approved `ankle_length_walk_32f_v1` and `ankle_length_walk_16f_v1` directories remain unchanged. Their source hashes were checked against their manifests.

- `original_anchors/`: all 32 current source PNGs, byte-identical.
- `original_16_anchors/`: the earlier 16 approved anchors, byte-identical.
- `frames/`: 64 final candidate PNGs. **These are not simply 32 untouched anchors plus 32 interpolations.**
- `repaired_anchors/`: 32 candidate copies with local shoe/opening repairs.
- `inbetweens/`: 32 additional quarter poses, sampled from existing painting rather than repeatedly resampling previous outputs.
- `masks/`: per-frame edit masks, including the one-pixel feather support.
- `anchor_repairs.json`: repaired-copy provenance and outside-mask verification.

The instruction permits repair of a specifically broken anchor. The source foot choreography fails as a complete alternating stride: the forward shoe stays at the ground while moving horizontally, and the two screen-space shoe tracks do not clearly exchange front/back roles. The largest earlier forward-shoe changes are 28 px at original 4→5 and 29 px at 12→13. Repairing only inserted samples would leave those endpoint mechanics intact. Consequently, this candidate repairs the foot choreography across the cycle. All 32 originals are preserved separately, and **RGBA outside each repaired anchor's declared local mask is exactly unchanged**.

The repair also exposes the limitation of a flattened sprite: old foot/opening pixels are interleaved with petals. Separating them leaves visible notches and short joins. A broader lower-petal retargeting experiment distorted the approved hem, so it was excluded from the final frame sequence. The final sequence keeps the approved garment painting outside the local masks.

## Method

- Two distinct shoe cutouts come from the approved original frame 1: `parts/shoe_near.png` and `shoe_far.png`. They are not mirrored duplicates. The source regions, contact references and hashes are recorded in `parts/manifest.json`.
- Shoes receive **rigid translation/rotation only**, with unit scale. No shoe length, heel geometry, floral design or color repaint is applied. Subpixel rendering uses premultiplied alpha in one sampling pass.
- Near/far leg phases are offset by half a cycle. Each has heel contact/loading, flat support, heel rise, toe loading/toe-off, swing, passing travel and pre-contact orientation.
- Heel contact begins at a restrained −6° relative to a level sole; toe-off rises to +20°. The heel is fixed during loading and the forefoot reference during toe-off. Swing follows a continuous eased path with endpoint velocity matching root travel.
- Root travel is **72 px per 1.36-second stride**, approximately **52.94 px/s**. PNGs remain in place; the review ground moves with the camera to reveal whether a planted contact stays on a world-space ground mark. A second preview shows travel through a fixed grid.
- Added upper-body samples reuse the original painting with small local wrist movement and pose-derived body rise. They do not regenerate the character, use optical flow, average entire frames or dissolve between full sprites.
- No hidden legs, knee anatomy or complete anatomical IK rig was fabricated. These are **kinematic contact curves, not force-based walking physics**. Hidden knee flexion, pelvis loading and full weight transfer are not independently solved or certified.

Near/far are stable cutout identities. They do not assert an anatomical left/right identification that the flattened source does not establish.

## Timing and exports

All 64 PNGs are transparent **378 × 378**, retain the same root registration convention and have unique hashes. Metadata and HTML use **21.25 ms/frame**, exactly **1360 ms per loop**. Original comparison playback is 32 × 42.5 ms, also 1360 ms.

GIF uses seven 20 ms delays followed by one 30 ms delay, repeated eight times: 64 frames, 1360 ms. Browser GIF decoders may schedule frames differently; the HTML player is the exact-timing reference. GIF previews use a neutral review background because GIF cannot preserve soft PNG alpha.

## Visual gate results

All frame numbers below refer to the **64-frame candidate**, unless explicitly called original-reference labels.

| Required gate | Result | Affected range and finding |
| --- | --- | --- |
| Support feet do not visibly slide | **NOT PASSED visually** | 1–64. The analytical heel/forefoot reference is stationary with root travel, but painted contact/occlusion quality is not certified. A stationary sprite-only preview cannot prove world locking. |
| Progressive swing travel | **Technical pass; visual limit remains** | Far swing 9–32, near swing 41–64. Continuous rigid trajectories, no teleport in the controls. Hem occlusion can still make the visible shoe appear/disappear abruptly. |
| Clear left/right step alternation | **FAILED** | 15–24 and 47–56. The near/far shoes exchange modeled roles, but their overlap and occlusion do not provide a sufficiently clear visible passing exchange. |
| Natural passing | **FAILED** | 15–24 and 47–56. Lifted footwear is heavily concealed and opening joins interfere with the read. |
| Identical shoe design/scale | **Technical pass, full visual gate not passed** | 1–64. Fixed distinct source cutouts, rigid unit transforms. Visible fragments/occlusion still change the apparent silhouette. |
| Stable ankle-length skirt | **FAILED join quality** | 1–64; most apparent in 9–24 and 33–56. Overall approved length remains, but removal at old foot openings leaves notches/short straight edges. No intentional skirt shortening was used. |
| No ankle/broken-leg appearance | **FAILED** | 15–24 and 47–56. No new anatomy was painted, but opening remnants and passing joins remain unsuitable for approval. |
| Character identity | **Preserved technically** | Existing face/hair/flower/wings/costume painting; no redesign. Source anchors preserved, repaired-copy pixels outside masks exact. Fine endpoint texture changes remain. |
| No loop snap | **FAILED** | 64→1. Shoe curves are periodic with root travel, but retained body/petal artwork still switches at the restart. |
| Visibly smoother than 32 overall | **NOT PASSED** | 1–64. Finer contact trajectories are not sufficient evidence of full-animation improvement. No claim of completed real-time perceptual playback QA. |

Critical original-reference intervals 4→5 and 12→13 correspond to candidate **13–17** and **45–49**. They have explicit five-frame review strips. The final seam strip is **61–64→1**.

The sequence was inspected in order on full-body, shoe-detail and light/dark transition sheets. This is not a claim that a human-equivalent full-speed playback inspection occurred. The interactive equal-duration player is supplied for that manual review. The overall status remains FAILED, regardless of successful packaging or contact equations.

## Technical validation

- `python validate_package.py`: PASS — 64 unique RGBA PNGs, common canvas, transparent 20 px borders, clean fully transparent RGB, soft alpha, 32 original copies and 16 earlier anchors unchanged, repaired copies exact outside masks, frame/timing metadata, 64-frame GIFs totaling 1360 ms.
- Analytical heel/forefoot locking sampled over two continuous strides: maximum numerical drift below `1e-9` px after applying root travel. This is a control-point test, **not** a visible-pixel or visual acceptance result.
- `node test_player.cjs`: player controls/timing validation using a mocked DOM. Tests 32/64 synchronization, 21.25 ms sampling, 1360 ms wrap, root travel, stepping, scrub, speed, backgrounds and visibility pause. See the execution result; no browser automation is required.
- No GardenScene, FairyLayer, application integration, landmark, production assets outside this new candidate directory, Blender or Spine changes.

## Review files

- `index.html`: self-contained original/refined playback, frame controls, scrub, speed, light/dark backgrounds, ground-contact comparison and world travel.
- `review/walk_64f.gif`, `review/comparison.gif`.
- `review/contact_sheet_64.png`.
- `review/transitions_light.png`, `transitions_dark.png`.
- `review/shoes_light_1.png`, `shoes_light_2.png`, `shoes_dark_1.png`, `shoes_dark_2.png`: all 64 close-ups.
- `review/shoes_without_skirt_diagnostic.png`: the actual rigid shoe poses independently of garment occlusion. This is diagnostic evidence only; it is not the delivered character animation.
- `frames.json`, `validation.json`, `parts/manifest.json`, `anchor_repairs.json`.

**Remaining production work:** the old foot openings need clean, art-approved garment overlap/occlusion repair before this contact model can read naturally through the long skirt. Passing visibility and the retained upper-body/hem endpoint changes also need resolution. This candidate is supplied for failed-gate review, not as an approved replacement for the 32-frame version.
