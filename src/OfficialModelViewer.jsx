import { useEffect, useRef, useState } from 'react';
import './official-model-viewer.css';

let sdkPromise;
const loadSDK = () => {
  if (window.Sketchfab) return Promise.resolve(window.Sketchfab);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.async = true;
    script.onload = () => window.Sketchfab ? resolve(window.Sketchfab) : reject(new Error('Viewer API unavailable'));
    script.onerror = () => { sdkPromise = undefined; script.remove(); reject(new Error('Viewer could not load')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};
const clamp = (n,a,b) => Math.min(b,Math.max(a,n));

/** Original creator-hosted sculpt/scan, rendered by the official Sketchfab viewer. */
export default function OfficialModelViewer({ model, paused=false, autoRotate=true, focus='full', resetKey=0, interactive=false, compact=false, allowPageScroll=true, onReady, className='' }) {
  const host=useRef(null), iframe=useRef(null), options=useRef({}), controller=useRef(null);
  const [loaded,setLoaded]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const visibility=useRef(true);
  options.current={paused,autoRotate,focus,resetKey,interactive,onReady};
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>{
      visibility.current=entry.isIntersecting;
      if(entry.isIntersecting)setLoaded(true);
      controller.current?.visibility();
    },{rootMargin:'220px'});
    observer.observe(host.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{controller.current?.update();},[paused,autoRotate,focus,resetKey]);
  useEffect(()=>{
    if(!loaded)return;
    let disposed=false,api=null,timer=0,timeout=0,readyNow=false,rendering=false,elapsed=0,last=performance.now(),baseline=null,detailTarget=null;
    let yaw=0,pitch=0,zoom=model.framingScale||1,spin=0,scrollAngle=0,scrollOrigin=window.scrollY,manualUntil=0,hovering=false,previousReset=options.current.resetKey,previousFocus=options.current.focus;
    const frame=iframe.current,element=host.current;
    hovering=interactive&&matchMedia('(hover: hover)').matches&&element.matches(':hover');
    setReady(false);setError(false);
    const shouldMove=()=>!options.current.paused&&visibility.current&&!document.hidden;
    const camera=(duration=.12)=>{
      if(!api||!baseline)return;
      const delta=baseline.position.map((v,i)=>v-baseline.target[i]);
      const radius=Math.hypot(...delta),azimuth=Math.atan2(delta[1],delta[0]);
      const elevation=Math.atan2(delta[2],Math.hypot(delta[0],delta[1]));
      const detail=options.current.focus==='detail';
      const target=detail&&detailTarget?detailTarget:baseline.target;
      const sway=spin;
      const aspectFit=Math.max(1,1.35/(element.clientWidth/Math.max(1,element.clientHeight)));
      const az=azimuth+yaw+sway+scrollAngle,el=clamp(elevation+pitch,-1.25,1.25),r=radius*zoom*aspectFit*(detail?.62:1);
      api.setCameraLookAt([target[0]+Math.cos(az)*Math.cos(el)*r,target[1]+Math.sin(az)*Math.cos(el)*r,target[2]+Math.sin(el)*r],target,duration,()=>{});
    };
    const update=()=>{
      if(!readyNow)return;
      if(previousReset!==options.current.resetKey){previousReset=options.current.resetKey;yaw=0;pitch=0;zoom=model.framingScale||1;elapsed=0;spin=0;scrollAngle=0;scrollOrigin=window.scrollY;}
      if(previousFocus!==options.current.focus){previousFocus=options.current.focus;manualUntil=performance.now()+800;}
      if(options.current.paused)api.pause(()=>{});else api.play(()=>{});
      camera(options.current.paused?0:.65);
    };
    const setVisibility=()=>{
      if(!api||!readyNow)return;
      const next=visibility.current&&!document.hidden;
      if(next&&!rendering){api.start();rendering=true;update();}
      if(!next&&rendering){api.stop();rendering=false;}
    };
    const pointerState=new Map();let gesture=null;
    const enter=e=>{if(e.pointerType!=='touch')hovering=true;};
    const leave=e=>{if(e.pointerType!=='touch')hovering=false;};
    const down=e=>{
      if(!readyNow||(e.pointerType==='mouse'&&e.button!==0))return;
      e.currentTarget.setPointerCapture(e.pointerId);
      element.dataset.interacting='true';
      pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...pointerState.values()];
      gesture={x:e.clientX,y:e.clientY,yaw,pitch,zoom,distance:points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0};
      manualUntil=performance.now()+2000;
    };
    const move=e=>{
      if(!pointerState.has(e.pointerId)||!gesture)return;
      pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...pointerState.values()];
      if(points.length===2){const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(gesture.distance)zoom=clamp(gesture.zoom*gesture.distance/distance,.45,1.8);}
      else {yaw=gesture.yaw-(e.clientX-gesture.x)/Math.max(300,element.clientWidth)*Math.PI*1.5;if(e.pointerType!=='touch')pitch=gesture.pitch+(e.clientY-gesture.y)/Math.max(300,element.clientHeight)*1.2;}
      camera(0);manualUntil=performance.now()+1500;
    };
    const up=e=>{pointerState.delete(e.pointerId);gesture=null;element.dataset.interacting='false';manualUntil=performance.now()+1800;};
    const keyboard=e=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const step=.15;
      if(e.key==='ArrowLeft')yaw-=step;else if(e.key==='ArrowRight')yaw+=step;else if(e.key==='ArrowUp')pitch+=step;else if(e.key==='ArrowDown')pitch-=step;else if(e.key==='+'||e.key==='=')zoom=clamp(zoom*.85,.45,1.8);else if(e.key==='-')zoom=clamp(zoom/ .85,.45,1.8);else return;
      e.preventDefault();camera(.2);manualUntil=performance.now()+1500;
    };
    controller.current={update,visibility:setVisibility,down,move,up,keyboard,enter,leave};
    const tick=()=>{
      if(disposed)return;
      const now=performance.now(),dt=Math.min((now-last)/1000,.15);last=now;
      if(readyNow&&shouldMove()&&now>manualUntil&&!gesture&&!hovering){
        elapsed+=dt;
        if(options.current.autoRotate)spin=Math.sin(elapsed*.16)*.23;
        const targetScrollAngle=clamp((window.scrollY-scrollOrigin)/Math.max(600,innerHeight)*.14,-.35,.35);
        scrollAngle+=(targetScrollAngle-scrollAngle)*(1-Math.exp(-dt*4));
        camera(.14);
      }
    };
    const fail=()=>{if(disposed)return;setError(true);clearTimeout(timeout);};
    timeout=setTimeout(fail,45000);
    loadSDK().then(Sketchfab=>{
      if(disposed)return;
      const client=new Sketchfab('1.12.1',frame);
      client.init(model.uid,{
        autostart:1,preload:0,animation_autoplay:0,camera:0,autospin:0,dnt:1,scrollwheel:0,
        max_texture_size:interactive&&!compact?4096:2048,ui_theme:'dark',ui_stop:0,ui_hint:0,ui_controls:interactive?1:0,
        success(instance){
          if(disposed){instance.stop();return;}
          api=instance;api.start();rendering=true;
          api.addEventListener('viewerready',()=>{
            if(disposed)return;
            readyNow=true;clearTimeout(timeout);setReady(true);setError(false);
            api.setBackground({color:[.055,.025,.085]},()=>{});
            if(!interactive)api.setUserInteraction(false,()=>{});
            api.getCameraLookAt((err,value)=>{
              if(disposed||err||!value)return;
              baseline={position:[...value.position],target:[...value.target]};
              api.pickFromScreen([frame.clientWidth*.42*devicePixelRatio,frame.clientHeight*.62*devicePixelRatio],(err,pick)=>{if(!disposed&&!err&&pick?.position3D)detailTarget=pick.position3D;});
              update();setVisibility();
              element.dataset.ready='true';
              options.current.onReady?.({title:model.title,author:model.author,triangleCount:model.triangleCount});
            });
          });
        },error:fail,
      });
    }).catch(fail);
    timer=setInterval(tick,120);
    const resize=new ResizeObserver(()=>camera(0));resize.observe(element);
    document.addEventListener('visibilitychange',setVisibility);
    return()=>{disposed=true;clearTimeout(timeout);clearInterval(timer);resize.disconnect();document.removeEventListener('visibilitychange',setVisibility);controller.current=null;if(api)api.stop();frame.src='about:blank';};
  },[loaded,model.uid,retry,interactive,compact]);
  return <div ref={host} className={`official-model-viewer ${compact?'official-model-card':''} ${className}`} data-model-id={model.uid} data-ready={ready?'true':'false'} onPointerEnter={e=>controller.current?.enter(e)} onPointerLeave={e=>controller.current?.leave(e)}>
    {loaded&&<iframe ref={iframe} title={`${model.title} — ${model.author} の精密3Dモデル`} allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope" allowFullScreen tabIndex={interactive?0:-1} style={{pointerEvents:interactive?'auto':'none'}}/>}
    {!ready&&!error&&<div className="official-viewer-loading" role="status"><span className="viewer-loading-orbit"/><span>精密3Dモデルを読み込んでいます</span><small>{model.author}</small></div>}
    {error&&<div className="official-viewer-error" role="status"><strong>3Dモデルを読み込めませんでした</strong><span>ネットワークを確認して、もう一度お試しください。</span>{interactive?<button onClick={()=>setRetry(n=>n+1)}>再読み込み</button>:<small>詳細を開くと再読み込みできます</small>}</div>}
    {interactive&&ready&&<div className="official-viewer-gesture" role="application" aria-label={`${model.title}を回転。ドラッグ、または矢印キーで操作。プラスとマイナスでズーム`} tabIndex={0} onPointerDown={e=>controller.current?.down(e)} onPointerMove={e=>controller.current?.move(e)} onPointerUp={e=>controller.current?.up(e)} onPointerCancel={e=>controller.current?.up(e)} onLostPointerCapture={e=>controller.current?.up(e)} onKeyDown={e=>controller.current?.keyboard(e)} style={{touchAction:allowPageScroll?'pan-y':'none'}}/>}
  </div>;
}
