# Source audit and species migration

Authoritative curated source count: **26 PNGs across eight Resources flower folders**. Checkpoint/build copies and generic client/mobile sprites are not independent source species. All 26 were inspected in contact sheets: front-facing botanical art, baked checkerboards, RGB without alpha. None is suitable for direct Garden use. See FLOWER_SOURCE_INVENTORY.json for exact paths, dimensions, morphology and SHA-256 hashes. No existing Garden-adapted assets were approved.

## Mapping evidence

`lib/flower-variant-config.js`: all eight canonical pools (SUNNY, GENTLE, QUIET, HEALING, FIRE, WONDER, DRIFTING, PEACEFUL, each suffixed _BLOOM) are explicitly empty. **All eight mappings are unresolved**. The backend uses a shared compatibility fallback; folder emotion names are not canonical mappings. The renderer preserves supplied speciesCode without substituting species.

`data/flowerDB.js` legacy mappings:

| Legacy mood | Existing species |
|---|---|
| happy | Sunflower, Tulip |
| sad | Blue Rose, Lavender |
| calm | Lotus, Cherry Blossom |
| tired | Lavender, Daisy |
| stressed | Chamomile, Lotus |

Blue Rose, Lotus and Cherry Blossom lack matching curated source references, so the manifest adds nine MISSING slots. Blue Rose is not silently mapped to Rose or White Rose. Generic client/mobile sprites and fixture codes (FEBRUARY_TULIP, ORANGE_TULIP, PURPLE_BELL, OCTOBER_BELL, PINK_LILY) remain legacy references; no aliases or saved data are rewritten. Tumi and Chinese Violet Cress retain filename identity with taxonomic uncertainty. Olive is intentionally a foliage/fruit plant.

## All catalog slots

87 total: 78 NEEDS_GARDEN_ART_ADAPTATION, nine MISSING. Zero READY_FOR_REVIEW, zero APPROVED. Every slot has a provisional (.5, .84) anchor and scale 1; size class is unresolved. Runtime footprint/visual dimensions are read from the unchanged production flowerFootprintConfig.ts (Tulip/Lavender radius 20, Sunflower 24, default 22; Lotus/Cherry Blossom 22). Sandbox S/M/L radii are not copied into production metadata.

| Species | Primary mapping | Source | Garden art available | Sparse | Normal | Full | Anchor | Size class | Redraw | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Coreopsis (COREOPSIS) | MAPPING_UNRESOLVED | Resources/Happy/Coreopsis.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | golden yellow notched ray petals, gold centers, slender stems and finely divided green leaves |
| Daisy (DAISY) | MAPPING_UNRESOLVED | Resources/Happy/Daisy.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | white ray petals around yellow discs, green toothed foliage |
| Gerbera Daisy (GERBERA_DAISY) | MAPPING_UNRESOLVED | Resources/Happy/Gerbera Daisy.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | coral pink and orange daisy heads with layered rays, dark centers and broad basal leaves |
| Sunflower (SUNFLOWER) | MAPPING_UNRESOLVED | Resources/Happy/Sunflower.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | golden yellow rays, broad dark brown seed disc, strong stem and heart-shaped green leaves |
| Hydrangea (HYDRANGEA) | MAPPING_UNRESOLVED | Resources/Love & Caring & Gratitude/Hydrangea.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | blue and lavender rounded florets in large dome heads, occasional pale green immature head and broad serrated leaves |
| Rose (ROSE) | MAPPING_UNRESOLVED | Resources/Love & Caring & Gratitude/Rose.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | warm pink layered spiral rose petals, serrated glossy green leaves |
| Anemone (ANEMONE) | MAPPING_UNRESOLVED | Resources/Sadness & Loneliness/Anemone.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | pale lavender blue broad petals, very dark central disc and deeply cut foliage |
| Bluebell (BLUEBELL) | MAPPING_UNRESOLVED | Resources/Sadness & Loneliness/Bluebell.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | nodding blue violet bells on arching stems, long strap-shaped leaves |
| Heather (HEATHER) | MAPPING_UNRESOLVED | Resources/Sadness & Loneliness/Heather.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | mauve purple small clustered florets on slender upright spikes with tiny narrow leaves |
| Tumi (TUMI) | MAPPING_UNRESOLVED | Resources/Sadness & Loneliness/Tumi.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | cream blush star-shaped bloom with darker speckles, pointed petals and muted leaves; preserve this reference identity without asserting a botanical taxon |
| Chamomile (CHAMOMILE) | MAPPING_UNRESOLVED | Resources/Anxiety & Stress & Fear/Chamomile.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | small white daisy rays with yellow domed centers, airy branching stems and finely divided leaves |
| Snowdrop (SNOWDROP) | MAPPING_UNRESOLVED | Resources/Anxiety & Stress & Fear/Snowdrop.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | nodding white bells with green marks, curved green stems and narrow basal leaves |
| Gentian (GENTIAN) | MAPPING_UNRESOLVED | Resources/Anger & Frustration/Gentian.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | deep cobalt blue pointed trumpet petals with dark throat and paired narrow green leaves |
| Petunia (PETUNIA) | MAPPING_UNRESOLVED | Resources/Anger & Frustration/Petunia.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | deep burgundy magenta ruffled trumpet bloom with dark throat and softly textured green leaves |
| Poppy (POPPY) | MAPPING_UNRESOLVED | Resources/Anger & Frustration/Poppy.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | vermilion red crumpled cup petals, dark centers, nodding buds and divided green foliage |
| Bird of Paradise (BIRD_OF_PARADISE) | MAPPING_UNRESOLVED | Resources/Surprise & Excitement & Curiosity/Bird of Paradise.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | orange pointed bracts and blue accents, angular bird-shaped bloom and broad upright green leaves |
| Tulip (TULIP) | MAPPING_UNRESOLVED | Resources/Surprise & Excitement & Curiosity/Tulip.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | warm coral pink and yellow cupped tulip flowers with smooth broad tapering green leaves |
| White Rose (WHITE_ROSE) | MAPPING_UNRESOLVED | Resources/Surprise & Excitement & Curiosity/White-Rose.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | ivory white layered spiral petals, pale yellow center and serrated green leaves |
| Yellow Daffodil (YELLOW_DAFFODIL) | MAPPING_UNRESOLVED | Resources/Surprise & Excitement & Curiosity/Yellow-Daffodil.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | yellow six-part perianth with deeper gold trumpet cup, long green strap leaves |
| Aster (ASTER) | MAPPING_UNRESOLVED | Resources/Tiredness, Numbness, Confusion/Aster.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | dusty lavender many narrow curled rays, muted central disc and gray green narrow foliage |
| Dandelion (DANDELION) | MAPPING_UNRESOLVED | Resources/Tiredness, Numbness, Confusion/Dandelion.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | golden yellow flower and white spherical seed head, toothed basal leaf rosette |
| Yellow Rapeseed Flower (YELLOW_RAPESEED_FLOWER) | MAPPING_UNRESOLVED | Resources/Tiredness, Numbness, Confusion/Yellow-Rapeseed-Flower.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | pale yellow small four-petaled flowers in airy branched racemes with muted green foliage |
| Chinese Violet Cress (CHINESE_VIOLET_CRESS) | MAPPING_UNRESOLVED | Resources/Calm & Peace/Chinese-Violet-Cress.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | violet purple small four-petaled flowers in branching groups, lobed green basal leaves; common name from filename, taxon unconfirmed |
| Lavender (LAVENDER) | MAPPING_UNRESOLVED | Resources/Calm & Peace/Lavender.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | purple violet flower spikes, slender stems and narrow silvery green foliage |
| Olive (OLIVE) | MAPPING_UNRESOLVED | Resources/Calm & Peace/Olive.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | silvery green narrow leaves and small olive green fruit on delicate woody branches; preserve foliage identity rather than inventing large flowers |
| white Magnolia (WHITE_MAGNOLIA) | MAPPING_UNRESOLVED | Resources/Calm & Peace/white-Magnolia.png | No | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | NEEDS_GARDEN_ART_ADAPTATION | PROVISIONAL | UNRESOLVED | Yes | creamy white broad waxy magnolia petals with warm gold stamens, buds and broad dark green leaves |
| Blue Rose (BLUE_ROSE) | MAPPING_UNRESOLVED | MISSING | No | MISSING | MISSING | MISSING | PROVISIONAL | UNRESOLVED | Yes | Backend legacy species; obtain an approved reference before art generation |
| Lotus (LOTUS) | MAPPING_UNRESOLVED | MISSING | No | MISSING | MISSING | MISSING | PROVISIONAL | UNRESOLVED | Yes | Backend legacy species; obtain an approved reference before art generation |
| Cherry Blossom (CHERRY_BLOSSOM) | MAPPING_UNRESOLVED | MISSING | No | MISSING | MISSING | MISSING | PROVISIONAL | UNRESOLVED | Yes | Backend legacy species; obtain an approved reference before art generation |

## Source dimensions and alpha

| Filename | Folder | Dimensions | Alpha | Background | Direct Garden use |
|---|---|---|---|---|---|
| Coreopsis.png | Happy | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Daisy.png | Happy | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Gerbera Daisy.png | Happy | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Sunflower.png | Happy | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Hydrangea.png | Love & Caring & Gratitude | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Rose.png | Love & Caring & Gratitude | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Anemone.png | Sadness & Loneliness | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Bluebell.png | Sadness & Loneliness | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Heather.png | Sadness & Loneliness | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Tumi.png | Sadness & Loneliness | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Chamomile.png | Anxiety & Stress & Fear | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Snowdrop.png | Anxiety & Stress & Fear | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Gentian.png | Anger & Frustration | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Petunia.png | Anger & Frustration | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Poppy.png | Anger & Frustration | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Bird of Paradise.png | Surprise & Excitement & Curiosity | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Tulip.png | Surprise & Excitement & Curiosity | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| White-Rose.png | Surprise & Excitement & Curiosity | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Yellow-Daffodil.png | Surprise & Excitement & Curiosity | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Aster.png | Tiredness, Numbness, Confusion | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Dandelion.png | Tiredness, Numbness, Confusion | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Yellow-Rapeseed-Flower.png | Tiredness, Numbness, Confusion | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Chinese-Violet-Cress.png | Calm & Peace | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| Lavender.png | Calm & Peace | 1024 × 1535 | None (RGB) | Baked checkerboard | No |
| Olive.png | Calm & Peace | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
| white-Magnolia.png | Calm & Peace | 1254 × 1254 | None (RGB) | Baked checkerboard | No |
