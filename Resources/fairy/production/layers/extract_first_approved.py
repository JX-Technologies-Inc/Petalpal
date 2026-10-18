"""Lossless visible-pixel partition. No generation, matting, resizing or repainting.
Run from repository root. Pillow and NumPy are required.
"""
from pathlib import Path
import hashlib, json, shutil
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'Resources/fairy/production'
SOURCE = BASE / 'master/fairy_first_approved.png'
OUT = BASE / 'layers/first_approved'
RUNTIME = ROOT / 'mobile/assets/garden/fairy/first-approved'
REVIEW = BASE / 'review/first_approved'

# Coordinates are original canvas pixels. Left/right are screen-side for this
# fixed view, explicitly recorded to avoid guessing anatomy from the painting.
# Later polygons take ownership; every source pixel belongs to exactly one layer.
REGIONS = {
 'dress_back_petals': None,
 'wing_left': [(392,202),(469,206),(572,300),(582,409),(514,446),(449,425),(437,366),(399,316)],
 'wing_right': [(708,271),(817,221),(832,304),(797,373),(814,405),(763,453),(724,399)],
 'dress_side_petals': [(405,434),(574,401),(623,475),(566,671),(574,856),(502,1069),(411,1110),(387,758)],
 'dress_base': [(575,299),(690,287),(752,322),(765,430),(815,562),(815,790),(708,859),(565,832),(544,582)],
 'body_base': [(568,264),(606,253),(643,257),(703,272),(738,320),(691,331),(642,321),(604,301),(583,334),(560,321)],
 'leg_left': [(611,692),(654,709),(668,826),(651,901),(627,1003),(636,1060),(663,1159),(541,1160),(539,1071),(578,998),(596,909),(592,824),(604,760)],
 'leg_right': [(618,650),(671,680),(710,787),(713,893),(723,1004),(750,1062),(790,1182),(671,1183),(660,1100),(663,1040),(640,950),(630,873),(615,817),(635,760)],
 'dress_front_petals': [(604,322),(690,329),(748,321),(752,421),(766,475),(809,612),(757,742),(704,680),(676,709),(645,672),(615,726),(588,688),(561,740),(544,603),(581,476)],
 'arm_right_upper': [(746,370),(769,388),(786,459),(800,490),(786,511),(758,466)],
 'arm_right_lower': [(786,486),(806,517),(827,572),(860,619),(868,681),(838,688),(820,645),(792,600),(776,539)],
 'arm_left_upper': [(574,273),(603,271),(619,294),(604,344),(591,383),(579,442),(550,451),(539,421),(554,356),(562,316)],
 'arm_left_lower': [(551,430),(586,443),(570,496),(548,555),(536,591),(511,625),(514,663),(492,697),(477,682),(478,640),(493,599),(514,553),(532,489)],
 'hair_back': [(504,137),(538,70),(609,38),(691,39),(742,95),(759,159),(746,256),(688,282),(568,277),(526,232)],
 'head_face': [(615,121),(670,112),(716,131),(725,177),(708,225),(678,244),(670,270),(688,279),(688,289),(641,280),(634,238),(613,227),(592,190)],
 'braided_updo': [(522,180),(556,185),(603,209),(625,232),(619,263),(581,283),(549,263),(532,234)],
 'hair_front': [(552,90),(610,48),(681,54),(728,97),(749,153),(747,230),(725,255),(708,252),(728,201),(719,151),(694,126),(671,165),(625,187),(611,214),(591,204),(613,166),(594,186),(557,178)],
 'flower_accessory': [(514,115),(547,104),(574,130),(598,146),(603,178),(584,207),(548,218),(511,210),(501,173)],
}

def run():
 for p in [OUT, RUNTIME, REVIEW]: p.mkdir(parents=True, exist_ok=True)
 im = Image.open(SOURCE)
 assert im.mode == 'RGBA' and im.size == (1254,1254)
 src = np.array(im)
 owner = np.zeros(src.shape[:2], dtype=np.uint8)
 for i, (name, polygon) in enumerate(REGIONS.items()):
  if polygon:
   mask = Image.new('L', im.size); ImageDraw.Draw(mask).polygon(polygon, fill=255)
   owner[np.array(mask)>0] = i
 recomposed = Image.new('RGBA', im.size)
 report=[]
 for i,name in enumerate(REGIONS):
  pixels=np.zeros_like(src); pixels[owner==i]=src[owner==i]
  layer=Image.fromarray(pixels)
  layer.save(OUT/f'{name}.png')
  shutil.copyfile(OUT/f'{name}.png',RUNTIME/f'{name}.png')
  recomposed=Image.alpha_composite(recomposed,layer)
  report.append({'id':name,'file':f'{name}.png','visible_pixels':int(np.count_nonzero(pixels[:,:,3]))})
 a=np.array(recomposed); visible=src[:,:,3]>0
 assert np.array_equal(a[:,:,3],src[:,:,3])
 assert np.array_equal(a[visible],src[visible])
 recomposed.save(REVIEW/'recomposed.png')
 sheet=Image.new('RGB',(900,((len(report)+3)//4)*270),'#dce3dc'); draw=ImageDraw.Draw(sheet)
 for i,item in enumerate(report):
  thumb=Image.open(OUT/item['file']); thumb.thumbnail((220,240))
  x=(i%4)*225; y=(i//4)*270
  sheet.paste(thumb,(x,y),thumb); draw.text((x+3,y+245),item['id'],fill='black')
 sheet.save(REVIEW/'contact_sheet.png')
 # Independent backgrounds reveal original source fringes; never clean source pixels.
 checks=Image.new('RGB',(1254*3,1254))
 for i,color in enumerate(['#eef1e8','#303846','#876d89']):
  panel=Image.new('RGBA',im.size,color); panel.alpha_composite(recomposed)
  checks.paste(panel.convert('RGB'),(i*1254,0))
 checks.save(REVIEW/'alpha_backgrounds.png')
 manifest={'authority':'../../master/fairy_first_approved.png','source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  'canvas':[1254,1254],'registration':{'x':0,'y':0,'scale':1,'rotation':0},
  'sides':'screen left/right in the single approved view','root':[674,1178],'hips':[655,676],
  'layers':report,'visible_rgba_exact':True,'alpha_exact':True,'hidden_reconstruction':False,
  'limitations':['Visible-pixel extraction only; occluded anatomy cannot be recovered.',
   'Source edge fringes preserved unchanged. Joint separation needs manual posed review.']}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({'layers':len(report),'visible_rgba_exact':True,'alpha_exact':True,'source_sha256':manifest['source_sha256']}))

if __name__=='__main__': run()
