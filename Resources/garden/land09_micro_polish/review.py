exec((__import__('pathlib').Path(__file__).parent/'build.py').read_text().split('generated=')[0])
for src,name in [('runtime_before.png','01_before.png'),('runtime_after.png','02_after.png')]:
 Image.open(S/src).convert('RGB').crop((470,235,765,480)).resize((1180,980),Image.Resampling.LANCZOS).save(OUT/'review'/name)
Image.open(S/'runtime_after.png').convert('RGB').crop((485,255,725,455)).resize((1440,1200),Image.Resampling.LANCZOS).save(OUT/'review/03_extreme_closeup.png')
Image.open(S/'runtime_normal.png').convert('RGB').save(OUT/'review/04_normal_scale.png')
