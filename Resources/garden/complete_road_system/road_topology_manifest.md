# Complete Road system — final topology audit

Reference A: `Resources/decorations/garden_connection_plan.png`, explicitly confirmed by the user. Blue strokes specify endpoints, not footprints. Reference B: `Resources/structure-final-version.png`, explicitly confirmed by the user as the final visual target. Exact geometry is taken from the current `/garden-test` implementation.

World coordinates: 2400 × 1800, x right, y down. All infrastructure placements, Lands, landmarks, Main Entrance artwork and Water are locked to APPROVED_CIRCULATION_V1_2026-09-23_155002.

IDs below are audit IDs for this task; R01 does not refer to the rejected historical Road asset.

| ID | Circulation endpoints | Approximate current centerline | Implementation / runtime asset | Status |
|---|---|---|---|---|
| R01 | Treehouse stair approach → western Land101112 path | Two tangent-continuous cubics: (703,433), (690,452), (690,481), (653,501); then (653,501), (616,521), (594,550), (556,529) | New Curve V2 rigid stone reconstruction in `mobile/assets/garden/roads/complete/R01_treehouse_path.png`; exact existing tread/root/boulder pixels in `R01_existing_foreground.png`. Independent local layer over Treehouse ground, with foreground restored; source landmark unchanged. Ordinary width 39, transitioning toward 48/44 at the ends. | ROAD — IMPLEMENTED |
| R02 | Western Land101112 junction → Central outer ring | Cubic (718,724), (767,726), (840,710), (854,760) | Existing Curve V2 footprint with receiving-path paving blend: `mobile/assets/garden/infrastructure/seams/Road_west_seamed.png`; retained after inspection of both junctions | ROAD — IMPLEMENTED |
| R03 | Central upper ring → Land0405 lower path | Cubic (1320,430), (1340,410), (1374,389), (1400,375) | Existing Curve V2 footprint with receiving-path paving blend: `mobile/assets/garden/infrastructure/seams/Road_other_seamed.png`; retained after inspection of both junctions | ROAD — IMPLEMENTED |
| R04 | Central lower ring → Land09 upper path | Cubic (1215,955), (1217,1000), (1229,1048), (1230,1078) | Existing Curve V2 footprint with receiving-path paving blend: `mobile/assets/garden/infrastructure/seams/Road_other_seamed.png`; retained after inspection of both junctions | ROAD — IMPLEMENTED |
| R05 | Land09 lower-right path → Main Entrance branch | Approximately (1388,1450) → (1490,1505) | Existing Main Entrance artwork plus `mobile/assets/garden/infrastructure/seams/Road_entrance09_seamed.png`; both endpoints inspected and retained | ROAD — IMPLEMENTED |
| R06 | Main Entrance junction → entrance stem / lower Garden exit | Existing Main Entrance centerline, approximately x1600 continuing beyond world bottom | `mobile/assets/garden/bridges/approved-circulation/main-road-connected.png`; approved artwork/transform preserved | ROAD — IMPLEMENTED |
| R07 | Central → Land06 | (1570,600) → (1790,540) | Locked B02 and endpoint occlusion | INFRASTRUCTURE — ALREADY SATISFIED BY B02 |
| R08 | Central → Land08 | (1490,860) → (1840,1030) | Locked ST01 and endpoint occlusion; the blue continuation in the older diagram is encompassed by the currently approved stair span | INFRASTRUCTURE — ALREADY SATISFIED BY ST01 |
| R09 | Main Entrance branch → Land08 | (1628,1442) → (1830,1310) | Locked B01 and endpoint occlusion | INFRASTRUCTURE — ALREADY SATISFIED BY B01 |
| R10 | Land07 → Land08 | Six stones from (2186,900) to (2086,1063) | Locked SS01 | INFRASTRUCTURE — ALREADY SATISFIED BY SS01 |

## Reference A region audit

- Upper left: blue Treehouse approach branching toward the western path — R01. It must follow support in the current geometry, not the blue polygon outline.
- West/Central, Central/0405, Central/09: ground continuity is explicitly required by the task text and is represented by current R02–R04.
- Right: labeled B02, ST01, SS01 crossings — R07, R08, R10. No additional Road over water.
- Lower right: labeled B01 and its short blue entrance approach — R09; locked current endpoint treatment remains.
- Lower center: Land09 blue branch and long entrance stem — R05, R06.

## Runtime and preservation checks

- All six ground routes are present in `/garden-test`. R01 is newly implemented; R02–R06 already existed and were inspected at full, medium and junction scale before being retained. No historical rejected R01 asset is loaded.
- Four crossings are satisfied by the approved B01/B02/ST01/SS01. No duplicate Road was added across those water gaps.
- R01 uses individual rigid stones from the approved master library, not a warped straight strip. The two cubic derivatives at their join are collinear: (-37,20) and (-37,20). Its mask follows existing ground, forms one connected component, and has zero visible paving pixels where supporting alpha is below 32. Ground support includes the Treehouse's existing painted ground/root shelf; no new land geometry was made.
- New Road images are full transparent 2400 × 1800 canvases drawn at x=0, y=0, width=2400, height=1800, rotation=0. Contact occlusion reuses original world-aligned pixels. Nothing is baked into Land images.
- The Infrastructure toggle was exercised OFF and ON in the live runtime and left ON. The camera was returned to normal framing.
- All 482 checkpoint files were compared by SHA-256. Only `mobile/src/components/garden/GardenScene.tsx` differs, adding the Road component and camera-only review controls. Every existing asset and placement configuration is byte-identical, including B01/B02/ST01/SS01, Water, Lands, landmarks, Main Entrance and all prior seam assets. See `verification.json`.
- `npx tsc --noEmit` passed.

## Visual audit and review evidence

| Route | Full and medium review | Junction inspection | Evidence |
|---|---|---|---|
| R01 | Short subordinate curve from Treehouse toward western path; no new open-water span | Corrected early cut edge and uniform paving; final stair contact and receiving-path blend inspected | `05_treehouse_road_closeup.png`, `runtime_medium_west.png` |
| R02 | Continuous west–Central route | Both receiving directions and existing curb opening inspected; retained | `06_west_central_road_closeup.png`, `runtime_medium_west.png` |
| R03 | Continuous upper junction | Existing widened receiving opening and paving blend inspected; retained | `07_central_land0405_closeup.png`, `runtime_medium_upper.png` |
| R04 | Continuous lower junction | Narrow connecting neck and both receiving paths inspected; retained | `08_central_land09_closeup.png`, `runtime_medium_lower.png` |
| R05 | Existing entrance branch reaches Land09 | Paving continuity and arch-side overlap inspected; retained | `09_land09_entrance_closeup.png`, `runtime_medium_entrance.png` |
| R06 | Existing entrance stem continues below Garden framing | Branch/arch junction inspected; no replacement of locked entrance artwork | `04_all_road_junctions.png`, `runtime_medium_entrance.png` |

All ten requested review PNGs were generated from actual runtime screenshots (plus the confirmed Reference B in the comparison). This records internal QA; visual approval remains with the user.
