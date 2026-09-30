"""Synthetic validation fixtures only; no production artwork is generated."""
import importlib.util
import tempfile
import unittest
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('validator', Path(__file__).resolve().parents[1] / 'scripts/validateGardenArt.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.asset = dict(asset='mobile/assets/garden/flowers/species/tulip/base/tulip_garden_normal.png',
            canvasWidth=512, canvasHeight=512, anchorX=.5, anchorY=.84, visualScale=1,
            status='READY_FOR_REVIEW', anchorStatus='PROVISIONAL', reviewedSha256=None)
        self.path=self.root/self.asset['asset']; self.path.parent.mkdir(parents=True)
    def tearDown(self): self.temp.cleanup()
    def result(self, composition='normal'):
        return validator.validate_asset(self.root,'TULIP',composition,self.asset)
    def valid(self):
        im=Image.new('RGBA',(512,512)); ImageDraw.Draw(im).ellipse((130,100,380,430),fill=(120,150,80,255)); im.save(self.path)
    def test_missing(self): self.assertIn('FILE_MISSING',self.result()['errors'])
    def test_valid_and_approval(self):
        self.valid(); self.assertEqual(self.result()['errors'],[])
        self.asset['status']='APPROVED'; self.assertIn('APPROVAL_HASH_MISMATCH',self.result()['errors'])
        self.asset.update(anchorStatus='REVIEWED',reviewedSha256=self.result()['sha256'])
        self.assertEqual(self.result()['errors'],[])
        Image.new('RGBA',(512,512),(0,0,0,0)).save(self.path)
        self.assertIn('APPROVAL_HASH_MISMATCH',self.result()['errors'])
    def test_transparent(self):
        Image.new('RGBA',(512,512)).save(self.path);self.assertIn('ALL_TRANSPARENT',self.result()['errors'])
    def test_matte(self):
        Image.new('RGB',(512,512),'white').save(self.path)
        for code in ['NO_ALPHA','OPAQUE_RECTANGLE','TOUCHES_ALL_FOUR_EDGES']:self.assertIn(code,self.result()['errors'])
    def test_dimensions(self):
        Image.new('RGBA',(12,12)).save(self.path);self.assertIn('WRONG_DIMENSIONS',self.result()['errors'])
    def test_metadata(self):
        self.valid();self.asset.update(anchorX=float('nan'),anchorY=2,visualScale=0,status='FAKE')
        for code in ['INVALID_anchorX','INVALID_anchorY','INVALID_VISUAL_SCALE','INVALID_STATUS']:self.assertIn(code,self.result()['errors'])
        self.assertIn('INVALID_COMPOSITION',self.result('gratitude_surprise')['errors'])
    def test_source_path_rejected(self):
        self.valid();self.asset['asset']='Resources/Surprise & Excitement & Curiosity/Tulip.png'
        self.assertIn('NONCANONICAL_ASSET_PATH',self.result()['errors'])
    def test_corrupt(self):
        self.path.write_text('not a PNG');self.assertTrue(any(e.startswith('UNREADABLE_IMAGE') for e in self.result()['errors']))
    def test_bindings_gate(self):
        self.valid();row=dict(metadata=self.asset,**self.result())
        self.assertIn('require(',validator.binding_text([row]))
        row['metadata']={**self.asset,'status':'NEEDS_GARDEN_ART_ADAPTATION'}
        self.assertNotIn('require(',validator.binding_text([row]))

if __name__=='__main__':unittest.main()
