import * as THREE from 'three';

// Original, fully dimensional anatomical sculpture. The skin texture is generated
// locally; the artwork is not a photographed or scanned animal.
export function taperedTube(points, startRadius, endRadius, segments = 90, sides = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], normals = [], indices = [], uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      positions.push(point.x + normal.x * radius, point.y + normal.y * radius, point.z + normal.z * radius);
      normals.push(normal.x, normal.y, normal.z); uvs.push(t * .36, j / sides * .38);
      if (i < segments && j < sides) {
        const n = i * (sides + 1) + j, b = n + sides + 1;
        indices.push(n, n + 1, b, b, n + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); return geometry;
}

function skinTextures() {
  const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 768;
  const bump = document.createElement('canvas'); bump.width = 1536; bump.height = 768;
  const ctx = canvas.getContext('2d'), b = bump.getContext('2d');
  ctx.fillStyle = '#73816b'; ctx.fillRect(0, 0, 1536, 768);
  b.fillStyle = '#656565'; b.fillRect(0, 0, 1536, 768);
  let seed = 47; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Dense, irregular polygonal skin cells with dark interstitial seams. This
  // gives the live geometry microstructure without thousands of round beads.
  const width = 8, height = 6;
  for (let row = -1; row < 130; row++) for (let col = -1; col < 195; col++) {
    const x = col * width + (row % 2) * width / 2;
    const y = row * height, u = x / 1536, v = y / 768;
    const noise = Math.sin(u*163+v*91)*.13+Math.sin(u*53-v*72)*.2+Math.sin(u*211+v*187)*.075;
    const stripe = Math.sin(u * 34 + Math.cos(v * Math.PI * 4) * .85 + noise * 1.4);
    const pigment = THREE.MathUtils.smoothstep(stripe + noise, .05, .91);
    const speck = random(), lateral = Math.abs(Math.sin(v * Math.PI * 2));
    let light = 67 + random() * 13;
    if (lateral > .28) light -= pigment * (24 + Math.sin(u*110+v*31)*5);
    if (Math.abs(v - .27) < .018 || Math.abs(v - .73) < .018) light += 14;
    if (speck < .035) light -= 23;
    const hue = 76 + pigment * 69;
    ctx.fillStyle = `hsl(${hue} ${13 + pigment * 9}% ${light}%)`;
    b.fillStyle = `hsl(0 0% ${65 + random() * 20}%)`;
    const points = Array.from({length: 6}, (_, i) => { const a = i / 6 * Math.PI * 2; return [x + Math.cos(a) * (width * .48 + random() * .7), y + Math.sin(a) * (height * .56 + random() * .6)]; });
    for (const context of [ctx, b]) {
      context.beginPath(); points.forEach(([px, py], i) => i ? context.lineTo(px, py) : context.moveTo(px, py)); context.closePath(); context.fill();
    }
    // Asymmetric highlight corresponds to a low, flattened scale crown.
    b.fillStyle = '#dddddd'; b.beginPath(); b.ellipse(x - .5, y - .5, 1.7, 1.2, 0, 0, Math.PI * 2); b.fill();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bump); bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping; bumpMap.anisotropy = 4;
  return { map, bumpMap };
}

// Smooth loft across anatomical cross sections. No extruded flat silhouette.
function loft(sections, radial = 64, longitudinal = 104) {
  const curve = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s[0], s[1], 0)));
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= longitudinal; i++) {
    const t = i / longitudinal, p = curve.getPoint(t);
    const f = t * (sections.length - 1), k = Math.min(sections.length - 2, Math.floor(f));
    const blend = THREE.MathUtils.smoothstep(f - k, 0, 1);
    const ry = THREE.MathUtils.lerp(sections[k][2], sections[k + 1][2], blend);
    const rz = THREE.MathUtils.lerp(sections[k][3], sections[k + 1][3], blend);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const belly = Math.cos(a) < 0 ? .90 : 1;
      positions.push(p.x, p.y + Math.cos(a) * ry * belly, Math.sin(a) * rz);
      uvs.push(t, j / radial);
      if (i < longitudinal && j < radial) {
        const n = i * (radial + 1) + j, next = n + radial + 1;
        indices.push(n, n + 1, next, n + 1, next + 1, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function casqueGeometry() {
  const positions = [], uvs = [], indices = [], rows = 40, cols = 32;
  // Rounded, continuously tapered crest joined into the skull. The left and
  // right surfaces are a single closed section with a narrow dorsal ridge.
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, width = .215 * Math.pow(1 - t, .7) + .006;
    const centerX = .99 - .17 * t + .06 * Math.sin(t * Math.PI);
    const length = .38 * (1 - t) + .025;
    for (let col = 0; col <= cols; col++) {
      const a = col / cols * Math.PI * 2;
      positions.push(centerX + Math.cos(a) * length, .64 + t * .90, Math.sin(a) * width);
      uvs.push(col / cols, row / rows);
      if (row < rows && col < cols) { const n = row * (cols + 1) + col, next = n + cols + 1; indices.push(n, next, n + 1, next, next + 1, n + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function buildChameleon() {
  const group = new THREE.Group(), head = new THREE.Group(), breathing = new THREE.Group();
  group.add(breathing, head);
  const textures = skinTextures();
  const skin = new THREE.MeshPhysicalMaterial({ color: '#a8b8a0', roughness: .79, metalness: 0, clearcoat: .08, clearcoatRoughness: .7, map: textures.map, bumpMap: textures.bumpMap, bumpScale: .014, transparent: true });
  const pale = new THREE.MeshPhysicalMaterial({ color: '#d6d4a1', roughness: .83, metalness: 0, map: textures.map, bumpMap: textures.bumpMap, bumpScale: .01, transparent: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#27321d', roughness: .86 });
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const sphereUV=sphere.attributes.uv;for(let i=0;i<sphereUV.count;i++){sphereUV.setXY(i,sphereUV.getX(i)*.24+.25,sphereUV.getY(i)*.24+.32);}
  const mesh = (geometry, material, position, scale, parent = group) => {
    const object = new THREE.Mesh(geometry, material); if (position) object.position.set(...position); if (scale) object.scale.set(...scale);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const body = mesh(loft([
    [-1.47,.24,.055,.055],[-1.24,.32,.35,.23],[-.98,.39,.57,.34],[-.57,.42,.72,.395],[-.05,.41,.72,.385],[.36,.43,.56,.32],[.62,.48,.35,.245],[.83,.53,.24,.21]
  ]), skin, null, null, breathing);
  // Throat and lower jaw blend into a wedge-shaped skull rather than a sphere.
  mesh(loft([[.65,.46,.20,.20],[.94,.55,.30,.24],[1.25,.56,.27,.25],[1.55,.51,.18,.205],[1.84,.50,.085,.105],[1.91,.50,.01,.018]],64,88), skin, null, null, head);
  mesh(loft([[.65,.39,.17,.21],[.94,.40,.205,.24],[1.25,.415,.15,.23],[1.55,.445,.085,.18],[1.84,.485,.025,.07]],48,60), skin,null,null,head);
  mesh(casqueGeometry(),skin,null,null,head);
  mesh(taperedTube([[.64,.67,0],[.70,1.02,0],[.79,1.34,0],[.83,1.54,0]],.025,.009,48,10),pale,null,null,head);

  const eyes = [];
  for (const side of [-1,1]) {
    // Turret is skin; only a tiny circular opening exposes the actual eye.
    const eye = new THREE.Group(); eye.position.set(1.34,.66,side*.215); head.add(eye); eyes.push(eye);
    mesh(sphere,skin,[0,0,side*.035],[.196,.182,.14],eye);
    const irisMat = new THREE.MeshPhysicalMaterial({color:'#a7a45a',roughness:.36,clearcoat:.4,bumpMap:textures.bumpMap,bumpScale:.005});
    mesh(sphere,irisMat,[.022,.008,side*.159],[.070,.073,.021],eye);
    mesh(sphere,new THREE.MeshPhysicalMaterial({color:'#10150c',roughness:.08,clearcoat:1}),[.027,.009,side*.177],[.034,.035,.012],eye);
    mesh(sphere,new THREE.MeshBasicMaterial({color:'#fff9e9'}),[.013,.029,side*.185],[.008,.009,.004],eye);
    mesh(sphere,dark,[1.79,.55,side*.106],[.019,.012,.007],head);
    mesh(taperedTube([[.90,.326,side*.17],[1.18,.337,side*.222],[1.50,.397,side*.19],[1.79,.457,side*.105],[1.88,.474,side*.024]],.008,.003,50,7),dark,null,null,head);
    // Supraorbital ridge and the narrow folds of the gular pouch.
    mesh(taperedTube([[1.13,.78,side*.17],[1.32,.84,side*.22],[1.50,.75,side*.18]],.023,.01,35,10),skin,null,null,head);
    

    // Bent muscular upper legs, fine lower legs, and two opposing finger bundles.
    const limbs = [
      {points:[[.55,.30,side*.23],[.58,.02,side*.40],[.88,-.18,side*.51],[1.05,-.47,side*.33],[.99,-.67,side*.14]],radius:.105},
      {points:[[-1.05,.19,side*.25],[-1.22,-.07,side*.43],[-.96,-.30,side*.52],[-.68,-.45,side*.34],[-.66,-.70,side*.12]],radius:.14}
    ];
    for(const limb of limbs) {
      mesh(taperedTube(limb.points,limb.radius,.047,60,18),skin);
      const foot = limb.points.at(-1), x = foot[0];
      mesh(sphere,skin,[x,-.70,side*.12],[.115,.075,.08]);
      for(let toe=0;toe<3;toe++) {
        const xx=x+(toe-1)*.041;
        mesh(taperedTube([[xx,-.69,side*.12],[xx+.02,-.74,side*.18],[xx+.02,-.86,side*.15],[xx+.007,-.90,side*.05]],.022,.009,28,9),skin);
        mesh(taperedTube([[xx+.007,-.90,side*.05],[xx-.006,-.905,side*.005]],.010,.001,8,6),dark);
      }
      for(let toe=0;toe<2;toe++) {
        const xx=x+(toe-.5)*.045;
        mesh(taperedTube([[xx,-.70,side*.08],[xx-.04,-.73,-side*.08],[xx-.045,-.83,-side*.145],[xx-.022,-.89,-side*.075]],.023,.009,28,9),pale);
        mesh(taperedTube([[xx-.022,-.89,-side*.075],[xx-.01,-.90,-side*.027]],.01,.001,8,6),dark);
      }
    }
  }
  // Prehensile tail makes a single organic spiral, tapering continuously to tip.
  const tailPoints=[[-1.34,.28,0],[-1.58,.10,.015],[-1.77,-.20,.018],[-1.81,-.52,.015]];
  for(let i=0;i<=96;i++) {
    const t=i/96,angle=Math.PI+t*Math.PI*3.55,radius=.56*(1-t)+.055;
    tailPoints.push([-1.20+Math.cos(angle)*radius,-.54+Math.sin(angle)*radius,.012]);
  }
  mesh(taperedTube(tailPoints,.16,.008,230,22),skin);
  // Rows of small nuchal and dorsal tubercles, never large dinosaur spikes.
  const cone = new THREE.ConeGeometry(.024,.078,7);
  for(let row=10;row<94;row+=2) {
    const surface=body.geometry.attributes.position,index=row*65;
    const height=.44+Math.sin(row/104*Math.PI)*.48;
    const spike=mesh(cone,pale,[surface.getX(index),surface.getY(index)+.039*height-.007,0],null,breathing);
    spike.rotation.z=-.15;spike.scale.y=height;
  }
  const branchTexture=document.createElement('canvas'); branchTexture.width=512; branchTexture.height=256;
  const bc=branchTexture.getContext('2d');bc.fillStyle='#827763';bc.fillRect(0,0,512,256);
  for(let i=0;i<340;i++){
    const x=(Math.sin(i*17.37)*.5+.5)*512,y=(Math.sin(i*7.91)*.5+.5)*256;
    const length=12+(Math.sin(i*1.91)*.5+.5)*112;
    bc.strokeStyle=i%5===0?'#afa18a':i%3?'#655a48':'#413e30';bc.lineWidth=.5+(i%5)*.45;bc.beginPath();bc.moveTo(x,y);bc.bezierCurveTo(x+length*.3,y+Math.sin(i)*11,x+length*.7,y-Math.cos(i)*9,x+length,y+Math.sin(i*3)*4);bc.stroke();
    if(i%7===0){bc.fillStyle=i%2?'#7d8763':'#9b957a';bc.beginPath();bc.ellipse(x,y,4+i%5,1+i%3,Math.sin(i)*.6,0,Math.PI*2);bc.fill();}
  }
  for(let i=0;i<7;i++){const x=40+i*74,y=30+(i*73)%200;bc.strokeStyle='#494231';bc.lineWidth=1.6;bc.beginPath();bc.ellipse(x,y,11,3,.12,0,Math.PI*2);bc.stroke();}
  const bark=new THREE.CanvasTexture(branchTexture);bark.colorSpace=THREE.SRGBColorSpace;bark.wrapS=bark.wrapT=THREE.RepeatWrapping;
  const branchMaterial=new THREE.MeshStandardMaterial({color:'#8c795e',map:bark,bumpMap:bark,bumpScale:.042,roughness:.96,metalness:0});
  mesh(sphere,branchMaterial,[-2.58,-.91,.02],[.035,.115,.115]);
  mesh(sphere,branchMaterial,[2.54,-.65,-.02],[.025,.08,.08]);
  mesh(taperedTube([[-2.58,-.91,.02],[-1.3,-.82,0],[.1,-.80,0],[1.3,-.79,0],[2.54,-.65,-.02]],.115,.08,110,24),branchMaterial);
  mesh(taperedTube([[1.87,-.72,-.01],[2.13,-.41,-.11],[2.55,-.31,-.14]],.044,.006,44,12),branchMaterial);
  mesh(taperedTube([[-1.9,-.86,-.035],[-2.14,-.61,-.16],[-2.42,-.59,-.23]],.041,.008,40,12),branchMaterial);

  // Surface positions become visible specks only during the dispersion effect.
  const scaleData=[],positions=body.geometry.attributes.position;
  for(let i=0;i<positions.count;i+=2) {
    const position=new THREE.Vector3().fromBufferAttribute(positions,i);
    const normal=new THREE.Vector3().fromBufferAttribute(body.geometry.attributes.normal,i);
    scaleData.push({position,normal,size:.014+(Math.sin(i*9.31)+1)*.004});
  }
  const scales=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshPhysicalMaterial({color:'#e1d3ec',roughness:.52,metalness:.04,transparent:true,opacity:0,depthWrite:false}),scaleData.length);
  const dummy=new THREE.Object3D(),zAxis=new THREE.Vector3(0,0,1);
  scaleData.forEach(({position,normal,size},i)=>{dummy.position.copy(position);dummy.quaternion.setFromUnitVectors(zAxis,normal);dummy.scale.set(size,size,.007);dummy.updateMatrix();scales.setMatrixAt(i,dummy.matrix);scales.setColorAt(i,new THREE.Color('#cbb6df'));});
  group.add(scales);
  group.userData={skin,pale,scales,scaleData,dark,branchMaterial,head,eyes,breathing,textures:[textures.map,textures.bumpMap,bark]};
  return group;
}
