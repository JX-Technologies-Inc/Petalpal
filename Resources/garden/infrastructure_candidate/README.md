# PetalPal Garden infrastructure candidate

Review-only, non-destructive 2400 × 1800 assembly. The authoritative Garden transform is `mobile/src/components/garden/gardenMapLayout.ts`; each full transparent Land PNG is scaled to its declared width with proportional height and rotated around its image center, matching `LandLayer.tsx`. The water source and all production Land/decoration sources remain unchanged. No mobile integration was performed.

## Connections

| ID | Topology | Asset / placement | Review treatment |
|---|---|---|---|
| B01 | Main Entrance Road ↔ Land08 | Existing `Resources/decorations/bridge/rendered/bridge_entrance_to_right.png`, anchor (1740,1364), scale 0.154, camera azimuth 322° | Very short source-road shoulder taper under entrance deck; tiny Land08 foreground overlap from unchanged Land08 pixels. Bridge image unchanged. |
| B02 | Central ↔ Land06 | Same floral bridge render family, whole sprite at scale 0.154, rotated 32° clockwise about its walking anchor, new anchor (1676,500) | Small source-Land foreground overlap at the Land06 foot; the Central foot lands directly on its existing path. |
| ST01 | Central ↔ Land08 | Existing approved `Resources/bridges/approved-circulation/central-land08-stair.png`, registered at (1380,785), 530 × 390 | Existing painted landings used as supplied. |
| SS01 | Land07 ↔ Land08 | Four individually cropped rock tops from production Land08, placed along the right-side water gap | Separate transparent world-aligned overlay; no water ripples or Water V5 changes. |

## Road resolution

After the structures are placed, no additional ground Road segment is required. The lower blue route is supplied by the existing `main-road-connected.png`. The upper blue mark would cross open water as a floating Road in the current geometry; the rejected R01 Treehouse-to-Central asset is excluded. `road_entrance_existing_neck.png` is a review-only derivative of the already installed Main Entrance Road for B01's short approach, not a new topology segment.

## Layers and review

Draw order: water → production Lands → entrance road with B01 neck → SS01 → ST01 → B02 → B01 → selective production-Land foreground pixels. All named component PNGs in this folder are transparent, full 2400 × 1800, and aligned at world (0,0). The clean full Garden and equal-scale before/after are the primary review outputs; component closeups and debug image support seam inspection.

Remaining visual judgment: B01 and B02 use the same floral bridge artwork at different screen orientations, while ST01 uses the previously approved painted stone stair. SS01 uses four small stepping rocks; inspect their walkable rhythm at normal Garden scale. The historical painted stair art has softer detail than the current Land PNGs. These are candidate-level art consistency questions, not integration work.

Run `build_candidate.py` with Pillow and NumPy installed in `Resources/road/.tools` to reproduce the outputs.
