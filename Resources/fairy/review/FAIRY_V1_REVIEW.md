> **DEPRECATED: Blender Fairy V1/V2 are historical experiments and must not be used as future visual references.** The approved design is `Resources/Icon/fairy structure.png`; follow [the 2D production plan](../production/README.md). Historical review text below does not imply current approval or authority.

# Fairy V1 → V2 — SE prototype gates

## V2 visual review — current prototype, not approved

V2 **opens and revises the existing `fairy_v1.blend`**, preserving the V1 file and renders. Deliverables: `../blender/fairy_v2.blend`, `fairy_v2_SE.png`, and `fairy_v2_SE_runtime_preview.png`.

Short V1→V2 summary:

- Head and hair group enlarged **10%** about the neck attachment. The crown braid is raised and thickened so its interwoven outline is more visible; the low braided bun has slightly more relief. Purple-black hair and restrained lavender highlights remain.
- Crocus feature scale **+20%** relative to V1, independently of the head scale. Six petals now form an upright cupped bloom instead of a radial pinwheel; the flower sits on the near temple, turned outward, with three visible pale-gold saffron stamens.
- Eye openings narrowed **18%**, with flatter brows and the same neutral closed mouth, for a quieter expression. No expression rig is created.
- Four wing spans reduced **18%** around their existing attachments; membrane alpha **0.43→0.28**, with softer/thinner edges and veins. Camera, lighting and ground pivot remain unchanged.
- Skirt simplified **31→21** broader overlapping petals across three rows. Lavender is more continuous, teal is concentrated in the bodice/sashes and one inner accent petal, and gentle surface gradients replace busy alternating color blocks. Primary `#5AA4AB` / `#A67EB7` materials and pale gold remain.
- Runtime review now prioritizes **96, 108 and 120px nominal standing body height**, not 64px. This updates only the review target; no Garden runtime scale or global production specification is changed.

V2 keeps the 512×512 transparent RGBA master, fixed SE/30° orthographic camera and Cycles 128-sample preset. Evaluated geometry is **32,524 polygons / 64,088 triangles**. Alpha/padding measurements are recorded in `fairy_v2_model_report.json`.

Reproduce with `blender --background --python-exit-code 1 --python Resources/fairy/blender/scripts/revise_fairy_v2.py`, followed by `python Resources/fairy/blender/scripts/create_v2_runtime_preview.py`. Validate by opening `fairy_v2.blend` with `--python-exit-code 1 --python Resources/fairy/blender/scripts/verify_fairy_v2.py`. The revision script always starts from saved V1, never from a previously modified V2.

Remaining limitations: facial detail, braid shading and wing veining remain simplified compared with the painted reference; this pass adds no painted texture maps. Body pieces still need joint cleanup and deformation work before any future rig. Elegance, Garden fit and final character fidelity remain manual visual approval decisions. No armature, animation, atlas, app import or production change is included.

## V1 historical review

**Status: real Blender prototype delivered for manual visual review; not approved.**

Source: `../blender/fairy_v1.blend`, created in Blender **5.2.2 LTS**. Authoritative design sheet: `../../icon/fairy.png`, unchanged. The file links the complete sheet using a relative path; no reference pixels are cropped, embedded in the visible model, or altered.

## Deliverables

- `fairy_v1_SE.png`: one real Cycles render, 512×512 PNG RGBA, transparent world and no floor/contact shadow.
- `fairy_v1_SE_runtime_preview.png`: that same render resampled onto an explicitly opaque neutral review canvas. The left example has nominal standing body height 64px from the existing production specification; the right is 104px for the requested 90–120px readability check. These are scale comparisons, not different models or directions. Neither changes any Garden scale setting.
- `fairy_v1_model_report.json`: measured counts, alpha bounds, padding, camera/pivot and preview scales.

## Editable construction

One `Fairy_ROOT_ground_SE` empty at world origin, Z=0, rotates the bind-facing-south character +45° for SE. No parent/root translation, no actions, no armature, no simulation.

| Collection | Mesh/curve objects | Contents |
|---|---:|---|
| Body | 19 | Quad-ring torso, neck, shaped head, elongated limbs, palms/fingers |
| Face | 20 | Small almond eyes, eyelids/brows, nose, closed neutral lips, ears |
| Hair | 24 | Fitted crown, low updo core, interwoven crown/bun braids, swept fringe and temple tendrils |
| Crocus | 22 | Six pointed lavender petals, three saffron stamens/anthers, fine gold botanical ornament |
| Dress | 62 | Teal bodice, seven neckline petals, slip, 31 overlapping skirt petals in three layers, waist flower and trailing sashes |
| Wings | 50 | Four translucent membranes, matching boundaries, branching pale veins |
| Footwear | 20 | Lavender strapped shoes, small heels, ankle ribbons/flowers |

The build script uses deliberately specified shape paths and proportions for this design. Geometry is editable in Blender, with named quad cages, curves and non-destructive petal thickness/subdivision. Bare sole-to-crown height is 0.995 units; head height is 0.169 units, approximately **5.9 heads tall**. Footwear contacts the Z=0 plane. Root remains the fixed ground anchor, not a visible-image bounding-box center.

Base meshes: **7,906 polygons / 15,260 triangles**, excluding curve tessellation and modifiers. Render-evaluated total: **34,988 polygons / 69,016 triangles**, including curves, subdivision and petal thickness. Source object count is not a proposed runtime node count: eventual sprite playback remains one character draw.

## Camera, light and material preset

- One orthographic camera at `(0,-8,4.618802)`, looking at origin: **30° downward elevation**, roll zero, orthographic scale **1.75**.
- Camera shift calibrated to ground pivot `(0.5,0.875)` in top-origin PNG coordinates, equivalent to `(256,448)` at 512px. Character heading SE=45°; lights/camera do not rotate with the character.
- Cycles, **128 samples**, seed 11, denoising; Standard view transform, exposure 0, gamma 1; PNG RGBA 8-bit, Film Transparent.
- Three broad soft area lights and neutral environment illumination. No cinematic rim light, bloom, floor or baked ground shadow.
- Rough low-specular stylized materials; sRGB palette values converted to scene-linear shader inputs. Dress includes `#A67EB7` and `#5AA4AB`; pale gold is restricted to small ornaments/veins. Hair is purple-black with muted lavender strand planes. Wing membrane alpha 0.43, with higher-alpha fine edges for readability. No emotion material effects.
- Export alpha ranges from 0 to 255. Visible bounds `(143,141)–(315,456)` leave transparent padding left/top/right/bottom **143/141/197/56px**, exceeding the 32px master minimum.

## Known V1 limitations for manual review

This is a simplified 3D interpretation of an intricate painted sheet. It has no hand-painted textures; the face, braided hair and petal surfaces are considerably simpler than the reference illustration. The materials use soft surface shading and discrete color planes, without the reference's fine painterly highlights. Wing veins and shoes are also simplified and some detail disappears at 64px.

The body has semantic quad cages, but limbs, palms and torso remain separate prototype pieces. Future production rigging will require joint welding/retopology and deformation tests, plus skin weights and garment/wing controls. This file is **not a completed animation-ready production character**. There is no claim that the unrigged meshes will deform correctly without that work.

Review hairstyle/accessory placement, wing asymmetry in the fixed SE projection, skirt layering, proportions, material softness and small-scale fidelity before approving further work. The 64px/104px preview exposes the existing spec-versus-request size difference; no production-size decision is silently made here.

## Reproduction and validation

Run from the repository root, using the installed Blender executable:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python Resources/fairy/blender/scripts/create_fairy_v1.py
python Resources/fairy/blender/scripts/create_runtime_preview.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background Resources/fairy/blender/fairy_v1.blend --python-exit-code 1 --python Resources/fairy/blender/scripts/verify_fairy_v1.py
```

The first command intentionally replaces this V1 source and its review render from the authored script. Preserve manual Blender edits in a separate revision before regenerating. Preview creation requires Pillow. Neither script changes the reference or application source.

Saved-file validation checks Blender version, renderer, RGBA, pivot, resolution, reference-link resolution, mesh counts and absence of actions/armature. SHA-256 comparison against the pre-task capture verifies the reference and all pre-existing `mobile/src` files unchanged. No animations, other directions, atlases, app imports or production Garden changes are included. **Stop at this visual gate.**
