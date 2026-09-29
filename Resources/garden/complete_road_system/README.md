# Complete Garden Road review

Implemented in the real `http://localhost:8082/garden-test`.

## What changed

The missing Treehouse → western path ground connection is now an independent runtime Road layer. It uses the approved master stone library and Curve V2 rigid placement, a smooth two-part curve, approximately 39 world-pixel ordinary width, endpoint width adaptation, restrained color/shading variation, a local receiving-path paving blend, and separate exact-pixel foreground occlusion. No straight image strip was bent.

The existing west–Central, Central–Land0405, Central–Land09, Land09–Entrance and Entrance stem were inspected at normal, medium and close scales. They were already connected and were retained. The complete audit includes them explicitly rather than counting only newly generated pieces.

No existing asset or transform changed. B01, B02, ST01, SS01, all Lands, Water, landmarks, the Main Entrance and prior endpoint cleanup are preserved. Source and backup files remain intact. See `verification.json` for the checkpoint comparison.

## Runtime files

- `mobile/src/components/garden/GardenRoadApproachLayer.tsx`: new Road and foreground pair.
- `mobile/src/components/garden/GardenScene.tsx`: render the pair with Infrastructure ON, plus camera-only Treehouse/Entrance/medium Road review buttons.
- `mobile/assets/garden/roads/complete/R01_treehouse_path.png`: transparent, world-aligned paving.
- `mobile/assets/garden/roads/complete/R01_existing_foreground.png`: transparent, world-aligned original tread/root/boulder contact pixels.

All new PNGs use a 2400 × 1800 world canvas at origin (0,0), with no additional rotation or scale. The layer is drawn above the existing Treehouse ground and restores selected original foreground pixels over the paving. The Treehouse's source layers and placement are unchanged.

## Review files

1. `01_complete_road_runtime.png` — real runtime, normal framing.
2. `02_referenceB_vs_runtime.png` — confirmed Reference B and actual runtime.
3. `03_road_topology_overlay.png` — all Road IDs and infrastructure crossings.
4. `04_all_road_junctions.png` — every ground Road connection and entrance junction.
5. `05_treehouse_road_closeup.png`.
6. `06_west_central_road_closeup.png`.
7. `07_central_land0405_closeup.png`.
8. `08_central_land09_closeup.png`.
9. `09_land09_entrance_closeup.png`.
10. `10_complete_circulation_clean.png` — cropped actual runtime without controls or labels.

Closeups and contact sheets enlarge captured pixels; they are not offline reconstructions. Normal framing retains the current runtime's world-boundary clipping. Raw screenshots and medium views are included for provenance. The diagnostic `treehouse_working.png` is a construction aid only and is not used as final runtime evidence.

## Verification / restore

TypeScript passed. Infrastructure OFF/ON was tested and restored ON; normal camera restored. The ten final PNGs were decoded and the comparison, topology overlay, and complete junction sheet were visually inspected.

`road_topology_manifest.md` documents all ten audit IDs: six implemented ground routes and four crossings already satisfied by locked infrastructure.

To return to approved circulation V1, restore only `mobile/src/components/garden/GardenScene.tsx` from `Resources/garden/checkpoints/APPROVED_CIRCULATION_V1_2026-09-23_155002/snapshot/`. All other existing checkpoint files are unchanged. The newly added Road component/assets can remain unused for reversible rollback; do not delete the V1 checkpoint.

The implementation is ready for visual review. No production/mobile deployment was performed.
