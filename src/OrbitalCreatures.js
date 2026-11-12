import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// These are complete, textured glTF meshes. Their silhouettes, shading and
// occlusion change as they turn; no portrait planes or sprites are used here.
const inhabitants = [
  { id: 'python', size: .92, phase: 2.05, radius: 2.10, height: .72, depth: .67, speed: .092, yaw: -.45, pitch: .60, roll: -.17 },
  { id: 'crocodile', size: 1.28, phase: 4.38, radius: 2.10, height: .62, depth: -.60, speed: .085, yaw: 1.08, pitch: .78, roll: -.20 },
  { id: 'dragon', size: 1.55, phase: .18, radius: 2.30, height: .77, depth: .61, speed: .145, yaw: -.65, pitch: .20, roll: .03 },
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
    node.skeleton?.dispose();
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

export function createOrbitalCreatures({ onReady, onError }) {
  const group = new THREE.Group();
  group.name = 'orbital-living-meshes';
  const loader = new GLTFLoader(), residents = [];
  let disposed = false;
  for (const path of inhabitants) {
    loader.load(`/models/orbital/${path.id}.glb`, gltf => {
      const model = gltf.scene;
      if (disposed) { releaseModel(model); return; }
      const bounds = new THREE.Box3().setFromObject(model);
      const extent = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const normalization = 1 / Math.max(extent.x, extent.y, extent.z);
      // Keep centering outside the animated root so skeletal clips cannot
      // overwrite normalization or the flight path.
      const centered = new THREE.Group();
      centered.scale.setScalar(normalization);
      centered.position.copy(center).multiplyScalar(-normalization);
      centered.add(model);
      const pose = new THREE.Group();
      pose.add(centered);
      const orbit = new THREE.Group();
      orbit.name = `orbital-${path.id}`;
      orbit.add(pose); group.add(orbit);
      let meshCount = 0, triangles = 0;
      model.traverse(node => {
        if (!node.isMesh) return;
        meshCount++;
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        // Composite the solid creatures after the luminous, depthless rings.
        // Their actual mesh depth still tests against the opaque planet and
        // against other animals, so the far half of each orbit is occluded.
        node.renderOrder = 3;
        // Broad animated wings must not disappear against their rest-pose bounds.
        if (node.isSkinnedMesh) node.frustumCulled = false;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          material.transparent = true;
          material.opacity = 1;
          material.depthWrite = true;
          material.depthTest = true;
          material.forceSinglePass = true;
          material.envMapIntensity = path.id === 'dragon' ? .55 : .24;
          material.roughness = path.id === 'dragon' ? .46 : Math.min(material.roughness ?? .7, .76);
          if (path.id === 'dragon') material.metalness = .18;
          for (const value of Object.values(material)) if (value?.isTexture) value.anisotropy = 4;
        }
      });
      let mixer, flap, glide;
      const flight = gltf.animations.find(clip => clip.name === 'Fly Flap');
      if (flight) {
        mixer = new THREE.AnimationMixer(model);
        flap = mixer.clipAction(flight).play();
        const glideClip = gltf.animations.find(clip => clip.name === 'Fly Glide');
        if (glideClip) glide = mixer.clipAction(glideClip).setEffectiveWeight(.15).play();
      }
      residents.push({ path, model, pose, orbit, mixer, flap, glide });
      onReady?.({ id: path.id, count: residents.length, meshCount, triangles, animated: Boolean(mixer) });
    }, undefined, () => { if (!disposed) onError?.(path.id); });
  }
  return {
    group,
    update(time, progress, resonance) {
      for (const { path, orbit, pose, mixer, flap, glide } of residents) {
        const angle = path.phase + time * path.speed + progress * .68;
        const bob = Math.sin(time * .78 + path.phase) * .075;
        orbit.position.set(
          Math.cos(angle) * path.radius,
          Math.sin(angle) * path.radius * path.height + bob,
          Math.sin(angle) * path.radius * path.depth,
        );
        const arrival = THREE.MathUtils.smoothstep(progress + .19, 0, .18);
        orbit.scale.setScalar(path.size * arrival * (1 + resonance * .035));
        if (mixer) {
          const wingWeight = .82 + Math.sin(time * .23) * .12;
          flap.setEffectiveWeight(wingWeight);
          glide?.setEffectiveWeight(1 - wingWeight);
          mixer.setTime(time * .76);
          // The dragon banks toward the direction of travel while its rig
          // animates the wings, spine, jaw, feet and tail independently.
          pose.rotation.set(path.pitch + Math.sin(time * .47) * .10,
            path.yaw - angle * .60, path.roll + Math.sin(angle) * .22);
        } else {
          // A drifting animal turns enough to reveal its back, sides and belly.
          pose.rotation.set(path.pitch + Math.sin(time * .46 + path.phase) * .12,
            path.yaw + time * .15 + progress * .48,
            path.roll + Math.sin(time * .39 + path.phase) * .12);
          pose.scale.y = 1 + Math.sin(time * 1.55 + path.phase) * .018;
        }
      }
    },
    dispose() {
      disposed = true;
      for (const { model, mixer } of residents) {
        mixer?.stopAllAction();
        mixer?.uncacheRoot(model);
        releaseModel(model);
      }
      group.clear();
    },
  };
}
