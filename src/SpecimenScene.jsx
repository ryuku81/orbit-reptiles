import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSpecimen } from './specimen-models.js';

export default function SpecimenScene({ species='lg', paused=false, interactive=false, className='' }) {
  const hostRef=useRef(null), pausedRef=useRef(paused), [near,setNear]=useState(false), [failed,setFailed]=useState(false);
  pausedRef.current=paused;
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setNear(entry.isIntersecting),{rootMargin:'180px'});
    observer.observe(hostRef.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!near)return;
    const host=hostRef.current;let renderer;
    try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); }
    catch { setFailed(true); return; }
    setFailed(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio,interactive?1.7:1.35));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText='display:block;width:100%;height:100%;';
    renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(34,1,.1,60);
    camera.position.set(-2.3,4.5,6.1);camera.lookAt(0,.10,0);
    const env=new RoomEnvironment(), pmrem=new THREE.PMREMGenerator(renderer), envTarget=pmrem.fromScene(env,.035);
    scene.environment=envTarget.texture;scene.environmentIntensity=.35;env.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#e9e3ff','#30202c',1));
    const key=new THREE.DirectionalLight('#fff0dc',2.1);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;key.shadow.bias=-.0004;scene.add(key);
    const rim=new THREE.DirectionalLight('#a68bff',2.3);rim.position.set(3,2,-4);scene.add(rim);
    const fill=new THREE.DirectionalLight('#a4d9df',.7);fill.position.set(-4,1,-1);scene.add(fill);
    const specimen=createSpecimen(species);specimen.scale.setScalar(species==='bp'?1.08:1.1);scene.add(specimen);
    const dais=new THREE.Mesh(new THREE.CylinderGeometry(2.67,2.73,.06,96),new THREE.MeshBasicMaterial({color:'#130d1d'}));dais.position.y=-.09;scene.add(dais);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(2.69,.008,6,128),new THREE.MeshBasicMaterial({color:'#8763ad',transparent:true,opacity:.28}));lip.rotation.x=Math.PI*.5;lip.position.y=-.065;scene.add(lip);
    const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const ctx=contactCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,4,64,64,64);grad.addColorStop(0,'rgba(0,0,0,.55)');grad.addColorStop(.55,'rgba(0,0,0,.28)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
    const contactTexture=new THREE.CanvasTexture(contactCanvas),contact=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI*.5;contact.position.y=-.052;scene.add(contact);
    let controls;if(interactive){controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.28,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4.5;controls.maxDistance=10;controls.minPolarAngle=.4;controls.maxPolarAngle=Math.PI*.49;controls.update();renderer.domElement.style.touchAction='pan-y';}
    const wheel=e=>e.stopImmediatePropagation();if(interactive)renderer.domElement.addEventListener('wheel',wheel,{capture:true,passive:true});
    let needsRender=true;
    const resize=()=>{const r=host.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(17))/Math.min(1,camera.aspect)));camera.updateProjectionMatrix();needsRender=true;};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const baseTurn=species==='bp'?.12:species==='cg'?.68:species==='bd'?.47:.50;specimen.rotation.y=baseTurn;
    let raf,last=0,elapsed=0,lastScroll=0,hasFrame=false,hidden=document.hidden;
    const visibility=()=>{hidden=document.hidden;last=0;};document.addEventListener('visibilitychange',visibility);
    const tick=now=>{
      raf=requestAnimationFrame(tick);if(hidden)return;
      const dt=last?Math.min((now-last)/1000,.05):0;if(last&&now-last<33)return;last=now;
      if(!pausedRef.current){elapsed+=dt;const r=host.getBoundingClientRect(),p=THREE.MathUtils.clamp((innerHeight-r.top)/(innerHeight+r.height),0,1);lastScroll=THREE.MathUtils.lerp(lastScroll,(p-.5)*.78,.055);specimen.rotation.y=baseTurn+lastScroll+Math.sin(elapsed*.24)*.08;specimen.userData.body.scale.y=1+Math.sin(elapsed*1.3)*.007;}
      controls?.update();if(!pausedRef.current||!hasFrame||interactive||needsRender){renderer.render(scene,camera);hasFrame=true;needsRender=false;}
    };raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('wheel',wheel,true);controls?.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[species,interactive,near]);
  return <div ref={hostRef} className={`specimen-scene ${className}`} role={interactive?'img':undefined} aria-label={interactive?'立体の生体モデル。ドラッグで回転できます。':undefined} style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',pointerEvents:interactive?'auto':'none',background:'radial-gradient(ellipse at 50% 55%, #32223a66 0%, #120b1e88 70%)',touchAction:interactive?'pan-y':undefined}}>{failed&&<span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:12,color:'#dbbdef'}}>3D表示に対応したブラウザでご覧ください</span>}</div>;
}
