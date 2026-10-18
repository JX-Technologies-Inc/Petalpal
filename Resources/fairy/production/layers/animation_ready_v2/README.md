# Animation-ready V2 — strict correction pass

**PASS for exact resting recomposition and the documented restrained articulation tests. Awaiting user visual review. No Blender rig was created.**

## Results

| Check | Result |
|---|---|
| 24 transparent PNG layers, each 1254 × 1254 | PASS |
| Same canvas, source registration and scale | PASS |
| Resting visible RGBA versus approved master | PASS: zero differing visible pixels |
| Entire resting alpha channel versus approved master | PASS: zero differing pixels |
| Mild left / right knee bends | PASS for inspected poses |
| Mild left / right arm bends | PASS for inspected poses |
| Restrained step | PASS for inspected pose |
| Approved master and V1 input hashes | Unchanged |

Five diagnostic images were inspected for obvious open joint gaps. Independent saved-file validation also checks knee/elbow center coverage and unchanged canvas borders. Center probes supplement visual inspection; they do not certify all possible poses.

## What was corrected

- `thigh_left`, `calf_left`, `foot_left`, `thigh_right`, `calf_right`, `foot_right`: continuous painted-leg ownership, removal of calf/ankle strips from dress ownership, broader underlaps, and feathered same-material transitions. Existing visible shoe art is retained.
- `upper_arm_left`, `forearm_left`, `hand_left`, `upper_arm_right`, `forearm_right`, `hand_right`: shoulder/elbow/wrist coverage and corrected overlap compositing.
- `torso`, `dress_base`, `petals_front`, `petals_side`, `petals_back`: corrected source ownership, costume backing beneath moving sleeves, and alpha/color compensation at overlapping boundaries.
- `wing_left`, `wing_right`: overlap/alpha correction needed by the resting composite; no new wing design or wing motion added.

These 19 layers differ from V1. `head_face`, `hair_back`, `hair_front`, `braided_updo` and `flower_accessory` remain **byte-identical** V1 copies.

V1 is the base. Existing V1 reconstruction material and adjacent approved costume pixels provide concealed backing. No new generated artwork, face replacement, proportions change, global rescaling or restyling was performed.

## Exact-rest compositing contract

Use the back-to-front order in `manifest.json`, standard straight-alpha source-over compositing, canvas origin `(0,0)`, scale 1 and rotation 0. The correction distributes overlap alpha and compensates the visible owner against the approved source. Therefore individual corrected layers may look different in isolation; the **combined resting result** is numerically unchanged. Do not flatten alpha, auto-trim PNGs, change tint, or reorder layers.

The master contains four alpha=1 pixels on the bottom canvas border. Those original residues, and the approved source's existing edge characteristics, are retained. Tests require no added border coverage; no source cleanup was performed. RGB values where alpha is zero are visually irrelevant and are excluded from the visible-pixel comparison.

## Restrained articulation contract and limits

The diagnostics use a **shared smooth joint-deformation field** across each limb's adjacent parts, with a 60-source-pixel smoothstep transition at knees and elbows. Feet/hands follow the lower segment. This is a 2D diagnostic transform, not a Blender armature or animation.

| Diagnostic | Angles |
|---|---|
| Left knee | -6 degrees |
| Right knee | +6 degrees |
| Left elbow | -5 degrees |
| Right elbow | +5 degrees |
| Step | Left hip +2 / knee -6; right hip -2 / knee +4; elbows -3 / +3 degrees |

The pass applies to these restrained poses and deformation method. Independent rigid rotation of each rectangular PNG is **not certified**: it reintroduces hard painterly cut boundaries. A future Blender mesh must use compatible shared joint weights. A full walk, foot-contact timing, large joint excursions and production integration have not been tested or created.

## Deliverables

- `images/`: final corrected 24 PNG layers.
- `review/resting_recomposition.png`: corrected resting preview.
- `review/source_vs_recomposed.png`: approved master left, corrected composite right.
- `review/rest_difference_x32.png`: amplified visible RGB difference, black where identical.
- `review/articulation_diagnostic_sheet.png`: resting plus all five restrained poses.
- `review/mild_left_knee.png`, `mild_right_knee.png`, `mild_left_arm.png`, `mild_right_arm.png`, `restrained_step.png`: individual transparent diagnostics.
- `review/rest_alpha_background_checks.png`: resting image over light, dark and neutral backgrounds.
- `review/layer_contact_sheet.png`, `joint_closeups.png`, `dress_ownership_check.png`: inspection aids.
- `manifest.json`: draw order, pivots, source hashes and exact-rest measurements.
- `validation.json`: independent saved-file pass/fail results and joint probes.

Rebuild with `python Resources/fairy/production/layers/animation_ready_v2/correct_package.py`, then validate with `python Resources/fairy/production/layers/animation_ready_v2/validate_package.py` from the repository root. Python, Pillow and NumPy are required. Rebuilding resets status to pending inspection until validation runs; new edits still require fresh visual inspection.

All work is isolated here. No GardenScene, Expo integration, Fairy runtime implementation, source master or V1 files were modified. This technical pass is not automatic visual approval for animation production.
