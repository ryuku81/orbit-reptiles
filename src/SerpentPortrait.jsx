import { useEffect, useRef } from 'react';
import { SEQUENCE, sequencePosition, frameRect, bodyWave } from './serpent-sequence.js';

const valueOf = p => typeof p === 'number' ? p : p?.get?.() ?? 0;

/** Scrub the user's actual contact-sheet artwork. This is an image sequence, not a 3D replacement. */
export default function SerpentPortrait({ progress, paused = false, reduced = false, onReady, className = '' }) {
  const host = useRef(null), state = useRef({}), refresh = useRef(null);
  state.current = { progress, paused, reduced, onReady };
  useEffect(() => { refresh.current?.(); }, [paused, reduced, onReady]);
  useEffect(() => {
    const element = host.current, canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) { state.current.onReady?.(false); return; }
    const blended = document.createElement('canvas'), warped = document.createElement('canvas');
    blended.width = warped.width = SEQUENCE.width; blended.height = warped.height = SEQUENCE.height;
    const blendContext = blended.getContext('2d'), warpContext = warped.getContext('2d');
    if (!blendContext || !warpContext) { state.current.onReady?.(false); return; }
    canvas.setAttribute('aria-hidden', 'true');
    element.appendChild(canvas);
    const media = matchMedia('(prefers-reduced-motion: reduce)'), atlas = new Image();
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
      const lower = Math.floor(position), upper = Math.min(lower + 1, SEQUENCE.count - 1), mix = position - lower;
      const p = position / (SEQUENCE.count - 1);
      blendContext.clearRect(0, 0, SEQUENCE.width, SEQUENCE.height);
      blendContext.globalCompositeOperation = 'source-over';
      blendContext.globalAlpha = 1 - mix;
      blendContext.drawImage(atlas, ...frameRect(lower), 0, 0, SEQUENCE.width, SEQUENCE.height);
      if (mix > 0) {
        blendContext.globalCompositeOperation = 'lighter';
        blendContext.globalAlpha = mix;
        blendContext.drawImage(atlas, ...frameRect(upper), 0, 0, SEQUENCE.width, SEQUENCE.height);
      }
      blendContext.globalAlpha = 1;
      blendContext.globalCompositeOperation = 'source-over';
      warpContext.clearRect(0, 0, SEQUENCE.width, SEQUENCE.height);
      // Work at native resolution. Reserved padding exceeds the maximum displacement;
      // forehead, eyes, and the final close-up remain rigid and fully visible.
      for (let y = 0; y < SEQUENCE.height; y++) {
        const dx = isReduced() ? 0 : bodyWave(y / SEQUENCE.height, p);
        warpContext.drawImage(blended, 0, y, SEQUENCE.width, 1, dx, y, SEQUENCE.width, 1);
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(warped, 0, 0, canvas.width, canvas.height);
      lastPosition = position; dirty = false;
      element.dataset.frame = String(lower + 1);
      element.dataset.blend = mix.toFixed(3);
      element.dataset.progress = (position / (SEQUENCE.count - 1)).toFixed(4);
      element.dataset.draws = String(++draws);
      element.dataset.phase = lower < 6 ? 'coiling' : lower < 11 ? 'opening' : 'strike';
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
      const ratio = Math.min(devicePixelRatio || 1, 2);
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
    atlas.onload = () => { if (!disposed) { loaded = true; wake(); } };
    atlas.onerror = () => {
      if (!disposed) { element.dataset.ready = 'false'; element.dataset.renderState = 'fallback'; state.current.onReady?.(false); }
    };
    atlas.src = '/images/serpent-sequence/undulation-atlas.webp';
    return () => {
      disposed = true; cancelAnimationFrame(raf); unsubscribe?.(); resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', wake);
      atlas.onload = null; atlas.onerror = null; canvas.remove(); refresh.current = null;
    };
  }, [progress]);
  return <div ref={host} className={`serpent-portrait-renderer ${className}`} data-ready="false" data-sequence-length={SEQUENCE.count} aria-hidden="true" />;
}
