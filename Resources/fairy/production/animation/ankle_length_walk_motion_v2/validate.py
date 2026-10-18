from pathlib import Path
import json,hashlib
from PIL import Image
R=Path(__file__).resolve().parent
m=json.loads((R/'frames.json').read_text())
assert len(m['frames'])==48
assert sum(f['duration_ms'] for f in m['frames'])==1440
for f in m['frames']:
 p=R/f['file'];im=Image.open(p)
 assert im.mode=='RGBA' and im.size==(378,378)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
assert hashlib.sha256(Path(m['source']).read_bytes()).hexdigest()==m['source_sha256']
g=Image.open(R/'review/walk_48f.gif');assert g.n_frames==48
total=0
for i in range(g.n_frames):g.seek(i);total+=g.info['duration']
assert total==1440
v=json.loads((R/'validation.json').read_text())
assert v['analytic_loop_endpoint_equal'] and v['max_analytic_stance_drift_px']<1e-6
assert v['unique_frames']==48 and v['empty_canvas_border']
v['visual_status']='FAILED; exact ranges and limitations in REPORT.md'
v['gif_frames']=48;v['gif_duration_ms']=total
(R/'validation.json').write_text(json.dumps(v,indent=2)+'\n')
m['status']='FAILED_VISUAL_GATE_REVIEW_ONLY'
(R/'frames.json').write_text(json.dumps(m,indent=2)+'\n')
print('PASS technical exports and source preservation; FAILED visual gate.')
