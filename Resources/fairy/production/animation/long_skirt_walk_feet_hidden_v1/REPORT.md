# Lower-skirt coverage candidate — manual review required

Source: supplied `long_skirt_walk_feet_v2.zip`. All 32 source PNG bytes match the corresponding workspace files. Originals were not overwritten.

## Preserved

- 32 frames, original order, 378 × 378 RGBA.
- 42.5 ms/frame, 1360 ms loop; source GIF 40/50 ms schedule retained.
- Travel speed 52.182163187855785 px/s retained.
- No leg, shoe, body or gait transforms applied to source frames.
- Source image remains the underlay; only a lower textile overlay is composited.
- Zero decoded RGBA changes outside each documented mask, including blend margins.
- Protected forefoot regions remain pixel-identical. Shoes are not moved, resized, deformed or repainted, but higher shoe portions are intentionally occluded by petals. Therefore whole visible-shoe pixel equality is not claimed.

## Coverage method

The built-in image editor generated a textile donor from source frame 1. Only a lower-petal crop is used; generated head, body, wings, shoes and pose are discarded. The same donor is composited across the sequence to avoid independent frame-to-frame art redesign. Its small placement offsets follow the existing body bob/sway. This does not warp the original animation. `build.py` records the donor crop, placement, blend region and protected forefoot areas. Binary mask PNGs include every changed pixel.

## Visual limitations — NOT marked PASS

Light/dark before/after sheets cover all 32 frames. Ankle coverage is substantially increased, but the added lower edge reads overly uniform and has a cutout-like outline. The garment join and some partly hidden toe silhouettes need manual review, particularly at crossings around frames 9–11 and 25–27. Smoothness equivalent to the source is not certified. No claim that the static sheets prove absence of hem flicker or popping.

Original faint alpha/color residue outside the edit remains untouched by requirement. The new overlay's edges must also be reviewed on dark backgrounds; zero new halos is not certified.

## Files

`frames/`: 32 coverage PNGs. `masks/`: exact edit regions. `frames.json`: original timing/tracks plus preservation checks. `review/contact_comparison.png`: all original/corrected full-body frames. `review/alpha_light.png` and `review/alpha_dark.png`: lower-skirt comparison. `walk.gif`, `travelling.gif`: original timing. `index.html`: self-contained comparison, play/pause, stepping, speed, background and matched travel.

No GardenScene, app integration or source application files changed. Stop for manual review.
