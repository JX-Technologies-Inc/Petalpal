# PRODUCTION_PLANTING_COLLISION_SML_V1_APPROVED

Production logical-parent collision migration. No persisted record/coordinate migration; no botanical visual change.

## Authoritative resolver

`mobile/src/components/garden/planting/parentCollision.ts::resolveParentCollision(speciesCode, flowerName)` maps canonical code to approved class to radius. Canonical codes win over display names. Case, spaces and hyphens normalize consistently. Legacy ORANGE_TULIP/FEBRUARY_TULIP name-only aliases retain Tulip collision identity. Unknown explicit codes are never inferred from a different display name.

| Species | Class | Production radius world px |
|---|---|---:|
| Chamomile | S | 9 |
| Coreopsis | S | 9 |
| Daisy | S | 9 |
| Bluebell | S | 9 |
| Heather | S | 9 |
| Snowdrop | S | 9 |
| Aster | S | 9 |
| Dandelion | S | 9 |
| Yellow Rapeseed Flower | S | 9 |
| Chinese Violet Cress | S | 9 |
| Lavender | S | 9 |
| Tulip | M | 12 |
| Gerbera Daisy | M | 12 |
| Anemone | M | 12 |
| Gentian | M | 12 |
| Petunia | M | 12 |
| Poppy | M | 12 |
| White Rose | M | 12 |
| Yellow Daffodil | M | 12 |
| Olive | M | 12 |
| Hydrangea | L | 16 |
| Sunflower | L | 16 |
| Bird of Paradise | L | 16 |
| Lotus | UNRESOLVED | new Plant/Move blocked |
| Cherry Blossom | UNRESOLVED | new Plant/Move blocked |

Lotus/Cherry Blossom canonical product mappings and Garden registry were inspected; sizeClass remains UNRESOLVED, with missing artwork and no batch class. No class was guessed. Existing unresolved occupied anchors retain conservative 22px spacing to protect them; this is explicitly not an approved S/M/L class. All unresolved pending records return COLLISION_CLASS_UNRESOLVED / “This flower is not ready for planting yet.” Confirm remains disabled. Their records/detail/Journal/Support remain intact. Other unknown species follow the same explicit policy.

## Complete flow

Initial Plant, updatePreview, initial Adjust, and Confirm pass speciesCode to the same validator. Confirm revalidates; Adjust ignores only its own ID. Occupied collision resolution also uses canonical speciesCode. Both production and legacy preview circles use the same resolver via getFlowerPlacementDefinition. Fullness sampling forwards speciesCode to the production validator; its existing coarse sampling algorithm is preserved (not a proof of full capacity). Classified radii cannot be overridden with the deprecated definition argument. There are no classified production 20/22/24 collision decisions. Historical visual/hit-target dimensions remain unchanged.

No write/migration occurs on load. worldX/worldY/month/landId/rotation/scale/flowerId/journalEntryId/plantedDate remain unchanged. Reducing classified radii relaxes existing valid footprints and separations. Unresolved saved parents are conservatively retained, but moving them requires a future authoritative classification.

## Actual production capacity

No audit-only override: verifyProductionCollisionCapacity.mjs uses createAuditEngine() without injection. Same representative mix, twelve deterministic starts, exact Final Mask containment, same packing strength as the accepted audit. All starts achieved 30 on every land. Aggregate results only; no synthetic Flower Record coordinates are persisted.

| Land | Parents | Minimum disk clearance px | Robustness |
|---|---:|---:|---|
| Land01 | 30/30 | 7.84 | PASS_TIGHT |
| Land02 | 30/30 | 7.98 | PASS_TIGHT |
| Land03 | 30/30 | 7.84 | PASS_TIGHT |
| Land04 | 30/30 | 14.98 | PASS_ROBUST |
| Land05 | 30/30 | 6.00 | PASS_TIGHT |
| Land06 | 30/30 | 4.63 | PASS_TIGHT |
| Land07 | 30/30 | 26.22 | PASS_ROBUST |
| Land08 | 30/30 | 27.00 | PASS_ROBUST |
| Land09 | 30/30 | 29.60 | PASS_ROBUST |
| Land10 | 30/30 | 35.57 | PASS_ROBUST |
| Land11 | 30/30 | 30.22 | PASS_ROBUST |
| Land12 | 30/30 | 26.22 | PASS_ROBUST |

## Protection and QA

Growth remains 591 pieces, coverage 0.748152634766808, six sectors and zero outside origins in the approved June reference. Frozen exact-output performance regression passed. Growth artwork/scales/child generation/caches are untouched; parent collision is independent. Final Masks, source/artwork, Journal/Support and all previous checkpoint trees are checked byte-for-byte against the pre-migration audit inventory, with explicit exact hashes only for authorized collision integration files. Previous manifests and performance hash files are untouched.

TypeScript and all relevant regression tests passed. Test outputs are in output/production-collision-sml-v1/test-results.json; the performance test refreshed only its existing timing sidecar. Plant/Adjust/Cancel/Confirm/reload, species precedence, actual preview radii, unresolved Confirm rejection, no-write saved-record loading, collision self-ignore and 12-land capacity are covered. flowerDetail covers existing Journal linkage and Support API/ownership/refresh behavior. No live account data or backend contract was modified; no browser/screenshot automation.

## Checkpoint and restore

New checkpoint: output/flower-visual-checkpoints/PRODUCTION_PLANTING_COLLISION_SML_V1_APPROVED. It preserves current implementation/configuration/art manifests, all prior production snapshot paths still present, current performance implementation and migration evidence/tests. It does not overwrite the earlier snapshots. See its README for verification and controlled restore instructions.

## Remaining before backend E2E

Manual Plant/Adjust/Confirm review remains required, especially June tight packing and unresolved-species messaging. Backend E2E must confirm canonical speciesCode delivery for the 23 classified species. Lotus/Cherry Blossom (and other unknown codes) remain deliberately blocked for new Plant/Move until classification is approved. There is no coordinate/schema migration blocker for classified records. No backend E2E was run in this task.

## Exact files changed / created

- mobile/src/components/garden/planting/parentCollision.ts
- mobile/src/components/garden/planting/flowerFootprintConfig.ts
- mobile/src/components/garden/planting/placementValidator.ts
- mobile/src/components/garden/planting/PlantingContext.tsx
- mobile/src/components/garden/planting/PlantedFlowerLayer.tsx
- mobile/src/components/garden/planting/ProductionPlantedFlowers.tsx
- mobile/src/components/garden/planting/fullnessDetector.ts
- mobile/test/productionCollisionSml.test.mjs
- mobile/test/plantingCapacityAudit.test.mjs
- mobile/test/parentRelativeGrowth.test.mjs
- mobile/test/productionGrowth.test.mjs
- mobile/test/productionGrowthFlow.test.mjs
- mobile/test/productionGrowthProtection.test.mjs
- mobile/test/flowerVisualSystem.test.mjs
- mobile/test/approvedPlantingRuntime.test.mjs
- mobile/test/monthlyLayeredBed.test.mjs
- mobile/test/collisionCandidateAudit.test.mjs
- mobile/test/assertFlowerBaseline.mjs
- mobile/scripts/collisionAuditEngine.mjs
- mobile/scripts/verifyProductionCollisionCapacity.mjs
- docs/flower-visuals/PRODUCTION_COLLISION_SML_HASHES.json
- docs/flower-visuals/PRODUCTION_PLANTING_COLLISION_SML_V1_APPROVED.md
- output/production-collision-sml-v1/capacity.json
- output/production-collision-sml-v1/test-results.json
- output/production-growth-performance/equivalence-and-timing.json
- output/production-collision-sml-v1/changed-files.json
- output/flower-visual-checkpoints/PRODUCTION_PLANTING_COLLISION_SML_V1_APPROVED/{snapshot.zip,manifest.json,README.md,verify_checkpoint.py}

Stop after migration. No emotion work or backend semantic changes.
