from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import json,hashlib
R=Path(__file__).resolve().parent
S=R.parent/'long_skirt_walk_refined_v1'
# Coordinates refer to the unchanged 378x378 source. Screen-side names avoid
# claiming anatomical left/right identity that the source does not establish.
SPECS={
1:[dict(name='screen_left',poly=[(134,307),(169,307),(181,344),(133,344)],pivot=[142,335],axis=[1,0],blend=[308,333]),dict(name='screen_right',poly=[(218,309),(242,309),(268,344),(218,344)],pivot=[225,339],axis=[1,0],blend=[310,332])],
5:[dict(name='rear_visible',poly=[(157,302),(181,302),(183,309),(180,319),(184,326),(194,330),(206,343),(157,343)],pivot=[162,331],axis=[1,0],blend=[305,330]),dict(name='front_visible',poly=[(185,307),(202,307),(237,344),(208,344),(198,333),(188,328),(180,321)],pivot=[189,332],axis=[1,0],blend=[310,332])],
9:[dict(name='screen_left_lifted',poly=[(121,298),(149,298),(151,320),(164,341),(123,341),(121,329)],pivot=[130,317],axis=[0.86,0.510294],blend=[301,329]),dict(name='screen_right',poly=[(219,309),(246,309),(274,344),(219,344)],pivot=[226,339],axis=[1,0],blend=[311,333])],
13:[dict(name='rear_visible',poly=[(162,304),(181,304),(180,315),(183,323),(189,328),(202,344),(162,344)],pivot=[166,332],axis=[1,0],blend=[306,331]),dict(name='front_visible',poly=[(184,306),(203,306),(236,344),(205,344),(193,331),(182,324),(180,317)],pivot=[189,334],axis=[1,0],blend=[309,332])]
}
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
def mask(poly):
 im=Image.new('L',(378,378));ImageDraw.Draw(im).polygon(poly,fill=255);return im
def sample(a,x,y):
 x=np.clip(x,0,377);y=np.clip(y,0,377);x0=x.astype(int);y0=y.astype(int);x1=np.minimum(x0+1,377);y1=np.minimum(y0+1,377);fx=(x-x0)[...,None];fy=(y-y0)[...,None]
 return a[y0,x0]*(1-fx)*(1-fy)+a[y0,x1]*fx*(1-fy)+a[y1,x0]*(1-fx)*fy+a[y1,x1]*fx*fy
def run():
 yy,xx=np.mgrid[:378,:378].astype(float);results=[];all_variants={};hashes={}
 for f in sorted((S/'frames').glob('frame_*.png')):hashes[f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
 for n,specs in SPECS.items():
  original=np.array(Image.open(S/f'frames/frame_{n:02}.png').convert('RGBA'));float_src=original.astype(float)/255;prem=float_src.copy();prem[:,:,:3]*=prem[:,:,3:4]
  union=np.zeros((378,378),bool);foot_masks=[]
  for s in specs:
   # Expand only into distal empty padding, avoiding a feather at the old toe.
   poly=[(x+(10 if x==max(p[0] for p in s['poly']) else 0),y+(10 if y==max(p[1] for p in s['poly']) else 0)) for x,y in s['poly']]
   s['declared_polygon']=poly
   hard=mask(poly);m=np.array(hard)>0;union|=m
   # Feather inward only; the declared polygon includes the ENTIRE margin.
   inner=hard.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(.7));weight=np.array(inner)/255;weight[~m]=0
   foot_masks.append((m,weight));hard.save(R/f"masks/frame_{n:02}_{s['name']}.png")
  Image.fromarray((union*255).astype('uint8')).save(R/f'masks/frame_{n:02}_union.png')
  all_variants[n]=[Image.fromarray(original)]
  for factor in [.90,.85]:
   out=original.copy();foot_report=[]
   for s,(m,weight) in zip(specs,foot_masks):
    dx,dy=s['axis'];norm=np.hypot(dx,dy);dx/=norm;dy/=norm;px,py=s['pivot'];lo,hi=s['blend']
    ankle=smooth((yy-lo)/(hi-lo));u=np.maximum(0,(xx-px)*dx+(yy-py)*dy)
    # Inverse local length compression. Heel reference and proximal calf are
    # stationary. No whole-foot center scale, no whole-leg transformation.
    shift=(1/factor-1)*u*ankle*weight
    sx=xx+shift*dx;sy=yy+shift*dy
    # Protect occlusion boundary: never pull pixels from another foot.
    if n in (5,13):
     sm=sample(m.astype(float)[...,None],sx,sy)[:,:,0]
     source_alpha=sample(float_src[:,:,3:4],sx,sy)[:,:,0]
     # Empty distal canvas is allowed: sampling it removes the old toe, rather
     # than leaving a detached fragment. Guard only painted occlusion pixels.
     shift*=smooth(np.maximum(sm,1-source_alpha));sx=xx+shift*dx;sy=yy+shift*dy
    q=sample(prem,sx,sy);rgba=np.zeros_like(q);rgba[:,:,3]=q[:,:,3];np.divide(q[:,:,:3],q[:,:,3:4],out=rgba[:,:,:3],where=q[:,:,3:4]>1e-8)
    v=np.rint(np.clip(rgba,0,1)*255).astype('uint8')
    changed_region=m&(shift>1e-5);out[changed_region]=v[changed_region]
    foot_report.append({'foot':s['name'],'pivot':s['pivot'],'axis':s['axis'],'blend_y':s['blend'],'max_inverse_sample_displacement_px':float(shift.max()),'changed_pixels':int(np.any(out!=original,axis=2)[m].sum())})
   diff=np.any(out!=original,axis=2);outside=int((diff&~union).sum());assert outside==0
   im=Image.fromarray(out);im.save(R/f'variants/{int(factor*100):03}/frame_{n:02}.png');all_variants[n].append(im)
   results.append({'frame':n,'length_target':factor,'outside_mask_changed_pixels':outside,'changed_pixels':int(diff.sum()),'calf_above_y_298_unchanged':bool(np.array_equal(out[:298],original[:298])),'feet':foot_report})
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19)
 for kind in ['full','feet']:
  cw,ch=(378,415) if kind=='full' else (640,310)
  sheet=Image.new('RGB',(cw*3,ch*4),'#e6e6e3');d=ImageDraw.Draw(sheet)
  for row,(n,ims) in enumerate(all_variants.items()):
   for col,im in enumerate(ims):
    title=f"Frame {n:02} — {['Original','90% target','85% target'][col]}";x=col*cw;y=row*ch;d.text((x+12,y+8),title,fill='#3e344a',font=font)
    if kind=='full':display=im
    else:display=im.crop((120,285,280,350)).resize((640,260),Image.Resampling.NEAREST)
    sheet.paste(display,(x,y+35),display)
  sheet.save(R/f'review/{kind}_comparison.png')
 (R/'masks/definitions.json').write_text(json.dumps({'canvas':[378,378],'mask_convention':'white=full declared edit support including inward 2px+0.7sigma feather; black=bit-exact protected; separate visible-foot regions, occlusion-boundary guarded','feet':SPECS},indent=2))
 (R/'validation.json').write_text(json.dumps({'source_sha256':hashes,'frame_duration_ms':170,'scope':[1,5,9,13],'results':results},indent=2))
 for f in (S/'frames').glob('frame_*.png'):assert hashlib.sha256(f.read_bytes()).hexdigest()==hashes[f.name]
 print(json.dumps({'variants':len(results),'outside_mask_changes':sum(r['outside_mask_changed_pixels'] for r in results),'source_frames_unchanged':16}))
if __name__=='__main__':run()
