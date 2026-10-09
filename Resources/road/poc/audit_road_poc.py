from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'.tools'))
import numpy as np
from PIL import Image
base=Path(__file__).resolve().parent
for kind in ('straight','gentle_curve','s_curve'):
 a=np.asarray(Image.open(base/f'road_poc_{kind}.png').convert('RGBA'))[:,:,3]
 widths=[]
 for x in np.arange(100,1301,50):
  t=x/1399
  if kind=='straight':y=450;slope=0
  elif kind=='gentle_curve':y=450+82*np.sin(np.pi*t)**2;slope=82*np.pi/1399*np.sin(2*np.pi*t)
  else:y=450+88*np.sin(2*np.pi*t);slope=88*2*np.pi/1399*np.cos(2*np.pi*t)
  n=np.arange(-170,171);q=np.sqrt(1+slope*slope)
  xx=np.rint(x-n*slope/q).astype(int);yy=np.rint(y+n/q).astype(int)
  good=np.where(a[yy,xx]>100)[0]
  widths.append(int(good.max()-good.min()+1))
 print(kind,'normal_width_px',np.percentile(widths,[5,50,95]).tolist(),'transparent_pixels',int(np.count_nonzero(a==0)))
