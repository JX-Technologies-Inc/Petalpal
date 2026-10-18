"""Composite local painted calf repairs. No optical flow or deformation warp."""
from pathlib import Path
import sys,importlib.util,json,hashlib,math,base64
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parent;S=R.parent/'long_skirt_walk_feet_v2'
spec=importlib.util.spec_from_file_location('approved_shoe_builder',S/'build.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import cv2
W=378;X,Y=b.X,b.Y
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 for folder in ['frames','masks','review']: (R/folder).mkdir(exist_ok=True)
 source_hashes={str(p.relative_to(S)):digest(p) for p in S.rglob('*') if p.is_file()}
 gen=Image.open(R/'redraws/service_lower_leg_sheet.png').convert('RGBA').resize((1536,2048),Image.Resampling.LANCZOS)
 body=b.old.pm(Image.open(b.S/'source_parts/body.png').convert('RGBA'))
 parts={n:b.old.pm(Image.open(b.S/f'source_parts/{n}_leg.png').convert('RGBA')) for n in b.CONFIG}
 checks=[];frames=[]
 for i in range(32):
  t=i/32;a=np.array(Image.open(S/f'frames/frame_{i+1:02}.png').convert('RGBA'))
  tile=gen.crop(((i%4)*384,(i//4)*256+2,(i%4+1)*384,(i//4)*256+254)).resize((128,84),Image.Resampling.LANCZOS)
  painted=np.zeros_like(a);painted[264:348,132:260]=np.array(tile)
  bob=.8*math.cos(4*math.pi*t);sway=.6*math.sin(2*math.pi*t)
  cloth=np.clip((Y-220)/100,0,1)*.65*math.sin(2*math.pi*t-.6)
  costume=b.old.remap(body,np.stack((X-sway-cloth,Y-bob),axis=2))[:,:,3]
  shoe=np.zeros((W,W),dtype='float32');corridor=np.zeros((W,W),dtype='uint8');local_paint=np.zeros((W,W,4),dtype='float32')
  for name,p in [('far',(t+.5)%1),('near',t)]:
   coords,ankle,_=b.foot_pose(name,p)
   # Source-pixel shoe opening plus straps and conservative ankle margin.
   protected=parts[name].copy();protected[b.Y<294]=0
   shoe=np.maximum(shoe,b.old.remap(protected,coords)[:,:,3])
   root=np.array([191+sway+11*math.tanh((ankle[0]-190)/10),270+bob])
   top=root+(ankle-root)*.10
   # A local corridor accommodates the redrawn calf contour, not the thigh.
   poly=np.array([[top[0]-16,top[1]],[top[0]+16,top[1]],[ankle[0]+16,ankle[1]-5],[ankle[0]-16,ankle[1]-5]],dtype='int32')
   cv2.fillPoly(corridor,[poly],255)
   # Redrawn per-leg contour, from fixed covered knee to fixed shoe opening.
   # This is fresh raster paint; no original leg pixels are displaced/warped.
   rr=np.array(b.foot_pose(name,p)[2]['rigid_shoe_matrix'])
   opening=ankle+rr@np.array([-1,-3] if name=='far' else [-5,-3])
   knee=root.copy();axis=opening-knee;length=np.linalg.norm(axis);normal=np.array([axis[1],-axis[0]])/length
   u=np.linspace(0,1,65);centers=knee[None,:]+u[:,None]*axis
   widths=np.interp(u,[0,.32,.60,1],[5,6.8,6.4,6.5] if name=='far' else [5.4,7.2,6.8,7.0])
   outline=np.concatenate([centers+normal*widths[:,None],(centers-normal*widths[:,None])[::-1]])
   matte=Image.new('L',(W*4,W*4));ImageDraw.Draw(matte).polygon([tuple(v*4) for v in outline],fill=255)
   alpha=np.array(matte.resize((W,W),Image.Resampling.LANCZOS)).astype(float)/255
   along=np.clip(((b.G-knee)@axis)/(length*length),0,1);across=((b.G-knee)@normal)
   # Restrict the generative material sample to skin in this leg's corridor.
   pr=painted.astype(float);sample=(pr[:,:,0]-pr[:,:,1]>12)&(pr[:,:,1]-pr[:,:,2]>0)&(pr[:,:,0]-pr[:,:,2]>18)&(pr[:,:,3]>180)&(np.abs(across)<7)&(along>.2)&(along<.7)
   skin_rgb=np.median(pr[:,:,:3][sample],axis=0) if sample.sum()>3 else np.array([244,211,198])
   skin_rgb=np.clip(skin_rgb,[228,195,184],[250,223,213])
   # Broad, soft painterly volume matching the generated calf, not a bent tube.
   shade=-9*(np.clip(across/10,-1,1)**2)+3*np.exp(-((across+2)/4)**2)
   rgb=np.clip(skin_rgb[None,None,:]+shade[:,:,None],0,255)/255
   layer=np.concatenate([rgb*alpha[:,:,None],alpha[:,:,None]],axis=2).astype('float32')
   local_paint=b.old.over(layer,local_paint)
  lock=shoe>.001
  # The historical 'body' cutout contains residual skin slivers. They are
  # anatomy being repaired, not garment pixels; distinguish their warm skin
  # color before using this cutout as a costume lock.
  af=a.astype('float32')
  warm_skin=(af[:,:,0]-af[:,:,1]>11)&(af[:,:,1]-af[:,:,2]>-1)&(af[:,:,0]-af[:,:,2]>15)&(a[:,:,3]>12)
  garment_color=(af[:,:,2]-af[:,:,1]>1)|(af[:,:,2]-af[:,:,0]>-12)
  costume_lock=(costume>.015)&~warm_skin
  allowed=(corridor>0)&(Y>=272)&~lock&~costume_lock
  # Smooth only the splice boundaries, inside the declared edit footprint.
  distance=cv2.distanceTransform(allowed.astype('uint8'),cv2.DIST_L2,5)
  weight=np.minimum(distance/2,1)*b.smooth((Y-272)/5)
  # Match the local source skin color; do not alter any approved shoe pixels.
  skin=(a[:,:,0].astype(float)-a[:,:,2]>15)&(a[:,:,1].astype(float)-a[:,:,2]>0)&(a[:,:,3]>180)&allowed&(painted[:,:,3]>180)
  color_shift=np.zeros(3)
  if skin.sum()>5:
   color_shift=np.clip(np.median(a[:,:,:3][skin].astype(float)-painted[:,:,:3][skin],axis=0),-18,18)
  painted=np.array(b.old.unpm(local_paint))
  painted[:,:,:3]=np.clip(painted[:,:,:3].astype(float)+color_shift,0,255).astype('uint8')
  # Premultiplied blend handles alpha transitions without darkening edges.
  source_pm=b.old.pm(Image.fromarray(a));paint_pm=b.old.pm(Image.fromarray(painted))
  blend=b.old.unpm(source_pm*(1-weight[:,:,None])+paint_pm*weight[:,:,None])
  out=a.copy();changed_region=weight>0;out[changed_region]=np.array(blend)[changed_region]
  assert np.array_equal(a[~changed_region],out[~changed_region])
  assert np.array_equal(a[lock],out[lock]);assert np.array_equal(a[:272],out[:272])
  im=Image.fromarray(out);im.save(R/f'frames/frame_{i+1:02}.png');frames.append(im)
  Image.fromarray(np.rint(weight*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}_edit.png')
  Image.fromarray((lock*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}_shoe_lock.png')
  Image.fromarray((costume_lock*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}_costume_lock.png')
  checks.append({'frame':i+1,'shoe_rgba_changed_pixels':int(np.any(a[lock]!=out[lock],axis=1).sum()),'outside_mask_changed_pixels':int(np.any(a[~changed_region]!=out[~changed_region],axis=1).sum()),'upper_272_rows_identical':True,'calf_color_shift_rgb':color_shift.tolist(),'changed_pixels':int(np.any(a!=out,axis=2).sum())})
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 for dark in [False,True]:
  sheet=Image.new('RGB',(8*360,4*300),'#303039' if dark else '#eeeeea');d=ImageDraw.Draw(sheet)
  for i,im in enumerate(frames):
   x=i%8*360;y=i//8*300;tile=im.crop((132,260,252,350)).resize((360,270),Image.Resampling.NEAREST)
   sheet.paste(tile,(x,y+30),tile);d.text((x+6,y+6),str(i+1),fill='white' if dark else 'black',font=font)
  sheet.save(R/f'review/calves_{"dark" if dark else "light"}.png')
 sheet=Image.new('RGB',(960,390*8),'#eeeeea');d=ImageDraw.Draw(sheet)
 for row,i in enumerate([0,4,8,12,16,20,24,28]):
  for col,folder in enumerate([S,R]):
   im=Image.open(folder/f'frames/frame_{i+1:02}.png').crop((132,260,252,350)).resize((480,360),Image.Resampling.NEAREST)
   sheet.paste(im,(col*480,row*390+30),im);d.text((col*480+8,row*390+7),f'{i+1:02} '+('Original' if col==0 else 'Local redraw'),fill='black',font=font)
 sheet.save(R/'review/key_pose_comparison.png')
 ds=[round((i+1)*136/32)*10-round(i*136/32)*10 for i in range(32)];g=[]
 for im in frames:
  bg=Image.new('RGB',(378,378),'#eeeeea');bg.paste(im,mask=im.getchannel('A'));g.append(bg)
 g[0].save(R/'review/walk.gif',save_all=True,append_images=g[1:],duration=ds,loop=0,disposal=2)
 assert all(digest(S/p)==h for p,h in source_hashes.items())
 (R/'validation.json').write_text(json.dumps({'source_hashes':source_hashes,'checks':checks,'source_unchanged':True,'optical_flow_used':False,'frame_count':32,'frame_duration_ms':42.5,'loop_duration_ms':1360,'canvas':[378,378],'service_blocked_frames':[]},indent=2))
 print('32 masked composites built; shoe and outside-mask pixel locks passed.')
if __name__=='__main__':main()
