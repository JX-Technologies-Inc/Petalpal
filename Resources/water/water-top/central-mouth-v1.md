# Central-mouth correction

Generated using built-in imagegen, editing the complete raw final image. The original raw-final and all old assets are retained. No layer extraction.

Final: water-top-central-mouth-v1.png, 1536 x 1024 RGBA, SHA256 F43CE6ECA3BDAF8EC0AD6164835FC6C99FC7CF1D8BB011325FFABDEB5C34F968.

Placement fit: x769.4 y-218.96 scale0.33 rotation-2.5. Waterfall unchanged. All bank/cliff offsets0 scales1.

## Initial correction prompt

Use case: precise-object-edit. Image1 edit target, Image2 ONLY existing waterfall rock style reference. Correct Image1 upstream river SPRITE, same1536x1024 transparent RGBA canvas, same overall footprint and upper river offscreen entry. Do not add a full waterfall. Correct lower outlet: ONE central continuous spill lip centered at x800,y900, width approx430px (x585..1015). Horizontal pool surface seen at isometric angle converges into this front lip; immediately below lip a SHORT vertical water sheet to y985 fading to true transparency. NO water or little waterfalls emerging from rocks at either side. Near lower mouth, left/right dry retaining rock shoulders curve inward and flank lip; rocks frame water but do not produce it. No blue-water veils painted over sidewalls. In lower third use soft gray-beige rock groups consistent with Image2, less glittery noisy microdetail, more natural subordinate moss and leaves. Preserve upstream channel, overall composition, perspective, external footprint. Surface has gentle broad aqua tonal variations #6BBFC8 #84D1D8 #9DDEE3, no white zigzag/stripe ripples, no dense horizontal wrinkles, no speed lines. Clear horizontal-to-vertical turning edge in water, not a stone dam, single central source. Clean RGBA exterior without green/black matte, no checkerboard. Preserve complete image as ONE integrated sprite, not split panels or separate layers. No new flowers, no fish, no props.

## Outlet refinement prompt

Precise local correction ONLY to bottom quarter of this same1536x1024 RGBA river sprite. Preserve everything above y720. The lower spill is too wide: narrow the ONE water exit to x600..1000, lip at y880. Extend left dry rock abutment inward to x600 and right dry rock abutment inward to x1000 so they frame water without emitting it. Use 2-3 soft muted gray stones each, no noisy mini rocks. Water surface stays horizontal until single gently curved front lip at y880, then only central short falling sheet x600..1000 to y995 feathering into transparent alpha. REMOVE ALL water curtain outside this central outlet. No side trickles, no water on outside of rocks. No horizontal white ripple bands above lip; soften lower water texture. All external edges remain clean transparent, full canvas unchanged; no cropping or repositioning. Keep this as one complete image.

## Runtime

WaterTopSource renders the entire painting once above the scene. Its shader advects RGB only in the central open-water corridor; original alpha and rock/lip pixels remain fixed. Source Flow OFF renders the corrected static painting. Background/inactive/reduced-motion pauses use the existing hook. No new white strokes or procedural noise.

