"""Build editable, regional deformation animations in the connected Blender studio.
Run after importing/normalizing the three source meshes into Orbit Creature Studio.
Blender coordinates: Z up; crocodile/dragon heads face -Y.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models/orbital'
scene=bpy.data.scenes['Orbit Creature Studio']
bpy.context.window.scene=scene
scene.render.fps=30;scene.frame_start=1;scene.frame_end=181

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def shape(obj,name,fn):
    key=obj.shape_key_add(name=name)
    for original,vertex in zip(obj.data.shape_keys.key_blocks[0].data,key.data):
        vertex.co=fn(*original.co)
    return key

report=[]
for name in ['python','crocodile','dragon']:
    obj=bpy.data.objects[name]
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    obj.location=(0,0,0)
    if obj.data.shape_keys:obj.shape_key_clear()
    # The original high-density scans retain ~100k triangles and full 2K textures.
    if name!='dragon' and len(obj.data.polygons)>120000:
        dec=obj.modifiers.new('Web detail, preserve silhouette','DECIMATE');dec.ratio=.25
        bpy.ops.object.modifier_apply(modifier=dec.name)
    for poly in obj.data.polygons:poly.use_smooth=True
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:continue
        bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if bsdf:
            bsdf.inputs['Metallic'].default_value=0
            bsdf.inputs['IOR'].default_value=1.45
            for socket in ['Specular IOR Level','Coat Weight']:
                for link in list(bsdf.inputs[socket].links):mat.node_tree.links.remove(link)
            bsdf.inputs['Specular IOR Level'].default_value=.32
            bsdf.inputs['Coat Weight'].default_value=.06 if name=='python' else 0
            if name=='dragon':
                for link in list(bsdf.inputs['Roughness'].links):mat.node_tree.links.remove(link)
                bsdf.inputs['Roughness'].default_value=.66
                # Original scan's IOR=1000 was a conversion artifact, not reptile skin.
    obj.shape_key_add(name='Basis')
    if name=='dragon':
        def wing(x,y,z,angle):
            weight=smooth(.035,.14,abs(x))
            a=angle*weight
            dx=max(0,abs(x)-.035)
            return (math.copysign(.035+dx*math.cos(a),x) if abs(x)>.035 else x,y+dx*abs(a)*.10,z+dx*math.sin(a))
        shape(obj,'Wing lift',lambda x,y,z:wing(x,y,z,.72))
        shape(obj,'Power stroke',lambda x,y,z:wing(x,y,z,-.62))
        shape(obj,'Tail left',lambda x,y,z:(x+.045*smooth(.06,.34,y)**1.5,y,z+.018*smooth(.1,.34,y)))
        shape(obj,'Tail right',lambda x,y,z:(x-.045*smooth(.06,.34,y)**1.5,y,z-.014*smooth(.1,.34,y)))
        shape(obj,'Chest breath',lambda x,y,z:(x*(1+.035*math.exp(-((y+.04)/.11)**2)*math.exp(-(x/.06)**2)),y,z+.004*math.exp(-((y+.04)/.12)**2)*math.exp(-(x/.07)**2)))
    elif name=='crocodile':
        shape(obj,'Tail left',lambda x,y,z:(x+.10*smooth(.03,.48,y)**1.6,y,z+.012*smooth(.1,.5,y)))
        shape(obj,'Tail right',lambda x,y,z:(x-.10*smooth(.03,.48,y)**1.6,y,z-.008*smooth(.1,.5,y)))
        shape(obj,'Chest breath',lambda x,y,z:(x*(1+.045*math.exp(-((y+.08)/.17)**2)),y,z*(1+.09*math.exp(-((y+.08)/.17)**2))))
        shape(obj,'Paddle',lambda x,y,z:(x,y+.028*smooth(.055,.15,abs(x))*math.sin(y*14),z+.018*smooth(.055,.15,abs(x))))
        shape(obj,'Look',lambda x,y,z:(x+.018*smooth(.2,.46,-y),y,z+.014*smooth(.2,.46,-y)))
    else:
        shape(obj,'Chest breath',lambda x,y,z:(x*(1+.024*math.exp(-((y-.04)/.3)**2)),y,z+.012*math.exp(-((y-.04)/.27)**2)*smooth(-.1,.10,z)))
        shape(obj,'Coil left',lambda x,y,z:(x+.022*math.sin(y*7)*smooth(-.16,.18,z),y+.011*math.sin(x*8),z))
        shape(obj,'Coil right',lambda x,y,z:(x-.022*math.sin(y*7)*smooth(-.16,.18,z),y-.011*math.sin(x*8),z))
        shape(obj,'Tail left',lambda x,y,z:(x+.055*smooth(.24,.48,-y)**1.4,y,z+.018*smooth(.24,.48,-y)))
        shape(obj,'Tail right',lambda x,y,z:(x-.055*smooth(.24,.48,-y)**1.4,y,z-.012*smooth(.24,.48,-y)))
        shape(obj,'Look',lambda x,y,z:(x+.012*math.exp(-((x-.015)/.1)**2)*smooth(.08,.28,y)*smooth(.03,.13,z),y,z+.016*math.exp(-((x-.015)/.1)**2)*smooth(.08,.28,y)*smooth(.03,.13,z)))
    keys=obj.data.shape_keys.key_blocks
    for frame in range(1,182,6):
        t=(frame-1)/180*math.tau
        for key in list(keys)[1:]:
            if key.name=='Wing lift':v=max(0,math.sin(t*3))
            elif key.name=='Power stroke':v=max(0,-math.sin(t*3))
            elif key.name in ['Tail left','Coil left']:v=(1+math.sin(t+(0.7 if 'Coil' in key.name else 0)))*.5
            elif key.name in ['Tail right','Coil right']:v=(1-math.sin(t+(0.7 if 'Coil' in key.name else 0)))*.5
            elif key.name=='Chest breath':v=(1-math.cos(t*2))*.5
            elif key.name=='Paddle':v=(1+math.sin(t*2+.5))*.5
            else:v=(1-math.cos(t))*.5
            key.value=v;key.keyframe_insert(data_path='value',frame=frame)
    if obj.data.shape_keys.animation_data and obj.data.shape_keys.animation_data.action:
        obj.data.shape_keys.animation_data.action.name='Flight' if name=='dragon' else 'Living swim'
    scene.frame_set(1)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'-living.glb')),export_format='GLB',export_meshopt_compression_enable=True,use_selection=True,export_animations=True,export_morph=True,export_morph_normal=True,export_image_format='AUTO')
    report.append({'id':name,'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'morphs':[k.name for k in keys]})
# Keep an editable source scene, with the original user scene retained in the file.
for name,x in [('python',-1.4),('dragon',0),('crocodile',1.4)]:bpy.data.objects[name].location=(x,0,0)
scene.frame_set(16)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'.qa/living-creatures/orbit-creature-studio.blend'))
print(json.dumps(report))
