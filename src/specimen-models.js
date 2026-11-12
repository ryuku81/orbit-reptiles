import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, fully volumetric animal studies. The surface maps are generated from
// seeded patterns; no photograph or billboard is used for these specimens.
const TAU = Math.PI * 2;
function random(seed = 17) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const palettes = {
  lg: ['#b3ae96', '#ddd7bb', '#282728'],
  bp: ['#b87f2b', '#d5b35d', '#211b16'],
  cg: ['#7d3f20', '#c79b54', '#3c2416'],
  bd: ['#92612e', '#d2a665', '#483b2d'],
};

function skinMaps(species, head = false) {
  const [c, ctx] = canvas(1536, 768), [b, bump] = canvas(1536, 768);
  const rng = random(134 + species.charCodeAt(0) + (head ? 24 : 0));
  const [base, cream, ink] = palettes[species];
  ctx.fillStyle = base; ctx.fillRect(0, 0, c.width, c.height);
  const belly = ctx.createLinearGradient(0, 0, 0, c.height);
  belly.addColorStop(0, base); belly.addColorStop(.24, base); belly.addColorStop(.41, cream); belly.addColorStop(.59, cream); belly.addColorStop(.76, base); belly.addColorStop(1, base);
  ctx.fillStyle = belly; ctx.fillRect(0, 0, c.width, c.height);
  // Broad, irregular markings are under the very fine scale relief.
  if (head && species !== 'lg') {
    if(species==='bp'){
      ctx.fillStyle=ink;ctx.fillRect(0,0,1536,768);
      ctx.fillStyle=cream;ctx.fillRect(0,278,1536,212);
      for(const y of [175,585]) { ctx.strokeStyle=cream;ctx.lineWidth=24;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(420,y-50,1100,y+40,1536,y-18);ctx.stroke(); }
    }else{
      for(let i=0;i<1100;i++){ctx.fillStyle=i%3?'#30241428':'#efd09b35';const x=rng()*1536,y=rng()*768;ctx.beginPath();ctx.ellipse(x,y,1+rng()*6,1+rng()*5,rng(),0,TAU);ctx.fill();}
      if(species==='cg'){ctx.strokeStyle=cream;ctx.lineWidth=16;for(const y of [120,648]){ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(500,y-35,950,y+30,1536,y);ctx.stroke();}}
    }
  } else if (species === 'bp') {
    ctx.fillStyle = ink;
    for (let i = 0; i < 22; i++) {
      const x = i * 78 + (rng() - .5) * 32;
      for (const side of [0, 768]) {
        ctx.beginPath(); ctx.moveTo(x - 25, side);
        for (let j = 0; j <= 16; j++) {
          const a = j / 16 * Math.PI;
          ctx.lineTo(x + Math.cos(a) * (35 + rng() * 24), side + (side ? -1 : 1) * Math.sin(a) * (180 + rng() * 85));
        }
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = cream;
    for (let i = 0; i < 38; i++) { const x = rng() * 1536, y = rng() < .5 ? rng() * 130 : 768 - rng() * 130; ctx.beginPath(); ctx.ellipse(x, y, 12 + rng() * 24, 8 + rng() * 18, rng(), 0, TAU); ctx.fill(); }
  } else if (species === 'lg') {
    for (let i = 0; i < (head ? 145 : 195); i++) {
      const x = rng() * 1536, y = rng() * 768;
      if (y > 290 && y < 478) continue;
      ctx.fillStyle = rng() > .2 ? ink : '#5c5752';
      ctx.beginPath(); const r = (head ? 10 : 13) + rng() * (head ? 16 : 20);
      for (let j = 0; j <= 10; j++) { const a = j / 10 * TAU, rr = r * (.65 + rng() * .45); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .78); }
      ctx.closePath(); ctx.fill();
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const x = i * 180 + (rng() - .5) * 70;
      ctx.strokeStyle = species === 'cg' ? cream : ink; ctx.globalAlpha = species === 'cg' ? .68 : .28; ctx.lineWidth = 28 + rng() * 70;
      for (const side of [0, 768]) { ctx.beginPath(); ctx.moveTo(x, side); ctx.bezierCurveTo(x - 45, side + (side ? -90 : 90), x + 105, side + (side ? -150 : 150), x + 40, side + (side ? -245 : 245)); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    for(let i=0;i<1500;i++){ctx.fillStyle=i%2?'#3d2d1b20':'#e4c28d25';ctx.beginPath();ctx.ellipse(rng()*1536,rng()*768,2+rng()*9,2+rng()*7,rng(),0,TAU);ctx.fill();}
    if (species === 'cg') { ctx.fillStyle = cream; ctx.globalAlpha = .7; ctx.fillRect(0, 20, 1536, 24); ctx.fillRect(0, 724, 1536, 24); ctx.globalAlpha = 1; }
  }
  bump.fillStyle = '#777'; bump.fillRect(0, 0, b.width, b.height);
  const stepX = species === 'bp' ? 13 : 10, stepY = species === 'bp' ? 9 : 10;
  for (let row = 0; row < 768 / stepY + 1; row++) {
    for (let col = 0; col < 1536 / stepX + 1; col++) {
      const x = col * stepX + (row % 2) * stepX * .5, y = row * stepY, s = .72 + rng() * .26;
      ctx.fillStyle = rng() > .55 ? `rgba(255,241,211,${.035 + rng() * .09})` : `rgba(32,23,18,${.03 + rng() * .12})`;
      ctx.beginPath(); ctx.ellipse(x, y, stepX * .43 * s, stepY * .43 * s, 0, 0, TAU); ctx.fill();
      bump.fillStyle = `rgb(${160 + Math.floor(rng() * 70)},${160},${160})`;
      bump.beginPath(); bump.ellipse(x, y, stepX * .42 * s, stepY * .42 * s, 0, 0, TAU); bump.fill();
      bump.fillStyle = '#c8c8c8'; bump.beginPath(); bump.ellipse(x - .8, y - 1, stepX * .27 * s, stepY * .27 * s, 0, 0, TAU); bump.fill();
    }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(b); bumpMap.anisotropy = 4;
  return { map, bumpMap };
}

// Smooth cross sections let a single connected skin flow through neck, ribcage,
// pelvis and tapering tail. Unlike overlapping primitives, joints stay organic.
function bodyGeometry(sections, steps = 100, sides = 48) {
  const curves = [0, 1, 2, 3, 4].map(k => sections.map(s => s[k] || 0));
  function sample(k, t) {
    const n = t * (sections.length - 1), i = Math.min(sections.length - 2, Math.floor(n)), f = n - i;
    const a = curves[k][Math.max(0, i - 1)], b = curves[k][i], c = curves[k][i + 1], d = curves[k][Math.min(sections.length - 1, i + 2)];
    return .5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
  }
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = sample(0, t), y = sample(1, t), h = Math.max(.002, sample(2, t)), w = Math.max(.002, sample(3, t)), z = sample(4, t);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU, ca = Math.cos(a), sa = Math.sin(a);
      positions.push(x, y + ca * h * (ca < 0 ? .78 : 1), z + sa * w);
      uvs.push(t, j / sides);
      if (i < steps && j < sides) { const v = i * (sides + 1) + j, n = v + sides + 1; indices.push(v, v + 1, n, n, v + 1, n + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function tube(points, radii, segments = 48, sides = 14, flatten = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), frames = curve.computeFrenetFrames(segments, false);
  const p = [], uv = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, q = curve.getPointAt(t), f = t * (radii.length - 1), n = Math.min(radii.length - 2, Math.floor(f)), r = THREE.MathUtils.lerp(radii[n], radii[n + 1], f - n);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU, d = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      p.push(q.x + d.x * r, q.y + d.y * r * flatten, q.z + d.z * r); uv.push(t, j / sides);
      if (i < segments && j < sides) { const v = i * (sides + 1) + j, n = v + sides + 1; indices.push(v, v + 1, n, n, v + 1, n + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function irisMap(species) {
  const [c, ctx] = canvas(256, 256), rng = random(28);
  const g = ctx.createRadialGradient(128, 128, 15, 128, 128, 126); g.addColorStop(0, '#bc9e55'); g.addColorStop(.65, species === 'cg' ? '#ad814d' : '#9d8e5c'); g.addColorStop(1, '#251a13'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 200; i++) { const a = i / 200 * TAU; ctx.strokeStyle = rng() > .5 ? '#392b1c77' : '#f7da9677'; ctx.lineWidth = .5 + rng() * 2; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 20, 128 + Math.sin(a) * 20); ctx.lineTo(128 + Math.cos(a) * (95 + rng() * 30), 128 + Math.sin(a) * (95 + rng() * 30)); ctx.stroke(); }
  ctx.fillStyle = '#030303'; ctx.beginPath(); ctx.ellipse(128, 128, species === 'bd' ? 48 : 16, 101, 0, 0, TAU); ctx.fill();
  const m = new THREE.CanvasTexture(c); m.colorSpace = THREE.SRGBColorSpace; return m;
}

export function createSpecimen(species = 'lg', { nocturnal = false, tint = '#384143' } = {}) {
  if (!palettes[species]) species = 'lg';
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const legGroups = []; let activeParent = body;
  const maps = skinMaps(species), headMaps = skinMaps(species, true);
  const skin = new THREE.MeshPhysicalMaterial({ ...maps, roughness: .76, metalness: 0, bumpScale: .023, clearcoat: .06, clearcoatRoughness: .6 });
  const headSkin = new THREE.MeshPhysicalMaterial({ ...headMaps, roughness: .73, bumpScale: .018, clearcoat: .08, clearcoatRoughness: .55 });
  const cream = new THREE.MeshStandardMaterial({ color: palettes[species][1], roughness: .78, bumpMap: maps.bumpMap, bumpScale: .012 });
  const dark = new THREE.MeshStandardMaterial({ color: '#382d25', roughness: .9 });
  const nail = new THREE.MeshStandardMaterial({ color: '#bfb092', roughness: .5 });
  function mesh(geometry, material, position, scale, parent = activeParent) {
    const m = new THREE.Mesh(geometry, material); if (position) m.position.set(...position); if (scale) m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const snake = species === 'bp', dragon = species === 'bd', crest = species === 'cg';
  let headX, headY, headWidth;
  if (snake) {
    const pts = [[-1.47,.7,.58],[-1.12,.57,.38],[-.65,.33,.1],[.02,.18,-.18],[.93,.2,-.48],[1.48,.28,-.12],[1.45,.29,.68],[.8,.26,1.05],[-.2,.25,1.04],[-.92,.25,.7],[-1.24,.22,-.03],[-.9,.19,-.76],[-.1,.19,-.95],[.8,.21,-.78],[1.1,.42,-.18],[.86,.57,.32],[.13,.54,.49],[-.42,.48,.17],[-.52,.45,-.23],[-.16,.43,-.47],[.26,.42,-.27],[.29,.4,.06]];
    mesh(tube(pts,[.15,.25,.29,.31,.29,.27,.23,.18,.13,.04,.006],230,42,.94),skin);
    headX=-1.65; headY=.76; headWidth=.225;
    mesh(bodyGeometry([[-2.04,.74,.025,.045,.6],[-2.02,.77,.10,.15,.6],[-1.86,.79,.16,.215,.59],[-1.63,.78,.18,.24,.55],[-1.42,.72,.12,.135,.47]],45,36),headSkin);
  } else {
    headX=dragon?-1.48:-1.54; headY=dragon?.43:.51; headWidth=dragon?.44:crest?.24:.26;
    const h = dragon ? .255 : .26, w=dragon?.74:crest?.29:.37;
    mesh(bodyGeometry([[-1.44,.45,.12,.17,0],[-1.03,.36,.18,.21,0],[-.58,.32,h*.95,w*.83,0],[0,.32,h,w,0],[.57,.3,h*.84,w*.8,0],[.9,.24,.17,.22,.04],[1.18,.20,crest?.09:.18,.13,.16],[1.53,.18,crest?.065:dragon?.11:.21,crest?.065:dragon?.11:.20,.35],[1.92,.2,crest?.055:.13,crest?.055:.13,.56],[2.21,.22,.07,.07,.58],[2.45,.23,.004,.004,.4]],110,48),skin);
    const tip = dragon?-1.99:crest?-2.02:-2.01;
    const headSections=dragon?[[tip,headY-.035,.04,.08,0],[tip+.045,headY,.11,.14,0],[-1.8,headY+.015,.15,.23,0],[-1.55,headY+.01,.215,.42,0],[-1.30,headY-.01,.18,.40,0],[-1.12,.36,.13,.22,0]]:[[tip,headY-.035,.018,.04,0],[tip+.045,headY,.11,.15,0],[-1.8,headY+.03,.17,headWidth*.84,0],[-1.57,headY+.025,crest?.2:.19,headWidth,0],[-1.34,headY-.025,.15,headWidth*.85,0],[-1.21,.43,.13,.16,0]];
    mesh(bodyGeometry(headSections,52,42),headSkin);
    for (const side of [-1,1]) {
      const legs = [
        [[-.82,.35,side*.18],[-.77,.16,side*(dragon?.64:.46)],[-1.08,.075,side*(dragon?.82:.65)],[-1.3,.045,side*(dragon?.93:.78)]],
        [[.56,.29,side*.20],[.92,.15,side*(dragon?.73:.54)],[.61,.06,side*(dragon?.88:.76)],[.73,.035,side*(dragon?.99:.88)]],
      ];
      legs.forEach((points, index)=>{
        const limb=new THREE.Group();body.add(limb);activeParent=limb;
        mesh(tube(points,[index?.16:dragon?.15:.115,dragon?.155:.125,.068,.045],44,18),skin);
        const foot = points.at(-1);
        mesh(sphere,skin,[foot[0],foot[1],foot[2]],[.12,.045,.105]);
        for(let t=0;t<5;t++) {
          const a=(t-2)*.38, len=(t===0||t===4?.20:.29)*(dragon?1.1:1);
          const dx=Math.sin(a)*len-(index?-.02:.035), dz=side*Math.cos(a)*len;
          const start=[foot[0]+(t-2)*.025,.045,foot[2]], end=[foot[0]+dx,.026,foot[2]+dz];
          mesh(tube([start,[foot[0]+dx*.5,.03,foot[2]+dz*.53],end],[.025,.020,.009],16,8),skin);
          if(crest)mesh(sphere,cream,end,[.035,.014,.047]);
          else mesh(tube([end,[end[0]-.015,.02,end[2]+side*.04],[end[0]-.025,.032,end[2]+side*.065]],[.012,.008,.001],8,6),nail);
        }
        const hip=new THREE.Vector3(...points[0]);limb.position.copy(hip);
        for(const child of limb.children)child.position.sub(hip);
        legGroups.push({limb,side,index});activeParent=body;
      });
    }
  }
  // Recessed eyes, fine lids, nostrils and a closed jaw establish the face.
  const iris = new THREE.MeshPhysicalMaterial({ map:irisMap(species), roughness:.19, clearcoat:1, clearcoatRoughness:.05 });
  const eyeBlack = new THREE.MeshPhysicalMaterial({ color:'#080604', roughness:.08, clearcoat:1 });
  for(const side of [-1,1]) {
    const ex=snake?-1.77:crest?-1.62:dragon?-1.57:-1.64, ey=headY+(snake?.095:dragon?.14:.105), ez=snake?.59+side*.203:side*headWidth*(dragon?.72:.84);
    const er=snake?.073:crest?.124:dragon?.078:.096;
    mesh(sphere,eyeBlack,[ex,ey,ez],[er,er,er*.65]);
    const pupil=mesh(new THREE.CircleGeometry(er*.78,48),iris,[ex-.007,ey,ez+side*er*.58]);pupil.rotation.y=side<0?Math.PI:0;
    const eyelid=[];for(let j=0;j<=14;j++){const a=j/14*TAU;eyelid.push([ex+Math.cos(a)*er*1.04,ey+Math.sin(a)*er*1.05,ez+side*er*.36]);}
    mesh(tube(eyelid,[.012,.014],40,7),headSkin);
    const brow=[];for(let j=0;j<=9;j++){const a=j/9*Math.PI;brow.push([ex+Math.cos(a)*er*1.04,ey+Math.sin(a)*er*1.06,ez+side*er*.34]);}mesh(tube(brow,[.022,.018],24,8),headSkin);
    const mouthZ=snake?.59:0;
    const mx=snake?-2.03:-2.0;
    mesh(tube([[mx,headY-.065,mouthZ+side*.06],[mx+.17,headY-.095,mouthZ+side*headWidth*.76],[mx+.39,headY-.085,mouthZ+side*headWidth*.94],[mx+.58,headY-.075,mouthZ+side*headWidth*.72]],[.006,.004],30,5),dark);
    mesh(sphere,dark,[mx+.06,headY+.035,mouthZ+side*.13],[.017,.012,.007]);
    if(!snake)mesh(sphere,dark,[-1.33,headY+.025,side*headWidth*.85],[.026,.043,.006]);
    if(snake)for(let i=0;i<6;i++)mesh(sphere,dark,[-2.0+i*.055,headY-.025,.59+side*(.12+i*.011)],[.008,.011,.005]);
    if(crest) {
      for(let i=0;i<19;i++) {
        const t=i/18,x=-1.81+t*.95,z=side*(.18+Math.sin(t*Math.PI)*.055),y=headY+.18-t*.17;
        const spike=mesh(new THREE.ConeGeometry(.022,.09,5),cream,[x,y,z]);spike.rotation.x=side*.65;spike.rotation.z=.2;
      }
    }
    if(dragon) {
      for(let i=0;i<46;i++) {
        const t=i/45,x=-1.97+t*.87,z=side*(.10+Math.sin(t*Math.PI)*.36),y=headY-.10+Math.sin(t*17)*.025;
        const spike=mesh(new THREE.ConeGeometry(.018,.035+Math.sin(t*Math.PI)*.035+Math.sin(i*5.7)*.009,5),skin,[x,y,z]);spike.rotation.x=side*1.75;spike.rotation.z=-.55;
      }
      for(let i=0;i<45;i++) { const t=i/44,x=-.85+t*1.6,z=side*(.27+Math.sin(t*Math.PI)*.43); const spike=mesh(new THREE.ConeGeometry(.022,.085,5),cream,[x,.30,z]);spike.rotation.x=side*1.5; }
    }
  }
  // Raised tubercles are deliberately small and irregular, never metallic beads.
  if(!snake) {
    const rng=random(91), count=dragon?650:crest?150:300, scales=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,5),cream,count), dummy=new THREE.Object3D(), color=new THREE.Color();
    for(let i=0;i<count;i++) {
      const x=-.85+rng()*1.65,a=(rng()-.5)*Math.PI*1.1, f=Math.sqrt(Math.max(.05,1-(x/.99)**2));
      const h=dragon?.255:.26,w=dragon?.74:crest?.29:.37;
      dummy.position.set(x,.32+Math.cos(a)*h*f,Math.sin(a)*w*f);
      dummy.rotation.x=-a;const sz=.006+rng()*.008;dummy.scale.set(sz,sz*.4,sz);dummy.updateMatrix();scales.setMatrixAt(i,dummy.matrix);
      color.set(palettes[species][i%5===0?2:0]);color.offsetHSL(0,0,(rng()-.5)*.15);scales.setColorAt(i,color);
    }
    scales.castShadow=true;body.add(scales);
  }
  if(nocturnal){
    skin.color.set(tint);headSkin.color.set(tint).multiplyScalar(1.08);cream.color.set('#30352f');nail.color.set('#535a52');
    skin.roughness=.87;headSkin.roughness=.84;
  }
  // Merge static pieces by material, retaining four independently hinged legs.
  // This keeps the detailed toes and scale relief to a few draw calls per limb.
  const retiredGeometry=new Set();
  for(const parent of [body,...legGroups.map(l=>l.limb)]){
    const buckets=new Map();
    for(const child of [...parent.children]){
      if(!child.isMesh||child.isInstancedMesh)continue;
      retiredGeometry.add(child.geometry);child.updateMatrix();const baked=child.geometry.clone().applyMatrix4(child.matrix);
      if(!buckets.has(child.material))buckets.set(child.material,[]);
      buckets.get(child.material).push(baked);parent.remove(child);
    }
    for(const [material,pieces] of buckets){
      const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
      if(merged)parent.add(new THREE.Mesh(merged,material));
    }
  }
  retiredGeometry.forEach(geometry=>geometry.dispose());
  const tail=body.children.find(child=>child.isMesh&&!child.isInstancedMesh&&child.material===skin);
  const tailPositions=tail?.geometry.attributes.position;
  const rest=tailPositions?new Float32Array(tailPositions.array):null;
  const tailIndices=[];
  if(rest)for(let i=0;i<rest.length;i+=3)if(snake||rest[i]>.85)tailIndices.push(i);
  group.userData={body,species,animate(time){
    for(const {limb,side,index} of legGroups){
      const phase=time*3.5+(side>0?Math.PI:0)+index*Math.PI;
      limb.rotation.y=Math.sin(phase)*.22;
      limb.rotation.x=side*Math.max(0,Math.sin(phase))*.13;
      limb.rotation.z=Math.sin(phase+.8)*.045;
    }
    for(const i of tailIndices){
      const weight=snake?THREE.MathUtils.smoothstep(rest[i],-1.45,.4):Math.min(1,(rest[i]-.85)/1.5);
      tailPositions.array[i+2]=rest[i+2]+Math.sin(time*2.1-rest[i]*2)*.13*weight;
      if(snake)tailPositions.array[i+1]=rest[i+1]+Math.sin(time*2.1-rest[i]*2+.8)*.035*weight;
    }
    if(tailPositions)tailPositions.needsUpdate=true;
    body.scale.y=1+Math.sin(time*1.7)*.012;
  }}; return group;
}
