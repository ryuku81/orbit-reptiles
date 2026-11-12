import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// This original procedural sculpture is an artistic interpretation, not a species scan.
// Scales share a single instanced draw call. No external model or texture is needed.
function taperedTube(points, startRadius, endRadius, segments = 110, sides = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], normals = [], indices = [], uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
      positions.push(point.x + normal.x * radius, point.y + normal.y * radius, point.z + normal.z * radius);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(t, j / sides);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function buildChameleon() {
  const group = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: '#752bc1', roughness: 0.28, metalness: 0.36, clearcoat: 1, clearcoatRoughness: 0.15, iridescence: 0.62, iridescenceIOR: 1.5, iridescenceThicknessRange: [130, 420], transparent: true });
  const pale = new THREE.MeshPhysicalMaterial({ color: '#d6a1ef', roughness: 0.22, metalness: 0.24, clearcoat: 1, iridescence: 0.35, transparent: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2c0e49', roughness: 0.45 });
  const eyeMaterial = new THREE.MeshPhysicalMaterial({ color: '#10051c', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  const mesh = (geometry, material, position, scale) => {
    const object = new THREE.Mesh(geometry, material);
    if (position) object.position.set(...position);
    if (scale) object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    group.add(object);
    return object;
  };
  mesh(sphere, skin, [-0.2, 0.42, 0], [1.25, 0.78, 0.38]);
  mesh(sphere, pale, [-0.08, 0.02, 0], [1.08, 0.39, 0.342]);
  mesh(sphere, skin, [0.91, 0.65, 0], [0.46, 0.48, 0.32]);
  const head = mesh(sphere, skin, [1.32, 0.61, 0], [0.57, 0.36, 0.31]);
  head.rotation.z = -0.12;
  mesh(sphere, pale, [1.39, 0.39, 0], [0.46, 0.11, 0.26]);
  // Tapered casque, beveled at the edges, distinctive to the veiled chameleon.
  const casqueOutline = new THREE.Shape();
  casqueOutline.moveTo(0.83, 0.64);
  casqueOutline.quadraticCurveTo(0.79, 1.18, 0.95, 1.61);
  casqueOutline.quadraticCurveTo(1.11, 1.54, 1.45, 0.82);
  casqueOutline.lineTo(1.43, 0.6);
  casqueOutline.closePath();
  const casque = new THREE.ExtrudeGeometry(casqueOutline, { depth: 0.28, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.07, bevelThickness: 0.075, curveSegments: 22 });
  mesh(casque, skin, [0, 0, -0.14]);
  // A thin raised stripe runs over the casque rather than a solid plastic fin.
  mesh(taperedTube([[0.82,0.88,0],[0.86,1.3,0],[0.96,1.6,0],[1.14,1.31,0]],0.025,0.014,45,8),pale);
  for (const side of [-1, 1]) {
    mesh(sphere, skin, [1.4, 0.77, side * 0.285], [0.238, 0.229, 0.19]);
    mesh(sphere, pale, [1.435, 0.779, side * 0.447], [0.122, 0.128, 0.039]);
    mesh(sphere, eyeMaterial, [1.459, 0.783, side * 0.481], [0.049, 0.084, 0.019]);
    mesh(sphere, new THREE.MeshBasicMaterial({color:'#fcddff'}), [1.474,0.817,side * 0.495], [0.013,0.016,0.006]);
    mesh(sphere, dark, [1.79, 0.647, side * 0.188], [0.022,0.015,0.008]);
    mesh(taperedTube([[1.06,0.409,side*0.269],[1.4,0.404,side*0.27],[1.72,0.458,side*0.18],[1.86,0.49,side*0.07]],0.009,0.005,45,6),dark);
    // The fore and hind feet each wrap the branch with opposing sets of toes.
    const legs = [
      [[0.6,0.22,side*0.25],[0.62,-0.12,side*0.47],[0.99,-0.43,side*0.43],[1.08,-0.75,side*0.11]],
      [[-0.98,0.12,side*0.22],[-1.17,-0.2,side*0.44],[-0.79,-0.52,side*0.43],[-0.89,-0.78,side*0.12]],
    ];
    for (const points of legs) {
      mesh(taperedTube(points,0.125,0.052,50,14),skin);
      const foot = points.at(-1);
      mesh(sphere,pale,[foot[0],foot[1],foot[2]],[0.11,0.07,0.1]);
      for(let toe=0;toe<3;toe++) {
        const x = foot[0] + (toe-1)*0.057;
        mesh(taperedTube([[x,-0.73,side*0.11],[x+0.035,-0.78,side*0.21],[x+0.045,-0.94,side*0.16],[x+0.016,-0.98,side*0.04]],0.027,0.009,20,7),skin);
        mesh(taperedTube([[x,-0.75,side*0.08],[x-0.035,-0.79,-side*0.12],[x-0.03,-0.91,-side*0.14]],0.022,0.008,16,7),pale);
      }
    }
  }
  const tailPoints = [[-1.25,0.42,0],[-1.59,0.17,0],[-1.82,-0.23,0],[-1.93,-0.7,0]];
  for(let i=0;i<=100;i++) {
    const t=i/100, angle = Math.PI + t*Math.PI*3.6, radius=0.65*(1-t)+0.075;
    tailPoints.push([-1.18 + Math.cos(angle)*radius, -0.7 + Math.sin(angle)*radius,0]);
  }
  mesh(taperedTube(tailPoints,0.18,0.012,220,16),skin);
  // Thousands of individual pebbled scales. They follow the body's surface normals.
  const scaleData=[];
  const addScales = (center,radii,rows,columns,mainColor) => {
    for(let row=1;row<rows;row++) {
      const phi=(row/rows)*Math.PI;
      const count=Math.max(5,Math.round(columns*Math.sin(phi)));
      for(let col=0;col<count;col++) {
        const theta=(col/count)*Math.PI*2 + (row%2)*0.035;
        const nx=Math.sin(phi)*Math.cos(theta),ny=Math.cos(phi),nz=Math.sin(phi)*Math.sin(theta);
        const position=new THREE.Vector3(center[0]+radii[0]*nx,center[1]+radii[1]*ny,center[2]+radii[2]*nz);
        const normal=new THREE.Vector3(nx/radii[0],ny/radii[1],nz/radii[2]).normalize();
        const stripe=Math.sin(position.x*10 + position.y*3.7);
        const color=new THREE.Color(mainColor);
        color.offsetHSL(stripe>0.63?0.035:-0.025,0, stripe>0.63?-0.13:Math.sin(col*7.1+row*13.4)*0.055);
        if(Math.abs(position.y-0.35)<0.055) color.set('#f4b6ff');
        scaleData.push({position,normal,color,size:0.022+0.01*Math.sin(phi)});
      }
    }
  };
  addScales([-0.2,0.42,0],[1.256,0.786,0.386],47,125,'#a95be8');
  addScales([1.32,0.61,0],[0.574,0.365,0.314],24,62,'#a159db');
  const scales = new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5), new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:0.23,metalness:0.52,clearcoat:1,clearcoatRoughness:.13,iridescence:.7,iridescenceThicknessRange:[120,440]}),scaleData.length);
  const dummy=new THREE.Object3D(),zAxis=new THREE.Vector3(0,0,1);
  scaleData.forEach(({position,normal,color,size},index)=>{
    dummy.position.copy(position);
    dummy.quaternion.setFromUnitVectors(zAxis,normal);
    dummy.scale.set(size*1.15,size,0.011);
    dummy.updateMatrix();
    scales.setMatrixAt(index,dummy.matrix);
    scales.setColorAt(index,color);
  });
  scales.instanceMatrix.needsUpdate=true;
  scales.instanceColor.needsUpdate=true;
  group.add(scales);
  // Small serrated dorsal scales rather than oversized dinosaur spikes.
  const cone = new THREE.ConeGeometry(0.039,0.12,6);
  for(let i=0;i<34;i++) {
    const x=-1.27+i*0.066, y=0.42+0.78*Math.sqrt(Math.max(0,1-((x+0.2)/1.25)**2));
    const spike=mesh(cone,pale,[x,y+0.035,0]);
    spike.rotation.z=0.3;
    spike.scale.y=0.5+Math.sin((i/34)*Math.PI)*0.6;
  }
  const branchMaterial=new THREE.MeshPhysicalMaterial({color:'#2a0f49',roughness:.22,metalness:.48,clearcoat:1});
  mesh(taperedTube([[-2.8,-1.08,0.08],[-1.25,-0.9,0],[0.6,-0.85,0],[2.5,-0.63,0.08]],0.16,0.11,90,18),branchMaterial);
  mesh(taperedTube([[1.65,-0.76,0.03],[2.0,-0.39,-0.1],[2.5,-0.25,-0.17]],0.075,0.014,30,10),branchMaterial);
  // Fine longitudinal bark fissures catch grazing light.
  for(let i=0;i<12;i++) {
    const a=(i/12)*Math.PI*2;
    mesh(taperedTube([[-2.7,-1.07+Math.sin(a)*0.15,0.08+Math.cos(a)*0.15],[-1.2,-0.9+Math.sin(a)*0.14,Math.cos(a)*0.14],[0.6,-0.85+Math.sin(a)*0.12,Math.cos(a)*0.12],[2.4,-0.65+Math.sin(a)*0.1,0.08+Math.cos(a)*0.1]],0.006,0.003,50,5),dark);
  }
  group.userData = { skin, pale, scales, scaleData, dark, branchMaterial };
  return group;
}

const modes = {
  amethyst: { skin: '#752bc1', pale: '#d6a1ef', scale: '#a95be8', light: '#d299ff', dust: '#ecc8ff' },
  nebula: { skin: '#b92f8c', pale: '#ffb2db', scale: '#e06dba', light: '#ff91d4', dust: '#ffe0f4' },
  stardust: { skin: '#227fba', pale: '#a8f3f5', scale: '#65cbe8', light: '#70ebff', dust: '#c5fbff' },
};

export default function ReptileScene({ paused = false, colorMode = 'amethyst', scan = false, explode = false, allowPageScroll = false }) {
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
    camera.position.set(3.1, 1.6, 9.2);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 640 ? 1.2 : 1.5));
    renderer.setClearColor('#10071d', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px;';
    renderer.domElement.setAttribute('aria-label', '紫の爬虫類アートモデル。ドラッグで回転、ピンチで拡大できます');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, .04);
    scene.environment = envTarget.texture; scene.environmentIntensity = .85;
    environment.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#efd8ff', '#210b3c', 1));
    const key = new THREE.DirectionalLight('#fff0fc', 3.1); key.position.set(2, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight('#d299ff', 3.8); rim.position.set(-3, 2, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight('#62dfff', 1.8); fill.position.set(0, -1, 4); scene.add(fill);
    const animal = buildChameleon(); animal.rotation.y = -.14; scene.add(animal);
    const { skin, pale, scales, scaleData, dark } = animal.userData;
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
    controls.target.set(-.15,.15,0); controls.enableDamping=true; controls.dampingFactor=.07; controls.enablePan=false;
    controls.minDistance=6; controls.maxDistance=14; controls.minPolarAngle=Math.PI*.17; controls.maxPolarAngle=Math.PI*.72; controls.autoRotateSpeed=.62;
    // Scrolling the surrounding experience should remain natural; pinch zoom still works.
    const wheelGuard = event => event.stopImmediatePropagation();
    if (allowPageScroll) renderer.domElement.addEventListener('wheel', wheelGuard, {capture:true,passive:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,time=0,previous=performance.now(),visible=true,explosion=0,scanLevel=0,appliedMode='';
    const color = new THREE.Color();
    const applyOptions = () => {
      const palette=modes[options.current.colorMode]||modes.amethyst;
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
        skin.opacity=1-explosion*.83;pale.opacity=1-explosion*.83;
        renderer.render(scene,camera);
      }
    };
    updateRef.current=applyOptions;applyOptions();
    const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.fov=width<600?44:35;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{rootMargin:'100px'});intersection.observe(host);
    const onLost=event=>{event.preventDefault();setUnavailable(true);};renderer.domElement.addEventListener('webglcontextlost',onLost);
    const animate=now=>{
      frame=requestAnimationFrame(animate);const delta=Math.min((now-previous)/1000,.05);previous=now;
      if(!visible||document.hidden)return;
      const moving=!options.current.paused&&!reduced.matches;
      controls.autoRotate=moving;
      if(moving){
        time+=delta;animal.position.y=Math.sin(time*.7)*.05;orbits.rotation.y=time*.035;stars.rotation.y=time*.006;
        explosion=THREE.MathUtils.lerp(explosion,options.current.explode?1:0,1-Math.exp(-delta*3.7));
        scanLevel=THREE.MathUtils.lerp(scanLevel,options.current.scan?1:0,1-Math.exp(-delta*5));
        shaderUniforms.uExplosion.value=explosion;shaderUniforms.uScan.value=scanLevel;
        shaderUniforms.uScanY.value=-1.3+(Math.sin(time*.8)*.5+.5)*3.1;
        scanRing.position.y=shaderUniforms.uScanY.value;scanRing.rotation.z=time*.1;
        skin.opacity=1-explosion*.83;pale.opacity=1-explosion*.83;
      }
      satellites.forEach((dot,i)=>{const angle=time*(.14+i*.025)+i*.91;dot.position.set(Math.cos(angle)*3.5,-.45+Math.sin(angle)*.65,Math.sin(angle)*3.5);dot.rotation.y=time*.7+i;});
      controls.update();renderer.render(scene,camera);
    };
    frame=requestAnimationFrame(animate);
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();controls.dispose();updateRef.current=null;
      renderer.domElement.removeEventListener('wheel',wheelGuard,true);renderer.domElement.removeEventListener('webglcontextlost',onLost);
      const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(mat=>materials.add(mat));});
      geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  }, []);
  return <div ref={hostRef} className="reptile-scene-host" style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {unavailable&&<div role="status" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',padding:32,textAlign:'center',color:'#e8cbff',background:'#14091f'}}><p style={{fontSize:18}}>この環境では3Dビューを表示できません。</p><p style={{fontSize:13,lineHeight:1.8}}>WebGLに対応したブラウザでお楽しみください。</p></div>}
  </div>;
}
