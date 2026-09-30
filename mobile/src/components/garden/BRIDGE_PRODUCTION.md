# Camera orbit authoring

The approved restored proxy is sourced read-only from
Resources/decorations/bridge/blender/bridge_master.before-authoring.blend.
The working bridge_master.blend still contains the rejected shortened geometry;
it is intentionally untouched. No Blender files are saved by this workflow.
The root in the restored source is named Bridge_World_Yaw. Its name is historical:
no root transform, geometry, or path is changed by the orbit renderer.

Camera target (BridgeCenter): (0, 0, 0.4). Horizontal radius: 12.
Elevation: 55 degrees, locked. Orthographic scale: 7.8.
Azimuth 0 uses the restored camera direction, with camera Y negative.
X = 12 sin(a), Y = -12 cos(a), Z = 0.4 + 12 tan(55 degrees).
Camera always looks at the same target. Output: 1536 x 1280 transparent RGBA.
Existing lighting and all bridge objects remain fixed in world space.

From the repository root, start the local DEV helper:

```powershell
python Resources/decorations/bridge/blender/render_bridge_view.py --serve
```

Open http://localhost:8082/garden-test > DEV Controls > BRIDGE TEST.
Enter Camera Azimuth (arbitrary decimals, wrapping 0-360), or use +/-5, +/-1,
+/-0.1. Click RENDER / UPDATE VIEW once. Editing inputs does not render.
The helper binds only 127.0.0.1:8766 and accepts requests from the local 8082
preview. Metro refreshes the PNG and metadata without changing placement/path
state. The panel displays requested and rendered azimuth separately.
The helper is development-only; it is not a production server or app dependency.
Stop it with Ctrl+C. For a standalone render without the helper:

```powershell
python Resources/decorations/bridge/blender/render_bridge_view.py --azimuth 37.5
```

Current output: Resources/decorations/bridge/rendered/bridge_current_view.png
and bridge_current_view.json, with matching copies under mobile/assets/garden.
The existing bridge_camera_55 PNG/JSON and bridge-main.png remain untouched.
The new placement baseline is X 1722, Y 1342, uniform scale 0.1753.
Local path values continue to come from the restored metadata. Only projection
vectors/markers change with the camera. No CSS/Skia bitmap rotation occurs.
Manual placement/path edits remain session-only; export before a full reload.

Verification-only 0/45/90/135 PNGs and JSON live in rendered/orbit_verification.
They are not a selectable angle library. The command --verify regenerates
these four tests without replacing the current runtime view. All four have an
identical fixedGeometrySha256 and fixedBridgeTransform. Those checks include
mesh coordinates/topology, curve points and local transforms of the root and
all its descendants. The exporter also checks protected source file hashes.
Run node scripts/verify-bridge-sprites.cjs and npx tsc --noEmit from mobile.
