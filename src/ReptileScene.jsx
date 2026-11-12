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
  const skin = new THREE.MeshPhysicalMaterial({ color: '#3caa42', roughness: 0.54, metalness: 0.05, clearcoat: 0.22, clearcoatRoughness: 0.54 });
  const pale = new THREE.MeshPhysicalMaterial({ color: '#b2d655', roughness: 0.58, clearcoat: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#153b25', roughness: 0.45 });
  const eyeMaterial = new THREE.MeshPhysicalMaterial({ color: '#050b06', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
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
    mesh(sphere, new THREE.MeshBasicMaterial({color:'#e9ffcf'}), [1.474,0.817,side * 0.495], [0.013,0.016,0.006]);
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
        if(Math.abs(position.y-0.35)<0.055) color.set('#c5de65');
        scaleData.push({position,normal,color,size:0.022+0.01*Math.sin(phi)});
      }
    }
  };
  addScales([-0.2,0.42,0],[1.256,0.786,0.386],47,125,'#6db94c');
  addScales([1.32,0.61,0],[0.574,0.365,0.314],24,62,'#5dac45');
  const scales = new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5), new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.63,metalness:0.025}),scaleData.length);
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
  const branchMaterial=new THREE.MeshStandardMaterial({color:'#3b3829',roughness:0.93});
  mesh(taperedTube([[-2.8,-1.08,0.08],[-1.25,-0.9,0],[0.6,-0.85,0],[2.5,-0.63,0.08]],0.16,0.11,90,18),branchMaterial);
  mesh(taperedTube([[1.65,-0.76,0.03],[2.0,-0.39,-0.1],[2.5,-0.25,-0.17]],0.075,0.014,30,10),branchMaterial);
  // Fine longitudinal bark fissures catch grazing light.
  for(let i=0;i<12;i++) {
    const a=(i/12)*Math.PI*2;
    mesh(taperedTube([[-2.7,-1.07+Math.sin(a)*0.15,0.08+Math.cos(a)*0.15],[-1.2,-0.9+Math.sin(a)*0.14,Math.cos(a)*0.14],[0.6,-0.85+Math.sin(a)*0.12,Math.cos(a)*0.12],[2.4,-0.65+Math.sin(a)*0.1,0.08+Math.cos(a)*0.1]],0.006,0.003,50,5),dark);
  }
  return group;
}

export default function ReptileScene({ paused = false }) {
  const hostRef = useRef(null);
  const pausedRef = useRef(paused);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const host=hostRef.current;
    let renderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}); }
    catch { setUnavailable(true); return undefined; }
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(35,1,0.1,80);
    camera.position.set(3.3,1.7,9.3);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
    renderer.setClearColor('#10071d',0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=0.95;
    renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px;';
    renderer.domElement.setAttribute('aria-label','立体のカメレオン。ドラッグで回転、スクロールまたはピンチで拡大できます');
    renderer.domElement.setAttribute('role','img');
    host.appendChild(renderer.domElement);
    const environment=new RoomEnvironment();
    const pmrem=new THREE.PMREMGenerator(renderer);
    const envTarget=pmrem.fromScene(environment,0.04);
    scene.environment=envTarget.texture;
    scene.environmentIntensity=0.48;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#e6d7ff','#24103e',0.85));
    const key=new THREE.DirectionalLight('#efffd4',2.1);
    key.position.set(2,5,4); scene.add(key);
    const rim=new THREE.DirectionalLight('#c890ff',2.4);
    rim.position.set(-3,2,-3); scene.add(rim);
    const fill=new THREE.DirectionalLight('#a1baff',0.65);
    fill.position.set(0,-1,4); scene.add(fill);
    const animal=buildChameleon();
    animal.rotation.y=-0.14;
    scene.add(animal);
    const orbits=new THREE.Group();
    scene.add(orbits);
    const makeOrbit=(radius,angle,opacity)=>{
      const points=[];
      for(let i=0;i<=160;i++) {const a=i/160*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius));}
      const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#d0a4ff',transparent:true,opacity}));
      line.rotation.z=angle; line.position.y=-0.45;
      orbits.add(line);
    };
    makeOrbit(3.5,0.15,0.18);makeOrbit(3.8,-0.35,0.08);makeOrbit(3.2,0.8,0.09);
    const satellites=[];
    for(let i=0;i<3;i++) {
      const dot=new THREE.Mesh(new THREE.SphereGeometry(i===0?0.04:0.024,12,8),new THREE.MeshBasicMaterial({color:'#e6c7ff'}));
      orbits.add(dot);satellites.push(dot);
    }
    let seed=274;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const starPositions=[];
    for(let i=0;i<330;i++) starPositions.push((random()-0.5)*22,(random()-0.5)*14,(random()-0.5)*14-3);
    const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#e3d0ff',size:0.017,transparent:true,opacity:0.58,sizeAttenuation:true}));
    scene.add(stars);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(-0.15,0.15,0);
    controls.enableDamping=true;
    controls.dampingFactor=0.06;
    controls.enablePan=false;
    controls.minDistance=5;
    controls.maxDistance=14;
    controls.minPolarAngle=Math.PI*0.17;
    controls.maxPolarAngle=Math.PI*0.72;
    controls.autoRotateSpeed=0.42;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0, time=0, previous=performance.now(), visible=true;
    const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.fov=width<600?40:35;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const visibility=()=>{visible=!document.hidden;};
    document.addEventListener('visibilitychange',visibility);
    const onLost=(event)=>{event.preventDefault();setUnavailable(true);};
    renderer.domElement.addEventListener('webglcontextlost',onLost);
    const animate=(now)=>{
      frame=requestAnimationFrame(animate);
      const delta=Math.min((now-previous)/1000,0.05);previous=now;
      if(!visible) return;
      const motion=!pausedRef.current&&!reduced.matches;
      controls.autoRotate=motion;
      if(motion) {
        time+=delta;
        animal.position.y=Math.sin(time*0.7)*0.025;
        orbits.rotation.y=time*0.025;
        stars.rotation.y=time*0.003;
      }
      satellites.forEach((dot,i)=>{const angle=time*(0.19+i*0.04)+i*2.2;dot.position.set(Math.cos(angle)*3.5,-0.45+Math.sin(angle)*0.52,Math.sin(angle)*3.5);});
      controls.update();renderer.render(scene,camera);
    };
    frame=requestAnimationFrame(animate);
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
      document.removeEventListener('visibilitychange',visibility);
      renderer.domElement.removeEventListener('webglcontextlost',onLost);
      const geometries=new Set(),materials=new Set();
      scene.traverse((object)=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));});
      geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
      envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  }, []);
  return <div ref={hostRef} style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {unavailable && <div role="status" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',padding:32,textAlign:'center',color:'#c5d5bd',background:'#14091f'}}><p style={{fontSize:18}}>この環境では3Dビューを表示できません。</p><p style={{fontSize:13,lineHeight:1.8}}>WebGLに対応したブラウザでお楽しみください。</p></div>}
  </div>;
}
