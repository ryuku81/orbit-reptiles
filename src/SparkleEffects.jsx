import { useEffect, useRef } from 'react';
import './sparkle-effects.css';

const COLORS = ['236,211,255', '211,148,255', '255,186,239', '157,224,255', '250,242,255'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => value * value * (3 - 2 * value);

/** Decorative particles only: native pointer, scrolling and controls keep their behavior. */
export default function SparkleEffects({ paused = false }) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  const refreshRef = useRef(null);

  useEffect(() => {
    pausedRef.current = paused;
    refreshRef.current?.();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!context) return undefined;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 1, height = 1, mobile = false, frame = 0, previous = 0, clock = 0;
    let disposed = false, lastPointerTime = 0, nextMeteor = 2.5, warp = null;
    let pointer = null;
    const particles = [], rings = [], meteors = [];
    // Repeatable ray geometry avoids reallocating a large effect on every warp.
    let seed = 92812;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const rays = Array.from({ length: 150 }, () => ({ angle: random() * Math.PI * 2, depth: random(), speed: .45 + random() * .65, length: .02 + random() * .06, color: COLORS[Math.floor(random() * COLORS.length)] }));
    const enabled = () => !disposed && !pausedRef.current && !reduced.matches && !document.hidden;
    const clear = () => {
      particles.length = 0; rings.length = 0; meteors.length = 0; warp = null; pointer = null;
      context.clearRect(0, 0, width, height);
    };
    const isTextInput = target => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
    const addParticle = particle => {
      const limit = mobile ? 160 : 300;
      if (particles.length >= limit) particles.shift();
      particles.push(particle);
    };
    const sparkle = (x, y, energetic = false, power = 1) => {
      const angle = random() * Math.PI * 2;
      const speed = energetic ? (45 + random() * 190) * power : 6 + random() * 20;
      const life = energetic ? .65 + random() * .85 : .35 + random() * .5;
      addParticle({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (energetic ? 12 : 8), life, maxLife: life, size: energetic ? .75 + random() * 2.2 : .65 + random() * 2, angle, turn: (random() - .5) * 1.7, color: COLORS[Math.floor(random() * COLORS.length)], star: random() > .55, streak: energetic && random() > .25 });
    };
    const burst = (x = width / 2, y = height / 2, power = 1) => {
      if (!enabled()) return;
      const strength = clamp(Number.isFinite(power) ? power : 1, .4, 2.5);
      const cx = clamp(Number.isFinite(x) ? x : width / 2, 0, width);
      const cy = clamp(Number.isFinite(y) ? y : height / 2, 0, height);
      const count = Math.round((mobile ? 28 : 48) * Math.sqrt(strength));
      for (let i = 0; i < count; i++) sparkle(cx, cy, true, strength);
      if (rings.length >= 8) rings.shift();
      rings.push({ x: cx, y: cy, age: 0, power: strength });
    };
    const onBurst = event => {
      const detail = event.detail || {};
      burst(detail.x, detail.y, detail.power);
    };
    const onWarp = event => {
      if (!enabled()) return;
      // Durations are milliseconds. A single smooth crescendo avoids strobing.
      const value = event.detail?.duration;
      warp = { start: clock, duration: clamp(Number.isFinite(value) ? value : 2200, 1000, 5000) / 1000, x: width * .53, y: height * .46 };
      burst(warp.x, warp.y, .8);
    };
    const onPointer = event => {
      if (!enabled() || event.pointerType === 'touch' || isTextInput(event.target)) return;
      if (event.timeStamp - lastPointerTime < 18) return;
      lastPointerTime = event.timeStamp;
      const current = { x: event.clientX, y: event.clientY };
      if (pointer) {
        const distance = Math.hypot(current.x - pointer.x, current.y - pointer.y);
        // Interpolate the path; cap steps when the pointer jumps across the screen.
        const steps = clamp(Math.floor(distance / 12), 1, 5);
        for (let i = 0; i < steps; i++) {
          const t = (i + 1) / steps;
          sparkle(pointer.x + (current.x - pointer.x) * t, pointer.y + (current.y - pointer.y) * t);
        }
      }
      pointer = current;
    };
    const onPointerLeave = event => { if (!event.relatedTarget) pointer = null; };
    const onClick = event => {
      if (!enabled() || isTextInput(event.target)) return;
      // Keyboard-triggered buttons burst at their position instead of the viewport corner.
      if (event.detail === 0 && event.target instanceof Element) {
        const bounds = event.target.getBoundingClientRect();
        burst(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, .7);
      } else burst(event.clientX, event.clientY, .85);
    };

    const drawGlint = (x, y, size, angle, color, alpha) => {
      context.save();
      context.translate(x, y); context.rotate(angle);
      context.fillStyle = `rgba(${color},${alpha})`;
      context.shadowColor = `rgba(${color},${alpha * .7})`; context.shadowBlur = 9;
      context.beginPath();
      context.moveTo(0, -size * 2.2); context.lineTo(size * .32, -size * .32);
      context.lineTo(size * 1.5, 0); context.lineTo(size * .32, size * .32);
      context.lineTo(0, size * 2.2); context.lineTo(-size * .32, size * .32);
      context.lineTo(-size * 1.5, 0); context.lineTo(-size * .32, -size * .32);
      context.closePath(); context.fill(); context.restore();
    };
    const drawParticles = dt => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-dt * 1.6); p.vy *= Math.exp(-dt * 1.6);
        p.angle += p.turn * dt;
        const progress = p.life / p.maxLife;
        const alpha = Math.min(1, progress * 2) * .85;
        if (p.streak) {
          context.beginPath(); context.moveTo(p.x, p.y);
          context.lineTo(p.x - p.vx * .035, p.y - p.vy * .035);
          context.strokeStyle = `rgba(${p.color},${alpha * .5})`; context.lineWidth = p.size * .45; context.stroke();
        }
        if (p.star) drawGlint(p.x, p.y, p.size * (.4 + progress * .6), p.angle, p.color, alpha);
        else {
          context.beginPath(); context.arc(p.x, p.y, p.size * (.4 + progress * .6), 0, Math.PI * 2);
          context.fillStyle = `rgba(${p.color},${alpha})`; context.fill();
        }
      }
    };
    const drawRings = dt => {
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]; ring.age += dt;
        if (ring.age > 1.1) { rings.splice(i, 1); continue; }
        const t = ring.age / 1.1, radius = (12 + (1 - Math.pow(1 - t, 3)) * 110) * Math.sqrt(ring.power);
        context.strokeStyle = `rgba(218,168,255,${(1 - t) * .34})`;
        context.lineWidth = 1 - t * .6;
        context.shadowColor = '#d89dff'; context.shadowBlur = 11 * (1 - t);
        context.beginPath(); context.ellipse(ring.x, ring.y, radius, radius * .7, -.3, 0, Math.PI * 2); context.stroke();
        context.shadowBlur = 0;
        context.strokeStyle = `rgba(189,221,255,${(1 - t) * .15})`;
        context.beginPath(); context.arc(ring.x, ring.y, radius * 1.2, 0, Math.PI * 2); context.stroke();
      }
    };
    const drawMeteors = dt => {
      if (clock > nextMeteor && !warp) {
        nextMeteor = clock + 4.5 + random() * 4;
        if (meteors.length < 2) meteors.push({ x: width * (.3 + random() * .6), y: height * random() * .35, age: 0, duration: 1.25, length: mobile ? 110 : 185, vx: -230, vy: 155 });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const meteor = meteors[i]; meteor.age += dt;
        if (meteor.age > meteor.duration) { meteors.splice(i, 1); continue; }
        const t = meteor.age / meteor.duration, alpha = Math.sin(t * Math.PI) * .65;
        const x = meteor.x + meteor.vx * meteor.age, y = meteor.y + meteor.vy * meteor.age;
        const tx = x + meteor.length, ty = y - meteor.length * .67;
        const gradient = context.createLinearGradient(x, y, tx, ty);
        gradient.addColorStop(0, `rgba(242,222,255,${alpha})`);
        gradient.addColorStop(.16, `rgba(208,158,255,${alpha * .6})`);
        gradient.addColorStop(1, 'rgba(184,125,255,0)');
        context.beginPath(); context.moveTo(x, y); context.lineTo(tx, ty);
        context.strokeStyle = gradient; context.lineWidth = 1.2; context.stroke();
        drawGlint(x, y, 1.6, .4, '239,213,255', alpha);
      }
    };
    const drawWarp = () => {
      if (!warp) return;
      const t = (clock - warp.start) / warp.duration;
      if (t >= 1) { warp = null; return; }
      const envelope = smooth(Math.min(t / .25, 1)) * smooth(Math.min((1 - t) / .35, 1));
      const reach = Math.hypot(width, height) * .62;
      const count = mobile ? 85 : rays.length;
      for (let i = 0; i < count; i++) {
        const ray = rays[i], depth = (ray.depth + t * ray.speed * 1.5) % 1;
        const radius = 25 + depth * depth * reach;
        const tail = Math.max(20, radius - (30 + radius * ray.length * 4) * envelope);
        const c = Math.cos(ray.angle), s = Math.sin(ray.angle);
        const x = warp.x + c * radius, y = warp.y + s * radius;
        const tx = warp.x + c * tail, ty = warp.y + s * tail;
        const alpha = envelope * Math.sin(depth * Math.PI) * .74;
        const gradient = context.createLinearGradient(tx, ty, x, y);
        gradient.addColorStop(0, `rgba(${ray.color},0)`);
        gradient.addColorStop(.7, `rgba(${ray.color},${alpha * .45})`);
        gradient.addColorStop(1, `rgba(${ray.color},${alpha})`);
        context.strokeStyle = gradient; context.lineWidth = .55 + depth * 1.4;
        context.beginPath(); context.moveTo(tx, ty); context.lineTo(x, y); context.stroke();
      }
      // A soft lens halo frames the warp without masking any page content.
      const halo = context.createRadialGradient(warp.x, warp.y, 25, warp.x, warp.y, reach * .48);
      halo.addColorStop(0, 'rgba(185,138,255,0)');
      halo.addColorStop(.58, `rgba(184,116,255,${envelope * .055})`);
      halo.addColorStop(.73, `rgba(230,174,255,${envelope * .12})`);
      halo.addColorStop(1, 'rgba(181,121,255,0)');
      context.fillStyle = halo; context.fillRect(0, 0, width, height);
    };
    const render = now => {
      frame = 0;
      if (!enabled()) return;
      if (previous && now - previous < 24) { frame = requestAnimationFrame(render); return; }
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 40;
      previous = now; clock += dt;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      drawWarp(); drawMeteors(dt); drawRings(dt); drawParticles(dt);
      context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(render);
    };
    const refresh = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      if (enabled()) frame = requestAnimationFrame(render);
      else clear();
    };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight; mobile = width < 640;
      const dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (warp) { warp.x = width * .53; warp.y = height * .46; }
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerout', onPointerLeave, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('orbit:burst', onBurst);
    window.addEventListener('orbit:warp', onWarp);
    document.addEventListener('visibilitychange', refresh);
    reduced.addEventListener('change', refresh);
    refreshRef.current = refresh; resize(); refresh();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); clear(); refreshRef.current = null;
      window.removeEventListener('pointermove', onPointer); window.removeEventListener('pointerout', onPointerLeave);
      window.removeEventListener('click', onClick); window.removeEventListener('orbit:burst', onBurst); window.removeEventListener('orbit:warp', onWarp);
      document.removeEventListener('visibilitychange', refresh); reduced.removeEventListener('change', refresh);
    };
  }, []);

  return <canvas ref={canvasRef} className="sparkle-effects" aria-hidden="true" />;
}
