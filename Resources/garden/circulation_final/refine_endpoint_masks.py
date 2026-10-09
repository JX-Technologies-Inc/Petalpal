from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import numpy as np
import build_candidate as garden
R=ROOT/'mobile/assets/garden/infrastructure/final'
yy,xx=np.mgrid[:1800,:2400];p=np.stack([xx,yy],-1)
for name,a,b,width in [('B02',(1570,600),(1790,540),25),('B01',(1628,1442),(1830,1310),24)]:
 a=np.array(a);b=np.array(b);d=b-a;length=np.linalg.norm(d);u=d/length;q=p-a
 along=(q*u).sum(2);cross=np.abs(q[:,:,0]*u[1]-q[:,:,1]*u[0])
 corridor=np.clip((width-cross)/5,0,1)*np.clip((along+9)/5,0,1)*np.clip((length+9-along)/5,0,1)
 im=np.array(Image.open(R/(name+'_foreground.png')).convert('RGBA'))
 im[:,:,3]=np.uint8(im[:,:,3]*(1-corridor))
 Image.fromarray(im).save(R/(name+'_foreground_seated.png'))
# Existing Land09 path pixels gently cover the clipped entrance-road tip.
im=np.array(garden.transform_land('09'));q=p-np.array([1398,1457]);u=np.array([.86,.51])
along=(q*u).sum(2);radius=np.sqrt((q*q).sum(2))
mask=np.clip((-along+5)/24,0,1)*np.clip((58-radius)/8,0,1)
im[:,:,3]=np.uint8(im[:,:,3]*mask)
Image.fromarray(im).save(R/'Road_endpoint_foreground.png')
print('Separate endpoint masks exported; bridge transforms and source pixels unchanged')
