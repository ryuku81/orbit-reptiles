import { useEffect, useRef } from 'react';
import { SEQUENCE, sequencePosition } from './serpent-sequence.js';

import { createSerpentRenderer } from './serpent-hd-renderer.js';

const valueOf = p => typeof p === 'number' ? p : p?.get?.() ?? 0;

/** Continuously warp restored high-resolution key poses with bidirectional motion fields. */
export default function SerpentPortrait({ progress, paused = false, reduced = false, onReady, className = '' }) {
  const host = useRef(null), state = useRef({}), refresh = useRef(null);
  state.current = { progress, paused, reduced, onReady };
  useEffect(() => { refresh.current?.(); }, [paused, reduced, onReady]);
  useEffect(() => {
    const element = host.current, canvas = document.createElement('canvas');
    const abort = new AbortController();
    let renderer = null;
    canvas.setAttribute('aria-hidden', 'true');
    element.appendChild(canvas);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, loaded = false, raf = 0, visible = true, position = 0, draws = 0;
    let lastPosition = -1, dirty = true;
    const isReduced = () => state.current.reduced || media.matches;
    function request() {
      if (!disposed && loaded && visible && !document.hidden && !raf) raf = requestAnimationFrame(draw);
    }
    function draw() {
      raf = 0;
      if (disposed || !loaded || !visible || document.hidden) return;
      if (isReduced()) position = 0;
      else if (!state.current.paused) position = sequencePosition(valueOf(state.current.progress));
      if (!dirty && Math.abs(position - lastPosition) < .001) return;
      const index = Math.round(position);
      renderer.draw(position);
      lastPosition = position; dirty = false;
      element.dataset.frame = String(index + 1);
      element.dataset.position = position.toFixed(6);
      element.dataset.renderer = 'optical-flow-webgl';
      element.dataset.progress = (position / (SEQUENCE.count - 1)).toFixed(4);
      element.dataset.draws = String(++draws);
      element.dataset.phase = position < 10 ? 'coiling' : position < 20 ? 'opening' : 'strike';
      element.dataset.renderState = isReduced() ? 'reduced' : state.current.paused ? 'paused' : 'running';
      if (element.dataset.ready !== 'true') {
        element.dataset.ready = 'true'; state.current.onReady?.(true);
      }
    }
    const wake = () => { dirty = true; request(); };
    refresh.current = wake;
    const unsubscribe = typeof progress?.on === 'function' ? progress.on('change', () => {
      if (!state.current.paused && !isReduced()) request();
    }) : null;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; }
    });
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(element.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(element.clientHeight * ratio));
      wake();
    });
    resize.observe(element);
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else wake();
    };
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', wake);
    const fallback = () => {
      if (!disposed) { loaded = false; element.dataset.ready = 'false'; element.dataset.renderState = 'fallback'; state.current.onReady?.(false); }
    };
    canvas.addEventListener('webglcontextlost', fallback);
    createSerpentRenderer(canvas, abort.signal).then(result => {
      if (disposed) { result.destroy(); return; }
      renderer = result; loaded = true; wake();
    }).catch(fallback);
    return () => {
      disposed = true; cancelAnimationFrame(raf); unsubscribe?.(); resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', wake);
      abort.abort(); renderer?.destroy(); canvas.removeEventListener('webglcontextlost', fallback); canvas.remove(); refresh.current = null;
    };
  }, [progress]);
  return <div ref={host} className={`serpent-portrait-renderer ${className}`} data-ready="false" data-sequence-length={SEQUENCE.count} aria-hidden="true" />;
}
