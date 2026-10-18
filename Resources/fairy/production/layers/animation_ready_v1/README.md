# Fairy layer reconstruction candidate — FAILED VALIDATION

This directory is an isolated working attempt, **not an animation-ready production package** despite its working directory name. Do not import these images into the app or treat them as approved artwork. No Blender rig was built, because the required articulation gate did not pass.

## Inputs and method

The first approved master remains the visible appearance/placement authority. Both `Resources/Icon/fairy structure.png` and `Resources/Icon/fairy.png` were inspected as additional contour references. Approved sources were never overwritten. Their hashes are recorded in `manifest.json` and rechecked by the build script.

Built-in image generation produced candidate hidden-coverage material, followed by authorized Python masking/compositing. No CLI/API fallback was used. Generated images are preserved under `reconstruction_sources/`; these are auxiliary working candidates, not approved replacement designs. The generated limb exterior halos are excluded from the interior texture crops used in the draft.

`images/` contains 24 registered 1254 × 1254 RGBA candidate parts with the requested names. `manifest.json` records their draw order, proposed pivots, source ownership and reconstructed coverage. Source-visible painting is retained in each owned region, but adding underlaps beneath semi-transparent pixels changes the composite. This is a failed preservation check, not permission to modify the approved source.

## Checks and outcome

- Identical canvas, RGBA and source hashes: pass.
- An initial opaque-only underlap attempt reproduced the resting source exactly, but left insufficient joint coverage.
- The revised near-opaque underlap attempt improved coverage but failed exact resting preservation: maximum byte differences R/G/B/A = **7/9/8/5**. Counts are recorded in `manifest.json`.
- Leg-separation diagnostic: failed. Thigh/calf transitions show artificial cap seams and residual garment boundaries. Coverage is not yet clean enough for a walk.
- Elbow-bend diagnostic: failed. Gaps open between the separated arm and adjacent costume, and upper-arm/forearm transitions remain visible.
- Wing/petal diagnostic exists, but independent motion is not certified; the underdress is not a complete backing layer.
- No claim of hole-free knees/elbows, no working rig, no animation sequence, no Expo changes.

## Remaining repair work

1. Replace the candidate knee caps with properly matched, continuous painted thigh/calf underlaps; repair residual skin/garment ownership boundaries rather than stretching them.
2. Complete shoulder/elbow underlaps and the costume backing exposed when arms move. Current source partitions include sheer sleeves and adjacent petal edges, so rigid rotations reveal the cuts.
3. Finish true underdress and wing-root backing rather than treating residual pixels as complete parts.
4. Resolve near-opaque alpha compositing while preserving the approved resting appearance. Do not silently flatten/clean the approved master's alpha or claim the differences are zero.
5. Repeat rest and articulation reviews before any Blender rig. The current generated candidates and geometric masks have not met this quality requirement; they need more precise art reconstruction.

## Review files

- `review/source_vs_recomposed.png`: approved source left, candidate right.
- `review/resting_recomposition.png`: candidate resting RGBA.
- `review/contact_sheet.png`: all 24 draft parts.
- `review/leg_separation.png`: failed leg/knee diagnostic.
- `review/elbow_bend.png`: failed arm diagnostic.
- `review/secondary.png`: unapproved wing/petal diagnostic.

Only this versioned directory was created/edited. GardenScene, Expo integration, previous layers, source masters and previous Spine/Blender work remain unchanged. `build_package.py` reproduces the candidate and records its failed status; it is not a production exporter.
