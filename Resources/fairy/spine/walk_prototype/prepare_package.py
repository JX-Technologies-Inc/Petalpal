"""Prepare/verify only. Does not create a Spine skeleton or animation.
Run with Python + Pillow + NumPy; writes exclusively beside this script.
"""
from pathlib import Path
import csv, hashlib, json, shutil
import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
SOURCE=ROOT/'Resources/fairy/production/layers/first_approved'
MASTER=ROOT/'Resources/fairy/production/master/fairy_first_approved.png'
EXPECTED='c395f4d96c4b3c8848d0f4e63d945bc4d6a3bb7c6c095353827d5c17845fee42'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

# Approximate control pivots, not reconstructed anatomy. Sides are SCREEN sides.
BONES=[
 ('root',None,674,1178),('pelvis','root',655,676),('torso','pelvis',686,422),
 ('chest','torso',662,320),('neck','chest',650,266),('head','neck',650,266),
 ('hair_back','head',585,230),('hair_front','head',650,150),
 ('braided_updo','head',578,239),('flower','head',550,177),
 ('upper_arm_left','chest',587,290),('forearm_left','upper_arm_left',566,438),('hand_left','forearm_left',507,620),
 ('upper_arm_right','chest',748,375),('forearm_right','upper_arm_right',787,491),('hand_right','forearm_right',839,629),
 ('thigh_left','pelvis',629,688),('calf_left','thigh_left',629,842),('foot_left','calf_left',606,1014),
 ('heel_left','foot_left',564,1130),('toe_left','foot_left',644,1142),
 ('thigh_right','pelvis',662,682),('calf_right','thigh_right',686,833),('foot_right','calf_right',699,1025),
 ('heel_right','foot_right',687,1160),('toe_right','foot_right',776,1171),
 ('wing_left','chest',567,357),('wing_right','chest',724,358),
 ('skirt_base','pelvis',686,422),('petals_front','skirt_base',686,422),
 ('petals_side','skirt_base',590,460),('petals_back','skirt_base',655,450),
]
MAPPING={
 'dress_back_petals':'petals_back','wing_left':'wing_left','wing_right':'wing_right',
 'dress_side_petals':'petals_side','dress_base':'skirt_base','body_base':'chest',
 'leg_left':'thigh_left','leg_right':'thigh_right','dress_front_petals':'petals_front',
 'arm_right_upper':'upper_arm_right','arm_right_lower':'forearm_right',
 'arm_left_upper':'upper_arm_left','arm_left_lower':'forearm_left',
 'hair_back':'hair_back','head_face':'head','braided_updo':'braided_updo',
 'hair_front':'hair_front','flower_accessory':'flower',
}

def write_json(name,value):
 (HERE/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')

def main():
 manifest=json.loads((SOURCE/'manifest.json').read_text())
 assert sha(MASTER)==EXPECTED,'Approved master differs: stop before preparing assets.'
 protected=[MASTER]+[SOURCE/l['file'] for l in manifest['layers']]
 protected += [ROOT/p for p in ['mobile/src/components/garden/GardenScene.tsx',
  'mobile/src/components/fairy/FairyLayer.tsx','mobile/src/components/fairy/FairyController.ts',
  'mobile/src/components/fairy/FairySwingTestScene.tsx']]
 before={str(p.relative_to(ROOT)):sha(p) for p in protected}
 image=Image.open(MASTER);src=np.array(image)
 assert image.mode=='RGBA' and image.size==(1254,1254)
 assert len(manifest['layers'])==18
 composite=Image.new('RGBA',image.size);owner_count=np.zeros(src.shape[:2],dtype=np.uint8)
 rows=[]
 for layer in manifest['layers']:
  p=SOURCE/layer['file'];im=Image.open(p);a=np.array(im)
  assert im.mode=='RGBA' and im.size==image.size
  own=a[:,:,3]>0;owner_count+=own.astype(np.uint8)
  assert np.array_equal(a[own],src[own]),'Layer pixels shifted, recolored or alpha modified: '+p.name
  assert a[:,:,3].min()==0 and own.any()
  composite=Image.alpha_composite(composite,im)
  rows.append({'file':p.name,'sha256':sha(p),'mode':'RGBA','canvas':[1254,1254],
   'owned_pixel_rgba_matches_master_at_same_coordinates':True,'visible_pixels':int(own.sum())})
 a=np.array(composite);visible=src[:,:,3]>0
 assert np.array_equal(a[:,:,3],src[:,:,3])
 assert np.array_equal(a[visible],src[visible])
 assert np.all(owner_count[visible]==1) and np.all(owner_count[~visible]==0)
 for name in ['images','reference','review','exports']:(HERE/name).mkdir(exist_ok=True)
 expected={r['file'] for r in rows}
 assert not {p.name for p in (HERE/'images').iterdir()}-expected,'Unexpected files in images; nothing deleted.'
 for row in rows:
  shutil.copyfile(SOURCE/row['file'],HERE/'images'/row['file'])
  assert sha(HERE/'images'/row['file'])==row['sha256']
 shutil.copyfile(MASTER,HERE/'reference/fairy_first_approved.png')
 composite.save(HERE/'review/resting_recomposition.png')
 points={name:(x,y) for name,parent,x,y in BONES}
 bone_rows=[]
 for name,parent,x,y in BONES:
  px,py=points[parent] if parent else (674,1178)
  bone_rows.append({'name':name,'parent':parent,'source_x':x,'source_y':y,
   'spine_world_x':x-674,'spine_world_y':1178-y,'zero_rotation_local_x':x-px,
   'zero_rotation_local_y':py-y,'setup_rotation':0,'setup_scale_x':1,'setup_scale_y':1})
 attachments=[]
 for i,layer in enumerate(manifest['layers']):
  bone=MAPPING[layer['id']];x,y=points[bone]
  bindings=[bone]
  if layer['id'].startswith('leg_'):
   side=layer['id'].split('_')[1];bindings=['thigh_'+side,'calf_'+side,'foot_'+side]
  attachments.append({'draw_order_back_to_front':i,'image':layer['file'],'slot':layer['id'],
   'parent_bone':bone,'attachment_center_local_x':627-x,'attachment_center_local_y':y-627,
   'width':1254,'height':1254,'rotation':0,'scale_x':1,'scale_y':1,
   'recommended_mesh_bindings':bindings})
 for name,records in [('bone_pivots.csv',bone_rows),('layer_attachments.csv',attachments)]:
  with (HERE/name).open('w',newline='',encoding='utf-8') as f:
   writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
 write_json('rig_spec.json',{'status':'SPECIFICATION_ONLY_NOT_A_SPINE_IMPORT_FILE',
  'coordinate_system':'source top-left, x right, y down; Spine root at source (674,1178)',
  'spine_world_formula':['X = sourceX - 674','Y = 1178 - sourceY'],
  'attachment_center_source':[627,627],'initial_root_attachment_center_spine':[-47,551],
  'side_convention':'screen left/right, not presumed anatomical left/right',
  'pivots_are_approximate':True,'bones':bone_rows,'attachments':attachments})
 # Separate annotated reference, never an attachment or source replacement.
 overlay=Image.new('RGBA',image.size,'#e7ebe2');overlay.alpha_composite(image);d=ImageDraw.Draw(overlay)
 for i,(name,parent,x,y) in enumerate(BONES):
  if parent:d.line([points[parent],(x,y)],fill='#157c80',width=2)
  d.ellipse((x-4,y-4,x+4,y+4),fill='#aa2c71');d.text((x+7,y+4),str(i+1),fill='#132828')
 overlay.convert('RGB').save(HERE/'review/pivot_reference.png')
 (HERE/'review/pivot_legend.txt').write_text('\n'.join(f'{i+1}: {name} ({x}, {y})' for i,(name,_,x,y) in enumerate(BONES))+'\n')
 after={str(p.relative_to(ROOT)):sha(p) for p in protected};assert before==after
 write_json('verification.json',{'status':'PASS','approved_master_sha256':EXPECTED,'layers':rows,
  'copy_count':18,'copies_byte_identical':True,'shared_canvas':[1254,1254],
  'registration_offset':[0,0],'source_rotation':0,'source_scale':1,
  'visible_rgba_difference_pixels':0,'alpha_difference_pixels':0,'silhouette_difference_pixels':0,
  'one_source_pixel_owner_per_visible_pixel':True,
  'note':'Layer alpha masks differ by design; each owned alpha and the composited alpha match the master exactly. RGB under alpha zero is not visible and is excluded.',
  'protected_source_and_implementation_hashes':before,'protected_files_unchanged':True,
  'spine_project_created':False,'animation_created':False,'animation_exported':False})
 print('PASS: 18 byte-identical copies, 1254x1254 RGBA, absolute pixel registration, exact visible recomposition/alpha; protected files unchanged.')

if __name__=='__main__':main()
