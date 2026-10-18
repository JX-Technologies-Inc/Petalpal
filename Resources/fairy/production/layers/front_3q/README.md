# Approved Fairy front_3q — aligned layer reconstruction review package

Status: **18 aligned reconstructed layers, revision V002, delivered for visual approval.** No animation has been created. This revision improves the earlier pale-paper residue and abrupt cloth matte transitions. Fine hair/cloth edge treatment and recovered translucency still require visual approval; this is not a claim of pixel-identical recovery of unavailable original alpha or certification for arbitrary deformation.

## Files and alignment

All 18 requested PNGs are RGBA, **1024×1024**, and are composited at **(0,0)** in the back-to-front order in `layers.json`. No layer is cropped, scaled or rotated. The original front_3q source pixels are translated once by **(-171,+210)** from the presentation sheet; source scale remains exactly 1. The source stance point `(683,686)` maps to the common root **(512,896)**. Visible bounds are `(416,375)–(605,897)`, safely inside the canvas. The one-pixel extension near the sole is edge alpha, not a change to the foot anchor.

Required layers: body_base, head_face, hair_back, hair_front, braided_updo, flower_accessory, wing_left, wing_right, arm_left_upper, arm_left_lower, arm_right_upper, arm_right_lower, dress_base, dress_front_petals, dress_side_petals, dress_back_petals, leg_left, leg_right.

Anatomical side naming is inferred from the approved front_3q pose: the near/screen-left arm is named character-right. The crossed-leg assignment and joint guides should be reviewed before motion authoring.

## Source preservation and reconstruction

Authority: `../../master/fairy_approved_structure.png`, SHA-256 `86eed8eb748ced65bf6215fab48224b9e05bb8be50c213eb287d54ec0bf270b8`.

The visible painting comes directly from that source. No pixels from the rejected image-generation candidate or deprecated Blender models are included. The user explicitly authorized Python pixel masking, transparency repair and compositing after the generated extraction failed its appearance/alignment checks.

- Hand-authored semantic masks separate the native-resolution painting.
- Original visible RGB is preserved exactly wherever the resulting alpha is 255. No hue, saturation, lighting, face, pose or costume redesign pass is applied.
- Alpha is reconstructed with a semantic trimap and [closed-form matting](https://pymatting.github.io/alpha.html), followed by [multi-level foreground estimation](https://pymatting.github.io/foreground.html). This replaces V001's threshold/closing transitions and its bounded unmatting that left pale residue. Skin interiors are explicitly protected.
- Continuous wing membranes and trailing petal surfaces have conservative alpha constraints, so pale painted areas are not mistaken for empty paper. These constraints are estimates, not recovered original alpha. Foreground estimation removes the paper contribution from translucent pixels; **zero color drift cannot be guaranteed for those reconstructed pixels**. No hue/saturation or global palette adjustment is applied.
- Hidden support extends adjacent original painted colors by at most **4 source pixels**, or **8 pixels** for selected body/head/hair/upper-arm joints. Support stays inside the named semantic region and beneath an already fully opaque higher layer. It cannot change the resting recomposition.
- These are conservative seam guards, not completed hidden body drawings. They can support small motion experiments after approval; they are insufficient for arbitrary turns, large arm swings or walk/run articulation. No new anatomy or costume details are invented.

## Review outputs

- `../../review/front_3q_recomposed.png` — transparent resting composite.
- `../../review/front_3q_layer_contact_sheet.png` — all 18 layers, using the same inspection window for every thumbnail. Only review thumbnails are resized; delivered layers remain native/aligned.
- `../../review/front_3q_source_comparison.png` — original source, reconstruction over estimated paper, and neutral-background composite.
- `../../review/front_3q_alpha_background_checks.png` — light/dark/Garden-like green comparisons. **Inspect fine edge tint, translucent cloth and strand boundaries here before approving the reconstructed alpha.**
- `../../review/front_3q_trimap_v002.png` and `front_3q_alpha_v002.png` — matting diagnostics, not runtime sprites.

## Validation scope

Automated checks verify: exact requested file set; common dimensions; RGBA and transparent borders; root/placement metadata; exact recomposition from layer files; unchanged opaque source RGB; unchanged approved source and pre-existing application files; no animation frames or atlas outputs.

Those checks do not prove semantic layer cuts or recovered alpha are artist-approved. The source-derived cutout is itself a reconstruction; equality to it is not a claim of equivalence to an unavailable original PSD. Remaining fine-edge matting and hidden-anatomy limitations are material, not automatically passed by the numeric checks.

Rebuild V002 with `python Resources/fairy/production/layers/build_front_3q_layers_v002.py`. Dependencies were installed in the project-local `output/fairy-layer-tools/pythonlibs` directory: NumPy 2.5.3, Pillow 12.3.0, SciPy 1.18.1, PyMatting 1.1.16 (with Numba 0.68.0 / llvmlite 0.50.0). This deterministically overwrites this reconstruction's layer/review outputs, never the approved master. Preserve any future manual artist edits in a new revision before rebuilding. The original builder remains historical and would regenerate V001.

The entire pre-cleanup package and review outputs are preserved in `../archive/front_3q_before_alpha_cleanup_v002.zip`. Source/application preservation hashes are in the adjacent archive directory. Run `python Resources/fairy/production/layers/validate_front_3q_layers.py` for file, placement, recomposition and preservation checks.

No changes to GardenScene, FairyLayer, the app registry, approved reference, or Blender files. Stop at layer review; no idle/walk/run or sprite atlas is authorized by this package.
