# Dedicated walk and back-facing Swing pose candidate

Status: **manual review required**. The previous standing-cutout walk and
front-facing seated renderer were rejected and are disconnected from
`/fairy-swing-test`. Their files remain historical; this task does not delete them.

The sole character identity reference is `../../master/fairy_first_approved.png`.
Its bytes remain unchanged. New poses were authored with the built-in image tool,
not by reflecting or rotating the front PNG. See `walk.prompt.txt`,
`back.prompt.txt`, source sheets, and `manifest.json` for provenance/registration.
The existing Swing composite was used only as a seat/rope reference, never as
character identity. Neither Swing assets nor production Garden code were changed.

## Assets and playback

- Six walking studies: two contact/passing pairs plus two alternative poses.
- The runtime loop uses four key poses: `walk_0`, `walk_1`, `walk_2`, `walk_3`.
  The remaining studies are review material, not silently added to the cycle.
- Dedicated `turn_rear_3q`, `stand_back`, `lower_back`, and `sit_back` artwork.
- The exact front master supplies the idle (uniformly downsampled for the atlas).
- Each registered canvas is 512 × 640. Atlas: 2048 × 1920 RGBA, approximately
  15 MiB decoded. One predecoded atlas, shared-value sprite selection, at most two
  drawing nodes for transitions; React debug updates remain throttled.
- Uniform per-sheet registration preserves body-part proportions. The generated
  source alpha is retained. Extraction uses inspected gutters so the first shoe
  is not cut at the sheet's nominal grid boundary. No runtime recoloring occurs.

Walking uses authored joint placement, heel/sole contact annotations and bent-knee
passing poses. Contact/passing pairs share a planted world-space contact point.
Root travel controls cycle progression; waypoint stride lengths finish at a
contact pose. There is no autonomous timer sliding a standing PNG. At the current
65 world-px/sec maximum speed, a 48-px four-key cycle has about 5.4 key changes/sec
before stride fitting; the intentionally small pose set can still read as stepped.
No optical-flow or invented intermediate animation frames are claimed.

Flow: `idle_front_3q → walk_cycle → approach_swing → turn_back → sit_back →
swinging_back → settling_back → stand_back → turn_front → idle_front_3q`.
Turning/seat transitions blend authored poses, not mirrored front artwork. The
standing-back hips define the attachment transform; every seated pose uses its
own registered hip pivot. The unchanged Swing moving group carries the Fairy
between its rear and front artwork. The rail naturally obscures most lower legs
from this camera. Hair and wing clearance are shown in the offline seat review.
Standing waits for the Swing's settle interval; a repeat visit already at the
seat does not walk backwards using a forward-only gait.

## Review and limitations

Use Home → **Open Fairy Swing Test** → **Visit Swing**.
Inspect alternating support legs, heel/toe contact, weight transfer, art identity
between poses, and the rear seat's pelvis/wing/rope/rail relationship. Generated
poses are new drawings, not pixel-exact copies of the master; neither identity
fidelity nor gait quality is automatically approved. The four-key loop and short
pose blends may need more artist-authored inbetweens after this gate. Only one
walk direction and this one landmark interaction are implemented.

Review artifacts: `../../review/swing_pose_v2/pose_contact_sheet.png` and
`../../review/swing_pose_v2/back_seated_alignment.png`. These are offline asset
composites, not browser screenshots. No production Garden integration is included.

Validation covers TypeScript, the back-facing state flow, planted contact math,
seat registration, repeat visits, pause semantics, original Fairy regressions,
source hash/alpha/canvas checks, and a web export. Live browser/native visual
approval remains manual.
