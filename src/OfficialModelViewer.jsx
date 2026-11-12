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
const MIN_ZOOM = .3, MAX_ZOOM = 2.4;

/** Creator-hosted geometry and animation, controlled only through the official Viewer API. */
export default function OfficialModelViewer({ model, paused=false, autoRotate=true, focus='full', resetKey=0, interactive=false, compact=false, allowPageScroll=true, onReady, className='' }) {
  const host=useRef(null), iframe=useRef(null), options=useRef({}), controller=useRef(null);
  const [loaded,setLoaded]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const visibility=useRef(false);
  options.current={paused,autoRotate,focus,resetKey,interactive,onReady};
  useEffect(()=>{
    // Preload nearby models, but only render models actually inside the viewport.
    const preload=new IntersectionObserver(([entry])=>{if(entry.isIntersecting)setLoaded(true);},{rootMargin:'220px'});
    const visible=new IntersectionObserver(([entry])=>{visibility.current=entry.isIntersecting;controller.current?.visibility();});
    preload.observe(host.current);visible.observe(host.current);
    return()=>{preload.disconnect();visible.disconnect();};
  },[]);
  useEffect(()=>{controller.current?.update();},[paused,autoRotate,focus,resetKey]);
  useEffect(()=>{
    if(!loaded)return;
    let disposed=false,api=null,raf=0,timeout=0,readyNow=false,rendering=false,elapsed=0,lifeTime=0,last=performance.now(),baseline=null,detailTarget=null;
    let yaw=0,pitch=0,zoom=model.framingScale||1,spin=0,scrollAngle=0,scrollOrigin=window.scrollY,manualUntil=0;
    let renderedYaw=0,renderedPitch=0,renderedZoom=zoom,detailMix=options.current.focus==='detail'?1:0;
    let previousReset=options.current.resetKey,previousFocus=options.current.focus,cameraPending=false,cameraSentAt=0,cameraDirty=true,lastCamera=null;
    let motionNode=null,nativeAnimation=false,motionPending=false,motionSentAt=0;
    const frame=iframe.current,element=host.current;
    let width=element.clientWidth,height=element.clientHeight;
    let hovering=interactive&&matchMedia('(hover: hover)').matches&&element.matches(':hover');
    const phase=(model.uid.charCodeAt(3)%7)*.7;
    const pointerState=new Map();let gesture=null;
    setReady(false);setError(false);
    element.dataset.motion='pending';element.dataset.zoom=zoom.toFixed(3);
    const shouldMove=()=>!options.current.paused&&visibility.current&&!document.hidden;
    const requestTick=()=>{if(!disposed&&!raf&&readyNow&&rendering)raf=requestAnimationFrame(tick);};
    const camera=now=>{
      if(!api||!baseline||!rendering)return;
      // One camera message at a time. Pointer/wheel events only update targets;
      // RAF coalesces them, avoiding a queue of stale iframe camera commands.
      if((cameraPending&&now-cameraSentAt<500)||now-cameraSentAt<1000/30)return;
      const delta=baseline.position.map((v,i)=>v-baseline.target[i]);
      const radius=Math.hypot(...delta),azimuth=Math.atan2(delta[1],delta[0]);
      const elevation=Math.atan2(delta[2],Math.hypot(delta[0],delta[1]));
      const target=baseline.target.map((v,i)=>v+((detailTarget?.[i]??v)-v)*detailMix);
      const aspectFit=Math.max(1,1.35/(width/Math.max(1,height)));
      const az=azimuth+renderedYaw+spin+scrollAngle,el=clamp(elevation+renderedPitch,-1.25,1.25),r=radius*renderedZoom*aspectFit*(1-detailMix*.38);
      const position=[target[0]+Math.cos(az)*Math.cos(el)*r,target[1]+Math.sin(az)*Math.cos(el)*r,target[2]+Math.sin(el)*r];
      const values=[...position,...target];
      if(!cameraDirty&&lastCamera&&values.every((v,i)=>Math.abs(v-lastCamera[i])<radius*.000015))return;
      cameraDirty=false;lastCamera=values;cameraPending=true;cameraSentAt=now;
      api.setCameraLookAt(position,target,0,()=>{cameraPending=false;});
    };
    const syncAnimation=()=>{
      if(!nativeAnimation||!api)return;
      if(shouldMove())api.play(()=>{});else api.pause(()=>{});
    };
    const setupMotion=()=>{
      api.getAnimations((err,clips)=>{
        if(disposed)return;
        const idle=!err&&clips?.find(clip=>/idle|breath|rest/i.test(clip[1]));
        if(idle){
          api.setCurrentAnimationByUID(idle[0],error=>{
            if(disposed||error)return;
            nativeAnimation=true;element.dataset.motion='native-idle';
            api.setCycleMode('loopOne',()=>{});api.setSpeed(.72,()=>{});syncAnimation();
          });
          return;
        }
        // These two glTF models expose a common parent transform. Animate its
        // original local matrix, never the previous frame, so there is no drift
        // and the eyes, skin and claws stay aligned. Static OBJ scans do not
        // expose transforms; their pose is deliberately left intact.
        if(!['lg','cg'].includes(model.id)){element.dataset.motion='camera-only';return;}
        api.getNodeMap((nodeError,nodes)=>{
          if(disposed||nodeError)return;
          const node=Object.values(nodes).find(n=>n.type==='MatrixTransform'&&n.name==='GLTF_SceneRootNode');
          if(!node){element.dataset.motion='camera-only';return;}
          api.getMatrix(node.instanceID,(matrixError,value)=>{
            if(disposed||matrixError||!Array.isArray(value?.local)){element.dataset.motion='camera-only';return;}
            motionNode={id:node.instanceID,base:[...value.local]};element.dataset.motion='breathing-transform';
          });
        });
      });
    };
    const update=()=>{
      if(!readyNow)return;
      if(previousReset!==options.current.resetKey){previousReset=options.current.resetKey;yaw=0;pitch=0;zoom=model.framingScale||1;elapsed=0;spin=0;scrollAngle=0;scrollOrigin=window.scrollY;element.dataset.zoom=zoom.toFixed(3);}
      if(previousFocus!==options.current.focus){previousFocus=options.current.focus;manualUntil=performance.now()+800;}
      syncAnimation();cameraDirty=true;requestTick();
    };
    const setVisibility=()=>{
      if(!api||!readyNow)return;
      const next=visibility.current&&!document.hidden;
      if(next&&!rendering){api.start();rendering=true;last=performance.now();cameraDirty=true;}
      if(!next&&rendering){api.stop();rendering=false;cancelAnimationFrame(raf);raf=0;}
      syncAnimation();requestTick();
    };
    const enter=e=>{if(e.pointerType!=='touch')hovering=true;};
    const leave=e=>{if(e.pointerType!=='touch')hovering=false;};
    const markManual=()=>{manualUntil=performance.now()+1800;cameraDirty=true;element.dataset.zoom=zoom.toFixed(3);requestTick();};
    const down=e=>{
      if(!readyNow||(e.pointerType==='mouse'&&e.button!==0))return;
      e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus({preventScroll:true});
      element.dataset.interacting='true';pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...pointerState.values()];
      gesture={x:e.clientX,y:e.clientY,yaw,pitch,zoom,distance:points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0};
      markManual();
    };
    const move=e=>{
      if(!pointerState.has(e.pointerId)||!gesture)return;
      pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...pointerState.values()];
      if(points.length===2){const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(gesture.distance)zoom=clamp(gesture.zoom*gesture.distance/Math.max(1,distance),MIN_ZOOM,MAX_ZOOM);}
      else {yaw=gesture.yaw-(e.clientX-gesture.x)/Math.max(300,width)*Math.PI*1.5;if(e.pointerType!=='touch')pitch=clamp(gesture.pitch+(e.clientY-gesture.y)/Math.max(300,height)*1.2,-1.8,1.8);}
      markManual();
    };
    const up=e=>{
      pointerState.delete(e.pointerId);element.dataset.interacting='false';
      const remaining=[...pointerState.values()][0];
      gesture=remaining?{x:remaining.x,y:remaining.y,yaw,pitch,zoom,distance:0}:null;markManual();
    };
    const changeZoom=factor=>{zoom=clamp(zoom*factor,MIN_ZOOM,MAX_ZOOM);markManual();};
    const keyboard=e=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const step=.15;
      if(e.key==='ArrowLeft')yaw-=step;else if(e.key==='ArrowRight')yaw+=step;else if(e.key==='ArrowUp')pitch=clamp(pitch+step,-1.8,1.8);else if(e.key==='ArrowDown')pitch=clamp(pitch-step,-1.8,1.8);else if(e.key==='+'||e.key==='=')zoom=clamp(zoom*.85,MIN_ZOOM,MAX_ZOOM);else if(e.key==='-')zoom=clamp(zoom/.85,MIN_ZOOM,MAX_ZOOM);else return;
      e.preventDefault();markManual();
    };
    const wheel=e=>{
      if(!readyNow||!interactive||e.ctrlKey||e.metaKey||!e.target.closest('.official-viewer-gesture'))return;
      e.preventDefault();
      const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
      changeZoom(Math.exp(clamp(pixels,-180,180)*.0018));
    };
    controller.current={update,visibility:setVisibility,down,move,up,keyboard,enter,leave,zoom:changeZoom};
    function tick(now){
      raf=0;if(disposed||!rendering)return;
      const dt=Math.min((now-last)/1000,.08);last=now;
      const automatic=shouldMove();
      if(automatic){
        lifeTime+=dt;
        if(now>manualUntil&&!gesture&&!hovering){
          elapsed+=dt;if(options.current.autoRotate)spin=Math.sin(elapsed*.16)*.23;
          const scrollTarget=clamp((window.scrollY-scrollOrigin)/Math.max(600,innerHeight)*.14,-.35,.35);
          scrollAngle+=(scrollTarget-scrollAngle)*(1-Math.exp(-dt*4));
        }
        if(motionNode&&!gesture&&!motionPending&&now-motionSentAt>1000/15){
          const breath=(1-Math.cos(lifeTime*1.32+phase))*.5;
          const scale=[1+breath*.003,1+breath*.013,1+breath*.004];
          const matrix=motionNode.base.map((v,i)=>i<12?v*scale[Math.floor(i/4)]:v);
          motionPending=true;motionSentAt=now;
          api.setMatrix(motionNode.id,matrix,()=>{motionPending=false;});
        }
      }
      const smooth=1-Math.exp(-dt/(gesture ? .035 : .08));
      renderedYaw+=(yaw-renderedYaw)*smooth;renderedPitch+=(pitch-renderedPitch)*smooth;renderedZoom+=(zoom-renderedZoom)*smooth;
      detailMix+=((options.current.focus==='detail'?1:0)-detailMix)*(1-Math.exp(-dt/.18));
      camera(now);requestTick();
    }
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
            setupMotion();
            api.getCameraLookAt((err,value)=>{
              if(disposed||err||!value)return;
              baseline={position:[...value.position],target:[...value.target]};
              api.pickFromScreen([width*.42*devicePixelRatio,height*.62*devicePixelRatio],(err,pick)=>{if(!disposed&&!err&&pick?.position3D)detailTarget=pick.position3D;});
              update();setVisibility();element.dataset.ready='true';
              options.current.onReady?.({title:model.title,author:model.author,triangleCount:model.triangleCount});
            });
          });
        },error:fail,
      });
    }).catch(fail);
    element.addEventListener('wheel',wheel,{passive:false});
    const resize=new ResizeObserver(()=>{width=element.clientWidth;height=element.clientHeight;cameraDirty=true;requestTick();});resize.observe(element);
    document.addEventListener('visibilitychange',setVisibility);
    return()=>{disposed=true;clearTimeout(timeout);cancelAnimationFrame(raf);resize.disconnect();element.removeEventListener('wheel',wheel);document.removeEventListener('visibilitychange',setVisibility);controller.current=null;if(api)api.stop();frame.src='about:blank';};
  },[loaded,model.uid,retry,interactive,compact]);
  return <div ref={host} className={`official-model-viewer ${compact?'official-model-card':''} ${className}`} data-model-id={model.uid} data-ready={ready?'true':'false'} onPointerEnter={e=>controller.current?.enter(e)} onPointerLeave={e=>controller.current?.leave(e)}>
    {loaded&&<iframe ref={iframe} title={`${model.title} — ${model.author} の精密3Dモデル`} allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope" allowFullScreen tabIndex={interactive?0:-1} style={{pointerEvents:interactive?'auto':'none'}}/>}
    {!ready&&!error&&<div className="official-viewer-loading" role="status"><span className="viewer-loading-orbit"/><span>精密3Dモデルを読み込んでいます</span><small>{model.author}</small></div>}
    {error&&<div className="official-viewer-error" role="status"><strong>3Dモデルを読み込めませんでした</strong><span>ネットワークを確認して、もう一度お試しください。</span>{interactive?<button onClick={()=>setRetry(n=>n+1)}>再読み込み</button>:<small>詳細を開くと再読み込みできます</small>}</div>}
    {interactive&&ready&&<><div className="official-viewer-gesture" role="application" aria-label={`${model.title}を回転。ドラッグまたは矢印キーで回転。ホイール、プラスとマイナスでズーム`} tabIndex={0} onPointerDown={e=>controller.current?.down(e)} onPointerMove={e=>controller.current?.move(e)} onPointerUp={e=>controller.current?.up(e)} onPointerCancel={e=>controller.current?.up(e)} onLostPointerCapture={e=>controller.current?.up(e)} onKeyDown={e=>controller.current?.keyboard(e)} style={{touchAction:allowPageScroll?'pan-y':'none'}}/><div className="official-viewer-zoom" aria-label="3Dの大きさ"><button type="button" aria-label={`${model.title}を拡大`} onClick={()=>controller.current?.zoom(.82)}>＋</button><button type="button" aria-label={`${model.title}を縮小`} onClick={()=>controller.current?.zoom(1/.82)}>−</button></div></>}
  </div>;
}
