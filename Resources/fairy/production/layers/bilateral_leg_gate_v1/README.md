# Bilateral Fairy leg asset gate — candidate V1

**PENDING MANUAL ANATOMICAL / VISUAL REVIEW. Do not resume walk animation from this package until the user approves it.** Walk V3's leg reconstruction is rejected and was not used as an artwork source.

## Authoritative references

- `Resources/fairy/production/master/fairy_first_approved.png`: proportions, resting placement, visible anatomy and both original shoes.
- `Resources/Icon/fairy structure.png`: multi-view structure for concealed anatomy.
- `Resources/Icon/fairy.png`: supporting side/back structure only; its different stylization/proportions do not override the master.

Reference hashes are recorded in `source_hashes.json` and verified unchanged.

## Side identity

LEFT and RIGHT are anatomical, not screen labels:

- `images/leg_left_complete.png`: near leg, original larger screen-right shoe. Its own independently generated reconstruction supplies complete hip/thigh/knee/calf contours. The original near shoe and alpha are restored below source y=1025.
- `images/leg_right_complete.png`: far leg, original narrower screen-left shoe. A separate image-generation edit started from the actual visible far-leg fragments extracted from the master. It reconstructs the concealed far thigh and knee rather than connecting the near thigh to the far shoe. Original far shoe and alpha are restored below y=1025.

Do not directly assume these labels match the previous rig's left/right naming. No rig mapping or animation was changed here.

The selected legs came from separate built-in image_gen calls. No horizontal flip, mirror, reuse of the opposite leg, or V3 reconstructed leg was used. The first right-leg attempt was not selected because its perspective was insufficiently distinct. Full prompts and selected/rejected source images are retained under `sources/`.

## Canvas and repairs

Both final assets are true RGBA PNGs on the same 1254 × 1254 canvas. Source-space registration is recorded in `build_gate.py` and approximate anchors in `manifest.json`. The left source required registration from its generated canvas; the far leg required registration of its concealed joint trajectory. Own-leg skin material supplies conservative hip overlap. Calves are registered to their own original ankle contours before premultiplied blending into the original shoe pixels.

These are reconstructed complete-leg candidates, not pixel-identical copies of all visible leg skin. The master remains untouched. The rest diagnostic checks position and perspective; it does not certify an exact full-body resting recomposition or a production-ready deformation range. That would require a later layer/rig gate after this bilateral gate passes.

## Five requested diagnostics

`review/bilateral_leg_diagnostic_sheet.png` shows:

1. LEFT alone.
2. RIGHT alone.
3. Both legs together at source-aligned resting registration.
4. LEFT forward / RIGHT back, simultaneously visible.
5. RIGHT forward / LEFT back, simultaneously visible.

The last two are static separation tests using the same two independent PNGs. They translate each leg without mirroring, changing its texture, or producing animation frames. They are not a gait simulation or a new 3D viewing angle. Shoe enlargements help compare the distinct original perspectives.

`review/source_vs_bilateral_rest.png` compares the master leg region with the candidate pair without dress occlusion. `sources/side_identity_guide.png` maps each side to its original shoe.

## Validation

`python Resources/fairy/production/layers/bilateral_leg_gate_v1/validate_gate.py`

Technical checks pass:

- identical 1254² canvas, RGBA, real transparent background;
- no canvas-edge cropping;
- each leg's hip, knee, ankle and shoe lie in one connected alpha component;
- no additional component larger than 16 pixels at alpha >16;
- each shoe's visible RGBA and alpha below y=1025 match its own original extraction;
- all three authoritative references unchanged.

Different hashes and independent generation are provenance checks, **not proof of anatomical correctness**. The user must assess laterality, proportions, calf/ankle shading and the reconstructed far thigh using the diagnostic sheet. Status remains PENDING_USER_REVIEW.

No Blender rig, walk animation, GardenScene, Expo integration, approved master or animation_ready_v2 source was modified.
