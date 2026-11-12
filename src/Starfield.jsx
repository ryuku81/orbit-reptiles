import { useEffect, useRef } from 'react';
export default function Starfield({ paused }) {
 const ref = useRef(null);
 useEffect(() => {
  const canvas=ref.current, ctx=canvas.getContext('2d'); if(!ctx) return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let w=0,h=0,frame,active=true,last=0; const pointer={x:0,y:0};
  const stars=Array.from({length:120},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.2+.25,d:Math.random(),phase:Math.random()*6.28}));
  const resize=()=>{w=canvas.clientWidth;h=canvas.clientHeight;const d=Math.min(devicePixelRatio,1.5);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);draw(0)};
  const draw=(t)=>{ctx.clearRect(0,0,w,h);for(const s of stars){const x=s.x*w+pointer.x*s.d*14,y=s.y*h+pointer.y*s.d*14;ctx.fillStyle=`rgba(206,226,204,${.15+s.d*.45+(paused||reduced.matches?0:Math.sin(t*.0004+s.phase)*.12)})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(s.d>.95){ctx.fillRect(x-3,y-.25,6,.5);ctx.fillRect(x-.25,y-3,.5,6)}}};
  const loop=(t)=>{if(active&&t-last>32){draw(t);last=t}frame=requestAnimationFrame(loop)};
  const move=e=>{if(!paused&&!reduced.matches){pointer.x=e.clientX/innerWidth-.5;pointer.y=e.clientY/innerHeight-.5}};
  const visibility=()=>{active=!document.hidden};
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  if(!paused&&!reduced.matches)frame=requestAnimationFrame(loop);
  window.addEventListener('pointermove',move,{passive:true});document.addEventListener('visibilitychange',visibility);
  return()=>{cancelAnimationFrame(frame);ro.disconnect();window.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',visibility)};
 },[paused]);
 return <canvas ref={ref} className="starfield" aria-hidden="true"/>;
}
