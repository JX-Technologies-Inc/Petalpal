# Ankle-length Fairy walk — 16-frame production-format export

The approved longer-skirt reference was extracted into **16 transparent 378 × 378 PNGs**, in its original row-major order. Labels, numbering and sheet margins are excluded from each PNG. The source sheet and all earlier animation packages remain unchanged; no application integration was performed.

Timing is **85 ms/frame, 1.36 seconds/loop**. GIF delays alternate 80/90 ms because GIF timing is quantized to centiseconds. PNG sequence and HTML use the exact 85 ms timing. No frames were added, synthesized, reordered or crossfaded.

All frames use one common extraction scale. Only integer translations of up to two pixels align the lower support silhouette at y=342 and stabilize horizontal registration. No independent frame rescaling or limb deformation was applied. Visible height varies from 304–308 pixels with the source poses/contours; that variation was retained rather than stretching frames to identical bounds.

## Deliverables

- `frames/frame_01.png` through `frame_16.png`: RGBA sprite sequence.
- `frames.json`: frame order, timing, source provenance, registration and SHA-256 hashes.
- `index.html`: self-contained looping player with pause, previous/next, scrub, playback speed, light/dark/checker backgrounds, baseline guide, enlarged hem detail and approximate 96/108/120 px runtime-size checks.
- `review/contact_sheet.png`: all 16 full-body frames.
- `review/walk.gif`: looping review on a neutral background. PNGs are the transparent production assets; GIF is a review format.
- `review/alpha_dark.png`, `hem_details.png`, `hem_details_dark.png`, `loop_transition_details.png`: edge and pose review aids.
- `validation.json`, `validate_package.py`, `test_player.cjs`: reproducible technical validation.

## Visual review and remaining limits

- **Skirt/ankles:** ankle-length layering is retained throughout. The skirt conceals the previously problematic lower-leg joins; it does not repair the hidden anatomy. Shoe fronts and lifted rear shoe portions remain visible. No lower-petal repaint was added during extraction.
- **Step visibility:** separated poses show both shoe silhouettes. Contact/crossing poses 5 and 13 show less separation, consistent with the approved sheet; the skirt has not been cut shorter to reveal joints. The sheet's anatomical left/right identity is not independently established by these exports, so this is not a claim that the earlier gait limitations are solved.
- **Registration/scale:** the strong-alpha support baseline is identical in every frame, with ample transparent padding. The head and skirt retain small source pose differences. A fixed sprite baseline does not prove world-space foot locking during travel.
- **Edges:** a spatially fitted background and connected foreground trimap preserve pale interior painting; edge coverage and background decontamination reduce the light fringe. All frames were inspected on light and dark contact sheets. The source was flattened RGB, so the exact original physical transparency of wings and petals cannot be recovered. Their pale/translucent painted appearance is retained, with reconstructed soft outer alpha. At large magnification, soft source-resolution detail remains.
- **Loop / foot-popping risk:** frames 4→5, 8→9, 12→13 and 16→1 are supplied as enlarged transition pairs. In particular, 4→5 and 12→13 make comparatively large shoe-position changes from spread to closed poses. Those source transitions are retained, without invented intermediate frames. The no-foot-popping and clear alternating-leg gates are not certified as passed. Final full-speed perceptual approval remains a manual check; ordered-frame inspection and timing tests do not certify the walk as perfectly natural.

The export/package checks pass. This is ready for **production-asset review**, not automatic final visual approval or Garden integration.

## Tests

`python validate_package.py`: 16 RGBA files, 378 × 378, empty 20 px outer borders, no RGB residue in transparent pixels, soft alpha present, y=342 baseline, hashes, unchanged source, 16-frame GIF and 1360 ms loop.

`node test_player.cjs`: self-contained asset loading, controls, stepping/wrap, 85 ms progression, speed change, pause, scrub and synchronized views in a mocked DOM. No headless browser or screenshot automation was run.
