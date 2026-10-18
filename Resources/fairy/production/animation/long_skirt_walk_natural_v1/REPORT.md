# Natural-walk reconstruction trial — FAILED visual gate

This attempt did not achieve the requested production-ready natural walk. It is retained as a diagnostic trial, not a replacement for the current 32-frame base. All prior source files are unchanged.

## Work attempted

The existing 32-frame package was inspected. Repeated image interpolation alone cannot establish opposite anatomical leg roles or a grounded contact trajectory. Using the request's permission to rebuild, this trial separates the two distinct painted lower-leg/shoe regions from frame 01 of the current package; it does not mirror or duplicate one leg. It replaces ambiguous pose ordering with explicit opposing support/swing cycles, offset by half a loop.

The trial uses a 62% stance interval, low 5-pixel swing clearance, a 44-pixel support sweep, restrained heel pitch, 0.8-pixel body bob, 0.6-pixel lateral shift, and less than one pixel of delayed lower-petal motion. Feet use rigid unscaled source-pixel transforms to retain the approved shoe size. Source masks and extracted pieces are included in `source_parts/`; exact tracks are in `frames.json`.

The upper character painting is reused, not regenerated. However, separating visible leg pixels from a flattened dress leaves incomplete overlap surfaces. A second masking pass reduced old ankle-edge remnants; it did not solve the calf/garment connection well enough. Thus visual preservation of the recomposed lower body did not pass.

## Critical self-review

| Requirement | Finding |
|---|---|
| Left/right alternation | Two distinct source legs now exchange leading/trailing positions in the programmed tracks. They remain independently visible in separated poses. This is a useful mechanical change, but it is not sufficient to claim a natural human walk. |
| Planted-foot stability | Forefoot pivots are analytically stationary in world coordinates during each contiguous support phase when root travel is about 52.18 px/s. Sprite-space support feet move backward, as required for a centered travelling walk. This does not certify all painted sole/heel pixels stay grounded. |
| Passing clarity | Both opposite passing phases exist, but calf joins become distorted and some overlap poses look pinched. **Visual fail.** |
| Weight transfer | Small continuous body displacement is present. It remains a restrained procedural approximation rather than a proven balanced human gait. |
| High-heel mechanics | Subtle shoe pitch is included, but heel-contact placement is not convincingly resolved from the existing source geometry. **Not production-ready.** |
| Identity/costume/shoes | Face, hair, wings and torso use the same source painting. Footwear is not enlarged. Nonetheless, extracted calf edges and lower garment boundaries produce visible seams/shape changes. **Preservation fail in the lower-body reconstruction.** |
| Loop | Mathematical trajectories are periodic and GIF timing is correct. The sprite loop is continuous in parameters, but naturalness and a visually flawless restart are not certified. |
| Overall improvement | **Not achieved at the requested quality bar.** This trial should not replace the approved working base. |

The eight-phase close-up `review/gait_details.png` exposes the problem rather than hiding it at runtime scale: particularly 17/21/25, the leg/hem connection forms unnatural angled shapes. Enlarged views also reveal residual edge treatment near the old calf outlines. No claim is made that these defects are acceptable just because foot-path calculations pass.

## Files and timing

- `frames/`: 32 transparent 378×378 trial PNGs.
- `review/walk.gif`: in-place sprite trial, 32 frames, total 1360 ms.
- `review/travelling_diagnostic.gif`: same frames over a static calibration ground at the matching root speed. Its horizontal location resets at the GIF wrap; that reset is a diagnostic viewport reset, not the intended sprite motion.
- `review/contact_sheet.png`, `review/gait_details.png`: full-body and enlarged phase inspection.
- `index.html`: self-contained current-base versus trial preview with pause, stepping and speed control.
- `frames.json`, `validation.json`: gait tracks, source hashes and technical checks.

Frame count remained 32. PNGs have true alpha. GIF timing uses 40/50 ms delays totaling 1.36 seconds. Existing package hashes were verified unchanged. Technical checks do not establish visual approval. No browser visual automation was used; visual assessment was ordered frame/phase inspection, not claimed real-time perceptual certification.

The missing production prerequisite exposed by this trial is a clean, separately controllable bilateral leg/garment overlap source that supports the required range while preserving the painterly edge contours. The current flattened source did not yield that cleanly in this extraction attempt. No GardenScene, existing Fairy implementation, landmark interaction, or application integration was changed.
