from build_final import *
combined=Image.new('RGBA',WORLD)
records={}
for name,pts in [
 ('Central–Land0405',[[1320,430],[1340,410],[1374,389],[1400,375]]),
 ('Central–Land09',[[1215,955],[1217,1000],[1229,1048],[1230,1078]])]:
 layer,meta=grounded_road(pts);combined.alpha_composite(layer);records[name]=meta
combined.save(RUNTIME/'Road_ground_junctions.png')
(OUT/'approved_st01_finish/road_junctions.json').write_text(json.dumps(records,indent=2))
print(json.dumps(records))
