import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkle, ArrowUpRight } from '@phosphor-icons/react';
import useFrozenMotion from './useFrozenMotion.js';
const LivingPortraitEffect = lazy(() => import('./LivingPortraitEffect.jsx'));

export default function StarFinale({ paused = false }) {
  const section = useRef(null), button = useRef(null), charge = useRef({ start: 0, value: 0, frame: 0, active: false }), reset = useRef(null);
  const [charged, setCharged] = useState(false);
  const [reaction, setReaction] = useState(0);
  const greet = event => {
    if (paused) return;
    setReaction(value => value + 1);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width * .43;
    const y = event.detail ? event.clientY : rect.top + rect.height * .22;
    window.dispatchEvent(new CustomEvent('orbit:burst', { detail: { x, y, power: 1.2 } }));
  };
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] });
  const progress = useFrozenMotion(scrollYProgress, paused, .5);
  const scale = useTransform(progress, [0, .5, 1], [.88, 1.10, 1.20]);
  const rotate = useTransform(progress, [0, 1], [-6, 6]);
  const y = useTransform(progress, [0, 1], [100, -90]);
  const finish = (automatic = false) => {
    const state = charge.current;
    if (!state.active) return;
    state.active = false; cancelAnimationFrame(state.frame);
    const power = automatic ? 1 : Math.max(.22, state.value);
    window.dispatchEvent(new CustomEvent('orbit:burst', { detail: { x: innerWidth * .5, y: innerHeight * .45, power: 2 + power * 4 } }));
    if (power > .7) window.dispatchEvent(new CustomEvent('orbit:warp', { detail: { duration: 2600 } }));
    button.current.style.setProperty('--charge', '0');
    setCharged(true); clearTimeout(reset.current); reset.current = setTimeout(() => setCharged(false), 3200);
  };
  const start = () => {
    if (paused || charge.current.active || charged) return;
    charge.current = { start: performance.now(), value: 0, frame: 0, active: true };
    const animate = now => {
      const state = charge.current;
      if (!state.active) return;
      state.value = Math.min((now - state.start) / 1400, 1);
      button.current?.style.setProperty('--charge', String(state.value));
      if (state.value >= 1) finish(true); else state.frame = requestAnimationFrame(animate);
    };
    charge.current.frame = requestAnimationFrame(animate);
  };
  const cancel = () => { charge.current.active = false; cancelAnimationFrame(charge.current.frame); button.current?.style.setProperty('--charge','0'); };
  useEffect(() => { if (paused) cancel(); }, [paused]);
  useEffect(() => () => { cancelAnimationFrame(charge.current.frame); clearTimeout(reset.current); }, []);
  return <section className={`star-finale ${charged?'supernova-active':''}`} ref={section} id="supernova">
    <div className="finale-aurora" aria-hidden="true"/>
    <motion.div className="finale-serpent" style={{ scale, rotate, y }}><div className="finale-living-art"><img src="/images/amethyst-reptile.webp" alt="" loading="lazy"/><Suspense fallback={null}><LivingPortraitEffect variant="gecko" paused={paused} progress={progress} reaction={reaction}/></Suspense><button type="button" className="finale-creature-touch" onClick={greet} disabled={paused} aria-label="紫のトカゲに触れて、星をきらめかせる" title="クリック / タップで反応"/></div></motion.div>
    <div className="finale-copy"><span className="eyebrow">MAKE THE UNIVERSE YOURS</span><h2>その指先から、<br/><span>宇宙が生まれる。</span></h2><p>星を集めて、解き放つ。<br/>まだ見たことのない光を、この場所で。</p><span className="creature-hint">トカゲに触れると、星がきらめく。</span>
      <button ref={button} className="supernova-button" disabled={paused} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);start();}} onPointerUp={()=>finish()} onPointerCancel={cancel} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start();}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();finish();}}} onBlur={cancel} aria-label="SUPERNOVA: 長押しして星を解き放つ"><span className="supernova-fill"/><Sparkle weight="fill" size={21}/><span>{charged?'A STAR IS BORN':'SUPERNOVA'}</span><ArrowUpRight size={18}/></button>
      <span className="charge-hint" aria-live="polite">{paused?'エフェクトを再開すると遊べます':charged?'あなたの星が、きらめいた。':'長押しでチャージ / 離して解き放つ'}</span>
    </div>
  </section>;
}
