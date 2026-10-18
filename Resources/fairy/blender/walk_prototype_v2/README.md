# Isolated Fairy V2 Blender walk prototype

**Built and exported; ready for manual visual review. Not approved for Garden integration.**

Open `fairy_v2_walk_prototype.blend`. It contains a real 32-bone armature, 24 textured meshes with Armature modifiers, packed V2 images, and keyed motion. Frame **0** is the unposed resting check. Frames **1–24** are the walk; frame **25** repeats frame 1 and is excluded from the sequence.

## Deliverables

- `fairy_v2_walk_prototype.blend`: editable Blender 5.2.2 LTS prototype.
- `images/`: 24 byte-identical copies of approved `animation_ready_v2` layers; images are also packed in the blend.
- `frames/walk_001.png` through `walk_024.png`: transparent 1254 × 1254 RGBA sequence, **16 FPS / 1.5 seconds**.
- `review/walk_preview.png`: full-size transparent animated PNG (APNG).
- `review/walk_preview.gif`: neutral-background animation preview.
- `review/runtime_preview.gif`: 96 / 108 / 120 px character-height review.
- `review/walk_contact_sheet.png`: all 24 unique frames.
- `review/joint_closeups.png`: six major phases at larger joint scale.
- `review/resting_recomposition.png`, `source_vs_rest.png`: resting validation.
- `validation.json`, `render_validation.json`, `rig_report.json`: measurements and limitations.

## Rig and motion

The hierarchy comes from the existing `bone_pivots.csv`; corrected V2 limb pivots take precedence. Coordinates retain the 1254-square registration, source root `(674,1178)`, with 100 source pixels per Blender unit. The fixed orthographic camera covers the original canvas.

The meshes contain **3,910 vertices / 5,640 triangles**. Adjacent limb layers share weights: knee/elbow blends span 90 source pixels, ankle blends 36, wrist blends 30. This preserves the shared-deformation approach instead of independently rotating hard rectangular cutouts. The head, hair and flower remain one stable inherited group. Garment attachment roots remain tied to the torso/pelvis, with weak secondary weights toward petal tips and outer wings.

The action is an in-place, short-stride walk study: alternating stance/swing targets, two-bone leg solutions, mild ankle roll, subpixel-scale body rise at runtime size, restrained elbow counter-motion, and 0.15–0.25 degree wing/petal secondary motion. Shoulders stay fixed to protect sleeve registration. No artwork was generated or repainted. The nominal travel guide is 20 source pixels per loop; no app locomotion or root-motion integration was added.

## Important rendering distinction

**Use the supplied `render_review.py` exporter for appearance review.** Blender evaluates the actual posed Armature-modified meshes. Their vertex coordinates are exported to `mesh_cache/`; the exporter rasterizes those textured meshes and applies V2's straight-sRGB source-over compositing. Rest-pose identity is used only when the *evaluated Blender vertices* match the original geometry. Animation is not fabricated in the exporter.

Blender's native Eevee layered-transparency rendering does **not** match V2's compositor exactly. `review/blender_engine_rest.png` is a diagnostic of that limitation, not an approved render. Native material preview / F12 should not be used as the color/alpha approval reference. The exact-match statement below applies to the supplied evaluated-mesh export pipeline. No claim is made that the native Eevee transparency issue is solved.

## Validation

| Check | Result |
|---|---|
| Resting visible RGBA and entire alpha vs approved master | Exact match; zero differing visible pixels |
| First and closing-loop exported images | Exact match |
| Canvas / transparency / source hashes | Passed; 24 RGBA frames, 1254 × 1254; inputs unchanged |
| Mesh folds / inverted triangles | Zero across all exported frames |
| Painted-triangle centroid scale range | Approximately 0.923–1.085; no gross stretching in inspected joint closeups |
| Ankle target vs evaluated armature ankle | Maximum error approximately 0.000047 source pixels |
| Knee/elbow center probes | Minimum alpha 237/255; no open center holes |
| Visual inspection | Contact sheet and representative joint closeups inspected; no open knee/elbow disconnections or gross torso/dress separation observed |

Center probes and triangle measurements supplement visual review; they are not a proof of every painted edge. The source's existing edge residue is preserved. Fine sleeve/cutout boundaries can remain visible at full-size magnification. This is a deliberately small-range study, not a full-range rig certification. The short stride and low lift may need artistic evaluation at runtime size. Heel/toe roll is approximate: ankle targets are checked, but physical shoe-ground contact/slip is not fully simulated. Wider motion, alternate views, production performance, walk/run transitions and Garden placement are untested.

## Reproduce / edit

From the repository root, with Blender 5.2.2 LTS and Python + Pillow + NumPy:

1. `python Resources/fairy/blender/walk_prototype_v2/prepare.py`
2. Run Blender in background factory-startup mode with `--python Resources/fairy/blender/walk_prototype_v2/build_blender.py`.
3. `python Resources/fairy/blender/walk_prototype_v2/render_review.py`
4. `python Resources/fairy/blender/walk_prototype_v2/validate.py`

`build_blender.py` rebuilds the generated prototype. To preserve manual keyframe edits, save an edited blend separately, open it in background Blender and run `export_evaluated.py`, then run steps 3–4. That exporter supports bone/keyframe edits with unchanged mesh topology. Reassess the motion-target measurements after manual edits: `motion_samples.json` describes the generated action, not arbitrary later edits.

Only this isolated prototype directory was written. The approved master, V2 production layer package, GardenScene, Fairy runtime and Expo integration were not changed. No additional landmark, character view or animation set was created.
