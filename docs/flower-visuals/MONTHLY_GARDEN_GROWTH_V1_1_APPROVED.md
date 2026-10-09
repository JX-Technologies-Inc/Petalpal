# MONTHLY_GARDEN_GROWTH_V1_1_APPROVED

User manual review **PASSED**, recorded 2026-09-29. Monthly Garden Growth V1.1, including the rendering-boundary correction, is the approved initial production visual direction for PetalPal's monthly flower garden. This checkpoint preserves the current implementation; it does not integrate it into production or tune any visual behavior.

| Mode | Current status |
|---|---|
| Monthly Garden Growth V1.1 | APPROVED |
| Mixed V1 | LEGACY DEV / QA — retained |
| Mixed V2 | LEGACY DEV / QA — retained |
| Monthly Growth V1 | LEGACY DEV / QA — retained |

## Locked behavior

- One Journal entry equals one real Flower Record, one parent identity, one species, one ground anchor and one planting footprint. Thirty days means thirty real parent Flower Records.
- Primary Bloom + Companion Growth + Bed Filler. Children remain deterministic, non-persisted and non-independent; Journal and Support belong only to the parent. Existing primary-only interaction is preserved.
- Current count-driven stages: 1–5 NEW GARDEN, 6–10 EARLY GROWTH, 11–15 ESTABLISHED, 16–20 LUSH, 21–25 MATURE, 26–30 FULL MONTH. Stage-end density targets remain 9/22/38/54/67/78%, with 2/4/6/8/10/12 companion pieces per parent. No clock-driven maturity.
- Current V1.1 height layers, neighboring species overlap, uneven filler, focal pockets, root cover, visual density and maturity targets are frozen. June Day 30 is the approved visual reference; no new V1.1 tuning for other months is implied.
- June Day 30: **30 parents, 57 primary pieces, 360 companions, 174 filler pieces; 591 total visual pieces**, including 44 pieces of root cover and three separated companion focal pockets.
- June species: Chamomile 6, Tulip 6, Daisy 5, Lavender 4, Poppy 4, Hydrangea 2, Coreopsis 3. Current primary anchors and transforms remain authoritative.
- S / M / L logical footprint radii remain **9 / 12 / 16 world px**, independent of artwork. Approved Chamomile S reference, Tulip M behavior and Hydrangea V2 L reference are preserved, as are all currently valid batch components and their existing metadata/scales.
- Approved masks, parent anchors, collision and initial/Adjust Position validation stay unchanged. **Final Mask constrains planting validity, not rendered botanical pixels.** Primary, companion and filler artwork may extend naturally past the mask; origin generation keeps its current constraints.
- Land06 ordering remains ground → flower visuals → Tea Set foreground/occlusion. Actual landmark occlusion is preserved independently of planting validity.
- Emotion effects remain OFF. Production Garden, backend semantics, persistence, Journal and Support are unchanged.

The exact June V1.1 visual-piece JSON SHA-256 is `347f5a41794341e6032d88db308928a76e2e0b7e893010e776cbce2f2cec0f5c`. Current in-region alpha estimates remain 74.7% runtime / 74.1% full-resolution. These are in-region measurements, not a cap on artwork extending beyond the mask or an instruction to increase density.

## Backup and reconstruction

Checkpoint directory: `output/flower-visual-checkpoints/MONTHLY_GARDEN_GROWTH_V1_1_APPROVED/`.

- `snapshot.zip`: repository-relative mobile implementation, runtime assets, public files, component manifests, configuration/lockfiles, tests/scripts, flower source art, review documentation and reference-test dependencies. Captures current on-disk content, including uncommitted/untracked implementation.
- `manifest.json`: every archived path, size and SHA-256, plus checkpoint identity and provenance.
- `checksums.json`: ZIP and manifest integrity checks.
- `verify_checkpoint.py`: checks archive integrity and every member; can also compare the snapshot to a restored directory.
- `README.md`: exact restore/verification instructions and exclusions.
- `test-results.json` and `test-logs/`: requested TypeScript and regression results.
- `approved-runtime-sha256.json`: pre-checkpoint hashes proving the mobile implementation/assets/configuration were preserved during this task.

Restore into a separate empty directory, verify it, then install mobile dependencies with the archived lockfile (`npm ci` in `mobile`). Run the documented tests and use the existing DEV Sandbox's **June Day 30 — V1.1** preset. Browser storage, Journal data, credentials, databases, dependency caches and running process state are outside this visual-source checkpoint. Approved planting masks are included as source/assets; no localStorage reset or export is required.

The approved source and assets are frozen by checksums; no read-only flags or runtime behavior changes are introduced. Further art-direction changes require a new, explicitly reviewed checkpoint.

## Checkpoint validation

**All 24 checks passed:** TypeScript (`npx tsc --noEmit`), 20 Node regression suites, both full-resolution alpha comparisons and alpha-metadata reproducibility. The Node checks cover current growth/composition fingerprints, unchanged parent identities and footprints, unclipped botanical pixels, approved-mask planting validation, Tea Set occlusion, actual Sandbox controls, Tulip/Chamomile/Hydrangea and batch regressions, retained legacy modes, and protected production/backend/artwork hashes. Exact commands, versions and logs are in `test-results.json` and `test-logs/`.

No browser/screenshot automation or emotion work was performed. Checkpoint work stops after the archive and checksums are verified.
