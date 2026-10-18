from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
P=Path(__file__).resolve().parent;c=json.loads((P/'frames.json').read_text());src=np.array(Image.open(P/'source/long_skirt_walk_sheet.png').convert('RGB'));upper=[0,274,545,818,1093,1375,1672];lower=[0,305,552,811,1113,1380,1672]
rows=[]
for i,r in enumerate(c['frames']):
 o=np.array(Image.open(P/'original'/f'frame_{i+1:02d}.png'));a=np.array(Image.open(P/'transparent'/f'frame_{i+1:02d}.png'));assert o.shape==(720,400,3) and a.shape==(720,400,4)
 for y in range(720):
  sy=y+100;bd=lower if sy>=600 else upper;xs=np.arange(bd[i],bd[i+1]);xx=xs+r['translation_x'];valid=(xx>=0)&(xx<400);assert np.array_equal(o[y,xx[valid]],src[sy,xs[valid]])
 assert a[:,:,3].min()==0 and a[:,:,3].max()==255 and not a[624:,:,3].any()
 opaque=a[:,:,3]==255;delta=np.abs(a[:,:,:3].astype(int)-o.astype(int));maxopaque=int(delta[opaque].max());assert maxopaque<=1
 rows.append({'frame':i+1,'original_source_pixels_exact':True,'scale':1,'rgba_canvas':[400,720],'opaque_rgb_max_delta':maxopaque,'labels_region_alpha_zero':True})
gif=Image.open(P/'review/long_skirt_walk.gif');apng=Image.open(P/'review/long_skirt_walk.png');assert gif.n_frames==6 and apng.n_frames==6
ms=0
for i in range(6):gif.seek(i);ms+=gif.info['duration']
assert ms==1200
report={'technical_extraction':'PASS','transparent_matte':'ESTIMATED_REVIEW_CANDIDATE','motion_acceptance':'FAIL_CLEAR_ALTERNATION','source_hash':hashlib.sha256((P/'source/long_skirt_walk_sheet.png').read_bytes()).hexdigest(),'gif_frames':6,'loop_ms':ms,'no_per_frame_scale':True,'frames':rows,'browser_visual_automation_run':False}
(P/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
