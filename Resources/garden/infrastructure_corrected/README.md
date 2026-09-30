# Garden infrastructure correction candidate

This folder is a visual review candidate. It does not change the approved Garden source artwork or mobile app.

## Changes

- **ST01:** Replaced the monumental white stair with a narrow, low-profile warm-gray stone crossing. It has ten shallow treads, restrained stone texture and edges, and small foreground overlaps taken from the existing Central and Land08 artwork.
- **B02:** Kept the existing floral bridge sprite and route. Increased its scale only from 0.154 to 0.158, moved its anchor from (1676, 500) to (1676, 490), and used small foreground overlaps sampled from the connected Central-side land and Land06 to seat both ends.
- **SS01:** Replaced four small stones with six larger shoreline-rock sprites on a varied, walkable Land07-to-Land08 progression. No ripples were added.

B01 and its shoreline/entrance layers are loaded unchanged from `../infrastructure_candidate/`; their SHA-256 values are recorded in `manifest.json`. The 2400 × 1800 Garden world, Lands, road, and Water V5 remain unchanged.

## Review

`01_infrastructure_corrected_full.png` is the full Garden candidate. `02_current_vs_corrected.png` compares it with the previous candidate at the same scale. `03_`, `04_`, and `05_` show matched before/after crops for ST01, B02, and SS01.

The five named component PNGs are transparent, world-aligned layers. Run `build_corrected.py` to regenerate the review files from the approved project assets.
