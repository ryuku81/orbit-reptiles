import { useEffect, useRef } from 'react';
import './serpent-encounter.css';

const MODEL = '587aff215b4e4bd8939a1748e3ae7c42';
const ATTACK = 'bd80eab18c8944e88d8f5b44b32ce41b';
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
const smooth = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix = (a,b,t) => a+(b-a)*t;
const vectorMix = (a,b,t) => a.map((v,i)=>mix(v,b[i],t));
const normalize = a => {const length=Math.hypot(...a);return a.map(v=>v/length);};
const progressValue = value => clamp(typeof value==='number'?value:value?.get?.()||0);
/** An artist's articulated python, streamed through the official Sketchfab API. */
export default function SerpentEncounter({progress,paused=false,reduced=false,onReady}) {
 const hostRef=useRef(null),frameRef=useRef(null),props=useRef({}),refreshRef=useRef(null);
 props.current={progress,paused,reduced,onReady};
 useEffect(()=>{refreshRef.current?.();},[paused,reduced,progress,onReady]);
 useEffect(()=>{
  const host=hostRef.current,iframe=frameRef.current;
  let disposed=false,failed=false,announced=false,api=null,ready=false,visible=true,rendering=false,raf=0,loadTimeout=0;
  let lastTick=0,lastSent=0,elapsed=0,poseProgress=0,width=1,height=1,dirty=true,pending=false,pendingSince=0;
  let lastValues=null,lastColor=0,skin=null,sendSequence=0,missedReplies=0;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const reduce=()=>props.current.reduced||media.matches;
  const active=()=>ready&&visible&&!document.hidden&&!props.current.paused&&!reduce();
  const restCenter=[17.05594,-10.37537,16.75926];
  const restDirection=normalize([59.79671,-56.22291,95.73166]);
  const mouthCenter=[30,-4,42];
  const mouthDirection=normalize([.45,-.82,.35]);
  const requestTick=()=>{if(!disposed&&ready&&!raf&&rendering)raf=requestAnimationFrame(tick);};
  const fail=()=>{
   if(disposed||failed)return;failed=true;ready=false;rendering=false;
   clearTimeout(loadTimeout);cancelAnimationFrame(raf);raf=0;api?.stop();
   host.dataset.ready='false';host.dataset.renderState='fallback';host.style.opacity='0';props.current.onReady?.(false);
  };
  const pose = p => {
   const preparing=smooth(.30,.60,p),approach=smooth(.62,.87,p),fading=smooth(.90,.99,p);
   // The real rig opens its jaw and raises the neck. Hold its maximum gape as
   // the camera passes the mouth, rather than seeking into its recovery pose.
   const clipTime=mix(.15,1.50,preparing);
   const mobile=width<641,aspect=width/Math.max(1,height);
   const initialDistance=mobile?Math.max(300,212/aspect):267;
   const distance=mix(mix(initialDistance,180,smooth(.30,.60,p)),mobile?40:34,approach);
   const direction=normalize(vectorMix(restDirection,mouthDirection,approach));
   const target=vectorMix(restCenter,mouthCenter,approach);
   const right=normalize([-direction[1],direction[0],0]);
   const centerX=mix(mobile?.5:.70,.5,smooth(.22,.50,p));
   const viewWidth=distance*Math.tan(32*Math.PI/360)*2*aspect;
   target.forEach((v,i)=>target[i]=v-right[i]*(centerX-.5)*viewWidth);
   const position=target.map((v,i)=>v+direction[i]*distance);
   host.style.opacity=String(1-fading);
   host.dataset.progress=p.toFixed(3);host.dataset.clipTime=clipTime.toFixed(3);
   host.dataset.phase=p<.30?'rest':p<.60?'opening':p<.87?'strike':'pass';
   host.dataset.distance=distance.toFixed(2);host.dataset.time=elapsed.toFixed(2);
   return {clipTime,position,target};
  };
  const sendPose = now => {
   if(!api||!ready||!rendering)return;
   if(pending){
    if(now-pendingSince<1200)return;
    pending=false;dirty=true;if(++missedReplies>=3){fail();return;}
   }
   if(now-lastSent<1000/30)return;
   const next=pose(poseProgress),values=[next.clipTime,...next.position,...next.target];
   if(!dirty&&lastValues&&values.every((v,i)=>Math.abs(v-lastValues[i])<.00003))return;
   dirty=false;lastValues=values;pending=true;pendingSince=now;lastSent=now;
   const sequence=++sendSequence;
   const done=()=>{
    if(disposed||failed||sequence!==sendSequence)return;pending=false;missedReplies=0;
    if(!announced){announced=true;clearTimeout(loadTimeout);host.dataset.ready='true';props.current.onReady?.(true);}
    if(dirty)requestTick();
   };
   api.seekTo(next.clipTime,error=>{
    if(disposed||failed||sequence!==sendSequence)return;
    if(error){fail();return;}
    requestAnimationFrame(()=>{
     if(!disposed&&!failed&&sequence===sendSequence)api.setCameraLookAt(next.position,next.target,0,done);
    });
   });
  };
  const refresh = () => {
   if(!ready)return;
   const shouldRender=visible&&!document.hidden;
   if(shouldRender&&!rendering){api.start();rendering=true;dirty=true;lastTick=0;}
   if(!shouldRender&&rendering){api.stop();rendering=false;cancelAnimationFrame(raf);raf=0;}
   api.pause(()=>{});
   if(reduce()){poseProgress=0;dirty=true;}
   host.dataset.renderState=!shouldRender?'hidden':props.current.paused?'paused':reduce()?'reduced':'running';
   requestTick();
  };
  refreshRef.current=refresh;
  function tick(now){
   raf=0;if(disposed||!ready||!rendering)return;
   const dt=lastTick?Math.min(.05,(now-lastTick)/1000):0;lastTick=now;
   if(active()){
    elapsed+=dt;const next=progressValue(props.current.progress);
    if(Math.abs(next-poseProgress)>.00001){poseProgress=next;dirty=true;}
   }
   sendPose(now);
   // Only colour changes in idle; native animation time remains owned by scroll.
   if(active()&&skin&&now-lastColor>500){
    lastColor=now;const wave=(Math.sin(elapsed*.24)+1)*.5;
    skin.channels.DiffusePBR.color=[mix(.14,.21,wave),mix(.045,.075,wave),mix(.29,.36,wave)];
    api.setMaterial(skin,()=>{});
   }
   if(active()||dirty||pending)requestTick();
  }
  const resize = () => {width=host.clientWidth;height=host.clientHeight;dirty=true;requestTick();};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();});observer.observe(host);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  document.addEventListener('visibilitychange',refresh);media.addEventListener('change',refresh);
  loadTimeout=setTimeout(fail,45000);
  const receive = async event => {
   if(disposed||failed||event.origin!==location.origin||event.source!==iframe.contentWindow||event.data?.source!=='orbit-serpent')return;
   if(event.data.type==='error'){fail();return;}
   if(event.data.type!=='ready'||api)return;
   try{
    // Keep the proven SDK initialization isolated from React's mount lifecycle.
    // Only take control after all model metadata is available in the wrapper.
    const child=iframe.contentWindow;api=child.api;rendering=true;
    const invoke=(method,...args)=>new Promise((resolve,reject)=>api[method](...args,(error,value)=>error?reject(error):resolve(value)));
    if(!child.report.animations.some(clip=>clip[0]===ATTACK))throw new Error('Attack animation unavailable');
    await invoke('setCurrentAnimationByUID',ATTACK);host.dataset.clipSelected=ATTACK;
    await invoke('pause');
    const camera=child.report.camera;
    await invoke('setCameraLookAt',camera.position.map((v,i)=>camera.target[i]+(v-camera.target[i])*1.3),camera.target,0);
    await invoke('seekTo',0);
    if(disposed||failed)return;
    skin=structuredClone(child.report.materials.find(m=>m.name==='ballpython_skin'));
    if(skin){
     delete skin.channels.DiffusePBR.texture;skin.channels.DiffusePBR.color=[.17,.055,.33];skin.channels.DiffusePBR.factor=1;
     delete skin.channels.SpecularPBR.texture;skin.channels.SpecularPBR.color=[.78,.62,.96];skin.channels.SpecularPBR.factor=.18;
     skin.channels.GlossinessPBR.factor=.72;skin.channels.BumpMap.factor=.8;
     skin.channels.ClearCoat.enable=true;skin.channels.ClearCoat.factor=.22;skin.channels.ClearCoatRoughness.factor=.25;
     await invoke('setMaterial',skin);
    }
    await invoke('setEnvironment',{shadowEnabled:false}).catch(()=>{});
    await invoke('setFov',32).catch(()=>{});
    if(disposed||failed)return;
    host.__viewerApi=import.meta.env.DEV?api:undefined;ready=true;host.dataset.model=MODEL;
    poseProgress=reduce()?0:progressValue(props.current.progress);dirty=true;refresh();
    sendPose(performance.now());
   }catch{fail();}
  };
  window.addEventListener('message',receive);
  iframe.src='/serpent-viewer.html';
  return()=>{
   disposed=true;clearTimeout(loadTimeout);cancelAnimationFrame(raf);observer.disconnect();resizeObserver.disconnect();
   document.removeEventListener('visibilitychange',refresh);media.removeEventListener('change',refresh);window.removeEventListener('message',receive);refreshRef.current=null;
   api?.stop();delete host.__viewerApi;iframe.src='about:blank';
  };
 },[]);
 return <div className="serpent-webgl-encounter serpent-official-encounter" ref={hostRef} data-ready="false" data-phase="rest" aria-hidden="true"><iframe ref={frameRef} title="Blackhead Ball Python — Nestaeric" allow="autoplay; fullscreen; xr-spatial-tracking" tabIndex={-1}/></div>;
}
