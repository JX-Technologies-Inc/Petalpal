# Continuous motion candidate — FAILED visual gate

This is an isolated diagnostic candidate, not a successful human walk or a production-approved replacement. Stop for manual review. No application integration was performed.

## Output

- 48 distinct transparent RGBA PNGs, 378 × 378.
- 30 ms per frame; 1.44 second loop. GIF uses the same exact timing.
- Self-contained `index.html`: previous 64-frame comparison, play/pause, stepping, seek, quarter/half speed, light/dark backgrounds, fixed-ground travel test. Previous version runs at its own 1.36 s timing by default; optional phase-lock explicitly changes its review speed.
- Full-body, enlarged feet and enlarged hem sheets on both light and dark backgrounds under `review/`.
- Source packages remain unchanged.

## What changed

The prior changing illustration sequence was replaced by one stable source painting from approved ankle-length frame 01. The body no longer switches donor paintings. Continuous periodic local fields apply restrained pelvis motion (0.65 px horizontal amplitude), rise/fall (0.48 px amplitude, damped at the head), small arm counter-motion, subpixel wing response and delayed lower-garment motion. This is a limited cutout experiment, not a complete skeletal/body-weight simulation; it cannot establish realistic knee mechanics hidden by the skirt.

Two distinct existing shoe cutouts are reused without scaling or bending. Each follows a separate half-cycle-offset contact trajectory: heel landing, sole settling, support, toe-pivot heel rise, swing and progressive return. In-place frames require 120 px of world translation per cycle for the stance-contact test. The review player supplies that travel. No optical flow, adjacent-image averaging, crossfades or illustration-pose interpolation is used.

The source extraction mask is retained and supplied in `parts/`. It remains inadequate at the hem: no new painted garment coverage was fabricated to conceal that failure.

## Visual inspection — exact failure ranges

All 48 frames were inspected in full-body and enlarged foot sheets. This was static frame inspection, not an observed real-time playback approval.

| Check | Result |
|---|---|
| No source-painting pose pops | Donor switching removed in frames 1–48; overall perceived naturalness remains unverified. |
| Real human walk / weight transfer | **Not passed, frames 1–48.** Small continuous cutout movement and foot trajectories do not establish convincing whole-body weight transfer. |
| Planted support foot | Analytical contact coordinates pass when root travel is applied. Painted contact remains visually unapproved because of the garment joins. |
| Readable passing | **Fails frames 13–18 and 37–42.** Swing shoe is substantially hidden/merged by the unchanged central hem. Inspect adjacent frames 12–19 and 36–43 as transitions. |
| Stable shoes | Rigid transforms only; no scale/shear. Fixed source near/far shapes retained. Raster rotation can change antialiasing, not geometry. |
| Clean ankle coverage / no extraction notches | **Fails frames 1–48.** The original foot openings stay embedded in the body plate. Right-side gap is especially visible in 1–6, 19–30 and 43–48; the unfilled opening remains during the other phases too. |
| No calf/ankle break illusion | **Fails in the same ranges.** A disconnected pale ankle remnant above the moving shoe can read as broken anatomy. |
| Seamless loop | Rendered phase 0 equals rendered phase 1 exactly; no donor-switch seam. Perceptual loop acceptance is not established. |
| Smoother AND more believable than previous 64 | **Not claimed.** More continuous numerical motion does not resolve the above visual failures. |

The next asset-level requirement is a clean, ankle-covering animated hem with correctly separated garment/shoe overlap—not more temporal samples or another small-transform pass. This package intentionally preserves the evidence instead of hiding it with blur or blending.

## Technical validation

`validation.json` records: 48 unique images; all RGBA and 378 × 378; empty outer canvas border; source frame hash unchanged; periodic endpoint pixel equality; analytical stance-contact drift below 0.000001 px. These are technical checks only.

The player defaults to paused, uses actual elapsed time, pauses advancement while hidden, and never crossfades frames. Source PNGs and application files are not edited. The build depends on the existing previous candidate's helpers and local OpenCV dependency; deliverable PNGs and self-contained player do not require those tools.
