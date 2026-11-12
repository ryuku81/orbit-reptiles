import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// The hero art is its own layer. These objects are actual, independently lit 3D geometry.
export default function CosmicScene({ paused = false }) {
  const hostRef = useRef(null);
  const pausedRef = useRef(paused);
  const updateRef = useRef(null);

  useEffect(() => {
    pausedRef.current = paused;
    updateRef.current?.();
  }, [paused]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    let scene;
    let frame = 0;
    let disposed = false;
    let visible = true;
    let lost = false;
    let elapsed = 0;
    let lastTime = 0;
    const cleanups = [];
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = new THREE.Vector2();
    const smooth = new THREE.Vector2();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const geometry = (item) => { geometries.add(item); return item; };
    const material = (item) => { materials.add(item); return item; };
    const clean = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanups.forEach((fn) => fn());
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      textures.forEach((item) => item.dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
      updateRef.current = null;
    };

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 50);
      camera.position.set(0, 0, 10);
      const world = new THREE.Group();
      scene.add(world);

      scene.add(new THREE.AmbientLight('#8caa7b', 0.6));
      const key = new THREE.DirectionalLight('#ddffc2', 4.3);
      key.position.set(-5, 7, 4);
      const rim = new THREE.DirectionalLight('#74b97e', 2.8);
      rim.position.set(5, -1, -2);
      scene.add(key, rim);

      const planet = new THREE.Group();
      const planetGeometry = geometry(new THREE.SphereGeometry(0.3, 88, 56));
      const positions = planetGeometry.attributes.position;
      const colors = [];
      const n = new THREE.Vector3();
      const dark = new THREE.Color('#153024');
      const light = new THREE.Color('#677553');
      const tone = new THREE.Color();
      for (let i = 0; i < positions.count; i++) {
        n.fromBufferAttribute(positions, i).normalize();
        const roughness = Math.sin(n.x * 19 + Math.sin(n.z * 12) * 2.2) * Math.cos(n.y * 23) * 0.013
          + Math.sin(n.z * 47 + n.x * 21) * Math.cos(n.y * 41) * 0.006
          + Math.cos(n.x * 83 + n.y * 31) * Math.sin(n.z * 72) * 0.002;
        positions.setXYZ(i, n.x * (0.3 + roughness), n.y * (0.3 + roughness), n.z * (0.3 + roughness));
        tone.copy(dark).lerp(light, THREE.MathUtils.clamp(0.35 + roughness * 19, 0, 1));
        colors.push(tone.r, tone.g, tone.b);
      }
      planetGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      planetGeometry.computeVertexNormals();
      const surface = new THREE.Mesh(planetGeometry, material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.12 })));
      planet.add(surface);
      const atmosphereMaterial = material(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { glow: { value: new THREE.Color('#95c770') } },
        vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader: 'varying vec3 vNormal; varying vec3 vView; uniform vec3 glow; void main(){float rim=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),4.);gl_FragColor=vec4(glow,rim*.19);}',
      }));
      planet.add(new THREE.Mesh(geometry(new THREE.SphereGeometry(0.315, 48, 32)), atmosphereMaterial));
      world.add(planet);

      // Thin ellipses are depth-aware line geometry, with small illuminated satellites.
      const orbitGroup = new THREE.Group();
      const orbitDefinitions = [
        { radius: 2.85, tilt: 1.13, turn: -0.35, opacity: 0.25, color: '#9dbb77', phase: 0.45 },
        { radius: 3.12, tilt: 0.48, turn: 0.85, opacity: 0.12, color: '#b4c8ac', phase: 2.8 },
      ];
      const satellites = [];
      for (const definition of orbitDefinitions) {
        const orbit = new THREE.Group();
        const vertices = [];
        for (let i = 0; i <= 240; i++) {
          const angle = i / 240 * Math.PI * 2;
          vertices.push(Math.cos(angle) * definition.radius, Math.sin(angle) * definition.radius, 0);
        }
        const path = geometry(new THREE.BufferGeometry());
        path.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const line = new THREE.LineLoop(path, material(new THREE.LineBasicMaterial({ color: definition.color, transparent: true, opacity: definition.opacity, depthWrite: false })));
        orbit.add(line);
        orbit.rotation.set(definition.tilt, 0.1, definition.turn);
        const dot = new THREE.Mesh(geometry(new THREE.SphereGeometry(0.024, 12, 8)), material(new THREE.MeshBasicMaterial({ color: '#d0eeaa' })));
        orbit.add(dot);
        satellites.push({ dot, ...definition });
        orbitGroup.add(orbit);
      }
      world.add(orbitGroup);

      const shardMaterial = material(new THREE.MeshPhysicalMaterial({ color: '#9caa93', metalness: 0.8, roughness: 0.26, clearcoat: 0.55, clearcoatRoughness: 0.2, flatShading: true }));
      const greenShard = material(new THREE.MeshPhysicalMaterial({ color: '#5c774a', metalness: 0.5, roughness: 0.31, clearcoat: 0.8, flatShading: true }));
      const meteorites = [];
      for (let i = 0; i < 4; i++) {
        const rock = new THREE.Group();
        const body = new THREE.Mesh(geometry(new THREE.IcosahedronGeometry(0.09 + i * 0.014, 0)), i % 2 ? greenShard : shardMaterial);
        body.scale.set(0.78, 1.45, 0.7);
        rock.add(body);
        if (i === 1 || i === 3) {
          const small = new THREE.Mesh(geometry(new THREE.OctahedronGeometry(0.043, 0)), shardMaterial);
          small.position.set(0.08, -0.04, 0.025);
          small.scale.set(0.65, 1.6, 0.65);
          small.rotation.z = -0.5;
          rock.add(small);
        }
        rock.rotation.set(i * 1.3, i * 0.8, i + 0.3);
        world.add(rock);
        meteorites.push(rock);
      }

      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 64;
      const ctx = glowCanvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(220,255,178,0.9)');
        gradient.addColorStop(0.1, 'rgba(187,235,146,0.4)');
        gradient.addColorStop(0.35, 'rgba(139,193,116,0.12)');
        gradient.addColorStop(1, 'rgba(100,170,80,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        textures.add(glowTexture);
        const spriteMaterial = material(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
        satellites.forEach(({ dot }) => {
          const glow = new THREE.Sprite(spriteMaterial);
          glow.scale.set(0.4, 0.4, 1);
          dot.add(glow);
        });
      }

      let viewWidth = 8;
      let viewHeight = 7;
      const layout = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height || disposed || lost) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        viewWidth = viewHeight * camera.aspect;
        planet.position.set(viewWidth * 0.33, viewHeight * 0.33, -0.2);
        orbitGroup.position.set(viewWidth * 0.06, -viewHeight * 0.01, -1.2);
        orbitGroup.scale.setScalar(Math.min(viewWidth / 7.8, 1.22));
        const anchors = [[-0.24, 0.33, 0.2], [0.4, -0.28, 0.45], [-0.32, -0.23, -0.4], [0.11, 0.44, -0.8]];
        meteorites.forEach((rock, i) => {
          rock.position.set(anchors[i][0] * viewWidth, anchors[i][1] * viewHeight, anchors[i][2]);
          rock.userData.baseY = rock.position.y;
        });
        render();
      };
      const moving = () => !disposed && !lost && visible && !document.hidden && !pausedRef.current && !media.matches;
      const render = () => {
        if (disposed || lost) return;
        try { renderer.render(scene, camera); } catch { lost = true; host.style.opacity = '0'; }
      };
      const animate = (time) => {
        frame = 0;
        if (!moving()) { lastTime = 0; return; }
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        elapsed += delta;
        smooth.lerp(pointer, 0.025);
        world.rotation.y = smooth.x * 0.035;
        world.rotation.x = -smooth.y * 0.02;
        surface.rotation.y = elapsed * 0.045;
        planet.rotation.z = 0.2;
        meteorites.forEach((rock, i) => {
          rock.rotation.y += delta * (0.09 + i * 0.018);
          rock.rotation.x += delta * 0.045;
          rock.position.y = rock.userData.baseY + Math.sin(elapsed * 0.28 + i * 1.7) * 0.045;
        });
        satellites.forEach(({ dot, radius, phase }, i) => {
          const angle = phase + elapsed * (i ? -0.026 : 0.033);
          dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        });
        render();
        if (moving()) frame = requestAnimationFrame(animate);
      };
      const update = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        render();
        if (moving()) frame = requestAnimationFrame(animate);
      };
      satellites.forEach(({ dot, radius, phase }) => dot.position.set(Math.cos(phase) * radius, Math.sin(phase) * radius, 0));
      const onPointer = (event) => {
        if (!moving() || event.pointerType === 'touch') return;
        pointer.set(event.clientX / window.innerWidth * 2 - 1, event.clientY / window.innerHeight * 2 - 1);
      };
      const onLost = (event) => {
        event.preventDefault();
        lost = true;
        host.style.opacity = '0';
        cancelAnimationFrame(frame);
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      document.addEventListener('visibilitychange', update);
      media.addEventListener('change', update);
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      cleanups.push(() => window.removeEventListener('pointermove', onPointer), () => document.removeEventListener('visibilitychange', update), () => media.removeEventListener('change', update), () => renderer.domElement.removeEventListener('webglcontextlost', onLost));
      const resize = new ResizeObserver(layout);
      resize.observe(host);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { rootMargin: '80px' });
      intersection.observe(host);
      cleanups.push(() => resize.disconnect(), () => intersection.disconnect());
      updateRef.current = update;
      layout();
      update();
    } catch {
      // Static hero art remains complete on devices without WebGL.
      clean();
    }
    return clean;
  }, []);

  return <div ref={hostRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
