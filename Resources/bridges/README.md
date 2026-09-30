# PetalPal qingshi connections — r1

New assets generated with the built-in imagegen tool, not replacements for existing artwork.
The three bridge PNGs retain generated RGBA alpha; paving is an opaque repeating material.
Runtime copies: `mobile/assets/garden/bridges/` (byte-identical).

## Generation prompts / art direction

- **qingshi-arch-r1.png:** One isolated transparent RGBA classical Chinese garden stone bridge; high overhead 65-degree light-isometric camera; horizontal left/right walking axis; shallow graceful arch; small rectangular staggered qingshi paving; slender short capped posts and two open rail segments; flat paved apron ends; soft painterly daylight. Muted grey-green #a6a391 stone and #737967 shadows. No scenery, text, dragons, lamps, gold, white marble, thick outlines, or large black shadow.
- **qingshi-low-r1.png:** A short low secondary qingshi footbridge; bottom-left to top-right diagonal; high overhead camera; slender straight deck with very shallow rise, two shallow steps and landing aprons; four small capped posts per side; same grey-green palette, soft semi-realistic painterly daylight and restrained moss seams; genuinely transparent background and railing gaps; no scenery or ornaments.
- **qingshi-step-r1.png:** A compact low qingshi crossing; upper-left to lower-right diagonal; posts point upward in the image; high overhead light-isometric camera; low gentle arch, narrow deck, understated rails and landing aprons; same weathered grey-green rectangular paving and soft painterly fantasy-garden finish; transparent background; no water, island, scenery, text, gold or monumentality.
- **qingshi-paving-r1.png:** Seamless top-down qingshi paving material; muted warm grey-green #a6a391 flagstones, #737967 narrow joints, sparse subtle moss; small uneven staggered rectangular paving; restrained soft daylight; no perspective, borders, grass, scenery, text, tan dirt, white marble or harsh contrast.

## Integration

`gardenConnections.json` is the independent connection layout; no land or landmark baseline is changed.
The latest labeled Central/Land08/Land09 reference supersedes all previous circulation experiments.
The unrelated tea bridge is unchanged; the local system has exactly one stair, one bridge and one road.
- Direct stair: Central (1510,900) → Land08 (1790,1040), width 86, eight treads.
- Small bridge: primary road (1660,1475) → Land08 (1825,1280), deck width 64.
- Primary road: Land09 perimeter (1415,1460), through gate center (1610,1750), to off-map (2200,4300).
- Primary road width at gate: 228, tapering to the existing Land09 path opening.
- Gate artwork/placement remains (1380,1450), scale 0.3, rotation -6 degrees.
The former `moonAccess` road is deleted from the runtime data and renderer, not merely hidden.
The previous entrance-to-access-walk bridge is replaced with the independent Land08-to-primary-road bridge.
No road connects Central to the primary road. No new path crosses an island lawn.
The primary road uses one continuous curved outline, not overlapping branch slabs or a landing platform.
The former narrow gate approach is replaced; both gate-foot contact samples sit on the new paving.
The old long central-to-Moon and 09-to-Moon spans are disabled; their PNGs remain available.
Removed tea → 07, 07 → Moon Bed, central → 09, swing → 09, and the floral-gate mini bridge.
Removed all three added island-interior path overlays and the detached oval gate platform.
The floral gate sits over one unbranched entrance walk continuing from island 09's southeast exit.
Existing adjoining upper/main land paths remain. No land or landmark was moved.
Previous connection code/layout is backed up in `output/garden-bridges/before-layout-correction/`.

Render after LandLayer (aprons overlap shore stones), before reference overlay and LandmarkLayer.
No new clocks, interactions, camera changes, water effects or landmark animation changes.

## Verification

Run `node scripts/preview-garden-bridges.cjs` from `mobile` for the offline static Skia scene,
source/runtime SHA-256 checks, true-alpha checks and inverse-transform land-alpha endpoint tests.
Island endpoints are checked against land alpha; local connector endpoints against their path outlines.
The entrance walk is not counted as an island-to-island bridge.
The preview uses static landmark art and omits fish/lotus; it is not an iPhone screenshot.
Native validation: `npx tsc --noEmit` and iOS Metro bundle build.
Latest verification: both pass. `/garden-test` web navigation currently fails before scene rendering
with `Cannot read properties of undefined (reading 'RuntimeEffect')`; no unrelated Skia/water code
was changed to bypass that error. Native device visual acceptance is not claimed.

## Previous edge-dressing pass (disabled)

The subsequent local rebuild removed all edge-dressing instances from runtime and preview.
`gardenConnectionDetails.json` and its PNG are retained only as unused previous work, not loaded by GardenConnectionLayer.
The latest pass replaces the local topology, reuses the arch bridge and paving assets,
and adds no decorative stones. Surrounding lands and landmark placements remain unchanged.
New `qingshi-edge-garden-r1.png`: 1536×1024 generated RGBA, preserved without pixel edits and copied byte-identically to runtime.
Generated with the built-in imagegen tool (no CLI). Final prompt:

> Use case: stylized-concept. Asset type: one small isolated transparent RGBA fantasy garden path-edge dressing sprite for a top-down/light-isometric game. Primary request: a restrained natural cluster of three small warm gray-green qingshi shoreline pebbles nestled in delicate moss, a few fine grass blades and three tiny pale ivory/lavender flowers. Semi-realistic soft painterly detail, hand-painted botanical texture, muted olive foliage, weathered blue-gray stone. Camera high overhead 65 degrees, no horizon. Compact low profile, asymmetrical silhouette, no soil platform, no ground plane, no water, no path, no scenery, no text. Full genuinely transparent background and gaps between blades, not a checkerboard painted into image. Object centered with ample transparent margin. This will be rendered very small beside existing garden paths, so avoid big leaves and decorative showiness. NOT vector, not cartoon, no black outline. Soft diffuse daylight, restrained contact shadows only inside the cluster.
