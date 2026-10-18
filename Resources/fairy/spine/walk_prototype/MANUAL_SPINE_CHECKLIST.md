# Beginner manual Spine checklist

## 1. Check the editor and save a separate project

Confirm your installed edition supports saving/exporting and mesh weights before spending time rigging. The trial does not enable the full save/export workflow. [Spine download information](https://esotericsoftware.com/spine-download)

Create a new project and save it here as `fairy_walk_prototype.spine`. That file does not exist yet. Keep the existing PetalPal implementation untouched.

## 2. Import and register the images

In Setup mode, set the Images tree path to `images/` relative to the saved project. Drag the 18 images into the workspace. Name slots/attachments to match their filenames. Use the Draw Order tree to place front items above back items. [First steps](https://esotericsoftware.com/spine-first-steps)

Do not align by eye. Initially parent every slot to root and set each region's center to `X=-47, Y=551`, rotation 0, scale 1, width/height 1254. Keep attachment/slot tint white, opacity full and normal blending. Never trim to opaque bounds. Reverse the row order in `layer_attachments.csv` for the UI's top-to-bottom Draw Order listing.

Compare against `reference/fairy_first_approved.png`. The full resting body, both shoes, hair and wings must match. The package's verified baseline is `review/resting_recomposition.png`.

## 3. Place bones and attach pieces

Use Create in Setup mode, selecting the parent before creating a child. Build in the order listed in `bone_pivots.csv`; use its parent-local coordinates with rotation 0 and scale 1. Root is Spine `(0,0)`; pelvis local position is `(-19,502)`. Use point/zero-length bones initially. Consult the numbered pivot image for visual guidance.

Reparent each slot to its specified bone, then enter its exact center from `layer_attachments.csv`. Recheck the resting image after each change. Set Parent and image/bone compensation help preserve setup placement. [Setup tools](https://esotericsoftware.com/spine-first-steps)

The supplied local coordinates assume zero setup rotations throughout the hierarchy. Do not rotate a bone to point down a limb and retain the old numeric attachment coordinates. Do not move image content to fit a guessed pivot.

## 4. Make legs articulate without changing artwork

Convert each leg region to a mesh using its Mesh option. Keep the texture and setup vertex positions unchanged. [Region/mesh option](https://esotericsoftware.com/spine-regions)

Add enough mesh vertices around the visible hip, knee and ankle for restrained bending; do not create painted anatomy. Select the mesh, open Weights, choose Bind, select its thigh/calf/foot bones, and finish binding. Inspect and adjust weights: shoes should remain rigid, with blending concentrated at joints. [Mesh weights](https://esotericsoftware.com/spine-weights)

Rotate one control slightly and undo to test it. If a gap appears, reduce the range; do not paint a filler. A rigid whole-leg region attached only to a thigh cannot provide the requested knee/ankle articulation. If your edition lacks the necessary mesh tools, stop instead of substituting a sliding rigid pose.

## 5. Author the walk

Switch to Animate, create `walk_prototype`, and set timeline FPS to 24. Key the bone properties you intend to change at frame 0. Follow all nine rows in `WALK_TIMING.md`; frame 24 repeats frame 0. Initially inspect stepped poses, then refine interpolation. Property key buttons record changes; changing a property without a key does not reliably define a pose. [Animation basics](https://esotericsoftware.com/spine-first-steps)

Keep image scale, tint, slot order and setup registration unchanged. Check heel contact, weight transfer, knee movement and toe release before adding wing or skirt motion. Use the separate travel check in the timing sheet to detect sliding. Do not create a Swing back pose or any other animation.

## 6. Export a transparent review sequence

Save the project. Open Export and choose PNG image sequence, selecting only `walk_prototype`. Use 12 FPS over the one-second loop; omit the duplicate last frame. Disable packing so the result is individual PNGs. Set background alpha to zero and verify transparency in the export preview. [Export options](https://esotericsoftware.com/spine-export)

Use scale 100% and a fixed 1254 × 1254 output rectangle for every frame. The source canvas corresponds to Spine world X `[-674,580]`, Y `[-76,1178]`. Use the explicit Crop/bounds controls to frame that rectangle, checking the orange preview bounds; do not use changing automatic per-pose bounds. No shoe, wing or hair may cross the export boundary. If motion exceeds this canvas, reduce the motion for this prototype rather than clipping it or changing source registration.

Export under `exports/walk_prototype/`. Expected output is 12 unique RGBA PNG frames, not a claim that those files currently exist. Recheck the actual frame count, identical dimensions, transparent corners and the loop seam. Keep a separate resting export for comparison to the supplied master. [PNG export settings](https://esotericsoftware.com/spine-export)

## 7. Manual review gate

Inspect full-size and uniformly scaled 96 / 108 / 120 px character-height playback. Require intact shoes, stable proportions/colors, no gaps, sensible foot contact, and no frame registration jitter. Report any limitation caused by missing overlap pixels. Only your saved Spine project and exported frames establish that a working rig and animation exist. Do not integrate into Expo until visual approval.
