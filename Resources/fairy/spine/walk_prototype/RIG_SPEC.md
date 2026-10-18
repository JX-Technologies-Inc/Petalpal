# Proposed rig specification — manual construction required

All pivot locations are approximate starting points, not a validated rig. Left/right names mean **screen left/right in the approved image**. Keep these labels even while leg roles alternate.

## Registration contract

Canvas: 1254 × 1254 source pixels; origin top-left, X right, Y down. Root/ground registration is source `(674,1178)`. Pelvis is approximately `(655,676)`. Do not resize or trim the images.

Spine world coordinates: `X = sourceX - 674`, `Y = 1178 - sourceY`.

Every image's full-canvas center is `(627,627)` in source coordinates. Initially attached to root, its Spine center is `(-47,551)`. With all setup bone rotations zero and scales one, an image attached to a bone at `(bx,by)` has local center `(627-bx, by-627)`. Use the exact attachment values in `layer_attachments.csv`, not the opaque-content center. Spine region translation locates the image center. [Region documentation](https://esotericsoftware.com/spine-regions)

`bone_pivots.csv` lists source, Spine world, and parent-local positions for every bone. Start with zero-length control bones, rotation 0 and scale 1. Do not aim their axes along limbs while still using these zero-rotation local coordinates. Changing setup orientations requires compensating child/attachment transforms to preserve the same world-space rest pose.

## Hierarchy

```text
root
└─ pelvis
   ├─ torso
   │  └─ chest
   │     ├─ neck → head
   │     │        ├─ hair_back
   │     │        ├─ hair_front
   │     │        ├─ braided_updo
   │     │        └─ flower
   │     ├─ upper_arm_left → forearm_left → hand_left
   │     ├─ upper_arm_right → forearm_right → hand_right
   │     ├─ wing_left
   │     └─ wing_right
   ├─ thigh_left → calf_left → foot_left → heel_left / toe_left
   ├─ thigh_right → calf_right → foot_right → heel_right / toe_right
   └─ skirt_base
      ├─ petals_front
      ├─ petals_side
      └─ petals_back
```

## Origins and attachment strategy

| Control | Source pivot | Purpose |
|---|---|---|
| pelvis | 655,676 | Shared weight shift; never independently rescale body parts |
| torso / chest | 686,422 / 662,320 | Restrained waist/chest counter-motion |
| head / neck | 650,266 | Stable neck pivot; preserve face and hair identity |
| thigh L / R | 629,688 / 662,682 | Whole-leg mesh hip controls |
| calf L / R | 629,842 / 686,833 | Approximate knees; inspect painted geometry before weighting |
| foot L / R | 606,1014 / 699,1025 | Ankle controls; keep shoe shape rigid |
| wing L / R | 567,357 / 724,358 | Small rotation at painted wing roots |
| skirt_base / front | 686,422 | Waist attachment; keep upper costume registered |
| side / back petals | 590,460 / 655,450 | Small secondary motion only where seams remain covered |

The CSV includes every hair, flower, arm, hand, heel and toe pivot. `layer_attachments.csv` is the complete layer-to-bone mapping. Its row order is **back to front**; the Spine Draw Order tree must show the reverse order from top to bottom.

Begin with rigid region attachments for all pieces except legs. Bind each whole-leg mesh to its corresponding thigh, calf and foot bones. Weight the shoe predominantly to the foot, shin to calf and upper visible leg to thigh; use narrow, inspected blends around joints. Keep mesh vertices at original positions in setup. Hand/heel/toe bones are contact markers, not additional image parts. There are no separate thigh, calf, hand or shoe PNGs to import.

Spine mesh binding uses the Weights tool and multiple bones; automatic weights are only a starting point and require inspection. [Weights documentation](https://esotericsoftware.com/spine-weights)

No invisible thigh, rear limb, fabric underside or joint artwork may be invented. Keep garment roots still if rotation exposes a cut seam. Optional skirt deformation must retain the upper attachment and original silhouette at rest. Reduce the pose range or report an extraction limitation if gaps appear; do not disguise defects by adding artwork or scaling body regions. This package cannot establish in advance that every requested walk pose is possible with these visible-only cutouts.
