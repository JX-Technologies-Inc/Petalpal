# Main Entrance Road V2 — pending visual approval

Implemented directly in `/garden-test`. Only `mobile/assets/garden/bridges/approved-circulation/main-road-connected.png` changed among the baseline Garden runtime assets and components.

## Appearance
Replaced the broad dense cobbled roadway with a narrower pedestrian route, larger warm beige irregular slabs, and irregular low planted edges. Local branches meet the existing Land09 circulation and B01 landing. The old road bitmap is replaced, so it is not rendered beneath the replacement.

## Unchanged runtime placement
Canvas: 680 × 2950. World x=1300, y=1350, width=680, height=2950, rotation=0, fit=fill. Rendered after Lands and before the approved infrastructure overlays and landmarks. Arch, B01 and all other transforms remain unchanged.

## Source and restoration
`backup/main-road-connected.png` is the previous asset; copy it back to the runtime path above to restore this change. Existing approved checkpoints remain untouched. `source/main-road-v2.png` is the transparent replacement. `source/prompt.txt`, `source/entrance_generated.png`, and `build.py` document generation and registration. The offscreen tail continues the asset below the normal Garden boundary; this tail is outside the reviewed normal framing.

## Runtime visual review
Reloaded actual localhost:8082/garden-test after replacement. Inspected normal full-Garden framing and zoomed entrance framing: narrower walking surface, larger warmer slabs, unobstructed paving, arch framing, both branch contacts, and organic edges. Existing locked landing/upper-contact stone remains its original cooler material. Review outputs are crops or paired composites of real browser screenshots, except the explicitly named Reference B image. No offline reconstruction is used as runtime evidence. Animated water/fish may differ between captures. Before/after arch crops use identical camera framing and pixel crop.

`verification.json` records the baseline hash audit. All 10 requested PNGs are in `review/`. No vegetation phase was started. Await visual approval.
