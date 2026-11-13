export const SEQUENCE = Object.freeze({ count: 16, columns: 4, width: 316, height: 374 });
const clamp = n => Math.max(0, Math.min(1, n));
export function sequencePosition(progress) {
  const t = clamp(((Number.isFinite(progress) ? progress : 0) - .025) / .875);
  if (t >= 1) return SEQUENCE.count - 1;
  // Spend most of the journey coiling, then accelerate through the approach.
  return (t < .66 ? t / .66 * .60 : .60 + .40 * Math.pow((t - .66) / .34, 1.55)) * (SEQUENCE.count - 1);
}
export function frameRect(index) {
  const i = Math.max(0, Math.min(SEQUENCE.count - 1, Math.floor(index)));
  return [(i % SEQUENCE.columns) * SEQUENCE.width, Math.floor(i / SEQUENCE.columns) * SEQUENCE.height, SEQUENCE.width, SEQUENCE.height];
}
export function bodyWave(y, progress) {
  const p = clamp(progress), v = clamp(y);
  const body = clamp((v - .28) / .18);
  const fade = 1 - clamp((p - .62) / .28);
  return 4 * Math.min(1, p / .06) * body * Math.sin(Math.PI * v) ** 2 * fade * Math.sin(p * Math.PI * 9 - v * Math.PI * 3);
}
