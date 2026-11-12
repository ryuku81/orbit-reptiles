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
    let width = 1, height = 1, mobile = false, frame = 0, idleTimer = 0, previous = 0, clock = performance.now() / 1000;
    let disposed = false, lastPointerTime = 0, nextMeteor = clock + 2.5, warp = null;
    let wake = () => {};
    let scrollY = window.scrollY, lastScrollTime = performance.now(), scrollSpeed = 0, flightEnergy = 0;
    let pointer = null;
    const particles = [], rings = [], meteors = [], scrollScenes = [];
    const glintSprites = new Map(), raySprites = new Map();
    const scrollSections = [
      { id: 'reptile-lab', effect: 'orbital-gateway', top: Infinity, fired: -100 },
      { id: 'collection', effect: 'meteor-shower', top: Infinity, fired: -100 },
      { id: 'supernova', effect: 'aurora-ribbons', top: Infinity, fired: -100 },
    ];
    // Repeatable ray geometry avoids reallocating a large effect on every warp.
    let seed = 92812;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const rays = Array.from({ length: 150 }, () => ({ angle: random() * Math.PI * 2, depth: random(), speed: .45 + random() * .65, length: .02 + random() * .06, color: COLORS[Math.floor(random() * COLORS.length)] }));
    const enabled = () => !disposed && !pausedRef.current && !reduced.matches && !document.hidden;
    const clear = () => {
      particles.length = 0; rings.length = 0; meteors.length = 0; scrollScenes.length = 0;
      warp = null; pointer = null; scrollSpeed = 0; flightEnergy = 0;
      nextMeteor = performance.now() / 1000 + 2.5;
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
      wake();
    };
    const onBurst = event => {
      const detail = event.detail || {};
      burst(detail.x, detail.y, detail.power);
    };
    const onWarp = event => {
      if (!enabled()) return;
      // Durations are milliseconds. A single smooth crescendo avoids strobing.
      const value = event.detail?.duration;
      warp = { start: performance.now() / 1000, duration: clamp(Number.isFinite(value) ? value : 2200, 1000, 5000) / 1000, x: width * .53, y: height * .46 };
      burst(warp.x, warp.y, .8);
    };
    const measureScrollSections = () => {
      for (const section of scrollSections) {
        const element = document.getElementById(section.id);
        section.top = element ? element.getBoundingClientRect().top + window.scrollY - innerHeight * .58 : Infinity;
      }
    };
    const beginScrollScene = section => {
      section.fired = clock;
      window.dispatchEvent(new CustomEvent('orbit:scroll-effect', { detail: { id: section.id, effect: section.effect } }));
      if (section.effect === 'meteor-shower') {
        // A staggered family of comets, released by entering the collection.
        for (let i = 0; i < (mobile ? 5 : 8); i++) {
          meteors.push({ x: width * (.35 + random() * .7), y: -height * .12 + random() * height * .25,
            age: -i * .16, duration: 2.5, length: mobile ? 155 : 270,
            vx: -width * .32, vy: height * .34, ceremonial: true });
        }
      } else {
        if (scrollScenes.length >= 2) scrollScenes.shift();
        scrollScenes.push({ kind: section.effect, age: 0, duration: section.effect === 'serpent-constellation' ? 5.2 : 3.6 });
      }
    };
    const onScroll = () => {
      const now = performance.now(), next = window.scrollY, delta = next - scrollY;
      if (enabled()) {
        clock = now / 1000;
        scrollSpeed = clamp(Math.abs(delta) / Math.max((now - lastScrollTime) / 1000, .016) / 1600, 0, 1);
        for (const section of scrollSections) {
          // A single effect per section crossing, with a cooldown for trackpad reversals.
          if (scrollY < section.top && next >= section.top && clock - section.fired > 8) beginScrollScene(section);
        }
        wake();
      }
      scrollY = next; lastScrollTime = now;
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
      wake();
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

    const glintSprite = color => {
      if (glintSprites.has(color)) return glintSprites.get(color);
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
      const ctx = sprite.getContext('2d'); ctx.translate(32, 32);
      ctx.fillStyle = `rgb(${color})`; ctx.shadowColor = `rgba(${color},.7)`; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, -8.8); ctx.lineTo(1.28, -1.28); ctx.lineTo(6, 0); ctx.lineTo(1.28, 1.28);
      ctx.lineTo(0, 8.8); ctx.lineTo(-1.28, 1.28); ctx.lineTo(-6, 0); ctx.lineTo(-1.28, -1.28); ctx.closePath(); ctx.fill();
      glintSprites.set(color, sprite); return sprite;
    };
    const raySprite = color => {
      if (raySprites.has(color)) return raySprites.get(color);
      const sprite = document.createElement('canvas'); sprite.width = 128; sprite.height = 2;
      const ctx = sprite.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 128, 0);
      gradient.addColorStop(0, `rgba(${color},0)`); gradient.addColorStop(.7, `rgba(${color},.45)`); gradient.addColorStop(1, `rgb(${color})`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 2); raySprites.set(color, sprite); return sprite;
    };
    // Cache the blurred stars and streak gradients once, instead of rebuilding
    // hundreds of shadow kernels and gradients on every animation frame.
    const drawGlint = (x, y, size, angle, color, alpha) => {
      context.save();
      context.translate(x, y); context.rotate(angle);
      context.globalAlpha = alpha; context.shadowBlur = 0;
      const extent = size * 8; context.drawImage(glintSprite(color), -extent, -extent, extent * 2, extent * 2); context.restore();
    };
    const drawRay = (x, y, angle, length, thickness, color, alpha) => {
      if (length <= 0 || alpha <= 0) return;
      context.save(); context.translate(x, y); context.rotate(angle); context.globalAlpha = alpha; context.shadowBlur = 0;
      context.drawImage(raySprite(color), 0, -thickness / 2, length, thickness); context.restore();
    };
    const drawParticles = dt => {
      const drag = Math.exp(-dt * 1.6);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= drag; p.vy *= drag;
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
        if (meteor.age < 0) continue;
        if (meteor.age > meteor.duration) { meteors.splice(i, 1); continue; }
        const t = meteor.age / meteor.duration, alpha = Math.sin(t * Math.PI) * .65;
        const x = meteor.x + meteor.vx * meteor.age, y = meteor.y + meteor.vy * meteor.age;
        const tx = x + meteor.length, ty = y - meteor.length * .67;
        drawRay(tx, ty, 2.5513, meteor.length * 1.2037, meteor.ceremonial ? 1.7 : 1.2, '239,213,255', alpha);
        drawGlint(x, y, meteor.ceremonial ? 2.8 : 1.6, .4, '239,213,255', alpha);
      }
    };
    const drawScrollFlight = dt => {
      if (performance.now() - lastScrollTime > 90) scrollSpeed *= Math.exp(-dt * 7);
      flightEnergy += (scrollSpeed - flightEnergy) * (1 - Math.exp(-dt * 5));
      if (flightEnergy < .015 || warp) return;
      const reach = Math.hypot(width, height) * .7;
      const cx = width * (.5 + Math.sin(scrollY * .00025) * .08), cy = height * .44;
      const count = mobile ? 32 : 64;
      for (let i = 0; i < count; i++) {
        const ray = rays[i], depth = (ray.depth + scrollY * .00017 * ray.speed) % 1;
        const radius = 35 + depth * depth * reach;
        const length = (8 + depth * 70) * flightEnergy;
        const c = Math.cos(ray.angle), s = Math.sin(ray.angle);
        const tx = cx + c * (radius - length), ty = cy + s * (radius - length);
        const alpha = Math.sin(depth * Math.PI) * flightEnergy * .45;
        drawRay(tx, ty, ray.angle, length, .6 + depth * .7, ray.color, alpha);
      }
    };
    const drawScrollScenes = dt => {
      for (let i = scrollScenes.length - 1; i >= 0; i--) {
        const scene = scrollScenes[i]; scene.age += dt;
        const t = scene.age / scene.duration;
        if (t >= 1) { scrollScenes.splice(i, 1); continue; }
        const alpha = smooth(Math.min(t / .18, 1)) * smooth(Math.min((1 - t) / .3, 1));
        context.save();
        if (scene.kind === 'orbital-gateway') {
          const cx = width * .55, cy = height * .66;
          const radius = Math.min(width, height) * (.16 + smooth(t) * .54);
          // Three intersecting orbits open smoothly as the 3D animal arrives.
          for (let ring = 0; ring < 3; ring++) {
            const angle = -.7 + ring * .8 + t * .34;
            context.strokeStyle = `rgba(${COLORS[ring]},${alpha * (.27 - ring * .035)})`;
            context.lineWidth = ring === 0 ? 1.3 : .8;
            context.shadowColor = '#d2a1ff'; context.shadowBlur = mobile ? 5 : 12;
            context.beginPath(); context.ellipse(cx, cy, radius * (1 + ring * .11), radius * .36, angle, 0, Math.PI * 2); context.stroke();
            const orbit = t * Math.PI * 2 + ring * 2.1;
            const px = Math.cos(orbit) * radius * (1 + ring * .11), py = Math.sin(orbit) * radius * .36;
            drawGlint(cx + px * Math.cos(angle) - py * Math.sin(angle), cy + px * Math.sin(angle) + py * Math.cos(angle), 3.8, t, COLORS[ring], alpha * .8);
          }
        } else if (scene.kind === 'serpent-constellation') {
          const cx = width * (mobile ? .48 : .26), cy = height * .56;
          const scale = Math.min(width * (mobile ? .7 : .35), height * .54);
          const total = 42, visible = Math.min(total, Math.floor(t * total * 2.8));
          const point = index => {
            const q = index / (total - 1);
            return { x: cx + Math.sin(q * Math.PI * 3.4 - .8) * scale * (.23 - q * .08), y: cy + (q - .5) * scale * .95 };
          };
          context.lineWidth = .75; context.strokeStyle = `rgba(199,203,255,${alpha * .38})`;
          context.beginPath();
          for (let n = 0; n < visible; n++) {
            const p = point(n);
            if (n === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
          }
          context.stroke();
          for (let n = 0; n < visible; n += 2) {
            const p = point(n), pulse = .65 + Math.sin(clock * 2 + n) * .25;
            drawGlint(p.x, p.y, n === 0 ? 3.6 : 1.1 + (n % 3) * .45, .4, COLORS[n % COLORS.length], alpha * pulse);
          }
          // Two bright eyes and a small triangular head make the star serpent readable.
          if (visible > 3) {
            const p = point(0);
            context.strokeStyle = `rgba(229,194,255,${alpha * .55})`;
            context.beginPath(); context.moveTo(p.x - 9, p.y - 7); context.lineTo(p.x + 12, p.y - 5); context.lineTo(p.x + 6, p.y + 12); context.closePath(); context.stroke();
            drawGlint(p.x - 3, p.y - 2, 1.5, 0, '228,206,255', alpha);
          }
        } else if (scene.kind === 'aurora-ribbons') {
          for (let ribbon = 0; ribbon < 5; ribbon++) {
            const gradient = context.createLinearGradient(0, height * .3, width, height * .75);
            gradient.addColorStop(0, `rgba(138,195,255,0)`);
            gradient.addColorStop(.35, `rgba(173,145,255,${alpha * .20})`);
            gradient.addColorStop(.64, `rgba(255,171,235,${alpha * .32})`);
            gradient.addColorStop(1, 'rgba(204,150,255,0)');
            context.strokeStyle = gradient; context.lineWidth = 1 + ribbon * .35;
            context.shadowColor = '#d9a3ff'; context.shadowBlur = mobile ? 5 : 10;
            context.beginPath();
            for (let n = 0; n <= 64; n++) {
              const q = n / 64;
              const x = q * width;
              const y = height * (.40 + ribbon * .045 + Math.sin(q * Math.PI * 2 + t * 3 + ribbon * .17) * .15);
              if (n === 0) context.moveTo(x, y); else context.lineTo(x, y);
            }
            context.stroke();
          }
        }
        context.restore();
      }
    };
    const haloSprite = document.createElement('canvas'); haloSprite.width = haloSprite.height = 256;
    const haloContext = haloSprite.getContext('2d'), haloGradient = haloContext.createRadialGradient(128, 128, 6, 128, 128, 128);
    haloGradient.addColorStop(0, 'rgba(185,138,255,0)'); haloGradient.addColorStop(.58, 'rgba(184,116,255,.055)');
    haloGradient.addColorStop(.73, 'rgba(230,174,255,.12)'); haloGradient.addColorStop(1, 'rgba(181,121,255,0)');
    haloContext.fillStyle = haloGradient; haloContext.fillRect(0, 0, 256, 256);
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
        const tx = warp.x + c * tail, ty = warp.y + s * tail;
        const alpha = envelope * Math.sin(depth * Math.PI) * .74;
        drawRay(tx, ty, ray.angle, radius - tail, .55 + depth * 1.4, ray.color, alpha);
      }
      // A soft lens halo frames the warp without masking any page content.
      const radius = reach * .48;
      context.save(); context.globalAlpha = envelope; context.drawImage(haloSprite, warp.x - radius, warp.y - radius, radius * 2, radius * 2); context.restore();
    };
    const render = now => {
      frame = 0;
      if (!enabled()) return;
      if (previous && now - previous < 30) { frame = requestAnimationFrame(render); return; }
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 40;
      previous = now; clock = now / 1000;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      drawScrollFlight(dt); drawScrollScenes(dt); drawWarp(); drawMeteors(dt); drawRings(dt); drawParticles(dt);
      context.globalCompositeOperation = 'source-over';
      if (particles.length || rings.length || meteors.length || scrollScenes.length || warp || flightEnergy > .015 || scrollSpeed > .015) {
        frame = requestAnimationFrame(render);
      } else {
        // A transparent, empty fullscreen canvas does not need 30 repaints/sec.
        previous = 0;
        idleTimer = setTimeout(() => { idleTimer = 0; wake(); }, Math.max(20, (nextMeteor - clock) * 1000 + 20));
      }
    };
    wake = () => {
      if (!enabled() || frame) return;
      clearTimeout(idleTimer); idleTimer = 0;
      frame = requestAnimationFrame(render);
    };
    const refresh = () => {
      cancelAnimationFrame(frame); clearTimeout(idleTimer); frame = 0; idleTimer = 0; previous = 0;
      if (enabled()) frame = requestAnimationFrame(render);
      else clear();
    };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight; mobile = width < 640;
      const dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.25, Math.sqrt(2000000 / Math.max(1, width * height)));
      const bufferWidth = Math.round(width * dpr), bufferHeight = Math.round(height * dpr);
      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) { canvas.width = bufferWidth; canvas.height = bufferHeight; }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (warp) { warp.x = width * .53; warp.y = height * .46; }
      measureScrollSections();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const pageObserver = new ResizeObserver(measureScrollSections); pageObserver.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerout', onPointerLeave, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('orbit:burst', onBurst);
    window.addEventListener('orbit:warp', onWarp);
    document.addEventListener('visibilitychange', refresh);
    reduced.addEventListener('change', refresh);
    refreshRef.current = refresh; resize(); refresh();
    return () => {
      disposed = true; cancelAnimationFrame(frame); clearTimeout(idleTimer); observer.disconnect(); pageObserver.disconnect(); clear(); glintSprites.clear(); raySprites.clear(); refreshRef.current = null;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer); window.removeEventListener('pointerout', onPointerLeave);
      window.removeEventListener('click', onClick); window.removeEventListener('orbit:burst', onBurst); window.removeEventListener('orbit:warp', onWarp);
      document.removeEventListener('visibilitychange', refresh); reduced.removeEventListener('change', refresh);
    };
  }, []);

  return <canvas ref={canvasRef} className="sparkle-effects" aria-hidden="true" />;
}
