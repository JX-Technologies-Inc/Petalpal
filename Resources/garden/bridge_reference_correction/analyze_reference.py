"""Register the completed Garden reference to the current Garden runtime."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'Resources/road/.tools'))
import cv2
import numpy as np

OUT = Path(__file__).resolve().parent
REF = ROOT / 'mobile/assets/garden/reference/structure-final-version.png'
OFF = ROOT / 'Resources/garden/infrastructure_mobile_review/02_mobile_infrastructure_off.png'

reference = cv2.imread(str(REF), cv2.IMREAD_COLOR)
runtime = cv2.imread(str(OFF), cv2.IMREAD_COLOR)
rw, rh = reference.shape[1], reference.shape[0]
cw, ch = runtime.shape[1], runtime.shape[0]
fit = cw / 2400
world_h = round(1800 * fit)
top = round((ch - world_h) / 2)
runtime_world = cv2.resize(runtime[top:top+world_h], (rw, rh), interpolation=cv2.INTER_AREA)

print('reference', (rw, rh), 'runtime', (cw, ch), 'world crop top', top)

# Grass masks give a stable, independent placement signal despite the added
# flowers, lanterns, and landmarks in the completed illustration.
boxes = {
    '0405': (700, 0, 1060, 300),
    'central': (460, 230, 970, 670),
    '06': (1030, 120, 1350, 390),
    '07': (1050, 290, 1445, 595),
    '08': (1030, 540, 1445, 1000),
    '09': (560, 620, 900, 1030),
    '101112': (0, 260, 500, 900),
}
def grass_centroid(im, box):
    x0,y0,x1,y1 = box
    hsv = cv2.cvtColor(im[y0:y1,x0:x1], cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([25,35,20]), np.array([78,255,255]))
    yy,xx = np.where(mask > 0)
    return np.array([xx.mean()+x0, yy.mean()+y0]), len(xx)
centers = []
for name,box in boxes.items():
    a,na=grass_centroid(reference,box)
    b,nb=grass_centroid(runtime_world,box)
    centers.append((a,b))
    print('grass',name,'ref',a.round(1),'runtime',b.round(1),'delta',(b-a).round(1),'n',na,nb)
A = np.float32([x for x,_ in centers]); B = np.float32([y for _,y in centers])
M,_ = cv2.estimateAffine2D(A,B,method=cv2.LMEDS)
print('grass-centroid affine ref -> runtime at reference dimensions',M)
