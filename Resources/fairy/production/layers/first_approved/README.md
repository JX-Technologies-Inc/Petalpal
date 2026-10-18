# First approved attachment: extraction and Swing review

The user supplied `codex-clipboard-af0fb927-7610-4c24-9406-7f5138c95f6e.png`
as the sole authority for this interaction task. Its byte-identical durable copy is
`../../master/fairy_first_approved.png`. The older sheets, rejected cutouts,
generated master V2 and Blender models are not sources for these layers.

All 18 PNGs retain the original **1254 Ã— 1254** canvas at x=0, y=0,
with no resize, rotation, recoloring, alpha cleanup or hidden reconstruction.
The manifest records the source SHA-256, pixel counts, root and hips.
Sides in these filenames mean screen-left/right in this single authored view.
Each visible source pixel belongs to one layer. Recomposition preserves every
visible RGBA pixel and the entire alpha channel exactly. RGB beneath zero alpha
is not meaningful and is not a visible-pixel comparison target.

Run `python Resources/fairy/production/layers/extract_first_approved.py`
from the repository root to rebuild and validate the partition. Review outputs
are in `../../review/first_approved/`; runtime copies are in
`mobile/assets/garden/fairy/first-approved/`.

## Limits requiring manual review

These are extraction-only visible pieces, not newly painted complete limbs.
Occluded anatomy, hair and costume have not been invented. The original edge
fringes are retained, including faint colored pixels. Extracted pieces are safe
to reassemble at rest; deformation may expose seams or transparent holes.
The seated pose is a restrained two-segment leg articulation for review, not an
approved authored seated sprite. No appearance or animation approval is implied.

## First functional interaction

Open `/fairy-swing-test` in a DEV build and select **Visit Swing**.
The Fairy is displayed at 108 world px tall. The screen keeps the production
Swing's map transform and artwork unchanged, using an independent camera view.

`idle â†’ walking â†’ approach_landmark â†’ sitting â†’ swinging â†’ settling â†’ standing
â†’ leaving_landmark â†’ idle`

Walking uses bounded rigid articulation of the existing extracted legs, wings
and hanging petals; no gait frames or alternate facing images are fabricated. The controller owns semantic facing independently
of this single available view. The Fairy attaches by the hips to the seat and
inherits the existing pendulum motion between its back and front art. A 1.5s
settle precedes standing, exceeding the Swing's 1.25s decay/reset. Repeat visits
are supported. Pause/background stops controller time; the existing Swing eases
to rest and restarts its soft cycle on resume. Reduced motion uses the Swing's
existing preference handling.

`FairyController` is pure and caller-clocked. Landmark descriptors supply
approach, interaction, exit and facing; future interaction adapters can supply
other timelines without changing the extracted artwork or the Garden.
No Journal, backend, persistence or production Garden integration is included.
`FairyLayer` retains its existing API. The new layer renderer is separate.

Skia transforms use shared values; React updates only on phase transitions and
at ~7 Hz for debug text. Only an active visit requests animation frames.
The 18 full canvases cost approximately 108 MiB decoded before renderer overhead.
This isolated review is not production texture optimization: future packing must
retain the full-canvas registration metadata and approved pixel fidelity.

Manual QA: inspect both shoes, face and source fringes; watch approach/attachment,
leg pose, front-rail occlusion, settling/detachment, repeat visits, Pause/Resume,
background/foreground, and reduced-motion mode on web and native. No automated
browser or screenshot verification was performed.

## Locomotion refinement

The controller now eases each travel segment with a quintic curve (zero endpoint
velocity and acceleration). Gait phase follows distance traveled, with an envelope
that reaches zero at every waypoint and attachment transition. The approved seated
pose and Swing settle interval are unchanged. At handoff, world and seat transforms
match for the complete character canvas, with the same constant uniform scale.
Decoded layer images are retained above both render parents to prevent a reload
flash during attachment/detachment. Travel and pose share the same caller clock;
pausing does not reset gait phase or accumulate background elapsed time.

Maximum walking transforms, in the original source coordinate space:
- Hip rotation: alternating ±0.025 rad (~1.43°).
- Knee rotation: alternating 0–0.035 rad (~2.01°).
- Body rise: 0–1.8 source px (<0.18 world px at the current scale).
- Wings: opposing ±0.006 rad (~0.34°).
- Side/back hanging petals: ±0.004 rad (~0.23°).

Arms remain fixed: visible-only extraction does not supply sufficient hidden
shoulder/elbow overlap for safe opposing motion. No source pixels, alpha, canvas,
master, Swing artwork or landmark placement were changed. Walking is a restrained
single-view cutout cycle, not full anatomical gait or directional sprite playback.

Validation: TypeScript, Fairy Swing/controller tests, existing Fairy runtime and
playback tests. Added bounds, alternating knee motion, neutral endpoint, eased
arrival and full-canvas attachment-registration assertions. Manual review remains
required for extraction-edge seams, foot sliding and the live seat handoff.
