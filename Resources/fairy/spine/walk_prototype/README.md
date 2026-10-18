# Fairy manual Spine walk prototype

Status: preparation only. No Spine project, working rig, animation, or exported animation exists in this package. Manual Spine construction and visual review are required.

Only authority: `production/master/fairy_first_approved.png` and the 18 existing images in `production/layers/first_approved/` (paths relative to `Resources/fairy/`). The master SHA-256 is `c395f4d96c4b3c8848d0f4e63d945bc4d6a3bb7c6c095353827d5c17845fee42`. No generated walk poses, back poses, Blender models, or rejected masters were used.

Start with [MANUAL_SPINE_CHECKLIST.md](MANUAL_SPINE_CHECKLIST.md). Consult [RIG_SPEC.md](RIG_SPEC.md) and [WALK_TIMING.md](WALK_TIMING.md) while working.

- `images/`: exactly 18 unchanged production PNG copies.
- `reference/`: unchanged approved master copy.
- `bone_pivots.csv`: approximate source-pixel pivots and calculated Spine coordinates.
- `layer_attachments.csv`: all 18 image attachments, parent bones, center coordinates and draw order.
- `rig_spec.json`: descriptive specification, **not an importable Spine skeleton**.
- `review/resting_recomposition.png`: verified resting composite.
- `review/pivot_reference.png` and `pivot_legend.txt`: numbered pivot guide, separate from source art.
- `verification.json`: source hashes, pixel/alpha checks and protected-file checks.
- `exports/`: destination for your future manual exports; currently empty.
- `prepare_package.py`: repeatable copy/validation utility; never builds a rig or animation.

Verification: all 18 images are RGBA, 1254 × 1254, with identical absolute registration. Each visible source pixel belongs to exactly one layer. Visible RGBA and the entire alpha silhouette recompose exactly. Fully transparent RGB is not a visible appearance criterion. Original source assets and the checked application files remained unchanged.

Important limitation: these are visible-pixel extractions without invented overlap anatomy. Exact resting reconstruction does not guarantee gap-free movement. Whole-leg images need mesh articulation; rigid rotation alone will not produce a real knee bend. Stop and document any pose that requires missing painted geometry. Do not repaint, mirror into a new view, or substitute another character.
