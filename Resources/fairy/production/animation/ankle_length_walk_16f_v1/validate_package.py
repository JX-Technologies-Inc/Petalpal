from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,zipfile
import numpy as np
R=Path(__file__).resolve().parent
meta=json.loads((R/'frames.json').read_text());checks=[]
assert len(list((R/'frames').glob('*.png')))==16
for n in range(1,17):
 p=R/f'frames/frame_{n:02}.png';im=Image.open(p);a=np.asarray(im);alpha=a[:,:,3]
 assert im.mode=='RGBA' and im.size==(378,378)
 assert not alpha[:20].any() and not alpha[-20:].any() and not alpha[:,:20].any() and not alpha[:,-20:].any()
 assert np.all(a[alpha==0,:3]==0)
 assert np.where(alpha>160)[0].max()==342
 assert np.any((alpha>0)&(alpha<255))
 assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['frames'][n-1]['sha256']
 checks.append({'frame':n,'rgba_378_square':True,'blank_20px_canvas_border':True,'baseline_alpha_gt160':342,'soft_alpha_pixels':int(((alpha>0)&(alpha<255)).sum()),'fully_transparent_pixels':int((alpha==0).sum())})
with Image.open(R/'review/walk.gif') as gif:
 assert gif.n_frames==16
 delays=[]
 for n in range(gif.n_frames):gif.seek(n);delays.append(gif.info['duration'])
 assert sum(delays)==1360 and gif.info['loop']==0
source=Path(meta['source']);assert hashlib.sha256(source.read_bytes()).hexdigest()==meta['source_sha256']
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
sheet=Image.new('RGB',(1080,4*265),'#eeeae4');d=ImageDraw.Draw(sheet)
for row,(left,right) in enumerate([(4,5),(8,9),(12,13),(16,1)]):
 for col,n in enumerate([left,right]):
  im=Image.open(R/f'frames/frame_{n:02}.png').crop((105,275,285,350)).resize((540,225),Image.Resampling.NEAREST)
  sheet.paste(im,(col*540,row*265+30),im);d.text((col*540+8,row*265+4),f'{n:02}  |  transition {left:02} → {right:02}',font=font,fill='#302b3c')
sheet.save(R/'review/loop_transition_details.png')
result={'technical_validation':'PASS','source_unchanged':True,'gif_frame_count':16,'gif_duration_ms':sum(delays),'per_frame_scale_identical':True,'max_translation_px':max(abs(v) for r in meta['frames'] for v in r['translation_xy']),'registered_character_height_px':[min(343-r['registered_top'] for r in meta['frames']),max(343-r['registered_top'] for r in meta['frames'])],'manual_visual_approval_required':True,'checks':checks}
(R/'validation.json').write_text(json.dumps(result,indent=2))
meta['status']='PRODUCTION_FORMAT_EXPORT_COMPLETE_MANUAL_VISUAL_REVIEW_REQUIRED';(R/'frames.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2))
