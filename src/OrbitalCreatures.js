import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Full meshes, PBR skin textures and regional Blender shape-key animations.
// All dimensions are in planet-space; paths stay outside the opaque globe.
const inhabitants = [
  { id: 'dragon', instance: 'dragon-umber', tint: '#94847a', size: 1.60, phase: .20, radius: 2.40, tilt: .42, turn: -.27, speed: .24, bank: .10, animationSpeed: 1.10 },
  { id: 'dragon', instance: 'dragon-slate', tint: '#718394', size: 1.40, phase: 2.32, radius: 2.58, tilt: -.38, turn: .34, speed: .21, bank: -.16, animationSpeed: .92 },
  { id: 'dragon', instance: 'dragon-plum', tint: '#92748c', size: 1.75, phase: 4.46, radius: 2.77, tilt: .60, turn: -.40, speed: .19, bank: .17, animationSpeed: 1.02 },
  { id: 'turtle', instance: 'turtle-moss', tint: '#69785e', size: .85, phase: 1.15, radius: 2.20, tilt: -.30, turn: .24, speed: .13, bank: -.08, animationSpeed: 1.12 },
  { id: 'turtle', instance: 'turtle-bronze', tint: '#827266', size: .96, phase: 3.25, radius: 2.48, tilt: .50, turn: -.15, speed: .15, bank: .14, animationSpeed: .98 },
  { id: 'turtle', instance: 'turtle-blue', tint: '#5f7683', size: .76, phase: 5.35, radius: 2.68, tilt: -.58, turn: .38, speed: .12, bank: -.12, animationSpeed: 1.20 },
];

function releaseModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function flightPosition(path, time, progress, out) {
  // Small, continuous acceleration and differences in inclination prevent a
  // mechanical carousel. The tangent is also the animal's actual heading.
  const angle = path.phase + time * path.speed + Math.sin(time * .23 + path.phase) * .11 + progress * .48;
  const radius = path.radius + Math.sin(time * .32 + path.phase) * .12;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * Math.sin(path.tilt);
  const z = Math.sin(angle) * radius * Math.cos(path.tilt);
  out.set(x * Math.cos(path.turn) - y * Math.sin(path.turn),
    x * Math.sin(path.turn) + y * Math.cos(path.turn) + Math.sin(time * .64 + path.phase) * .10,
    z);
}

export function createOrbitalCreatures({ onReady, onError }) {
  const group = new THREE.Group();
  group.name = 'orbital-living-meshes';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), residents = [], assets = new Map(), templates = [];
  let disposed = false;
  const load = id => {
    if (!assets.has(id)) assets.set(id, loader.loadAsync(`/models/orbital/${id}-living.glb`).then(gltf => {
      if (disposed) { releaseModel(gltf.scene); return null; }
      templates.push(gltf.scene);
      gltf.scene.traverse(node => {
        if (!node.isMesh) return;
        node.renderOrder = 3;
        node.frustumCulled = false;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          // Preserve the model's normal and roughness maps. Skin is dielectric.
          material.metalness = 0;
          material.color.set('#ffffff');
          material.onBeforeCompile = shader => {
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat skinLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=mix(vec3(skinLuma),diffuseColor.rgb,.52);');
          };
          material.customProgramCacheKey=()=> 'nocturnal-skin-v1';
          material.envMapIntensity = id === 'dragon' ? .38 : .28;
          material.roughness = id === 'dragon' ? .68 : .78;
          material.depthWrite = true;
          material.side = id === 'dragon' ? THREE.DoubleSide : THREE.FrontSide;
          material.transparent = true;
          material.opacity = 1;
          material.forceSinglePass = true;
          for (const value of Object.values(material)) if (value?.isTexture) value.anisotropy = 8;
        }
      });
      return gltf;
    }));
    return assets.get(id);
  };
  for (const path of inhabitants) {
    load(path.id).then(gltf => {
      if (disposed || !gltf) return;
      const model = gltf.scene.clone(true);
      const pose = new THREE.Group(); pose.add(model);
      const orbit = new THREE.Group(); orbit.name = `orbital-${path.instance}`;
      orbit.add(pose); group.add(orbit);
      let meshCount = 0, triangles = 0;
      model.traverse(node => {
        if (!node.isMesh) return;
        node.material = (Array.isArray(node.material) ? node.material : [node.material]).map(source => {
          const material=source.clone();material.color.set(path.tint);
          material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
          return material;
        });
        if(node.material.length===1)node.material=node.material[0];
        meshCount++;
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      });
      const mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) mixer.clipAction(clip).play();
      residents.push({ path, model, pose, orbit, mixer });
      onReady?.({ id: path.id, count: residents.length, speciesCount: residents.filter(r=>r.path.id===path.id).length, meshCount, triangles, animated: gltf.animations.length > 0 });
    }).catch(() => { if (!disposed) onError?.(path.id); });
  }
  const next = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const dorsal = new THREE.Vector3(0, .72, .70), basis = new THREE.Matrix4();
  const bankQuaternion = new THREE.Quaternion(), forwardAxis = new THREE.Vector3(0, 0, 1);
  return {
    group, surfaceCount: 0, surfaceSnakes: 0,
    update(time, progress, resonance) {
      for (const { path, orbit, pose, mixer } of residents) {
        flightPosition(path, time, progress, orbit.position);
        flightPosition(path, time + .025, progress, next);
        forward.subVectors(next, orbit.position).normalize();
        right.crossVectors(dorsal, forward).normalize();
        up.crossVectors(forward, right).normalize();
        basis.makeBasis(right, up, forward);
        pose.quaternion.setFromRotationMatrix(basis);
        bankQuaternion.setFromAxisAngle(forwardAxis, path.bank + Math.sin(time * .48 + path.phase) * .28);
        pose.quaternion.multiply(bankQuaternion);
        const arrival = THREE.MathUtils.smoothstep(progress + .19, 0, .18);
        orbit.scale.setScalar(path.size * arrival * (1 + resonance * .025));
        mixer.setTime(time * path.animationSpeed + path.phase);
      }
    },
    dispose() {
      disposed = true;
      for (const { model, mixer } of residents) { mixer.stopAllAction(); mixer.uncacheRoot(model);model.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();}); }
      templates.forEach(releaseModel);
      group.clear();
    },
  };
}
