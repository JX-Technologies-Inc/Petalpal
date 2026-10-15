# Garden runtime performance audit — 2026-09-30

Status: instrumentation and CPU/resource audit complete; live frame attribution pending. No runtime optimization or visual change was implemented. Both approved production checkpoints remain untouched.

## Measurement limits

The computer-use browser service failed to initialize twice (trusted-process exit and sandbox helper error). No live Garden, browser trace, screenshot automation, or native device session was available. Consequently actual presented FPS, UI/GPU cost, Skia redraw frequency, image uploads and React rerender frequency have **not been measured**. This audit does not establish the dominant cause of idle lag or claim a before/after speedup.

The DEV Runtime Audit panel instruments the actual GardenScene, with bounded component-call, React commit, named JS work, JS callback interval, native UI callback interval and supported browser long-task samples. Callback FPS is not presented FPS. Nested Profiler timings overlap and must not be summed. GPU/redraw/decode/upload metrics are explicitly unavailable. Recording itself adds overhead; compare recording on/off. Collection is disabled by default and in release; isolation flags preserve existing defaults.

| Actual scene | Live idle/pan/zoom frame metrics |
|---|---|
| A Empty | Not measured |
| B Landmarks/environment | Not measured |
| C Water | Not measured |
| D Waterfall | Not measured |
| E Fish/lotus | Not measured |
| F 1 parent | Not measured |
| G 10 parents | Not measured |
| H 20 parents | Not measured |
| I Mature 30 parents | Not measured |

Tap, detail open/close and Adjust live-frame measurements also remain pending.

## CPU measurements

The reproducible Node proxy executes the actual production generator and drawing component with mocked hooks/decoded images. Descriptor expansion is **not** React reconciliation, Skia rasterization, decoding or GPU work. Desktop timings do not predict iPhone timings.

| Parents | Pieces / Image nodes | Group nodes | Unique images | Generation ms | Cache hit ms | Descriptor p50 / p95 ms | Estimated unique RGBA MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0.083 | 0.002 | 0 / 0 | 0 |
| 1 | 4 | 5 | 3 | 7.25 | 0.030 | 0.010 / 0.061 | 3 |
| 10 | 113 | 114 | 42 | 42.00 | 0.072 | 0.091 / 0.288 | 42 |
| 20 | 333 | 334 | 61 | 79.99 | 0.085 | 0.212 / 0.324 | 61 |
| 30 | 591 | 592 | 69 | 477.21 | 0.088 | 0.366 / 0.790 | 69 |

Six successive mature-field preview mutations took 162.08–182.66ms each. An unchanged 100-lookup mean was 0.140ms. The mature mock expansion invokes 591 piece components and 69 asset loaders (660 child function calls). These are descriptor counts, not measured per-frame component calls. Generation caching works; Adjust semantic rebuilds remain expensive.

## Ranked findings and next steps

Impact labels below distinguish measured CPU impact from investigation priority. Runtime FPS attribution is pending for every rendering subsystem.

| Subsystem | Impact / evidence | Recommended next step | Visual risk |
|---|---|---|---|
| Adjust generation | **HIGH, measured CPU:** 162–183ms per mature preview mutation | Trace actual drag frequency, then incremental/exact-output cache invalidation | Medium; composition and Cancel must match |
| Initial generation | **HIGH, measured CPU:** about 477ms cold; about 0.09ms hit | Trace cold loading separately from idle; preserve existing cache | Low for measurement |
| Shared Canvas / water / infrastructure | **HIGH investigation priority:** animated picture replay, shader/masks, many full-world images; GPU cost unmeasured | Compare water, infrastructure and static flowers independently in live trace | Medium/high for future caching |
| Waterfall | **HIGH investigation priority:** legacy JS setInterval(33ms) updates React elapsed state; 41 map frames eagerly loaded | Measure commits and full Canvas replay; evaluate equivalent shared-value animation only after attribution | Medium |
| Static flowers | **MEDIUM/HIGH investigation priority:** 591 Image + 592 Group descriptors; 69 unique images | Measure with flowers off/on and animation frozen/running | Medium/high for raster caching |
| Fish / lotus | **MEDIUM investigation priority:** shared-value/frame animation, not continuous React state; hidden Fish clock can remain active | Use unmount isolation, then trace each independently | Medium |
| Landmark animation | **MEDIUM investigation priority:** primarily shared values; Swing has one settling timeout | Freeze animation independently of visible artwork | Medium |
| World time | **LOW continuous-work priority:** 60-second context timer, foreground/override updates | Correlate occasional commits with timestamps | Low |
| Cached flower JS preparation | **LOW measured CPU:** sub-ms mocked descriptor preparation | Do not treat this as proof of cheap GPU drawing | Low |

GardenScene camera pan/zoom uses shared-value transforms. ProductionGrowthLayer and individual botanical pieces are memoized; generation is not intrinsically repeated on every water frame. Planting context updates can notify consumers on detail/preview changes; actual commit cascade remains unmeasured. Asset completion can trigger loader updates, but batching/decode/upload costs are unknown.

Installed Skia 2.6.2 web SkiaPictureView draws its current picture when redraw requests are pending. Shared-value animation can therefore replay a picture containing static flowers without React regenerating their composition. This is a source finding, **not a measured redraw rate**. React memoization alone does not establish raster savings.

GardenWaterField contains procedural noise/trigonometry, alpha masking and layered ripple images. Its extended 7200×6600 rectangle is screen-clipped; that area is not a measured shaded-pixel count. Water/foam/top-source and ripple costs must be separated using existing DEV controls plus audit isolation. No shader, quality, frame count or animation rate was changed.

## Texture audit

373 literal reachable PNG references total approximately **1172.25 MiB RGBA**. This includes inactive alternatives and DEV imports and is **not actual residency**. It excludes driver padding, mipmaps, duplicate mounted decodes and other formats. Zero byte-identical PNG duplicates were found within this inventory; this does not prove single runtime residency.

* Mature 30-parent flower drawing requests 69 unique 512×512 images: approximately **69 MiB**.
* Infrastructure has 14 actual useImage hooks loading 2400×1800 images: approximately **230.71 MiB**. Its import inventory includes two additional unused references; do not count those as active hooks.
* Selected waterfall map frames: 41×600×656, approximately **61.56 MiB**. Map plus inactive full-resolution alternatives total 307.60 MiB; these are not all currently decoded.
* Connection art: 7.65 MiB; road approaches: 32.96 MiB; Land09 interface: 16.48 MiB; seven land references: 41.99 MiB.
* WaterTopSource painted image: 6 MiB. Water asset module inventory: 85.48 MiB (not all active). Lotus inventory: 1.39 MiB.

Large transparent full-world PNGs warrant memory/overdraw investigation. No image was cropped, resized or replaced. Stable image source IDs feed source-dependent loader effects, so source inspection does not show repeated decoding every animation frame. Repeated mounted copies, remount decoding and texture uploads need live measurement.

## Static-bed caching assessment

Immutable draw arrays and memoization already exist. A recorded SkPicture may reduce recording/reconciliation but still replay hundreds of draw commands. Per-land/per-depth-pass offscreen raster caches could reduce draw work if it is dominant, but require measured memory budgets, disposal, zoom/device-scale quality, transparent bounds, correct depth/Tea Set slots and semantic invalidation on add/move/stage/config changes. Botanical pixels outside the Final Mask must remain visible; never clip the cache to planting validity. Do not implement this before the live bottleneck is identified and exact output/manual parity is verified.

## DEV versus release

No live DEV/release delta was measured. Current `USE_MONTHLY_GARDEN_GROWTH_V1_1 = __DEV__`, and some infrastructure/QA branches are DEV-gated. An ordinary release comparison therefore changes scene content and cannot isolate DEV overhead. This audit preserves those flags. A future release-like profiling build must explicitly match the approved scene before comparing performance. Normal release React Profiler timing also requires profiling support. See [React Profiler](https://react.dev/reference/react/Profiler), [React Native DevTools](https://reactnative.dev/docs/react-native-devtools) and [React Native performance guidance](https://reactnative.dev/docs/performance.html).

## Real-device/manual QA

1. From `mobile`, run `npx expo start --lan`. Use the existing compatible native development client; Expo Go is suitable only if its SDK/native dependencies match this workspace. Record iPhone model, OS, build configuration, refresh rate, power/thermal state, viewport and zoom.
2. Open the actual Garden Runtime Audit panel. Keep the app foreground, warm assets, and close other debug controls. Record 30 seconds, three repeats per condition; compare recording enabled/disabled. Select the correct 60/120Hz budget.
3. Run A–E scene presets, then restore defaults and select 1/10/20/30 readonly parent fixtures. Keep the same viewport. For each, record idle, fixed pan path and fixed zoom path separately. Fixture records are in-memory and cannot invoke Journal/Support/placement interactions.
4. Isolate Infrastructure, Flowers, Water, Waterfall, Fish, Lotus and landmark/water animation one at a time. Use existing water DEV controls to separate procedural field, ripples and foam where applicable. Compare warm steady-state separately from cold remount/decode.
5. Restore **Real records** for tap, detail open/close and Adjust preview. Drag the same real parent path and **Cancel** to preserve saved coordinates. Check no orphan pieces, original field restored, unchanged collision and Tea Set occlusion. Do not confirm a move solely for this audit.
6. Copy selectable JSON locally into ignored `output/garden-runtime-performance/`. There is no upload or automatic persistence. React duration covers commits, not GPU work; JS/UI callback intervals are scheduling proxies, not displayed frame counters.
7. Capture a native React Native DevTools/Hermes trace for JS/React. On a Mac with the iPhone, use Instruments Core Animation/Metal System Trace and memory tooling for presented hitches, render/GPU work and allocations. Compare a matched release-like native scene only after resolving the DEV flag mismatch; do not infer mobile performance from desktop Node results.

See [Skia Canvas documentation](https://shopify.github.io/react-native-skia/docs/canvas/overview/) for the renderer surface. No browser or screenshot automation was performed here.

## Exact files changed

Instrumentation source:

* `mobile/src/components/garden/GardenScene.tsx`
* `mobile/src/components/garden/LandmarkLayer.tsx`
* `mobile/src/components/garden/WaterfallEntity.tsx`
* `mobile/src/components/garden/planting/ProductionGrowthLayer.tsx`
* `mobile/src/components/garden/planting/ProductionPlantedFlowers.tsx`
* `mobile/src/components/garden/water/FishLayer.tsx`
* `mobile/src/components/garden/water/GardenWaterField.tsx`
* `mobile/src/components/garden/water/LotusLayer.tsx`
* `mobile/src/components/garden/water/SurfaceRippleLayer.tsx`
* `mobile/src/components/garden/world-time/WorldTimeProvider.tsx`
* `mobile/src/components/garden/performance/runtimeAudit.ts` (new)
* `mobile/src/components/garden/performance/GardenRuntimePanel.tsx` (new)

Tooling/tests/documentation:

* `mobile/scripts/auditGardenRuntimeTextures.py` (new)
* `mobile/scripts/profileGardenRenderDescriptors.mjs` (new)
* `mobile/test/gardenRuntimeAudit.test.mjs` (new)
* `mobile/test/gardenRuntimeDrawParity.test.mjs` (new)
* `mobile/test/assertFlowerBaseline.mjs`
* `mobile/test/collisionCandidateAudit.test.mjs`
* `mobile/test/flowerOcclusion.test.mjs`
* `mobile/test/productionCollisionSml.test.mjs`
* `mobile/test/productionGrowthProtection.test.mjs`
* `mobile/test/productionGrowthRendering.test.mjs`
* `docs/flower-visuals/GARDEN_RUNTIME_AUDIT_HASHES.json` (new exact instrumentation exceptions; previous checkpoint manifests unchanged)
* `docs/flower-visuals/GARDEN_RUNTIME_PERFORMANCE_AUDIT.md` (this report)

Ignored generated outputs: `output/garden-runtime-performance/{textures.json,pre-instrumentation-source-hashes.json,flower-render-proxy.json,layer-texture-estimates.json,test-results.json,web-bundle-check/}` and refreshed `output/production-growth-performance/equivalence-and-timing.json`. No saved placements were written.

## Validation and preserved output

TypeScript passed. DEV Expo web export bundled successfully (2313 modules, 411 asset files); export is not runtime QA. Twenty relevant suites passed, including audit statistics, exact default landmark draw parity, planting/masks/capacity, production S/M/L collision, real-parent flow/movement/Cancel, generation/performance/cache, rendering/occlusion, Journal/Support details, visual-system and layered-bed regressions. Exact default legacy/V2 active/background landmark host nodes, transforms, artwork, animation props and Tea Set flower slot match the approved snapshot.

Approved Growth archive verification passed (863 files); approved collision archive verification passed (882 files). Mature output remains 591 pieces, 74.8153% coverage, zero outside child origins. All twelve masks, S/M/L collisions, saved coordinates, artwork, neutral emotions, Journal/Support and backend semantics are preserved. No safe optimization was attempted because the dominant live runtime bottleneck remains unknown. There is no before/after FPS result. Stop for manual runtime profiling; no backend integration or emotion work.
