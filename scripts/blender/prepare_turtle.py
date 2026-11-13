"""Animate a CC0 turtle with independent shoulder strokes and rear steering."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
scene=bpy.data.scenes.get('Orbit Creature Studio')
if scene:bpy.context.window.scene=scene
# Always rebuild from the undeformed source, never a previously posed studio mesh.
old=bpy.data.objects.get('sea-turtle')
if old:bpy.data.objects.remove(old,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.import_scene.gltf(filepath=str(root/'.qa/orbital-sources/turtle-source.glb'))
obj=next(o for o in bpy.context.selected_objects if o.type=='MESH');obj.name='sea-turtle'
bpy.context.view_layer.objects.active=obj;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
lo=Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)]);center=(lo+hi)/2;factor=1/max(hi-lo)
for v in obj.data.vertices:v.co=(v.co-center)*factor
mod=obj.modifiers.new('Web silhouette','DECIMATE');mod.ratio=min(1,60000/len(obj.data.polygons));bpy.ops.object.modifier_apply(modifier=mod.name)
obj.location=(0,0,0)
if obj.data.shape_keys:obj.shape_key_clear()
for poly in obj.data.polygons:poly.use_smooth=True
obj.shape_key_add(name='Basis',from_mix=False)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
report={}
for side,label in [(-1,'Left'),(1,'Right')]:
 for stroke,angle,sweep in [('recovery',.38,.012),('power',-.46,-.018)]:
  key=obj.shape_key_add(name=f'{label} front {stroke}',from_mix=False)
  greatest=0
  for base,v in zip(obj.data.shape_keys.key_blocks[0].data,key.data):
   x,y,z=base.co
   if x*side<=0:continue
   # Shoulder wedge separates the flipper from the rigid shell and plastron.
   w=smooth(0,.065,abs(x)-(.14+.50*(y+.20)))*(1-smooth(-.015,.055,y))*(1-smooth(.02,.09,z))
   a=angle*w;dx=abs(x)-.13;dz=z+.035
   v.co=(side*(.13+dx*math.cos(a)-dz*math.sin(a)),y+sweep*w,-.035+dx*math.sin(a)+dz*math.cos(a))
   greatest=max(greatest,(v.co-base.co).length)
  report[key.name]=greatest
 for direction,sign in [('out',1),('in',-1)]:
  key=obj.shape_key_add(name=f'{label} rear {direction}',from_mix=False)
  for base,v in zip(obj.data.shape_keys.key_blocks[0].data,key.data):
   x,y,z=base.co
   if x*side<=0:continue
   w=smooth(.22,.31,y)*smooth(.065,.14,abs(x));a=sign*.12*w
   dx=abs(x)-.105;dy=y-.27
   v.co=(side*(.105+dx*math.cos(a)-dy*math.sin(a)),.27+dx*math.sin(a)+dy*math.cos(a),z+sign*.016*w)
scene.render.fps=30;scene.frame_start=1;scene.frame_end=145
for frame in range(1,146,3):
 t=(frame-1)/144
 for key in list(obj.data.shape_keys.key_blocks)[1:]:
  phase=(t+(.025 if key.name.startswith('Left') else -.025))%1
  if 'front recovery' in key.name:v=math.sin(math.pi*phase/.42)**2 if phase<.42 else 0
  elif 'front power' in key.name:v=math.sin(math.pi*(phase-.36)/.34)**2 if .36<phase<.70 else 0
  else:v=(1+math.sin(math.tau*(phase-.14)+(0 if 'out' in key.name else math.pi)))*.5
  key.value=v;key.keyframe_insert(data_path='value',frame=frame)
obj.data.shape_keys.animation_data.action.name='Shoulder stroke and glide'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/orbital/turtle-living.glb'),export_format='GLB',use_selection=True,export_animations=True,export_morph=True,export_morph_normal=True,export_meshopt_compression_enable=True)
obj.location=(2.8,0,0)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'.qa/living-creatures/orbit-creature-studio.blend'))
print(json.dumps({'vertices':len(obj.data.vertices),'tipDisplacement':report,'cycleSeconds':4.8}))
