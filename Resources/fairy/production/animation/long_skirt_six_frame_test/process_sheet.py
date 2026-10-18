from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw,ImageFont
from collections import deque
import numpy as np,json,hashlib,shutil
P=Path(__file__).resolve().parent;source=Path('C:/Users/cjysu/AppData/Local/Temp/codex-clipboard-657f694e-51f8-4fb9-b233-abcc944d4aed.png')
if source.exists():shutil.copy2(source,P/'source/long_skirt_walk_sheet.png')
src=Image.open(P/'source/long_skirt_walk_sheet.png').convert('RGB');s=np.array(src);W,H=400,720;Y0=100
# Integer upper-body registration; no per-frame scaling or deformation.
base=[0,274,545,820,1094,1370];offsets=[0]
t=s[150:260,110:222].astype(float)
for b in base[1:]:
 scores=[]
 for dx in range(-14,15):
  patch=s[150:260,b+dx+110:b+dx+222].astype(float)
  scores.append((float(np.mean((patch-t)**2)),b+dx))
 offsets.append(min(scores)[1])
# Adjacent poses share a sheet but do not overlap. Row-specific cell ownership
# retains toes extending beyond a uniform grid while excluding neighboring art.
bounds_upper=[0,274,545,818,1093,1375,1672];bounds_lower=[0,305,552,811,1113,1380,1672]
footboxes=[[(38,104),(212,288)],[(328,380),(449,524)],[(582,635),(697,774)],[(838,902),(1014,1093)],[(1134,1192),(1264,1343)],[(1406,1467),(1555,1631)]]
labels=['Left Contact','Left Down','Right Passing','Right Contact','Right Down','Left Passing'];originals=[];cutouts=[];reports=[]
for i,off in enumerate(offsets):
 frame=np.full((H,W,3),[253,252,250],np.uint8);ownership=np.zeros((H,W),bool)
 for yy in range(H):
  sy=yy+Y0;bd=bounds_lower if sy>=600 else bounds_upper;lo,hi=bd[i],bd[i+1]
  for sx in range(lo,hi):
   x=sx-off+45
   if 0<=x<W and sy<s.shape[0]:frame[yy,x]=s[sy,sx];ownership[yy,x]=True
 Image.fromarray(frame).save(P/'original'/f'frame_{i+1:02d}.png');originals.append(Image.fromarray(frame))
 # Background estimation from the brightest local pixels; morphology follows
 # the paper lighting gradient instead of assuming every white pixel is empty.
 bright=Image.fromarray(frame).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(7))
 bg=np.array(bright).astype(float);rgb=frame.astype(float);distance=np.max(np.abs(bg-rgb),axis=2)
 candidate=(distance<11)&ownership
 # Only exterior-connected paper is discarded. Pale enclosed painting is not
 # globally keyed out. Keep fine colored disconnected details in the matte.
 # Open the paper beneath the removed ground stroke before flood fill.
 candidate[623:]=True
 for yy in range(621,623):
  keep=np.zeros(W,bool)
  for l,r in footboxes[i]:keep[max(0,l-off+45):min(W,r-off+45)]=True
  candidate[yy,~keep]=True
 exterior=np.zeros((H,W),bool);q=deque()
 for y,x in zip(*np.nonzero((~ownership)|(((np.indices((H,W))[0]<25)|(np.indices((H,W))[0]>=623))))):
  exterior[y,x]=True;q.append((y,x))
 # Known negative space behind the neck/hair, only paper-like pixels.
 for y in range(153,180):
  for x in range(164,191):
   if candidate[y,x] and not exterior[y,x]:exterior[y,x]=True;q.append((y,x))
 while q:
  y,x=q.popleft()
  for ny,nx in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
   if 0<=ny<H and 0<=nx<W and not exterior[ny,nx] and candidate[ny,nx]:exterior[ny,nx]=True;q.append((ny,nx))
 support=(~exterior)&ownership
 support[:25]=False;support[623:]=False
 # Remove the horizontal ground stroke except directly underneath a shoe's
 # contact contour. No labels enter the transparent sprite.
 for yy in range(621,624):
  keep=np.zeros(W,bool)
  for l,r in footboxes[i]:
   l=max(0,l-off+45);r=min(W,r-off+45);keep[l:r]=True
  support[yy]&=keep
 # Remove only tiny background flecks; independent gold/hair details survive.
 seen=np.zeros_like(support);clean=support.copy()
 for y,x in zip(*np.nonzero(support)):
  if seen[y,x]:continue
  stack=[(y,x)];seen[y,x]=True;pts=[]
  while stack:
   yy,xx=stack.pop();pts.append((yy,xx))
   for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
    if 0<=ny<H and 0<=nx<W and support[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;stack.append((ny,nx))
  if len(pts)<3:
   for yy,xx in pts:clean[yy,xx]=False
 # At the contact band retain only shapes connected to real shoe pixels
 # two rows above; discard floating remnants under lifted feet.
 sole=np.array(Image.fromarray((clean[619:620]*255).astype('uint8')).resize((W,5)).filter(ImageFilter.MaxFilter(3)))[2]>0
 clean[621:623]&=sole
 # Ground stroke is a low-chroma horizontal trace. In its three-row band,
 # retain only pixels backed by colored shoe material immediately above.
 chroma=frame.max(axis=2).astype(int)-frame.min(axis=2).astype(int)
 for y in range(620,623):
  shoe_above=np.max(chroma[y-4:y],axis=0)>24
  clean[y]&=shoe_above | (chroma[y]>24)
 # Narrow soft boundary. Opaque interior RGB stays unchanged.
 mask=Image.fromarray((clean*255).astype('uint8'));alpha=np.array(mask.filter(ImageFilter.GaussianBlur(.45))).astype(float)/255
 core=np.array(mask.filter(ImageFilter.MinFilter(7)))>250
 alpha=np.where(core,alpha,np.minimum(alpha,np.clip(distance/45,0,1)))
 alpha[~ownership]=0;alpha[623:]=0
 # Conservative estimated transmission only in the rear wing region. This
 # is not recovered original alpha; retain all pale wing color information.
 xx,yy=np.meshgrid(np.arange(W),np.arange(H));sx=xx+off-45;sy=yy+Y0
 wing=Image.new('L',(W,H));d=ImageDraw.Draw(wing)
 poly=[(25,238),(78,235),(126,276),(150,329),(107,349),(55,330)]
 # Sheet-relative wing polygon follows the registered source, same geometry.
 d.polygon([(x+45,y-Y0) for x,y in poly],fill=255)
 wm=np.array(wing.filter(ImageFilter.GaussianBlur(4)))/255
 transmission=np.clip(.30+distance/125,.30,1)
 alpha*=1-wm*(1-transmission)
 # White-matte decontamination, constrained to the chosen alpha. A lower bound
 # keeps recovered foreground RGB in gamut and prevents dark edge clipping.
 amin=np.max(np.maximum((bg-rgb)/np.maximum(bg,1),(rgb-bg)/np.maximum(255-bg,1)),axis=2)
 alpha=np.where(alpha>0,np.maximum(alpha,np.clip(amin,0,1)),0)
 fg=np.divide(rgb-bg*(1-alpha[:,:,None]),alpha[:,:,None],out=np.zeros_like(rgb),where=alpha[:,:,None]>0)
 out=np.dstack([np.clip(np.rint(fg),0,255).astype('uint8'),np.clip(np.rint(alpha*255),0,255).astype('uint8')]);out[out[:,:,3]==0,:3]=0
 im=Image.fromarray(out);im.save(P/'transparent'/f'frame_{i+1:02d}.png');cutouts.append(im)
 reports.append({'frame':i+1,'label':labels[i],'source_offset_x':off,'translation_x':45-off,'translation_y':-Y0,'scale':1,'alpha_bbox':im.getchannel('A').getbbox(),'alpha_estimated':True})
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
sheet=Image.new('RGB',(W*6,H),'#647681');d=ImageDraw.Draw(sheet)
for i,im in enumerate(cutouts):sheet.paste(im,(i*W,0),im);d.text((i*W+15,665),f'{i+1}: {labels[i]}',font=font,fill='white')
sheet.save(P/'review/transparent_contact_sheet.png')
checks=Image.new('RGB',(W*6,H*2),'#263640')
for i,im in enumerate(cutouts):
 checks.paste(im,(i*W,0),im);bgim=Image.new('RGB',(W,H),'#f2eadf');bgim.paste(im,(0,0),im);checks.paste(bgim,(i*W,H))
checks.save(P/'review/alpha_background_checks.png')
gifs=[]
for im in cutouts:
 bgim=Image.new('RGB',(W,H),'#657581');bgim.paste(im,(0,0),im);gifs.append(bgim)
gifs[0].save(P/'review/long_skirt_walk.gif',save_all=True,append_images=gifs[1:],duration=200,loop=0)
cutouts[0].save(P/'review/long_skirt_walk.png',save_all=True,append_images=cutouts[1:],duration=200,loop=0,disposal=0,blend=0)
(P/'frames.json').write_text(json.dumps({'source_sha256':hashlib.sha256((P/'source/long_skirt_walk_sheet.png').read_bytes()).hexdigest(),'canvas':[W,H],'source_rgb_no_original_alpha':True,'order':[1,2,3,4,5,6],'frame_duration_ms':200,'frames':reports},indent=2),encoding='utf8')
print('Offsets:',offsets,'; exported six original and transparent frames')
