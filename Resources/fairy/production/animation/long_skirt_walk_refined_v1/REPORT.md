# Long-skirt refined walk — visual gate FAILED

This package is a diagnostic candidate, not a completed or approved production walk. Three image-generation attempts did not meet the requested believable alternating gait. The third is exported so the defects can be inspected. No Garden, Expo, FairyLayer, Blender rig, or Spine project was changed.

## Outputs

- `frames/frame_01.png` through `frame_16.png`: 16 distinct RGBA images, 378 × 378 canvas.
- `review/contact_sheet.png`: all 16 frames, labeled with **intended**, not proven, phases.
- `review/walk.gif`: neutral-background GIF, 170 ms/frame, 2.72 seconds/loop, approximately 5.88 FPS.
- `review/walk.png`: full-alpha APNG, same timing.
- `review/alpha_checks.png`: light/dark checks for 1/5/9/13.
- `index.html`: play/pause, frame step, scrub, speed, background, and independent horizontal travel diagnostic. Default page playback is 6 FPS (2.667 seconds); GIF uses centisecond-compatible 170 ms.
- `frames.json`: source crop rectangles, alpha bounds and hashes.

## Motion design and actual result

The planned cycle used symmetric contacts at 1/9 and opposite passing at 5/13. Near anatomical left was intended to support in the first half; far right in the second. Support feet should travel backward relative to the root while swing feet advance with minimal lift. A colored skeletal guide was supplied to constrain this logic. Those guide colors are diagnostic only, not costume changes.

Compared with the old six-pose sheet, frames 5/13 now have a narrower shoe arrangement, and there are 16 separate painted images. This does **not** establish a better real walk: motion synthesis still repeats rear-foot lifting instead of reliably tracking two distinct legs through support and swing. More frames did not solve the core failure.

## Strict visual assessment

| Check | Result | Evidence / limitation |
|---|---|---|
| A — Left/right alternation | FAIL | 1 versus 9 does not convincingly exchange anatomical lead legs. Repeated rear-foot lifts in 3/4, 7/8, 11/12, 15/16 retain the old ambiguity. |
| B — Contact | PARTIAL | 1 has separated shoes, but 9 does not convincingly establish the opposite two-foot contact. |
| C — Passing | FAIL | 5/13 bring shoes together, but both resemble similar closed stances; a distinct lifted swing foot passing a planted opposite foot is not reliable. |
| D — Grounding | FAIL / not certified | No continuous support-foot track is established. Fixed-grid alpha bottom varies by 3 pixels. Independent travel cannot create foot locking. |
| E — Naturalness | FAIL | Redundant foot arrangements and discontinuous cloth/body changes remain; no claim of polished fluid walking. |
| F — Identity | PARTIAL | Palette, updo, crocus and wings broadly persist, but face/body orientation and costume shape vary. Exact identity preservation is not certified. |
| G — Long skirt | FAIL | Hem and front opening vary; leg/knee-area coverage is not consistently the approved long-skirt silhouette. |
| H — Loop | FAIL visually | Technical playback loops; 16-to-1 artwork continuity is not seamless. |

These findings are based on contact-sheet, paired-phase, and alpha-background visual inspection plus pixel checks. No browser playback/screenshot automation or production runtime QA was performed. The interactive/GIF previews are supplied for manual motion review; technical loop validity does not prove perceptual quality.

## Extraction and alpha

Generated source is 1254 × 1254 RGBA with genuine alpha. A regular 4×4 grid is sliced at rounded fractional boundaries, then uniformly padded 32 px. No frame is independently resized, recentered, repainted, mirrored or warped. Source crop pixels and alpha are preserved exactly. All frames use the same canvas, but **the generated character registration and apparent geometry are not perfectly consistent**. Uniform padding cannot repair those source defects.

At alpha >16, no character touches its source-cell boundary. Light/dark composites show no gross background rectangle; fine wing/edge fidelity is not pixel-identical to the reference and is not production-approved. No white-color removal was used. The original reference images remain unchanged (SHA-256 verified).

## Production method and validation

Built-in imagegen was used, not an API/CLI fallback. Exact prompts are in `source/generation_prompt*.txt`; `source/gait_guide.png` records intended pose structure. Python/Pillow performed lossless extraction, padding, contact sheets, and preview encoding only. The rejected first sheet is retained with a REJECTED filename; final candidate remains failed, not approved.

`python validate.py` passes: 16 unique RGBA frames, equal dimensions, alpha extrema, exact source-crop preservation, 16-frame GIF/APNG timing, unchanged authoritative source hashes. `node --check preview.js` passes. These are file/playback checks, not a visual pass.

Required before production: correct actual leg ownership through the entire cycle, credible opposite passing, stable opaque knee-covering skirt, stable side camera/face, a measured support-foot track and seamless painted loop. Do not integrate these candidate frames into the app.
