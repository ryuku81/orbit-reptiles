import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './living-portrait.css';
import { createPortraitMorphGeometry, portraitVertexShader } from './portrait-morph.js';

// Separate local body, head and eye deformations keep the illustration alive
// without turning its surrounding nebula into a moving rubber sheet.
const fragment = `
uniform sampler2D artwork;
uniform sampler2D strikeArtwork;
uniform float strikeReady;
uniform float time;
uniform float voyage;
uniform float creature;
uniform float eyelid;
uniform float response;
varying vec2 vUv;
varying vec2 vStrikeUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float region(vec2 uv,vec2 center,vec2 radius){vec2 p=(uv-center)/radius;return exp(-dot(p,p)*2.);}
vec2 turn(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(p.x*c-p.y*s,p.x*s+p.y*c);}
float jawOpening(){return smoothstep(.12,.48,voyage)*strikeReady;}
vec3 sampleArt(vec2 uv){
  vec3 base=texture2D(artwork,clamp(uv,.001,.999)).rgb;
  if(creature>.5)return base;
  // Register the resting head during the first small jaw movement, then
  // articulate a single texture through the rest of the opening and strike.
  vec3 strike=texture2D(strikeArtwork,clamp(vStrikeUv+(uv-vUv),.001,.999)).rgb;
  float headMask=(1.-smoothstep(.13,.21,abs(vUv.x-.31)))*(1.-smoothstep(.17,.25,abs(vUv.y-.72)));
  return mix(base,strike,smoothstep(0.,.10,jawOpening())*headMask);
}
void main(){
  vec2 uv=vUv;
  float breath=sin(time*1.72)+.18*sin(time*3.44-.5)+.13*sin(time*.48+.6);
  float body;
  vec2 eye;
  vec2 eyeRadius;
  if(creature<.5){
    body=region(uv,vec2(.56,.60),vec2(.26,.21));
    float lower=region(uv,vec2(.57,.25),vec2(.30,.16));
    uv.y-=(uv.y-.59)*body*breath*.098;
    uv.x-=(uv.x-.55)*body*breath*.031;
    uv.y-=(uv.y-.25)*lower*sin(time*1.72-.7)*.065;
    float head=region(uv,vec2(.32,.76),vec2(.16,.14));
    vec2 neck=uv-vec2(.417,.787);
    uv+=(turn(neck,sin(time*.64)*.045+sin(time*.23)*.018)-neck)*head;
    uv-=vec2(sin(time*.72)*.007,sin(time*.92+.6)*.0075)*head;
    float throat=region(uv,vec2(.342,.711),vec2(.068,.056));
    uv.y-=sin(time*1.72-.45)*.004*throat;
    float tail=region(uv,vec2(.24,.22),vec2(.15,.23));
    uv.x-=sin(time*1.05+uv.y*7.)*.0078*tail;
    uv.y-=sin(time*.74+uv.x*9.)*.0025*tail;
    float morphHead=(1.-smoothstep(.15,.23,abs(vUv.x-.32)))*(1.-smoothstep(.16,.24,abs(vUv.y-.75)));
    uv=mix(uv,vUv,morphHead*smoothstep(.02,.12,voyage));
    eye=vec2(.3188,.7496);eyeRadius=vec2(.0101,.0183);
  }else{
    body=region(uv,vec2(.704,.627),vec2(.24,.185));
    // The flank expands around its center while the feet retain their grip.
    uv.y-=(uv.y-.615)*body*breath*.106;
    uv.x-=(uv.x-.70)*body*breath*.046;
    float throat=region(uv,vec2(.487,.663),vec2(.12,.105));
    uv.y-=throat*(sin(time*1.72-.5)*.0061+response*.008);
    float head=region(uv,vec2(.412,.795),vec2(.19,.17));
    vec2 neck=uv-vec2(.545,.718);
    uv+=(turn(neck,sin(time*.58+.25)*.039+sin(time*.21)*.014+response*.085)-neck)*head;
    uv-=vec2(sin(time*.62)*.0055,sin(time*.77+.4)*.007)*head;
    float tail=region(uv,vec2(.825,.214),vec2(.17,.22));
    uv.x-=sin(time*.91+uv.y*5.)*.0082*tail;
    uv.y-=sin(time*.71+uv.x*8.)*.0036*tail;
    eye=vec2(.4277,.8025);eyeRadius=vec2(.033,.0475);
  }
  vec2 e=(uv-eye)/eyeRadius;
  // Small deliberate changes of gaze with a brief movement and a longer hold.
  float glance=time/2.9,stepIndex=floor(glance),settle=smoothstep(0.,.115,fract(glance));
  vec2 gazeFrom=vec2(hash(vec2(stepIndex,4.2)),hash(vec2(stepIndex,9.1)))-.5;
  vec2 gazeTo=vec2(hash(vec2(stepIndex+1.,4.2)),hash(vec2(stepIndex+1.,9.1)))-.5;
  vec2 gaze=mix(gazeFrom,gazeTo,settle)*vec2(.42,.27)+vec2(-.24,.13)*response;
  float iris=1.-smoothstep(.48,.94,length(e));
  vec3 original=sampleArt(uv-gaze*eyeRadius*iris*(1.-eyelid)*(creature<.5?1.-smoothstep(.02,.12,voyage):1.));
  float eyeShape=1.-smoothstep(.88,1.035,length(e));
  // Textured skin immediately outside the iris forms upper and lower lids.
  float edge=sqrt(max(0.,1.-e.x*e.x));
  float opening=(1.-eyelid)*edge;
  float covered=smoothstep(opening-.035,opening+.035,abs(e.y))*eyeShape;
  covered*=smoothstep(.025,.14,eyelid);
  float side=e.y<0.?-1.:1.;
  vec2 lidUv=uv;
  lidUv.y=eye.y+side*eyeRadius.y*(1.08+(abs(e.y)-opening)*.25);
  if(creature>.5)lidUv=vec2(eye.x+e.x*.029,eye.y-.086+abs(e.y)*.023);
  vec3 lid=sampleArt(lidUv);
  lid*=.84+.18*abs(e.y);
  float crease=exp(-pow(e.y*35.,2.))*eyelid*eyeShape;
  original=mix(original,lid,covered);
  original*=1.-crease*.48;
  float light=dot(original,vec3(.2126,.7152,.0722));
  vec3 color=original;
  if(creature<.5){
    float skin=smoothstep(.105,.34,light)*(1.-smoothstep(.775,.815,uv.x));
    float orb=1.-smoothstep(.90,1.15,length((uv-vec2(.509,.419))/vec2(.041,.060)));
    skin*=1.-orb;
    // Bright amethyst skin, with pale highlights that preserve individual scales.
    color=mix(original,original*vec3(1.08,.86,1.16),skin*.50);
    float sweep=fract(uv.x*.36+uv.y*.64-time*.075);
    float shine=exp(-pow((sweep-.5)*24.,2.))*skin;
    color+=vec3(.055,.025,.085)*shine;
  }else{
    color*=1.14+body*breath*.024+response*.075;
    float jewel=pow(max(0.,light-.30)*1.3,3.);
    color+=vec3(.045,.085,.13)*jewel*(.5+.5*sin(time*1.2+uv.x*9.));
  }
  vec2 glint=e-gaze*.55-vec2(-.26+sin(time*.58)*.09,.38+sin(time*.83)*.035);
  float eyeLight=exp(-dot(glint*vec2(15.,18.),glint*vec2(15.,18.)));
  color+=vec3(.70,.84,1.)*eyeLight*(1.-eyelid)*.45;
  gl_FragColor=vec4(color,1.);
}`;

function blinkAt(time, variant) {
  const phase = (time + (variant === 'gecko' ? .45 : 0)) % 10.8;
  const smooth = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const close = start => {
    const t = phase - start;
    return smooth(t / .085) * (1 - smooth((t - .15) / .18));
  };
  // Varied 2.45–3 second intervals, plus one small double-blink each cycle.
  return Math.max(close(1.1), close(3.55), close(3.99) * .96, close(6.45), close(8.9));
}

export default function LivingPortraitEffect({ variant = 'serpent', paused = false, progress, reaction = 0, className = '' }) {
  const host = useRef(null), state = useRef({ paused, progress, reaction }), [near, setNear] = useState(false);
  state.current = { paused, progress, reaction };
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    const element = host.current, reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 640 ? 1.35 : 1.5));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true'); element.appendChild(renderer.domElement);
    const uniforms = { artwork: { value: null }, strikeArtwork: { value: null }, strikeReady: { value: 0 }, time: { value: 0 }, voyage: { value: 0 }, creature: { value: variant === 'gecko' ? 1 : 0 }, eyelid: { value: 0 }, response: { value: 0 } };
    const material = new THREE.ShaderMaterial({ uniforms, fragmentShader: fragment, vertexShader: variant==='serpent'?portraitVertexShader:'varying vec2 vUv;varying vec2 vStrikeUv;void main(){vUv=uv;vStrikeUv=uv;gl_Position=vec4(position.xy,0.,1.);}', depthTest: false, side: THREE.DoubleSide });
    const geometry = variant==='serpent'?createPortraitMorphGeometry():new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene(), camera = new THREE.Camera();
    scene.add(new THREE.Mesh(geometry, material));
    let disposed = false, ready = false, visible = true, dirty = true, frame = 0, last = 0, elapsed = 0;
    let lastReaction = 0, reactionStart = -Infinity;
    const source = variant === 'gecko' ? '/images/amethyst-reptile.webp' : '/images/celestial-serpent.webp';
    const texture = new THREE.TextureLoader().load(source, () => { if (disposed) return; uniforms.artwork.value = texture;if(!uniforms.strikeArtwork.value)uniforms.strikeArtwork.value=texture; ready = true; dirty = true; });
    const strikeTexture=variant==='serpent'?new THREE.TextureLoader().load('/images/celestial-serpent-strike.png',()=>{
      if(disposed)return;uniforms.strikeArtwork.value=strikeTexture;uniforms.strikeReady.value=1;dirty=true;
    }):null;
    const resize = new ResizeObserver(() => { renderer.setSize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight)); dirty = true; }); resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; }); observer.observe(element);
    const animate = now => {
      frame = requestAnimationFrame(animate);
      if (now - last < 14) return;
      const dt = Math.min((now - last) / 1000, .06); last = now;
      if (!ready || !visible || document.hidden) return;
      const { paused: stop, progress: travel } = state.current;
      const still = stop || reduced.matches;
      if (!still) { elapsed += dt; dirty = true; }
      if (!still && state.current.reaction !== lastReaction) {
        lastReaction = state.current.reaction; reactionStart = elapsed; dirty = true;
      }
      if (!dirty) return;
      const reactionAge = elapsed - reactionStart;
      uniforms.response.value = variant === 'gecko' && reactionAge < 1.4 ? Math.sin(Math.PI * reactionAge / 1.4) * Math.exp(-reactionAge * .65) : 0;
      uniforms.time.value = elapsed;
      if (!still) uniforms.voyage.value = travel?.get() || 0;
      const greetingBlink = THREE.MathUtils.smoothstep(reactionAge,.08,.18) * (1-THREE.MathUtils.smoothstep(reactionAge,.24,.43));
      uniforms.eyelid.value = variant === 'serpent' ? 0 : Math.max(blinkAt(elapsed, variant), greetingBlink);
      element.dataset.reaction = String(lastReaction); element.dataset.response = uniforms.response.value.toFixed(3);
      renderer.render(scene, camera);
      element.dataset.ready = 'true';element.dataset.jawOpen=(variant==='serpent'?THREE.MathUtils.smoothstep(uniforms.voyage.value,.12,.48)*uniforms.strikeReady.value:0).toFixed(3); element.dataset.livingTime = elapsed.toFixed(2); element.dataset.blink = uniforms.eyelid.value.toFixed(3); dirty = false;
    };
    frame = requestAnimationFrame(animate);
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); texture.dispose(); strikeTexture?.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, [variant, near]);
  return <div ref={host} className={`living-portrait-effect ${className}`} data-creature={variant} aria-hidden="true"/>;
}
