# Approved eight-pose sprite test

Eight source poses, order 1–8, 100 ms/frame, 800 ms loop. No generated artwork, optical flow, deformation, replacement poses or in-betweens.

## Extraction

The supplied source is 1448 × 1086 RGB, not transparent. Each exported frame is 362 × 482 RGBA, using a fixed 362-pixel column pitch and 522-pixel row pitch, with a common nominal ground baseline at y=472. No independent resizing, bounding-box centering or pose correction was applied. Original source RGB values are retained exactly; alpha alone is reconstructed. Original crops and extraction masks are included for comparison. Metadata records crop coordinates and hashes.

Background removal uses connected character segmentation, protects pale interiors, excludes disconnected decorations and numbers, and reduces low-chroma paper at the outside matte. Pale edge quality still needs manual approval, particularly on dark backgrounds. True translucent wing/petal alpha cannot be exactly recovered from a flattened RGB sheet. This is not a claim of pixel-identical appearance on every background.

## Playback

`index.html` is self-contained. Play/pause, previous/next, frame number, animation speed, light/dark background, and an independent 0–240 px/s travel slider are provided. GIF uses a light review background and loops at the exact 100 ms timing.

DEV route: `/fairy-sprite-test`. Production visits redirect home. Native/web sprite display uses the extracted PNGs directly at one common display scale. Animation and travel speed are independently selectable. Pausing freezes both, stepping changes only the displayed pose. No GardenScene integration.

## Validation and limits

- TypeScript: `npx tsc --noEmit` passed.
- Eight RGBA canvases and exact frame order verified.
- Source RGB equality against original crops passed for all eight frames.
- GIF: eight frames, 800 ms total verified.
- No per-frame resampling or artificial scale adjustment; variation already painted into the source is retained.
- Static light/dark contact sheets inspected. Some pale matte residue is possible; no claim of perfect background recovery.
- Source hand, hem and shoe changes remain discrete at 10 fps. A static extraction cannot guarantee no perceptual flicker, shoe popping, or a seamless 8→1 transition without altering approved poses. Those checks remain for manual playback review.
- Baseline uses the sheet grid rather than independently translating each character. Source head/hem differences remain visible and are not silently normalized.
- Travel speed is user-controlled, not calibrated root motion; foot locking is not guaranteed.
- No browser automation or live Expo runtime QA was performed. Type checking is not a substitute for device review.

Changed application files: one new route `mobile/src/app/fairy-sprite-test.tsx` and eight new PNG assets under `mobile/assets/dev/fairy-approved-walk-8/`. Existing Fairy and Garden implementations were not edited.
