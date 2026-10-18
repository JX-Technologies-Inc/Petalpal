from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json,shutil
R=Path(__file__).resolve().parent
G=Path('C:/Users/cjysu/.codex/generated_images/01a0e920-8626-7cc1-aa96-c0a2908bc06d')
names={'1.33':'exec-1c10273f-21af-4299-9f6d-93294f8e1eb8.png','1.66':'exec-49e4a1d3-6ea6-40ab-a5a1-40c380d9afbf.png','2.33':'exec-640d24f6-b925-4df1-8001-496c15685d74.png','2.66':'exec-27195a5e-3ec8-48d9-98b7-686ac79aa321.png'}
(R/'rejected_attempts').mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks={}
for label,name in names.items():
 p=R/'rejected_attempts'/f'frame_{label}.png';shutil.copy2(G/name,p)
 im=Image.open(p);checks[label]={'status':'FAILED','size':im.size,'mode':im.mode,'alpha_extrema':im.getchannel('A').getextrema() if 'A' in im.getbands() else None,'sha256':sha(p),'neighbors':['1','2'] if label.startswith('1') else ['2','3'],'reason':'Design/shoe scale and registration drift; ankle exposure; temporal position not established.'}
checks['2.33']['reason']+=' Lifted-foot side contradicts neighboring anchors.'
shutil.copy2(G/'exec-dff97ebb-125b-42aa-8248-92cca10718b1.png',R/'rejected_attempts/frame_1.33_retry.png')
items=[('1',R/'references/anchor_01.png'),('1.33',R/'rejected_attempts/frame_1.33.png'),('1.66',R/'rejected_attempts/frame_1.66.png'),('2',R/'references/anchor_02.png'),('2.33',R/'rejected_attempts/frame_2.33.png'),('2.66',R/'rejected_attempts/frame_2.66.png'),('3',R/'references/anchor_03.png')]
sheet=Image.new('RGB',(370*7,480),'#eeeae5');d=ImageDraw.Draw(sheet)
for i,(label,p) in enumerate(items):
 im=Image.open(p).convert('RGBA');im.thumbnail((370,430),Image.Resampling.LANCZOS)
 x=i*370+(370-im.width)//2;sheet.paste(im,(x,35),im)
 d.text((i*370+10,10),label+(' | LOCKED reference crop' if '.' not in label else ' | FAILED generated attempt'),fill='#48374f')
sheet.save(R/'comparison_FAILED.png')
master=R.parents[1]/'review/approved_gait_fairy_8keyframes_v2/fairy_keyframe_sheet.png'
manifest={'status':'FAILED_FIRST_BATCH_STOPPED','locked_master_sha256':sha(master),'reference_crops':'Unscaled 370x430 RGB crops from locked sheet, not transparent production anchors. No source overwrite.','comparison':'Generated images uniformly reduced ONLY for review thumbnails; raw attempts unchanged. Not registered production frames.','frames':checks}
(R/'validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
(R/'REPORT.md').write_text('''# First four in-betweens — FAILED review gate

Only 1.33, 1.66, 2.33 and 2.66 were attempted, each in a separate image-generation request using only its two neighboring approved reference crops. One additional isolated retry of 1.33 also failed. No later intervals were generated.

All four initial outputs have design and shoe-proportion drift, exposed ankles and incompatible raw canvas/registration. 2.33 also lifts the wrong screen-side foot relative to anchors 2 and 3. Their one-third/two-thirds temporal positions are not verified. These are rejected attempts, not production in-betweens.

The PNGs contain alpha, but alpha-channel presence does not establish clean edges: pale/colored edge residue remains a visual concern. No background-keying or optical-flow substitute was applied.

The locked RGB sheet remains untouched. References are unscaled crops; generated images are reduced only in the comparison for inspection, not certified aligned. The source hash is recorded in validation.json. No approved anchor was replaced, no animation sequence was assembled, and no application integration occurred.
''',encoding='utf-8')
print(json.dumps(checks,indent=2))
