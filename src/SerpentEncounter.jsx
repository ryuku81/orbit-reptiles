import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './serpent-encounter.css';

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const phaseName = p => p < .18 ? 'curious' : p < .38 ? 'recoil' : p < .58 ? 'gape' : p < .82 ? 'strike' : 'pass';
const readProgress = value => clamp(typeof value === 'number' ? value : value?.get?.() || 0);

/** The opening, coiling and strike all articulate real geometry in one scene. */
export default function SerpentEncounter({ progress, paused = false, reduced = false, onReady }) {
  const hostRef = useRef(null);
  const propsRef = useRef({ progress, paused, reduced, onReady });
  const refreshRef = useRef(null);
  useEffect(() => {
    propsRef.current = { progress, paused, reduced, onReady };
    refreshRef.current?.();
  }, [progress, paused, reduced, onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer, frame = 0, resizeFrame = 0, disposed = false, lost = false;
    let visible = true, loaded = false, previous = 0, elapsed = 0, poseProgress = 0;
    let width = 1, height = 1, mobile = false, fit = 1;
    let gltfRoot, head, jaw, tongue, contract = {}, poses;
    let restJaw, restTongue;
    const fangs = [], smallTeeth = [], morphMeshes = [], skinMaterials = [];
    const resources = new Set(), cleanups = [];
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const addResource = value => { resources.add(value); return value; };
    const motionReduced = () => propsRef.current.reduced || media.matches;
    const active = () => loaded && !disposed && !lost && visible && !document.hidden && !propsRef.current.paused && !motionReduced();
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame);
      cleanups.forEach(fn => fn());
      resources.forEach(resource => resource.dispose?.());
      renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
      refreshRef.current = null;
    };

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .9;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, .055, 70);
      camera.position.set(0, 0, 8.5);
      const placement = new THREE.Group(), animal = new THREE.Group();
      scene.add(placement); placement.add(animal);
      const environmentScene = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = addResource(pmrem.fromScene(environmentScene, .04));
      scene.environment = environment.texture;
      environmentScene.dispose(); pmrem.dispose();

      scene.add(new THREE.HemisphereLight('#b3a6ed', '#160725', .32));
      const key = new THREE.DirectionalLight('#d7d4ff', 1.65); key.position.set(-3, 5, 6); scene.add(key);
      const cool = new THREE.DirectionalLight('#92bdff', 1.8); cool.position.set(4, 1, 3); scene.add(cool);
      const rim = new THREE.DirectionalLight('#9950ff', 4); rim.position.set(1, 3, -4); scene.add(rim);
      const lowerLight = new THREE.PointLight('#fb8de9', 3, 16, 2); lowerLight.position.set(-2, -3, 3); scene.add(lowerLight);
      const mouthLight = new THREE.PointLight('#d993ff', 0, 4, 2); scene.add(mouthLight);

      // These few real particles give the approaching head depth without a bloom pass.
      let seed = 71425;
      const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
      const motesPositions = new Float32Array(180 * 3), motesPhase = new Float32Array(180);
      for (let i = 0; i < 180; i++) {
        motesPositions.set([(random() - .5) * 9, (random() - .5) * 8, (random() - .5) * 5], i * 3);
        motesPhase[i] = random() * 6.283;
      }
      const motesGeometry = addResource(new THREE.BufferGeometry());
      motesGeometry.setAttribute('position', new THREE.BufferAttribute(motesPositions, 3));
      motesGeometry.setAttribute('phase', new THREE.BufferAttribute(motesPhase, 1));
      const motesMaterial = addResource(new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, energy: { value: 0 }, dpr: { value: 1 }, fade: { value: 1 } },
        vertexShader: `attribute float phase; uniform float time;uniform float energy;uniform float dpr;varying float vGlow;void main(){vec3 p=position;p.y+=sin(time*.25+phase)*.12;p.xy*=1.+energy*.2;p.z+=energy*2.;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.3+sin(phase)*.5)*dpr*9./-mv.z,1.,8.);vGlow=.35+.3*sin(time+phase);}`,
        fragmentShader: `uniform float fade;varying float vGlow;void main(){float d=length(gl_PointCoord-.5);float a=exp(-d*d*35.);if(d>.5)discard;gl_FragColor=vec4(.78,.48,1.,a*vGlow*fade);}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const motes = new THREE.Points(motesGeometry, motesMaterial); motes.frustumCulled = false; scene.add(motes);

      const initialBounds = new THREE.Box3(), initialSize = new THREE.Vector3(), initialCenter = new THREE.Vector3();
      const headWorld = new THREE.Vector3(), mouthFocus = new THREE.Vector3(), mouthOffset = new THREE.Vector3(), mouthScreen = new THREE.Vector3();
      const focusLocal = new THREE.Vector3(0, -.25, .75), lightOffset = new THREE.Vector3();
      const quaternionA = new THREE.Quaternion(), quaternionB = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const poseQuaternion = pose => {
        if (pose.quaternion) return new THREE.Quaternion().fromArray(pose.quaternion);
        return new THREE.Quaternion().setFromEuler(new THREE.Euler(...(pose.rotation || [0, 0, 0])));
      };
      const normalizedPose = (pose, fallback) => ({
        position: new THREE.Vector3().fromArray(pose?.position || fallback.position.toArray()),
        quaternion: pose ? poseQuaternion(pose) : fallback.quaternion.clone(),
      });
      const applyHeadPose = (from, to, t) => {
        head.position.copy(from.position).lerp(to.position, t);
        quaternionA.copy(from.quaternion); quaternionB.copy(to.quaternion);
        head.quaternion.copy(quaternionA).slerp(quaternionB, t);
      };
      const setMorph = (name, weight) => {
        for (const mesh of morphMeshes) {
          const key = Object.keys(mesh.morphTargetDictionary).find(key => key.toLowerCase() === name.toLowerCase());
          if (key !== undefined) mesh.morphTargetInfluences[mesh.morphTargetDictionary[key]] = weight;
        }
      };
      const pose = p => {
        if (!loaded) return;
        const tension = smooth(.18, .38, p);
        const opening = smooth(.36, .56, p);
        const strike = smooth(.58, .82, p);
        const exit = smooth(.85, 1, p);
        const neckRise = smooth(.38, .58, p) * .22;
        const morphStrike = neckRise + (1 - neckRise) * strike;
        const breathe = Math.sin(elapsed * 1.9) * (1 - smooth(.36, .66, p));
        const curious = (1 - tension) * (1 - opening);
        setMorph(contract.morphNames?.recoil || 'recoil', tension * (1 - morphStrike));
        setMorph(contract.morphNames?.strike || 'strike', morphStrike);
        setMorph(contract.mouth?.halfMorph || 'gapeHalf', Math.max(0, 1 - Math.abs(opening - .5) * 2));
        setMorph(contract.mouth?.fullMorph || 'gape', Math.max(0, opening * 2 - 1));
        if (head && poses) {
          if (p < .38) applyHeadPose(poses.rest, poses.recoil, tension);
          else applyHeadPose(poses.recoil, poses.strike, morphStrike);
          // Tiny anatomical motion stays at the head/neck, not on the background.
          head.position.y += .018 * breathe;
          euler.set(Math.sin(elapsed * .64) * .018 * curious, Math.sin(elapsed * .42) * .045 * curious, Math.sin(elapsed * .57) * .012 * curious);
          head.quaternion.multiply(quaternionA.setFromEuler(euler));
        }
        const jawAngle = opening * (contract.jaw?.maxAngle || 1.3);
        if (jaw) {
          jaw.rotation.copy(restJaw);
          jaw.rotation[contract.jaw?.axis || 'x'] += jawAngle * (contract.jaw?.sign ?? 1);
        }
        for (const fang of fangs) fang.node.rotation.x = fang.rest + ((contract.fangs?.openAngle ?? 0) - (contract.fangs?.closedAngle ?? 1.2)) * opening;
        for (const tooth of smallTeeth) tooth.visible = opening > .12;
        if (tongue && restTongue) {
          tongue.position.copy(restTongue);
          tongue.position.z += Math.max(0, Math.sin(elapsed * 2.8)) ** 16 * .085 * curious;
          tongue.rotation.z = Math.sin(elapsed * 7) * .018 * (opening + curious * .2);
        }

        const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        const centerX = THREE.MathUtils.lerp(mobile ? .54 : .70, .50, strike);
        const centerY = THREE.MathUtils.lerp(mobile ? .50 : .45, .50, strike);
        animal.scale.set(fit, fit * (1 + breathe * .008), fit);
        animal.rotation.set(0, Math.sin(elapsed * .34) * .025 * curious, -.035 * tension * (1 - strike));
        placement.position.set((centerX - .5) * viewHeight * camera.aspect, (.5 - centerY) * viewHeight, 0);
        if (head) {
          head.localToWorld(mouthFocus.copy(focusLocal));
          mouthOffset.copy(mouthFocus).sub(placement.position);
          const mouthWidth = contract.head?.width || .95;
          const fitMouthWidth = fit * mouthWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .84);
          const lensDistance = Math.max(.9, fit * 2.15, fitMouthWidth);
          // Aim the open mouth at the lens, rather than enlarging the entire
          // animal around its body center. Its neck and coils follow in real Z.
          placement.position.x -= mouthOffset.x * strike;
          placement.position.y -= mouthOffset.y * strike;
          placement.position.z = (camera.position.z - lensDistance - mouthOffset.z) * strike + exit * (lensDistance + 2.5);
          // Preserve the screen-space approach line as perspective magnifies it;
          // otherwise an off-center head drifts toward the viewport edge first.
          const perspective = (camera.position.z - placement.position.z - mouthOffset.z) / (camera.position.z - mouthOffset.z);
          placement.position.x = (placement.position.x + mouthOffset.x) * perspective - mouthOffset.x;
          placement.position.y = (placement.position.y + mouthOffset.y) * perspective - mouthOffset.y;
        }
        host.style.opacity = String(1 - smooth(.85, .98, p));
        const hue = motionReduced() ? .76 : (.76 + elapsed / 6.7) % 1;
        for (const entry of skinMaterials) {
          entry.material.color.copy(entry.base).lerp(entry.shift.setHSL(hue, .80, .25), .48);
          entry.material.iridescence = .55;
        }
        rim.color.setHSL((hue + .05) % 1, .7, .67);
        lowerLight.intensity = 3 + opening * 2;
        if (head) {
          head.getWorldPosition(headWorld);
          mouthLight.position.copy(headWorld).add(lightOffset.set(0, -.18 * fit, .65 * fit));
          mouthLight.intensity = opening * .35;
          head.localToWorld(mouthFocus.copy(focusLocal));
          mouthScreen.copy(mouthFocus).project(camera);
          host.dataset.mouthX = ((mouthScreen.x + 1) / 2).toFixed(3);
          host.dataset.mouthY = ((1 - mouthScreen.y) / 2).toFixed(3);
        }
        motesMaterial.uniforms.time.value = elapsed;
        motesMaterial.uniforms.energy.value = opening * .2 + strike * .8;
        motesMaterial.uniforms.fade.value = 1 - exit;
        host.dataset.phase = phaseName(p);
        host.dataset.progress = p.toFixed(3);
        host.dataset.jaw = jawAngle.toFixed(3);
        host.dataset.headZ = headWorld.z.toFixed(3);
        host.dataset.time = elapsed.toFixed(2);
      };
      const draw = () => { if (!disposed && !lost) renderer.render(scene, camera); };
      const resize = () => {
        if (disposed) return;
        width = host.clientWidth; height = host.clientHeight;
        if (!width || !height) return;
        mobile = width < 641;
        const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.5, Math.sqrt(2400000 / (width * height)));
        renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
        motesMaterial.uniforms.dpr.value = dpr;
        camera.aspect = width / height; camera.updateProjectionMatrix();
        if (loaded) {
          const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
          const heightFraction = mobile ? Math.min(.44, Math.max(.28, (height - 450) / height)) : .64;
          fit = Math.min(viewHeight * camera.aspect * (mobile ? .94 : .56) / initialSize.x, viewHeight * heightFraction / initialSize.y);
          pose(poseProgress);
        }
        draw();
      };
      const loop = now => {
        frame = 0;
        if (!active()) { previous = 0; return; }
        const nextProgress = readProgress(propsRef.current.progress);
        const changing = Math.abs(nextProgress - poseProgress) > .0001;
        if (previous && now - previous < (changing ? 15 : 30)) { frame = requestAnimationFrame(loop); return; }
        const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 30;
        previous = now; elapsed += dt;
        poseProgress = nextProgress;
        pose(poseProgress); draw();
        host.dataset.renderState = 'running';
        frame = requestAnimationFrame(loop);
      };
      const refresh = () => {
        cancelAnimationFrame(frame); frame = 0; previous = 0;
        if (motionReduced()) { poseProgress = 0; pose(0); draw(); }
        if (active()) frame = requestAnimationFrame(loop);
        else host.dataset.renderState = propsRef.current.paused ? 'paused' : motionReduced() ? 'reduced' : 'hidden';
      };
      refreshRef.current = refresh;
      const resizeObserver = new ResizeObserver(() => {
        if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); });
      });
      resizeObserver.observe(host);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }); intersection.observe(host);
      const onLost = event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); host.dataset.ready = 'false'; host.style.opacity = '0'; propsRef.current.onReady?.(false); };
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      document.addEventListener('visibilitychange', refresh); media.addEventListener('change', refresh);
      cleanups.push(() => resizeObserver.disconnect(), () => intersection.disconnect(), () => document.removeEventListener('visibilitychange', refresh), () => media.removeEventListener('change', refresh), () => renderer.domElement.removeEventListener('webglcontextlost', onLost));
      resize(); refresh();

      Promise.all([
        new GLTFLoader().loadAsync('/models/hero/serpent.glb'),
        fetch('/models/hero/serpent-contract.json').then(response => response.ok ? response.json() : {}).catch(() => ({})),
      ]).then(([gltf, metadata]) => {
        if (disposed) {
          gltf.scene.traverse(node => { node.geometry?.dispose(); if (node.material) for (const m of [].concat(node.material)) { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); } });
          return;
        }
        contract = metadata;
        if (contract.head?.focusLocal) focusLocal.fromArray(contract.head.focusLocal);
        gltfRoot = gltf.scene;
        const styledMaterials = new Set();
        gltfRoot.traverse(node => {
          if (!node.isMesh) return;
          if (/^(Upper[ _]palatal[ _]tooth|Lower[ _]tooth)/i.test(node.name)) smallTeeth.push(node);
          addResource(node.geometry);
          if (node.morphTargetDictionary) { morphMeshes.push(node); node.frustumCulled = false; }
          for (const material of [].concat(node.material)) {
            addResource(material);
            Object.values(material).forEach(value => { if (value?.isTexture) { value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); addResource(value); } });
            if (/skin|scale|serpent|body|head|jaw/i.test(material.name) && !/mouth|inner|gum|fang|tooth|eye|tongue/i.test(material.name)) {
              const physical = new THREE.MeshPhysicalMaterial();
              THREE.MeshStandardMaterial.prototype.copy.call(physical, material);
              physical.color.multiply(new THREE.Color('#8539c6'));
              physical.name = material.name; physical.iridescence = .55; physical.iridescenceIOR = 1.4; physical.iridescenceThicknessRange = [110, 410];
              physical.clearcoat = .28; physical.clearcoatRoughness = .26; physical.roughness = Math.min(.42, material.roughness ?? .38); physical.envMapIntensity = .32;
              addResource(physical);
              if (Array.isArray(node.material)) node.material = node.material.map(value => value === material ? physical : value); else node.material = physical;
              skinMaterials.push({ material: physical, base: physical.color.clone(), shift: new THREE.Color() });
            } else if (material.isMeshStandardMaterial && !styledMaterials.has(material)) {
              styledMaterials.add(material);
              material.envMapIntensity = .45;
              if (/throat/i.test(material.name)) {
                material.envMapIntensity = 0; material.roughness = 1; material.clearcoat = 0;
                material.color.multiplyScalar(.18);
              } else if (/oral|mucosa|gum|palatal/i.test(material.name) && !/tooth|teeth/i.test(material.name)) {
                material.envMapIntensity = .1; material.roughness = .65; material.clearcoat = .03;
                material.color.multiply(new THREE.Color('#8f486e'));
              }
            }
          }
        });
        head = gltfRoot.getObjectByName('HeadRig'); jaw = gltfRoot.getObjectByName('LowerJaw'); tongue = gltfRoot.getObjectByName('TongueRig');
        if (head) {
          const fallback = { position: head.position.clone(), quaternion: head.quaternion.clone() };
          const source = contract.head || {};
          poses = { rest: normalizedPose(source.rest, fallback), recoil: normalizedPose(source.recoil, fallback), strike: normalizedPose(source.strike, fallback) };
        }
        if (jaw) restJaw = jaw.rotation.clone();
        if (tongue) restTongue = tongue.position.clone();
        for (const name of ['FangL', 'FangR']) { const node = gltfRoot.getObjectByName(name); if (node) fangs.push({ node, rest: node.rotation.x }); }
        initialBounds.setFromObject(gltfRoot, true); initialBounds.getSize(initialSize); initialBounds.getCenter(initialCenter);
        // Centering is independent of the head pivots and body morph coordinates.
        gltfRoot.position.sub(initialCenter); animal.add(gltfRoot);
        loaded = true; host.dataset.ready = 'true'; host.dataset.meshes = String(morphMeshes.length);
        poseProgress = motionReduced() ? 0 : readProgress(propsRef.current.progress);
        resize(); pose(poseProgress); draw(); refresh(); propsRef.current.onReady?.(true);
      }).catch(error => {
        if (disposed) return;
        host.dataset.ready = 'false'; host.dataset.renderState = 'fallback'; host.dataset.error = error.message;
        propsRef.current.onReady?.(false);
        cancelAnimationFrame(frame); frame = 0;
      });
    } catch {
      host.dataset.ready = 'false'; propsRef.current.onReady?.(false); cleanup();
    }
    return cleanup;
  }, []);

  return <div ref={hostRef} className="serpent-webgl-encounter" data-ready="false" data-phase="curious" aria-hidden="true" />;
}
