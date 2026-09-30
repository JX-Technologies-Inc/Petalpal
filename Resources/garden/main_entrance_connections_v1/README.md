# Main Entrance local landing correction — pending visual approval

## Scope
Two separate transparent world-aligned connection overlays only. Main Entrance V2 artwork, width, flowers, vegetation and placement are unchanged. All pre-existing Garden artwork is byte-identical to the start of this pass. Land09, B01 and all other transforms remain unchanged.

## Land09
Staggered interlocking groups of gray, intermediate gray-beige, and warm stones replace the straight local material collision. Two short capped curb ends frame the path opening. The mask follows an irregular local masonry region; no blur or broad alpha feather is used to hide the seam.

## B01
Compact fitted stone landing beneath the existing bridge foot. The unchanged original bridge alpha excludes the overlay from bridge pixels, retaining the deck, rails, posts, and flowers. Original arch renders in front. No bridge transform or source artwork changes.

## Runtime
`mobile/src/components/garden/GardenInfrastructureLayer.tsx` loads the two new assets after the existing infrastructure layers and before landmarks. Assets and world bounds are in `verification.json`. Both canvases are 2400×1800 at world origin, rotation zero. Their nontransparent pixels are confined to the two local connections.

## Review evidence
Seven requested images in `review/` are crops of actual `/garden-test` screenshots, with identical before/after framing. Extreme closeups are enlarged runtime crops, not new generated detail. `source/construction-preview.png` is an offline assembly check only, not a runtime review image. Runtime inspection covered the two joins and full visible entrance. Animated water/fish may differ between captures.

## Generation and restore
Used built-in image_gen for local edit candidates. Exact prompts are in `source/exact-prompts.json`; full candidates retained alongside tightly masked transparent exports. Generated pixels outside local connection masks are discarded. Existing assets were never overwritten. Restore `backup/GardenInfrastructureLayer.tsx` to its original runtime path to disable both additions. `backup/baseline.json` stores original hashes. `build.py` reproduces layer extraction; `package_review.py` verifies locked files and exports review crops.

Stopped for visual approval. No other circulation or vegetation work performed.
