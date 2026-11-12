import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Re-light the supplied artwork, keeping the nebula dark and the pearlescent scales luminous.
const fragment = `
uniform sampler2D artwork;
uniform float time;
uniform float voyage;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 original=texture2D(artwork,vUv).rgb;
  float light=dot(original,vec3(.2126,.7152,.0722));
  float skin=smoothstep(.18,.66,light);
  float phase=time*.036+vUv.y*.34+vUv.x*.13+voyage*.35;
  vec3 spectrum=.56+.44*cos(6.283185*(phase+vec3(0.,.333,.667)));
  vec3 pearl=mix(original, spectrum*(light*1.28+.15),skin*.78);
  float sweep=fract(vUv.x*.38+vUv.y*.62-time*.068);
  float shine=pow(max(0.,1.-abs(sweep-.5)*15.),5.)*skin;
  pearl+=vec3(.52,.57,.65)*shine;
  vec2 grid=vUv*vec2(79.,53.);
  vec2 cell=fract(grid)-.5;
  float seed=hash(floor(grid));
  float blink=pow(max(0.,sin(time*1.7+seed*39.)),24.);
  float cross=exp(-abs(cell.x)*85.-abs(cell.y)*8.)+exp(-abs(cell.y)*85.-abs(cell.x)*8.);
  pearl+=vec3(.72,.84,1.)*cross*blink*skin*step(.82,seed)*.7;
  gl_FragColor=vec4(pearl,1.);
}`;

export default function SerpentRadiance({ paused = false, progress }) {
  const host = useRef(null), state = useRef({ paused, progress });
  state.current = { paused, progress };
  useEffect(() => {
    const element = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    element.appendChild(renderer.domElement);
    const uniforms = { artwork: { value: null }, time: { value: 0 }, voyage: { value: 0 } };
    const material = new THREE.ShaderMaterial({ uniforms, fragmentShader: fragment, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', depthTest: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();
    let disposed = false, ready = false, visible = true, dirty = true, frame = 0, last = 0, elapsed = 0;
    const texture = new THREE.TextureLoader().load('/images/celestial-serpent.webp', () => {
      if (disposed) return;
      uniforms.artwork.value = texture; ready = true; dirty = true;
    });
    const resize = new ResizeObserver(() => {
      renderer.setSize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight)); dirty = true;
    }); resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; }); observer.observe(element);
    const animate = now => {
      frame = requestAnimationFrame(animate);
      if (now - last < 33) return;
      const dt = Math.min((now - last) / 1000, .06); last = now;
      if (!ready || !visible || document.hidden) return;
      const { paused: still, progress: travel } = state.current;
      if (!still) { elapsed += dt; dirty = true; }
      if (!dirty) return;
      uniforms.time.value = elapsed;
      uniforms.voyage.value = still ? 0 : (travel?.get() || 0);
      renderer.render(scene, camera); element.dataset.ready = 'true'; dirty = false;
    };
    frame = requestAnimationFrame(animate);
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); texture.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, []);
  return <div ref={host} className="serpent-radiance" aria-hidden="true"/>;
}
