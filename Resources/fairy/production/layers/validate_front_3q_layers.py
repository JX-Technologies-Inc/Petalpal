"""Independent checks for the aligned reconstructed package; no art changes."""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image

base=Path(__file__).resolve().parents[1];out=base/'layers/front_3q';repo=base.parents[2]
required={x+'.png' for x in ['body_base','head_face','hair_back','hair_front','braided_updo','flower_accessory','wing_left','wing_right','arm_left_upper','arm_left_lower','arm_right_upper','arm_right_lower','dress_base','dress_front_petals','dress_side_petals','dress_back_petals','leg_left','leg_right']}
assert {p.name for p in out.glob('*.png')}==required
manifest=json.loads((out/'layers.json').read_text(encoding='utf-8'))
assert manifest['canvas']==[1024,1024] and manifest['root']==[512,896]
assert manifest['source_scale']==1 and manifest['source_rotation_degrees']==0
assert manifest['source_translation']==[-171,210]
assembled=Image.new('RGBA',(1024,1024))
for entry in manifest['layers_back_to_front']:
    assert entry['offset']==[0,0]
    im=Image.open(out/entry['file']);assert im.mode=='RGBA' and im.size==(1024,1024)
    a=np.asarray(im)[:,:,3];assert np.any(a>0) and np.any(a==0)
    assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any()
    assembled=Image.alpha_composite(assembled,im)
assert np.array_equal(np.asarray(assembled),np.asarray(Image.open(base/'review/front_3q_recomposed.png')))
bounds=assembled.getchannel('A').getbbox()
assert min(bounds[0],bounds[1],1024-bounds[2],1024-bounds[3])>=64
source_path=base/'master/fairy_approved_structure.png'
assert hashlib.sha256(source_path.read_bytes()).hexdigest()==manifest['source_sha256']
original=np.asarray(Image.open(source_path))
comp=np.asarray(assembled);ys,xs=np.where(comp[:,:,3]==255)
dx,dy=manifest['source_translation']
assert np.array_equal(comp[ys,xs,:3],original[ys-dy,xs-dx,:3])
protected=json.loads((base/'layers/archive/front_3q_cleanup_v002_protected_hashes.json').read_text(encoding='utf-8'))
for name,expected in protected.items():
    p=repo/name;assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==expected,name
assert not list((base/'animation').rglob('*.png'))
result={'revision':'v002_alpha_cleanup','layer_count':18,'all_rgba':True,'all_canvas':[1024,1024],
        'all_offsets':[0,0],'source_scale':1,'source_rotation':0,'root':[512,896],
        'visible_bounds':bounds,'recomposition_byte_equal':True,'transparent_canvas_borders':True,
        'minimum_transparent_padding_px':min(bounds[0],bounds[1],1024-bounds[2],1024-bounds[3]),
        'opaque_visible_source_rgb_exact':True,'opaque_pixels_compared':len(xs),
        'master_and_application_source_hashes_unchanged':True,'animations_created':0,
        'visual_approval':False,
        'halo_validation':'V002 reduces V001 coarse paper residue and cloth discontinuities; fine-edge tint/translucency requires manual visual review, not an automated halo-free guarantee',
        'color_validation':'Opaque visible RGB is byte-exact to approved source; translucent foreground/alpha are reconstructed estimates',
        'overlap_scope':'Conservative 4–8 native-pixel hidden support only; large deformations require additional overlap authoring',
        'matting_metrics':manifest['matting_metrics']}
(out/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
