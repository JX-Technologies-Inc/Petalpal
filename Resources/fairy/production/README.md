# Current DEV review: dedicated walk and back-facing Swing poses

The translated/articulated standing-cutout walk and front-facing seated result
were visually rejected. `/fairy-swing-test` now uses newly authored walk poses,
rear turning/standing/lowering poses and a dedicated back-facing seated pose.
See [the pose-production notes](animation/swing_pose_v2/README.md) for source
prompts, registration, contact timing, review artifacts and limitations.
All new pose artwork and motion remain pending manual visual approval.
The approved character master and existing Swing assets are unchanged.

The earlier implementation notes below are historical, not approval of the
rejected walking or seating behavior.

---

# Current Fairy interaction checkpoint

The latest user-supplied FIRST approved attachment is the **sole current character master**:
[`master/fairy_first_approved.png`](master/fairy_first_approved.png), byte-identical RGBA 1254 � 1254.
No generation, redesign, alpha cleanup or source alteration was used.

See [`layers/first_approved/README.md`](layers/first_approved/README.md) for the 18 aligned
visible-pixel layers, extraction checks, anchors, limitations and manual review steps.
The DEV route `/fairy-swing-test` provides the first controller-driven Swing visit.
Production Garden, Swing artwork/placement, and the existing FairyLayer API are unchanged.
Layer posing and interaction are **pending manual approval**. Walking articulates the existing extracted layers with restrained rigid transforms;
no newly painted walking frames or alternate views are used. No other interaction is implemented.

The 1024px proposal and older structure-sheet authority below are historical;
the active source and anchor manifests override them for the current pipeline.

---

## Historical production plan (superseded authority and canvas)

# PetalPal Fairy — approved 2D production master and layer plan

Status: **character design approved on 2026-09-30; production preparation only**. Animation, separated layers and runtime integration are not yet approved or created.

## Authoritative visual source

The authority is [`Resources/Icon/fairy structure.png`](../../Icon/fairy%20structure.png). The production master [`master/fairy_approved_structure.png`](master/fairy_approved_structure.png) is a **byte-identical copy**, not a repaint, conversion or resized version.

SHA-256: `86eed8eb748ced65bf6215fab48224b9e05bb8be50c213eb287d54ec0bf270b8`. Source: 1448×1086 RGB, opaque painted presentation sheet. It has no transparent character layer or editable layer stack. The master preserves every source pixel, including the background and annotations.

Blender Fairy **V1 and V2 are deprecated and forbidden as future visual references**. Their meshes, proportions, materials, renders and camera experiments are historical only. `Resources/Icon/fairy.png` is also a historical reference, superseded by the approved structure sheet. Preserve those files physically; do not continue their visual development.

Keep the approved elegant, refined, slightly aloof expression; approximately 5.5–6 head proportions; dark purple/black braided updo and loose front strands; large saffron-crocus ornament; translucent lavender/blue wings; layered petal dress; delicate gold details; and soft painterly rendering. Preserve `#A67EB7` and `#5AA4AB` as palette references, without forcing every painted pixel to a flat swatch. No chibi proportions, generic fairy restyling, simplified replacement art, mirrored ornament substitutions or runtime recoloring.

## Canonical painted views

The five views already painted on the approved sheet are the canonical turnarounds:

| Canonical ID | Sheet label | Authority |
|---|---|---|
| `front` | Front | Existing approved painting |
| `front_3q` | 3/4 Front | Existing approved painting |
| `side` | Side | Existing approved painting |
| `back` | Back | Existing approved painting |
| `back_3q` | 3/4 Back | Existing approved painting |

Open [`review/canonical_views.html`](review/canonical_views.html) for non-destructive reference windows onto the unchanged master. [`master/source_manifest.json`](master/source_manifest.json) records their source rectangles. These windows are editorial viewing aids, not extraction boundaries: some wings and details approach adjacent figures. The complete sheet remains authoritative for every contour. No missing or opposite view has been generated, inferred or mirrored. World-direction bindings are a later asset-registration decision; these IDs currently describe the approved drawings.

## Production folders and intended layer ownership

| Folder | Future contents |
|---|---|
| `master/` | Approved full sheet, source manifest, anchor contract; future editable layered master per canonical view |
| `body/` | Root/body painting, torso and head where a clean separation is possible |
| `hair/` | Loose front strands and braided updo as cohesive painted groups |
| `flower/` | Crocus, stamens and attached gold sprigs kept together initially |
| `wings/` | Character-left and character-right wing groups, retaining painted membrane transparency |
| `dress/` | Front, side and back petal groups; painted overlap preserved |
| `arms/` | Left/right upper arm and forearm; hands normally attached to forearms |
| `legs/` | Left/right leg chains, feet/shoes and attached gold details |
| `effects/` | Reserved; no glow, particles or emotion effects created |
| `animation/` | Reserved for future `idle`, `walk`, `run` source scenes and exports |
| `review/` | Canonical reference viewer and future layer/seam/runtime-size reviews |

These are production ownership groups, not a requirement to dissect every painted detail. Split only where movement benefits and painted continuity can be preserved. A single petal, shoe ornament, braid loop or gold vein does not automatically become an independent layer.

## Planned motion hierarchy

`root` controls overall translation. Body motion is local to it; root remains the ground anchor.

| Group | Parent / attachment | Planned independent motion |
|---|---|---|
| Body / torso | Root, hips/chest guides | Restrained breathing and body lean |
| Head | Neck | Small turns/tilts with the face painting intact |
| Front hair strands | Head | Minimal soft secondary motion; avoid face-edge tearing |
| Braided bun | Head | Primarily rigid with head; optional very restrained secondary motion |
| Flower accessory | Head/bun, flower anchor | Mostly rigid; preserve the complete recognizable bloom |
| Left/right upper arm | Corresponding shoulder | Arm swing and posing |
| Left/right forearm + hand | Corresponding elbow, wrist guide | Elbow bend; hand remains painted as a unit unless an authored pose requires separation |
| Left/right leg | Hips, knee and ankle chain | Walking/running articulation only after appropriate hidden regions are supplied |
| Front petal group | Hips | Small overlap-preserving sway |
| Left/right side petal groups | Hips | Sway with staggered timing |
| Back petal group | Hips | Gentle trailing motion |
| Left/right wings | Corresponding wing root | Subtle rotation/deformation, preserving upper/lower lobes and gold veins |
| Trailing ribbons / gold details | Their painted garment attachment | Restrained follow-through where present in the approved view |

Left/right always means **the character's anatomical left/right**, never screen left/right. The layer stack is view-specific: far limbs/wing groups, back petals, body, near limbs/front petals, head/hair/flower must follow the actual painting's overlaps. Do not impose one universal painter order across the five views. Upper/lower wing lobes remain grouped by side unless a future animation explicitly needs a clean split.

## Anchor and canvas convention

[`master/anchor_contract.json`](master/anchor_contract.json) defines the required names and coordinate system. It is a contract, not a claim that anatomical pivots have already been measured or visually approved.

- Future layer/animation working canvas: **1024×1024**, top-left `(0,0)`, X right, Y down, square pixels. This is a future transparent work canvas, not a resize of the approved 1448×1086 sheet.
- Fixed root/foot anchor: **`(512,896)`**, normalized **`(0.5,0.875)`**. It represents the ground under the stance, independent of which foot is raised. Body bob occurs above this point.
- Nominal standing body height for layout planning: **512 master pixels**, excluding wings/flower. Preserve native painted detail; measure the actual clean master height `H` before choosing delivery scale. Do not stretch individual body parts or force the sheet through an enlargement operation to meet this planning number.
- Preserve at least **64px transparent padding** around visible motion extents on the master. Never recenter or trim frames independently. Review framing before any animation export.
- Required anatomical anchors: `hips`, `chest`, `neck`, `head`, `shoulder_left/right`, `elbow_left/right`, `wrist_left/right`, `knee_left/right`, `ankle_left/right`, `wing_root_left/right`, `flower_accessory`.
- Local offset = `(canvas_x - 512, canvas_y - 896)`; rendered location = `parent_world + local_offset × uniform_scale`. Parent-local joint offsets are derived from the same master coordinates, never mixed with source-sheet coordinates.
- `neck` is the torso/neck junction; `head` is the skull/upper-neck pivot. `flower_accessory` is the ornament attachment, not its visible centroid. Wing roots are the upper-back attachments, not membrane centers.
- Apart from the fixed root, coordinates are explicitly **null/pending** per view. Place them on the clean approved layered view, respecting the hidden/far-side joints. Do not invent precision from the opaque presentation sheet. Matching names across views does not imply identical anatomical pixel coordinates.

## Naming and versioning

Use lowercase snake case for canonical views and layer IDs. Revision suffixes are `v001`, `v002`, etc. Keep anatomical sides explicit and preserve source hashes. Future examples, not files created in this task:

```text
master/fairy_front_3q_master_v001.psd
hair/fairy_front_3q_front_strands_v001.png
flower/fairy_front_3q_flower_accessory_v001.png
arms/fairy_front_3q_upper_arm_left_v001.png
master/fairy_front_3q_anchors_v001.json
animation/idle/front_3q/fairy_idle_front_3q_v001_0000.png
animation/idle/front_3q/fairy_idle_front_3q_v001_atlas.png
animation/idle/front_3q/fairy_idle_front_3q_v001_atlas.json
```

Layer PNGs retain the common canvas and anchor metadata. Future atlas packing must preserve the untrimmed canvas/pivot or explicitly record trim offsets; no silent rotation, mirroring or recentering. Transparent RGBA delivery must preserve soft painted edges and wing alpha, with no baked presentation background or color-key halos.

## Runtime visual target

Primary review is **96–120px standing character height** (96, 108 and 120px checks). **64px is no longer the main design target.** Calculate scale from the actual standing body height `H`: `runtime_scale = requested_height / H`, keeping a common scale across a clip and direction set. Canvas height is not character height.

At runtime size, verify braided hair/loose-strand silhouette, crocus shape, translucent wings and layered skirt remain recognizable. Do not simplify, redraw, enlarge isolated details or sharpen the approved art as an automatic optimization. Any visible production adjustment requires a separate visual decision.

## Future animation workflow

1. Preserve this immutable approved master. Obtain clean layered originals or artist-prepared separation faithful to these paintings. The present RGB sheet is insufficient for lossless recovery of translucent wings or hidden anatomy. **No color-key/background deletion, invented hidden fills or mechanical full-detail splitting in this preparation.**
2. Prepare an editable layered master for each existing canonical view. Retain the visible painting exactly; document any unavailable/occluded region instead of fabricating it. Check the assembled layers against the approved sheet before motion work.
3. Place and review the per-view anchors using this contract. Verify painter order, seam coverage, foot baseline and stable size at 96/108/120px. Avoid deformation that stretches the face, flower identity or petal shapes.
4. After the layered masters are accepted, author **idle, walk and run only** using layered 2D motion, selective mesh/bone deformation or hand-authored frames as appropriate. Export painterly sprite frames; do not convert the character into real-time 3D. Frame counts/FPS will be chosen against actual motion tests; the historical Blender sampling targets are not binding approvals.
5. Review those real clips, then export RGBA sequences/atlases with clip, frame, canvas and pivot metadata. Preserve source layers separately from runtime deliveries. Load only active/recent pages, pause playback when hidden and use shared playback state rather than per-frame React rerenders.
6. Import approved real assets into isolated `/fairy-test` in a later task. The existing static placeholder still uses the old sheet; it is not the current visual authority. No `FairyLayer`, GardenScene or app registry changes are part of this preparation.

The delivered master is the approved source archive plus canonical-view/layer/anchor plans. It is **not a completed separated animation master**. No animation frames, effects, sprite sheets, rigs or new character interpretations have been produced. Stop for production-master/layer-plan review.
