from pathlib import Path
import json,hashlib,math
import numpy as np
from PIL import Image,ImageDraw
import build
R=Path(__file__).resolve().parent
m=json.loads((R/'frames.json').read_text());checks=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert len(list((R/'frames').glob('*.png')))==64
assert len(list((R/'inbetweens').glob('*.png')))==32
assert len(list((R/'repaired_anchors').glob('*.png')))==32
assert len(list((R/'original_anchors').glob('*.png')))==32
assert len(set(f['sha256'] for f in m['frames']))==64
assert sum(f['duration_ms'] for f in m['frames'])==1360
oldmeta=json.loads((build.S32/'frames.json').read_text())
for i in range(32):
    name=f'frame_{i+1:02}.png'
    assert sha(build.S32/'frames'/name)==oldmeta['frames'][i]['sha256']==m['original_32_hashes'][name]==sha(R/'original_anchors'/name)
old16=json.loads((build.S16/'frames.json').read_text())
for i in range(16):
    name=f'frame_{i+1:02}.png';assert sha(build.S16/'frames'/name)==old16['frames'][i]['sha256']==sha(R/'original_16_anchors'/name)
for f in m['frames']:
    p=R/f['file'];im=Image.open(p);a=np.array(im);al=a[:,:,3]
    assert im.mode=='RGBA' and im.size==(378,378) and sha(p)==f['sha256']
    assert not al[:20].any() and not al[-20:].any() and not al[:,:20].any() and not al[:,-20:].any()
    assert not a[al==0,:3].any()
    assert ((al>0)&(al<255)).any()
    if f['reference_frame_32']:
        orig=np.array(Image.open(R/'original_anchors'/f'frame_{f["reference_frame_32"]:02}.png'))
        mask=np.array(Image.open(R/'masks'/p.name))>0
        assert np.array_equal(a[~mask],orig[~mask])
    checks.append({'frame':f['index'],'alpha_bbox':im.getbbox(),'strong_alpha_bottom':int(np.where(al>160)[0].max()),
                   'visible_near_shoe_pixels':f['visible_near_shoe_pixels'],'visible_far_shoe_pixels':f['visible_far_shoe_pixels']})
gif={}
for name in ['walk_64f.gif','comparison.gif']:
    with Image.open(R/'review'/name) as a:
        assert a.n_frames==64
        dt=[]
        for i in range(a.n_frames):a.seek(i);dt.append(a.info['duration'])
        assert dt==([20]*7+[30])*8 and sum(dt)==1360 and a.info['loop']==0
        gif[name]={'frames':64,'loop_ms':sum(dt)}

parts=json.loads((R/'parts/manifest.json').read_text())['parts']
locking={}
for foot,offset in [('near',0),('far',.5)]:
    L=next(p['sole_length'] for p in parts if p['name']==foot)
    groups={}
    for k in range(1280):
        q=k/640;s=build.gait(q+offset,L)
        if s['contact']=='air':continue
        point=np.array(s['toe'] if s['contact']=='toe' else s['heel']);point[0]+=72*q
        key=(math.floor(q+offset),s['contact']);groups.setdefault(key,[]).append(point)
    maxdrift=max(float(np.ptp(g,axis=0).max()) for g in groups.values())
    assert maxdrift<1e-9
    locking[foot]={'continuous_contact_point_drift_px':maxdrift,'meaning':'analytic heel/forefoot reference, with 72px/cycle root travel; not visible-pixel or visual approval'}

# Show the actual two distinct painted shoes independently from skirt occlusion.
templates=build.make_templates()
sheet=Image.new('RGB',(8*250,8*140),'#ece8e2');d=ImageDraw.Draw(sheet)
for i,f in enumerate(m['frames']):
    near=build.shoe_layer(templates[0],f['near']);far=build.shoe_layer(templates[1],f['far'])
    pair=Image.fromarray(build.unpm(build.over(near,far)))
    panel=Image.alpha_composite(Image.new('RGBA',(378,378),'#ece8e2'),pair).convert('RGB').crop((140,298,265,348)).resize((250,100),Image.Resampling.NEAREST)
    x=i%8*250;y=i//8*140;sheet.paste(panel,(x,y+30));d.text((x+8,y+5),f'{i+1:02} N:{f["near"]["contact"]} F:{f["far"]["contact"]}',fill='#46354f')
sheet.save(R/'review/shoes_without_skirt_diagnostic.png')
statuses=[
 {'gate':'support-foot visual lock','status':'NOT_PASSED','frames':'1–64','reason':'Analytic contact references lock with root travel; visible shoe/hem extraction is not clean enough to certify the painted contacts.'},
 {'gate':'progressive swing trajectory','status':'TECHNICAL_PASS','frames':'9–32 and 41–64','reason':'Continuous rigid-shoe trajectories; no scale/shear; start/end velocity matches root travel.'},
 {'gate':'clear visible near/far role exchange','status':'FAILED','frames':'15–24 and 47–56','reason':'Shoes exchange modeled roles but long-skirt occlusion and extraction joins obscure the visible passing exchange.'},
 {'gate':'natural passing','status':'FAILED','frames':'15–24 and 47–56','reason':'The lifted shoe becomes heavily occluded; close silhouettes/joins do not give a clean, natural passing read.'},
 {'gate':'identical shoe design and scale','status':'TECHNICAL_PASS_VISUAL_LIMIT','frames':'1–64','reason':'Two separate approved source-shoe cutouts use rigid unit transforms. Occlusion/retained opening fragments affect the visible silhouette, so full visual gate is not passed.'},
 {'gate':'stable skirt/clean ankle coverage','status':'FAILED','frames':'1–64, strongest at 9–24 and 33–56','reason':'Original foot-opening cutouts leave notches/short straight joins; small skin-colored opening remnants can be visible. No broad skirt retargeting retained.'},
 {'gate':'no broken-leg appearance','status':'FAILED','frames':'15–24 and 47–56','reason':'No new anatomy was painted, but passing occlusion/opening joins still require repair before approval.'},
 {'gate':'identity preservation','status':'TECHNICAL_PASS','frames':'1–64','reason':'Original painting, no generative redraw; original anchors unchanged separately; repaired anchor pixels outside local masks exact.'},
 {'gate':'no loop snap','status':'FAILED','frames':'64→1','reason':'Shoe curves are periodic with root travel, but the retained source hem/body painting still switches at the restart.'},
 {'gate':'visibly smoother overall than 32','status':'NOT_PASSED','frames':'1–64','reason':'Finer kinematic samples are not sufficient evidence of full-animation improvement. Full-speed human review not completed in this session.'},
]
result={'overall_visual_gate':'FAILED','technical_package_checks':'PASS','original_32_preserved':True,
        'original_16_preserved':True,'all_repaired_anchor_pixels_outside_masks_exact':True,
        'png_count':64,'unique_png_count':64,'frame_duration_ms':21.25,'loop_duration_ms':1360,
        'gif':gif,'analytic_locking':locking,'visual_gates':statuses,'checks':checks,
        'review_method':'Full ordered sequence inspected on light/dark sheets. No claim of observed real-time browser playback; no browser automation used.'}
(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
m['status']='FAILED_VISUAL_GATE_REVIEW_ONLY';(R/'frames.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['checks','visual_gates']},indent=2))
