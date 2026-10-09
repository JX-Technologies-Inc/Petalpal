"""Fixed restored bridge, camera-only orbit. --verify, --azimuth 37.5, or --serve."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import threading

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUTPUT = HERE.parent / 'rendered'
RUNTIME = ROOT / 'mobile/assets/garden/decorations/bridge/rendered'
# This is the unchanged source of the approved restored PNG. The later master
# has different geometry and must NOT silently replace this approved proxy.
SOURCE = HERE / 'bridge_master.before-authoring.blend'
BLENDER = os.environ.get('BLENDER_EXE',r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def render(angles, verification):
    import bpy
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene
    root = bpy.data.objects['Bridge_World_Yaw']
    camera = bpy.data.objects['PetalPal_Garden_Camera']
    reference = json.loads((OUTPUT/'bridge_camera_55.json').read_text())
    target = Vector(reference['camera']['target'])
    radius = 12.0
    def geometry_signature():
        records=[]
        for ob in sorted([root,*root.children_recursive],key=lambda o:o.name):
            record={'name':ob.name,'matrix':[v for row in ob.matrix_local for v in row]}
            if ob.type=='MESH':
                record['vertices']=[list(v.co) for v in ob.data.vertices]
                record['faces']=[list(p.vertices) for p in ob.data.polygons]
            if ob.type=='CURVE':
                record['points']=[[list(p.co) for p in s.points] for s in ob.data.splines]
            records.append(record)
        return hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest()
    original = geometry_signature()
    transform = [v for row in root.matrix_world for v in row]
    protected = {str(p):sha(p) for p in [SOURCE,HERE/'bridge_master.blend',HERE.parent/'bridge-main.png',OUTPUT/'bridge_camera_55.png',OUTPUT/'bridge_camera_55.json']}
    assert camera.data.type=='ORTHO' and abs(camera.data.ortho_scale-7.8)<1e-5
    assert (scene.render.resolution_x,scene.render.resolution_y)==(1536,1280)
    for angle in angles:
        a=math.radians(angle)
        camera.location=target+Vector((radius*math.sin(a),-radius*math.cos(a),radius*math.tan(math.radians(55))))
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.camera=camera
        bpy.context.view_layer.update()
        assert geometry_signature()==original, 'Bridge geometry or transform changed'
        def project(local):
            p=world_to_camera_view(scene,camera,root.matrix_world@Vector(local))
            return {'x':p.x*1536,'y':(1-p.y)*1280}
        anchor=project((0,0,0))
        def delta(local):
            p=project(local)
            return {k:p[k]-anchor[k] for k in ('x','y')}
        meta={**reference,'cameraAzimuthDegrees':angle,'anchor':anchor,
          'projection':{'along':delta((3,0,0)),'across':delta((0,1,0)),'elevation':delta((0,0,.42))},
          'camera':{'type':'ORTHO','elevationDegrees':55,'azimuthDegrees':angle,'orbitRadius':radius,'target':list(target),'location':list(camera.location),'orthoScale':camera.data.ortho_scale},
          'placement':{'x':1722,'y':1342,'scale':.1753},
          'projectedMarkers':{n:delta(bpy.data.objects[n].location) for n in ('EntryA','Crest','EntryB')},
          'sourceBlend':SOURCE.name,'sourceSha256':sha(SOURCE),'fixedGeometrySha256':original,'fixedBridgeTransform':transform}
        # Local path is deliberately copied unchanged from the restored metadata.
        meta.pop('alignment',None)
        name='bridge_orbit_verify_'+str(int(angle)) if verification else 'bridge_current_view'
        folder=OUTPUT/'orbit_verification' if verification else OUTPUT
        folder.mkdir(exist_ok=True)
        pending=folder/(name+'.pending.png')
        scene.render.film_transparent=True
        scene.render.image_settings.file_format='PNG'
        scene.render.image_settings.color_mode='RGBA'
        scene.render.filepath=str(pending)
        bpy.ops.render.render(write_still=True)
        assert geometry_signature()==original
        png=folder/(name+'.png')
        os.replace(pending,png)
        meta['imageSha256']=sha(png)
        metadata=folder/(name+'.json')
        metadata.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
        if not verification:
            for source in (png,metadata):
                temp=RUNTIME/(source.name+'.pending')
                temp.write_bytes(source.read_bytes())
                os.replace(temp,RUNTIME/source.name)
        print('VIEW_RENDERED',angle,original,flush=True)
    assert all(sha(Path(p))==digest for p,digest in protected.items())
    # Never save a blend: only camera/view metadata is persisted externally.

def invoke(angle=None, verification=False):
    command=[BLENDER,'--background',str(SOURCE),'--python-exit-code','1','--python',str(Path(__file__).resolve()),'--','--inside']
    command+=['--verify'] if verification else ['--azimuth',str(angle)]
    subprocess.run(command,check=True)

def serve():
    from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
    busy=threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        def allowed(self):
            return self.headers.get('Origin') in ('http://localhost:8082','http://127.0.0.1:8082') and self.headers.get('Host') in ('127.0.0.1:8766','localhost:8766')
        def reply(self,status,data):
            self.send_response(status)
            if self.allowed():
                self.send_header('Access-Control-Allow-Origin',self.headers['Origin'])
                self.send_header('Vary','Origin')
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        def do_OPTIONS(self):
            if not self.allowed(): return self.reply(403,{'error':'Origin not allowed'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin',self.headers['Origin'])
            self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers','Content-Type')
            self.end_headers()
        def do_POST(self):
            if not self.allowed() or self.path!='/render-view':return self.reply(403,{'error':'Not allowed'})
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<256:raise ValueError('Invalid request size')
                angle=json.loads(self.rfile.read(size))['cameraAzimuthDegrees']
                if isinstance(angle,bool) or not isinstance(angle,(int,float)) or not math.isfinite(angle) or not 0<=angle<=360:raise ValueError('Azimuth must be 0-360')
            except (ValueError,KeyError,TypeError) as error:return self.reply(400,{'error':str(error)})
            if not busy.acquire(blocking=False):return self.reply(409,{'error':'A view render is already running'})
            try:
                invoke(angle)
                self.reply(200,{'cameraAzimuthDegrees':angle})
            except Exception as error:self.reply(500,{'error':str(error)})
            finally:busy.release()
    print('Bridge view helper: http://127.0.0.1:8766 (local DEV only)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8766),Handler).serve_forever()

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--azimuth',type=float,default=0)
    parser.add_argument('--verify',action='store_true')
    parser.add_argument('--serve',action='store_true')
    parser.add_argument('--inside',action='store_true')
    opts=parser.parse_args(args)
    if not math.isfinite(opts.azimuth) or not 0<=opts.azimuth<=360:parser.error('Azimuth must be 0-360')
    if opts.inside:render([0,45,90,135] if opts.verify else [opts.azimuth],opts.verify)
    elif opts.serve:serve()
    else:invoke(opts.azimuth,opts.verify)
