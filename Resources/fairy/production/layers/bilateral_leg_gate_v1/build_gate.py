from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageFont
P=Path(__file__).resolve().parent;N=1254
master=Image.open(P.parents[4]/'Resources/fairy/production/master/fairy_first_approved.png').convert('RGBA')
# Register each independently painted leg to its own source joint trajectory.
def registered(gen,ty,sy,tx,sx,sc):
 mesh=[]
 for y in range(ty[0],ty[-1],3):
  y1=min(y+3,ty[-1]);pts=[]
  for x,yy in [(470,y),(470,y1),(820,y1),(820,y)]:
   pts.extend([(x-np.interp(yy,ty,tx))/np.interp(yy,ty,sc)+np.interp(yy,ty,sx),np.interp(yy,ty,sy)])
  mesh.append(((470,y,820,y1),tuple(pts)))
 return gen.transform((N,N),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
def fit_ankle(a,visible):
 # Register the reconstructed calf into its own source ankle contour before
 # alpha compositing. This removes double-contour translucent flares.
 for y in range(930,1026):
  old=np.flatnonzero(a[y,:,3]>128);ref=np.flatnonzero(visible[max(980,y),:,3]>128)
  if len(old)<2 or len(ref)<2:continue
  t=float(np.clip((y-930)/50,0,1));lo=old[0]*(1-t)+ref[0]*t;hi=old[-1]*(1-t)+ref[-1]*t
  scale=(old[-1]-old[0])/max(hi-lo,1);shift=old[0]-lo*scale
  row=Image.fromarray(a[y:y+1]).transform((N,1),Image.Transform.AFFINE,(scale,0,shift,0,1,0),Image.Resampling.BICUBIC)
  a[y]=np.array(row)[0]
 return a
def retain_shoe(a,visible,start,end):
 # Premultiplied interpolation avoids dark seams through transparent edges.
 for y in range(start,N):
  t=float(np.clip((y-start)/(end-start),0,1));aa=a[y].astype(float)/255;bb=visible[y].astype(float)/255
  alpha=aa[:,3:4]*(1-t)+bb[:,3:4]*t
  rgb=aa[:,:3]*aa[:,3:4]*(1-t)+bb[:,:3]*bb[:,3:4]*t
  rgb=np.divide(rgb,alpha,out=np.zeros_like(rgb),where=alpha>0)
  a[y]=np.clip(np.rint(np.concatenate([rgb,alpha],axis=1)*255),0,255).astype(np.uint8)
 a[a[:,:,3]==0,:3]=0
 return a
lg=Image.open(P/'sources/left_independent_reconstruction.png').convert('RGBA')
left=registered(lg,[620,833,1025,1180],[128,425,865,1160],[650,674,699,730],[615,710,715,790],[.5,.5,.5,.55])
a=np.array(left);visible=np.array(Image.open(P/'sources/left_near_visible_source.png'))
a=retain_shoe(fit_ankle(a,visible),visible,990,1025);left=Image.fromarray(a)
# Far-right reconstruction is independently registered to its own joint chain.
rg=Image.open(P/'sources/right_independent_reconstruction.png').convert('RGBA')
ty=[620,835,1014,1155];sy=[497,730,1008,1166];tx=[690,635,602,602];sx=[736,694,610,613];sc=[.72,.72,.9,1.0]
mesh=[]
for y in range(620,1155,3):
 y1=min(y+3,1155);pts=[]
 for x,yy in [(470,y),(470,y1),(800,y1),(800,y)]:
  pts.extend([(x-np.interp(yy,ty,tx))/np.interp(yy,ty,sc)+np.interp(yy,ty,sx),np.interp(yy,ty,sy)])
 mesh.append(((470,y,800,y1),tuple(pts)))
right=rg.transform((N,N),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
b=np.array(right);rv=np.array(Image.open(P/'sources/right_far_visible_source.png'))
# Source shoe pixels and their alpha replace generated footwear, not mirrored.
# Blend only the concealed lower-calf transition; every shoe pixel below 1025
# is the original far shoe extraction.
b=retain_shoe(fit_ankle(b,rv),rv,990,1025)
# Concealed right hip overlap uses a small interior patch from THIS right
# thigh. No left-leg pixels or mirror operation participate.
patch=Image.fromarray(b).crop((652,710,672,740)).resize((64,100),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(1))
patch=np.array(patch)
for y in range(620,720):
 center=np.interp(y,[620,710],[690,664]);half=np.interp(y,[620,710],[25,28]);lo=round(center-half);hi=round(center+half)
 for x in range(lo,hi):
  px=int(np.clip((x-lo)/(hi-lo)*63,0,63))
  if y>700 and b[y,x,3]<240:continue
  t=float(np.clip((y-660)/60,0,1)) if b[y,x,3]>240 else 0
  b[y,x,:3]=np.rint(patch[y-620,px,:3]*(1-t)+b[y,x,:3]*t).astype(np.uint8);b[y,x,3]=255
b[b[:,:,3]==0,:3]=0;right=Image.fromarray(b)
left.save(P/'images/leg_left_complete.png');right.save(P/'images/leg_right_complete.png')
rest=Image.alpha_composite(right,left);rest.save(P/'review/both_legs_rest.png')
# Static separation diagnostics only. Translations preserve distinct artwork;
# they are NOT gait frames and make no claim of a validated walk.
def shift(im,dx,dy):return im.transform((N,N),Image.Transform.AFFINE,(1,0,-dx,0,1,-dy),Image.Resampling.BICUBIC)
lf=shift(left,80,10);rb=shift(right,-80,-10)
rf=shift(right,180,10);lb=shift(left,-150,-10)
p1=Image.alpha_composite(rb,lf);p2=Image.alpha_composite(lb,rf)
p1.save(P/'review/left_forward_right_back.png');p2.save(P/'review/right_forward_left_back.png')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
items=[('LEFT - near leg',left,'Original screen-right shoe'),('RIGHT - far leg',right,'Original screen-left shoe'),('REST - both legs',rest,'Source-aligned rest candidate'),('LEFT forward / RIGHT back',p1,'Static separation; both visible'),('RIGHT forward / LEFT back',p2,'Static separation; both visible')]
sheet=Image.new('RGB',(2250,680),'#657581');d=ImageDraw.Draw(sheet)
for i,(label,im,note) in enumerate(items):
 x=i*450;d.text((x+12,15),label,font=font,fill='white');d.text((x+12,44),note,font=small,fill='#d6e3ef')
 # Same crop/scale in all panels; no per-leg normalization.
 crop=im.crop((350,590,1000,1220)).resize((440,426),Image.Resampling.LANCZOS);sheet.paste(crop,(x+5,85),crop)
 shoe=im.crop((350,980,1000,1220)).resize((440,162),Image.Resampling.LANCZOS);sheet.paste(shoe,(x+5,512),shoe)
sheet.save(P/'review/bilateral_leg_diagnostic_sheet.png')
# Source comparison is deliberately separate from any claim of approval.
comp=Image.new('RGB',(1100,720),'#657581');d=ImageDraw.Draw(comp)
for i,(name,im) in enumerate([('Approved master leg region',master),('Candidate bilateral rest (no dress)',rest)]):
 crop=im.crop((510,600,815,1200)).resize((305,600),Image.Resampling.LANCZOS);comp.paste(crop,(100+i*550,70),crop);d.text((25+i*550,20),name,font=font,fill='white')
comp.save(P/'review/source_vs_bilateral_rest.png')
manifest={'status':'PENDING_MANUAL_BILATERAL_ASSET_REVIEW','canvas':[1254,1254],'side_convention':'anatomical: LEFT=original near screen-right shoe; RIGHT=far screen-left shoe','independent_generation':True,'mirrored_or_cross_leg_reuse':False,'animation_created_or_modified':False,'parts':{'leg_left_complete':{'hip':[650,645],'knee':[674,833],'ankle':[699,1025],'source':'left_independent_reconstruction.png + left_near_visible_source.png'},'leg_right_complete':{'hip':[690,640],'knee':[635,835],'ankle':[602,1014],'source':'right_independent_reconstruction.png + right_far_visible_source.png'}},'diagnostics':'static translations, not a walk cycle','rest_registration_note':'source-aligned candidate; hidden reconstruction is not pixel-certified against nonexistent source anatomy'}
(P/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
