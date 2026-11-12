import useMotionPreference from './useMotionPreference.js';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Cube, Sparkle, ArrowCounterClockwise, Hand, ArrowUpRight, MagnifyingGlassPlus, ArrowsOut, Play, Pause } from '@phosphor-icons/react';
import './reptile-lab.css';
const ReptileScene = lazy(() => import('./ReptileScene.jsx'));

export default function ReptileLab({ paused = false }) {
  const ref = useRef(null), reduced = useMotionPreference();
  const [loaded, setLoaded] = useState(false), [ready, setReady] = useState(false);
  const [focus, setFocus] = useState('full'), [rotating, setRotating] = useState(true), [resetKey, setResetKey] = useState(0);
  const still = paused || reduced;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setLoaded(true); observer.disconnect(); }
    }, { rootMargin: '500px' });
    observer.observe(ref.current); return () => observer.disconnect();
  }, []);
  const emit = event => {
    if (still) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('orbit:burst', { detail: { x: left + width / 2, y: top + height / 2, power: .65 } }));
  };
  const reset = () => { setFocus('full'); setRotating(true); setResetKey(key => key + 1); };
  return <section id="reptile-lab" className="reptile-lab precision-lab" ref={ref} style={{ '--lab-accent': '#c4a0ed' }} aria-labelledby="reptile-lab-title">
    <div className="lab-introduction">
      <motion.div className="lab-heading" initial={still ? false : { opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: still ? 0 : .8 }}>
        <span className="lab-eyebrow"><Sparkle size={16} weight="light"/>A LIVING SCULPTURE</span>
        <h2 id="reptile-lab-title">生命の、<span>その奥へ。</span></h2>
        <p>緻密な鱗。吸い込まれるような瞳。<br/>近づくほどに、見えてくる小さな宇宙。</p>
      </motion.div>
      <div className="lab-invitation"><Cube size={20}/><span>角度を変えて、細部まで。</span><ArrowUpRight size={16}/></div>
    </div>
    <div className="lab-stage precision-stage">
      <div className="lab-canvas" aria-label="精密なカメレオンの3D展示">
        {loaded && <Suspense fallback={<div className="lab-loading"><Cube size={38}/><span>小さな生命を呼び出しています。</span></div>}><ReptileScene paused={still} autoRotate={rotating} focus={focus} resetKey={resetKey} allowPageScroll onReady={() => setReady(true)}/></Suspense>}
        {!loaded && <div className="lab-loading"><Cube size={38}/><span>小さな生命を呼び出しています。</span></div>}
      </div>
    </div>
    <div className="lab-controls precision-controls">
      <div className="lab-spectrum"><span className="lab-control-label">CHANGE YOUR PERSPECTIVE</span><div className="lab-color-options" role="group" aria-label="3Dモデルとの距離">
        <button className={focus === 'full' ? 'is-selected' : ''} style={{ '--chip-color': '#d2b6f6' }} aria-pressed={focus === 'full'} onClick={event => { setFocus('full'); emit(event); }}><ArrowsOut size={16}/><span>全身を眺める</span></button>
        <button className={focus === 'detail' ? 'is-selected' : ''} style={{ '--chip-color': '#d2b6f6' }} aria-pressed={focus === 'detail'} onClick={event => { setFocus('detail'); emit(event); }}><MagnifyingGlassPlus size={16}/><span>ディテールに近づく</span></button>
      </div></div>
      <div className="lab-actions"><button className={rotating ? 'is-selected' : ''} onClick={() => setRotating(value => !value)} aria-pressed={rotating} disabled={still}>{rotating ? <Pause size={16}/> : <Play size={16}/>}<span>{rotating ? '自動回転を止める' : '自動回転を再開'}</span></button><button onClick={reset} aria-label="3Dモデルの表示をリセット"><ArrowCounterClockwise size={16}/><span>RESET</span></button></div>
    </div>
    <p className="lab-status precision-status" role="status"><Hand size={14}/><span>{ready ? '横にドラッグで回転。縦にスクロールすると、次の星へ。' : '精密な3Dモデルを読み込んでいます…'}</span></p>
  </section>;
}
