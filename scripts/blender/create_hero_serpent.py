"""Reproducible original pearlescent serpent for the orbital hero.

Run: blender --background --factory-startup --python scripts/blender/create_hero_serpent.py
Optional: -- --draft (omit the small overlapping scale plates for fast framing).
Coordinates in this source: Blender Z up, -Y towards the viewer. glTF is +Y up, +Z forward.
All geometry and materials are original and generated here. No image planes are used.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/hero'
ART = ROOT / 'art'
QA = ROOT / '.qa/hero-serpent'
for folder in [OUT, ART, QA]: folder.mkdir(parents=True, exist_ok=True)
DRAFT = '--draft' in sys.argv
TAU = math.tau
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'Amethyst Serpent — Original Anatomical Study'
scene.unit_settings.system = 'METRIC'

def clamp(x, a=0, b=1): return min(b, max(a, x))
def smooth(a, b, x):
    t = clamp((x-a)/(b-a)); return t*t*(3-2*t)
def lerp(a, b, t): return a+(b-a)*t

def material(name, color, rough=.38, metal=.15, coat=.32):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Roughness'].default_value = rough
    n.inputs['Metallic'].default_value = metal
    n.inputs['IOR'].default_value = 1.46
    n.inputs['Coat Weight'].default_value = coat
    n.inputs['Coat Roughness'].default_value = .22
    return m

skin = material('Amethyst pearl · overlapping scales', (.39,.20,.55), .34,.28,.48)
shadow_skin = material('Elastic violet skin between the scales', (.19,.075,.27),.48,.10,.18)
head_skin = material('Pearl cranial skin shields',(.43,.27,.56),.34,.24,.45)
lip_skin = material('Amethyst labial jaw skin shields',(.35,.19,.48),.40,.12,.40)
mouth = material('Soft rose oral mucosa',(.26,.045,.11),.34,0,.38)
gum = material('Gum and palatal ridges',(.40,.10,.19),.36,0,.32)
throat = material('Deep unlit throat',(.026,.004,.017),.6,0,0)
fang_mat = material('Translucent warm ivory teeth',(.78,.68,.52),.25,.02,.5)
tongue_mat = material('Forked violet tongue',(.25,.018,.13),.25,.0,.55)
iris_mat = material('Living violet iris',(.26,.07,.48),.22,.25,.7)
pupil_mat = material('Deep vertical pupil',(.003,.002,.009),.12,0,.8)
nostril_mat = material('Recessed nostril',(.035,.012,.045),.67,0,0)

def add_microtexture(mat, scale, strength):
    nodes = mat.node_tree.nodes; links = mat.node_tree.links
    tex = nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=scale
    tex.inputs['Detail'].default_value=3; tex.inputs['Roughness'].default_value=.68
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=strength
    bump.inputs['Distance'].default_value=.012
    links.new(tex.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
for m in [skin, head_skin, lip_skin]: add_microtexture(m, 210, .13)

def mesh(name, vertices, faces, mat, parent=None, colors=None):
    data = bpy.data.meshes.new(name); data.from_pydata(vertices,[],faces); data.update()
    obj = bpy.data.objects.new(name,data); scene.collection.objects.link(obj)
    if parent: obj.parent=parent
    if colors:
        mat=mat.copy();mat.name += ' · vertex tint'
    obj.data.materials.append(mat)
    for p in data.polygons: p.use_smooth=True
    if colors:
        attr=data.color_attributes.new(name='PearlVariation',type='FLOAT_COLOR',domain='POINT')
        for entry,color in zip(attr.data,colors): entry.color=(*color,1)
        if not mat.get('vertex_color'):
            vcol=mat.node_tree.nodes.new('ShaderNodeVertexColor');vcol.layer_name='PearlVariation'
            mat.node_tree.links.new(vcol.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
            mat['vertex_color']=True
    return obj

def empty(name, parent=None, position=(0,0,0)):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj)
    if parent:obj.parent=parent
    obj.location=position;return obj

def ellipsoid(name,center,radii,mat,parent=None,segments=40,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=(0,0,0))
    obj=bpy.context.object;obj.name=name
    if parent:obj.parent=parent
    obj.location=center;obj.scale=radii;obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def tube(name, points, radii, mat, parent=None, sides=12):
    pts=[Vector(p) for p in points];vs=[];fs=[]
    for i,p in enumerate(pts):
        direction=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        n=direction.cross(Vector((0,1,0)))
        if n.length<.1:n=direction.cross(Vector((1,0,0)))
        n.normalize();b=direction.cross(n).normalized()
        radius=radii[i] if isinstance(radii,list) else radii
        for j in range(sides):
            a=j/sides*TAU;vs.append(p+(n*math.cos(a)+b*math.sin(a))*radius)
        if i:
            for j in range(sides):
                a=(i-1)*sides+j;c=(i-1)*sides+(j+1)%sides
                fs.append((a,c,c+sides,a+sides))
    fs.append(tuple(range(sides-1,-1,-1)));fs.append(tuple((len(pts)-1)*sides+j for j in range(sides)))
    return mesh(name,vs,fs,mat,parent)

def catmull(a,b,c,d,t):
    return (b*2+(c-a)*t+(a*2-b*5+c*4-d)*t*t+(-a+b*3-c*3+d)*t*t*t)*.5

HEAD = Vector((-.90,-.45,2.10))
poses = {
    'rest': {'offset':Vector((0,0,0)),'angle':.24},
    'recoil': {'offset':Vector((.25,.70,-.15)),'angle':-.20},
    'strike': {'offset':Vector((.78,-3.00,-.40)),'angle':.06},
}
head_rig = empty('HeadRig',position=HEAD)

# The long axis follows an organically asymmetrical S; the final neck is tangent
# to the skull rather than merely intersecting a spherical head primitive.
controls=[(-2.05,.35,-2.8),(-1.55,.52,-2.72),(-.50,.66,-2.47),(.72,.62,-2.08),
 (1.52,.25,-1.62),(1.57,-.15,-1.17),(.81,-.36,-.86),(-.43,-.29,-.59),
 (-1.45,.0,-.19),(-1.55,.38,.38),(-.80,.72,.86),(.41,.80,1.18),
 (1.24,.66,1.65),(1.05,.40,2.16),(.38,.20,2.49),(-.42,.20,2.52),
 (-.87,.19,2.30),(-.90,-.08,2.12),(-.90,-.30,2.10)]
controls=[Vector(p) for p in controls]
raw=[]
for i in range(len(controls)-1):
    for j in range(90):raw.append(catmull(controls[max(0,i-1)],controls[i],controls[i+1],controls[min(i+2,len(controls)-1)],j/90))
raw.append(controls[-1]);lengths=[0]
for a,b in zip(raw,raw[1:]):lengths.append(lengths[-1]+(b-a).length)
def at(t):
    import bisect
    d=clamp(t)*lengths[-1];i=max(0,min(len(raw)-2,bisect.bisect_right(lengths,d)-1))
    return raw[i].lerp(raw[i+1],(d-lengths[i])/max(.00001,lengths[i+1]-lengths[i]))
# Parallel-transport the cross section through the whole curve. A camera-facing
# frame becomes singular when the neck points at the lens and twists polygons.
transport=[];previous_tangent=None;normal=None
for sample in range(2001):
    t=sample/2000;tangent=(at(min(1,t+.0003))-at(max(0,t-.0003))).normalized()
    if previous_tangent is None:
        normal=Vector((0,-1,0));normal=(normal-tangent*normal.dot(tangent)).normalized()
    else:
        normal=previous_tangent.rotation_difference(tangent)@normal
        normal=(normal-tangent*normal.dot(tangent)).normalized()
    transport.append((normal.copy(),tangent.cross(normal).normalized()))
    previous_tangent=tangent
def frame(t):
    f=clamp(t)*2000;i=min(1999,int(f));mix=f-i
    n=transport[i][0].lerp(transport[i+1][0],mix).normalized()
    b=transport[i][1].lerp(transport[i+1][1],mix).normalized()
    return at(t),n,b
def radius(t):
    tail=.012+.325*smooth(0,.22,t)
    taper=1-.24*smooth(.84,1,t)
    return tail*taper*(1+.05*math.sin(t*TAU*2))
def surface(t,angle,lift=0):
    p,n,b=frame(t);r=radius(t)+lift
    return p+n*(math.cos(angle)*r*.96)+b*(math.sin(angle)*r)
def deform(p,t,pose):
    w=smooth(.68,1,t)
    moved=HEAD+Matrix.Rotation(pose['angle'],3,'X')@(Vector(p)-HEAD)+pose['offset']
    return Vector(p).lerp(moved,w)
vertices=[];faces=[];params=[];colors=[];material_ids=[]
rows=210 if not DRAFT else 120;sides=48
for i in range(rows+1):
    t=i/rows
    for j in range(sides):
        vertices.append(surface(t,j/sides*TAU));params.append(t);colors.append((.17,.055,.24))
        if i:
            a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides));material_ids.append(1)
faces.append(tuple(range(sides-1,-1,-1)));material_ids.append(1)
# The neck end stays open: its interior continues into the oral funnel.
if not DRAFT:
    # Bevelled shields overlap in staggered rows. The broad outer perimeter,
    # raised inner ring and domed centre are geometry, not painted normals.
    scale_rows=190;around=28
    outline=[(-.48,-.26),(-.24,-.49),(.24,-.49),(.48,-.26),(.38,.28),(0,.61),(-.38,.28)]
    for row in range(scale_rows):
        t=.035+(row+.5)/scale_rows*.965
        for col in range(around):
            angle=(col+(row%2)*.5)/around*TAU
            ds=.965/scale_rows;da=TAU/around;start=len(vertices)
            shade=.82+.15*math.sin(row*.71+col*2.7)+.035*math.sin(row*5+col*7)
            pearl=.5+.5*math.sin(t*32+math.cos(angle*3)*1.2)
            color=(lerp(.33,.63,pearl)*shade,lerp(.17,.40,pearl)*shade,lerp(.46,.73,pearl)*shade)
            for shrink,lift in [(1,.002),(.70,.005)]:
                for x,y in outline:
                    st=clamp(t+y*ds*shrink);vertices.append(surface(st,angle+x*da*shrink,lift*max(.1,radius(st)/.33)))
                    params.append(st);colors.append(color)
            vertices.append(surface(t,angle,.008));params.append(t);colors.append(tuple(c*1.04 for c in color))
            for k in range(7):
                q=(k+1)%7
                faces.append((start+k,start+q,start+7+q,start+7+k));material_ids.append(0)
                faces.append((start+7+k,start+7+q,start+14));material_ids.append(0)
body=mesh('SerpentBody',[deform(p,t,poses['rest']) for p,t in zip(vertices,params)],faces,skin,colors=colors)
body.data.materials.append(shadow_skin)
for p,i in zip(body.data.polygons,material_ids):p.material_index=i
body.shape_key_add(name='Basis')
for name in ['recoil','strike']:
    key=body.shape_key_add(name=name)
    for data,p,t in zip(key.data,vertices,params):data.co=deform(p,t,poses[name])

# Cranial loft: a broad posterior jaw, lifted orbital brow and tapered nose.
profile=[(.43,.235,.18,.065),(.28,.33,.25,.080),(.08,.45,.34,.085),
 (-.18,.46,.36,.080),(-.43,.405,.29,.070),(-.69,.34,.24,.055),
 (-.94,.29,.18,.035),(-1.10,.24,.13,.018),(-1.19,.10,.075,.005),(-1.205,.015,.03,0)]
def skull(y,angle,lift=0):
    index=next((i for i in range(len(profile)-1) if profile[i][0]>=y>=profile[i+1][0]),len(profile)-2)
    a=profile[index];b=profile[index+1];t=clamp((a[0]-y)/(a[0]-b[0]))
    before=profile[max(0,index-1)];after=profile[min(len(profile)-1,index+2)]
    def channel(k):
        delta=b[0]-a[0]
        m0=(b[k]-before[k])/(b[0]-before[0])*delta
        m1=(after[k]-a[k])/(after[0]-a[0])*delta
        return (2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*m1
    width=channel(1);height=channel(2);z=channel(3)
    sin=math.sin(angle);cos=math.cos(angle)
    px=cos*(width+lift)
    # Ventral skull flattened into an anatomical mouth roof.
    pz=z+(height if sin>=0 else .105*smooth(0,.30,width))*(sin)+lift*sin
    return Vector((px,y,pz))
hv=[];hf=[];hc=[];hrows=64;hsides=64
for i in range(hrows+1):
    y=lerp(.43,-1.205,i/hrows)
    for j in range(hsides):
        a=j/hsides*TAU;hv.append(skull(y,a));hc.append((.43,.27,.56))
        if i:
            s=(i-1)*hsides+j;q=(i-1)*hsides+(j+1)%hsides
            if not (hsides*7/12 <= j < hsides*11/12):hf.append((s,q,q+hsides,s+hsides))
# Open posterior skull joins the hollow neck without a visible end-cap.
hf.append(tuple(hrows*hsides+j for j in range(hsides)))
mesh('Cranium',hv,hf,head_skin,head_rig,colors=hc)
if not DRAFT:
    sv=[];sf=[];sc=[]
    for row in range(22):
        y=lerp(.31,-1.12,(row+.5)/22)
        for col in range(21):
            angle=.04+(col+(row%2)*.5)/21*(math.pi-.08)
            start=len(sv);size=.065 if y<-.8 else .077
            shade=.93+.09*math.sin(row*3.9+col*5.8)
            for dx,dy in [(-.45,-.36),(.05,-.50),(.47,-.28),(.42,.28),(0,.49),(-.43,.24)]:
                yy=clamp(y+dy*size,-1.20,.42);aa=angle+dx*.139
                sv.append(skull(yy,aa,.005));sc.append((.46*shade,.30*shade,.59*shade))
            sv.append(skull(y,angle,.015));sc.append((.50*shade,.33*shade,.63*shade))
            for k in range(6):sf.append((start+k,start+(k+1)%6,start+6))
    mesh('Cranial shield scales',sv,sf,head_skin,head_rig,colors=sc)

# The lower jaw rotates about a genuine posterior hinge, with the entire floor,
# lip, teeth and tongue following it. The head's dark seams remain separate.
jaw_pivot=Vector((0,.18,-.090))
jaw=empty('LowerJaw',head_rig,jaw_pivot)
def width_at(y):
    return abs(skull(y,0).x)*.96
jv=[];jf=[];jrows=48;jsides=40
for i in range(jrows+1):
    y=lerp(.12,-1.19,i/jrows);width=width_at(y)
    for j in range(jsides):
        a=j/jsides*TAU
        p=Vector((math.cos(a)*width,y,-.060+math.sin(a)*.065))
        # Closed jaw is slim beneath the broad, flat upper labial edge.
        jv.append(p-jaw_pivot)
        if i:
            s=(i-1)*jsides+j;q=(i-1)*jsides+(j+1)%jsides
            if j>=jsides//2:jf.append((s,q,q+jsides,s+jsides))
jf.append(tuple(jrows*jsides+j for j in range(jsides)))
mesh('Mandible',jv,jf,lip_skin,jaw)
# Low, broad ventral shields break up the lower jaw's reflected highlight.
uv=[];uf=[]
for row in range(14):
    y=lerp(.13,-1.10,(row+.5)/14)
    for col in range(9):
        a=math.pi+(col+.5)/9*math.pi;start=len(uv)
        for dy,da in [(-.037,-.16),(.037,-.16),(.037,.16),(-.037,.16),(0,0)]:
            yy=y+dy;aa=a+da;w=width_at(yy)
            p=Vector((math.cos(aa)*(w+.002),yy,-.060+math.sin(aa)*(.067 if da else .070)))
            uv.append(p-jaw_pivot)
        for k in range(4):uf.append((start+k,start+(k+1)%4,start+4))
mesh('Ventral jaw skin shields',uv,uf,lip_skin,jaw)

def mouth_sheet(name,lower=False):
    vs=[];fs=[];colors=[]
    for i in range(41):
        y=lerp(.08 if lower else .19,-1.16,i/40);w=width_at(y)*.88
        for j in range(25):
            u=j/24*2-1
            z=(-.060-.042*(1-u*u)) if lower else (skull(y,math.pi*7/6).z+.055*(1-u*u))
            p=Vector((u*w,y,z));vs.append(p-jaw_pivot if lower else p)
            depth=smooth(-.90,.20,y)*(1-abs(u)*.45)
            colors.append((lerp(.34,.045,depth),lerp(.065,.004,depth),lerp(.14,.025,depth)))
            if i and j:
                s=(i-1)*25+j-1;fs.append((s,s+1,s+26,s+25))
    return mesh(name,vs,fs,mouth,jaw if lower else head_rig,colors=colors)
mouth_sheet('Concave mouth roof');mouth_sheet('Lower mouth floor',True)
# A shaded concave funnel recedes into the neck. There is no opaque sphere
# or flat disk in the opening; the small rear end closes far behind the mouth.
tv=[];tf=[];tc=[]
for row in range(33):
    t=row/32;y=.075+t*.70
    flare=smooth(0,.18,t)
    rx=lerp(.365,.205,flare)*(1-.72*smooth(.18,1,t))
    rz=lerp(.205,.125,flare)*(1-.66*smooth(.18,1,t))
    for col in range(64):
        a=col/64*TAU
        ripple=1+.018*math.sin(a*11+t*13)*(1-t)
        tv.append((math.cos(a)*rx*ripple,y,-.035+math.sin(a)*rz*ripple))
        shade=(1-t)**2
        tc.append((.105*shade+.004,.015*shade+.002,.048*shade+.007))
        if row:
            b=(row-1)*64+col;c=(row-1)*64+(col+1)%64;tf.append((b,c,c+64,b+64))
tf.append(tuple(32*64+j for j in range(63,-1,-1)))
mesh('Receding throat lumen',tv,tf,throat,head_rig,colors=tc)
for side in [-1,1]:
    pts=[]
    for i in range(45):
        y=lerp(.16,-1.16,i/44);pts.append((side*width_at(y)*.94,y,-.064))
    tube('Upper labial seam '+str(side),pts,.010,nostril_mat,head_rig,8)
    tube('Upper gum rim '+str(side),[(x*.91,y,z-.002) for x,y,z in pts],.021,gum,head_rig,10)
    tube('Lower gum rim '+str(side),[Vector((x*.91,y,-.054))-jaw_pivot for x,y,z in pts],.018,gum,jaw,10)
    # Small labial shields form an organic segmented lip rather than one tube.
    for k in range(17):
        y=lerp(.08,-1.14,k/16);a=(TAU-.5) if side>0 else (math.pi+.5)
        plate=[skull(y+dy,a+da,.007) for dy,da in [(-.033,-.16),(.033,-.16),(.034,.14),(-.032,.14)]]
        plate.append(skull(y,a,.012))
        mesh('Labial skin plate',plate,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],lip_skin,head_rig)
    for k in range(7):
        y=lerp(-.1,-.98,k/6);x=side*width_at(y)*.80
        length=.08+.025*math.sin(k*.8)
        pts=[(x,y,-.075),(x*.96,y+.015,-.075-length*.5),(x*.90,y+.03,-.075-length)]
        tube('Upper palatal tooth',pts,[.025,.018,.001],fang_mat,head_rig,10)
        pts=[Vector((x,y,-.055))-jaw_pivot,Vector((x*.95,y+.02,-.005))-jaw_pivot,Vector((x*.88,y+.045,.035))-jaw_pivot]
        tube('Lower tooth',pts,[.020,.014,.001],fang_mat,jaw,9)
for k in range(9):
    y=lerp(-.83,.03,k/8);w=width_at(y)*.72
    points=[(u*w,y,-.062+.115*(1-u*u)) for u in [-1,-.75,-.5,-.25,0,.25,.5,.75,1]]
    tube('Palatal ruga '+str(k),points,.008,gum,head_rig,6)

for side,name in [(-1,'FangL'),(1,'FangR')]:
    fang=empty(name,head_rig,(side*.285,-.65,-.065))
    points=[];radii=[]
    for i in range(22):
        t=i/21
        points.append((side*.028*math.sin(t*math.pi*.7), .15*t*t, -.52*t))
        radii.append(.047*(1-t)**.7+.001)
    tube(name+' ivory',points,radii,fang_mat,fang,16)
    fang.rotation_euler.x=1.20

tongue_rig=empty('TongueRig',jaw,Vector((0,-.11,-.105))-jaw_pivot)
points=[(0,-i/20*.86,-.012*math.sin(i/20*math.pi)) for i in range(21)]
tube('Tongue stem',points,[.026*(1-i/20*.50) for i in range(21)],tongue_mat,tongue_rig,10)
for side in [-1,1]:
    points=[(side*.11*(i/15)**.8,-.84-i/15*.32,.015*math.sin(i/15*2)) for i in range(16)]
    tube('Tongue fork',points,[.013*(1-i/15)+.001 for i in range(16)],tongue_mat,tongue_rig,8)
tongue_rig.scale=(1,.38,1)

# The iris is a curved patch on an inset eye, with real radial fibre colour.
eye_shell=material('Corneal dark shell',(.012,.005,.020),.13,.02,.65)
for side,name in [(-1,'EyeL'),(1,'EyeR')]:
    center=Vector((side*.350,-.43,.205));normal=Vector((side*.78,-.55,.22)).normalized()
    ellipsoid(name,center,(.080,.080,.080),eye_shell,head_rig,48,32)
    u=normal.cross(Vector((0,0,1))).normalized();v=u.cross(normal).normalized()
    iv=[];iff=[];ic=[];rings=7;sectors=96
    for row in range(rings+1):
        radius=.066*row/rings
        for col in range(sectors):
            a=col/sectors*TAU
            iv.append(center+normal*math.sqrt(max(.001,.080**2-radius**2))+u*math.cos(a)*radius+v*math.sin(a)*radius)
            fibre=.5+.5*math.sin(col*14.71+row*.41);limbal=1-smooth(.78,1,row/rings)*.82
            ic.append(((.12+fibre*.22)*limbal,(.035+fibre*.065)*limbal,(.22+fibre*.23)*limbal))
            if row:
                b=(row-1)*sectors+col;c=(row-1)*sectors+(col+1)%sectors;iff.append((b,c,c+sectors,b+sectors))
    mesh(name+' iris fibres',iv,iff,iris_mat,head_rig,colors=ic)
    pupil=ellipsoid(name+' vertical slit',center+normal*.080,(.012,.004,.051),pupil_mat,head_rig,32,24)
    pupil.rotation_euler=normal.to_track_quat('Y','Z').to_euler()
    brow=[]
    for i in range(24):
        a=lerp(.02,math.pi-.02,i/23)
        brow.append(center+normal*.012+u*(math.cos(a)*.085)+v*(math.sin(a)*.073))
    tube(name+' supraorbital skin ridge',brow,[.015+.012*math.sin(i/23*math.pi) for i in range(24)],head_skin,head_rig,12)
    nostril=ellipsoid('Nostril '+str(side),(side*.18,-1.073,.12),(.023,.010,.014),nostril_mat,head_rig,24,16)
    nostril.rotation_euler=(.35,0,side*.25)

# Elastic cheek curtains connect upper and lower jaw. Half-open and fully-open
# morphs follow the hinge arc and remain continuous during the runtime gape.
cv=[];cf=[];cc=[];cheek_data=[]
for side in [-1,1]:
    base=len(cv)
    for row in range(25):
        t=row/24;y=lerp(.18,-.51,t);x=side*width_at(y)*.88
        top=Vector((x,y,-.057));bottom=Vector((x,y,-.065))
        for col in range(17):
            blend=col/16;p=top.lerp(bottom,blend)
            p.x+=side*math.sin(t*math.pi*11)*.005*math.sin(blend*math.pi)
            cv.append(p);cheek_data.append((top,bottom,blend,side,t))
            darkness=.4+.6*t
            cc.append((.25*darkness,.045*darkness,.105*darkness))
            if row and col:
                q=base+(row-1)*17+col-1;cf.append((q,q+1,q+18,q+17))
cheeks=mesh('CheekMembranes',cv,cf,mouth,head_rig,colors=cc)
cheeks.shape_key_add(name='Basis')
for keyname,angle in [('gapeHalf',.65),('gape',1.30)]:
    key=cheeks.shape_key_add(name=keyname);rot=Matrix.Rotation(angle,3,'X')
    for entry,(top,bottom,blend,side,t) in zip(key.data,cheek_data):
        opened=jaw_pivot+rot@(bottom-jaw_pivot)
        p=top.lerp(opened,blend)
        p.x+=side*math.sin(t*math.pi*11)*.009*math.sin(blend*math.pi)
        entry.co=p

# A compact four-second animation is also embedded for DCC previews. Runtime
# normally controls the exact same named morphs and pivots directly.
scene.render.fps=30;scene.frame_start=1;scene.frame_end=121
for frame_number,recoil,strike,opening in [(1,0,0,0),(40,1,0,.16),(66,.82,.18,1),(95,0,1,1),(121,0,1,.90)]:
    body.data.shape_keys.key_blocks['recoil'].value=recoil
    body.data.shape_keys.key_blocks['strike'].value=strike
    for key in list(body.data.shape_keys.key_blocks)[1:]:key.keyframe_insert('value',frame=frame_number)
    head_rig.location=HEAD+poses['recoil']['offset']*recoil+poses['strike']['offset']*strike
    head_rig.rotation_euler.x=poses['rest']['angle']*(1-recoil-strike)+poses['recoil']['angle']*recoil+poses['strike']['angle']*strike
    head_rig.keyframe_insert('location',frame=frame_number);head_rig.keyframe_insert('rotation_euler',frame=frame_number)
    jaw.rotation_euler.x=opening*1.30;jaw.keyframe_insert('rotation_euler',frame=frame_number)
    cheeks.data.shape_keys.key_blocks['gapeHalf'].value=max(0,1-abs(opening-.5)*2)
    cheeks.data.shape_keys.key_blocks['gape'].value=max(0,opening*2-1)
    for key in list(cheeks.data.shape_keys.key_blocks)[1:]:key.keyframe_insert('value',frame=frame_number)
    for name in ['FangL','FangR']:
        f=bpy.data.objects[name];f.rotation_euler.x=(1-opening)*1.20;f.keyframe_insert('rotation_euler',frame=frame_number)
    tongue_rig.scale.y=.38+.62*opening;tongue_rig.keyframe_insert('scale',frame=frame_number)
for obj in [head_rig,jaw,tongue_rig,bpy.data.objects['FangL'],bpy.data.objects['FangR']]:
    if obj.animation_data and obj.animation_data.action:obj.animation_data.action.name='Serpent strike'
if body.data.shape_keys.animation_data:body.data.shape_keys.animation_data.action.name='Serpent strike'
scene.frame_set(1)

model_objects=[o for o in scene.objects if o.type in {'MESH','EMPTY'}]
for o in scene.objects:o.select_set(False)
for o in model_objects:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUT/'serpent.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_morph=True,export_morph_normal=False,export_normals=True,
    export_image_format='AUTO',export_yup=True,export_materials='EXPORT')

def gltf(v):return [round(v[0],6),round(v[2],6),round(-v[1],6)]
bpy.context.view_layer.update()
rest_points=[gltf(o.matrix_world@v.co) for o in model_objects if o.type=='MESH' for v in o.data.vertices]
rest_min=[min(v[i] for v in rest_points) for i in range(3)]
rest_max=[max(v[i] for v in rest_points) for i in range(3)]
contract={
 'version':1,'source':'scripts/blender/create_hero_serpent.py','forward':'+Z','up':'+Y',
 'bounds':{'rest':{'min':rest_min,'max':rest_max}},
 'head':{name:{'position':gltf(HEAD+pose['offset']),'rotation':[pose['angle'],0,0]} for name,pose in poses.items()},
 'jaw':{'name':'LowerJaw','axis':'x','sign':1,'maxAngle':1.30,'pivot':gltf(jaw_pivot)},
 'fangs':{'names':['FangL','FangR'],'axis':'x','closedAngle':1.20,'openAngle':0},
 'morphNames':{'recoil':'recoil','strike':'strike'},'bodyName':'SerpentBody',
 'mouth':{'name':'CheekMembranes','halfMorph':'gapeHalf','fullMorph':'gape'},
 'eyes':['EyeL','EyeR'],'tongue':{'name':'TongueRig','axis':'z','restScale':.38,'extendedScale':1},
 'geometry':{'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in model_objects if o.type=='MESH'),'draft':DRAFT},
 'license':'Original procedural artwork created for ORBIT REPTILES. Source included.'
}
contract['head'].update({'name':'HeadRig','focusLocal':[0,-.35,.70],'frontLocal':[0,-.09,1.205],
 'width':.95,'openHeight':1.35})
(OUT/'serpent-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2))

# Studio and camera are saved in the source .blend, but excluded from the GLB.
world=bpy.data.worlds.new('Deep indigo studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.012,.006,.025,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.30;scene.world=world
def light(name,position,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=position
    o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
light('Pearl key',(-4,-6,7),900,(.84,.87,1),5)
light('Amethyst edge',(4,2,5),1200,(.55,.18,1),4)
light('Soft rose fill',(2,-4,0),450,(1,.38,.70),4)
camera_data=bpy.data.cameras.new('Anatomy portrait');camera=bpy.data.objects.new('Anatomy portrait',camera_data)
scene.collection.objects.link(camera);scene.camera=camera
camera.location=(0,-11,4.5);target=Vector((0,0,.1));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='PERSP';camera_data.lens=43
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'hero-serpent.blend'),compress=True)
scene.render.filepath=str(QA/('draft-full.png' if DRAFT else 'full.png'));bpy.ops.render.render(write_still=True)
scene.frame_set(66);camera.location=(.0,-7.2,2.1);target=Vector((-.55,-.4,2));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=82
scene.render.resolution_x=1000;scene.render.resolution_y=900
scene.render.filepath=str(QA/('draft-mouth.png' if DRAFT else 'mouth.png'));bpy.ops.render.render(write_still=True)
print('HERO_SERPENT_READY '+json.dumps(contract))
