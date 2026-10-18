# Fairy walk V3 — isolated locomotion review

Status: exported for MANUAL VISUAL REVIEW, not production approval. No Expo or Garden integration.

## What changed

The rejected V2 standing-pose motion is replaced by an eight-phase gait: Left Contact, Down, Passing, Up, then Right Contact, Down, Passing, Up. The 24-frame loop runs at 16 fps (1.5 seconds). Each half-cycle has a support leg and a lifted swing leg; swing lift is 35 source pixels. Root travel is 280 source pixels per cycle. The review camera follows the root; the separate fixed-camera preview shows three cycles of actual advance.

An analytic two-link leg solve drives real Blender thigh/calf/foot bones. Heel and toe roll compensate ankle targets around the contact point, rather than sliding a standing image. Pelvis height varies by eight source pixels peak-to-peak, lateral shift by eight. Arm motion is 0.6 degrees, wings 0.25 degrees, petals 0.15–0.25 degrees. The camera-facing artwork remains a 2D cutout; this is not a new 3D model.

## Necessary layer repairs

The unchanged V2 legs failed larger separation: fragmented thigh contours, holes, detached calf strips and residual leg pixels in non-leg layers became visible. Small transforms were not used to hide this failure.

`reconstruction_sources/complete_legs.png` is a new built-in image-generation repair using the isolated V2 legs and approved master as references. Only continuous leg contours/hidden anatomy were reconstructed. `repair_motion_layers.py` registers this material to the existing hip/knee/ankle coordinates, retains the approved original shoe pixels below the ankle transition, and adds concealed upper-thigh overlap. It also removes detached leg residue from motion-only non-leg layers. Generated leg shading and contour reconstruction require visual review; they are not claimed to be original source pixels.

All changes are isolated copies here. The source `animation_ready_v2` package and Fairy master remain unchanged. `rest_images/` holds byte-identical V2 copies. Frame 0 uses those original textures and identity bone transforms; frames 1–25 use `images/`, the repaired motion textures. The Blender material nodes explicitly encode the same switch. This is an animation-specific leg-art state, not a claim that the original V2 layers alone support the new gait. An idle-to-walk art/pose transition is not included in this review.

Every texture canvas remains 1254 × 1254. Face, hairstyle, flower, upper-body design, wings and costume are not regenerated. The skin repair is scoped to the legs; the approved shoe art is retained rather than using generated shoes.

## Review files

- `fairy_v3_walk_prototype.blend`: editable 32-bone rig, packed textures, actual keyframes and armature modifiers. Frame 0 = approved rest; frames 1–24 = walk; frame 25 = closing pose plus one cycle of root travel.
- `frames/walk_001.png` … `walk_024.png`: full 1254² transparent sequence.
- `review/eight_gait_phases.png`: all eight named phases side-by-side. Cyan marks the left ankle, gold the right; these guides are review-only.
- `review/walk_preview.png`: transparent animated PNG.
- `review/walk_preview.gif`: tracking-camera preview.
- `review/world_travel_preview.gif`: fixed-camera advance over three cycles.
- `review/runtime_preview.gif`: 96/108/120 px preview.
- `review/resting_recomposition.png`: unchanged approved rest.
- `validation.json`: numerical checks and exact changed motion-layer list.

## Rendering and limits

The supplied exporter rasterizes actual Blender-evaluated armature meshes using straight-sRGB source-over compositing. Native Eevee transparency still differs from the approved painting; use the supplied PNGs for appearance review, not F12 as an exact-match reference.

The repaired leg artwork needs manual approval. Fine painterly cutout edges and sleeve boundaries can remain visible at full resolution. This is one camera-facing gait, not multi-directional animation. Heel/toe anchors are approximate source-pixel landmarks, not a 3D sole simulation. No automatic visual approval is implied by numeric foot-lock tests. Root movement is authored for one cycle; the review script repeats its displacement for the fixed-camera demonstration.

## Rebuild

From repository root:

1. `python Resources/fairy/blender/walk_prototype_v3/repair_motion_layers.py`
2. Run Blender 5.2.2 with `--background --factory-startup --python Resources/fairy/blender/walk_prototype_v3/build_blender.py`.
3. `python Resources/fairy/blender/walk_prototype_v3/render_review.py`
4. `python Resources/fairy/blender/walk_prototype_v3/make_phase_review.py`
5. `python Resources/fairy/blender/walk_prototype_v3/validate.py`

Run these sequentially; do not replace mesh caches during an export.

Quantitative checks: opposite contact ankle order +88.16 / -110.84 px; measured support-point drift below 0.0001 px; no folded triangles. Painted mesh local scale varies approximately 0.42-1.40 under the larger joint rotations, so local compression/stretch remains a visual-review limitation rather than a certified deformation-free result. Closing geometry agrees within 0.00011 px after removing root travel; raster closure is not byte-identical because of floating-point sampling. The exported loop does not include the duplicate closing frame.
