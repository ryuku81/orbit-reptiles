import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createSerpentPortraitGeometry, serpentPortraitVertex, serpentPortraitFragment } from './serpent-portrait-morph.js';

const valueOf = progress => Math.max(0, Math.min(1, typeof progress === 'number' ? progress : progress?.get?.() || 0));

/** Articulates the original illustration; no replacement animal or 3D asset. */
export default function SerpentPortrait({ progress, paused = false, reduced = false, onReady, className = '' }) {
  const host = useRef(null), state = useRef({}), refresh = useRef(null);
  state.current = { progress, paused, reduced, onReady };
  useEffect(() => { refresh.current?.(); }, [progress, paused, reduced, onReady]);

  useEffect(() => {
    const element = host.current, media = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer, disposed = false, failed = false, loaded = false, visible = true, raf = 0;
    let renderedProgress = 0, announced = false, dirty = true;
    let elapsed = 0, lastClock = 0, lastRender = 0, frameCount = 0, wasActive = false;
    const fail = () => {
      if (disposed || failed) return;
      failed = true; cancelAnimationFrame(raf); raf = 0;
      element.dataset.ready = 'false'; element.dataset.renderState = 'fallback';
      if (renderer) renderer.domElement.style.opacity = '0';
      state.current.onReady?.(false);
    };
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' }); }
    catch { fail(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // These illustration pixels already contain their final lighting and colour.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;opacity:0';
    element.appendChild(renderer.domElement);

    const uniforms = {
      artwork: { value: null }, strikeArtwork: { value: null }, opening: { value: 0 },
      time: { value: 0 }, vitality: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: serpentPortraitVertex, fragmentShader: serpentPortraitFragment,
      depthTest: false, depthWrite: false, side: THREE.DoubleSide, transparent: true, premultipliedAlpha: true,
    });
    const geometry = createSerpentPortraitGeometry(), scene = new THREE.Scene(), camera = new THREE.Camera();
    scene.add(new THREE.Mesh(geometry, material));
    const isReduced = () => state.current.reduced || media.matches;
    const isVisible = () => visible && !document.hidden;
    const isActive = () => isVisible() && !state.current.paused && !isReduced();
    const request = () => {
      if (!disposed && !failed && loaded && isVisible() && !raf) raf = requestAnimationFrame(draw);
    };
    function draw(now) {
      raf = 0;
      if (disposed || failed || !loaded || !isVisible()) return;
      const active = isActive();
      if (!active) lastClock = 0;
      if (!dirty && !active) return;
      // Idle movement renders at 30fps; scroll changes can render at 60fps so
      // the jaw follows the stage without overworking high-refresh displays.
      if (active && now - lastRender < 1000 / (dirty ? 60 : 30) - 1) { request(); return; }
      if (active) {
        if (lastClock) elapsed += Math.min(.05, Math.max(0, (now - lastClock) / 1000));
        lastClock = now;
      }
      if (isReduced()) renderedProgress = 0;
      else if (!state.current.paused) renderedProgress = valueOf(state.current.progress);
      const opening = THREE.MathUtils.smoothstep(renderedProgress, .16, .52);
      uniforms.opening.value = opening;
      uniforms.time.value = isReduced() ? 0 : elapsed;
      uniforms.vitality.value = isReduced() ? 0 : 1;
      renderer.render(scene, camera);
      lastRender = now; frameCount++;
      element.dataset.ready = 'true'; element.dataset.progress = renderedProgress.toFixed(4);
      element.dataset.jawOpen = opening.toFixed(4);
      element.dataset.livingTime = uniforms.time.value.toFixed(3);
      element.dataset.frame = String(frameCount);
      element.dataset.vitality = String(uniforms.vitality.value);
      element.dataset.phase = opening === 0 ? 'rest' : opening < 1 ? 'opening' : 'strike';
      element.dataset.renderState = isReduced() ? 'reduced' : state.current.paused ? 'paused' : 'running';
      renderer.domElement.style.opacity = '1'; dirty = false;
      if (!announced) { announced = true; state.current.onReady?.(true); }
      if (active) request();
    }
    const wake = () => {
      const active = isActive();
      if (active !== wasActive) lastClock = 0;
      wasActive = active; dirty = true; request();
    };
    const visibility = () => {
      if (!isVisible()) {
        cancelAnimationFrame(raf); raf = 0; lastClock = 0; wasActive = false;
        element.dataset.renderState = 'hidden';
      }
      else wake();
    };
    refresh.current = wake;
    const unsubscribe = typeof progress?.on === 'function' ? progress.on('change', () => {
      if (!state.current.paused && !isReduced()) wake();
    }) : null;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      // Retain the source's full detail when the outer stage zooms a small mobile frame.
      const resolution = Math.max(1, 1536 / (width * renderer.getPixelRatio()), 1024 / (height * renderer.getPixelRatio()));
      renderer.setSize(Math.round(width * resolution), Math.round(height * resolution), false);
      wake();
    });
    resize.observe(element);
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', wake);
    const contextLost = event => { event.preventDefault(); fail(); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const loader = new THREE.TextureLoader();
    let count = 0;
    const complete = () => { if (!disposed && ++count === 2) { loaded = true; wake(); } };
    const texture = loader.load('/images/celestial-serpent.webp', complete, undefined, fail);
    const strikeTexture = loader.load('/images/celestial-serpent-strike.png', complete, undefined, fail);
    uniforms.artwork.value = texture; uniforms.strikeArtwork.value = strikeTexture;

    return () => {
      disposed = true; cancelAnimationFrame(raf); unsubscribe?.(); observer.disconnect(); resize.disconnect();
      document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', wake);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); refresh.current = null;
      texture.dispose(); strikeTexture.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
      renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [progress]);

  return <div ref={host} className={`serpent-portrait-renderer ${className}`} data-ready="false" data-phase="rest" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}
