import useMotionPreference from './useMotionPreference.js';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll } from 'motion/react';
import { ArrowUpRight, Sparkle } from '@phosphor-icons/react';
import * as THREE from 'three';
import './scroll-journey.css';

const chapters = [
  { label: 'INTO THE NEBULA', title: <>星の奥へ。</>, description: <>色も、かたちも、想像の先へ。<br />まだ知らない世界を、ゆっくりと。</> },
  { label: 'EVERY LIFE, A UNIVERSE', title: <>ひとつの生命に、<br />ひとつの宇宙。</>, description: <>光を映す瞳。緻密に重なる鱗。<br />小さな生命の中に、果てしない美しさがある。</> },
  { label: 'FIND YOUR ORBIT', title: <>心惹かれる、<br />その軌道へ。</>, description: <>星を見つけるように、出会おう。<br />あなたの世界が変わる、その瞬間に。</> },
];
const vertex = `varying vec3 vPosition; varying vec3 vNormal; varying vec3 vView;
void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);vec4 view=modelViewMatrix*vec4(position,1.);vView=normalize(-view.xyz);gl_Position=projectionMatrix*view;}`;
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*noise3(p);p=p*2.07+vec3(4.2,1.7,8.4);a*=.49;}return v;}`;

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
      <div className="journey-orbit-label" aria-hidden="true"><span>BOUND BY CURIOSITY</span><span>自由に、惹かれ合う。</span></div>
    </div>
  </section>;
}
