# Lower-leg anatomy redraw — retry unblocked; visual correction failed

## Latest retry

The clarified clothed-game-sprite request succeeded in the built-in image service. **Service-blocked frame numbers: none.** An individual frame 17 edit and a 32-crop sheet for frames 1–32 were returned. The earlier moderation failure below is historical, not the current blocker.

The returned images changed unrequested pixels and local registration. They were not adopted as replacement sprites. Attempts to composite only the calf regions and restore all approved shoe pixels, followed by separate contour/mask repair experiments, still produced visible seams, holes and incorrect calf connections. The procedural contour experiment also failed and is not an accepted substitute for the requested redraw.

**No corrected frame has passed the complete visual gate. Frames 1–32 remain unresolved.** The most conspicuous discontinuities in the inspected phase comparisons include 13, 17, 21, 25 and 29; the all-frame dark sheet shows additional mask-edge defects. A source hash check and per-frame shoe/outside-mask checks passed, but those technical checks do not make the anatomy acceptable.

Original files under `../long_skirt_walk_feet_v2/` are unchanged. Nothing has been integrated into the application. `failed_composites/`, `review/`, `redraws/`, and the processing script are failed diagnostic work only. Do not use these outputs as production animation assets. No optical flow was applied.

The built-in prompts requested local lower-leg silhouette repair, ordinary continuous calf/shin volume, smooth taper to fixed ankle endpoints, separate legs, and locked shoes/straps/dress/upper-leg pose/composition. The raw service outputs are kept in `redraws/`; they are not approved references or replacement characters.

## Initial attempt history

The authoritative working source is `../long_skirt_walk_feet_v2/`. Its approved shoes and all original PNGs remain unchanged.

Prepared two registered input sheets under `inputs/`: lower-leg RGBA crops and a neutral-background inspection copy. Each contains 32 crops in a 4-column, 8-row layout. Source crop: (132,264) to (260,348), magnified 3x for editing; cell 384x256, y inset 2. These are preparation references only, not corrected animation assets.

The built-in image editing service was asked to redraw only the lower-leg anatomy, preserving shoes, straps, skirt, pose, registration and upper-leg endpoints. It returned no image: output moderation rejected the request with classification `sexual`, request ID `0c821859-1a7e-4cfd-a597-7fba58e61af1`.

No redraw was delivered, no calf repair was validated, and no new animation package or production-ready result is claimed. No optical flow or substitute deformation was applied. No Garden/application files were changed.
