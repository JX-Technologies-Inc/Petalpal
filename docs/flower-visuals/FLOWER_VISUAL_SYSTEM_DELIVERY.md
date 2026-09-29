> Current Hydrangea status: V1 artwork **REJECTED**; all 25 V1 component PNGs removed. The replacement V2 source is integrated as **READY_FOR_REVIEW**. See [V2 replacement report](HYDRANGEA_V2_COMPONENT_REVIEW.md) for the current recipe/assets. Earlier Hydrangea details below are historical.

> Current DEV checkpoint (2026-09-29): Hydrangea Garden candidate is integrated as **READY_FOR_REVIEW**, using the existing component renderer. June/October Mixed S + M + L now provide 12 Tulip + 12 Chamomile + 6 Hydrangea (30 total). Approved Chamomile and established Tulip behavior are preserved. Hydrangea-only June QA requests 20 and fits 11; October fits 20. Production integration remains deferred. See [Hydrangea review](HYDRANGEA_COMPONENT_REVIEW.md).

> Current art checkpoint (2026-09-28): **Chamomile APPROVED_S_CLASS_REFERENCE** after manual neutral-art review. Preserve the current implementation without further tuning. Mixed-species monthly views are the PRIMARY visual review target; single-species x30 views are QA/stress tests only and must not be optimized to fill the land. Production Garden integration remains deferred. Tulip is unchanged. Hydrangea L-class work must wait for its Garden candidate artwork. See [Chamomile approval checkpoint](CHAMOMILE_COMPONENT_REVIEW.md).

# Production Flower Visual System — preparation delivery

**READY FOR GARDEN ART GENERATION**

Architecture/import readiness only: no finished Garden flower artwork, visual approval or live production migration is claimed. Stop here for external art generation and manual review.

## Deliverables

1. Authoritative inventory: `FLOWER_SOURCE_INVENTORY.json`, measured from the eight curated Resources folders and visually reviewed using contact sheets. Filename, path, category, dimensions, alpha/background, suitability, morphology and hashes are recorded.
2. Exact source count: **26**. All RGB, all baked checkerboards, all need Garden redraws. Lavender is 1024 × 1535; 25 others are 1254 × 1254.
3. Existing mapping: all eight canonical Primary Bloom pools in `lib/flower-variant-config.js` are explicitly empty. Legacy mappings from `data/flowerDB.js` are preserved and documented in `FLOWER_GARDEN_ART_MIGRATION.md`; no folder-based remapping was invented.
4. Unresolved: all eight canonical family mappings, source-name taxonomic ambiguity for Tumi/Chinese Violet Cress, production size classes and final anchors. Blue Rose, Lotus and Cherry Blossom lack curated source references. Fixture aliases remain untouched.
5. Catalog: `gardenArtManifest.json` defines 29 species and **87** slots. Runtime catalog adds supported compositions and unchanged production placement metadata. 78 source-backed slots NEEDS_GARDEN_ART_ADAPTATION; nine missing-reference slots MISSING. Zero approved assets.
6. Product-18 registry: `emotionStyles.ts`, typed against the generated projection of existing backend modifiers. Main brightness/saturation/highlight/halo are restrained; posture intentions are documented but unapplied without supporting art. No species replacement.
7. Shared effects: 11 reusable primitive names, backend effect-token adapter, SUBTLE/STANDARD/FOCUSED budgets. Static cues only in this phase; no flashing, per-flower timers or animation loops. Overview always SUBTLE. Accent color follows the second emotion independently of the main style.
8. Art specification: `FLOWER_GARDEN_ART_PRODUCTION_SPEC.md` defines 512 × 512 transparent PNGs, overhead/light-isometric painterly style, neutral bases, one root point, species-appropriate arrangements and manual approval/import workflow.
9. Migration table: `FLOWER_GARDEN_ART_MIGRATION.md` covers every discovered source plus the three backend-only species, all three statuses, mappings, anchors, size classes and redraw notes.
10. External prompts: `FLOWER_GARDEN_ART_PROMPTS.md` contains 26 individual species prompts preserving visually observed source colors/morphology. Each requests three independent matched PNGs; missing-reference species explicitly await references.
11. Tulip: three exact `tulip_garden_{sparse|normal|full}.png` slots, all NEEDS_GARDEN_ART_ADAPTATION. No PNGs were manufactured. The detailed Tulip prompt preserves coral/pink and yellow. The old image remains a source/legacy sandbox reference only.
12. Sandbox: existing Flower Density Sandbox gains a Garden art mode, all catalog species, deterministic/explicit composition, unchanged month/density/camera controls, production-config footprint preview, missing-art markers and temporary anchor/scale tuning. V1/V2 controls remain available on switching back; their model and art renderer were not changed.
13. Emotion Preview: eight Primary choices, 18 ordered secondary choices, resolved species/composition/colorAccent/backend effect/accent primitive/status/issues display, first-flower selected state. Local temporary state only; no LLM, network or persistence calls.
14. Validator: `validateGardenArt.py` checks file/PNG/dimensions/alpha/nonempty/edge coverage/anchor/scale/composition/path/status/hash; warns about likely matte. `--sync` creates static Metro bindings only for valid READY_FOR_REVIEW/APPROVED assets. `--check` detects changed bytes/metadata. It never edits images or grants approval. Runtime rejects unbound/stale metadata, unapproved art in release, and decode failures. No source fallback.
15. Exact created files are listed below, including audit artifacts.
16. Exactly one existing implementation file modified: `mobile/src/components/garden/flower-density-sandbox/FlowerDensitySandbox.tsx`.
17. Tests: TypeScript passed from `mobile`; 2,130 focused assertions passed, including cases A–E, all 8/18 codes, malformed lists, 360 deterministic identities, 87 slots, anchor/depth/footprint separation and actual renderer approval gates. Nine Python validator tests passed. Existing planting, refinement (57 assertions), flower detail (20 tests), sandbox (1,735 full footprints plus V2 checks) and backend flower-engine/secondary-selector (12 tests) passed. Validator reports 87 missing slots and zero build errors in preparation mode. Contract projection check passed.
18. Still requiring art: all 26 source species listed in the migration table require three Garden redraws each; Blue Rose, Lotus and Cherry Blossom additionally need source references before their nine assets. No READY_FOR_REVIEW or APPROVED assets yet.

## Exact created files

Repository-relative paths below are exact. No original source PNG was changed.

```text
docs/flower-visuals/FLOWER_SOURCE_INVENTORY.json
docs/flower-visuals/FLOWER_GARDEN_ART_MIGRATION.md
docs/flower-visuals/FLOWER_GARDEN_ART_PRODUCTION_SPEC.md
docs/flower-visuals/FLOWER_GARDEN_ART_PROMPTS.md
docs/flower-visuals/FLOWER_VISUAL_SYSTEM_DELIVERY.md
mobile/assets/garden/flowers/species/README.md
mobile/scripts/auditFlowerSources.py
mobile/scripts/syncFlowerVisualContract.mjs
mobile/scripts/validateGardenArt.py
mobile/src/components/garden/flower-visuals/contract.generated.json
mobile/src/components/garden/flower-visuals/flowerVisualTypes.ts
mobile/src/components/garden/flower-visuals/gardenArtManifest.json
mobile/src/components/garden/flower-visuals/gardenArtBindings.generated.ts
mobile/src/components/garden/flower-visuals/flowerVisualResolver.ts
mobile/src/components/garden/flower-visuals/emotionStyles.ts
mobile/src/components/garden/flower-visuals/GardenFlowerVisualLayer.tsx
mobile/src/components/garden/flower-visuals/FlowerEmotionPreview.tsx
mobile/test/flowerVisualSystem.test.mjs
mobile/test/gardenArtValidator.test.py
output/flower-visual-preparation/audit-0.jpg
output/flower-visual-preparation/audit-13.jpg
output/flower-visual-preparation/source-audit.json
output/flower-visual-preparation/locked-baseline.json
```

The two JPEGs are inspection contact sheets of unchanged source files, not generated/adapted production art. Empty species/base directories correspond to manifest slots; Git will preserve delivered PNGs when they arrive, while the manifest already preserves every expected path.

## Validation commands

From `mobile`:

```text
npx tsc --noEmit
node ./test/flowerVisualSystem.test.mjs
node ./test/plantingSystem.test.mjs
node ./test/plantingMaskRefinement.test.mjs
node ./test/flowerDetail.test.mjs
node ./test/flowerDensitySandbox.test.mjs
```

From repository root:

```text
node --test test/back/flower-engine.test.js test/back/secondary-emotion-selector.test.js
C:\Python314\python.exe mobile/test/gardenArtValidator.test.py
C:\Python314\python.exe mobile/scripts/validateGardenArt.py --check
node mobile/scripts/syncFlowerVisualContract.mjs --check
```

Preservation check: SHA-256 verified **49** starting files unchanged, including all files directly in the planting directory, GardenScene.tsx, server.js, Prisma schema and all 26 source PNGs. No masks, offsets, collision rules, Support logic, Journal flow, localStorage or saved flower positions were edited. Existing unrelated workspace changes were preserved. No headless Chrome or screenshot automation ran. Actual imported-art visual review and device performance profiling remain future work.
