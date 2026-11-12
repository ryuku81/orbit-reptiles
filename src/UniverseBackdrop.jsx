import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const nebulaVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

const nebulaFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uProgress;
  uniform float uEnergy;
  uniform float uTextureReady;
  uniform sampler2D uReference;
  mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.; float amplitude = .54;
    for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p = turn(.46) * p * 2.08 + 3.7; amplitude *= .49; }
    return value;
  }
  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vUv;
    vec2 p = (uv - .5) * vec2(aspect, 1.);
    p += uPointer * .018;
    p = turn(uProgress * .23 + sin(uTime * .016) * .012) * p;
    float travel = uProgress * 1.9;
    vec2 q = p * 2.75 + vec2(travel * .3, -travel * .24);
    q += vec2(uTime * .006, -uTime * .003);
    vec2 flow = vec2(fbm(q + vec2(1.7, 9.2)), fbm(q + vec2(8.3, 2.8)));
    float cloud = fbm(q * 1.65 + flow * 3.8);
    float veil = fbm(q * 3.5 - flow * 2.3);
    float ridges = pow(max(0., 1. - abs(cloud * 2. - 1.)), 6.);
    vec2 lightCenter = vec2(.30 * aspect + sin(travel) * .13, .25 - cos(travel) * .035);
    float bloom = exp(-length((p - lightCenter) * vec2(.88, 1.25)) * 3.4);
    float secondary = exp(-length((p + vec2(.37 * aspect, .28)) * vec2(1.1, .8)) * 3.8);
    float cloudEnvelope = smoothstep(.20, .86, uv.y) * .65 + .18;
    vec3 color = vec3(.017, .009, .035);
    color += vec3(.125, .035, .25) * cloud * cloudEnvelope;
    color += vec3(.30, .075, .47) * pow(cloud, 2.2) * (bloom * 1.8 + secondary * .7);
    color += vec3(.41, .16, .57) * ridges * bloom * veil * .86;
    color += vec3(.25, .055, .32) * secondary * cloud * .3;
    color += vec3(.58, .28, .74) * pow(bloom, 3.) * (.35 + veil * .8);
    // Delicate plasma strands catch the light along the cloud's moving edge.
    float strand = pow(max(0., 1. - abs(veil - .48) * 18.), 4.);
    color += vec3(.38, .13, .61) * strand * bloom * .10;
    vec2 imageUv = (uv - .5) * vec2(min(1., aspect / 1.4286), min(1., 1.4286 / aspect)) + .5;
    imageUv += vec2(sin(travel * .7) * .025, cos(travel * .5) * .018) + uPointer * .008;
    vec3 reference = texture2D(uReference, clamp(imageUv, .001, .999)).rgb;
    color += reference * .28 * uTextureReady;
    // A bright horizontal core and tiny optical halo, kept away from left-hand copy.
    vec2 lightDelta = p - lightCenter;
    float horizontal = exp(-abs(lightDelta.y) * 230.) * exp(-abs(lightDelta.x) * 3.5);
    color += vec3(.53, .26, .85) * horizontal * .095;
    float halo = exp(-abs(length(lightDelta * vec2(1., 1.2)) - .16) * 80.);
    color += vec3(.38, .12, .64) * halo * .018;
    color *= .82 + uEnergy * .055;
    float vignette = 1. - smoothstep(.15, 1.15, length((uv - .5) * vec2(.9, 1.)));
    color *= .72 + vignette * .28;
    color += (hash(gl_FragCoord.xy) - .5) * .003;
    gl_FragColor = vec4(color, 1.);
  }
`;

const starVertex = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vWarp;
  uniform float uTime;
  uniform float uTravel;
  uniform float uEnergy;
  uniform float uDpr;
  void main() {
    vec3 p = position;
    p.z = -mod(-position.z - uTravel - uTime * .18, 110.) - 3.;
    float rotation = uTravel * .0009;
    p.xy = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) * p.xy;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    vWarp = uEnergy * .92;
    gl_PointSize = clamp(aSize * (130. / -mv.z) * uDpr, 1.05, 8.5 * uDpr) * (1. + vWarp * 1.9);
    vColor = aColor;
    vAngle = atan(mv.y, mv.x);
    vAlpha = (.68 + .24 * sin(uTime * (.4 + aPhase * .03) + aPhase)) * smoothstep(3., 10., -mv.z) * (1. - smoothstep(75., 113., -mv.z));
  }
`;

const starFragment = `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vWarp;
  void main() {
    vec2 p = gl_PointCoord - .5;
    float c = cos(vAngle), s = sin(vAngle);
    p = mat2(c, -s, s, c) * p;
    p.y *= 1. + vWarp * 5.;
    float d = length(p);
    if (d > .5) discard;
    float core = exp(-d * d * 72.);
    float glow = exp(-d * d * 14.) * .18;
    float flare = exp(-abs(p.x) * 60.) * exp(-abs(p.y) * 12.) * .08;
    gl_FragColor = vec4(vColor, (core + glow + flare) * vAlpha);
  }
`;

/** A single persistent star field; scroll MotionValues never enter React state. */
export default function UniverseBackdrop({ progress, velocity, paused = false }) {
  const hostRef = useRef(null);
  const propsRef = useRef({ progress, velocity, paused });
  const updateRef = useRef(null);
  useEffect(() => {
    propsRef.current = { progress, velocity, paused };
    updateRef.current?.();
  }, [progress, velocity, paused]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer, frame = 0, disposed = false, lost = false;
    let previous = 0, elapsed = 0, currentProgress = 0, energy = 0;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resources = [];
    const cleanups = [];
    const pointer = new THREE.Vector2();
    const smoothedPointer = new THREE.Vector2();
    const geometry = item => { resources.push(item); return item; };
    const material = item => { resources.push(item); return item; };
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanups.forEach(fn => fn());
      resources.forEach(item => item.dispose());
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      updateRef.current = null;
    };
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
      renderer.setClearColor('#090410', 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.autoClear = false;
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);
      const nebula = new THREE.Scene();
      const fullscreenCamera = new THREE.Camera();
      const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      blank.needsUpdate = true;
      resources.push(blank);
      const nebulaUniforms = {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: smoothedPointer }, uTime: { value: 0 },
        uProgress: { value: 0 }, uEnergy: { value: 0 },
        uTextureReady: { value: 0 }, uReference: { value: blank },
      };
      nebula.add(new THREE.Mesh(geometry(new THREE.PlaneGeometry(2, 2)), material(new THREE.ShaderMaterial({
        vertexShader: nebulaVertex, fragmentShader: nebulaFragment, uniforms: nebulaUniforms,
        depthTest: false, depthWrite: false,
      }))));
      const starScene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(54, 1, .1, 150);
      const count = innerWidth < 640 ? 900 : 1600;
      const positions = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count), colors = new Float32Array(count * 3);
      // Fixed seed prevents a visual jump on strict-mode setup and remounting.
      let seed = 58421;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const palette = ['#cbbaff', '#f4ddff', '#bd94f0', '#f4a7dc', '#ffb090'];
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (random() - .5) * 120;
        positions[i * 3 + 1] = (random() - .5) * 85;
        positions[i * 3 + 2] = -random() * 110 - 3;
        sizes[i] = .48 + Math.pow(random(), 4) * 3.1;
        phases[i] = random() * 30;
        color.set(palette[Math.floor(random() * palette.length)]);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      const starGeometry = geometry(new THREE.BufferGeometry());
      starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      starGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      const starUniforms = { uTime: { value: 0 }, uTravel: { value: 0 }, uEnergy: { value: 0 }, uDpr: { value: 1 } };
      const stars = new THREE.Points(starGeometry, material(new THREE.ShaderMaterial({
        vertexShader: starVertex, fragmentShader: starFragment, uniforms: starUniforms,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      })));
      stars.frustumCulled = false;
      starScene.add(stars);
      const moving = () => !disposed && !lost && !document.hidden && !propsRef.current.paused && !media.matches;
      const render = () => {
        if (disposed || lost) return;
        renderer.clear();
        renderer.render(nebula, fullscreenCamera);
        renderer.clearDepth();
        renderer.render(starScene, camera);
      };
      const resize = () => {
        const width = host.clientWidth, height = host.clientHeight;
        if (!width || !height || disposed) return;
        const dpr = Math.min(devicePixelRatio || 1, width < 640 ? 1 : 1.25);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        nebulaUniforms.uResolution.value.set(width, height);
        starUniforms.uDpr.value = dpr;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      };
      const loop = now => {
        frame = 0;
        if (!moving()) { previous = 0; return; }
        // 30 fps keeps the full-screen procedural atmosphere economical.
        if (previous && now - previous < 30) { frame = requestAnimationFrame(loop); return; }
        const dt = previous ? Math.min((now - previous) / 1000, .08) : 1 / 30;
        previous = now;
        elapsed += dt;
        const target = THREE.MathUtils.clamp(propsRef.current.progress?.get?.() || 0, 0, 1);
        const speed = Math.min(Math.abs(propsRef.current.velocity?.get?.() || 0) / 2500, 1);
        currentProgress = THREE.MathUtils.lerp(currentProgress, target, 1 - Math.exp(-dt * 3.6));
        energy = THREE.MathUtils.lerp(energy, speed, 1 - Math.exp(-dt * 4));
        smoothedPointer.lerp(pointer, 1 - Math.exp(-dt * 1.4));
        nebulaUniforms.uTime.value = elapsed;
        nebulaUniforms.uProgress.value = currentProgress;
        nebulaUniforms.uEnergy.value = energy;
        starUniforms.uTime.value = elapsed;
        starUniforms.uTravel.value = currentProgress * 94;
        starUniforms.uEnergy.value = energy;
        camera.position.x = smoothedPointer.x * .35;
        camera.position.y = smoothedPointer.y * .22;
        camera.rotation.z = Math.sin(currentProgress * Math.PI) * .045;
        render();
        frame = requestAnimationFrame(loop);
      };
      const update = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
        render();
        if (moving()) frame = requestAnimationFrame(loop);
      };
      const onPointer = event => {
        if (!moving() || event.pointerType === 'touch') return;
        pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1));
      };
      const onLost = event => {
        event.preventDefault();
        lost = true;
        cancelAnimationFrame(frame);
        renderer.domElement.style.opacity = '0';
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      window.addEventListener('pointermove', onPointer, { passive: true });
      document.addEventListener('visibilitychange', update);
      media.addEventListener('change', update);
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      cleanups.push(() => observer.disconnect(), () => window.removeEventListener('pointermove', onPointer), () => document.removeEventListener('visibilitychange', update), () => media.removeEventListener('change', update), () => renderer.domElement.removeEventListener('webglcontextlost', onLost));
      const texture = new THREE.TextureLoader().load('/images/universe-reference.webp', image => {
        if (disposed) { image.dispose(); return; }
        nebulaUniforms.uTextureReady.value = 1;
        nebulaUniforms.uReference.value = image;
        render();
      }, undefined, () => {});
      texture.colorSpace = THREE.SRGBColorSpace;
      resources.push(texture);
      updateRef.current = update;
      resize();
      update();
    } catch {
      cleanup();
    }
    return cleanup;
  }, []);

  return <div ref={hostRef} className="universe-backdrop" aria-hidden="true" style={{
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    background: '#090410 url(/images/universe-reference.webp) center / cover no-repeat',
  }} />;
}
