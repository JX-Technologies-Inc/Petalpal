from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image

R=Path(__file__).resolve().parent
S=R.parent/'ankle_length_walk_16f_v1'
meta=json.loads((R/'frames.json').read_text())
old=json.loads((S/'frames.json').read_text())
motion=json.loads((R/'motion_controls.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert len(list((R/'frames').glob('*.png')))==32
assert len(list((R/'anchors').glob('*.png')))==16
assert len(list((R/'inbetweens').glob('*.png')))==16
assert sum(f['duration_ms'] for f in meta['frames'])==1360
assert [f['label'] for f in meta['frames']]==[s for i in range(1,17) for s in [str(i),f'{i}.5']]
checks=[]
for i in range(16):
    anchor=S/'frames'/f'frame_{i+1:02}.png'
    digest=sha(anchor)
    assert digest==old['frames'][i]['sha256']==meta['anchor_hashes'][anchor.name]
    assert digest==sha(R/'anchors'/anchor.name)==sha(R/'frames'/f'frame_{i*2+1:02}.png')
    mid=R/'inbetweens'/f'frame_{i+1:02}_5.png'
    assert sha(mid)==sha(R/'frames'/f'frame_{i*2+2:02}.png')
    a=np.array(Image.open(anchor));b=np.array(Image.open(S/'frames'/f'frame_{(i+1)%16+1:02}.png'));c=np.array(Image.open(mid))
    assert not np.array_equal(c,a) and not np.array_equal(c,b)
    assert not np.array_equal(c,((a.astype(float)+b)/2).astype(np.uint8))
    m=motion['inbetweens'][i]
    assert m['upper_mesh_inverted_triangles']==0
    assert m['shoe_scale']==[1,1] and m['shoe_rotation_degrees']==0
    assert m['lower_panel_horizontal_scale']==1
    target_l=(np.array(motion['rear_tip_anchors'][i])+motion['rear_tip_anchors'][(i+1)%16])/2
    target_r=(np.array(motion['front_tip_anchors'][i])+motion['front_tip_anchors'][(i+1)%16])/2
    assert np.allclose(target_l,m['rear_tip_midpoint']) and np.allclose(target_r,m['front_tip_midpoint'])
for frame in meta['frames']:
    p=R/frame['file'];im=Image.open(p);a=np.array(im);alpha=a[:,:,3]
    assert im.mode=='RGBA' and im.size==(378,378)
    assert sha(p)==frame['sha256']
    assert not np.any(alpha[:20]) and not np.any(alpha[-20:]) and not np.any(alpha[:,:20]) and not np.any(alpha[:,-20:])
    assert not np.any(a[alpha==0,:3])
    assert np.any((alpha>0)&(alpha<255))
    baseline=int(np.where(alpha>160)[0].max())
    assert 341<=baseline<=343
    checks.append({'label':frame['label'],'mode':'RGBA','canvas':[378,378],'baseline_alpha_gt160':baseline,'soft_alpha_pixels':int(((alpha>0)&(alpha<255)).sum())})
gif_checks={}
for name in ['walk_32f.gif','comparison.gif']:
    with Image.open(R/'review'/name) as im:
        assert im.n_frames==32
        ds=[]
        for i in range(im.n_frames):im.seek(i);ds.append(im.info['duration'])
        assert ds==[40,40,50,40]*8 and sum(ds)==1360 and im.info['loop']==0
        gif_checks[name]={'frames':32,'duration_ms':sum(ds),'loop':True}
html=(R/'index.html').read_text(encoding='utf-8')
assert html.count('data:image/png;base64,')==32
assert 'https://' not in html and '<script src=' not in html
critical={}
for k in [4,12,16]:
    n=(k%16);i=k-1
    critical[str(k)]={}
    for side in ['rear','front']:
        p=np.array(motion[f'{side}_tip_anchors'][i]);q=np.array(motion[f'{side}_tip_anchors'][n]);
        distance=float(np.linalg.norm(q-p))
        critical[str(k)][side]={'anchor_interval_px':round(distance,3),'each_control_substep_px':round(distance/2,3)}
result={'technical_checks':'PASS','visual_status':'MANUAL_REVIEW_REQUIRED_NOT_A_VISUAL_PASS',
    'anchors_byte_identical':16,'new_unique_inbetweens':16,'frame_order_correct':True,
    'png_html_frame_duration_ms':42.5,'loop_duration_ms':1360,'source_anchor_hashes_still_match':True,
    'canvas_unchanged':True,'empty_20px_border':True,'shoe_transform_scale':[1,1],
    'no_optical_flow_or_frame_average':True,'gif':gif_checks,
    'critical_control_travel':critical,'checks':checks,
    'limits':['Control-point interpolation does not prove biological gait or world-space foot locking.',
              'Existing anchor shoe/petal/wing differences persist.',
              'Full-speed perceptual smoothness and loop-snap approval remain manual.']}
(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2))
