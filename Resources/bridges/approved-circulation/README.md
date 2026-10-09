# Approved circulation — runtime implementation

No image generation was used in this implementation. `approved-detail.png` is
the user-provided approved close-up. The approved full-map visual blueprint is
preserved at `output/garden-circulation/full-map-railed-stair-v1.png`.

## Production integration

`mobile/src/components/garden/GardenConnectionLayer.tsx` renders six independent
PNG layers: combined road/junction, three small flush shoreline replacements,
one staircase and one bridge. The existing flower arch is still rendered by
`LandmarkLayer` above them. The unrelated tea bridge retains its original asset
and exact transform. Original island images are not modified.

The three opaque landing cutouts mask only the blocking shoreline/curb sections.
They are drawn over land and below stairs/bridge. They contain no blocking rock,
vegetation or railing across the walking centerline. Surrounding shore pixels
remain untouched. `openings` in the manifest documents these reversible masks.

## Registered world coordinates

| Piece | Image rectangle x,y,w,h | Walking anchors | Width |
|---|---|---|---|
| Stair | 1380,785,530,390 | Central 1490,895 → Land08 1797,1048 | 122 |
| Bridge | 1545,1185,365,310 | Road 1638,1408 → Land08 1809,1289 | 88 |
| Combined road | 1300,1350,680,2950 | Land09 1398,1457; stem 1600,1750; off-map 1710,4300 | approximately 182 paving, irregular planted banks outside |
| Existing arch | x1380,y1450,scale0.3,rotation−6° | feet around 1500,1755 and 1710,1755 | unchanged |

PNG transforms are baked and therefore render with scale 1 and rotation 0 in
their registered world rectangles. Manifest coordinates are the source of truth.
Do not re-enable the retired local entries in `gardenConnections.json`.

## Rebuild and check

From `mobile/`:

```sh
node scripts/build-approved-circulation.cjs
node scripts/verify-approved-circulation.cjs
npx tsc --noEmit
```

The build script performs deterministic extraction, transparency matting and
registration of the approved painted art. No service or image model is called.
`main-road.png`, `land09-road-transition.png` and `approved-road-junction.png`
are build components; runtime uses only `main-road-connected.png`.
Source/runtime PNG and manifest copies are SHA-256 identical.

## Runtime verification

Open `/garden-test`. DEV Controls → Inspect stair landing / Inspect circulation
are camera-only checks and never change placements. The actual Garden scene
was inspected in the browser, including the stair entrances, bridge, Land09
junction and independent arch. Native iOS Metro compilation was checked;
an iPhone hardware test was not available in this environment.

The web entry loads locally served CanvasKit before Expo Router imports shader
modules. Native uses its unchanged synchronous Expo Router startup, selected by
`bootstrap.native.js`. Web output is client-rendered (`single`) because the
garden's GPU shaders cannot execute during static server rendering.

The retired procedural renderer is backed up under
`output/garden-bridges/GardenConnectionLayer.procedural-backup.tsx`.
The old offline preview script requires `--legacy` and cannot be used as evidence
for the new runtime. Asset verification is complementary, not a substitute for
visually opening `/garden-test`.
