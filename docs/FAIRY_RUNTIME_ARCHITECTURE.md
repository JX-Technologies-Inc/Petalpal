# Fairy runtime scaffold

Current visual authority is **`Resources/Icon/fairy structure.png`**, using the approved 2D-first pipeline in [the production plan](../Resources/fairy/production/README.md). Primary runtime review is 96–120px body height. Blender V1/V2 are deprecated visual sources. This documentation update does not change FairyLayer or the app placeholder.

The existing scaffold still displays the **historical placeholder `Resources/icon/fairy.png`**: 1448×1086, 2,395,913 bytes. SHA-256: `0b9a6e4b8118d5e959199d0b2bdb1496b2d93aecd53050a2abe42fa20334a01a`.

It is a complete character design sheet with background, annotations and multiple views, **not an animation sprite**. It has not been modified, cropped, resized, recolored, renamed or regenerated. The runtime file `mobile/assets/garden/fairy/reference/fairy.png` is a byte-identical copy. Copying keeps Metro imports inside the mobile project without changing bundler configuration or the source file. The complete sheet is displayed as a temporary placeholder; facing/state requests never extract, mirror or transform individual poses.

## Isolated DEV route

Open **`/fairy-test`** using the existing DEV Expo runtime (web address suffix or native development deep link). It uses its own Skia Canvas and imports no GardenScene, planting, flower, water, landmark, Journal or backend code. The existing application layout remains unchanged. The route redirects home outside `__DEV__`.

The screen displays the full reference, asset load/hidden/error status, x/y world position, scale, facing, animation request and visibility. Controls move the reference pivot, change presentation scale, request each state/view, hide/show and reset. There is no movement playback, pose swapping, synthetic motion, persistence or per-frame React state update. At initial scale the entire sheet is visible. Scale controls change display size only; no source pixels are rewritten. The pivot is provisionally the bottom-center of the **sheet**, not a calibrated Fairy foot position.

The test coordinate space is 640×480, uniformly fitted into the preview viewport. The stage's world bounds drive culling; moving the character fully out of view or hiding it renders no character node and does not request an image. Real Garden bounds/occlusion are not consulted.

## Reusable API and asset contract

`FairyLayer` supports `x`, `y`, `scale`, `facing`, `animationState`, `visible`, optional assets/viewport, frame index and load-status callback. Its public props and renderer are unchanged by the playback extension. Animation requests are `idle`, `walk`, `run`, `jump`, `interact`, `sit`, `lie`, `swing`, `write`. Facing now additionally accepts `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`. Existing `front`, `back`, `left`, `right` remain supported, mapping to `S`, `N`, `W`, `E` asset folders respectively. An explicitly registered legacy facing takes precedence over the compass alias. This is an asset lookup convention, not a mirrored/recolored reference or a production movement change. No clip is registered today.

Pure frame resolution is separate from drawing. A registry can provide either:

* A sequence: bundled sources plus frame canvas dimensions, normalized ground pivot, FPS and loop/one-shot metadata.
* An atlas: one bundled page plus source rectangles and per-frame pivots, FPS and loop metadata. One sprite is drawn with Skia Atlas, reusing the page image.

Missing state/view or an empty sequence falls back to the full historical placeholder. Authored one-shot frame lookup clamps to the last frame; loops wrap. No runtime playback clock has been implemented. Geometry lookup/culling is independent of renderer and semantic character state.

Future structure may be `mobile/assets/garden/fairy/{idle,walk,run,jump,interact,sit,lie,swing,write}/`, with explicit static `require` entries in the registry, or state/direction atlas pages. Do not discover filenames dynamically at runtime: Metro needs bundled asset references. The Garden will consume a stable FairyLayer interface; replacing reference/sequence/atlas internals will not require rewriting GardenScene. The currently numbered `frameIndex` is for deterministic frame selection/testing, **not** a recommendation to update React state every playback frame.

## Playback metadata and DEV controls

`fairyPlayback.ts` exports the requested future descriptor:

```ts
type FairyAnimationClip = {
  name: FairyAnimationState;
  direction: FairyFacing;
  frameCount: number;
  fps: number;
  loop: boolean;
  frameWidth?: number;
  frameHeight?: number;
};
```

The descriptor is metadata, not image data. `fairyClipDescriptor` derives it from a nonempty registered sequence/atlas. Empty/missing clips or invalid timing/dimensions produce no clip; uniform atlas dimensions can be reported, while variable dimensions remain optional. The registry is still empty. No test fixtures have been added as runtime assets.

The DEV playback panel shows animation request, facing, frame index, FPS, playback status and asset source type. It prominently displays **NO PRODUCTION CLIP LOADED** with the reference at index 0, FPS unavailable and `no-clip` status. Play/Pause/Previous Frame/Next Frame controls are present but disabled until authored assets are registered; they cannot pretend to play the reference. Changing state/direction resets the binding; hiding pauses the request; Reset restores idle/front and frame 0.

Pure, immutable transitions support play/pause/resume, bounded manual stepping, loop wrapping, one-shot completion/restart and rebinding. `advanceFairy(state, deltaMs)` is worklet-ready and contains no timer subscription. **No animation timer, RAF or frame callback has been added, even conditionally.** With no real assets there is no reason to run a clock. If real assets are registered later, manual stepping resolves real frames; Play currently records the semantic request only, and the panel explicitly states that automatic shared-value clock wiring is pending.

For future actual playback, keep elapsed time/frame index in shared runtime values, call pure progression from an active/visible/background-aware worklet, and derive atlas rectangles or cached sequence-image selection inside the Fairy renderer. Do not call React `setState` with every frame. Debug values should be sampled at a low rate or on user actions; no debug sampling timer is needed today. Existing numbered `FairyLayer.frameIndex` remains the deterministic manual-selection API. The future internal shared-value renderer can be added behind those same public props, without changing GardenScene. Asset loading/cache readiness must gate clock startup, not metadata alone.

## Expected export folders (not created yet)

Sequence convention, relative to `mobile/`:

```text
assets/garden/fairy/
  idle/
    N/
    NE/
    E/
    SE/
    S/
    SW/
    W/
    NW/
```

Each direction may contain authored `0000.png`, `0001.png`, … and `clip.json` with descriptor/pivot metadata. Repeat for the other eight animation states. A build-time manifest supplies static bundled references; there is no runtime directory scan.

Equivalent atlas convention:

```text
assets/garden/fairy/atlases/
  idle/
    N.png       N.json
    NE.png      NE.json
    E.png       E.json
    SE.png      SE.json
    S.png       S.json
    SW.png      SW.json
    W.png       W.json
    NW.png      NW.json
```

Each JSON supplies the descriptor and ordered frame rectangles/pivots on its page. Additional pages require explicit page references and a bounded loader policy before use; the current atlas binding scaffolds a single page per clip/view. These names describe the future Blender pipeline, not generated or promised animation files.

## Blender pipeline and eventual integration

1. Model and animate externally against the approved reference. Export actual transparent pseudo-3D character renders, consistent orthographic camera/lighting, world scale and ground pivot. Supply frame dimensions, alpha convention, clip duration/FPS, loop/one-shot semantics and authored facing per clip. Do not use the reference sheet itself as sprite frames.
2. Prefer a small set of atlas pages packed offline with adequate transparent gutters. Keep a bounded decoded-page cache and reuse the same page for adjacent frames. For sequences, cache only the active clip/nearby frames within a measured memory budget; avoid eager loading every state/direction.
3. Advance frame index/atlas rectangle using an internal Skia/Reanimated shared-value clock. React should change for semantic transitions and load/readiness, not every animation tick. Keep one active Image/Atlas sprite node rather than mounting all frames or hundreds of independent image nodes. Profile native frame pacing before introducing real playback.
4. Stop the clock when hidden, offscreen, backgrounded or appropriately paused for reduced motion. Determine visibility from complete sprite bounds including wings and animation envelope; do not cull solely by the pivot. Resume with an explicit clip-time policy, especially one-shot interactions. The current static scaffold implements visibility/culling but has no animation clock to pause.
5. Integrate eventually in an existing dynamic Garden plane. Use world/ground-pivot placement and appropriate Y-depth/landmark occlusion. Do not add another full-screen Canvas by default, include Fairy animation in static flower-picture invalidation, or introduce child planting identities. Garden integration is deliberately absent in this task.
6. Device quality tiers are a future measured design decision, not implemented here. If needed, author approved alternate atlas resolutions/clip frame rates offline and select a bounded profile once, without arbitrary runtime recoloring or repeated asset switching. Keep character identity and motion timing consistent. Review any visual tradeoff before enabling it.

## Performance observations and limits

The reference alone is approximately **6.00 MiB decoded RGBA** (`1448×1086×4`), despite a roughly 2.4 MB PNG. It is acceptable for isolated reference review but unsuitable as a character animation atlas. Never decode one full sheet per pose. Current drawing uses one character Image node and zero playback timers; the test stage also has a background and a pivot marker.

A future 2048×2048 RGBA atlas costs about 16 MiB before backend overhead; multiple states/views/resolutions can multiply that cost. Texture reuse, bounded frame/page caching and explicit disposal must be measured with actual exported assets. Web/native uploads and live FPS have not been measured here. The DEV route is runtime-gated; that does not guarantee an app's build/export pipeline excludes the reference bytes from release packaging. Review DEV-only asset packaging before shipping. No build settings were changed for this scaffold.

## Files added

* `Resources/icon/fairy.png` — found existing, **unchanged**.
* `mobile/assets/garden/fairy/reference/fairy.png` — new exact runtime copy.
* `mobile/src/app/fairy-test.tsx` — DEV route and splash readiness.
* `mobile/src/components/fairy/fairyRuntime.ts` — semantic API, sequence/atlas contracts, pure resolution and culling.
* `mobile/src/components/fairy/fairyAssets.ts` — explicit reference registration, empty animation registry.
* `mobile/src/components/fairy/FairyLayer.tsx` — reusable single-image/sprite renderer and load status.
* `mobile/src/components/fairy/FairyTestScene.tsx` — isolated controls and runtime display.
* `mobile/test/fairyRuntime.test.mjs` — source integrity, fallback states, sequence/atlas contracts, pivots, culling and DEV isolation.
* `docs/FAIRY_RUNTIME_ARCHITECTURE.md` — this note.

No existing source/configuration files were changed. Ignored web-export/verification output is local only.

## Validation and manual check

TypeScript and Fairy runtime tests pass, including exact source/runtime bytes, all nine reference fallback states, authored sequence/atlas lookup, one-shot/loop indexing, pivot geometry, hidden/offscreen no image request, a single visible character node and DEV route gating. Existing Garden checkpoint-protection and static-rendering regressions also pass. DEV web export succeeds; export is not live visual/device QA.

Open `/fairy-test`, confirm the whole reference sheet is visible, cycle all facing/state buttons (art stays unchanged), move/scale/hide/reset and verify metadata/load status. Move entirely out of view to check culling, then back into view. Repeat on the existing native development client. No Garden integration or additional animation is part of this checkpoint; stop after this scaffold for review.

## Playback-extension changes and validation

Changed files in the playback extension:

* `mobile/src/components/fairy/fairyRuntime.ts` — additive compass directions, compatible aliases and shared clip lookup.
* `mobile/src/components/fairy/fairyPlayback.ts` — new descriptor validation/derivation and pure worklet-ready transitions.
* `mobile/src/components/fairy/FairyPlaybackPanel.tsx` — new DEV metadata/status panel and guarded controls.
* `mobile/src/components/fairy/FairyTestScene.tsx` — binding/reset/control state and existing frame-index prop wiring.
* `mobile/test/fairyPlayback.test.mjs` — new metadata/state-transition tests only; no images or rendered frames generated.
* `docs/FAIRY_RUNTIME_ARCHITECTURE.md` — this updated convention/playback note.

TypeScript, new playback metadata/state tests, existing Fairy runtime tests and DEV web export pass. The source/reference-copy byte-integrity check still passes. `FairyLayer.tsx`, the route file and production GardenScene remain unchanged. Local web-export output under `output/fairy-test/playback-web-bundle/` is ignored. Stop at the scaffold; actual visual animation/per-frame performance cannot be reviewed until real clips are provided.
