# PetalPal Fairy — current production direction

**Current authority: `Resources/Icon/fairy structure.png`. Design approved; 2D-first painterly sprite pipeline.** Follow [production/README.md](production/README.md) for the immutable master, five canonical views, layer/anchor plan and 96–120px runtime target.

**Blender V1/V2 and the specification below are DEPRECATED historical experiments. They must not guide future character visuals.** The old 64px target, Blender camera, modeling workflow and original `fairy.png` authority are superseded. Existing files remain preserved; no app integration is implied.

# Historical Blender production specification v0.1

Status: **production specification and directories only**. The character reference is approved; no model, rig, animation, rendered sprite, atlas, camera match or production playback is approved or supplied by this task. Numerical camera/scale/export settings below are concrete initial targets. Review a real pose before bulk rendering; once accepted, lock them for all first-scope clips. Do not alter the Garden to accommodate the character.

## Authority and scope

The historical reference was `Resources/icon/fairy.png`, SHA-256 `0b9a6e4b8118d5e959199d0b2bdb1496b2d93aecd53050a2abe42fa20334a01a`. It is a complete design sheet, not a sprite atlas. Never modify, crop, recolor, resize, overwrite or extract animation frames from it. Blender may link it for reference. Preserve the illustrated proportions, purple/lavender dress and hair, translucent wings, flower ornament and delicate silhouette; do not substitute a new character design.

First production scope: **idle, walk, run × N, NE, E, SE, S, SW, W, NW**. All are neutral, in-place loops. Other scaffold state names are reserved and receive no assets yet. No Garden integration or automatic animation-clock implementation is authorized by this specification.

```text
Resources/fairy/
  reference/                 pointer to the unchanged approved source
  blender/                   future model, rig, actions and locked render scene
  renders/
    idle/{N,NE,E,SE,S,SW,W,NW}/
    walk/{N,NE,E,SE,S,SW,W,NW}/
    run/{N,NE,E,SE,S,SW,W,NW}/
  atlases/                   future packed PNG pages and metadata
  review/                    future contact sheets, review notes and decisions
```

Folders are created now, with `.gitkeep` where needed. They contain no fabricated image or Blender file. Runtime delivery remains a separate future step under `mobile/assets/garden/fairy/`.

## 1. Model creation

* Create a stylized model against the full reference sheet, checking front, side, rear and three-quarter silhouettes. Record interpretation questions instead of silently redesigning unseen details.
* Use Blender world **X right, Y away/north, Z up**. Apply the model's scale before rigging. Root/ground plane is Z=0. Initial standing sole-to-crown height is **1.0 Blender unit**; this is a normalized production unit, not a claim about physical meters.
* Model wing translucency, petal layers, hair and ornament as real geometry/materials. Use restrained soft shading and readable shapes at small sprite sizes. Avoid photo-real skin detail, metallic glare or lighting that changes the approved palette.
* Preserve a clean silhouette without relying on opaque backgrounds, green-screen removal or procedural recoloring. Material transparency must survive exported alpha. Hide reference image objects and helpers from final rendering.

Deliverable later: `blender/fairy_model_v001.blend`, external dependencies/source textures, documented Blender version and materials. No empty `.blend` stub is created now.

## 2. Rigging

Use distinct controls for heading/root, pelvis, spine, head, arms, hands, legs/feet, wings, hair and dress petals. Foot IK/contact controls must keep planted feet stable. Wings and ornamental motion should be keyable; bake secondary simulation to reproducible keys before export. Do not let per-render random simulation produce different clips.

Keep a non-animated **ground pivot** at root XY/Z=0. Put body bob, lean and foot motion beneath that control. A separate heading control rotates the whole character around this pivot; never animate the render camera to manufacture direction views. Keep an unambiguous neutral/bind pose and documented bone/control names.

## 3. Animation and sampling

| State | Sprite FPS target | Frames per direction | Loop duration | Motion target |
|---|---:|---:|---:|---|
| idle | 12 | 24 | 2.00s | Quiet breathing and restrained wing/dress/hair movement |
| walk | 12 | 12 | 1.00s | One complete left/right stride cycle, grounded foot contacts |
| run | 16 | 12 | 0.75s | One complete run cycle, readable lean and flight/contact phases |

These are animation sampling targets, **not device quality tiers**. Author and evaluate on a **48 FPS master timeline**: idle 96 ticks, walk 48 ticks, run 36 ticks. Sample every 4, 4 and 3 ticks respectively. Export zero-based indices `0000…0023` for idle and `0000…0011` for walk/run. The closing boundary pose is used to check continuity, not exported as a duplicate final frame.

All first-scope loops are in place. Root XY has no forward travel. Optional authored stride-distance metadata records intended future navigation speed; it does not translate the persisted sprite anchor. Keep the pivot fixed during airborne run poses, so body height changes appear naturally above ground. Check transitions using separate real clips; do not fabricate intermediate frames or crossfade the reference sheet.

Total target: **384 unique animation frames** across three states/eight directions. Exporting both master and delivery resolutions produces two versions of those same authored frames, not new motion.

## 4. Fixed PetalPal camera and directions

Use **orthographic**, not perspective, for the first scope: it provides stable size and parallel projection for layered 2.5D Garden art. Perspective is reserved for a separately approved alternative and must not vary between directions. Blender documents orthographic scale and camera shift in its [camera manual](https://docs.blender.org/manual/en/3.5/render/cameras.html).

Initial fixed camera:

| Setting | Target |
|---|---|
| Projection | Orthographic |
| Elevation | **30° downward from horizontal** |
| Azimuth | From world south toward north (+Y) |
| Roll | 0°; image vertical aligned with projected Z |
| Example position | `(0, -8, 4.618802)` looking at `(0,0,0)` |
| Orthographic scale | **1.75 units**, square frame |
| Pixel aspect | 1:1 |
| Ground-pivot projection | X=50%, Y=87.5% from the PNG top |

Calibrate camera shift once so the world origin projects to that pivot. Verify the projected coordinates rather than guessing shift sign; Blender normalized camera coordinates use a bottom-origin Y, so the target there is `(0.5, 0.125)`. Preserve angle and scale while shifting. Lock the resulting transform, shift, resolution/aspect, lights and color settings in a versioned render scene. If any first-scope motion clips the frame, review the **shared** framing/scale, not per-frame zoom or crop.

Direction names describe world-ground heading: N=+Y, E=+X, S=−Y, W=−X. In the eventual screen/world convention N goes toward decreasing displayed world Y; this specification changes no Garden coordinates. With the bind pose facing **−Y (S)**, heading rotations around +Z are:

| Direction | Heading degrees | Rendered view |
|---|---:|---|
| N | 180 | Rear / away |
| NE | 135 | Rear three-quarter toward screen right |
| E | 90 | Rightward profile |
| SE | 45 | Front three-quarter toward screen right |
| S | 0 | Front / toward viewer |
| SW | 315 | Front three-quarter toward screen left |
| W | 270 | Leftward profile |
| NW | 225 | Rear three-quarter toward screen left |

Rotate the character, **not camera or lights**. Render all eight views; do not mirror asymmetric ornament, wing or pose detail to invent missing views. Existing runtime facing aliases are `front→S`, `back→N`, `right→E`, `left→W`.

## 5. Lighting, RGBA and color

Use a fixed soft neutral key/fill setup. Lock light positions/intensities and environment illumination across states/views. The initial renderer is Cycles with a fixed recorded sample count/seed and deterministic baked motion; begin with 128 samples and inspect alpha-edge noise before locking a final preset. No motion blur in first-scope sprite export; it can obscure contacts and create inconsistent edges. No post-render bloom/glow against an opaque backing.

Enable **Film → Transparent**. Export **PNG, RGBA, 8-bit/channel**, display-ready sRGB, square pixels, output scale 100%; never JPEG/RGB or a flattened matte. Keep transparent sky/background out of the exported image while retaining the intended lighting. Blender's [Film documentation](https://docs.blender.org/manual/en/4.4/render/cycles/render_settings/film.html) describes transparent background output.

Start with Standard view transform, neutral look, exposure 0 and gamma 1; verify the produced colors against the reference before locking. Record the actual Blender/OCIO configuration and view/display settings; do not assume version defaults match. PNG delivery must be display-referred, not unlabeled scene-linear data. Preserve straight/unassociated alpha in delivery; let the runtime decode/premultiply once. Do not double-premultiply, color-key foliage/ornaments or recolor the reference. Inspect edge composites over pale, dark and Garden-colored backgrounds. See Blender's [color-management documentation](https://docs.blender.org/manual/en/4.3/render/color_management.html).

## 6. Canvas, padding, anchor and Garden scale

Recommended authoring masters: **512×512**. Recommended first runtime delivery: **256×256**, rendered at the same camera framing, not automatically trimmed around each pose. Keep both resolutions as distinct future outputs; never resize the authoritative reference. If actual wing/limb motion needs more room, revise the common canvas/camera preset before bulk export.

* Reserve at least **32 master pixels / 16 delivery pixels** of fully transparent border around every animated visible extent. Wings, trailing petals, ornaments and any permitted soft shadow all count. Inspect every state/view, not just the neutral pose.
* Keep the pivot at `(256,448)` in master frames and `(128,224)` in delivery frames: normalized **anchorX=0.5, anchorY=0.875**. This is the ground projection, not opaque-image bounding-box center or whichever foot is currently airborne.
* Never recenter or auto-crop frames independently. All frames use the same canvas and pivot. If future packing trims whitespace, record the complete source-canvas/pivot offsets and adapt the importer explicitly; initial delivery uses **untrimmed** frames only.
* Initial Garden scale target is approximately **64 world px standing sole-to-crown**; review range **56–72 world px** before approving a production size. Measure an actual S-frame body height H, excluding wings/decorations, then derive `FairyLayer.scale = 64 / H` for the selected delivery resolution. Do not treat 256px canvas height as body height.
* With the proposed unit height/camera, projected standing body height is roughly 127px at 256 delivery; scale is therefore roughly 0.50. This is an estimate to validate, **not a Garden configuration change**. The current reference-sheet scale 0.28 is unrelated and stays untouched. Preserve one delivery scale across directions/states; do not enlarge individual run/idle frames to fill the box.

## Shadow policy

First-scope sprite files include natural **self-shadow/material shading only**, with no rendered floor, contact-shadow blob or opaque ground plane. Reference-sheet ground shadows are not extracted. This avoids baking a surface/light footprint into every airborne pose.

If a Garden contact shadow is later approved, render/import it as a separate controlled underlay, anchored to the same ground pivot and placed in the correct depth pass. Do not attach it to the moving foot or add a new full-screen Canvas. Both Blender shadow passes and runtime shadow drawing are out of scope here. Until then, do not fabricate an ellipse or alter the Garden in this task.

## 7. File and atlas naming

State names are lowercase; directions uppercase; revisions use `v001`; indices are zero-based, four-digit. Keep camera/preset revision and source `.blend` identity in export metadata.

Future source render examples:

```text
renders/idle/N/512/fairy_idle_N_v001_512_0000.png
renders/idle/N/256/fairy_idle_N_v001_256_0000.png
renders/idle/N/clip_v001.json
atlases/fairy_idle_N_v001_256_atlas.png
atlases/fairy_idle_N_v001_256_atlas.json
```

No such PNG/clip file is created now. Each clip metadata file records `name`, `direction`, `frameCount`, `fps`, `loop`, `frameWidth`, `frameHeight`, normalized pivot, resolution/preset version and ordered export filenames. Atlas metadata additionally contains ordered source rectangles and pivot values for each frame.

Prefer **one tightly packed page per state/direction**, maximum 2048×2048 for initial delivery; pages need not be power-of-two. Use unrotated, untrimmed 256px cells with **4 pixels external transparent gutter per side**, in addition to the internal sprite border. No opaque edge extrusion; any RGB edge dilation must retain alpha and preserve the visible silhouette. Use normal linear sampling without mipmaps for first review. Never pack the approved reference board into these pages.

At 264px cell pitch, example tight page sizes are 1584×1056 for 24-frame idle (6×4), and 1056×792 for 12-frame walk/run (4×3). Sprite rectangles exclude the 4px external gutters: first rectangle begins at `(4,4)` with size 256×256. Subsequent cells start at multiples of 264, with the same 4px inset. Pivot remains `(0.5,0.875)` relative to each sprite rectangle.

These examples cost approximately **6.38 MiB** for idle and **3.19 MiB** each for walk/run decoded RGBA. All eight directions/all states would approach **102.1 MiB** before backend overhead; do **not** preload all of them. Cache only active/recent pages within a measured budget (initial investigation target: two pages, around 12.8 MiB worst case plus overhead). Do not duplicate frames to pad an atlas. The current Fairy binding supports a single page per clip/view; multi-page clips require a future explicit loader extension.

## 8. Review and future `/fairy-test` import

1. Produce one real S/NE standing pose and a few representative real extreme poses externally. Review character fidelity, camera, pivot, neutral color, transparency, projected scale and wing/petal bounds. Store actual previews and decisions in `review/`; do not label proposed settings visually approved now.
2. After framing approval, render all first-scope states/views, inspect loop seams/foot sliding, verify every alpha extent and pivot, then pack real delivery atlases. Preserve masters and render settings; no destructive replacement of the reference.
3. Copy approved sequence frames to `mobile/assets/garden/fairy/<state>/<direction>/0000.png…`, or atlas pages/metadata to `mobile/assets/garden/fairy/atlases/<state>/<direction>.png` and `.json`. Source render filenames retain revision history; runtime filenames are stable manifest destinations.
4. In a **later implementation task**, register explicit static `require` references in `fairyAssets.ts`. Existing sequence entries need source handles, common frame geometry/pivot, FPS and loop; atlas entries need one source handle and ordered rectangles/pivots. JSON metadata alone cannot load nonexistent images. Do not edit the current empty registry in this task.
5. Use `/fairy-test` for manual frame stepping. Confirm clip descriptor/FPS/count/source type, directions and consistent ground pivot. Keep missing clips on the complete static reference with **NO PRODUCTION CLIP LOADED**. Current Play stores a request; a shared-value playback clock is not wired yet. Implement it only when real assets are available, with readiness/visibility/background pause gates and no per-frame React state updates.
6. Run TypeScript, Fairy metadata/state tests and web/native import checks in that later asset integration. Profile active page memory and one character draw node on the target iPhone. No GardenScene modification or production Fairy integration until separate authorization and visual/performance review.

## Delivery acceptance checklist

* Approved source image hash unchanged; modeled identity manually accepted.
* One documented Blender version, renderer/color preset, camera and light rig for the batch.
* Three neutral loops × eight authored headings, correct unique-frame counts and sample FPS.
* No opaque backdrop, clipped wings, alpha halo, frame recentering, mirrored substitutions, baked floor or root-travel drift.
* Stable ground pivot, body scale and shared framing across every frame/view.
* Real sequence/atlas metadata consistent with supplied image files; no missing references or silent clip padding.
* Contact/occlusion and active-memory performance reviewed in isolated `/fairy-test` before any Garden rollout.

This task stops at documentation/directories. It creates no animation media, `.blend` project, live clip registration, playback clock, quality tiers or Garden changes.
