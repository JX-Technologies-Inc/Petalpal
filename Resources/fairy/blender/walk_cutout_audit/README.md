# Blender cutout walk feasibility — blocked by source coverage

## Decision

The existing 18 images cannot support the requested clean alternating walk with independent limb, wing and skirt movement while preserving appearance and forbidding hidden-area painting. Do not build a production walk from these masks. This is an asset-coverage finding, not a Blender limitation. No rig, animation or rendered sequence was created.

Blender at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` successfully reported **5.2.2 LTS**. Unlike the currently blocked manual Spine Trial path, a Blender Python workflow could build and save the armature, textured meshes, keyframes and review outputs without manual editor work. However, changing software cannot recover occluded painted anatomy.

Proposed eventual Blender implementation: fixed orthographic camera, one source-aligned textured mesh per repaired layer, explicit depth order, unlit image materials, armature weights from the CSV hierarchy, rigid shoes and controlled joint blends, transparent output. Color management and alpha-edge rendering would need comparison against the source before approval. Blender's Armature modifier deforms meshes using bone/vertex-group weights; it does not supply missing image content. [Official Armature documentation](https://docs.blender.org/manual/en/4.5/modeling/modifiers/deform/armature.html)

## Evidence

`audit.py` rereads the first approved master and original layers, verifies exact visible RGBA/rest alpha, and produces source-pixel-scale diagnostic panels. No source asset is changed. All layers are exclusive pixel partitions: **zero overlapping visible pixels**. This alone does not forbid every small deformation, but provides no hidden joint coverage; the specific gaps and mixed ownership below block clean independent articulation.

See `leg_coverage.png` and `joint_coverage.png`. The panels are diagnostic crops only; original images retain their full canvas. Screen-left/right naming follows the existing manifest.

## Exact affected layers

| Layer(s) | Observed issue | Required repair before independent animation |
|---|---|---|
| `leg_left.png` | Disconnected lower leg/shoe, small detached pixels and costume fragments; no continuous painted upper leg through the proposed hip/knee chain. | Replace the mask with anatomical ownership for all existing visible leg pixels; remove dress fragments. Supply an approved hidden upper-leg/knee continuation only where separated walk poses expose it. The missing portion cannot be obtained by stretching the calf. |
| `leg_right.png` | Main visible near leg is present, but the cut follows the crossed-leg standing silhouette; fabric slivers are included and hidden inner/upper contours are absent. | Reassign costume pixels to dress; extend occluded hip/inner-leg coverage as required by passing/contact poses. Keep the complete existing shoe and skin unchanged. |
| `dress_base.png` | Contains visible skin/leg fragments as well as separate fabric fragments (visible in leg diagnostic panel). It is not a complete underdress. | Reassign visible skin to the corresponding leg using the approved master; establish an approved underlap beneath independently moving petals where currently absent. |
| `dress_front_petals.png` | Includes bodice/waist and the main front skirt as one cutout, rather than independent lower petals. | Keep upper costume pinned. For actual independent petal motion, re-extract along painted boundaries and provide underlap only where movement reveals missing backing. Do not rotate the entire bodice as skirt motion. |
| `dress_side_petals.png`, `dress_back_petals.png` | Side cutout and catch-all residual partition, not complete independently overlapping petals. | Correct visible ownership first; supply approved covered petal-root/edge extensions if independent drift opens holes. Their current resting fit does not establish moving overlap. |
| `arm_left_upper.png`, `arm_left_lower.png` | Hard complementary elbow cut; arm pixels and sheer costume travel together. | For counter-swing, preserve visible paint but add an approved covered elbow/shoulder overlap and separate costume ownership where needed. Can remain fixed for a legs-only feasibility test. |
| `arm_right_upper.png`, `arm_right_lower.png` | Upper piece is predominantly costume/visible sliver rather than a complete upper arm; lower arm is present but no hidden joint cap exists. | Requires approved shoulder/upper-arm/elbow coverage before meaningful independent arm movement. Do not infer a complete limb from the existing polygon. |
| `body_base.png` | Only visible neck/chest and fragments; not a complete torso behind shoulders/dress. | Can stay fixed with torso artwork. Any motion uncovering shoulders/chest needs covered backing, not a stretched chest fragment. |
| `wing_left.png`, `wing_right.png` | Visible wing fragments end at occluder cuts, with no concealed root overlap; right wing panel also includes a skin-colored boundary fragment. | Re-extract clean visible wing ownership; add approved covered root continuation for rotation, or restrict deformation to outer tips with roots fixed. Root rotation of the current cutouts is not assumed safe. |

`head_face.png`, `hair_back.png`, `hair_front.png`, `braided_updo.png` and `flower_accessory.png` need no replacement for this walk if kept together as one rigid identity-preserving group. This does not certify independent head/hair movement.

## What can be fixed without painting, and what cannot

Visible pixel misassignment can be corrected by lossless re-partitioning of the approved master. That is a mask repair, not new artwork, but it does not reveal what was occluded. The rear leg hidden by the near leg and costume is the principal irreducible blocker. Alternating leg separation needs that missing contour. A mesh could only expose a hole or stretch unrelated pixels into it; neither preserves the approved appearance.

Exact extension shapes and pixel widths cannot be truthfully specified until approved contact/passing poses are defined. The rows above identify the affected files and boundaries; they are not authorization to invent anatomy. No extensions were painted during this audit.

The pivot CSV remains a proposed hierarchy only. Its hip/knee coordinates do not prove that the corresponding layer has image coverage. Do not compensate by independently rescaling body parts, hiding the legs permanently, or translating the unchanged standing pose.

## Outputs and validation

Created only this isolated audit directory:

- `audit.py`
- `audit.json` (hashes, exact rest checks, overlap count and leg coverage measurements)
- `leg_coverage.png`
- `joint_coverage.png`
- this `README.md`

Source hashes unchanged. Exact resting alpha and visible RGBA passed. No approved assets, GardenScene, Expo integration, Spine preparation files or Fairy implementation were modified. No `.blend` file or animation preview is claimed. Stop at this source-readiness gate.
