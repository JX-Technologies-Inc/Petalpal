from pathlib import Path
import sys,math,json,hashlib,base64
R=Path(__file__).resolve().parent;S=R.parent/'long_skirt_walk_32f_v1';sys.path.insert(0,str(R.parent/'long_skirt_walk_24f_v1/_tool_deps'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
W=378;Y,X=np.mgrid[:W,:W].astype('float32');G=np.stack((X,Y),axis=2)
POLYS={'far':[(195,250),(183,268),(170,281),(167,294),(167,327),(179,337),(180,346),(151,346),(133,340),(132,320),(143,307),(151,294),(155,277),(178,264)],'near':[(208,259),(223,271),(229,291),(240,319),(266,334),(266,347),(218,347),(214,320),(215,300),(208,282)]}
def pm(a):
 a=np.array(a).astype('float32')/255;a[:,:,:3]*=a[:,:,3:4];return a
def unpm(a):
 b=a.copy();np.divide(a[:,:,:3],a[:,:,3:4],out=b[:,:,:3],where=a[:,:,3:4]>1e-7);b=np.clip(np.rint(b*255),0,255).astype('uint8');b[b[:,:,3]==0,:3]=0;return Image.fromarray(b)
def over(a,b):return a+b*(1-a[:,:,3:4])
def remap(a,xy):return cv2.remap(a,xy[:,:,0].astype('float32'),xy[:,:,1].astype('float32'),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def ease(u):return u*u*(3-2*u)
def gait(p):
 stance=.62;stride=44
 if p<stance:
  x=22-stride*p/stance;lift=0
  angle=-4*(1-p/.1) if p<.1 else (8*ease((p-.49)/(.62-.49)) if p>.49 else 0)
 else:
  u=(p-stance)/(1-stance);x=-22+44*ease(u);lift=5*math.sin(math.pi*u);angle=8*(1-u)-4*u
 return x,lift,angle,p<stance
def main():
 hashes={str(p.relative_to(S)):hashlib.sha256(p.read_bytes()).hexdigest() for p in S.rglob('*') if p.is_file()};src=Image.open(S/'frames/frame_01.png').convert('RGBA');a=pm(src);masks={};parts={};body=a.copy()
 for name,poly in POLYS.items():
  im=Image.new('L',(W*4,W*4));ImageDraw.Draw(im).polygon([(x*4,y*4) for x,y in poly],fill=255);im=im.resize((W,W),Image.Resampling.LANCZOS);m=np.array(im)/255;im.save(R/f'source_parts/{name}_mask.png');masks[name]=m;parts[name]=a*m[:,:,None]
  expanded=cv2.dilate(m.astype('float32'),np.ones((5,5),np.uint8));erase=np.where(Y>291,expanded,m);body*=1-erase[:,:,None]
  unpm(parts[name]).save(R/f'source_parts/{name}_leg.png')
 unpm(body).save(R/'source_parts/body.png');frames=[];tracks=[]
 duration=1.36;speed=44/(.62*duration)
 for i in range(32):
  t=i/32;bob=0.8*math.cos(4*math.pi*t);sway=.6*math.sin(2*math.pi*t);canvas=np.zeros_like(a);row={'frame':i+1,'root_speed_px_s':speed,'feet':{}}
  for name,phase in [('far',(t+.5)%1),('near',t)]:
   dx,lift,ang,support=gait(phase);toe=np.array([200+dx,342-lift]);rad=math.radians(ang);rot=np.array([[math.cos(rad),-math.sin(rad)],[math.sin(rad),math.cos(rad)]])
   oldtoe=np.array([168,341] if name=='far' else [249,340]);oldankle=np.array([157,306] if name=='far' else [229,308]);oldroot=np.array([176,266] if name=='far' else [218,268]);ankle=toe+rot@(oldankle-oldtoe)
   root=np.array([194+sway if name=='far' else 206+sway,266+bob]);knee=(root+ankle)*.5+np.array([3*math.sin(math.pi*max(0,(phase-.62)/.38)),0])
   # Rigid, unscaled footwear from its own distinct source pixels.
   sourcefoot=(G-toe)@rot+oldtoe
   # Upper calf smoothly joins the stationary garment root to the moving ankle.
   frac=np.clip((Y-root[1])/(ankle[1]-root[1]),0,1)
   targetcx=(1-frac)*root[0]+frac*ankle[0]+4*frac*(1-frac)*(knee[0]-(root[0]+ankle[0])/2)
   oldcx=(1-frac)*oldroot[0]+frac*oldankle[0]
   sourcecalf=np.stack((X-targetcx+oldcx,oldroot[1]+frac*(oldankle[1]-oldroot[1])),axis=2)
   blend=np.clip((Y-(ankle[1]-4))/8,0,1);blend=blend*blend*(3-2*blend)
   coords=sourcecalf*(1-blend[:,:,None])+sourcefoot*blend[:,:,None]
   leg=remap(parts[name],coords);leg[Y<root[1]-1]=0;canvas=over(leg,canvas)
   row['feet'][name]={'phase':phase,'support':support,'forefoot_pivot':toe.tolist(),'angle_degrees':ang,'swing_lift':lift}
  # Tiny body rise and continuous delayed petal sway; no scale change.
  cloth=np.clip((Y-220)/100,0,1)*.65*math.sin(2*math.pi*t-.6)
  c=np.stack((X-sway-cloth,Y-bob),axis=2);canvas=over(remap(body,c),canvas)
  im=unpm(canvas);im.save(R/f'frames/frame_{i+1:02}.png');frames.append(im);tracks.append(row)
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 sheet=Image.new('RGB',(378*8,403*4),'#e5e5df');d=ImageDraw.Draw(sheet)
 for i,im in enumerate(frames):x=i%8*378;y=i//8*403;sheet.paste(im,(x,y+25),im);d.text((x+8,y+3),f'{i+1:02}',fill='black',font=font)
 sheet.save(R/'review/contact_sheet.png');delay=[round((i+1)*136/32)*10-round(i*136/32)*10 for i in range(32)]
 opaque=[];travel=[]
 for i,im in enumerate(frames):
  bg=Image.new('RGB',(378,378),'#e5e5df');bg.paste(im,(0,0),im);opaque.append(bg)
  bg=Image.new('RGB',(600,405),'#e5e5df');d=ImageDraw.Draw(bg);d.line((0,342,600,342),fill='#888888')
  for x in range(0,600,20):d.line((x,342,x,352),fill='#888888')
  bg.paste(im,(round(i/32*duration*speed),0),im);travel.append(bg)
 opaque[0].save(R/'review/walk.gif',save_all=True,append_images=opaque[1:],duration=delay,loop=0,disposal=2)
 travel[0].save(R/'review/travelling_diagnostic.gif',save_all=True,append_images=travel[1:],duration=delay,loop=0,disposal=2)
 metadata={'status':'RECONSTRUCTION_TEST_NOT_APPROVED','frame_count':32,'frame_duration_ms':42.5,'loop_duration_ms':1360,'canvas':[378,378],'world_travel_speed_px_s':speed,'gait':tracks,'source_hashes':hashes,'note':'Distinct source calf/shoe regions; original footwear size retained via rigid map. Transparent frame centering unchanged; ground lock is evaluated with documented root travel.'};(R/'frames.json').write_text(json.dumps(metadata,indent=2))
 assert all(hashlib.sha256((S/p).read_bytes()).hexdigest()==h for p,h in hashes.items())
 print('Built 32-frame isolated gait reconstruction.')
if __name__=='__main__':main()
