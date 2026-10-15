# Garden static/dynamic rendering — manual review candidate

The desktop isolation review found FULL very laggy, partial improvements from NO FLOWERS and NO WATER, little improvement from the other individual removals, and smooth STATIC MAP ONLY. This change addresses cumulative redraw architecture without reducing visual quality. No new visual approval or measured FPS improvement is claimed.

## Previous and current architecture

Previously one camera-transformed Skia Canvas contained every static image, all 591 botanical pieces, shaders, fish, waterfall and animated landmarks. React memoization preserved generation/element preparation, but a shared-value animation could dirty the picture for that whole surface. Adjust preview also regenerated the mature bed on each changed pointer position.

The current architecture uses **four ordered, transparent, retained Skia Canvas surfaces** under one GestureDetector and one layout view. Each receives the same camera shared value and existing planting context. Drawing order is unchanged:

| Plane | Content | Invalidated by |
|---|---|---|
| Water motion | Solid fallback, base water shader, fish, ripples, impact underlay, lotus, V2 waterfall | Its own motion/visibility/configuration; camera |
| Terrain | Land and shore contact, planting overlay, environment, Land09 interface, connections, infrastructure or bridge, reference overlay | Asset readiness, placement/calibration/overlay/visibility changes; camera |
| Landmark motion | Legacy waterfall and upper water/source/foam; Treehouse, Swing, Moon Bed | Its own motion/lighting/visibility/configuration; camera |
| Botanical foreground | Garden Arch, Pavilion, Land06 flowers, Tea Set, landmark diagnostics, road approaches, remaining flowers and placement/debug overlays | Flower semantic state, asset readiness, static landmark placement/visibility, previews/overlays; camera |

Animation values from water and moving landmarks are absent from terrain and botanical surface graphs. They cannot dirty those graphs directly. Pan/zoom intentionally redraws all surfaces at full original resolution. A React semantic/context update can still reconcile multiple surfaces; there is no promise that React never renders again.

The smallest safe split preserves interleaved occlusion. Legacy upper water and moving landmarks still share a plane; static body pieces inside Treehouse/Swing/Moon Bed remain with their moving parts. Finer separation would add surfaces and potentially disturb their internal ordering. This change does not claim that every dynamic subsystem is isolated from every other dynamic subsystem.

## Layer classification

* **Static:** land image/alpha-shore shader, environment, roads, stairs, bridges, infrastructure, Garden Arch, Pavilion, Tea Set. The shore shader uses the existing image alpha without a time uniform. These are retained in non-animated planes; selected-land/reference/calibration graphics are event-driven exceptions.
* **Event-driven:** Growth V1.1 pieces and their depth ownership, real planting previews, footprint/debug overlays, static landmark/calibration placements and world-time lighting decisions. Parent records and growth stages remain authoritative.
* **Continuous:** base water uniforms, surface ripple blending/masking, source water, waterfall frame playback and foam, fish/wakes, lotus sway, Treehouse foliage/light breathing, Swing/ribbon/light motion, Moon Bed motion. Mixed landmark entities retain their exact existing internal static/moving stack.

Static world caching here is the retained **independent surface**, not a world-sized raster atlas. Between camera/events its previous presented pixels remain; unrelated animation does not request its redraw. This avoids downsampling, enlarged texture atlases and mask clipping. Renderer/OS buffer residency and actual presentation behavior still require native verification.

## Flower picture cache

After the existing unique asset loaders have decoded the required images, ProductionGrowthLayer records the **same BotanicalPiece JSX** through Skia's `drawAsPicture`. It then replaces the hundreds of retained image/group nodes with one `<Picture>` for that month/depth slot. The picture retains decoded-image references and draw commands; it does not duplicate 69 PNGs or create a 69 MiB flower raster texture.

The exact original fallback nodes remain visible while images load or recording fails. Picture bounds include every rotated full image rectangle plus a small recording margin, including negative coordinates and artwork beyond the Final Mask. Bounds are not soil validity or a mask clip. Recorded image sampling, anchors, transforms, order and neutral artwork come from the same drawing code.

Invalidation is based on immutable growth and decoded-image readiness. Plant/add, confirmed move, removal, month/stage/configuration changes produce changed growth; recording rebuilds accordingly. Repeated water/landmark animation and irrelevant rerenders do not rerecord a ready field. Stale asynchronous recordings are discarded and disposed; replaced/unmounted pictures release owned resources. A translucent unconfirmed Plant preview deliberately uses the original image nodes (`cache=false`), preserving per-image opacity inheritance because Picture replay does not inherit paint in the same way.

See the primary [Skia Picture documentation](https://shopify.github.io/react-native-skia/docs/shapes/pictures/) and [Canvas documentation](https://shopify.github.io/react-native-skia/docs/canvas/overview/). A Picture itself is a command recording, not a raster cache: on pan/zoom it still draws the 591 commands. The independent static surface prevents unrelated continuous animation from replaying that bed.

## Parent identity and Adjust

There are still 30 real parent records and no independent child identities. Hit testing continues through the unchanged real-parent/primary-alpha resolver. Detail, Journal, Support, validation, persisted coordinates and backend operations are unchanged. Canvas planes have `pointerEvents="none"`; the common GestureDetector/view keeps the existing gesture and coordinate conversion path.

During Adjust dragging the committed bed/picture stays in place and only the existing validated parent preview rings move. It is intentionally a lightweight location preview, not a continuously regenerated final bed. No growth generation occurs for pointer changes. Confirm updates the authoritative placements through the existing provider, triggering the original deterministic rebuild once; Cancel immediately retains the original field. The old preview helper remains available for regression comparisons, but the production drawing path no longer calls it. No temporary rendering metadata is persisted.

## Animation state and waterfall

No animation artwork, rate, shader, sequence, clock or motion curve was changed. Waterfall's existing local React-state timer remains confined to its motion surface; it cannot invalidate terrain/flowers through the Skia surface graph. Frozen/reduced-motion/background waterfall already stops its interval. Its frame inventory remains unchanged. Viewport-based offscreen waterfall culling was not added: a correct camera/bounds visibility policy remains a separate follow-up, rather than risking disappearance or playback changes here.

World-time still updates at the existing interval. Parent context semantics remain unchanged. The additional static-front LandmarkLayer instance keeps its water-flow frame callback inactive.

## Before/after measurements and memory

Desktop Node actual generator/drawing-function proxy, with memoized hook mocks; **not React/GPU/FPS measurements**:

| Metric | Before | After |
|---|---:|---:|
| Six changed mature Adjust previews | 156.30–167.53ms full generation each | 0.049–0.131ms drawing preparation each |
| Cancel drawing preparation | Full field previously depended on preview state | 0.004ms; committed field reused |
| Mature composition | 591 pieces | 591 pieces, unchanged |
| Ready retained botanical image nodes | 591 Image + 592 Group descriptors | One Picture per month/depth slot; same 591 draw commands recorded |
| Water graph contains flower nodes | Yes, shared Canvas | No |
| Canvas surfaces | 1 | 4 |
| New flower raster textures | 0 | 0 |

Cold full generation in this probe remains approximately 486ms. Confirm is still an expensive semantic rebuild (regression runs around 163–166ms for the representative move); this work is deferred until Confirm, not eliminated. No before/after FPS, GPU time, presented hitches or native memory trace was available. These numbers do not predict mobile speed.

At a 390×844 logical viewport, one RGBA buffer is about 1.26 MiB at DPR 1, 5.02 MiB at DPR 2, and 11.30 MiB at DPR 3. **Three additional surfaces** add about **3.77 / 15.07 / 33.90 MiB** respectively for one color buffer each. Actual allocations can be higher due to swap/back buffers, attachments, browser WebGL contexts and driver behavior. No world-sized offscreen bitmap is allocated; picture command-list memory is additional but not measured. Existing flower decoded-image estimate remains about 69 MiB, with image references reused. Web uses multiple CanvasKit surfaces/contexts; native uses independent Skia views and the native compositor. Both need device memory/presentation QA, particularly DPR 3 iPhones.

## Files changed in this task

* `mobile/src/components/garden/GardenScene.tsx` — four ordered surfaces, same camera/context/gesture inputs.
* `mobile/src/components/garden/LandmarkLayer.tsx` — motion/static-front passes; all-pass default remains compatible.
* `mobile/src/components/garden/rendering/GardenCanvasPlane.tsx` — new native/web retained surface wrapper with a plain valid style object.
* `mobile/src/components/garden/planting/ProductionGrowthLayer.tsx` — bounded command picture recording, exact fallback, lifecycle disposal.
* `mobile/src/components/garden/planting/ProductionPlantedFlowers.tsx` — committed-bed Adjust preview; translucent Plant preview stays uncached.
* `mobile/scripts/profileGardenArchitecture.mjs` — reproducible CPU and buffer-estimate comparison.
* `mobile/test/gardenStaticRendering.test.mjs` — new draw-command/cache/lifetime/surface tests.
* `mobile/test/gardenAdjustPreview.test.mjs` — new 60-pointer/Cancel/Confirm test.
* `mobile/test/gardenRuntimeDrawParity.test.mjs` — exact reconstruction from split landmark passes.
* `mobile/test/productionGrowthRendering.test.mjs` — lightweight Adjust and exact translucent Plant expectations.
* `docs/flower-visuals/GARDEN_RUNTIME_AUDIT_HASHES.json` — updated explicit tested source exceptions; approved checkpoint manifests/archives unchanged.
* `docs/flower-visuals/GARDEN_STATIC_DYNAMIC_ARCHITECTURE.md` — this report.

Ignored outputs: `output/garden-runtime-performance/static-dynamic-architecture.json`, `architecture-test-results.json`, `architecture-web-bundle/`; existing performance regression outputs refreshed by their tests. No files/assets were deleted, and no commit/push was performed.

## Validation

TypeScript passed. DEV web export succeeded: 2314 modules, 411 assets. Nineteen relevant suites passed: static rendering, Adjust preview, runtime draw parity, runtime audit, isolation, production rendering/render cache/protection/growth/spatial/flow/performance, collision S/M/L, planting system, mask refinement, Tea Set occlusion, flower detail/Journal/Support, visual system and layered bed.

Tests verify exact original picture image commands/transforms, one ready Picture, no rerecord over 100 unrelated rerenders, stale/unmount disposal, complete out-of-mask recording bounds, motion+static landmark sequence equivalence, 60 drag events with zero generation calls, unchanged Cancel and one exact Confirm rebuild. Frozen production output still has **30 parents / 591 pieces / 74.8153% coverage / zero outside child origins**, production S/M/L **9/12/16**, all masks and saved-data semantics unchanged. Both approved checkpoint archive verifiers passed (863 Growth files; 882 collision files).

Automated command parity is not a screenshot/native visual approval. Cross-surface compositing, antialias edges, camera synchronization and gesture delivery remain explicit manual checks.

## Manual performance review — same seven buttons

1. Open the actual Garden at the same June mature camera/viewport. Close calibration controls, warm assets, and use Runtime Audit → FULL (readonly 30 parents). Check the complete bed, Tea Set foreground, water, waterfalls, landmark overlap, edges and colors match the approved scene.
2. Record 30 seconds idle, then repeat the same pan/zoom path. Compare with the previous lag and STATIC MAP ONLY. FULL should move materially closer to STATIC MAP ONLY. Use NO FLOWERS, NO WATER, NO WATERFALL, NO FISH/LOTUS and NO LANDMARK ANIMATION as before; no extra configuration is required. Callback cadence remains a scheduling proxy, not presented FPS.
3. Restore Real records. Tap primary blooms, open/close Detail and confirm Journal/Support still belong to the parent. Start Adjust, drag valid/invalid positions, verify rings respond and collision feedback is unchanged, then Cancel: original bed remains. For an intended test move, Confirm and verify exactly one final deterministic field, no old orphan growth, correct saved anchor and reload. Test new Plant preview opacity and Confirm separately.
4. Pan/zoom across land and Tea Set edges; resize the desktop viewport and background/foreground the app. Check planes stay aligned, no transient gaps/black background or missing pictures, and animations resume with the previous behavior.
5. Repeat FULL/STATIC MAP ONLY on the existing compatible iPhone/native development client. Capture native presented-frame and GPU/memory traces where available; inspect DPR 3 buffer pressure and long Confirm pauses. Existing DEV-versus-release scene flags still differ, so compare matched scene content.

Stop for manual performance/visual review. No density reduction, adaptive quality tiers, new emotion effects or backend integration.
