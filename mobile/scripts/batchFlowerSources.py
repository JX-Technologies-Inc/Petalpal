"""Explicit mappings from visually inspected labels; never infer species from UUID names."""
A='Resources/Garden Flowers/59ec5368-7656-4110-9742-d3b36213429e.png'
B='Resources/Garden Flowers/121213a0-fabc-42af-9580-3f7383f17583.png'
C='Resources/Garden Flowers/Coreopsis/coreopsis.png'
# Species, class, morphology, source, inspected soil-rooted piece rectangles and bases.
# Each piece keeps its original foliage/stems. Detached heads and huge bottom bushes are excluded.
SPECS=[
 ('COREOPSIS','S','airy branching yellow flowers',C,[
  ('sparse/upright',(150,291,345,459),(244,446)),('sparse/side',(363,279,564,465),(462,451)),('sparse/branching',(563,282,806,469),(686,453))]),
 ('DAISY','S','small irregular white flowering stems',A,[
  ('single/upright',(314,46,405,190),(375,177)),('single/branching',(397,48,503,191),(437,171)),('single/side',(494,45,606,191),(539,174))]),
 ('GERBERA_DAISY','M','broad pink focal blooms',A,[
  ('single/upright',(603,43,710,202),(670,181)),('single/side',(704,43,803,201),(750,187)),('single/leaning',(832,46,922,204),(867,178))]),
 ('SUNFLOWER','L','tall focal yellow heads',A,[
  ('single/upright',(919,43,1052,211),(985,175)),('partial/opening',(1035,46,1111,200),(1078,180)),('single/side',(1099,56,1173,199),(1130,169))]),
 ('ANEMONE','M','open flowers on light stems',A,[
  ('single/pink',(1225,46,1338,219),(1304,196)),('single/white',(1320,45,1409,200),(1368,184)),('single/purple',(1431,42,1536,202),(1472,189))]),
 ('BLUEBELL','S','drooping bell stems',A,[
  ('single/drooping',(7,545,121,730),(72,711)),('single/branching',(147,558,244,728),(196,710)),('foliage/upright',(234,550,298,725),(263,709))]),
 ('HEATHER','S','fine vertical branching spikes',A,[
  ('single/tall',(310,538,391,738),(359,724)),('single/narrow',(381,569,448,721),(422,707)),('single/branching',(519,536,606,736),(557,718))]),
 ('SNOWDROP','S','small downward white bells',A,[
  ('single/left',(610,551,716,727),(674,712)),('single/center',(699,557,802,727),(769,712)),('single/right',(790,563,909,737),(856,719))]),
 ('GENTIAN','M','upright trumpet flowers',A,[
  ('single/open',(932,553,1026,726),(991,710)),('bud/upright',(1021,560,1094,711),(1067,693)),('single/side',(1122,551,1228,725),(1185,709))]),
 ('PETUNIA','M','open asymmetric pink trumpets',A,[
  ('single/open',(1230,551,1346,721),(1298,705)),('bud/upright',(1338,551,1409,711),(1375,694)),('single/branching',(1402,544,1536,713),(1458,694))]),
 ('POPPY','M','delicate papery bloom stems',B,[
  ('single/open',(16,52,123,249),(79,221)),('single/side',(204,53,318,230),(268,213)),('bud/upright',(116,57,161,217),(138,203))]),
 ('BIRD_OF_PARADISE','L','architectural leaves and angular blooms',B,[
  ('single/left',(322,48,466,256),(425,239)),('single/right',(449,51,626,238),(530,213))]),
 ('WHITE_ROSE','M','compact layered white blooms and foliage',B,[
  ('single/open',(624,53,729,231),(657,211)),('bud/left',(716,49,792,218),(752,199)),('bud/right',(777,55,918,224),(850,204))]),
 ('YELLOW_DAFFODIL','M','upright yellow trumpets and narrow leaves',B,[
  ('single/left',(927,49,1034,250),(993,236)),('single/center',(1022,55,1108,236),(1051,214)),('single/side',(1149,47,1236,251),(1179,233))]),
 ('ASTER','S','small purple daisy-like stems',B,[
  ('single/open',(1240,46,1352,241),(1309,222)),('bud/branching',(1341,49,1441,217),(1383,199)),('bud/side',(1424,52,1531,206),(1481,185))]),
 ('DANDELION','S','yellow blooms and occasional seed heads',B,[
  ('single/yellow',(0,548,165,748),(78,720)),('bud/upright',(154,580,195,732),(170,710)),('single/seed_head',(196,546,270,733),(235,692))]),
 ('YELLOW_RAPESEED_FLOWER','S','airy yellow flowering branches',B,[
  ('single/branching',(320,548,441,739),(385,726)),('single/narrow',(424,553,480,732),(461,715)),('single/side',(472,547,611,739),(544,723))]),
 ('CHINESE_VIOLET_CRESS','S','light purple open stems',B,[
  ('single/branching',(623,547,771,751),(690,731)),('bud/narrow',(755,552,805,733),(775,716)),('single/side',(802,551,915,730),(812,720))]),
 ('LAVENDER','S','narrow vertical purple spikes',B,[
  ('single/left',(925,548,1036,747),(978,731)),('single/center',(1022,545,1124,737),(1089,718)),('single/right',(1109,556,1223,737),(1171,716))]),
 ('OLIVE','M','foliage/branch form, not a flower bush',B,[
  ('branch/green_olive',(1234,551,1362,746),(1298,725)),('branch/dark_olive',(1342,551,1427,739),(1379,719)),('branch/leafy',(1411,538,1536,744),(1472,726))]),
]

PROTECTED={'TULIP','CHAMOMILE','HYDRANGEA'}
