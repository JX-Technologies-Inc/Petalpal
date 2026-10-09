# Tulip Garden Component Composition V2 — DEV review

**READY_FOR_REVIEW only.** Garden art direction is user-approved; individual components and final compositions have not been marked APPROVED. Production Garden rendering remains unchanged.

## Extraction assessment

The supplied 1536 × 1024 RGBA sheet has real alpha. A viewer that displays RGB without compositing alpha shows a colored sheet background, but most of that color is transparent. Labels and separator lines remain visible and must be excluded. Alpha also contains faint background residue.

Clean extraction was possible for **28 distinct components**: eight singles, six small clusters, five medium clusters, three full clusters and six foliage pieces. The **leftmost full cluster was omitted** because its section text meets the left bloom; obtain a separate transparent export for that piece rather than risk damaging petals. No duplicate files were created to hit a count.

Extraction uses source alpha support >= 8, a three-pixel fringe retaining the original RGBA, and connected support around the visual soil point. This removes disconnected low-alpha sheet residue and neighboring art fragments without color-keying petals or foliage. One explicit heading exclusion is recorded for the first medium cluster. Plant pixels within the retained mask are copied unchanged: no repaint, recolor, resampling, sharpening, geometry reconstruction or botanical-source reuse. Each component is padded onto a 512 × 512 transparent canvas. Source sheet bytes remain unchanged. These are DEV candidates, not claims of final production approval.

Reproduce/verify: `C:\Python314\python.exe mobile/scripts/extractTulipComponentsV2.py --check`. This checks exact retained source pixels, file hashes, canvas/alpha, metadata and static module bindings. The original source SHA-256, crop rectangles, source soil points, alpha content bounds and status are in `componentManifest.json`.

## Component IDs, paths and anchors

All rows: canvas 512 × 512; defaultVisualScale 1.0; worldUnitsPerPixel 0.16; status READY_FOR_REVIEW. Anchors represent visually estimated stem/soil or low-foliage contact, not automatic image centers. The table includes every extracted component and exact asset path.

| Component ID | Category | Color family | Blooms/buds | anchorX | anchorY | Asset path |
|---|---|---|---:|---:|---:|---|
| single/pink_01 | single | pink | 1 | 0.525391 | 0.949219 | mobile/assets/garden/flowers/species/tulip/components/single/pink_01.png |
| single/pink_02 | single | pink | 1 | 0.507812 | 0.949219 | mobile/assets/garden/flowers/species/tulip/components/single/pink_02.png |
| single/yellow_01 | single | yellow | 1 | 0.492188 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/yellow_01.png |
| single/yellow_02 | single | yellow | 1 | 0.472656 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/yellow_02.png |
| single/bud_yellow_01 | single | yellow | 1 | 0.486328 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/bud_yellow_01.png |
| single/bud_pink_01 | single | pink | 1 | 0.492188 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/bud_pink_01.png |
| single/bud_pink_02 | single | pink | 1 | 0.490234 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/bud_pink_02.png |
| single/bud_yellow_02 | single | yellow | 1 | 0.521484 | 0.953125 | mobile/assets/garden/flowers/species/tulip/components/single/bud_yellow_02.png |
| small/pink_01 | small | pink | 2 | 0.496094 | 0.943359 | mobile/assets/garden/flowers/species/tulip/components/small/pink_01.png |
| small/yellow_01 | small | yellow | 2 | 0.494141 | 0.939453 | mobile/assets/garden/flowers/species/tulip/components/small/yellow_01.png |
| small/mixed_01 | small | mixed | 2 | 0.511719 | 0.939453 | mobile/assets/garden/flowers/species/tulip/components/small/mixed_01.png |
| small/pink_02 | small | pink | 2 | 0.515625 | 0.937500 | mobile/assets/garden/flowers/species/tulip/components/small/pink_02.png |
| small/yellow_02 | small | yellow | 2 | 0.496094 | 0.941406 | mobile/assets/garden/flowers/species/tulip/components/small/yellow_02.png |
| small/pink_03 | small | pink | 2 | 0.517578 | 0.935547 | mobile/assets/garden/flowers/species/tulip/components/small/pink_03.png |
| medium/pink_dominant_01 | medium | pink-dominant | 3 | 0.507812 | 0.925781 | mobile/assets/garden/flowers/species/tulip/components/medium/pink_dominant_01.png |
| medium/pink_dominant_02 | medium | pink-dominant | 3 | 0.486328 | 0.925781 | mobile/assets/garden/flowers/species/tulip/components/medium/pink_dominant_02.png |
| medium/yellow_dominant_01 | medium | yellow-dominant | 3 | 0.503906 | 0.927734 | mobile/assets/garden/flowers/species/tulip/components/medium/yellow_dominant_01.png |
| medium/yellow_dominant_02 | medium | yellow-dominant | 3 | 0.503906 | 0.925781 | mobile/assets/garden/flowers/species/tulip/components/medium/yellow_dominant_02.png |
| medium/pink_dominant_03 | medium | pink-dominant | 3 | 0.501953 | 0.925781 | mobile/assets/garden/flowers/species/tulip/components/medium/pink_dominant_03.png |
| full/yellow_dominant_01 | full | yellow-dominant | 5 | 0.498047 | 0.908203 | mobile/assets/garden/flowers/species/tulip/components/full/yellow_dominant_01.png |
| full/pink_dominant_01 | full | pink-dominant | 5 | 0.486328 | 0.908203 | mobile/assets/garden/flowers/species/tulip/components/full/pink_dominant_01.png |
| full/pink_dominant_02 | full | pink-dominant | 5 | 0.501953 | 0.906250 | mobile/assets/garden/flowers/species/tulip/components/full/pink_dominant_02.png |
| foliage/leaves_01 | foliage | green | 0 | 0.490234 | 0.941406 | mobile/assets/garden/flowers/species/tulip/components/foliage/leaves_01.png |
| foliage/ground_01 | foliage | green | 0 | 0.501953 | 0.949219 | mobile/assets/garden/flowers/species/tulip/components/foliage/ground_01.png |
| foliage/ground_02 | foliage | green | 0 | 0.490234 | 0.925781 | mobile/assets/garden/flowers/species/tulip/components/foliage/ground_02.png |
| foliage/leaves_02 | foliage | green | 0 | 0.478516 | 0.937500 | mobile/assets/garden/flowers/species/tulip/components/foliage/leaves_02.png |
| foliage/ground_03 | foliage | green | 0 | 0.501953 | 0.947266 | mobile/assets/garden/flowers/species/tulip/components/foliage/ground_03.png |
| foliage/leaves_03 | foliage | green | 0 | 0.501953 | 0.935547 | mobile/assets/garden/flowers/species/tulip/components/foliage/leaves_03.png |

## Composition rules

The existing stable flowerId hash chooses Sparse/Normal/Full, with optional DEV override. A versioned seeded generator determines the color family, component IDs, offsets, scale and rotation. Reloading does not regenerate the arrangement.

- Sparse: 1–2 blooms/buds and zero or one small foliage component.
- Normal: 2–3 blooms/buds and one foliage component.
- Full: 3–5 blooms/buds and one or two foliage components.
- Single stems build most arrangements. A 30% branch for counts of at least three may use one compatible two-bloom small component plus independently positioned stems. Counts are actual blooms/buds from component metadata, not just sprite counts.
- Medium/full source clusters are extracted and cataloged for review but deliberately excluded from automatic assembly, avoiding repeated complete prefabs. No altered species images or emotion assets are created.
- Root X offsets stay within ±6 world px (±3.5 in Sparse); root Y offsets stay within ±2.5, with foliage at up to +3.5. Rejection sampling discourages near-identical roots without imposing a uniform lattice.
- Stem scale varies approximately .82–1.06; foliage .42–.57. Dominant-family accents receive restrained relative size emphasis. Rotations are bounded to ±7° for stems, ±4° for small clusters, ±10° for foliage. Each sprite rotates around its own soil anchor.
- Parts sort by local ground Y and stable order inside one complete object. Complete objects retain saved worldY/id depth order.
- **Exactly one planting object, one ground anchor and one radius-12 collision footprint per journal flower.** Component count does not add collision circles. No persisted data, placements or production footprint rules change.

## Color families

| Family | DEV seed weight | Observed in 1,200 test IDs |
|---|---:|---:|
| Pink only | 25% | 277 |
| Yellow only | 20% | 252 |
| Pink dominant | 25% | 316 |
| Yellow dominant | 15% | 177 |
| Mixed | 15% | 178 |

Only supplied natural pink/yellow components are selected. Pure-color families contain no other-color blooms. Dominant/mixed families contain both colors; two-bloom dominant arrangements use scale emphasis because bloom counts are tied. These are art/composition weights, not backend or emotion meanings. Both secondary emotions remain NONE, with no tint, glow, sparkle, pulse, mist or runtime hue shifting.

## DEV controls

Flower Density Sandbox defaults to **Component Composition V2**. Switch directly to **Old Fixed Prefabs** without changing ground positions or composition density assignments. Previous current/tuned scale buttons explicitly select the fixed-prefab path.

Presets: October / Land10 / 30 (30 placed), June / Land06 / 30 (24 placed under unchanged constraints), and October / Land10 / 10 (10 placed). Density and composition controls remain available; visual scale affects only rendering.

**Show Cluster Bounds** draws the rotated visible-content union for V2, never a collision shape. The fixed-prefab comparison uses its enclosing rendered canvas bounds. Footprint, anchor and mask overlays default off. All component rendering and bounds overlays return null outside DEV.

## Validation

`npx tsc --noEmit` passed. The new `tulipComponentComposition.test.mjs` passed 1,200 stable-identity scenarios plus 150 explicit density cases, 28 PNG hashes, color-family existence/distribution, bloom budgets, root-offset/rotation/bounds limits, one-object/radius-12 invariants, all three preset placement/depth parity checks and a release-render guard. All 1,200 generated signatures were distinct. No unseeded random calls, emotion filters or animation timers are present.

Source extraction `--check` passed. Existing production asset validator still reports the original three valid fixed candidates, with no approval promotion. Hash checks confirm 49 protected files and the three original prefab PNGs are unchanged. Existing planting and refinement tests passed; the Flower Visual System passed 2,220 assertions; the fixed-Tulip/A-B review tests passed; sandbox regression passed 1,735 full footprints across all 12 months × four modes at 30/40 requested, with existing V2 grouping checks. No headless Chrome or screenshot automation was used. In-app visual quality remains for manual review.

## Exact changed files

Modified existing file:

- `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`

Created code/metadata/test/report files:

- `mobile/scripts/extractTulipComponentsV2.py`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/componentManifest.json`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/componentImages.ts`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/tulipComposition.ts`
- `mobile/src/components/garden/flower-density-sandbox/tulip-components/TulipComponentLayer.tsx`
- `mobile/test/tulipComponentComposition.test.mjs`
- `docs/flower-visuals/TULIP_COMPONENT_V2_REVIEW.md`

Created PNG assets: the 28 exact paths in the component table above. No original PNG was overwritten.

Created inspection/test artifacts (not production artwork or UI screenshots):

- `output/tulip-v2-alpha-inspection.jpg`
- `output/tulip-v2-alpha-channel.png`
- `output/tulip-v2-extracted-inspection.jpg`
- `output/tulip-v2-planting-tests.txt`
- `output/tulip-v2-mask-tests.txt`

STOP for manual review. No other species work and no production integration.
