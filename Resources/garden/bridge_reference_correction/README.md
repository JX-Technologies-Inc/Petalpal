# Bridge reference correction

Reference A is `mobile/assets/garden/reference/structure-final-version.png`. The labeled `Resources/decorations/garden_connection_plan.png` identifies B01 and B02 but did not set their endpoints.

## Registration and placement

`analyze_reference.py` measures seven island grass centroids in Reference A and the saved infrastructure-OFF Garden runtime. Their affine fit is recorded in `alignment.json`. `build_bridge_correction.py` traces the B01/B02 centerlines in Reference A, maps them into the 2400 × 1800 world, and seats the final feet on the **existing** current-world paths. The final foot adjustments account for differences between the finished illustration and the locked Land/Main Entrance layout. `06_bridge_alignment_debug.png` shows the mapped lines, final feet, and rendered asset bounds.

| Bridge | Final world A → B | Final centerline | Reference centerline | Scale | Sprite rotation |
|---|---|---:|---:|---:|---:|
| B01 | (1640, 1410) → (1830, 1310) | −27.8° | −24.8° | 0.1449 | 4.9° clockwise |
| B02 | (1545, 475) → (1785, 425) | −11.8° | −11.7° | 0.1655 | 20.9° clockwise |

Both bridges reuse `Resources/decorations/bridge/rendered/bridge_entrance_to_right.png`. The foreground occlusion PNGs contain only sampled original road/Land pixels near the feet. The rejected narrow entrance-road neck was removed from the mobile runtime; `GardenConnectionLayer` draws the unchanged main road in both DEV toggle states. ST01 and SS01 are unchanged. Previous runtime B01/B02 layers are backed up in `previous_runtime_layers/`.

## Runtime review

`runtime_canvas.png` is an actual Skia canvas snapshot of Expo web `/garden-test` with the final bridges. The six numbered PNGs are the requested matched full view, B01/B02 comparisons, landing closeups, and alignment debug. `make_review.py` rebuilds them from that snapshot and Reference A. The DEV Infrastructure toggle was tested ON → OFF → ON; `/garden-test` reopened with ON by default. TypeScript passed. Native-device rendering was not tested.
