# Automated Garden isolation audit — 2026-09-30

Diagnosis status: **live idle bottleneck not established**. Browser initialization failed again with a sandbox helper/kernel error. No FPS, GPU duration, actual React commit frequency or Canvas replay count was fabricated. No visual optimization, quality tier, artwork, production defaults, planting, saved-data or backend change was made.

## Automated scope and fixed scene

The real generator/drawing-function probe uses the existing deterministic June / Land06 30-parent QA records and approved Growth V1.1. It still produces 591 pieces. CPU probes run in Node with mocked hooks/decoded images; the waterfall probe executes the actual component/effects with a virtual 30-second clock. Neither is a live React/Skia benchmark. Static matrix entries traverse source import closures, not rasterized scenes; viewport 390×844 is recorded as a conceptual test fixture and does not affect these import bounds. No actual fixed-camera live scene was executed. In the device panel all quick buttons retain the existing camera/viewport and set the same readonly 30-parent records, with debug overlays off. Center June once before comparing. Existing calibration editing must be closed.

## Isolation matrix

Each row has unavailable live JS time, React/component rerender counts, redraw/replay count, FPS/p50/p95/p99 and resident memory (null in JSON). The texture figures are **reference inventory bounds**, including unused imports/alternative assets, not measured simultaneous residency. Flower function results are shared deterministic proxies, not separately timed live combinations. All pairs and subtractive configurations are encoded reproducibly.

| Configuration | Non-flower PNG references | Non-flower reference RGBA MiB | Mature flower proxy |
|---|---:|---:|---|
| A Land | 7 | 41.99 | Off |
| B + Infrastructure | 27 | 362.75 | Off |
| C + Static landmarks | 54 | 524.74 | Off |
| D + Flowers | 54 | 524.74 | 591 pieces; 69 MiB |
| E Water only | 27 | 145.48 | Off |
| F Waterfall only | 89 | 349.59 | Off |
| G Fish | 40 | 145.96 | Off |
| H Lotus | 51 | 146.86 | Off |
| I Landmark animations | 54 | 524.74 | Off |
| J Full | 193 | 937.69 | 591 pieces; 69 MiB |
| Full minus Flowers | 193 | 937.69 | Off |
| Full minus Water | 173 | 834.20 | 591 pieces; 69 MiB |
| Full minus Waterfall | 111 | 630.09 | 591 pieces; 69 MiB |
| Full minus Fish | 180 | 937.21 | 591 pieces; 69 MiB |
| Full minus Lotus | 169 | 936.30 | 591 pieces; 69 MiB |
| Full minus LandmarkAnimation | 193 | 937.69 | 591 pieces; 69 MiB |

Matrix A–D is additive; E/F isolate on Land; G/H include Water; I includes static map + landmark animation. Full excludes optional DEV environment. Waterfall uses legacy map artwork in the timed probe; V2 is not timed. Hiding a subsystem is not equivalent to proving its textures unload. GardenScene retains a base-image hook outside the conditional drawing branches.

## Measured flower and waterfall CPU

Latest desktop Node flower results: cold 30-parent generation **466.11ms**, cache hit **0.085ms**, six preview mutations **163.42–178.81ms**. Mocked draw descriptor p50 **0.368ms**, p95 **0.645ms**. Flower descriptors: 591 Images, 592 Groups, 660 child function expansions (591 botanical pieces + 69 asset loaders); 69 unique 512×512 images, 69 MiB RGBA. These counts exclude outer production provider/depth-pass wrappers. Static arrays are memoized; no actual per-frame rerender rate was observed.

Actual WaterfallEntity under virtual hook/timer execution: animated case **909 callbacks / 909 state changes / 910 function calls** in 30 virtual seconds; frozen case **0 callbacks / 0 updates / 1 function call**. Both request **41 unique images** and emit **9 Image / 2 Group** host descriptors. Summed function CPU was approximately **34.94ms animated versus 0.35ms frozen** in the first run; timing varies. This excludes React scheduling/reconciliation and GPU rendering, so it does not establish a HIGH CPU bottleneck. Source confirms the timer is local to the memoized waterfall, not direct GardenScene state.

## React rerender table

| Component | Automated evidence | Actual 30-second rerenders / cause |
|---|---|---|
| WaterfallEntity | Virtual 33ms local state loop above | Unavailable; live batching/stalls not simulated |
| ProductionGrowthLayer / botanical pieces | Actual function descriptor expansion; memoized arrays | Unavailable; no water-driven generation dependency found |
| ProductionPlantedFlowers | Existing semantic memo + JS timing instrumentation | Unavailable; Plant/Adjust context invalidates semantic data |
| GardenScene | Existing DEV counter and Profiler scopes | Unavailable |
| GardenWaterField / SurfaceRippleLayer | Derived/shared values rather than frame React state | Unavailable |
| Fish / Lotus | Frame callback / shared-value animation | Unavailable |
| Treehouse / Swing / Moon Bed / Tea Set | Shared animations; Tea Set static | Unavailable; grouped Landmark/Tea Set Profiler scopes remain available |
| WorldTimeProvider | 60,000ms refresh interval | Unavailable; context update can cascade once per refresh |

No live conclusion that water rerenders the entire React tree is justified. Web Skia picture replay may happen without React flower regeneration; installed web renderer draws the current whole picture when dirtied. Replay rate remains unmeasured. Per-land raster caching is technically possible, but exact botanical bounds, zoom quality, Tea Set depth passes, invalidation and disposal must be preserved. No caching added.

## Animation-loop inventory

Generated JSON contains exact call-site file/line/code for category closures, including inactive alternatives. Imported functions are not treated as active loop counts. This summary separates mechanisms from measured callback activity.

| Component / source | Mechanism / frequency | React / Canvas implications |
|---|---|---|
| WaterfallEntity.tsx | setInterval 33ms; sampled layers 3.5–13fps, irregular splash | Local React setState; picture changes |
| water/WaterTopAssembly.tsx useWaterTopFlow | Reanimated useFrameCallback; refresh-driven while active | Shared clock; shaders/transforms dirty picture, not React state per frame |
| water/GardenWaterField.tsx | Shared flow seconds + derived shader uniforms | Procedural base shader per redraw |
| water/SurfaceRippleLayer.tsx | withRepeat/withTiming four-frame opacity blend | Shared alpha-mask uniforms; image frames loaded statically |
| water/WaterTopSource.tsx | Shared flow-derived source shader | Static PNG input, animated shader output |
| water/WaterfallImpactUnderlay.tsx | Source shader/derived values | Inspect live redraw cost separately; no measured GPU duration |
| water/WaterfallContactFoam.tsx / WaterfallImpactFoamLayer.tsx | Repeated shared-value cycles | Alternative V2 foam branches; not necessarily mounted in legacy scene |
| water/FishLayer.tsx | One master useFrameCallback, refresh-driven | Shared movement/wake; hidden enabled=false can leave callback active |
| water/LotusLayer.tsx | Repeated shared sway phase | Shared transforms; small texture inventory |
| TreehouseEntity.tsx | withDelay + repeated timing | Shared sway/glow |
| SwingEntity.tsx | Repeated shared phase/envelope; one 1250ms settle timeout | Mostly shared transforms; timeout is not a continuous frame loop |
| MoonBedEntity.tsx | Delayed repeated shared timing | Shared lighting |
| TeaSetEntity.tsx / static landmarks | Static drawing | No frame timer found |
| world-time/WorldTimeProvider.tsx | setInterval 60,000ms + foreground refresh | React context update, not 60fps |
| performance/GardenRuntimePanel.tsx | RAF during recording; 1s display timer; 30s stop | Explicit DEV measurement overhead; no per-frame React state update |

Water base, ripples, top/source, waterfall, foam, fish and lotus have separate source entries. The quick NO WATER button disables the existing Water group (base/ripples/top/source) while NO WATERFALL independently disables waterfall; additional granular controls remain available for GPU diagnosis. Pixel shader cost and cross-layer compositing cannot be timed by Node.

## Texture inventory

Counts below are literal PNG references in each category closure; duplicates across categories are unioned for the total. Each source image dimension and SHA is in `isolation-static-matrix.json`. Flower requests are actual descriptor requests under decoded-image mocks.

| Category | Reference PNG count | Reference RGBA MiB |
|---|---:|---:|
| Land | 7 | 41.99 |
| Infrastructure | 27 | 362.75 |
| Landmarks | 27 | 161.99 |
| Water | 27 | 145.48 |
| Waterfall | 82 | 307.60 |
| Fish | 13 | 0.48 |
| Lotus | 24 | 1.39 |
| Mature flowers | 69 requested images | 69.00 |

Full category union plus flowers: **1006.69 MiB reference bound**. Actual simultaneous resident memory is **unknown**. This is not a sum of actively decoded hooks; unused full-resolution waterfall frames inflate it. Selected map waterfall is 41×600×656 = 61.56 MiB; actual infrastructure 14 full-world image hooks are about 230.71 MiB. Land references total 41.99 MiB; flower requests are 512×512. Source texture byte size does not predict GPU allocations.

No byte-identical duplicates found in the full reachable PNG inventory. Similar artwork/alternate resolutions and multiple runtime decode instances are not ruled out. Full-world transparent infrastructure PNGs, offscreen landmarks and eager waterfall sequences are loaded without viewport culling in the relevant hooks. Freezing waterfall still requests all frames. No assets resized, removed or recropped.

## Evidence ranking and optimization order

* **HIGH / CONFIRMED CPU:** mature semantic Adjust rebuild, 163–179ms. Trace real drag frequency, then investigate exact-output incremental invalidation. Cold generation is also expensive; separate it from steady idle.
* **LOW / CONFIRMED proxy CPU:** unchanged cached generation and mocked descriptor preparation. This says nothing about raster cost.
* **STRONGLY INDICATED activity, severity UNCONFIRMED:** waterfall local React update loop and eager frame loading; full-picture replay on animated web scenes. Virtual waterfall function CPU alone is not a high bottleneck.
* **UNCONFIRMED impact:** water shader/masking, infrastructure overdraw/memory, static flower raster replay, fish/lotus and landmark animation. Do not classify these HIGH solely from image sizes.
* **LOW expected continuous frequency, UNCONFIRMED runtime impact:** world-time refresh.
* No measured CRITICAL or NOT SIGNIFICANT live subsystem classification is defensible.

Next order: matched native/live full/subtractive frame trace → separate water/Canvas replay from React CPU → trace Adjust → consider exact-output static raster/picture caching only if measured → investigate eager/offscreen image residency. No adaptive degradation or visual compromise yet.

## One-panel manual verification

Actual Garden → **Runtime Audit** (bottom right). Large buttons: FULL, NO FLOWERS, NO WATER, NO WATERFALL, NO FISH/LOTUS, NO LANDMARK ANIMATION, STATIC MAP ONLY. All use the same readonly 30-parent fixture and preserve current camera. Callback current/recent-average/p95 appears during recording and is explicitly labeled **not presented FPS**. Config label is included in JSON. Data stays local; no persisted fixtures.

Open June once, close calibration controls, warm assets, select FULL, Record 30 seconds idle. Repeat the six other buttons at the same camera. Then compare FULL versus the largest observed delta while repeating one pan/zoom path. Native UI callback metrics are available in the report; capture native render/GPU traces to distinguish scheduling from presented hitches. Use Real records and Cancel for Adjust/detail QA. Existing flags mean a normal release build does not match approved DEV Growth/infrastructure; do not compare mismatched scenes. See the previous audit for native Expo/Instruments setup.

## Files changed in this follow-up

* `mobile/src/components/garden/performance/GardenRuntimePanel.tsx` — quick presets, config label, bounded recent callback display once/second, larger touch targets.
* `mobile/scripts/auditGardenIsolation.py` — new static matrix, deduplicated category inventory and animation call-site output.
* `mobile/scripts/profileWaterfallTimer.mjs` — new actual-component virtual timer probe.
* `mobile/test/gardenIsolation.test.mjs` — new probe/panel/measurement-honesty regression.
* `docs/flower-visuals/GARDEN_RUNTIME_AUDIT_HASHES.json` — exact panel instrumentation hash only; approved checkpoint archives unchanged.
* `docs/flower-visuals/GARDEN_AUTOMATED_ISOLATION_AUDIT.md` — this report.
* Ignored output: `isolation-static-matrix.json`, `waterfall-virtual-timer.json`, refreshed `flower-render-proxy.json` under `output/garden-runtime-performance/`.

## Validation

TypeScript and isolation/runtime-audit/default-draw-parity/checkpoint-protection/production-collision/Tea-Set-occlusion tests passed. Approved mature count/artwork/density and all saved-data/collision semantics remain unchanged. Stop for the remaining live device/GPU attribution.
