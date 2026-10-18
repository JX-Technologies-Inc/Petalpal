"""Independent saved-PNG validation; does not rebuild or alter layer images."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
V1=HERE.parent/'animation_ready_v1'
manifest=json.loads((HERE/'manifest.json').read_text())
names=manifest['draw_order_back_to_front'];assert len(names)==24
assert {p.stem for p in (HERE/'images').glob('*.png')}==set(names)
source=Image.open(ROOT/'Resources/fairy/production/master/fairy_first_approved.png').convert('RGBA')
s=np.array(source);visible=s[:,:,3]>0;out=Image.new('RGBA',(1254,1254));changed=[]
for n in names:
    im=Image.open(HERE/'images'/f'{n}.png');assert im.mode=='RGBA' and im.size==(1254,1254)
    out=Image.alpha_composite(out,im)
    if not np.array_equal(np.array(im),np.array(Image.open(V1/'images'/f'{n}.png'))):changed.append(n)
a=np.array(out)
assert np.array_equal(a[:,:,3],s[:,:,3])
assert np.array_equal(a[visible],s[visible])
assert np.array_equal(a,np.array(Image.open(HERE/'review/resting_recomposition.png')))
diff=np.zeros_like(s);diff[:,:,:3]=np.clip(np.abs(a[:,:,:3].astype(int)-s[:,:,:3].astype(int))*32,0,255);diff[~visible,:3]=0;diff[:,:,3]=255
Image.fromarray(diff).save(HERE/'review/rest_difference_x32.png')
for n in manifest['unchanged_byte_identical_layers']:
    assert (HERE/'images'/f'{n}.png').read_bytes()==(V1/'images'/f'{n}.png').read_bytes()
for path,expected in manifest['source_hashes'].items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected
probes=[]
for test in manifest['diagnostics']:
    im=Image.open(HERE/'review'/f"{test['name']}.png");a=np.array(im);assert im.mode=='RGBA' and im.size==(1254,1254)
    # The approved source itself has four alpha=1 bottom-border residue pixels.
    # Preserve them; require no new border coverage rather than erase source data.
    assert np.array_equal(a[0,:,3],s[0,:,3]) and np.array_equal(a[-1,:,3],s[-1,:,3])
    assert np.array_equal(a[:,0,3],s[:,0,3]) and np.array_equal(a[:,-1,3],s[:,-1,3])
    assert not np.array_equal(a,np.array(out)), 'Diagnostic must contain an actual pose change'
    joint_values={}
    for label,(x,y) in {'knee_left':(629,842),'knee_right':(686,833),'elbow_left':(566,438),'elbow_right':(787,491)}.items():
        # Compact center probes supplement visual review; they do not certify
        # every silhouette pixel or arbitrary future motion.
        alpha=a[y-2:y+3,x-2:x+3,3]
        joint_values[label]=int(alpha.min())
        assert np.all(alpha>200),(test['name'],label,int(alpha.min()))
    probes.append({'test':test['name'],'joint_center_min_alpha':joint_values,'canvas_not_clipped':True})
backgrounds=Image.new('RGB',(1254*3,1254))
for j,color in enumerate(['#eef0ed','#222830','#687582']):
    panel=Image.new('RGBA',source.size,color);panel.alpha_composite(out);backgrounds.paste(panel.convert('RGB'),(j*1254,0))
backgrounds.save(HERE/'review/rest_alpha_background_checks.png')
sheet=Image.new('RGB',(6*260,4*285),'#687582');draw=ImageDraw.Draw(sheet)
for i,n in enumerate(names):
    im=Image.open(HERE/'images'/f'{n}.png');im.thumbnail((250,250));x=i%6*260;y=i//6*285;sheet.paste(im,(x,y),im);draw.text((x+3,y+253),n,fill='white')
sheet.save(HERE/'review/layer_contact_sheet.png')
# Refresh inspection closeups from FINAL saved diagnostics, not earlier attempts.
close=Image.new('RGB',(1500,1150),'#687582');draw=ImageDraw.Draw(close)
for i,t in enumerate(manifest['diagnostics']):
    n=t['name'];im=Image.open(HERE/'review'/f'{n}.png');crop=im.crop((530,740,800,1185))
    close.paste(crop,(i*300,25),crop);draw.text((i*300+4,5),n,fill='white')
    if i>=2:
        crop=im.crop((475,275,870,690));close.paste(crop,((i-2)*420,550),crop)
close.save(HERE/'review/joint_closeups.png')
dress=Image.open(HERE/'images/dress_base.png');canvas=Image.new('RGB',(1254,1254),'#687582');canvas.paste(dress,(0,0),dress)
canvas.crop((500,620,815,1190)).resize((630,1140)).save(HERE/'review/dress_ownership_check.png')
close.crop((0,0,1500,500)).save(HERE/'review/knee_and_dress_check.png')
report={'status':'PASS_FOR_DOCUMENTED_RESTRAINED_TESTS_PENDING_USER_REVIEW',
 'layer_count':24,'canvas':[1254,1254],'all_rgba':True,
 'rest_visible_rgba_different_pixels':0,'rest_alpha_different_pixels':0,
 'input_hashes_unchanged':True,'corrected_layers':changed,
 'byte_identical_identity_layers':manifest['unchanged_byte_identical_layers'],
 'diagnostic_joint_probes':probes,
 'visual_review':'Five final diagnostics inspected: no obvious open knee/elbow/wrist gaps at tested poses. Smooth shared deformation required; not rigid-quad certification.',
 'limits':['No full walk cycle, ground-contact simulation or arbitrary-angle test.',
           'No independent rigid-rotation certification; use shared 60px joint blending.',
           'Original approved source edge characteristics retained.'],
 'blender_rig_created':False}
(HERE/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
manifest['status']=report['status'];manifest['corrected_layers']=changed
(HERE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(report,indent=2))
