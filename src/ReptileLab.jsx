import useMotionPreference from './useMotionPreference.js';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Cube, Scan, Sparkle, ArrowsOut, ArrowCounterClockwise, Hand, ArrowUpRight } from '@phosphor-icons/react';
import './reptile-lab.css';
const ReptileScene = lazy(() => import('./ReptileScene.jsx'));
const palettes = [
  { id: 'natural', label: 'ナチュラル', english: 'NATURAL', color: '#9ac986' },
  { id: 'amethyst', label: 'アメジスト', english: 'AMETHYST', color: '#bf7aff' },
  { id: 'nebula', label: 'ネビュラ', english: 'NEBULA', color: '#ff83c6' },
  { id: 'stardust', label: 'スターダスト', english: 'STARDUST', color: '#77e5ff' },
];

export default function ReptileLab({ paused = false }) {
  const ref = useRef(null);
  const reduced = useMotionPreference();
  const [loaded, setLoaded] = useState(false);
  const [colorMode, setColorMode] = useState('natural');
  const [scan, setScan] = useState(false);
  const [explode, setExplode] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const palette = palettes.find(item => item.id === colorMode);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setLoaded(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const emit = event => {
    if (paused || reduced) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('orbit:burst', { detail: { x: left + width / 2, y: top + height / 2, power: .65 } }));
  };
  const reset = () => { setColorMode('natural'); setScan(false); setExplode(false); setResetKey(key => key + 1); };
  return <section id="reptile-lab" className="reptile-lab" ref={ref} style={{ '--lab-accent': palette.color }} aria-labelledby="reptile-lab-title">
    <div className="lab-introduction">
      <motion.div className="lab-heading" initial={paused || reduced ? false : { opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: paused || reduced ? 0 : .8 }}>
        <span className="lab-eyebrow"><Sparkle size={16} weight="light"/>LIVING STARDUST</span>
        <h2 id="reptile-lab-title">星から、<span>生まれた。</span></h2>
        <p>触れる。色を変える。星屑にほどく。<br/>息づく鱗を、あらゆる角度から眺めよう。</p>
      </motion.div>
      <div className="lab-invitation"><Cube size={20}/><span>触れるたび、違う表情。</span><ArrowUpRight size={16}/></div>
    </div>
    <div className={`lab-stage ${scan ? 'lab-scanning' : ''} ${explode ? 'lab-dispersed' : ''}`}>
      <div className="lab-stage-halo" aria-hidden="true"/>
      <div className="lab-coordinate" aria-hidden="true"><span>ORBIT SPECIMEN</span><strong>{palette.english}</strong><span>{explode ? 'STARDUST FORM' : scan ? 'SPECTRAL SCAN' : 'LIVING CHAMELEON'}</span></div>
      <div className="lab-canvas" aria-label="色や形を変えて遊べる3D爬虫類">
        {loaded && <Suspense fallback={<div className="lab-loading"><Cube size={38}/><span>星屑が、生命になる。</span></div>}><ReptileScene key={resetKey} paused={paused || reduced} colorMode={colorMode} scan={scan} explode={explode} allowPageScroll/></Suspense>}
        {!loaded && <div className="lab-loading"><Cube size={38}/><span>星屑が、生命になる。</span></div>}
      </div>
      <div className="lab-drag-hint"><Hand size={16}/><span>ドラッグで回転 / ピンチでズーム</span></div>
      <button className="lab-reset" onClick={reset} aria-label="3Dモデルの表示をリセット"><ArrowCounterClockwise size={17}/><span>RESET</span></button>
    </div>
    <div className="lab-controls">
      <div className="lab-spectrum"><span className="lab-control-label">CHOOSE YOUR LIGHT</span><div className="lab-color-options" role="group" aria-label="爬虫類のカラー">{palettes.map(item => <button key={item.id} className={colorMode === item.id ? 'is-selected' : ''} aria-pressed={colorMode === item.id} onClick={event => { setColorMode(item.id); emit(event); }} style={{ '--chip-color': item.color }}><span className="lab-color-gem" aria-hidden="true"/><span>{item.label}</span></button>)}</div></div>
      <div className="lab-actions"><button className={scan ? 'is-selected' : ''} onClick={event => { setScan(value => !value); emit(event); }} aria-pressed={scan}><Scan size={18}/><span>スペクトルスキャン</span></button><button className={`lab-dissolve ${explode ? 'is-selected' : ''}`} onClick={event => { setExplode(value => !value); emit(event); }} aria-pressed={explode}><ArrowsOut size={18}/><span>{explode ? '生命に戻す' : '星屑にほどく'}</span></button></div>
    </div>
    <p className="lab-status" role="status">{explode ? '鱗が星屑になって、宇宙へ広がる。もう一度押すと元の姿に。' : scan ? '光の帯が、鱗の輪郭をなぞっています。' : `${palette.label}の光をまとった、オリジナル3Dアート。`}</p>
  </section>;
}
