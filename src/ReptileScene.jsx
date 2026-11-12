import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildChameleon } from './chameleon-anatomy.js';

const modes = {
  natural: { skin: '#92b276', pale: '#d8d0a0', scale: '#aac98a', light: '#c5d7b9', dust: '#e5f2ce' },
  amethyst: { skin: '#afa2c2', pale: '#dbd0ac', scale: '#cbb6df', light: '#c5b3ef', dust: '#ecc8ff' },
  nebula: { skin: '#88ac7c', pale: '#d4cda1', scale: '#a8c495', light: '#b5d1ae', dust: '#d7f1d3' },
  stardust: { skin: '#71a4b5', pale: '#c6d2ac', scale: '#a6d5d8', light: '#a5d8e3', dust: '#c5fbff' },
};

export default function ReptileScene({ paused = false, colorMode = 'natural', scan = false, explode = false, allowPageScroll = false }) {
  const hostRef = useRef(null);
  const options = useRef({ paused, colorMode, scan, explode });
  const updateRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { options.current = { paused, colorMode, scan, explode }; updateRef.current?.(); }, [paused, colorMode, scan, explode]);
  useEffect(() => {
    const host = hostRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setUnavailable(true); return undefined; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 80);
    camera.position.set(1.5, 1.0, 9.8);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 640 ? 1.2 : 1.5));
    renderer.setClearColor('#10071d', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px;';
    renderer.domElement.setAttribute('aria-label', '鱗と立体的な体形を再現したカメレオンの3Dモデル。ドラッグで回転、ピンチで拡大できます');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, .04);
    scene.environment = envTarget.texture; scene.environmentIntensity = .30;
    environment.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#f3f1e6', '#292035', .8));
    const key = new THREE.DirectionalLight('#fff5df', 2.3); key.position.set(1, 5, 5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.near=.1;key.shadow.camera.far=16;key.shadow.normalBias=.012;key.shadow.bias=-.0001;scene.add(key);
    const rim = new THREE.DirectionalLight('#d299ff', 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight('#b4d3df', .5); fill.position.set(0, -1, 4); scene.add(fill);
    const animal = buildChameleon(); animal.rotation.y = -.10; scene.add(animal);
    const { skin, pale, scales, scaleData, dark, head, eyes, breathing, textures } = animal.userData;
    const shaderUniforms = { uExplosion: { value: 0 }, uScan: { value: 0 }, uScanY: { value: -.6 }, uScanColor: { value: new THREE.Color('#9aebff') } };
    const scanVertex = `varying vec3 vScanPosition; uniform float uExplosion;`;
    const shaderMaterials = [skin, pale, scales.material];
    shaderMaterials.forEach(mat => {
      mat.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, shaderUniforms);
        shader.vertexShader = scanVertex + '\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
            vec3 origin = instanceMatrix[3].xyz;
            float jitter = fract(sin(dot(origin, vec3(12.9898,78.233,31.711))) * 43758.5453);
            vec3 outward = normalize(origin - vec3(0., .4, 0.) + vec3(sin(origin.x*14.)*.22,.04,cos(origin.y*17.)*.28));
            mvPosition.xyz += outward * uExplosion * (.65 + jitter * 1.45);
          #endif
          vScanPosition = mvPosition.xyz;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;
        `);
        shader.fragmentShader = `varying vec3 vScanPosition; uniform float uScan; uniform float uScanY; uniform vec3 uScanColor;\n` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float scanBand = exp(-pow((vScanPosition.y-uScanY)*13.,2.));
          float grid = pow(.5+.5*sin(vScanPosition.y*105.),18.);
          totalEmissiveRadiance += uScanColor * uScan * (scanBand*2.7+grid*.16);
        `);
      };
      mat.customProgramCacheKey = () => 'orbit-jewel-scanning-v1';
    });
    scales.frustumCulled = false;
    const wireMaterial = new THREE.MeshBasicMaterial({ color: '#bc9dff', wireframe: true, transparent: true, opacity: .16, depthWrite: false });
    const wire = new THREE.Group();
    animal.children.forEach(object => {
      if (!object.isMesh || object.isInstancedMesh || object.material === dark || object.material === animal.userData.branchMaterial) return;
      const twin = new THREE.Mesh(object.geometry, wireMaterial);
      twin.position.copy(object.position); twin.quaternion.copy(object.quaternion); twin.scale.copy(object.scale).multiplyScalar(1.004);
      wire.add(twin);
    });
    wire.visible = false; animal.add(wire);
    const scanRing = new THREE.Mesh(new THREE.TorusGeometry(2.35, .006, 6, 180), new THREE.MeshBasicMaterial({ color: '#b0e6ff', transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }));
    scanRing.rotation.x = Math.PI / 2; scanRing.visible = false; animal.add(scanRing);
    const orbits = new THREE.Group(); scene.add(orbits);
    const orbitMats = [];
    for (const [radius, angle, opacity] of [[3.5,.15,.4],[3.8,-.35,.16],[3.2,.8,.2]]) {
      const points = Array.from({length:201}, (_, i) => new THREE.Vector3(Math.cos(i/200*Math.PI*2)*radius,0,Math.sin(i/200*Math.PI*2)*radius));
      const mat = new THREE.LineBasicMaterial({ color: '#d2a5ff', transparent: true, opacity }); orbitMats.push(mat);
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), mat);
      orbit.rotation.z = angle; orbit.position.y = -.45; orbits.add(orbit);
    }
    const satellites = [];
    for (let i=0;i<7;i++) {
      const dot = new THREE.Mesh(new THREE.OctahedronGeometry(i===0?.065:.03,0), new THREE.MeshBasicMaterial({ color: '#eac7ff' }));
      orbits.add(dot); satellites.push(dot);
    }
    let seed=274; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const starPositions=[];
    for(let i=0;i<700;i++) starPositions.push((random()-.5)*17,(random()-.5)*10,(random()-.5)*12-2);
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    const starMaterial = new THREE.PointsMaterial({color:'#edcbff',size:.027,transparent:true,opacity:.78,sizeAttenuation:true,blending:THREE.AdditiveBlending,depthWrite:false});
    const stars = new THREE.Points(starGeometry,starMaterial); scene.add(stars);
    const controls = new OrbitControls(camera,renderer.domElement);
    // OrbitControls connects with touch-action:none; restore native vertical
    // page gestures for the inline viewer after that connection is established.
    if (allowPageScroll) renderer.domElement.style.touchAction = 'pan-y';
    controls.target.set(-.15,.15,0); controls.enableDamping=true; controls.dampingFactor=.07; controls.enablePan=false;
    controls.minDistance=6; controls.maxDistance=14; controls.minPolarAngle=Math.PI*.35; controls.maxPolarAngle=Math.PI*.57; controls.minAzimuthAngle=-.9; controls.maxAzimuthAngle=.9; controls.autoRotate=false;
    // Scrolling the surrounding experience should remain natural; pinch zoom still works.
    const wheelGuard = event => event.stopImmediatePropagation();
    if (allowPageScroll) renderer.domElement.addEventListener('wheel', wheelGuard, {capture:true,passive:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,time=0,previous=performance.now(),visible=true,explosion=0,scanLevel=0,appliedMode='';
    const color = new THREE.Color();
    const applyOptions = () => {
      const palette=modes[options.current.colorMode]||modes.natural;
      if(appliedMode!==options.current.colorMode) {
        appliedMode=options.current.colorMode;
        skin.color.set(palette.skin);pale.color.set(palette.pale);rim.color.set(palette.light);starMaterial.color.set(palette.dust);
        orbitMats.forEach(mat=>mat.color.set(palette.light));
        satellites.forEach(dot=>dot.material.color.set(palette.dust));
        scaleData.forEach((item,i)=>{
          color.set(palette.scale);
          const stripe=Math.sin(item.position.x*10+item.position.y*3.7);
          color.offsetHSL(Math.sin(i*2.39)*.025,0,stripe>.63?-.13:Math.sin(i*7.1)*.08);
          if(Math.abs(item.position.y-.35)<.055) color.set(palette.pale);
          scales.setColorAt(i,color);
        });scales.instanceColor.needsUpdate=true;
      }
      wire.visible=options.current.scan;scanRing.visible=options.current.scan;
      if(reduced.matches||options.current.paused) {
        explosion=options.current.explode?1:0;scanLevel=options.current.scan?1:0;
        shaderUniforms.uExplosion.value=explosion;shaderUniforms.uScan.value=scanLevel;
        skin.opacity=1-explosion*.88;pale.opacity=1-explosion*.88;scales.material.opacity=explosion*.95;
        renderer.render(scene,camera);
      }
    };
    updateRef.current=applyOptions;applyOptions();
    const resize=()=>{
      const {width,height}=host.getBoundingClientRect();renderer.setSize(width,Math.max(1,height),false);
      camera.aspect=width/Math.max(1,height);camera.fov=35;
      const distance=Math.max(6.8,5.65/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.79));
      camera.position.sub(controls.target).normalize().multiplyScalar(distance).add(controls.target);
      controls.minDistance=distance*.66;controls.maxDistance=distance*1.5;
      camera.updateProjectionMatrix();controls.update();renderer.render(scene,camera);
    };
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{rootMargin:'100px'});intersection.observe(host);
    const onLost=event=>{event.preventDefault();setUnavailable(true);};renderer.domElement.addEventListener('webglcontextlost',onLost);
    const animate=now=>{
      frame=requestAnimationFrame(animate);const delta=Math.min((now-previous)/1000,.05);previous=now;
      if(!visible||document.hidden)return;
      const moving=!options.current.paused&&!reduced.matches;
      controls.autoRotate=false;
      if(moving){
        time+=delta;
        const rect=host.getBoundingClientRect(), scrollPose=THREE.MathUtils.clamp((innerHeight*.55-rect.top)/Math.max(1,rect.height),0,1);
        animal.position.y=Math.sin(time*.7)*.025;
        animal.rotation.y=THREE.MathUtils.lerp(animal.rotation.y,-.22+scrollPose*.36+Math.sin(time*.24)*.035,.04);
        breathing.scale.y=1+Math.sin(time*1.35)*.007;
        head.rotation.z=Math.sin(time*.37)*.008;
        eyes.forEach((eye,i)=>{eye.rotation.y=Math.sin(time*.48+i*2)*.055;eye.rotation.x=Math.sin(time*.29+i)*.022;});
        orbits.rotation.y=time*.035;stars.rotation.y=time*.006;
        explosion=THREE.MathUtils.lerp(explosion,options.current.explode?1:0,1-Math.exp(-delta*3.7));
        scanLevel=THREE.MathUtils.lerp(scanLevel,options.current.scan?1:0,1-Math.exp(-delta*5));
        shaderUniforms.uExplosion.value=explosion;shaderUniforms.uScan.value=scanLevel;
        shaderUniforms.uScanY.value=-1.3+(Math.sin(time*.8)*.5+.5)*3.1;
        scanRing.position.y=shaderUniforms.uScanY.value;scanRing.rotation.z=time*.1;
        skin.opacity=1-explosion*.88;pale.opacity=1-explosion*.88;scales.material.opacity=explosion*.95;
      }
      satellites.forEach((dot,i)=>{const angle=time*(.14+i*.025)+i*.91;dot.position.set(Math.cos(angle)*3.5,-.45+Math.sin(angle)*.65,Math.sin(angle)*3.5);dot.rotation.y=time*.7+i;});
      controls.update();renderer.render(scene,camera);
    };
    frame=requestAnimationFrame(animate);
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();controls.dispose();updateRef.current=null;
      renderer.domElement.removeEventListener('wheel',wheelGuard,true);renderer.domElement.removeEventListener('webglcontextlost',onLost);
      const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(mat=>materials.add(mat));});
      geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(texture=>texture.dispose());envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  }, []);
  return <div ref={hostRef} className="reptile-scene-host" style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {unavailable&&<div role="status" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',padding:32,textAlign:'center',color:'#e8cbff',background:'#14091f'}}><p style={{fontSize:18}}>この環境では3Dビューを表示できません。</p><p style={{fontSize:13,lineHeight:1.8}}>WebGLに対応したブラウザでお楽しみください。</p></div>}
  </div>;
}
