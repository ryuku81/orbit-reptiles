import useMotionPreference from './useMotionPreference.js';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll } from 'motion/react';
import { ArrowUpRight, Sparkle } from '@phosphor-icons/react';
import * as THREE from 'three';
import './scroll-journey.css';

const chapters = [
  { label: 'INTO THE NEBULA', title: <>星の奥へ。</>, description: <>色も、かたちも、想像の先へ。<br />まだ知らない世界を、ゆっくりと。</> },
  { label: 'EVERY LIFE, A UNIVERSE', title: <>ひとつの生命に、<br />ひとつの宇宙。</>, description: <>星の環を泳ぐ、七色の鱗。<br />宇宙が、ひとつの生命になる。</> },
  { label: 'FIND YOUR ORBIT', title: <>心惹かれる、<br />その軌道へ。</>, description: <>星を見つけるように、出会おう。<br />あなたの世界が変わる、その瞬間に。</> },
];
const vertex = `varying vec3 vPosition; varying vec3 vNormal; varying vec3 vView;
void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);vec4 view=modelViewMatrix*vec4(position,1.);vView=normalize(-view.xyz);gl_Position=projectionMatrix*view;}`;
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*noise3(p);p=p*2.07+vec3(4.2,1.7,8.4);a*=.49;}return v;}`;

// A volumetric celestial python: connected tapering skin, raised scale relief,
// sculpted head and eyes. It winds behind the planet and through the ring plane.
function orbitalSerpent({ geometry, material, cleanups }) {
  const group = new THREE.Group();
  const maps = [];
  const surface = document.createElement('canvas'); surface.width = 1024; surface.height = 512;
  const relief = document.createElement('canvas'); relief.width = 1024; relief.height = 512;
  const paint = surface.getContext('2d'), bump = relief.getContext('2d');
  paint.fillStyle = '#281637'; paint.fillRect(0,0,1024,512); bump.fillStyle = '#454545'; bump.fillRect(0,0,1024,512);
  for(let row=-1;row<33;row++) for(let col=-1;col<65;col++) {
    const x=col*16+(row%2)*8, y=row*16;
    const seed=Math.sin(col*34.17+row*71.83)*.5+.5;
    const hue=258+Math.sin(row*.25)*16+seed*12;
    const shine=paint.createLinearGradient(x,y-7,x,y+8);
    shine.addColorStop(0,`hsl(${hue},38%,${61+seed*15}%)`);
    shine.addColorStop(.55,`hsl(${hue},43%,${38+seed*12}%)`);
    shine.addColorStop(1,`hsl(${hue+10},44%,25%)`);
    for(const ctx of [paint,bump]){
      ctx.beginPath();ctx.moveTo(x-7,y-5);ctx.quadraticCurveTo(x,y-10,x+7,y-5);ctx.lineTo(x+7,y+1);ctx.quadraticCurveTo(x+5,y+6,x,y+9);ctx.quadraticCurveTo(x-5,y+6,x-7,y+1);ctx.closePath();
      ctx.fillStyle=ctx===paint?shine:'#bdbdbd';ctx.fill();
    }
    bump.fillStyle='#dedede';bump.beginPath();bump.ellipse(x,y-2,5,4,0,0,Math.PI*2);bump.fill();
  }
  const skinMap=new THREE.CanvasTexture(surface);skinMap.colorSpace=THREE.SRGBColorSpace;skinMap.wrapS=THREE.RepeatWrapping;skinMap.repeat.set(2.4,1);skinMap.anisotropy=4;maps.push(skinMap);
  const scaleMap=new THREE.CanvasTexture(relief);scaleMap.wrapS=THREE.RepeatWrapping;scaleMap.repeat.set(2.4,1);scaleMap.anisotropy=4;maps.push(scaleMap);
  cleanups.push(()=>maps.forEach(map=>map.dispose()));
  const skin=material(new THREE.MeshPhysicalMaterial({map:skinMap,bumpMap:scaleMap,bumpScale:.035,color:'#e5d5f5',emissive:'#3c1959',emissiveIntensity:.12,metalness:.18,roughness:.3,clearcoat:.8,clearcoatRoughness:.22,iridescence:.8,iridescenceIOR:1.3,iridescenceThicknessRange:[120,380],transparent:true}));
  const headSkin=material(skin.clone());
  const headColor=skinMap.clone(),headRelief=scaleMap.clone();headColor.repeat.set(.16,1);headRelief.repeat.set(.16,1);headColor.needsUpdate=true;headRelief.needsUpdate=true;headSkin.map=headColor;headSkin.bumpMap=headRelief;maps.push(headColor,headRelief);
  const dark=material(new THREE.MeshStandardMaterial({color:'#160f29',roughness:.4,transparent:true}));
  const eyeGold=material(new THREE.MeshPhysicalMaterial({color:'#c0ecb6',emissive:'#688780',emissiveIntensity:.22,metalness:.45,roughness:.16,clearcoat:1,transparent:true}));
  const eyeBlack=material(new THREE.MeshPhysicalMaterial({color:'#040610',roughness:.06,clearcoat:1,transparent:true}));
  const gleam=material(new THREE.MeshBasicMaterial({color:'#e7ffff',transparent:true}));
  const tongueMat=material(new THREE.MeshPhysicalMaterial({color:'#dc8bdc',emissive:'#752369',emissiveIntensity:.25,roughness:.35,transparent:true}));
  const opaqueMaterials=[skin,headSkin,dark,eyeGold,eyeBlack,gleam,tongueMat];
  const curve=new THREE.CatmullRomCurve3([
    [1.40,.68,1.42],[1.95,.46,1.02],[2.12,-.22,.62],[1.62,-1.18,.22],
    [.38,-1.67,-.22],[-1.03,-1.39,-.65],[-1.94,-.45,-.8],[-1.68,.72,-.8],
    [-.64,1.54,-.65],[.73,1.75,-.37],[1.94,1.13,-.05],[2.68,.54,.22]
  ].map(p=>new THREE.Vector3(...p)));
  const segments=240,sides=48,frames=curve.computeFrenetFrames(segments,false),positions=[],normals=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments, point=curve.getPointAt(t);
    const radius=(.14+.105*Math.sin(Math.min(1,t*1.6)*Math.PI)) * Math.pow(1-t,.49)+.003;
    for(let j=0;j<=sides;j++){
      const a=j/sides*Math.PI*2, normal=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));
      const vertex=point.clone().addScaledVector(normal,radius);
      positions.push(vertex.x,vertex.y,vertex.z);normals.push(normal.x,normal.y,normal.z);uvs.push(t,j/sides);
      if(i<segments&&j<sides){const k=i*(sides+1)+j,n=k+sides+1;indices.push(k,k+1,n,k+1,n+1,n);}
    }
  }
  const bodyGeo=geometry(new THREE.BufferGeometry());bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bodyGeo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));bodyGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));bodyGeo.setIndex(indices);
  const body=new THREE.Mesh(bodyGeo,skin);group.add(body);
  const wave={value:0},energy={value:0};
  skin.onBeforeCompile=shader=>{
    shader.uniforms.uSerpentTime=wave;shader.uniforms.uSerpentEnergy=energy;
    shader.vertexShader='uniform float uSerpentTime; varying vec2 vSerpentUV;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vSerpentUV=uv; transformed.y+=sin(uv.x*16.-uSerpentTime*1.25)*.035*sin(uv.x*3.14159); transformed.z+=cos(uv.x*12.-uSerpentTime)*.025*sin(uv.x*3.14159);');
    shader.fragmentShader='uniform float uSerpentTime; uniform float uSerpentEnergy; varying vec2 vSerpentUV;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n float ribbon=pow(.5+.5*sin(vSerpentUV.x*35.-uSerpentTime*1.4),28.); totalEmissiveRadiance+=vec3(.25,.23,.6)*ribbon*(.08+uSerpentEnergy*.7);');
  };
  const head=new THREE.Group();head.position.copy(curve.getPointAt(0));head.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),curve.getTangentAt(0).negate());group.add(head);
  const headPos=[],headUv=[],headIndex=[];
  const sections=[[-.26,.105,.098,0],[-.15,.185,.115,.018],[.01,.221,.145,.035],[.17,.19,.13,.028],[.31,.133,.085,.014],[.39,.085,.045,0],[.405,.008,.012,-.006]];
  const headSteps=64;
  const sample=(t,k)=>{const p=t*(sections.length-1),i=Math.min(sections.length-2,Math.floor(p)),f=p-i,a=sections[Math.max(0,i-1)][k],b=sections[i][k],c=sections[i+1][k],d=sections[Math.min(sections.length-1,i+2)][k];return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);};
  for(let i=0;i<=headSteps;i++)for(let j=0;j<=48;j++){
    const t=i/headSteps,z=sample(t,0),w=Math.max(.005,sample(t,1)),h=Math.max(.005,sample(t,2)),y=sample(t,3),a=j/48*Math.PI*2;
    headPos.push(Math.cos(a)*w,y+Math.sin(a)*h*(Math.sin(a)<0?.62:1),z);headUv.push(t,j/48);
    if(i<headSteps&&j<48){const a=i*49+j,b=a+49;headIndex.push(a,a+1,b,a+1,b+1,b);}
  }
  const headGeo=geometry(new THREE.BufferGeometry());headGeo.setAttribute('position',new THREE.Float32BufferAttribute(headPos,3));headGeo.setAttribute('uv',new THREE.Float32BufferAttribute(headUv,2));headGeo.setIndex(headIndex);headGeo.computeVertexNormals();
  head.add(new THREE.Mesh(headGeo,headSkin));
  const sphere=geometry(new THREE.SphereGeometry(1,24,16));
  const ellipsoid=(parent,mat,position,scale)=>{const mesh=new THREE.Mesh(sphere,mat);mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);return mesh;};
  const tube=(points,r,mat,parent=head)=>{const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(geometry(new THREE.TubeGeometry(path,30,r,8,false)),mat);parent.add(mesh);return mesh;};
  for(const side of [-1,1]){
    ellipsoid(head,eyeGold,[side*.196,.095,.13],[.028,.038,.046]);
    ellipsoid(head,eyeBlack,[side*.220,.099,.14],[.008,.030,.012]);
    ellipsoid(head,gleam,[side*.224,.113,.153],[.004,.006,.006]);
    ellipsoid(head,dark,[side*.099,.059,.338],[.011,.009,.012]);
    tube([[side*.074,-.028,.397],[side*.142,-.049,.28],[side*.193,-.05,.12],[side*.17,-.039,-.1]],.0045,dark);
    for(let i=0;i<5;i++)ellipsoid(head,dark,[side*(.11+i*.016),-.01,.31-i*.041],[.007,.006,.006]);
  }
  const tongue=new THREE.Group();tongue.position.set(0,-.038,.39);head.add(tongue);
  tube([[0,0,0],[0,-.01,.15],[0,-.005,.29]],.009,tongueMat,tongue);
  tube([[0,-.005,.27],[-.042,0,.36]],.005,tongueMat,tongue);tube([[0,-.005,.27],[.042,0,.36]],.005,tongueMat,tongue);
  return {group,update(time,progress,resonance){
    const amount=THREE.MathUtils.smoothstep(progress,.06,.55);
    group.visible=amount>.005;group.position.z=-1.3*(1-amount);group.scale.setScalar(.88+amount*.12);
    group.rotation.y=-.16+progress*.22;group.rotation.z=-.06+Math.sin(time*.25)*.018;
    group.position.y=Math.sin(time*.7)*.022;
    opaqueMaterials.forEach(mat=>mat.opacity=amount);
    wave.value=time;energy.value=resonance;
    const flick=Math.max(0,Math.sin(time*1.7+1.6));tongue.scale.z=.12+Math.pow(flick,14)*.88;
    tongue.visible=amount>.8&&flick>.65;
    eyeGold.emissiveIntensity=.22+resonance*.9;
  }};
}

function PortalSculpture({ progress, paused }) {
  const hostRef = useRef(null);
  const frozen = useRef(paused);
  const trigger = useRef(null);
  useEffect(() => { frozen.current = paused; trigger.current?.(); }, [paused]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer, frame = 0, disposed = false, visible = false, lost = false;
    let clock = 0, previous = 0, smoothProgress = 0.12, resonance = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const geometries = new Set(), materials = new Set(), cleanups = [];
    const geometry = g => { geometries.add(g); return g; };
    const material = m => { materials.add(m); return m; };
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanups.forEach(fn => fn());
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      trigger.current = null;
    };
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 640 ? 1.2 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
      camera.position.set(0, .15, 8.9);
      const rig = new THREE.Group(); scene.add(rig);
      const planetMaterial = material(new THREE.ShaderMaterial({
        vertexShader: vertex,
        uniforms: { uResonance: { value: 0 } },
        fragmentShader: `${noise}
        uniform float uResonance;
        varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
        void main(){vec3 n=normalize(vNormal);vec3 p=vPosition;float gas=fbm(p*4.4);float fine=fbm(p*35.);float ridge=pow(abs(sin(p.y*16.+gas*7.)),7.);float light=max(dot(n,normalize(vec3(-.6,.65,1.))),0.);vec3 base=mix(vec3(.016,.012,.038),vec3(.12,.095,.22),gas);base+=vec3(.12,.055,.19)*ridge*.24;vec3 color=base*(.3+light*1.7)+(fine-.5)*.035;float edge=pow(1.-max(dot(n,normalize(vView)),0.),3.5);color+=vec3(.40,.22,.85)*edge*.9;color+=vec3(.52,.18,.8)*uResonance*(.3+edge);gl_FragColor=vec4(color,1.);}`,
      }));
      const planet = new THREE.Mesh(geometry(new THREE.SphereGeometry(1.16, 96, 64)), planetMaterial);
      rig.add(planet);
      const aura = new THREE.Mesh(geometry(new THREE.SphereGeometry(1.21, 64, 40)), material(new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: `varying vec3 vNormal;varying vec3 vView;void main(){float f=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),5.);gl_FragColor=vec4(.52,.28,1.,f*.42);}`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })));
      rig.add(aura);
      const rings = new THREE.Group();
      rings.rotation.set(1.02, -.12, -.23);
      rig.add(rings);
      const ringVertices = [], ringUvs = [], ringIndices = [];
      const segments = 512, bands = 32;
      for (let y = 0; y <= bands; y++) {
        const radius = 1.5 + y / bands * .99;
        for (let x = 0; x <= segments; x++) {
          const angle = x / segments * Math.PI * 2;
          ringVertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
          ringUvs.push(x / segments, y / bands);
          if (x < segments && y < bands) {
            const a = y * (segments + 1) + x, b = a + segments + 1;
            ringIndices.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
      }
      const bandGeometry = geometry(new THREE.BufferGeometry());
      bandGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ringVertices, 3));
      bandGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(ringUvs, 2));
      bandGeometry.setIndex(ringIndices);
      const ringMaterial = material(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uProgress: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uProgress;
        void main(){float r=vUv.y;float a=vUv.x*6.28318;float lines=pow(.5+.5*sin(r*420.+sin(a*13.-uTime*.2)*1.6),9.);float strands=pow(.5+.5*sin(r*110.+sin(a*5.)*.8),5.);float edge=smoothstep(0.,.10,r)*(1.-smoothstep(.72,1.,r));float gap=1.-.65*smoothstep(.44,.46,r)*(1.-smoothstep(.47,.50,r));float light=.55+.45*sin(a+.8);vec3 color=mix(vec3(.42,.18,.9),vec3(1.,.58,.94),smoothstep(.1,.8,r));color=mix(color,vec3(.79,.78,1.),pow(light,5.));float alpha=edge*gap*(.06+lines*.43+strands*.12)*(.55+light*.5);gl_FragColor=vec4(color,alpha*1.16);}`,
        transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      rings.add(new THREE.Mesh(bandGeometry, ringMaterial));
      const hoopMaterial = material(new THREE.MeshBasicMaterial({ color: '#e5c6ff', transparent: true, opacity: .86 }));
      for (const [radius, thickness] of [[1.46,.005],[1.53,.007],[2.49,.006],[2.54,.0025]]) {
        rings.add(new THREE.Mesh(geometry(new THREE.TorusGeometry(radius, thickness, 6, 340)), hoopMaterial));
      }
      const outerOrbit = new THREE.Group();
      const orbitGeometry = geometry(new THREE.TorusGeometry(3.1, .0015, 5, 300));
      const orbitMaterial = material(new THREE.MeshBasicMaterial({ color: '#cfb4ff', transparent: true, opacity: .3 }));
      const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
      outerOrbit.add(orbit); outerOrbit.rotation.set(.5,.65,.5);rig.add(outerOrbit);
      const pointsCount = innerWidth < 640 ? 1300 : 3000;
      const points = [], seeds = [], sizes = [];
      let seed = 824;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      for (let i = 0; i < pointsCount; i++) {
        const a = random() * Math.PI * 2, r = 1.55 + Math.pow(random(), .8) * 1.25;
        points.push(Math.cos(a)*r, Math.sin(a)*r, (random()-.5)*.12);
        seeds.push(random()); sizes.push(.5+random()*1.9);
      }
      const dustGeometry = geometry(new THREE.BufferGeometry());
      dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      dustGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
      dustGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      const dustMaterial = material(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uDpr: { value: renderer.getPixelRatio() } },
        vertexShader: `attribute float aSeed;attribute float aSize;uniform float uTime;uniform float uProgress;uniform float uDpr;varying float vSeed;varying float vGlow;void main(){vec3 p=position;float angle=uTime*(.035+aSeed*.015)+(uProgress-.3)*.32;mat2 turn=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));p.xy=turn*p.xy;p.z+=sin(aSeed*22.+uTime*.2)*.028;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(aSize*uDpr*10./-view.z,1.,5.);vSeed=aSeed;vGlow=.6+.4*sin(aSeed*72.+uTime*.55);}`,
        fragmentShader: `varying float vSeed;varying float vGlow;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float core=exp(-d*d*26.);float halo=exp(-d*d*9.)*.13;vec3 color=mix(vec3(.57,.35,1.),vec3(1.,.78,.96),vSeed);gl_FragColor=vec4(color,(core+halo)*vGlow*.84);}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      rings.add(new THREE.Points(dustGeometry, dustMaterial));
      scene.add(new THREE.AmbientLight('#8e72d8', .7));
      const key = new THREE.DirectionalLight('#dfd8ff', 3);key.position.set(-4,6,5);scene.add(key);
      const rim = new THREE.DirectionalLight('#de75f7', 2.7);rim.position.set(4,-3,1);scene.add(rim);
      const serpent=orbitalSerpent({geometry,material,cleanups});rig.add(serpent.group);
      const serpentFill=new THREE.DirectionalLight('#b5e9ff',1.25);serpentFill.position.set(-2,2,6);scene.add(serpentFill);
      const crystals = [];
      const crystalMaterial = material(new THREE.MeshPhysicalMaterial({ color: '#bfa5eb', metalness: .72, roughness: .2, clearcoat: .85, flatShading: true }));
      for (let i = 0; i < 7; i++) {
        const crystal = new THREE.Mesh(geometry(new THREE.IcosahedronGeometry(.055 + random()*.075, 0)), crystalMaterial);
        crystal.scale.set(.65,1.6,.7);crystal.rotation.set(random()*3,random()*3,random()*3);
        crystal.userData={angle:random()*Math.PI*2,radius:2.7+random()*.65,seed:random()};
        crystals.push(crystal);rig.add(crystal);
      }
      const render = () => { if(!disposed&&!lost) renderer.render(scene,camera); };
      const frameState = () => {
        serpent.update(clock,smoothProgress,resonance);
        rig.rotation.y = (smoothProgress-.5)*.58;
        rig.rotation.z = -.05 + Math.sin(clock*.09)*.015;
        rings.rotation.x = 1.15 - smoothProgress*.36;
        rings.rotation.z = -.25 + smoothProgress*.43;
        planet.rotation.y = clock*.035 + smoothProgress*.85;
        outerOrbit.rotation.z = .5+smoothProgress*.65;
        const size = 1+Math.sin(smoothProgress*Math.PI)*.09;
        rig.scale.setScalar(size + resonance*.1);
        planetMaterial.uniforms.uResonance.value=resonance;
        hoopMaterial.opacity=.78+resonance*.22;
        camera.position.z = 9.1 - Math.sin(smoothProgress*Math.PI)*1.15;
        crystals.forEach((crystal,i)=>{
          const a=crystal.userData.angle+clock*(.018+i*.003)+smoothProgress*.55,r=crystal.userData.radius;
          crystal.position.set(Math.cos(a)*r,Math.sin(a)*r*.55,Math.sin(a)*.7);
          crystal.rotation.y=clock*.13+crystal.userData.seed*5;
          crystal.rotation.z=clock*.07+crystal.userData.seed*3;
        });
        ringMaterial.uniforms.uTime.value=clock;ringMaterial.uniforms.uProgress.value=smoothProgress;
        dustMaterial.uniforms.uTime.value=clock;dustMaterial.uniforms.uProgress.value=smoothProgress;
      };
      const isMoving=()=>!disposed&&!lost&&visible&&!document.hidden&&!frozen.current&&!reduced.matches;
      const animate=now=>{
        frame=0;
        if(!isMoving()){previous=0;return;}
        const delta=previous?Math.min((now-previous)/1000,.045):0;previous=now;clock+=delta;resonance=Math.max(0,resonance-delta*.48);
        smoothProgress+=(progress.get()-smoothProgress)*.065;
        frameState();render();frame=requestAnimationFrame(animate);
      };
      const onResonate=()=>{if(frozen.current||reduced.matches)return;resonance=1;};
      window.addEventListener('orbit:resonate',onResonate);cleanups.push(()=>window.removeEventListener('orbit:resonate',onResonate));
      const update=()=>{cancelAnimationFrame(frame);frame=0;previous=0;if(!frozen.current&&!reduced.matches)smoothProgress=progress.get();frameState();render();if(isMoving())frame=requestAnimationFrame(animate);};
      const resize=()=>{
        const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
        renderer.setSize(width,height,false);camera.aspect=width/height;
        camera.fov=width<600?50:40;camera.updateProjectionMatrix();frameState();render();
      };
      const observer=new ResizeObserver(resize);observer.observe(host);cleanups.push(()=>observer.disconnect());
      const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();},{rootMargin:'120px'});intersection.observe(host);cleanups.push(()=>intersection.disconnect());
      const onLost=event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);host.classList.add('journey-webgl-unavailable');};
      renderer.domElement.addEventListener('webglcontextlost',onLost);
      document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
      cleanups.push(()=>renderer.domElement.removeEventListener('webglcontextlost',onLost),()=>document.removeEventListener('visibilitychange',update),()=>reduced.removeEventListener('change',update));
      trigger.current=update;resize();update();host.classList.add('journey-webgl-ready');
    } catch { host.classList.add('journey-webgl-unavailable');cleanup(); }
    return cleanup;
  }, [progress]);
  return <div className="journey-sculpture" ref={hostRef} aria-hidden="true"><div className="journey-fallback"><div/><i/><i/></div></div>;
}

export default function ScrollJourney({ paused = false, onExplore }) {
  const section=useRef(null);
  const reduced=useMotionPreference();
  const {scrollYProgress}=useScroll({target:section,offset:['start start','end end']});
  const [chapter,setChapter]=useState(0);
  const frozen=useRef(paused||reduced);
  useEffect(()=>{frozen.current=paused||reduced;if(!frozen.current){const p=scrollYProgress.get();setChapter(p<.33?0:p<.7?1:2);}},[paused,reduced,scrollYProgress]);
  useEffect(()=>scrollYProgress.on('change',p=>{if(!frozen.current)setChapter(p<.33?0:p<.7?1:2);}),[scrollYProgress]);
  const current=chapters[chapter];
  const resonate=event=>{if(paused||reduced)return;window.dispatchEvent(new CustomEvent('orbit:resonate'));window.dispatchEvent(new CustomEvent('orbit:burst',{detail:{x:innerWidth*.7,y:innerHeight*.5,power:2.2}}));};
  return <section id="journey" ref={section} className={`journey-section ${reduced?'journey-reduced':''}`} aria-label="宇宙を旅するように、新しい生命と出会う">
    <div className="journey-sticky">
      <PortalSculpture progress={scrollYProgress} paused={paused||reduced}/>
      <div className="journey-copy">
        <div className="journey-kicker"><Sparkle size={14} weight="light"/><span>THE COSMIC JOURNEY</span></div>
        <AnimatePresence mode="wait" initial={false}><motion.div className="journey-chapter" key={chapter} initial={paused||reduced?false:{opacity:0,y:22,filter:'blur(4px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} exit={paused||reduced?{opacity:1}:{opacity:0,y:-15,filter:'blur(3px)'}} transition={{duration:.5,ease:[.2,.7,.2,1]}}>
          <span className="journey-chapter-label">{current.label}</span>
          <h2>{current.title}</h2>
          <p>{current.description}</p>
        </motion.div></AnimatePresence>
        <button className="journey-explore" onClick={onExplore}>3Dラボへ <ArrowUpRight size={19}/></button><button className="journey-ignite" disabled={paused||reduced} onClick={resonate}><Sparkle size={15}/><span>惑星を共鳴させる</span></button>
        <div className="journey-chapters" aria-hidden="true">{chapters.map((item,i)=><span key={item.label} className={chapter===i?'journey-current':''}/>)}</div>
      </div>
      <div className="journey-orbit-label" aria-hidden="true"><span>THE ORBITAL SERPENT</span><span>環を泳ぐ、星の生命。</span></div>
    </div>
  </section>;
}
