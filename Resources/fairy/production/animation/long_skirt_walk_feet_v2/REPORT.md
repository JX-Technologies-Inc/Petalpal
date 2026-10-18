# Fairy feet / ankle correction — manual review candidate

Working base: `long_skirt_walk_natural_v1`, the latest 32-frame reconstruction. That package and all earlier frames remain unchanged. This pass changes feet and their short ankle joins only; it does not replace the walk with a new character or change the body animation.

## Changes

- Each shoe uses its own existing near/far painting, sampled once from the extracted source, with a rigid rotation/translation and scale exactly 1. No mirroring, duplicated shoe, per-frame resizing, or new painted details.
- Calibrated separate heel and forefoot pivots for the two differently foreshortened shoes. Their neutral sole lines are aligned with the ground without stretching either painting.
- Initial contact rotates around the heel (8-degree raised forefoot), settles to flat support, then lifts the heel around a planted forefoot (up to 15 degrees). The forefoot leaves only after support ends.
- Swing uses restrained clearance and smooth pitch recovery. Its horizontal curve matches backward stance velocity at both ends, avoiding an abrupt foot stop at landing/toe-off.
- The calf-to-foot remap ends above the ankle/shoe details. All pixels outside per-frame declared masks are copied verbatim from the current source. All rows above y=280 are byte-identical in decoded RGBA. No change to skirt length, body rise, hair, wings, arms, face, timing, or camera registration was introduced.

## Separate validation findings

| Area | Result and limits |
| --- | --- |
| Shoe proportions | Both distinct source shoes retain scale 1 throughout. Screen-space width legitimately varies with pitch and overlap. Rotation/resampling can soften subpixel details; it does not establish new artwork. |
| Ankle continuity | Short blended joins replace the earlier deformation through the shoe. Ordered close-up inspection finds no detached shoe or open ankle hole. The inherited angular upper-calf/hem connections remain, notably around the second half-cycle; they are not repaired by this localized pass. Anatomical quality still needs visual review. |
| Support contact | Heel during initial contact and forefoot during support/toe-off are analytically locked when the character moves at 52.182163 px/s. The player has a matched-travel mode and ground line. In-place sprites necessarily sweep their supporting feet backward. This is not a claim that arbitrary runtime travel speed or every antialiased sole pixel is locked. |
| Toe-off | Heel rises around the forefoot before the foot enters swing; forefoot then lifts. No whole-shoe bobbing during flat support. |
| Opposite feet / overlap | Separate near and far shoes exchange leading positions in opposite half-cycles. Near stays visually in front at crossings. The close crossing around frames 9–11 and 25–27 still hides much of the far shoe and needs manual judgement for step readability. No claim that all earlier gait limitations are solved. |
| Alpha / edges | All 32 PNGs are RGBA, 378 × 378. Light and dark contact sheets inspected. No new opaque rectangular patch is introduced. Existing faint edge/color artifacts elsewhere in the original sprite are intentionally untouched. |
| Loop | 32 frames at 42.5 ms = 1360 ms; GIF uses 40/50 ms intervals totaling 1360 ms. Analytical ankle positions are continuous at contact, support, toe-off, and loop boundaries. Actual perceived smoothness is for manual playback review, not certified by the equations. |
| Preservation | Source hashes unchanged. Zero RGBA changes outside every combined mask; mask PNGs include the complete blend region. Production Garden/application files were not edited by this task. |

## Review outputs

- `index.html`: self-contained before/after player, identical timing/registration, pause, previous/next, speed, light/dark, matched travel.
- `frames/`: 32 corrected transparent PNGs.
- `review/walk.gif`: in-place preview on a neutral background (PNG files retain transparency).
- `review/travelling.gif`: calibrated ground-travel diagnostic. Horizontal location resets at loop wrap because it is a finite review viewport.
- `review/contact_sheet.png`: every full-body frame.
- `review/feet_light.png`, `review/feet_dark.png`: every foot pose, enlarged without smoothing.
- `review/key_pose_comparison.png`: before/after representative phase comparisons.
- `masks/`: individual near/far edit footprints and final combined edit masks.
- `frames.json`, `validation.json`: timing, calibrated pivots, tracks, source hashes, per-frame preservation checks.
- `build.py`, `validate.py`, `test_player.cjs`: repeatable isolated processing and checks.

Validation consists of file/pixel/transform tests, GIF decoding, ordered frame/contact-sheet inspection, and a mock-DOM player test. No browser/screenshot automation or claimed real-time perceptual approval. No Spine, Blender, image generation, Garden integration, or new landmark work. This candidate is awaiting full-cycle visual review.
