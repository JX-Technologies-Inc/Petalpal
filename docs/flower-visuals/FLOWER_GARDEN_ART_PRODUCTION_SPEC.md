# PetalPal Garden flower art production specification

Status: art preparation only. No Garden PNGs generated or approved by this implementation.

## Deliverable and canvas

Deliver three **independent** neutral PNGs per species: sparse, normal, full. Standard: **512 × 512 RGBA PNG**, true alpha, sRGB. The existing Skia renderer sizes art in Garden world units independently of raster resolution; no runtime constraint requires keeping the source 1254-pixel canvas. A square standard supports tall and wide plants through transparent padding and per-asset scale. Inspect zoom quality before approving the pilot; change this standard centrally if real art proves inadequate.

Paths: `mobile/assets/garden/flowers/species/{species_code_lowercase}/base/{species_code_lowercase}_garden_{sparse|normal|full}.png`. Tulip filenames are exactly `tulip_garden_sparse.png`, `tulip_garden_normal.png`, `tulip_garden_full.png`. Species paths are independent of unresolved Primary Bloom pools.

## Style and camera

Soft semi-realistic painterly fantasy, elegant, compatible with existing Garden vegetation. Restrained local contrast, harmonized saturation, natural soft edges with enough detail for zooming. No photorealism, flat vector treatment, hard sticker outline, white fringe or botanical poster composition.

Redraw from a substantially more overhead, light-isometric Garden camera. Show the flower heads from above; stems are partially visible and foliage spreads naturally around the planting point. The plant must appear to grow from the Garden grass when composited, without including the grass in the asset. Do not preserve the source's standing front-facing bouquet framing.

## Content and transparency

Only the target plant, its natural stems and leaves, and minimal species-appropriate basal foliage. No rocks, paths, water, grass patch/rectangle, unrelated flowers, labels, text, UI or environmental shadows. No white/black/colored matte or baked checkerboard. Empty pixels must have alpha zero; edge pixels may use partial alpha. Avoid colored matte fringes. Keep all visible content away from canvas edges.

Base art is emotionally neutral. Do not bake sparkles, glow, gold gratitude light, love pink halos, sadness mist or any emotional VFX. Runtime styles preserve petal color and plausible foliage with restrained luminance/saturation adjustments and separate local highlights.

## One planting point and three arrangements

One journal entry remains one object, one cluster, one logical soil anchor and one collision footprint. Stems converge toward a believable root point even when foliage spreads horizontally.

- Sparse: airy asymmetric arrangement, usually 1–2 major blooms/stems.
- Normal: natural balanced everyday cluster, usually 2–3 major blooms/stems.
- Full: richer small cluster, usually 3–5 major blooms/stems.

Adapt to morphology: a full Hydrangea can have one dominant head, one smaller head and foliage. Olive uses branches/leaves/fruit rather than invented giant flowers. These are independent redraws, never duplicated/cropped/rotated source stickers.

All three must share camera, painterly language, soft lighting direction, source color identity, saturation and root convention. Avoid making full a much larger physical planting footprint.

## Metadata and review

Each slot contains canvasWidth/Height, normalized anchorX/Y, visualScale, approval status and approval hash. The catalog adds sizeClass and existing placement metadata through `getFlowerPlacementDefinition`. Anchors start at **(0.5, 0.84), PROVISIONAL**; that is an explicit staging convention, not an inferred image center or a reviewed root location. Adjust each composition after inspection. Size classes remain UNRESOLVED until art review; they do not drive placement.

The renderer computes top-left from the ground position minus the normalized anchor multiplied by rendered dimensions. Scale and emotion do not affect collision radius; Y depth uses ground worldY with stable id ties. No posture deformation is applied without supported dedicated artwork.

## Import and manual approval

From repository root (Python with Pillow required; on this workstation use `C:\Python314\python.exe`):

1. Deliver the three PNGs into the matching species/base directory. Do not overwrite `Resources`.
2. Set each delivered manifest slot to READY_FOR_REVIEW. Enter the intended anchor and scale. Run `python mobile/scripts/validateGardenArt.py --sync`. Invalid files fail validation and receive no binding. Pending missing slots remain reported.
3. Open existing DEV `/garden-test` → Flower Density Sandbox → Garden art preview. Select species, composition, Primary, ordered secondary emotions, month and density. Missing assets appear as explicitly labeled brown markers. Legacy V2 preview remains available.
4. Review all three assets on actual Garden backgrounds, including dense regions and zoom. Use temporary anchor offset and scale controls; copy accepted resulting values into `gardenArtManifest.json`, then rerun `--sync`. Test overview and selected state. No LLM calls occur.
5. Never resize the collision footprint merely to fit the PNG. Footprints continue to come from the existing production placement configuration.
6. A human reviewer approves morphology, camera, edges, transparency, root point, scale and harmony. Set anchorStatus REVIEWED, copy the PNG SHA-256 from `--json` into reviewedSha256, and set status APPROVED. The validator does not approve art.
7. Run `python mobile/scripts/validateGardenArt.py --sync`, then `--check`; run `node mobile/scripts/syncFlowerVisualContract.mjs --check`, typecheck and focused tests. Include the PNG, manifest and generated bindings in the same change. CI/builds must run `--check` to reject stale bytes/metadata. `--strict` additionally rejects every missing slot, useful only when requiring a complete catalog.
8. Future production integration may consume only APPROVED assets. This task does not switch the live Garden renderer. Unknown, missing, invalid or unapproved art yields no production sprite and a resolver issue; never a botanical substitute. The DEV marker is compiled behind `__DEV__`.

Validation checks PNG format, exact dimensions, real alpha, nonempty content, edge coverage, normalized anchors, positive scale, exactly three compositions, canonical paths, approval state and reviewed hashes. Warnings identify high opaque coverage; automated checks cannot prove correct camera/species or find every baked checkerboard. Manual visual approval remains essential.

## Runtime contract and performance

Frontend input: `{ flowerId, primaryBloom, speciesCode, secondaryEmotions, plantedDate? }`. The backend supplies an already-filtered ordered Product-18 list of length zero to two. Primary/species are never reselected. Malformed lists are reported and rendered neutral without promoting the accent. A redundant primary secondary is reported for contract debugging, never made into another Primary. Composition hashes only flowerId unless explicitly overridden in DEV.

`contract.generated.json` is a checked projection of `lib/flower-variant-config.js` and `data/flowerDB.js`, not another semantic authority. Refresh with `node mobile/scripts/syncFlowerVisualContract.mjs`. The new visual adapter preserves existing colorAccent/effect tokens. For one secondary the backend compatibility field may name an effect; the new renderer applies that emotion as MAIN only, with its own optional halo. Only secondary[1] supplies ACCENT. Both fields are shown in DEV diagnostics.

Eighteen styles reference shared effects, no emotion image paths. Brightness range .94–1.04 and saturation .93–1.04 retain natural petal and leaf colors; highlight colors live in separate restrained layers. Posture intent is recorded but not faked by warping unsupported images.

SUBTLE overview: opacity budget .07 and at most one accent point. STANDARD selected: .13/two. FOCUSED reserved: .20/three. Only the first test flower receives selected presentation. These never change saved footprints. Effects are static in this phase; flash is a static cue, not flashing. Future motion must use one shared/batched clock, tiny amplitude, long sparkle intervals and one-shot flash events, never rapid loops. For up to 360 objects, reuse Skia image resources, memoize sprites, and keep overview effects bounded. Decode/upload of 87 RGBA images could cost roughly 87 MiB before overhead; mount/load only visible species/compositions and profile on devices before enabling the full production scene. No performance benchmark or visual approval is claimed here.
