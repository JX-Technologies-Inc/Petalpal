# Land09 interface correction — awaiting visual approval

Added a broader Land09-side paved endpoint with irregular gray-green to warm stone progression and locally opened curb ends. No existing artwork files were edited. No checkpoint was created.

## Runtime additions

- `mobile/assets/garden/infrastructure/land09-interface-v2/land09-broad-interface.png`: underlay after Lands and before Main Entrance.
- `mobile/assets/garden/infrastructure/land09-interface-v2/land09-interface-foreground.png`: local correction after the existing Land09 transition and before B01 landing/bridge.
- Both are transparent 2400×1800 world canvases at x=0, y=0, width=2400, height=1800, rotation=0, fit=fill. Nontransparent bounds: (1325,1366)–(1503,1534).
- `GardenLand09InterfaceLayer.tsx` loads the underlay. `GardenScene.tsx` inserts it only in the existing DEV infrastructure branch. `GardenInfrastructureLayer.tsx` adds the foreground. Previous layers retain their relative order and transforms.

The foreground alpha excludes opaque previously visible Main Entrance pixels. Existing old Land09 overlays remain intact and in their previous draw positions. The new underlay genuinely overlaps the locked road beneath these layers.

## Verification

378 baseline files checked. Only the two expected existing component files changed; every existing art asset is byte-identical. There are 4,498 opaque warm-road-classified overlap pixels and 8,927 opaque gray-Land09-classified overlap pixels. Color classification is a diagnostic approximation of paving, not a semantic source mask. A sampled 16-world-pixel-wide approach corridor has no transparent gaps. The B01 road/landing overlap remains exactly 4,251 pixels; its original 20×145 opaque corridor remains gap-free.

Inspected live `/garden-test` closeup, arch-hidden view and normal full-Garden view. Landmarks were restored afterward. Water, B01, Main Entrance, all other circulation and landmark source artwork/transforms were not changed.

## Review provenance

01 uses the actual prior approved runtime capture from `entrance_edge_v1/source/runtime_arch_on.png`; baseline hashes confirmed its artwork was unchanged before this pass. 02 and 03 use the newly captured live runtime with identical camera/crop for 01/02. 06 is a native-size crop of the normal runtime; 07 is the full runtime capture.

04 is explicitly a source-layer diagnostic, not a screenshot: actual runtime-aligned RGB within the walking interior, with surrounding edge vegetation and arch omitted from display. Small vegetation baked into protected pavement remains. It does not repaint source assets. The actual arch-OFF screenshot is retained at `source/runtime_arch_off.png`.

05 displays actual opaque source masks with paving color classification, including both overlap regions. The generated local source, exact prompt, build script and verification script are retained. Image generation supplied only the new local artwork; approved source PNGs were preserved.

Review files are in `review/`. Stop for visual approval; no checkpoint or vegetation phase.
